from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'gym.db'}"

    secret_key: str = "change-me-to-a-random-secret"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    admin_name: str = "Admin"
    admin_email: str = "admin@gymtrack.com"
    admin_password: str = "change-me-admin-password"

    log_level: str = "INFO"
    log_dir: Path = BASE_DIR / "logs"


settings = Settings()
