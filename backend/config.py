from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    GCP_PROJECT: str
    GEMINI_API_KEY: str = ""
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
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
