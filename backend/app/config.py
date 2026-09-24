import os

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")


def require_env(name: str) -> str:
    value = os.getenv(name, "")
    if not value:
        raise EnvironmentError(
            f"Missing required env var: {name}. Copy backend/.env.example to backend/.env and fill from Supabase dashboard."
        )
    return value