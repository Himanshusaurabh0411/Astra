"""Read configured portal exports without depending on a login page or a GIS stack."""

import csv
import io
import json
import logging
import re
import time
from collections.abc import Callable
from pathlib import Path
from xml.etree import ElementTree

import httpx
from pydantic import SecretStr, ValidationError

from app.config import settings
from app.models.regions import geometry_bounds, intersects
from app.models.schemas import GeoJsonFeature, SpatialLayer

logger = logging.getLogger("terrapulse.portals")
logging.getLogger("httpx").setLevel(logging.WARNING)
MAX_RECORDS = 2500
SUPPORTED = {".json", ".geojson", ".csv", ".xml", ".rss", ".tif", ".tiff"}

Decode = Callable[[dict, str, str], list[GeoJsonFeature]]
ReadRaster = Callable[[Path | bytes, str], list[GeoJsonFeature]]


def _tag(node):
    return node.tag.rsplit("}", 1)[-1].lower()


def _xml_document(raw: bytes) -> dict:
    # Parsing uses a bounded input and forbids DTDs and entity declarations.
    xml = raw.decode("utf-8-sig")
    if re.search(r"<!\s*(?:DOCTYPE|ENTITY)", xml, flags=re.IGNORECASE):
        return {}
    tree = ElementTree.fromstring(xml)
    records, features = [], []
    for item in tree.iter():
        if _tag(item) not in ("item", "entry", "featuremember", "member"):
            continue
        fields, geometry = {}, None
        for node in item.iter():
            name = _tag(node)
            value = (node.text or "").strip()
            if not value or len(node):
                continue
            fields[name] = value
            if name in {"point", "pos", "poslist", "polygon", "line", "coordinates"}:
                numbers = [float(v) for v in re.split(r"[\s,]+", value)]
                if len(numbers) < 2 or len(numbers) % 2:
                    continue
                georss = "georss" in node.tag.lower()
                axis = next((n.attrib["srsName"] for n in item.iter() if "srsName" in n.attrib), "")
                lat_first = georss or axis.endswith((":4326", "/4326"))
                pairs = [[y, x] if lat_first else [x, y] for x, y in zip(numbers[::2], numbers[1::2])]
                if len(pairs) == 1:
                    geometry = {"type": "Point", "coordinates": pairs[0]}
                elif name == "polygon" or any(_tag(n) == "polygon" for n in item.iter()):
                    ring = pairs if pairs[0] == pairs[-1] else [*pairs, pairs[0]]
                    geometry = {"type": "Polygon", "coordinates": [ring]}
                else:
                    geometry = {"type": "LineString", "coordinates": pairs}
        if geometry is None:
            geometry = _row_geometry(fields)
        if geometry:
            fields["geometry"] = geometry
            features.append({"type": "Feature", "properties": fields, "geometry": geometry})
        if fields:
            records.append(fields)
        if len(records) >= MAX_RECORDS:
            break
    return {"records": records, "roads": records, "features": features}


def _row_geometry(row: dict) -> dict | None:
    lng = row.get("lng", row.get("lon", row.get("longitude")))
    lat = row.get("lat", row.get("latitude"))
    try:
        if row.get("coordinates"):
            coordinates = json.loads(row["coordinates"])
            if isinstance(coordinates, list) and coordinates:
                kind = "Point" if isinstance(coordinates[0], (int, float)) else "LineString"
                return {"type": row.get("geometry_type", kind), "coordinates": coordinates}
        if all(row.get(field) for field in ("start_lng", "start_lat", "end_lng", "end_lat")):
            return {"type": "LineString", "coordinates": [
                [float(row["start_lng"]), float(row["start_lat"])],
                [float(row["end_lng"]), float(row["end_lat"])],
            ]}
        if lng is not None and lat is not None:
            return {"type": "Point", "coordinates": [float(lng), float(lat)]}
    except (TypeError, ValueError):
        pass
    return None


def _document(raw: bytes, extension: str) -> dict:
    if extension in {".xml", ".rss"} or raw.lstrip().startswith(b"<"):
        return _xml_document(raw)
    if extension == ".csv":
        rows = []
        features = []
        for row in csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))):
            row = {key.strip().lower(): value for key, value in row.items() if key and value not in (None, "")}
            geometry = _row_geometry(row)
            if geometry:
                row["geometry"] = geometry
                features.append({"type": "Feature", "geometry": geometry, "properties": row})
            rows.append(row)
            if len(rows) >= MAX_RECORDS:
                break
        return {"records": rows, "roads": rows, "features": features}
    data = json.loads(raw.decode("utf-8-sig"))
    if isinstance(data, list):
        return {"records": data[:MAX_RECORDS]}
    if not isinstance(data, dict):
        return {}
    return {k: v[:MAX_RECORDS] if isinstance(v, list) else v for k, v in data.items()}


def _valid_geometry(kind: str, coords) -> bool:
    def point(value):
        return (
            isinstance(value, (list, tuple)) and len(value) >= 2
            and isinstance(value[0], (int, float)) and isinstance(value[1], (int, float))
            and -180 <= value[0] <= 180 and -90 <= value[1] <= 90
        )

    def line(value, minimum=2):
        return isinstance(value, list) and len(value) >= minimum and all(point(p) for p in value)

    def polygon(value):
        return isinstance(value, list) and bool(value) and all(
            line(ring, 4) and ring[0][:2] == ring[-1][:2] for ring in value
        )

    if kind == "Point":
        return point(coords)
    if kind == "LineString":
        return line(coords)
    if kind == "Polygon":
        return polygon(coords)
    if kind == "MultiPolygon":
        return isinstance(coords, list) and bool(coords) and all(polygon(poly) for poly in coords)
    return False


def _decode(raw: bytes, extension: str, source: str, decode: Decode, layers, raster: ReadRaster | None):
    if extension in {".tif", ".tiff"} or raw.startswith((b"II*\x00", b"MM\x00*")):
        features = raster(raw, source) if raster else []
    else:
        document = _document(raw, extension)
        normalized, remaining = [], []
        for item in document.get("features", []) if isinstance(document.get("features"), list) else []:
            if not isinstance(item, dict):
                continue
            props = item.get("properties") or {}
            if not isinstance(props, dict) or props.get("layer") not in layers:
                remaining.append(item)
                continue
            try:
                normalized.append(GeoJsonFeature.model_validate(item))
            except ValidationError:
                continue
        if normalized:
            features = normalized
            if remaining:
                features.extend(decode({**document, "features": remaining}, source, extension))
        else:
            features = decode(document, source, extension)
    return [
        feature for feature in features[:MAX_RECORDS]
        if feature.properties.layer in layers
        and _valid_geometry(feature.geometry.type, feature.geometry.coordinates)
        and intersects(geometry_bounds(feature.geometry.coordinates), settings.india_bbox)
    ]


def _download(url: str, token: SecretStr | None) -> tuple[bytes, str]:
    target = httpx.URL(url)
    if target.scheme not in ("http", "https") or not target.host or target.username or target.password:
        raise ValueError("Invalid portal URL")
    headers = {"User-Agent": "TerraPulse/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token.get_secret_value()}"

    limit = settings.PORTAL_MAX_RESPONSE_BYTES
    max_seconds = settings.PORTAL_FETCH_TIMEOUT_SECONDS
    started = time.monotonic()
    with httpx.Client(timeout=max_seconds, follow_redirects=False) as client:
        with client.stream("GET", target, headers=headers) as response:
            response.raise_for_status()
            kind = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
            if kind in ("text/html", "application/xhtml+xml"):
                raise ValueError("Portal returned a web page")
            extension = {
                "text/csv": ".csv",
                "application/rss+xml": ".rss",
                "application/xml": ".xml",
                "text/xml": ".xml",
                "image/tiff": ".tiff",
            }.get(kind, Path(target.path).suffix.lower() or ".json")
            raw = bytearray()
            for chunk in response.iter_bytes(64 * 1024):
                if len(raw) + len(chunk) > limit or time.monotonic() - started > max_seconds:
                    raise ValueError("Portal export exceeded read limits")
                raw.extend(chunk)
            return bytes(raw), extension


def sample_paths(configured: str | None, resolved: Path, national_name: str, nationwide: bool) -> list[Path]:
    return [resolved, resolved.with_name(national_name)] if nationwide and not configured else [resolved]


def read_portal(
    portal: str,
    layers: tuple[SpatialLayer, ...],
    url: str | None,
    token: SecretStr | None,
    paths: list[Path],
    decode: Decode,
    raster: ReadRaster | None = None,
) -> tuple[list[GeoJsonFeature], str]:
    if url:
        try:
            raw, extension = _download(url, token)
            features = _decode(raw, extension, "live_portal", decode, layers, raster)
            if features:
                return _mark(features, portal, "live_portal")
        except (ValueError, TypeError, AttributeError, KeyError, IndexError, httpx.HTTPError, httpx.InvalidURL, ElementTree.ParseError):
            logger.info("%s feed unavailable. Checking local files.", portal)

    available: dict[str, GeoJsonFeature] = {}
    for path in paths:
        try:
            candidates = sorted(path.iterdir()) if path.is_dir() else [path]
        except OSError:
            continue
        for file in candidates:
            extension = file.suffix.lower()
            try:
                if extension not in SUPPORTED or not file.is_file():
                    continue
                if file.stat().st_size > settings.PORTAL_MAX_RESPONSE_BYTES:
                    continue
                features = _decode(file.read_bytes(), extension, "local_sample", decode, layers, raster)
                for feature in features:
                    available[feature.id or f"{portal}-{len(available)}"] = feature
            except (OSError, ValueError, TypeError, AttributeError, KeyError, IndexError, ElementTree.ParseError):
                logger.info("%s local export was unreadable. Checking the next source.", portal)
    return _mark(list(available.values()), portal, "local_sample" if available else "seed_fallback")


def _mark(features: list[GeoJsonFeature], portal: str, source: str) -> tuple[list[GeoJsonFeature], str]:
    for feature in features:
        feature.properties.source_portal = portal
        feature.properties.data_source_origin = source
    return features, source
