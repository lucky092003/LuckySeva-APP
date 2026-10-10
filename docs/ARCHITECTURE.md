# LuckySeva — Architecture Documentation

**LuckySeva** is a mobile-first home services marketplace connecting customers with verified local professionals (plumbers, electricians, cleaners, etc.).

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (Vercel/CDN)                            │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────────────┐  │
│  │ Customer App   │  │ Provider App   │  │ Admin Dashboard (Web Only) │  │
│  │ (React + Cap)  │  │ (React + Cap)  │  │ (React + Tailwind)         │  │
│  └───────┬────────┘  └───────┬────────┘  └──────────────┬──────────────┘  │
└──────────┼───────────────────┼──────────────────────────┼──────────────────┘
           │                   │                          │
           │ HTTPS/REST       │                          │
           ▼                   ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY LAYER                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              FastAPI Backend (Python 3.11+)                          │   │
│  │  • JWT Authentication (PyJWT HS256)                                 │   │
│  │  • Role-based Access Control (customer/provider/admin)              │   │
│  │  • Business Logic Layer                                             │   │
│  │  • Supabase Service Role Client                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    External Services                                  │   │
│  │  • FCM Push Notifications                                           │   │
│  │  • Nominatim Geocoding (OpenStreetMap)                             │   │
│  │  • Payment Gateway (Razorpay)                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER (Supabase)                                │
│  ┌─────────────────────┐  ┌─────────────────────────────────────────────┐   │
│  │  PostgreSQL 15+     │  │  Row Level Security (RLS)                  │   │
│  │  • Primary DB       │  │  • Service Role Bypasses RLS              │   │
│  │  • PostgREST API    │  │  • Backend Enforces Access Control         │   │
│  └─────────────────────┘  └─────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Supabase Edge Functions (Deno)                                      │   │
│  │  • PR Review Bot                                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Deployment |
|-------|------------|------------|
| **Frontend Web** | React 18 + TypeScript + Vite + Tailwind CSS 4 | Vercel (3 projects) |
| **Mobile Apps** | Capacitor 8 (wraps React) | Google Play / App Store |
| **Backend API** | FastAPI (Python 3.11+) | Render / Railway / VPS |
| **Database** | Supabase PostgreSQL 15+ | Supabase Cloud |
| **Auth** | Custom JWT (PyJWT HS256) | N/A |
| **Push Notifications** | Firebase Cloud Messaging (FCM) | Firebase Console |
| **Geocoding** | Nominatim (OpenStreetMap) | External API |

### 1.3 Three Role-Locked Builds

Each build is compiled with `VITE_APP_ROLE` and contains **only** that role's screens.

| Role | Website | Android | iOS | Capabilities |
|------|---------|---------|-----|--------------|
| `customer` | ✅ Vercel | ✅ LuckySeva | ✅ LuckySeva | Browse, book, pay, review |
| `provider` | ✅ Vercel | ✅ LuckySeva Partner | ✅ LuckySeva Partner | Accept jobs, manage bookings, earnings |
| `admin` | ✅ Vercel | ❌ | ❌ | Dashboard, CRUD, settings, audit |

---

## 2. Frontend Architecture

### 2.1 Project Structure

```
frontend/
├── src/
│   ├── components/          # Shared UI components
│   │   ├── AddressForm.tsx  # Address entry (shared by booking & saved addresses)
│   │   ├── OtpInput.tsx     # 6-digit OTP entry
│   │   ├── PhoneShell.tsx   # Mobile mockup wrapper
│   │   ├── BottomNav.tsx    # Mobile navigation
│   │   ├── WebTopNav.tsx    # Web navigation
│   │   └── ui.tsx           # Shared UI primitives
│   ├── context/
│   │   └── app-context.tsx  # THE ROUTER + session store (no react-router)
│   ├── hooks/               # Data hooks
│   │   ├── useCatalog.ts
│   │   ├── useBookings.ts
│   │   ├── useCustomer.ts
│   │   └── useProvider.ts
│   ├── screens/
│   │   ├── customer/        # 22 customer screens
│   │   ├── provider/        # 6 provider screens
│   │   ├── admin/           # 5 admin screens
│   │   └── shared/
│   ├── services/
│   │   ├── api.ts           # ONLY place fetch() is called
│   │   ├── location.ts      # GPS, Nominatim, Haversine
│   │   └── address.ts       # Address domain logic
│   ├── types/
│   │   └── index.ts         # Shared DTO types
│   └── utils/
│       ├── format.ts        # Formatting utilities
│       ├── invoice.ts       # Invoice generation
│       ├── kyc.ts           # KYC labels
│       └── native.ts        # Platform detection
├── capacitor.config.ts      # Role-aware app ID/name
├── vite.config.ts           # Build config (@ alias)
└── vercel.json              # Vercel build settings
```

### 2.2 Navigation Architecture

**No router library.** `context/app-context.tsx` holds a `Screen[]` stack.

- `Screen` is a **34-member discriminated union**
- Adding a screen = adding a member + a `case` in the renderer
- 9 "root" names replace the whole stack: `home`, `services`, `bookings`, `profile`, `provider-home`, `provider-bookings`, `provider-earnings`, `provider-profile`, `admin-dashboard`

### 2.3 State Management

| Storage Key | Shape | Purpose |
|-------------|-------|---------|
| `luckyseva_api_token` | raw JWT string | Authentication |
| `luckyseva.customer` | JSON `Customer` | Customer profile |
| `luckyseva.providerId` | JSON string \| null | Provider ID |
| `luckyseva.adminAuthed` | JSON boolean | Admin session |

### 2.4 API Client Pattern

All API calls go through `frontend/src/services/api.ts`:

```typescript
import { api } from '@/services/api';

// Example calls
const catalog = await api.catalog.home();
await api.auth.verifyOtp({ phone: '9876543210', code: '123456', role: 'customer' });
await api.customer.createBooking({ service_id, scheduled_date, scheduled_time });
```

---

## 3. Backend Architecture

### 3.1 Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, routers mount
│   ├── config.py            # Environment variables
│   ├── db.py                # Supabase client (service role)
│   ├── security.py          # JWT sign/verify (PyJWT HS256)
│   ├── dependencies.py      # Role guards (require_customer/provider/admin)
│   ├── exceptions.py        # ApiError exception class
│   ├── routers/
│   │   ├── auth.py          # OTP auth, signup, login
│   │   ├── catalog.py        # Public catalog (categories, services, professionals)
│   │   ├── customer.py       # Customer bookings, addresses, reviews
│   │   ├── provider.py       # Provider feed, accept/decline, earnings
│   │   ├── payments.py       # Payment webhook (Razorpay)
│   │   └── admin.py          # Admin CRUD, settings, stats
│   ├── links.py             # Professional-to-service linking
│   ├── ledger.py            # Payout/refund logic
│   ├── events.py            # Push notifications, deadline tracking
│   ├── pricing.py           # Commission calculations
│   └── otp.py               # OTP generation (dev mode)
├── tests/
│   ├── test_smoke.py        # Health, routing, auth guards
│   ├── test_maybe_single.py # maybe_single() pattern enforcement
│   └── ...
├── supabase/
│   ├── config.toml          # Edge function config
│   ├── functions/
│   │   └── pr-review-bot/   # PR review + changelog bot (Deno)
│   └── migrations/          # SQL schema migrations
├── requirements.txt         # Runtime deps
└── requirements-dev.txt     # Lint/test deps
```

### 3.2 API Router Structure

| Prefix | Auth | Purpose |
|--------|------|---------|
| `/auth` | None (OTP) | `POST /verify-otp` mints JWT, `GET /me` |
| `/catalog` | None | Public: categories, services, professionals, reviews |
| `/customer` | JWT (customer) | Profile, addresses, bookings, favourites, notifications |
| `/provider` | JWT (provider) | Feed, accept/decline, status, earnings, payouts |
| `/admin` | JWT (admin) | Stats, professionals/services CRUD, settings |
| `/payments` | None (webhook) | Razorpay webhook handler |
| `/health` | None | Health check |

### 3.3 Response Shapes

There is **no `{"data": ...}` envelope**. Four shapes coexist:

| Shape | When | Example |
|-------|------|---------|
| bare array | list endpoints | `GET /catalog/categories` |
| raw row dict | single-object reads | `GET /admin/professionals/{id}` |
| purpose-built dict | composite endpoints | `{"category", "services"}` |
| `{"ok": true}` | mutation acks | every `DELETE`, `read-all` |

### 3.4 Request Lifecycle

```
screen
  └── hook (frontend/src/hooks/*)
        └── api.<ns>.<method>()
              └── fetch(`${BASE}/${fn}${path}`)
                    ├── headers: Content-Type, Authorization: Bearer <JWT>
                    └── FastAPI router
                          ├── HTTPBearer(auto_error=False)
                          ├── get_claims() -> verify_token()
                          ├── require_<role>(...)
                          └── handler: client.table(...).execute()
                                └── Supabase Postgres (service role)
```

---

## 4. Database Architecture

### 4.1 Schema Overview

17 tables organized into domain groups:

**Core Domain Tables:**
- `categories` — Service categories (Electrician, Plumber, etc.)
- `services` — Concrete services under categories
- `professionals` — Service provider profiles
- `professional_services` — Many-to-many: provider ↔ services (with custom pricing)

**Booking Domain Tables:**
- `bookings` — Customer bookings with status lifecycle
- `reviews` — Customer reviews (1-5 stars)
- `addresses` — Customer saved addresses with coordinates

**Platform Tables:**
- `profiles` — User profiles (phone is PK, not uuid)
- `notifications` — Push notification records
- `support_tickets` — Customer support requests
- `favourites` — Customer ↔ Provider favorites
- `device_tokens` — FCM tokens for push

**Financial Tables:**
- `payouts` — Provider payout requests
- `payments` — Payment transactions
- `refunds` — Refund requests/disputes
- `coupons` — Discount coupons
- `coupon_redemptions` — Coupon usage tracking

**Internal Tables:**
- `admin_settings` — Platform configuration (key-value)
- `audit_logs` — Admin action audit trail

**Bot Tables (PR Review):**
- `pr_review_settings` — Per-repo bot settings
- `pr_reviews` — Bot run history
- `changelog_entries` — Changelog source data

### 4.2 Key Design Decisions

1. **Phone as Identity:** `profiles.phone` is the PK. JWT `sub` = phone. No user IDs.
2. **Service Role Access:** Backend uses Supabase service role (bypasses RLS). All access control is in the backend.
3. **Denormalized Bookings:** `customer_name`, `professional_name`, `service_name` stored directly on booking.
4. **Open Requests:** `professional_id = NULL` + `professional_name = 'Auto-assign'` = open request visible to providers in radius.

---

## 5. Security Architecture

### 5.1 Authentication Flow

```
Customer/Provider:
1. POST /auth/request-otp { phone, role }
   → OTP generated (dev mode: returned in response)
2. POST /auth/verify-otp { phone, code, role }
   → OTP validated, JWT issued (30-day TTL)

Admin:
1. POST /auth/verify-otp { phone: "admin", code: <password>, role: "admin" }
   → Credentials validated against admin_settings table
   → JWT issued with role="admin"
```

### 5.2 JWT Structure

```json
{
  "sub": "9876543210",           // Phone number (identity)
  "phone": "9876543210",
  "role": "customer|provider|admin",
  "professional_id": "uuid",     // Only for provider role
  "exp": 1735689600             // 30 days from issue
}
```

### 5.3 Authorization Model

| Role | Access Scope |
|------|-------------|
| `customer` | Own profile, addresses, bookings, favourites, notifications, reviews |
| `provider` | Own profile, own bookings (assigned), earnings, payout account |
| `admin` | All data, CRUD on professionals/services/categories, settings |

**Note:** RLS is enabled but wide-open (`USING (true)`). Real access control is in the backend layer.

### 5.4 Known Security Considerations

- OTP is never actually verified against SMS (dev mode: code returned in response)
- Admin password stored in cleartext in `admin_settings`
- JWT has 30-day TTL with no revocation mechanism
- CORS is `allow_origins=["*"]` (no origin allowlist)

---

## 6. Key Features Architecture

### 6.1 Provider Radius-Based Matching

**Goal:** A provider only sees customer requests within their set service radius.

```
Customer books → coordinates captured (GPS or geocoded)
                   ↓
Provider feed loads → Haversine distance computed
                       provider.lat/long vs booking.lat/long
                       ↓
                     IF distance ≤ provider.service_radius_km
                        → Show request
                     ELSE
                        → Hide
```

**Key Points:**
- Backend does NO geo filtering (returns all `confirmed` bookings)
- Frontend filters by radius client-side
- Missing coordinates = "in range" (fail-open)
- Service matching: only providers who offer that exact service see the request

### 6.2 Booking Lifecycle

```
confirmed → assigned → on_the_way → started → completed
                 ↓
             cancelled (customer cancels)
                 ↓
             (decline: booking_declines record, booking stays confirmed)
```

### 6.3 Accept vs Decline

- **Accept** → `status='assigned'`, `professional_id` set → booking vanishes from all provider feeds
- **Decline** → `booking_declines` row inserted → booking stays visible to other providers
- **Decline by assigned provider** → booking returns to open pool

### 6.4 Commission & Earnings

- Platform commission: configurable per category (default 10%)
- `bookings.commission_pct` frozen at booking time
- `bookings.platform_fee` = platform's share
- `bookings.provider_earnings` = provider's share
- Payout flow: provider requests → admin approves → settlement recorded

---

## 7. Deployment Architecture

### 7.1 Frontend Deployment (Vercel)

Three separate Vercel projects, one per role:

```
Project 1: LuckySeva Customer
  Root Directory: frontend/
  Env: VITE_APP_ROLE=customer
       VITE_API_URL=https://api.luckyseva.com
       VITE_SUPABASE_URL=https://xxx.supabase.co
       VITE_SUPABASE_ANON_KEY=xxx

Project 2: LuckySeva Partner
  Root Directory: frontend/
  Env: VITE_APP_ROLE=provider
       ...

Project 3: LuckySeva Admin
  Root Directory: frontend/
  Env: VITE_APP_ROLE=admin
       ...
```

### 7.2 Backend Deployment (Render)

```
Service: LuckySeva API
  Root Directory: backend/
  Build: pip install -r requirements.txt
  Start: uvicorn app.main:app --host 0.0.0.0 --port $PORT
  Env: SUPABASE_URL
       SUPABASE_SERVICE_ROLE_KEY
       SUPABASE_JWT_SECRET
```

### 7.3 Database (Supabase)

- Project on Supabase Cloud
- Migrations applied via `npx supabase db push`
- Service role key never exposed to clients
- RLS enabled on all tables

---

## 8. CI/CD Pipeline

`.github/workflows/ci.yml` runs four parallel jobs:

| Job | Steps |
|-----|-------|
| **Frontend** | npm ci → ESLint → TypeScript → Vitest → Build → npm audit |
| **Backend** | pip install → compileall → Ruff → pytest → pip-audit |
| **Migrations** | Apply all migrations to throwaway Postgres (twice), check for destructive SQL |
| **Edge Functions** | deno fmt → deno lint → deno check → tests → deno audit |

Dependabot runs weekly on: GitHub Actions, npm (frontend/), pip (backend/).

---

## 9. External Dependencies

| Service | Purpose | Limits |
|---------|---------|--------|
| Supabase | Database, Auth, Storage | Project-based |
| Nominatim | Geocoding (OpenStreetMap) | 1 req/sec, no API key |
| FCM | Push Notifications | Firebase project |
| Razorpay | Payment Gateway | API keys required |
| Vercel | Frontend hosting | 3 projects |
| Render | Backend hosting | Free tier available |
