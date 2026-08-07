from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # --- Google Cloud / Gemini ---
    GCP_PROJECT: str
    GCP_LOCATION: str = "us-central1"
    USE_VERTEX_AI: bool = False       # True = Vertex AI (ADC auth, higher quotas); False = Gemini API key
    GEMINI_API_KEY: str = ""          # Only required when USE_VERTEX_AI=False
    GEMINI_MODEL: str = "gemini-2.5-flash"
    MAX_TOKENS: int = 8192
    TEMPERATURE: float = 0.3
    
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    
    QDRANT_URL: str = ""        # Set to Qdrant Cloud URL or http://localhost:6333 if using external Qdrant
    QDRANT_API_KEY: str = ""    # Set if using Qdrant Cloud
    QDRANT_COLLECTION: str = "naturopathy_books"
    
    APP_ENV: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
