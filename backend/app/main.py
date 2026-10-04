from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .exceptions import ApiError
from .routers import auth, catalog, customer, payments, provider, admin

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