# LuckySeva — Roadmap & TODO

**Last Updated:** October 2026
**Status:** Active Development

---

## 1. Product Roadmap

### Q4 2026 — Launch & Growth

| Item | Description | Status | Priority |
|------|-------------|--------|----------|
| R-01 | Soft Launch (beta users) | Done | P0 |
| R-02 | Production deployment | Done | P0 |
| R-03 | Mobile apps (Android Play Store) | In Progress | P0 |
| R-04 | Mobile apps (iOS App Store) | Pending | P0 |
| R-05 | Real SMS OTP integration | Planned | P0 |
| R-06 | Razorpay payment gateway | Planned | P0 |

### Q1 2027 — Engagement & Trust

| Item | Description | Status | Priority |
|------|-------------|--------|----------|
| R-07 | Provider KYC verification flow | Done | P1 |
| R-08 | Verified provider badges | Planned | P1 |
| R-09 | Push notification improvements | Planned | P1 |
| R-10 | In-app voice call to provider | Planned | P1 |
| R-11 | Booking rescheduling | Planned | P2 |

### Q2 2027 — Scale & Monetization

| Item | Description | Status | Priority |
|------|-------------|--------|----------|
| R-12 | Wallet system | Planned | P2 |
| R-13 | Subscription plans (priority access) | Planned | P2 |
| R-14 | Multi-language support (Hindi) | Planned | P2 |
| R-15 | Chat/messaging with provider | Planned | P2 |
| R-16 | Service warranties | Planned | P3 |

### Q3 2027 — Expansion

| Item | Description | Status | Priority |
|------|-------------|--------|----------|
| R-17 | New cities (Tier 2 expansion) | Planned | P1 |
| R-18 | More service categories | Planned | P1 |
| R-19 | Corporate/enterprise bookings | Planned | P2 |
| R-20 | Provider insurance | Planned | P3 |

---

## 2. Technical Roadmap

### Infrastructure

| Item | Description | Status | Ticket |
|------|-------------|--------|--------|
| T-01 | CI/CD pipeline (GitHub Actions) | Done | - |
| T-02 | Database migrations automation | Done | - |
| T-03 | PR review bot (Deno Edge Function) | Done | - |
| T-04 | Automatic changelog generation | Done | - |
| T-05 | Rate limiting middleware | Planned | - |
| T-06 | Redis caching layer | Planned | - |
| T-07 | API versioning strategy | Planned | - |
| T-08 | Database read replicas | Planned | - |

### Security

| Item | Description | Status | Ticket |
|------|-------------|--------|--------|
| S-01 | SMS OTP provider integration | Planned | - |
| S-02 | JWT refresh tokens | Planned | - |
| S-03 | Hash admin passwords (bcrypt) | Planned | - |
| S-04 | CORS origin allowlist | Planned | - |
| S-05 | API rate limiting | Planned | - |
| S-06 | Security headers (CSP, HSTS) | Planned | - |
| S-07 | Penetration testing | Planned | - |

### Performance

| Item | Description | Status | Ticket |
|------|-------------|--------|--------|
| P-01 | Frontend bundle optimization | Done | - |
| P-02 | Database query optimization | Planned | - |
| P-03 | Image optimization/CDN | Planned | - |
| P-04 | API response caching | Planned | - |
| P-05 | Lighthouse score > 90 | Planned | - |

---

## 3. Known Bugs & Tech Debt

### High Priority

| ID | Issue | Description | Status |
|----|-------|-------------|--------|
| B-01 | Provider booking IDOR | `GET /provider/bookings/{id}` has no ownership check | Open |
| B-02 | My Reviews broken | `customer_name` filter on phone doesn't match named reviews | Open |
| B-03 | Dashboard earnings mismatch | `today_earnings` uses `created_at` not `scheduled_date` | Open |
| B-04 | Total amount = 0 bug | Explicit `total_amount: 0` becomes `base + visit_fee` | Open |

### Medium Priority

| ID | Issue | Description | Status |
|----|-------|-------------|--------|
| B-05 | Admin password cleartext | Stored in plain text in `admin_settings` | Open |
| B-06 | OTP never expires | No real SMS verification | Open |
| B-07 | No JWT revocation | 30-day tokens cannot be invalidated | Open |
| B-08 | Invoice amount mismatch | Discounted booking shows higher invoice | Open |

### Low Priority

| ID | Issue | Description | Status |
|----|-------|-------------|--------|
| B-09 | INDIAN_STATES stale | Has both merged and pre-merger UT names | Open |
| B-10 | CORS too permissive | `allow_origins=["*"]` | Open |
| B-11 | Backend category_for gap | Missing `physiotherapy` pattern | Open |
| B-12 | Dead code: `bearer()` | Nothing imports `dependencies.bearer()` | Open |

### Tech Debt

| ID | Item | Description | Status |
|----|------|-------------|--------|
| TD-01 | No Pydantic | Hand-rolled validation everywhere | Open |
| TD-02 | No pagination | Hard limits instead of proper pagination | Open |
| TD-03 | No integration tests | Frontend tests only for utils | Open |
| TD-04 | Unused dep: @supabase/supabase-js | In package.json but never imported | Open |
| TD-05 | Stale VITE_PHONE_MOCKUP doc | Comment says one thing, code another | Open |

---

## 4. Testing Roadmap

### Unit Tests

| Area | Current | Target |
|------|---------|--------|
| Frontend utils | 2 files | All utility files |
| Frontend hooks | 0 | Core hooks |
| Frontend components | 0 | Key components |
| Backend routes | 14 tests | All routes |
| Backend business logic | 0 | Pricing, ledger, etc. |

### Integration Tests

| Area | Status |
|------|--------|
| API end-to-end | None |
| Booking flow | Manual |
| Payment flow | Manual |
| Auth flow | Manual |

### E2E Tests

| Area | Status |
|------|--------|
| Customer journey | None |
| Provider journey | None |
| Admin operations | None |

---

## 5. Documentation Roadmap

| Item | Status | Notes |
|------|--------|-------|
| README.md | Done | Setup, deploy, tech stack |
| FEATURES.md | Done | Detailed feature docs |
| brain.md | Done | Agent context, gotchas |
| ARCHITECTURE.md | Done | System architecture |
| API.md | Done | API reference |
| DATABASE.md | Done | Schema documentation |
| SECURITY.md | Done | Auth & security |
| DEPLOYMENT.md | Done | Deployment guide |
| PRD.md | Done | Product requirements |
| ROADMAP.md | Done | This file |
| DECISIONS.md | Done | Architecture decision log |
| CLAUDE.md | Pending | AI tool context |

---

## 6. Quick Wins (Good First Issues)

These items are small but valuable:

| ID | Item | Effort | Impact |
|----|------|--------|--------|
| QW-01 | Remove dead `bearer()` function | 5 min | Cleanup |
| QW-02 | Add `professional_id` check to `GET /provider/bookings/{id}` | 10 min | Security |
| QW-03 | Fix `today_earnings` date filter | 10 min | Correctness |
| QW-04 | Update INDIAN_STATES | 15 min | Data quality |
| QW-05 | Add more unit tests | 30 min | Quality |
| QW-06 | Add rate limiting to OTP endpoint | 1 hour | Security |
| QW-07 | Fix CORS configuration | 30 min | Security |

---

## 7. Backlog (Unprioritized)

### Features
- Real payment gateway (Razorpay)
- In-app calling
- Chat/messaging
- Booking rescheduling
- Multi-language (Hindi)
- Wallet system
- Subscriptions
- Service warranties
- Corporate bookings
- Provider insurance

### Technical
- Pydantic models for validation
- Proper pagination
- Redis caching
- Database read replicas
- API versioning
- Integration tests
- E2E tests
- Penetration testing
- CSP/HSTS headers

### UX Improvements
- Loading skeletons
- Pull-to-refresh
- Swipe gestures
- Offline support
- Image compression
- Search autocomplete
- Recent searches
- Service package bundles

---

## 8. Milestones

### v1.0 — Beta Launch (Done)
- [x] OTP authentication
- [x] Service catalog
- [x] Booking flow
- [x] Provider matching
- [x] Basic payments (cash)
- [x] Reviews
- [x] Admin dashboard

### v1.1 — Trust & Safety (Next)
- [ ] SMS OTP integration
- [ ] Payment gateway
- [ ] KYC verification badges
- [ ] Rate limiting

### v1.2 — Mobile Launch
- [ ] Android app (Play Store)
- [ ] iOS app (App Store)
- [ ] Push notifications

### v2.0 — Scale
- [ ] Multi-city
- [ ] Hindi support
- [ ] Wallet
- [ ] Subscriptions
