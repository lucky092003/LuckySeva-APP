import re

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from ..db import db
from ..exceptions import ApiError
from ..security import sign_token
from ..dependencies import get_claims

router = APIRouter()

VALID_ROLES = {"customer", "provider", "admin"}


def clean_phone(raw) -> str | None:
    if not isinstance(raw, str):
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return digits if len(digits) == 10 else None


def category_for(profession: str) -> str:
    p = profession.lower()
    for pattern, slug in [
        (r"plumb|tap|leak|pipe|drain", "plumber"),
        (r"electr|wire|inverter|switch", "electrician"),
        (r"ac|air\s?cond", "ac-repair"),
        (r"clean|housekeeping", "cleaning"),
        (r"carpent|wood|furniture", "carpenter"),
        (r"paint|texture", "painting"),
        (r"appliance|wash|fridge|microwave|geyser", "appliance-repair"),
        (r"beauty|salon|hair|makeup|spa|facial", "beauty-salon"),
        (r"pest|termite|roach", "pest-control"),
    ]:
        if re.search(pattern, p):
            return slug
    return "other"


def find_or_create_customer_profile(phone: str, body: dict):
    client = db()
    existing = client.table("profiles").select("*").eq("phone", phone).maybe_single().execute()
    if existing.data:
        return existing.data
    name = body.get("name")
    result = (
        client.table("profiles")
        .insert(
            {
                "phone": phone,
                "name": name if isinstance(name, str) and name.strip() else f"User {phone[-4:]}",
                "email": body.get("email") or None,
                "location": body.get("location") or None,
                "role": "customer",
            }
        )
        .execute()
    )
    if not result.data:
        raise ApiError(400, "Could not create profile")
    return result.data[0]


def find_or_create_provider(phone: str, body: dict) -> dict:
    client = db()
    existing = client.table("professionals").select("id").eq("phone", phone).maybe_single().execute()
    if existing.data:
        return {"id": existing.data["id"]}

    profession = body.get("profession")
    profession = profession if isinstance(profession, str) else ""
    name = body.get("name")
    name = name if isinstance(name, str) and name.strip() else f"Provider {phone[-4:]}"
    service_area = body.get("serviceArea")
    service_area = service_area if isinstance(service_area, str) else ""
    category_slug = body.get("category_slug")
    if not isinstance(category_slug, str) or not category_slug:
        category_slug = category_for(profession)

    result = (
        client.table("professionals")
        .insert(
            {
                "name": name,
                "category_slug": category_slug,
                "skills": [profession or name],
                "experience_years": int(body.get("experience") or 1),
                "rating": 0,
                "reviews_count": 0,
                "completed_jobs": 0,
                "starting_price": 99,
                "avatar_url": "",
                "distance_km": 1.0,
                "status": "available",
                "bio": f"{profession or name} professional serving {service_area}.",
                "service_area": service_area,
                "latitude": body.get("latitude") if isinstance(body.get("latitude"), (int, float)) else None,
                "longitude": body.get("longitude") if isinstance(body.get("longitude"), (int, float)) else None,
                "service_radius_km": int(body.get("service_radius_km") or 60),
                "phone": phone,
                "email": body.get("email") or None,
            }
        )
        .execute()
    )
    if not result.data:
        raise ApiError(400, "Could not create provider")
    return {"id": result.data[0]["id"]}


def verify_admin(client, phone: str, code: str) -> bool:
    email_row = client.table("admin_settings").select("value").eq("key", "admin_email").maybe_single().execute()
    pass_row = client.table("admin_settings").select("value").eq("key", "admin_password").maybe_single().execute()
    admin_email = email_row.data.get("value") if email_row.data else None
    admin_pass = pass_row.data.get("value") if pass_row.data else None
    if admin_email and admin_email.lower() != phone.lower():
        return False
    return isinstance(admin_pass, str) and code == admin_pass


@router.post("/verify-otp")
def verify_otp(body: dict):
    phone = clean_phone(body.get("phone"))
    if not phone:
        raise ApiError(400, "Invalid phone number (10 digits required)")
    code = body.get("code")
    if not isinstance(code, str) or not re.fullmatch(r"\d{6}", code):
        raise ApiError(400, "OTP must be a 6-digit code")

    role = body.get("role", "customer")
    if role not in VALID_ROLES:
        role = "customer"

    client = db()

    if role == "admin":
        if not verify_admin(client, phone, code):
            raise ApiError(403, "Invalid admin credentials")
        token = sign_token(phone, "admin")
        return {"access_token": token, "role": "admin"}

    if role == "provider":
        professional = find_or_create_provider(phone, body)
        client.table("profiles").upsert(
            {
                "phone": phone,
                "name": body.get("name"),
                "email": body.get("email") or None,
                "location": body.get("serviceArea") or None,
                "role": "provider",
            },
            on_conflict="phone",
        ).execute()
        token = sign_token(phone, "provider", professional["id"])
        return {"access_token": token, "role": "provider", "professional_id": professional["id"]}

    profile = find_or_create_customer_profile(phone, body)
    token = sign_token(phone, "customer")
    return {"access_token": token, "role": "customer", "profile": profile}


@router.get("/me")
def me(claims: dict = Depends(get_claims)):
    client = db()
    profile = client.table("profiles").select("*").eq("phone", claims["phone"]).maybe_single().execute()
    if claims.get("role") == "provider" and claims.get("professional_id"):
        professional = (
            client.table("professionals")
            .select("*")
            .eq("id", claims["professional_id"])
            .maybe_single()
            .execute()
        )
        return {"role": claims["role"], "profile": profile.data, "professional": professional.data}
    return {"role": claims["role"], "profile": profile.data}