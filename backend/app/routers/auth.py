import re

from fastapi import APIRouter, Depends

from ..config import OTP_DEBUG, OTP_RESEND_COOLDOWN_SECONDS, OTP_TTL_SECONDS
from ..db import db, one
from ..exceptions import ApiError
from ..links import link_professional_to_category
from ..otp import consume_code, issue_code
from ..security import sign_token
from ..dependencies import get_claims

router = APIRouter()

VALID_ROLES = {"customer", "provider", "admin"}
OTP_ROLES = {"customer", "provider"}


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
    existing = one(client.table("profiles").select("*").eq("phone", phone).maybe_single().execute())
    if existing:
        return existing
    name = body.get("name")
    result = (
        client.table("profiles")
        .insert(
            {
                "phone": phone,
                "name": name if isinstance(name, str) and name.strip() else f"User {phone[-4:]}",
                "email": body.get("email") or "",
                "location": body.get("location") or "",
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
    existing = one(client.table("professionals").select("id").eq("phone", phone).maybe_single().execute())
    if existing:
        return {"id": existing["id"]}

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
    professional_id = result.data[0]["id"]
    link_professional_to_category(professional_id, category_slug)
    return {"id": professional_id}


def verify_admin(client, identifier: str, code: str) -> bool:
    email_row = one(client.table("admin_settings").select("value").eq("key", "admin_email").maybe_single().execute())
    pass_row = one(client.table("admin_settings").select("value").eq("key", "admin_password").maybe_single().execute())
    admin_email = email_row.get("value") if email_row else None
    admin_pass = pass_row.get("value") if pass_row else None
    if admin_email:
        if admin_email.lower() != identifier.lower():
            return False
    elif identifier.lower() != "admin":
        return False
    if admin_pass:
        return code == admin_pass
    return code == "admin123"


@router.post("/request-otp")
def request_otp(body: dict):
    role = body.get("role", "customer")
    if role not in OTP_ROLES:
        role = "customer"

    phone = clean_phone(body.get("phone"))
    if not phone:
        raise ApiError(400, "Invalid phone number (10 digits required)")

    code = issue_code(phone, role)
    response = {
        "sent": True,
        "role": role,
        "expires_in": OTP_TTL_SECONDS,
        "resend_after": OTP_RESEND_COOLDOWN_SECONDS,
    }
    if OTP_DEBUG:
        # Dev only: no SMS provider is wired up, so the app shows the code instead.
        response["debug_code"] = code
    return response


@router.post("/verify-otp")
def verify_otp(body: dict):
    raw = body.get("phone")
    role = body.get("role", "customer")
    if role not in VALID_ROLES:
        role = "customer"
    code = body.get("code")

    client = db()

    if role == "admin":
        identifier = raw if isinstance(raw, str) else ""
        if not identifier or not isinstance(code, str) or not verify_admin(client, identifier, code):
            raise ApiError(403, "Invalid admin credentials")
        token = sign_token(identifier, "admin")
        return {"access_token": token, "role": "admin"}

    phone = clean_phone(raw)
    if not phone:
        raise ApiError(400, "Invalid phone number (10 digits required)")

    consume_code(phone, role, code)

    if role == "provider":
        professional = find_or_create_provider(phone, body)
        client.table("profiles").upsert(
            {
                "phone": phone,
                "name": body.get("name") or "",
                "email": body.get("email") or "",
                "location": body.get("serviceArea") or "",
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
    profile = one(client.table("profiles").select("*").eq("phone", claims["phone"]).maybe_single().execute())
    if claims.get("role") == "provider" and claims.get("professional_id"):
        professional = one(
            client.table("professionals")
            .select("*")
            .eq("id", claims["professional_id"])
            .maybe_single()
            .execute()
        )
        return {"role": claims["role"], "profile": profile, "professional": professional}
    return {"role": claims["role"], "profile": profile}