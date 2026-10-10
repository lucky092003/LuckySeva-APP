# LuckySeva — API Documentation

Base URL: `https://api.luckyseva.com` (production) or `http://localhost:8000` (local)

Interactive docs: `/docs` (local only; production 404s docs endpoints)

---

## Authentication

All authenticated endpoints require `Authorization: Bearer <JWT>` header.

### JWT Structure

```json
{
  "sub": "9876543210",
  "phone": "9876543210",
  "role": "customer | provider | admin",
  "professional_id": "uuid (provider only)"
}
```

---

## Endpoints

### Public Endpoints (No Auth Required)

#### `GET /health`
Health check.

**Response:** `{"ok": true}`

---

#### `POST /auth/request-otp`
Request an OTP for login/signup.

**Request:**
```json
{
  "phone": "9876543210",
  "role": "customer | provider",
  "mode": "login | signup"
}
```

**Response (dev mode):**
```json
{
  "sent": true,
  "role": "customer",
  "expires_in": 300,
  "resend_after": 30,
  "debug_code": "123456"
}
```

---

#### `POST /auth/verify-otp`
Verify OTP and receive JWT.

**Request:**
```json
{
  "phone": "9876543210",
  "code": "123456",
  "role": "customer | provider | admin"
}
```

**Response (customer):**
```json
{
  "access_token": "eyJ...",
  "role": "customer",
  "profile": { "phone": "...", "name": "...", ... }
}
```

**Response (provider):**
```json
{
  "access_token": "eyJ...",
  "role": "provider",
  "professional_id": "uuid"
}
```

**Response (admin):**
```json
{
  "access_token": "eyJ...",
  "role": "admin"
}
```

---

### Authenticated (Any Valid Token)

#### `GET /auth/me`
Get current user profile.

**Response:**
```json
{
  "role": "customer",
  "profile": { "phone": "...", "name": "...", ... },
  "professional": { ... } // provider only
}
```

---

### Catalog Endpoints (Public)

#### `GET /catalog`
Home feed: categories, top professionals, popular services.

**Response:**
```json
{
  "categories": [...],
  "professionals": [...],
  "popular": [...]
}
```

---

#### `GET /catalog/categories`
List all categories.

**Response:** `Category[]`

---

#### `GET /catalog/categories/{slug}`
Get category with its services.

**Response:**
```json
{
  "category": { "id": "...", "name": "Electrician", ... },
  "services": [...]
}
```

---

#### `GET /catalog/categories/{slug}/services`
List services in a category.

**Response:** `Service[]`

---

#### `GET /catalog/services?category_slug=electrician`
List all services, optionally filtered by category.

**Query Params:** `category_slug` (optional)

**Response:** `Service[]`

---

#### `GET /catalog/services/{service_id}`
Get service with nearby providers.

**Query Params:** `latitude`, `longitude`, `radius_km` (default 30), `limit` (default 5)

**Response:**
```json
{
  "service": { "id": "...", "name": "...", ... },
  "providers": [...],
  "nearby": [...],
  "nearby_radius_km": 30,
  "nearby_category_slug": "electrician"
}
```

---

#### `GET /catalog/professionals?category_slug=electrician&query=John&limit=50`
Search professionals.

**Query Params:** `category_slug`, `query`, `limit` (default 50, max 100)

**Response:** `Professional[]`

---

#### `GET /catalog/professionals/{professional_id}`
Get professional profile with services and reviews.

**Response:**
```json
{
  "professional": { ... },
  "services": [...],
  "reviews": [...]
}
```

---

#### `GET /catalog/reviews/{professional_id}`
Get reviews for a professional.

**Response:** `Review[]`

---

#### `GET /catalog/search?q=plumber`
Search services and professionals.

**Query Params:** `q` (required)

**Response:**
```json
{
  "professionals": [...],
  "services": [...]
}
```

---

### Customer Endpoints (require_customer)

#### `GET /customer/profile`
Get customer profile.

**Response:** `Profile`

---

#### `PUT /customer/profile`
Update profile.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "location": "Faridabad"
}
```

**Response:** `Profile`

---

#### `GET /customer/addresses`
List saved addresses.

**Response:** `Address[]`

---

#### `POST /customer/addresses`
Add new address.

**Request:**
```json
{
  "label": "Home",
  "full_address": "123 House, Street, Area, City, State, 201301",
  "latitude": 28.3911,
  "longitude": 77.3233
}
```

**Response:** `Address`

---

#### `PUT /customer/addresses/{address_id}`
Update address.

**Request:**
```json
{
  "label": "Work",
  "full_address": "456 Office, Street, Area, City, State, 201301",
  "is_default": true
}
```

**Response:** `Address`

---

#### `DELETE /customer/addresses/{address_id}`
Delete address.

**Response:** `{"ok": true}`

---

#### `GET /customer/bookings`
List customer's bookings.

**Response:** `Booking[]`

---

#### `GET /customer/bookings/{booking_id}`
Get booking details.

**Response:** `Booking`

---

#### `POST /customer/bookings`
Create new booking.

**Request:**
```json
{
  "service_id": "uuid",
  "service_name": "Electrician",
  "professional_id": "uuid (optional, null for auto-assign)",
  "professional_name": "Auto-assign",
  "scheduled_date": "2026-10-15",
  "scheduled_time": "10:00",
  "notes": "Need wiring checked",
  "visit_fee": 50,
  "customer_address": "123 Street, ...",
  "latitude": 28.3911,
  "longitude": 77.3233,
  "coupon_code": "LUCKY20 (optional)"
}
```

**Response:** `Booking`

---

#### `POST /customer/quote`
Get price quote without booking.

**Request:** Same as `/customer/bookings`

**Response:**
```json
{
  "base_price": 299,
  "charges": 50,
  "pre_discount": 349,
  "discount": 69.8,
  "total": 279.2,
  "coupon_code": "LUCKY20",
  "coupon_description": "20% off",
  "error": null,
  "payments_enabled": true
}
```

---

#### `GET /customer/coupons`
List available coupons.

**Response:**
```json
[
  {
    "code": "LUCKY20",
    "description": "20% off",
    "discount_type": "percent",
    "discount_value": 20,
    "category_slug": null,
    "min_amount": 500,
    "note": null
  }
]
```

---

#### `PUT /customer/bookings/{booking_id}/cancel`
Cancel booking.

**Request:**
```json
{
  "reason": "Changed plans"
}
```

**Response:** `Booking`

---

#### `PUT /customer/bookings/{booking_id}/payment`
Record cash payment.

**Request:**
```json
{
  "payment_method": "cash"
}
```

**Response:**
```json
{
  "booking": { ... },
  "payment": { ... }
}
```

---

#### `POST /customer/bookings/{booking_id}/refund-request`
Request refund.

**Request:**
```json
{
  "reason": "Service not as described"
}
```

**Response:** `Refund`

---

#### `GET /customer/refunds`
List customer's refunds.

**Response:** `Refund[]`

---

#### `POST /customer/device-token`
Register FCM token.

**Request:**
```json
{
  "token": "fcm-token-string",
  "platform": "android | ios | web"
}
```

**Response:** `{"registered": true}`

---

#### `DELETE /customer/device-token`
Unregister FCM token.

**Request:**
```json
{
  "token": "fcm-token-string"
}
```

**Response:** `{"ok": true}`

---

#### `GET /customer/favourites`
List favourite professionals.

**Response:** `Professional[]`

---

#### `POST /customer/favourites`
Add to favourites.

**Request:**
```json
{
  "professional_id": "uuid"
}
```

**Response:** `Favourite`

---

#### `DELETE /customer/favourites/{professional_id}`
Remove from favourites.

**Response:** `{"ok": true}`

---

#### `GET /customer/notifications`
List notifications.

**Response:** `Notification[]`

---

#### `PUT /customer/notifications/{notification_id}/read`
Mark notification read.

**Response:** `Notification`

---

#### `PUT /customer/notifications/read-all`
Mark all notifications read.

**Response:** `{"ok": true, "updated": 5}`

---

#### `GET /customer/tickets`
List support tickets.

**Response:** `SupportTicket[]`

---

#### `POST /customer/tickets`
Create support ticket.

**Request:**
```json
{
  "message": "Help with booking"
}
```

**Response:** `SupportTicket`

---

#### `GET /customer/reviews`
List customer's reviews.

**Response:** `Review[]`

---

#### `POST /customer/reviews`
Submit review.

**Request:**
```json
{
  "booking_id": "uuid (optional)",
  "professional_id": "uuid",
  "rating": 5,
  "comment": "Great service!"
}
```

**Response:** `Review`

---

### Provider Endpoints (require_provider)

#### `GET /provider/me`
Get provider profile.

**Response:**
```json
{
  "professional": { ... },
  "services": [...]
}
```

---

#### `PUT /provider/me`
Update provider profile.

**Request:**
```json
{
  "status": "available | busy",
  "starting_price": 299,
  "service_radius_km": 25,
  "bio": "Experienced electrician",
  "service_area": "Faridabad",
  "latitude": 28.3911,
  "longitude": 77.3233,
  "name": "John Electrician"
}
```

**Response:** `Professional`

---

#### `PUT /provider/kyc`
Submit KYC documents.

**Request:**
```json
{
  "doc_type": "aadhaar | pan | voter | driving",
  "doc_number": "ABCD123456"
}
```

**Response:** `Professional`

---

#### `GET /provider/services`
Get category services with offered flag.

**Response:**
```json
{
  "category_slug": "electrician",
  "services": [
    { "id": "...", "name": "...", "offered": true },
    { "id": "...", "name": "...", "offered": false }
  ]
}
```

---

#### `PUT /provider/services`
Update offered services.

**Request:**
```json
{
  "service_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:** `ServiceLink[]`

---

#### `PUT /provider/trade`
Change trade category.

**Request:**
```json
{
  "category_slug": "plumber"
}
```

**Response:** `Professional`

---

#### `PUT /provider/availability`
Toggle accepting jobs.

**Request:**
```json
{
  "accepting_jobs": true
}
```

**Response:** `Professional`

---

#### `POST /provider/heartbeat`
Update last-seen timestamp.

**Response:**
```json
{
  "id": "uuid",
  "last_seen_at": "2026-10-09T12:00:00Z"
}
```

---

#### `POST /provider/device-token`
Register FCM token.

**Request:**
```json
{
  "token": "fcm-token-string",
  "platform": "android | ios | web"
}
```

**Response:** `{"registered": true}`

---

#### `GET /provider/payout-account`
Get payout account details.

**Response:**
```json
{
  "id": "uuid",
  "bank_upi_id": "provider@upi",
  "bank_account": "1234567890"
}
```

---

#### `PUT /provider/payout-account`
Set payout account.

**Request:**
```json
{
  "upi_id": "provider@upi",
  "bank_account": "1234567890"
}
```

**Response:** `Professional`

---

#### `GET /provider/bookings`
Get open request feed (new requests).

**Response:** `Booking[]`

> Note: Returns `confirmed` bookings that are either assigned to this provider or open (no professional_id) and in their service category + radius.

---

#### `GET /provider/bookings/mine`
Get provider's assigned bookings.

**Response:** `Booking[]`

---

#### `GET /provider/bookings/{booking_id}`
Get booking details.

**Response:** `Booking` (customer phone hidden until accepted)

---

#### `POST /provider/bookings/{booking_id}/accept`
Accept a booking request.

**Response:** `Booking`

> Note: Phone number becomes visible after acceptance.

---

#### `POST /provider/bookings/{booking_id}/decline`
Decline a booking request.

**Response:** `{"ok": true}`

> Note: Per-provider decline. Other providers can still accept.

---

#### `PUT /provider/bookings/{booking_id}/status`
Update booking status.

**Request:**
```json
{
  "status": "assigned | on_the_way | started | completed | cancelled"
}
```

**Response:** `Booking`

---

#### `GET /provider/earnings`
Get earnings summary.

**Response:**
```json
{
  "total_earnings": 15000,
  "by_date": { "2026-10-01": 500, "2026-10-02": 750 },
  "payouts": [...],
  "available": 5000,
  "on_hold": 2000,
  "settled": 8000,
  "payout_minimum": 500,
  "gross_earnings": 15000
}
```

---

#### `GET /provider/earnings/daily`
Get daily earnings for chart.

**Response:**
```json
[
  { "date": "2026-10-09", "amount": 500 },
  { "date": "2026-10-08", "amount": 750 }
]
```

---

#### `GET /provider/payouts`
List payout history.

**Response:** `Payout[]`

---

#### `POST /provider/payouts`
Request payout.

**Request:**
```json
{
  "amount": 5000
}
```

**Response:** `Payout`

---

#### `POST /provider/payouts/{payout_id}/cancel`
Cancel pending payout request.

**Response:** `Payout`

---

#### `GET /provider/dashboard`
Get dashboard stats.

**Response:**
```json
{
  "active": 2,
  "completed_jobs": 45,
  "today_earnings": 500,
  "total_earnings": 15000
}
```

---

### Admin Endpoints (require_admin)

#### `GET /admin/stats`
Get platform stats.

**Response:**
```json
{
  "bookings": 150,
  "customers": 80,
  "providers": 25,
  "reviews": 120,
  "today_revenue": 5000,
  "recent_bookings": [...],
  "gmv": 150000,
  "platform_fee_total": 15000,
  ...
}
```

---

#### `GET /admin/notifications?status=unread`
List all notifications.

**Query Params:** `status` (optional): `unread | read`

**Response:** `Notification[]`

---

#### `GET /admin/revenue?days=30`
Get revenue summary.

**Query Params:** `days` (default 30, max 365)

**Response:**
```json
{
  "gmv": 150000,
  "platform_fee_total": 15000,
  "discount_given": 5000,
  "provider_owed": 135000,
  "collected": 145000,
  "refunded": 2000,
  "net_platform_earnings": 10000,
  "effective_commission_pct": 10,
  "daily": [...]
}
```

---

#### `GET /admin/payouts?status=requested`
List payouts.

**Query Params:** `status` (optional)

**Response:** `Payout[]`

---

#### `PUT /admin/payouts/{payout_id}`
Settle or reject payout.

**Request:**
```json
{
  "status": "approved | completed | rejected",
  "reference": "UPI123456",
  "note": "Optional note"
}
```

**Response:** `Payout`

---

#### `GET /admin/refunds?status=pending`
List refunds.

**Query Params:** `status` (optional)

**Response:** `Refund[]`

---

#### `PUT /admin/refunds/{refund_id}`
Resolve refund.

**Request:**
```json
{
  "action": "approve | reject",
  "note": "Reason for rejection"
}
```

**Response:** `Refund`

---

#### `GET /admin/disputes?status=open`
List disputes.

**Response:** `Dispute[]`

---

#### `GET /admin/payments?status=completed`
List payments.

**Response:** `Payment[]`

---

#### `GET /admin/bookings?status=confirmed`
List all bookings.

**Query Params:** `status` (optional)

**Response:** `Booking[]`

---

#### `GET /admin/professionals`
List all professionals.

**Response:** `Professional[]`

---

#### `GET /admin/professionals/{professional_id}`
Get professional details.

**Response:** `Professional`

---

#### `POST /admin/professionals`
Create professional.

**Request:**
```json
{
  "name": "John Doe",
  "category_slug": "electrician",
  "phone": "9876543210",
  "email": "john@example.com",
  "skills": ["wiring", "repair"],
  "experience_years": 5,
  "starting_price": 299,
  "service_area": "Faridabad",
  "service_radius_km": 30
}
```

**Response:** `Professional`

---

#### `PUT /admin/professionals/{professional_id}`
Update professional.

**Request:** Same fields as POST (partial update)

**Response:** `Professional`

---

#### `DELETE /admin/professionals/{professional_id}`
Delete professional.

**Response:** `{"ok": true}`

---

#### `PUT /admin/kyc/{professional_id}`
Review KYC.

**Request:**
```json
{
  "decision": "approved | rejected",
  "note": "Optional review note"
}
```

**Response:** `Professional`

---

#### `GET /admin/categories`
List categories.

**Response:** `Category[]`

---

#### `POST /admin/categories`
Create category.

**Request:**
```json
{
  "name": "Packers & Movers",
  "slug": "packer-mover",
  "icon": "Truck",
  "color": "#f59e0b",
  "sort_order": 11
}
```

**Response:** `Category`

---

#### `GET /admin/services`
List all services.

**Response:** `Service[]`

---

#### `POST /admin/services`
Create service.

**Request:**
```json
{
  "category_slug": "electrician",
  "name": "New Service",
  "description": "Description",
  "starting_price": 299,
  "estimated_duration": "1 hour",
  "popular": false
}
```

**Response:** `Service`

---

#### `PUT /admin/services/{service_id}`
Update service.

**Request:** Partial update

**Response:** `Service`

---

#### `DELETE /admin/services/{service_id}`
Delete service.

**Response:** `{"ok": true}`

---

#### `PUT /admin/categories/{slug}/commission`
Set category commission.

**Request:**
```json
{
  "commission_pct": 15,
  "commission_enabled": true
}
```

**Response:** `Category`

---

#### `GET /admin/commission-preview`
Preview commission calculation.

**Request:**
```json
{
  "amount": 1000,
  "commission_pct": 10
}
```

**Response:**
```json
{
  "amount": 1000,
  "commission_pct": 10,
  "platform_fee": 100,
  "provider_earnings": 900
}
```

---

#### `GET /admin/coupons`
List coupons.

**Response:** `Coupon[]`

---

#### `POST /admin/coupons`
Create coupon.

**Request:**
```json
{
  "code": "LUCKY20",
  "description": "20% off",
  "discount_type": "percent | flat",
  "discount_value": 20,
  "min_amount": 500,
  "max_discount": 200,
  "category_slug": null,
  "max_per_phone": 1,
  "first_booking_only": true,
  "usage_limit": 1000,
  "active": true
}
```

**Response:** `Coupon`

---

#### `PUT /admin/coupons/{coupon_id}`
Update coupon.

**Request:** Partial update

**Response:** `Coupon`

---

#### `DELETE /admin/coupons/{coupon_id}`
Delete coupon.

**Response:** `{"ok": true}`

---

#### `GET /admin/settings`
Get all settings.

**Response:** `{ "key": "value", ... }`

---

#### `POST /admin/settings`
Update setting.

**Request:**
```json
{
  "key": "admin_commission_pct",
  "value": "10"
}
```

**Response:** `Setting`

---

#### `GET /admin/audit-logs?limit=50`
Get audit logs.

**Query Params:** `limit` (default 50, max 200)

**Response:** `AuditLog[]`

---

#### `POST /admin/audit-logs`
Create manual audit log.

**Request:**
```json
{
  "action": "manual_action",
  "detail": "Description"
}
```

**Response:** `AuditLog`

---

## Data Types

### Category
```typescript
{
  id: string;
  name: string;
  slug: string;
  icon: string;       // Lucide icon name
  color: string;      // Hex color
  description: string;
  sort_order: number;
  created_at: string;
}
```

### Service
```typescript
{
  id: string;
  category_id: string;
  name: string;
  description: string;
  starting_price: number;
  estimated_duration: string;
  popular: boolean;
  created_at: string;
}
```

### Professional
```typescript
{
  id: string;
  name: string;
  category_slug: string;
  skills: string[];
  experience_years: number;
  rating: number;
  reviews_count: number;
  completed_jobs: number;
  starting_price: number;
  avatar_url: string;
  distance_km: number;
  status: "available" | "busy";
  bio: string;
  service_area: string;
  latitude: number | null;
  longitude: number | null;
  service_radius_km: number;
  phone: string;
  email: string | null;
  kyc_status: "pending" | "approved" | "rejected" | null;
  accepting_jobs: boolean | null;
  created_at: string;
}
```

### Booking
```typescript
{
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  address_id: string | null;
  service_id: string | null;
  service_name: string;
  professional_id: string | null;
  professional_name: string;
  scheduled_date: string;       // "YYYY-MM-DD"
  scheduled_time: string;       // "HH:MM"
  notes: string;
  base_price: number;
  visit_fee: number;
  priority_fee: number;
  discount_amount: number;
  coupon_code: string | null;
  commission_pct: number;
  platform_fee: number;
  provider_earnings: number;
  total_amount: number;
  payment_method: "cash" | "upi" | "card" | "netbanking";
  payment_status: "pending" | "paid" | "cash" | "refund_pending" | "refunded";
  status: "confirmed" | "assigned" | "on_the_way" | "started" | "completed" | "cancelled";
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}
```

### Address
```typescript
{
  id: string;
  customer_phone: string;
  label: string;
  full_address: string;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}
```

### Review
```typescript
{
  id: string;
  booking_id: string | null;
  professional_id: string;
  customer_name: string;
  rating: number;           // 1-5
  comment: string;
  created_at: string;
}
```

### Notification
```typescript
{
  id: string;
  customer_phone: string;
  type: "booking" | "alert" | "payment" | "provider" | "review";
  title: string;
  message: string;
  booking_id: string | null;
  read: boolean;
  created_at: string;
}
```

### Payout
```typescript
{
  id: string;
  professional_id: string;
  amount: number;
  status: "requested" | "approved" | "completed" | "rejected" | "cancelled";
  reference: string | null;
  note: string | null;
  created_at: string;
}
```

### Coupon
```typescript
{
  id: string;
  code: string;
  description: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  min_amount: number;
  max_discount: number | null;
  category_slug: string | null;
  max_per_phone: number | null;
  first_booking_only: boolean;
  usage_limit: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}
```

---

## Error Responses

All errors return JSON:

```json
{
  "error": "Human-readable message",
  "code": "error_code"  // optional
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (wrong role) |
| 404 | Not Found |
| 409 | Conflict (e.g., already a favourite) |
| 422 | FastAPI Validation Error |
| 500 | Internal Server Error |
