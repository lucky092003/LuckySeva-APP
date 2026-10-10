# LuckySeva — Architecture Decision Records (ADR)

**Status:** Active
**Last Updated:** October 2026

---

## ADR-001: Phone Number as Primary Identity

**Status:** Accepted
**Date:** August 2026

### Context

We needed a simple identity system for a mobile-first Indian marketplace where phone numbers are the primary authentication factor (OTP-based).

### Decision

Use phone number (`profiles.phone`) as the primary key for user identity, not a UUID. JWT `sub` claim = phone number.

```python
# profiles table
phone text PRIMARY KEY  -- Not uuid

# JWT claims
{
  "sub": "9876543210",  -- Phone, not UUID
  "phone": "9876543210",
  "role": "customer"
}
```

### Consequences

**Positive:**
- Simple auth flow (OTP → phone is identity)
- No separate "user ID" to manage
- Easy to understand and debug

**Negative:**
- Phone numbers can change hands (no account merging)
- Phone as PK means no horizontal scaling of profiles table
- Sensitive data (phone) in JWT tokens

---

## ADR-002: Service Role Bypasses RLS

**Status:** Accepted
**Date:** August 2026

### Context

Supabase provides Row Level Security (RLS) for per-row access control. We needed to decide how the backend connects to the database.

### Decision

Backend uses **Supabase service role key** which bypasses RLS entirely. All access control is enforced in the FastAPI route handlers.

```python
# backend/app/db.py
@lru_cache
def get_client():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

db = get_client()  # Service role — bypasses RLS
```

Every route handler explicitly filters by ownership:

```python
@router.get("/bookings")
def bookings(claims: dict = Depends(require_customer)):
    phone = claims["phone"]
    res = client.table("bookings").select("*").eq("customer_phone", phone).execute()
```

### Consequences

**Positive:**
- Simple mental model: backend is the only client
- No RLS policy complexity
- Easy to debug (all queries logged in one place)

**Negative:**
- If backend is compromised, all data is exposed
- RLS is not a defense-in-depth measure
- Developer must remember to add `.eq("owner", ...)` filters

---

## ADR-003: No ORM, No Pydantic

**Status:** Accepted
**Date:** August 2026

### Context

We needed a simple backend with minimal abstractions for a small team.

### Decision

Plain Python with `supabase-py` client. No SQLAlchemy, no Pydantic models, no SQL functions.

```python
# Validation is hand-rolled
def clean_phone(raw) -> str | None:
    if not isinstance(raw, str):
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return digits if len(digits) == 10 else None

# Response is raw dict
@router.get("/bookings/{booking_id}")
def booking(booking_id: str, claims: dict = Depends(require_customer)):
    row = one(client.table("bookings").select("*").eq("id", booking_id).maybe_single().execute())
    if not row:
        raise ApiError(404, "Booking not found")
    return row
```

### Consequences

**Positive:**
- Minimal dependencies
- Easy to understand for any Python dev
- Direct SQL feel (know what's happening)
- Fast development

**Negative:**
- No automatic validation (bugs easier)
- No schema documentation in code
- No request/response types for frontend
- More boilerplate for each endpoint

---

## ADR-004: Client-Side Radius Filtering

**Status:** Accepted
**Date:** September 2026

### Context

We needed to show customers only professionals within a certain distance. The question was where to compute this.

### Decision

**Backend:** Returns all `confirmed` bookings that are open (or assigned to this provider).
**Frontend:** Filters by Haversine distance using coordinates from both booking and provider.

```python
# backend/app/routers/provider.py
# Returns ALL confirmed bookings, no geo filtering
bookings = client.table("bookings").select("*").eq("status", "confirmed").execute()

# frontend — client-side filter
const inRadius = (booking) => {
  const km = haversineKm(provider.lat, provider.lng, booking.lat, booking.lng);
  return km <= provider.service_radius_km;
};
```

### Consequences

**Positive:**
- Simple backend (no PostGIS needed)
- Fast backend queries (no spatial calculations)
- Easy to debug (filtering is visible in frontend)
- Provider can adjust radius without backend change

**Negative:**
- All open bookings sent to frontend (bandwidth)
- Coordinate data exposed in API response
- Heavier frontend processing
- Missing coordinates = "in range" (fail-open, intentional)

---

## ADR-005: Three Role-Locked Builds

**Status:** Accepted
**Date:** August 2026

### Context

We needed different UI/screens for customers, providers, and admins. A single codebase with runtime role switching was considered.

### Decision

**Compile-time role selection** via `VITE_APP_ROLE` environment variable. Three separate Vercel projects, each with its own build.

```typescript
// frontend/src/context/app-context.tsx
export const APP_ROLE: Role =
  import.meta.env.VITE_APP_ROLE === 'provider' ? 'provider'
  : import.meta.env.VITE_APP_ROLE === 'admin' ? 'admin'
  : 'customer';
```

### Consequences

**Positive:**
- Smaller bundle per app (dead code eliminated)
- Security: customer code can't become provider code
- Clear separation of concerns
- Easier to deploy (one role per project)

**Negative:**
- Three separate deployments
- Shared logic must be truly shared (hooks/components)
- Build-time configuration (not runtime)

---

## ADR-006: No Router Library

**Status:** Accepted
**Date:** August 2026

### Context

React Router is the standard for React navigation. We needed a simpler approach.

### Decision

Hand-rolled screen-state machine in `app-context.tsx`.

```typescript
// frontend/src/context/app-context.tsx
type Screen =
  | { name: 'splash' }
  | { name: 'auth' }
  | { name: 'home' }
  | { name: 'booking-flow'; ... }
  | ...;  // 34 screen types

const [stack, setStack] = useState<Screen[]>([{ name: 'splash' }]);

function navigate(screen: Screen) {
  setStack(prev => [...prev, screen]);
}
```

### Consequences

**Positive:**
- Zero dependencies
- Full control over navigation behavior
- Easy to add screen analytics
- No route conflicts

**Negative:**
- No URL/history support (can't share URLs)
- Manual back button handling
- No built-in deep linking
- Developer must add new screen in two places

---

## ADR-007: maybe_single() Pattern

**Status:** Accepted
**Date:** August 2026

### Context

PostgREST's `maybe_single()` returns `None` (Python None, not empty response) when zero rows match, but returns a response object with `.data` when found.

### Decision

Create a helper that normalizes this behavior.

```python
# backend/app/db.py
def one(res):
    """postgrest's maybe_single().execute() returns None on zero rows."""
    return None if res is None else res.data

# Usage — must go through one()
row = one(client.table("x").select("*").eq("id", id).maybe_single().execute())
if not row:
    raise ApiError(404, "Not found")
```

Enforced by test:
```python
# tests/test_maybe_single.py
# Greps all routers for maybe_single() without one()
```

### Consequences

**Positive:**
- Consistent error handling
- 404 vs 500 distinction
- Tests prevent regressions

**Negative:**
- Must remember to use `one()` every time
- Easy to forget (hence the test)

---

## ADR-008: Denormalized Booking Fields

**Status:** Accepted
**Date:** August 2026

### Context

Bookings refer to customers, professionals, and services. We could use foreign keys and JOINs, or denormalize.

### Decision

Store `customer_name`, `professional_name`, `service_name` directly on the booking record.

```sql
bookings (
  customer_name text NOT NULL,    -- Denormalized
  service_name text NOT NULL,    -- Denormalized
  professional_name text NOT NULL,  -- Denormalized
  professional_id uuid REFERENCES professionals(id) ON DELETE SET NULL
)
```

### Consequences

**Positive:**
- No JOINs needed to display booking
- Independent of name changes
- Simpler queries (one table read)
- Historical accuracy (booking shows what it showed then)

**Negative:**
- Stale data if not updated on name change
- Multiple sources of truth
- Extra storage

---

## ADR-009: Open Requests with Auto-Assign

**Status:** Accepted
**Date:** September 2026

### Context

Customers can book a specific professional OR request auto-assignment.

### Decision

`professional_id = NULL` + `professional_name = 'Auto-assign'` marks an open request.

```python
# Creating an open request
{
  "professional_id": None,
  "professional_name": "Auto-assign",
  "status": "confirmed"
}

# When provider accepts
{
  "professional_id": "provider-uuid",
  "professional_name": "John Electrician",
  "status": "assigned"
}
```

### Consequences

**Positive:**
- Simple flag (no new status or column)
- Visible to all qualifying providers
- First-to-accept wins
- Easy to return to pool on decline

**Negative:**
- String comparison ("Auto-assign") is fragile
- No record of who was "supposed" to get it
- Race condition on acceptance

---

## ADR-010: Priority Fee for Top-N Picks

**Status:** Accepted
**Date:** October 2026

### Context

When a customer picks a specific professional (not auto-assign), we charge a priority fee.

### Decision

Server-side computation of whether the picked professional was in the top-N by distance/rating.

```python
# backend/app/routers/customer.py
def _is_priority_pick(client, service_id, professional_id, top_n, lat, lng):
    # Recompute the top-N list server-side
    ranked = _nearby_professionals(category_slug, lat, lng, radius, top_n)
    return professional_id in [r['id'] for r in ranked]

# If picked pro is in top-N, charge priority fee
if professional_id and _is_priority_pick(...):
    priority_fee = setting_float("priority_fee", 99)
```

### Consequences

**Positive:**
- Fee always matches what customer was shown
- Can't be spoofed by client
- Transparent pricing

**Negative:**
- Recomputes the list on every booking
- Top-N based on distance, not rating (what customer sees)

---

## ADR-011: Coupon Discount Frozen at Booking

**Status:** Accepted
**Date:** October 2026

### Context

Coupon values or rules might change after a booking is made. We needed to preserve what the customer agreed to.

### Decision

Discount amount and coupon code stored on the booking record.

```sql
bookings (
  discount_amount numeric NOT NULL DEFAULT 0,
  coupon_code text,
  -- Prices frozen at booking time
  base_price numeric NOT NULL,
  platform_fee numeric NOT NULL,
  provider_earnings numeric NOT NULL
)
```

### Consequences

**Positive:**
- Historical accuracy
- Customer charged what they saw
- Invoice always matches receipt

**Negative:**
- Coupon terms can't be retroactively applied
- If coupon expires, existing bookings still use it

---

## ADR-012: PR Review Bot as Supabase Edge Function

**Status:** Accepted
**Date:** September 2026

### Context

We needed automated PR review for security and code quality, without external services.

### Decision

Supabase Edge Function (Deno) that:
1. Receives GitHub webhook
2. Runs static analysis rules on the diff
3. Posts review comment
4. Maintains CHANGELOG.md via PR

```typescript
// backend/supabase/functions/pr-review-bot/index.ts
Deno.serve(async (req) => {
  const payload = await verifyWebhook(req);
  const findings = runRules(diff);
  await postReviewComment(payload.pr, findings);
  await updateChangelog(payload.pr);
});
```

### Consequences

**Positive:**
- No external service (runs on Supabase)
- Deterministic (no LLM costs)
- Self-contained
- Maintains changelog automatically

**Negative:**
- Deno runtime (additional complexity)
- Must be deployed separately
- Limited to static analysis

---

## ADR-013: No Pagination

**Status:** Accepted
**Date:** August 2026

### Context

Proper pagination (cursor-based) requires more backend complexity.

### Decision

Hard limits on list endpoints, no offset/cursor pagination.

```python
# backend/app/routers/catalog.py
@router.get("/professionals")
def professionals(limit: int = Query(default=50, le=100)):
    res = client.table("professionals").select("*").limit(limit).execute()
    return res.data or []
```

### Consequences

**Positive:**
- Simple implementation
- Fast queries (no OFFSET computation)
- Sufficient for MVP scale

**Negative:**
- Can't load "load more" efficiently
- No total count (hard to show "page 2 of ?")
- Large datasets will be slow

---

## ADR-014: Manual Payouts

**Status:** Accepted
**Date:** October 2026

### Context

Providers earn money from completed jobs. We needed a payout system.

### Decision

Provider requests payout → Admin approves → Manual settlement (no auto-transfer).

```python
# Provider requests
POST /provider/payouts { amount: 5000 }

# Admin approves
PUT /admin/payouts/{id} { status: "completed", reference: "UPI123" }
```

No actual payment integration (yet). Manual UPI/bank transfer outside system.

### Consequences

**Positive:**
- Simple to implement
- Full control over payouts
- No payment gateway complexity

**Negative:**
- Manual work for admin
- No automatic settlement
- Delay between request and payment
- Error-prone manual process

---

## Future ADRs (Not Yet Decided)

| ID | Topic | Status |
|----|-------|--------|
| FA-01 | Pydantic for request validation | Considered |
| FA-02 | Redis for caching | Considered |
| FA-03 | API versioning strategy | Not started |
| FA-04 | GraphQL vs REST | Not started |
| FA-05 | Microservices decomposition | Not started |
| FA-06 | Real-time updates (WebSockets) | Not started |
