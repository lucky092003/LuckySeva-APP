# LuckySeva — Product Requirements Document (PRD)

**Version:** 1.0
**Last Updated:** October 2026
**Status:** In Development

---

## 1. Product Overview

### 1.1 Product Name & Tagline

**LuckySeva** — *Trusted Services, At Your Doorstep*

### 1.2 Product Summary

LuckySeva is a mobile-first home services marketplace connecting customers with verified local professionals (electricians, plumbers, cleaners, etc.) for on-demand and scheduled home services in India.

### 1.3 Target Users

| Segment | Description |
|---------|-------------|
| **Customers** | Urban Indian households seeking reliable home services |
| **Service Providers (Partners)** | Local professionals (electricians, plumbers, cleaners) looking for customers |
| **Platform Admins** | LuckySeva operations team managing the marketplace |

### 1.4 Target Market

- **Primary:** Urban India (Tier 1, Tier 2 cities)
- **Language:** English (UI), with consideration for Hindi/regional languages
- **Payment:** Indian payment methods (UPI, Cash, Cards, Netbanking)

---

## 2. User Stories & Features

### 2.1 Customer User Stories

#### UC-1: Discover Services
**As a customer, I want to browse available services by category so that I can find what I need.**

Acceptance Criteria:
- [ ] See list of service categories on home screen
- [ ] Each category shows icon, name, and service count
- [ ] Categories are sorted by popularity/order
- [ ] Tapping category shows services in that category

#### UC-2: Find Nearby Professionals
**As a customer, I want to find professionals near my location so that I can get service quickly.**

Acceptance Criteria:
- [ ] See list of verified professionals for selected service
- [ ] Each professional shows: name, rating, reviews count, distance, starting price
- [ ] Distance is computed from customer location to professional
- [ ] Sort by rating or distance

#### UC-3: Book a Service
**As a customer, I want to book a service for a specific date/time so that I can schedule home repairs.**

Acceptance Criteria:
- [ ] Select service → Select professional (or auto-assign) → Select address → Confirm booking
- [ ] See price breakdown: base price, visit fee, discounts
- [ ] Apply coupon codes for discount
- [ ] Receive confirmation notification
- [ ] Booking goes to `confirmed` status

#### UC-4: Track Booking Status
**As a customer, I want to track my booking status so that I know when the professional will arrive.**

Acceptance Criteria:
- [ ] See booking status: Confirmed → Assigned → On the way → Started → Completed
- [ ] See professional details and contact (after acceptance)
- [ ] Receive push notifications on status change
- [ ] See estimated arrival time (if available)

#### UC-5: Manage Addresses
**As a customer, I want to save multiple addresses so that I can book for home or work.**

Acceptance Criteria:
- [ ] Add, edit, delete saved addresses
- [ ] Set default address
- [ ] Use GPS to get current location
- [ ] Address autocomplete (future enhancement)

#### UC-6: Pay for Services
**As a customer, I want to pay via UPI/cash/card so that I can complete transactions easily.**

Acceptance Criteria:
- [ ] Choose payment method: Cash, UPI, Card, Netbanking
- [ ] Pay after service completion (cash) or before (online)
- [ ] See payment status: Pending → Paid → Refunded
- [ ] Receive payment receipt/invoice

#### UC-7: Rate and Review
**As a customer, I want to rate and review professionals so that others can benefit from my experience.**

Acceptance Criteria:
- [ ] Rate service 1-5 stars
- [ ] Add written review/comment
- [ ] Reviews visible on professional's profile

#### UC-8: Get Support
**As a customer, I want to contact support so that I can resolve issues.**

Acceptance Criteria:
- [ ] Submit support ticket with message
- [ ] View ticket status (open/resolved)
- [ ] Receive resolution notification

### 2.2 Provider (Partner) User Stories

#### UP-1: Manage Profile
**As a provider, I want to set up my professional profile so that customers can find me.**

Acceptance Criteria:
- [ ] Set name, phone, email, bio, service area
- [ ] Upload profile photo/avatar
- [ ] Set skills and experience
- [ ] Update location coordinates

#### UP-2: Manage Services
**As a provider, I want to select which services I offer so that I receive relevant requests.**

Acceptance Criteria:
- [ ] See all services in my trade category
- [ ] Toggle services I offer on/off
- [ ] Set custom prices for services (optional)
- [ ] Services selection affects request matching

#### UP-3: Receive Service Requests
**As a provider, I want to receive service requests within my area so that I can accept jobs.**

Acceptance Criteria:
- [ ] See open requests from customers in radius
- [ ] See request details: service, address, scheduled time, price
- [ ] Customer phone hidden until accepted (lead protection)
- [ ] Requests auto-refresh every 15 seconds

#### UP-4: Accept or Decline Requests
**As a provider, I want to accept or decline requests so that I can manage my workload.**

Acceptance Criteria:
- [ ] Accept request → becomes assigned to me
- [ ] Decline request → stays open for other providers
- [ ] Accepting reveals customer phone number
- [ ] Cannot accept after deadline expires

#### UP-5: Update Booking Status
**As a provider, I want to update job status so that customers know I'm on the way/completed.**

Acceptance Criteria:
- [ ] Mark: On the way → Started → Completed
- [ ] Status updates notify customer
- [ ] Completed jobs count toward stats

#### UP-6: View Earnings
**As a provider, I want to see my earnings and request payouts so that I get paid.**

Acceptance Criteria:
- [ ] See total earnings, by-date breakdown
- [ ] See available balance (after commission)
- [ ] Request payout to UPI/bank account
- [ ] View payout history

#### UP-7: KYC Verification
**As a provider, I want to submit KYC documents so that I'm verified on the platform.**

Acceptance Criteria:
- [ ] Submit: Aadhaar, PAN, Voter ID, or Driving License
- [ ] Admin reviews and approves/rejects
- [ ] Verified badge shown on profile (future)

### 2.3 Admin User Stories

#### UA-1: Dashboard Overview
**As an admin, I want to see platform stats so that I can monitor business health.**

Acceptance Criteria:
- [ ] See: Total bookings, customers, providers, revenue
- [ ] See today's bookings and revenue
- [ ] Recent bookings list

#### UA-2: Manage Professionals
**As an admin, I want to add/edit/delete professionals so that I can manage the provider network.**

Acceptance Criteria:
- [ ] View list of all professionals
- [ ] Add new professional manually
- [ ] Edit professional details
- [ ] Delete professional (with confirmation)
- [ ] Review and approve/reject KYC

#### UA-3: Manage Services & Categories
**As an admin, I want to manage the service catalog so that offerings stay current.**

Acceptance Criteria:
- [ ] View all categories and services
- [ ] Add/edit/delete categories
- [ ] Add/edit/delete services
- [ ] Set prices and durations

#### UA-4: View & Manage Bookings
**As an admin, I want to see all bookings so that I can resolve issues.**

Acceptance Criteria:
- [ ] View list of all bookings with status filter
- [ ] See booking details
- [ ] Cancel bookings if needed

#### UA-5: Manage Payouts
**As an admin, I want to approve provider payouts so that providers get paid.**

Acceptance Criteria:
- [ ] See pending payout requests
- [ ] Approve → Mark as paid with reference
- [ ] Reject with note
- [ ] See payout history

#### UA-6: Manage Coupons
**As an admin, I want to create discount coupons so that I can run promotions.**

Acceptance Criteria:
- [ ] Create coupon: code, type (%), value, min amount, limits
- [ ] Set category restrictions
- [ ] Enable/disable coupons
- [ ] View coupon usage

#### UA-7: Platform Settings
**As an admin, I want to configure platform settings so that I can control business parameters.**

Acceptance Criteria:
- [ ] Set default commission percentage
- [ ] Set per-category commission
- [ ] Configure accept deadline (minutes)
- [ ] Set payout minimum amount

#### UA-8: Audit Trail
**As an admin, I want to see audit logs so that I can track changes.**

Acceptance Criteria:
- [ ] View history of admin actions
- [ ] Filter by action type
- [ ] See: who, what, when

---

## 3. Functional Requirements

### 3.1 Core Features

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F-1 | OTP-based Authentication | P0 | Implemented |
| F-2 | Service Catalog Browsing | P0 | Implemented |
| F-3 | Professional Search & Discovery | P0 | Implemented |
| F-4 | Booking Creation & Management | P0 | Implemented |
| F-5 | Provider Radius-Based Matching | P0 | Implemented |
| F-6 | Booking Status Lifecycle | P0 | Implemented |
| F-7 | Payment Recording (Cash/UPI) | P0 | Implemented |
| F-8 | Reviews & Ratings | P1 | Implemented |
| F-9 | Push Notifications | P1 | Implemented |
| F-10 | Provider Earnings & Payouts | P1 | Implemented |
| F-11 | Admin Dashboard | P1 | Implemented |
| F-12 | Coupon/Discount System | P2 | Implemented |
| F-13 | KYC Verification | P2 | Implemented |
| F-14 | Saved Addresses | P1 | Implemented |
| F-15 | Favourites | P2 | Implemented |
| F-16 | Support Tickets | P2 | Implemented |

### 3.2 Future Features

| ID | Feature | Priority |
|----|---------|----------|
| FF-1 | Real Payment Gateway (Razorpay) | P0 |
| FF-2 | In-App Calling | P1 |
| FF-3 | Multi-language Support | P1 |
| FF-4 | Booking Rescheduling | P1 |
| FF-5 | Subscription Plans | P2 |
| FF-6 | Wallet System | P2 |
| FF-7 | Chat/Messaging | P2 |
| FF-8 | Calendar Integration | P2 |
| FF-9 | Service Warranty | P3 |
| FF-10 | Insurance Integration | P3 |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target |
|--------|--------|
| API Response Time (p95) | < 500ms |
| Page Load Time | < 3s on 3G |
| Feed Refresh | < 2s |
| Booking Confirmation | < 1s |

### 4.2 Scalability

- Support 10,000+ concurrent users
- Handle 1,000+ concurrent booking requests
- Database designed for 100K+ professionals

### 4.3 Availability

- Target: 99.5% uptime
- Maintenance windows: Off-peak hours only
- Graceful degradation for non-critical features

### 4.4 Security

- All API calls over HTTPS
- JWT tokens with 30-day expiry
- No sensitive data in URLs or logs
- Admin credentials secured
- RLS enabled on all tables

### 4.5 Mobile Support

- Android 8.0+ (API 26)
- iOS 12.0+
- Responsive web (mobile-first)

---

## 5. Data Requirements

### 5.1 Data Retention

| Data Type | Retention Period |
|-----------|-----------------|
| User Profiles | Until account deletion |
| Bookings | 7 years (legal requirement) |
| Payment Records | 7 years |
| Reviews | Permanent |
| Audit Logs | 2 years |

### 5.2 Data Privacy

- Phone numbers stored for login only
- No third-party data sharing
- KYC documents not stored on platform servers
- Location data used only for matching

---

## 6. User Interface Requirements

### 6.1 Design System

| Element | Specification |
|---------|---------------|
| **Framework** | React 18 + TypeScript |
| **Styling** | Tailwind CSS 4 |
| **Icons** | Lucide React |
| **Phone Mockup** | Custom shell for demo |
| **Colors** | Emerald (primary), Orange (accent), Gray (neutral) |

### 6.2 Responsive Breakpoints

| Breakpoint | Target |
|------------|--------|
| Mobile (< 640px) | Native app-like experience |
| Tablet (640-1024px) | Responsive web |
| Desktop (> 1024px) | Full web experience |

### 6.3 Accessibility

- Minimum touch target: 44x44px
- Color contrast: WCAG AA
- Screen reader support (future)

---

## 7. API Requirements

### 7.1 API Style

- RESTful JSON API
- No pagination (hard limits on lists)
- No global envelope (`{"data": ...}`)
- Standard HTTP status codes

### 7.2 Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `/auth/request-otp` | 1 per 30 seconds |
| `/auth/verify-otp` | 10 per minute |
| Other endpoints | No limit (future) |

### 7.3 Versioning

- Current version: v1 (implicit)
- Future: `/api/v1/` prefix

---

## 8. Business Rules

### 8.1 Commission

- Default platform commission: **10%** of booking total
- Per-category commission override supported
- Commission frozen at booking time

### 8.2 Pricing

- Service prices set per category (market rates)
- Visit fee: Configurable (currently client-supplied)
- Priority fee: ₹99 for top-N recommended professionals

### 8.3 Accept Window

- Default: 300 minutes (5 hours) from booking creation
- Configurable via `accept_deadline_minutes` setting
- Expired requests removed from provider feeds

### 8.4 Payout Rules

- Minimum payout amount: ₹500
- Payout methods: UPI, Bank Transfer
- Settlement: Manual (admin approval required)

### 8.5 Cancellation

- Customer can cancel before `started` status
- No cancellation after professional starts job
- Refund policy: Platform decides case-by-case

---

## 9. Success Metrics

### 9.1 Key Performance Indicators (KPIs)

| Metric | Target (Month 6) |
|--------|------------------|
| Monthly Active Customers | 10,000 |
| Monthly Active Providers | 2,000 |
| Monthly Bookings | 25,000 |
| GMV (Gross Merchandise Value) | ₹5,000,000 |
| Platform Revenue | ₹500,000 |
| Customer Retention Rate | 40% |
| Provider Retention Rate | 70% |
| Average Rating | 4.0+ |

### 9.2 Quality Metrics

| Metric | Target |
|--------|--------|
| Booking Completion Rate | > 90% |
| Provider Acceptance Rate | > 70% |
| Customer NPS | > 40 |
| API Uptime | > 99.5% |
| Avg. Booking to Completion Time | < 24 hours |

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **GMV** | Gross Merchandise Value — total booking value before commission |
| **Platform Fee** | LuckySeva's cut (commission) from each booking |
| **Provider Earnings** | Amount paid to service professional |
| **Open Request** | Booking with `professional_id=NULL` visible to providers in radius |
| **Auto-assign** | When customer doesn't pick a professional, system assigns nearest available |
| **Radius Matching** | Algorithm showing providers only requests within their service radius |
| **KYC** | Know Your Customer — identity verification documents |
| **RLS** | Row Level Security — PostgreSQL feature (enabled but bypassed by service role) |
| **Lead Protection** | Hiding customer phone until provider accepts the job |

---

## 11. Appendix

### 11.1 Service Categories

1. Electrician
2. Plumber
3. AC Repair
4. Cleaning
5. Carpenter
6. Painting
7. Appliance Repair
8. Beauty & Salon
9. Pest Control
10. Physiotherapy
11. Packers & Movers
12. CCTV & Security
13. Laundry & Dry Cleaning
14. Lawn & Garden
15. Other Services

### 11.2 Booking Status Flow

```
confirmed ──────► assigned ──────► on_the_way ──────► started ──────► completed
    │                 │                                                       │
    │                 └──────────────────────► cancelled ◄────────────────────┘
    │
    └────► (expires after accept_deadline, removed from feed)
```

### 11.3 Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Oct 2026 | LuckySeva Team | Initial PRD |
