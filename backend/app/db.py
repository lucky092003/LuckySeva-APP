from functools import lru_cache

from supabase import create_client, Client

from . import config


@lru_cache(maxsize=1)
def db() -> Client:
    url = config.require_env("SUPABASE_URL")
    key = config.require_env("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def one(res):
    """postgrest's maybe_single().execute() returns None on zero rows, not a response."""
    return None if res is None else res.data
