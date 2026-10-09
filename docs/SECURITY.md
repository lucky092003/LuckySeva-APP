# LuckySeva — Authentication & Security Documentation

---

## 1. Security Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT                                        │
│  Phone Number + OTP ───────────────────────────────────────────────►│
│                                                                    │
│  ◄──────────────────────────────────── JWT (30-day TTL)            │
│                                                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FastAPI BACKEND                                │
│                                                                      │
│  POST /auth/verify-otp ──────► OTP Validation (dev: always 123456) │
│                                 │                                   │
│                                 ▼                                   │
│                            JWT Minting                              │
│                            (PyJWT HS256)                            │
│                            30-day expiry                            │
│                                                                      │
│  Request with JWT ──────────► Token Verification                    │
│                                 │                                   │
│                                 ▼                                   │
│                           Role Guard                                │
│                     (require_customer/provider/admin)               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Service Role)                          │
│                                                                      │
│  ALL queries bypass RLS ───────────────────────────────────────────►│
│                                                                      │
│  Note: RLS is USING(true) — backend is the REAL access control      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication Flows

### 2.1 Customer & Provider Authentication

**Step 1: Request OTP**

```http
POST /auth/request-otp
Content-Type: application/json

{
  "phone": "9876543210",
  "role": "customer",
  "mode": "signup"
}
```

**Response:**
```json
{
  "sent": true,
  "role": "customer",
  "expires_in": 300,
  "resend_after": 30
}
```

**Dev Mode (OTP_DEBUG=true):**
```json
{
  "debug_code": "123456"
}
```

**Step 2: Verify OTP**

```http
POST /auth/verify-otp
Content-Type: application/json

{
  "phone": "9876543210",
  "code": "123456",
  "role": "customer"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "customer",
  "profile": {
    "phone": "9876543210",
    "name": "John",
    "email": "",
    "location": "",
    "role": "customer"
  }
}
```

**Token contains:**
```json
{
  "sub": "9876543210",
  "phone": "9876543210",
  "role": "customer",
  "exp": 1735689600
}
```

### 2.2 Provider Authentication

Same flow with `role: "provider"`.

**Response:**
```json
{
  "access_token": "eyJ...",
  "role": "provider",
  "professional_id": "uuid-of-professional"
}
```

**Token contains:**
```json
{
  "sub": "9876543210",
  "phone": "9876543210",
  "role": "provider",
  "professional_id": "uuid",
  "exp": 1735689600
}
```

### 2.3 Admin Authentication

**Request:**
```http
POST /auth/verify-otp
Content-Type: application/json

{
  "phone": "admin",
  "code": "admin123",
  "role": "admin"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "role": "admin"
}
```

---

## 3. JWT Implementation

### 3.1 Token Structure

**Library:** `PyJWT` with HS256 algorithm

**Claims:**
```python
{
  "sub": phone_or_admin_id,      # Subject (identity)
  "phone": phone,                # Phone number
  "role": "customer|provider|admin",
  "professional_id": "uuid",     # Only for provider role
  "exp": expiration_timestamp    # 30 days from issue
}
```

### 3.2 Token Signing

**File:** `backend/app/security.py`

```python
from .security import sign_token, verify_token

# Signing
token = sign_token(phone="9876543210", role="customer")
token = sign_token(phone="9876543210", role="provider", professional_id="uuid")
token = sign_token(identifier="admin", role="admin")

# Verification
claims = verify_token(token)  # Returns dict or raises
```

### 3.3 Token Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Algorithm | HS256 | `security.py` |
| TTL | 30 days | `security.py` |
| Secret | `SUPABASE_JWT_SECRET` | `.env` |

---

## 4. Authorization Guards

### 4.1 Dependencies

**File:** `backend/app/dependencies.py`

```python
from .dependencies import require_customer, require_provider, require_admin

# Usage in router
router = APIRouter(dependencies=[Depends(require_customer)])

# Or per-route
@router.get("/profile", dependencies=[Depends(require_customer)])
def profile(claims: dict = Depends(require_customer)):
    phone = claims["phone"]
    ...
```

### 4.2 Guard Implementation

```python
def require_customer(claims: dict = Depends(get_claims)) -> dict:
    if claims.get("role") != "customer":
        raise ApiError(403, "Customer token required")
    return claims

def require_provider(claims: dict = Depends(get_claims)) -> dict:
    if claims.get("role") != "provider":
        raise ApiError(403, "Provider token required")
    return claims

def require_admin(claims: dict = Depends(get_claims)) -> dict:
    if claims.get("role") != "admin":
        raise ApiError(403, "Admin token required")
    return claims
```

### 4.3 Access Control Matrix

| Endpoint Prefix | Required Role |
|----------------|---------------|
| `/auth/*` | None (except `/auth/me` needs valid token) |
| `/catalog/*` | None (public) |
| `/customer/*` | `customer` |
| `/provider/*` | `provider` |
| `/admin/*` | `admin` |
| `/payments/webhook` | None (HMAC verified) |

---

## 5. Data Access Control

### 5.1 The Service Role Pattern

**All backend queries use the Supabase service role key**, which bypasses RLS entirely.

```python
# backend/app/db.py
from supabase import create_client

@lru_cache
def get_client():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

db = get_client()  # Service role client
```

### 5.2 Application-Level Access Control

Since RLS is wide-open (`USING (true)`), **every route handler must enforce its own access control**.

```python
# Example: Customer can only see their own bookings
@router.get("/bookings")
def bookings(claims: dict = Depends(require_customer)):
    phone = claims["phone"]  # Extract from token, NOT from request
    res = client.table("bookings").select("*").eq("customer_phone", phone).execute()
    return res.data or []
```

**The `customer_phone` filter is the ONLY access boundary for customer data.**

### 5.3 Known Authorization Gaps

> **Warning:** These are known issues documented in `docs/brain.md`.

1. `GET /provider/bookings/{booking_id}` — **No ownership check.** Any provider can read any booking.
2. `DELETE /admin/professionals/{id}` — No existence check before delete.
3. `DELETE /customer/favourites/{id}` — No existence check.
4. `POST /admin/settings` — No audit log entry (unlike other admin mutations).

---

## 6. API Security

### 6.1 CORS Configuration

**File:** `backend/app/main.py`

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # No origin allowlist
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Note:** `allow_credentials=False` means browsers won't send cookies cross-origin.

### 6.2 Input Validation

**No Pydantic.** Hand-rolled validation:

```python
def clean_phone(raw) -> str | None:
    if not isinstance(raw, str):
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return digits if len(digits) == 10 else None

# Usage
phone = clean_phone(body.get("phone"))
if not phone:
    raise ApiError(400, "Invalid phone number (10 digits required)")
```

### 6.3 Rate Limiting

No built-in rate limiting. The OTP endpoint has a **cooldown** (30 seconds between requests) stored in memory.

---

## 7. Security Considerations & Known Gaps

### 7.1 Critical Gaps

| Issue | Severity | Description |
|-------|----------|-------------|
| OTP not verified | **HIGH** | `POST /auth/verify-otp` only checks regex `\d{6}`. No SMS provider integration. Dev mode returns code in response. |
| Admin password in cleartext | **HIGH** | `admin_settings.admin_password` stored as plain text. Default: `admin123`. |
| JWT no revocation | **MEDIUM** | 30-day tokens cannot be invalidated. Logout is client-side only. |
| CORS wide open | **MEDIUM** | `allow_origins=["*"]` with no credentials. |

### 7.2 Data Isolation Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| Provider booking read | **HIGH** | `GET /provider/bookings/{id}` has no ownership check. |
| RLS not enforced | **INFO** | RLS is `USING(true)` on all tables. Service role bypasses RLS. Backend filters are the real security. |

### 7.3 Recommendations for Production

1. **Integrate SMS Provider:** Replace dev OTP with Twilio/MSG91/Mappls.
2. **Hash Admin Password:** Use bcrypt for `admin_password` storage.
3. **Add Rate Limiting:** Use FastAPI middleware or API gateway.
4. **Implement Token Revocation:** Store revoked tokens in Redis/Supabase.
5. **Narrow CORS:** Set specific origins instead of `*`.
6. **Add Audit Logging:** Expand `audit_logs` coverage to all admin mutations.
7. **Fix Provider Authorization:** Add ownership check to `GET /provider/bookings/{id}`.

---

## 8. Secrets Management

### 8.1 Required Secrets

| Secret | Used By | Purpose |
|--------|---------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Database access (bypasses RLS) |
| `SUPABASE_JWT_SECRET` | Backend | JWT signing/verification |
| `SUPABASE_URL` | Backend | Supabase project URL |
| `GITHUB_WEBHOOK_SECRET` | PR Review Bot | HMAC signature verification |
| `GITHUB_APP_PRIVATE_KEY` | PR Review Bot | GitHub App authentication |
| `GITHUB_APP_ID` | PR Review Bot | GitHub App identifier |

### 8.2 Frontend Environment Variables

| Variable | Public? | Purpose |
|----------|---------|---------|
| `VITE_SUPABASE_ANON_KEY` | Yes | Public read access |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_API_URL` | Yes | Backend API URL |
| `VITE_APP_ROLE` | Yes (build-time) | `customer\|provider\|admin` |

**Note:** `VITE_` vars are bundled at build time and visible in client code. Never put secrets here.

---

## 9. Payment Security

### 9.1 Razorpay Integration

Payment verification uses **HMAC-SHA256** of the raw webhook body:

```python
# backend/app/payments.py
import hmac
import hashlib

def verify_razorpay_signature(body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

### 9.2 Payment Flow

```
1. Customer initiates payment → Frontend calls payment gateway
2. Gateway redirects to success/failure → Frontend updates UI
3. Gateway sends webhook → Backend verifies HMAC → Updates payment_status
```

### 9.3 Cash Payments

Cash payments are recorded client-side via `PUT /customer/bookings/{id}/payment` without gateway verification. This is a **known limitation**.

---

## 10. Push Notification Security

FCM tokens are stored per user and used for push notifications. Tokens are **not verified** before storage.

```python
# No validation - any string >= 20 chars is accepted
token = body.get("token")
if not isinstance(token, str) or len(token.strip()) < 20:
    raise ApiError(400, "A valid push token is required")
```

**Recommendation:** Validate token format per platform (FCM token structure).

---

## 11. Compliance Notes

- **No PII encryption at rest:** Database stores plain text phone numbers, emails.
- **No data retention policy:** Historical data retained indefinitely.
- **No GDPR/CCPA features:** No data export, deletion rights for users.
- **Admin actions partially audited:** Only 4 automatic write sites in `audit_logs`.

---

## 12. Security Checklist for Production

Before going live with real users:

- [ ] Replace dev OTP with SMS provider integration
- [ ] Hash admin password with bcrypt
- [ ] Implement JWT revocation or short TTL
- [ ] Narrow CORS to specific domains
- [ ] Add rate limiting to auth endpoints
- [ ] Enable database-level encryption (Supabase provides at rest)
- [ ] Set up database backup schedule
- [ ] Configure Supabase row-level security properly
- [ ] Add SSL pinning for API calls
- [ ] Implement proper logging & monitoring
- [ ] Set up security headers (CSP, HSTS, etc.)
