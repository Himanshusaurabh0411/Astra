import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    TerraPulse typed configuration settings.
    Supports environment variable overrides, .env loading, and robust path resolution.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow"
    )

    APP_NAME: str = "TerraPulse Space-to-Ground Geospatial Engine"
    VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Operational & Early-Warning Thresholds
    RAINFALL_THRESHOLD_MM_HR: float = 15.0
    MAX_VECTOR_PAYLOAD_KB: float = 100.0
    DEFAULT_SCENARIO_MODE: str = "NORMAL"

    # Paths (relative to runtime or explicit overrides)
    SEED_DATA_PATH: Optional[str] = None
    CONTRACTS_DIR: Optional[str] = None

    # Tactical Mesh Radio Parameters (India ISM 865–867 MHz)
    LORA_FREQUENCY_MHZ: float = 865.2
    LORA_BANDWIDTH_KHZ: float = 125.0
    MAX_MESH_HOPS: int = 7
    NAVIC_ENABLED: bool = True

    def resolve_seed_data_path(self) -> Path:
        """
        Locates the seed_catchment.geojson file dynamically across local,
        Docker container, and repository directory structures.
        """
        candidates = []
        if self.SEED_DATA_PATH:
            candidates.append(Path(self.SEED_DATA_PATH))
            candidates.append(Path.cwd() / self.SEED_DATA_PATH)

        # File-relative paths
        app_dir = Path(__file__).resolve().parent
        candidates.extend([
            app_dir / "data" / "seed_catchment.geojson",
            app_dir.parent / "app" / "data" / "seed_catchment.geojson",
            Path.cwd() / "backend" / "app" / "data" / "seed_catchment.geojson",
            Path.cwd() / "app" / "data" / "seed_catchment.geojson",
            Path.cwd() / "terrapulse" / "backend" / "app" / "data" / "seed_catchment.geojson",
            Path.cwd() / "data" / "seed_catchment.geojson",
        ])

        for path in candidates:
            if path.exists() and path.is_file():
                return path.resolve()

        # Fallback to the first canonical target even if not yet created
        return (app_dir / "data" / "seed_catchment.geojson").resolve()

    def resolve_contracts_dir(self) -> Path:
        """
        Locates the contracts directory containing JSON schemas.
        """
        candidates = []
        if self.CONTRACTS_DIR:
            candidates.append(Path(self.CONTRACTS_DIR))
            candidates.append(Path.cwd() / self.CONTRACTS_DIR)

        app_dir = Path(__file__).resolve().parent
        candidates.extend([
            app_dir.parent.parent / "contracts",
            Path.cwd() / "contracts",
            Path.cwd() / "terrapulse" / "contracts",
            app_dir.parent / "contracts",
        ])

        for path in candidates:
            if path.exists() and path.is_dir():
                return path.resolve()

        return (app_dir.parent.parent / "contracts").resolve()


settings = Settings()
