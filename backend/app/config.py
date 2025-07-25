from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    cors_origins: str = "http://localhost:3000"

    default_tariff_per_kwh: float = 0.12
    default_co2_factor_kg_per_kwh: float = 0.233
    default_lifetime_years: int = 20
    default_vfd_efficiency: float = 0.97
    default_vfd_headroom: float = 1.10

    pq_thd_voltage_limit_pct: float = 5.0
    pq_thd_current_limit_pct: float = 8.0
    pq_power_factor_min: float = 0.95
    pq_current_unbalance_pct: float = 3.0

    gemini_api_key: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
