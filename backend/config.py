from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    MAX_TOKENS: int = 8192
    TEMPERATURE: float = 0.3
    
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5433/holistic_health"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    QDRANT_URL: str = ""        # Set to Qdrant Cloud URL or http://localhost:6333 if using external Qdrant
    QDRANT_API_KEY: str = ""    # Set if using Qdrant Cloud
    QDRANT_COLLECTION: str = "naturopathy_books"
    
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me-in-production"
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
