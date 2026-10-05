import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .exceptions import ApiError
from .routers import auth, catalog, customer, payments, provider, admin

logger = logging.getLogger(__name__)

app = FastAPI(
    title="LuckySeva API",
    version="1.0.0",
    description="Service marketplace API — app + website use this.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ApiError)
async def api_error_handler(_, exc: ApiError):
    body = {"error": exc.message}
    if exc.code:
        body["code"] = exc.code
    return JSONResponse(body, status_code=exc.status)


@app.exception_handler(Exception)
async def unhandled_error_handler(request, exc: Exception):
    """Turn anything unexpected into the same JSON shape the app already speaks.

    Without this, a `postgrest.exceptions.APIError` (missing column, NOT NULL
    violation), a bad type or a dropped connection escaped as Starlette's
    plain-text "Internal Server Error". The frontend could not parse that, so it
    showed one generic message for every distinct fault - a schema drift and a
    dead network looked identical. The traceback goes to the log; the caller gets
    a `code` it can branch on and a message worth showing.
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        {"error": "Something went wrong on our side. Please try again.", "code": "server_error"},
        status_code=500,
    )


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(catalog.router, prefix="/catalog", tags=["catalog"])
app.include_router(customer.router, prefix="/customer", tags=["customer"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])
app.include_router(provider.router, prefix="/provider", tags=["provider"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
# Outside the customer guard on purpose: Razorpay authenticates with an HMAC of
# the raw body, not a customer JWT.
app.include_router(payments.webhook, prefix="/payments", tags=["payments"])


@app.get("/health")
def health():
    return {"ok": True}