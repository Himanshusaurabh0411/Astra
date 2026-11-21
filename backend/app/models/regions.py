import json
from functools import lru_cache
from math import cos, isfinite, radians
from typing import Any, Iterator

from pydantic import BaseModel, Field

from app.config import ROOT_DIR, settings

Bounds = tuple[float, float, float, float]
Point = tuple[float, float]


class Place(BaseModel):
    name: str
    state: str
    center: Point
    aliases: list[str] = Field(default_factory=list)


class Region(BaseModel):
    id: str
    name: str
    short_name: str
    basin: str
    center: Point
    bbox: Bounds
    zoom: int
    risk: str
    hazard: str
    places: list[Place]
    risk_summary: dict[str, int] = Field(default_factory=dict)


@lru_cache(maxsize=1)
def get_regions() -> dict[str, Region]:
    path = settings.resolve_contracts_dir() / "india-regions.json"
    if not path.is_file():
        path = ROOT_DIR / "contracts" / path.name
    catalog = json.loads(path.read_text(encoding="utf-8"))
    regions = {entry["id"]: Region.model_validate(entry) for entry in catalog["regions"]}
    regions["all-india"].bbox = settings.india_bbox
    return regions


def canonical_region(value: str | None) -> str:
    key = (value or "all-india").strip().casefold().replace("_", "-")
    if key in ("all", "india"):
        return "all-india"
    for region in get_regions().values():
        if key == region.id or key in (region.name.casefold(), region.basin.casefold()):
            return region.id
    raise ValueError("Choose a region listed in /api/regions.")


def points(value: Any) -> Iterator[Point]:
    if not isinstance(value, (list, tuple)) or not value:
        return
    if all(isinstance(n, (int, float)) for n in value[:2]) and len(value) >= 2:
        lng, lat = value[:2]
        if isfinite(lng) and isfinite(lat) and -180 <= lng <= 180 and -90 <= lat <= 90:
            yield lng, lat
        return
    for child in value:
        yield from points(child)


def geometry_bounds(coords: Any) -> Bounds | None:
    positions = list(points(coords))
    if not positions:
        return None
    lngs, lats = zip(*positions)
    return min(lngs), min(lats), max(lngs), max(lats)


def intersects(first: Bounds | None, second: Bounds | None) -> bool:
    return bool(first and second and first[0] <= second[2] and second[0] <= first[2]
                and first[1] <= second[3] and second[1] <= first[3])


def contains(bounds: Bounds, pt: Point) -> bool:
    return bounds[0] <= pt[0] <= bounds[2] and bounds[1] <= pt[1] <= bounds[3]


def region_at(pt: Point) -> str | None:
    regions = [
        region for region in get_regions().values()
        if region.id != "all-india" and contains(region.bbox, pt)
    ]
    if not regions:
        return None
    lng, lat = pt
    return min(regions, key=lambda region: (
        (region.center[0] - lng) ** 2 + (region.center[1] - lat) ** 2
    )).id


def area_km2(polygon: list[list[Point]]) -> float:
    """Estimate area on a local tangent plane for small flood polygons."""
    def ring_area(ring: list[Point]) -> float:
        if len(ring) < 4:
            return 0.0
        lng, lat = ring[0]
        x_scale = cos(radians(lat)) * 111.32
        xy = [((point[0] - lng) * x_scale, (point[1] - lat) * 111.32) for point in ring]
        return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(xy, xy[1:]))) / 2

    return max(0, ring_area(polygon[0]) - sum(ring_area(ring) for ring in polygon[1:])) if polygon else 0
