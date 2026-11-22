from email.headerregistry import Address
from math import isfinite
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_DIR = Path(__file__).resolve().parent
ROOT_DIR = APP_DIR.parent.parent
DATA_DIR = APP_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", APP_DIR.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "TerraPulse"
    VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173"
    RAINFALL_THRESHOLD_MM_HR: float = Field(default=15.0, gt=0, lt=250)
    MAX_VECTOR_PAYLOAD_KB: float = Field(default=100.0, ge=10, le=100)
    INDIA_BBOX: str = "68.0,6.5,97.5,37.5"
    DEFAULT_SCENARIO_MODE: Literal["NORMAL", "CELL_BLACKOUT_MESH_ACTIVE", "BACKHAUL_SYNC"] = "NORMAL"

    SEED_DATA_PATH: str | None = None
    CONTRACTS_DIR: str | None = None
    GOVERNMENT_ACCOUNTS: SecretStr | None = None
    OPEN_METEO_API_KEY: SecretStr | None = None
    SOS_EMAIL_TO: str | None = None
    SOS_EMAIL_FROM: str | None = None
    SOS_SMTP_HOST: str | None = None
    SOS_SMTP_PORT: int = Field(default=587, ge=1, le=65535)
    SOS_SMTP_SECURITY: Literal["starttls", "ssl"] = "starttls"
    SOS_SMTP_USER: str | None = None
    SOS_SMTP_PASSWORD: SecretStr | None = None
    SOS_EMAIL_DB: Path = APP_DIR.parent / "var" / "sos-email.sqlite3"
    PORTAL_FETCH_TIMEOUT_SECONDS: float = Field(default=3.0, gt=0, le=15)
    PORTAL_MAX_RESPONSE_BYTES: int = Field(default=5_000_000, ge=1024, le=25_000_000)

    MOSDAC_API_URL: str | None = None
    MOSDAC_API_TOKEN: SecretStr | None = None
    MOSDAC_SAMPLE_PATH: str | None = None
    VEDAS_API_URL: str | None = None
    VEDAS_API_TOKEN: SecretStr | None = None
    VEDAS_SAMPLE_PATH: str | None = None
    VEDAS_AGRI_SAMPLE_PATH: str | None = None
    BHOONIDHI_API_URL: str | None = None
    BHOONIDHI_API_TOKEN: SecretStr | None = None
    BHOONIDHI_SAMPLE_PATH: str | None = None
    BHUVAN_WFS_URL: str | None = None
    BHUVAN_API_TOKEN: SecretStr | None = None
    BHUVAN_SAMPLE_PATH: str | None = None
    BHUVAN_LULC_SAMPLE_PATH: str | None = None

    LORA_FREQUENCY_MHZ: float = Field(default=865.2, ge=865, le=867)
    LORA_BANDWIDTH_KHZ: float = Field(default=125.0, gt=0)
    MAX_MESH_HOPS: int = Field(default=7, ge=1, le=15)
    NAVIC_ENABLED: bool = True

    @field_validator("SOS_EMAIL_TO", "SOS_EMAIL_FROM")
    @classmethod
    def validate_mailbox(cls, value: str | None) -> str | None:
        if not value or not value.strip():
            return None
        if not value.isascii() or any(ord(char) < 32 for char in value):
            raise ValueError("Use a single email address.")
        try:
            address = Address(addr_spec=value.strip())
        except (ValueError, IndexError) as error:
            raise ValueError("Use a single email address.") from error
        if not address.domain or not address.username:
            raise ValueError("Use a complete email address.")
        return address.addr_spec

    @field_validator("INDIA_BBOX")
    @classmethod
    def validate_india_bbox(cls, value: str) -> str:
        parse_bbox(value)
        return value

    @property
    def india_bbox(self) -> tuple[float, float, float, float]:
        return parse_bbox(self.INDIA_BBOX)

    def resolve_seed_data_path(self) -> Path:
        return self._resolve_path(self.SEED_DATA_PATH, DATA_DIR / "seed_catchment.geojson")

    def resolve_contracts_dir(self) -> Path:
        return self._resolve_path(self.CONTRACTS_DIR, ROOT_DIR / "contracts")

    def resolve_mosdac_sample_path(self) -> Path:
        return self._sample_path("mosdac", self.MOSDAC_SAMPLE_PATH, "insat3ds_rainfall_hourly.json")

    def resolve_vedas_sample_path(self) -> Path:
        return self._sample_path("vedas", self.VEDAS_SAMPLE_PATH, "cartosat_dem_roads_profile.json")

    def resolve_vedas_agri_sample_path(self) -> Path:
        return self._sample_path("vedas", self.VEDAS_AGRI_SAMPLE_PATH, "vedas_crop_phenology_sehore.json")

    def resolve_bhoonidhi_sample_path(self) -> Path:
        return self._sample_path("bhoonidhi", self.BHOONIDHI_SAMPLE_PATH, "eos04_sar_flood_stac.json")

    def resolve_bhuvan_sample_path(self) -> Path:
        return self._sample_path("bhuvan", self.BHUVAN_SAMPLE_PATH, "bhuvan_critical_infrastructure.geojson")

    def resolve_bhuvan_lulc_sample_path(self) -> Path:
        return self._sample_path("bhuvan", self.BHUVAN_LULC_SAMPLE_PATH, "bhuvan_lulc_waterbodies.json")

    def _sample_path(self, portal: str, configured: str | None, filename: str) -> Path:
        return self._resolve_path(configured, DATA_DIR / "real_samples" / portal / filename)

    @staticmethod
    def _resolve_path(configured: str | None, default: Path) -> Path:
        if not configured:
            return default
        path = Path(configured)
        if path.is_absolute() or path.exists():
            return path.resolve()
        return (APP_DIR.parent / path).resolve()


def parse_bbox(value: str) -> tuple[float, float, float, float]:
    try:
        west, south, east, north = (float(part.strip()) for part in value.split(","))
    except ValueError as exc:
        raise ValueError("Use west,south,east,north for the map bounds.") from exc
    if not all(isfinite(n) for n in (west, south, east, north)) or not (
        -180 <= west < east <= 180 and -90 <= south < north <= 90
    ):
        raise ValueError("Map bounds must be ordered longitude and latitude values.")
    return west, south, east, north


settings = Settings()
