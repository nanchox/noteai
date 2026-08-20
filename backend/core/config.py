from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_ANON_KEY: str
    ANTHROPIC_API_KEY: str
    AI_MODEL: str = "anthropic/claude-sonnet-4-6"  # cambia aquí el modelo
    ALLOWED_EMAILS: str  # ej: "tu@gmail.com,esposa@gmail.com"
    TELEGRAM_BOT_TOKEN: str = ""  # Opcional: token de @BotFather
    FRONTEND_URL: str = "http://localhost:3000"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
