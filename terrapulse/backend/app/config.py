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

    # Real Portal Ingestion Configurations (MOSDAC, VEDAS, Bhoonidhi, Bhuvan)
    MOSDAC_API_URL: Optional[str] = None
    MOSDAC_SAMPLE_PATH: Optional[str] = None
    VEDAS_API_URL: Optional[str] = None
    VEDAS_SAMPLE_PATH: Optional[str] = None
    VEDAS_AGRI_SAMPLE_PATH: Optional[str] = None
    BHOONIDHI_API_URL: Optional[str] = None
    BHOONIDHI_SAMPLE_PATH: Optional[str] = None
    BHUVAN_WFS_URL: Optional[str] = None
    BHUVAN_SAMPLE_PATH: Optional[str] = None
    BHUVAN_LULC_SAMPLE_PATH: Optional[str] = None

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

    def resolve_mosdac_sample_path(self) -> Optional[Path]:
        """
        Locates the MOSDAC real sample JSON/CSV file.
        """
        candidates = []
        if self.MOSDAC_SAMPLE_PATH:
            candidates.append(Path(self.MOSDAC_SAMPLE_PATH))
            candidates.append(Path.cwd() / self.MOSDAC_SAMPLE_PATH)

        app_dir = Path(__file__).resolve().parent
        candidates.extend([
            app_dir / "data" / "real_samples" / "mosdac" / "insat3ds_rainfall_hourly.json",
            app_dir / "data" / "real_samples" / "mosdac" / "gsmap_isro_precip_catchment.csv",
            Path.cwd() / "backend" / "app" / "data" / "real_samples" / "mosdac" / "insat3ds_rainfall_hourly.json",
            Path.cwd() / "backend" / "app" / "data" / "real_samples" / "mosdac" / "gsmap_isro_precip_catchment.csv",
            Path.cwd() / "terrapulse" / "backend" / "app" / "data" / "real_samples" / "mosdac" / "insat3ds_rainfall_hourly.json",
        ])

        for path in candidates:
            if path.exists() and path.is_file():
                return path.resolve()
        return None

    def resolve_vedas_sample_path(self) -> Optional[Path]:
        """
        Locates the VEDAS Cartosat DEM roads profile sample file.
        """
        candidates = []
        if self.VEDAS_SAMPLE_PATH:
            candidates.append(Path(self.VEDAS_SAMPLE_PATH))
            candidates.append(Path.cwd() / self.VEDAS_SAMPLE_PATH)

        app_dir = Path(__file__).resolve().parent
        candidates.extend([
            app_dir / "data" / "real_samples" / "vedas" / "cartosat_dem_roads_profile.json",
            Path.cwd() / "backend" / "app" / "data" / "real_samples" / "vedas" / "cartosat_dem_roads_profile.json",
            Path.cwd() / "terrapulse" / "backend" / "app" / "data" / "real_samples" / "vedas" / "cartosat_dem_roads_profile.json",
        ])

        for path in candidates:
            if path.exists() and path.is_file():
                return path.resolve()
        return None

    def resolve_vedas_agri_sample_path(self) -> Optional[Path]:
        """
        Locates the VEDAS agricultural crop phenology monitor sample file.
        """
        candidates = []
        if self.VEDAS_AGRI_SAMPLE_PATH:
            candidates.append(Path(self.VEDAS_AGRI_SAMPLE_PATH))
            candidates.append(Path.cwd() / self.VEDAS_AGRI_SAMPLE_PATH)

        app_dir = Path(__file__).resolve().parent
        candidates.extend([
            app_dir / "data" / "real_samples" / "vedas" / "vedas_crop_phenology_sehore.json",
            Path.cwd() / "backend" / "app" / "data" / "real_samples" / "vedas" / "vedas_crop_phenology_sehore.json",
            Path.cwd() / "terrapulse" / "backend" / "app" / "data" / "real_samples" / "vedas" / "vedas_crop_phenology_sehore.json",
        ])

        for path in candidates:
            if path.exists() and path.is_file():
                return path.resolve()
        return None

    def resolve_bhoonidhi_sample_path(self) -> Optional[Path]:
        """
        Locates the Bhoonidhi EOS-04 SAR flood inundation sample file.
        """
        candidates = []
        if self.BHOONIDHI_SAMPLE_PATH:
            candidates.append(Path(self.BHOONIDHI_SAMPLE_PATH))
            candidates.append(Path.cwd() / self.BHOONIDHI_SAMPLE_PATH)

        app_dir = Path(__file__).resolve().parent
        candidates.extend([
            app_dir / "data" / "real_samples" / "bhoonidhi" / "eos04_sar_flood_stac.json",
            app_dir / "data" / "real_samples" / "bhoonidhi" / "sar_backscatter_transect.csv",
            Path.cwd() / "backend" / "app" / "data" / "real_samples" / "bhoonidhi" / "eos04_sar_flood_stac.json",
            Path.cwd() / "terrapulse" / "backend" / "app" / "data" / "real_samples" / "bhoonidhi" / "eos04_sar_flood_stac.json",
        ])

        for path in candidates:
            if path.exists() and path.is_file():
                return path.resolve()
        return None

    def resolve_bhuvan_sample_path(self) -> Optional[Path]:
        """
        Locates the Bhuvan critical infrastructure GeoJSON sample file.
        """
        candidates = []
        if self.BHUVAN_SAMPLE_PATH:
            candidates.append(Path(self.BHUVAN_SAMPLE_PATH))
            candidates.append(Path.cwd() / self.BHUVAN_SAMPLE_PATH)

        app_dir = Path(__file__).resolve().parent
        candidates.extend([
            app_dir / "data" / "real_samples" / "bhuvan" / "bhuvan_critical_infrastructure.geojson",
            Path.cwd() / "backend" / "app" / "data" / "real_samples" / "bhuvan" / "bhuvan_critical_infrastructure.geojson",
            Path.cwd() / "terrapulse" / "backend" / "app" / "data" / "real_samples" / "bhuvan" / "bhuvan_critical_infrastructure.geojson",
        ])

        for path in candidates:
            if path.exists() and path.is_file():
                return path.resolve()
        return None

    def resolve_bhuvan_lulc_sample_path(self) -> Optional[Path]:
        """
        Locates the Bhuvan LULC & waterbodies JSON sample file.
        """
        candidates = []
        if self.BHUVAN_LULC_SAMPLE_PATH:
            candidates.append(Path(self.BHUVAN_LULC_SAMPLE_PATH))
            candidates.append(Path.cwd() / self.BHUVAN_LULC_SAMPLE_PATH)

        app_dir = Path(__file__).resolve().parent
        candidates.extend([
            app_dir / "data" / "real_samples" / "bhuvan" / "bhuvan_lulc_waterbodies.json",
            Path.cwd() / "backend" / "app" / "data" / "real_samples" / "bhuvan" / "bhuvan_lulc_waterbodies.json",
            Path.cwd() / "terrapulse" / "backend" / "app" / "data" / "real_samples" / "bhuvan" / "bhuvan_lulc_waterbodies.json",
        ])

        for path in candidates:
            if path.exists() and path.is_file():
                return path.resolve()
        return None


settings = Settings()
