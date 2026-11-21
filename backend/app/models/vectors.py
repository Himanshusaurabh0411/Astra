from typing import Any

from app.models.schemas import GeoJsonFeatureCollection, HazardSeverity, RoadStatus

BYTES_PER_KB = 1000


def rounded_coords(value: Any) -> Any:
    if isinstance(value, (list, tuple)):
        return [rounded_coords(child) for child in value]
    return round(value, 4) if isinstance(value, float) else value


def payload_bytes(model: Any) -> int:
    return len(model.model_dump_json(exclude_none=True).encode("utf-8"))


def measure_payload(model: Any, metadata: Any) -> int:
    sizes = []
    for _ in range(8):
        size = payload_bytes(model)
        if metadata.payload_kb == size / BYTES_PER_KB:
            return size
        if size in sizes:
            # A trailing zero can change the serialized length of the size field.
            break
        sizes.append(size)
        metadata.payload_kb = size / BYTES_PER_KB
    metadata.payload_kb = max(sizes) / BYTES_PER_KB
    return max(payload_bytes(model), max(sizes))


def size_collection(collection: GeoJsonFeatureCollection) -> float:
    return measure_payload(collection, collection.metadata) / BYTES_PER_KB


def compact_collection(
    collection: GeoJsonFeatureCollection, max_kb: float
) -> GeoJsonFeatureCollection:
    """Keep a map response within budget without dropping data from the store."""
    budget = int(max_kb * BYTES_PER_KB)
    result = collection.model_copy(update={"metadata": collection.metadata.model_copy()})
    result.metadata.total_records = len(collection.features)
    if size_collection(result) < max_kb:
        return result

    features = [
        feature.model_copy(update={"geometry": feature.geometry.model_copy(
            update={"coordinates": rounded_coords(feature.geometry.coordinates)}
        )})
        for feature in collection.features
    ]
    result.features = features
    if size_collection(result) < max_kb:
        return result

    def priority(feature):
        props = feature.properties
        return (
            props.severity in (HazardSeverity.CRITICAL, HazardSeverity.HIGH)
            or props.road_status in (RoadStatus.SUBMERGED, RoadStatus.CORRIDOR),
            props.asset_type in ("HOSPITAL", "SHELTER"),
        )

    # Preserve coverage by taking the highest-priority feature in each
    # region/layer before filling the remaining space by severity.
    groups = {}
    others = []
    for feature in sorted(features, key=priority, reverse=True):
        key = (feature.properties.region_id, feature.properties.layer)
        if key in groups:
            others.append(feature)
        else:
            groups[key] = feature

    result.metadata.truncated = True
    result.features = []
    used = payload_bytes(result) + 24  # Room for final payload_kb and delimiters
    for feature in [*groups.values(), *others]:
        size = payload_bytes(feature) + 1
        if used + size < budget:
            result.features.append(feature)
            used += size
    size_collection(result)
    return result
