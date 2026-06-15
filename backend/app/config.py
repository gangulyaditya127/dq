import os
from pathlib import Path
from dotenv import load_dotenv

# Always load .env from the backend directory, regardless of CWD
_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env")


class Settings:
    SERVICENOW_BASE_URL = os.getenv("SERVICENOW_BASE_URL", "https://tataconsultancyservicesdemo5.service-now.com")
    SERVICENOW_USERNAME = os.getenv("SERVICENOW_USERNAME", "")
    SERVICENOW_PASSWORD = os.getenv("SERVICENOW_PASSWORD", "")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.0-flash")


settings = Settings()
