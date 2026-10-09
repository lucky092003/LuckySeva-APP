# LuckySeva — Deployment Documentation

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐    │
│  │ Customer Site    │  │  Partner Site    │  │   Admin Dashboard     │    │
│  │ luckyseva.com    │  │  partner.lucky.. │  │   admin.luckyseva.com  │    │
│  │ VITE_APP_ROLE=   │  │  VITE_APP_ROLE=  │  │   VITE_APP_ROLE=      │    │
│  │   customer       │  │    provider      │  │     admin             │    │
│  └────────┬─────────┘  └────────┬─────────┘  └───────────┬────────────┘    │
└───────────┼─────────────────────┼─────────────────────────┼──────────────────┘
            │                     │                         │
            │ HTTPS/REST          │                         │
            ▼                     ▼                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           RENDER (FastAPI)                                    │
│                         api.luckyseva.com                                    │
│                              │                                                │
│                              ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    SUPABASE CLOUD                                     │   │
│  │  PostgreSQL 15+  │  PostgREST  │  Edge Functions (Deno)             │   │
│  │  Service Role Key │             │  PR Review Bot                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites

### 2.1 Required Accounts

| Service | Required For | Signup |
|---------|-------------|--------|
| **Supabase** | Database | https://supabase.com |
| **Vercel** | Frontend hosting | https://vercel.com |
| **Render** | Backend hosting | https://render.com |
| **GitHub** | CI/CD, repo | https://github.com |

### 2.2 Local Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | v18+ (v20 recommended) | Frontend build |
| **Python** | 3.11+ | Backend development |
| **npm** | Latest | Package management |
| **Git** | Latest | Version control |

### 2.3 Optional (for native apps)

| Tool | Purpose |
|------|---------|
| **Android Studio** | Android app build |
| **Xcode** (macOS only) | iOS app build |
| **Capacitor** | Native wrapper CLI |

---

## 3. Supabase Setup

### 3.1 Create Project

1. Go to https://app.supabase.com and create a new project
2. Note down:
   - **Project URL:** `https://xxxxxxxxxxxx.supabase.co`
   - **API Settings → Service Role Key:** `eyJ...` (keep secret)
   - **API Settings → JWT Secret:** (used for `SUPABASE_JWT_SECRET`)

### 3.2 Apply Migrations

```bash
cd backend

# Install Supabase CLI
npm install -g supabase

# Link your project
npx supabase link --project-ref <project-ref>

# Push migrations
npx supabase db push
```

**Alternative: Manual SQL**

Paste each file from `backend/supabase/migrations/` into Supabase SQL Editor in order.

### 3.3 Verify Setup

```bash
# Check tables exist
npx supabase db execute --project-ref <ref> "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

---

## 4. Backend Deployment (Render)

### 4.1 Create Web Service

1. Log in to https://render.com
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Configure:

| Setting | Value |
|---------|-------|
| **Root Directory** | `backend` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Plan** | Free tier available |

### 4.2 Environment Variables

Add these in Render dashboard under **Environment**:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (from Supabase) |
| `SUPABASE_JWT_SECRET` | `xxxxx` (from Supabase API Settings) |
| `ENV` | `production` |
| `API_DOCS_ENABLED` | `false` |

### 4.3 Get Backend URL

After deploy, note your service URL: `https://luckyseva-app-xxxx.onrender.com`

---

## 5. Frontend Deployment (Vercel)

### 5.1 Create Three Projects

Create separate Vercel projects for each role:

**Project 1: Customer**
| Setting | Value |
|---------|-------|
| **Git Repo** | Your repo |
| **Root Directory** | `frontend` |
| **Framework** | Vite |
| **Build Command** | `npm run build` |

**Environment Variables:**
```
VITE_APP_ROLE=customer
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=https://luckyseva-app-xxxx.onrender.com
```

**Project 2: Partner**
Same config, but:
```
VITE_APP_ROLE=provider
```

**Project 3: Admin**
Same config, but:
```
VITE_APP_ROLE=admin
```

### 5.2 Vercel Configuration

**File:** `frontend/vercel.json` (already configured)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci --include=dev",
  "framework": "vite"
}
```

### 5.3 Custom Domains (Optional)

1. In Vercel project settings → **Domains**
2. Add `customer.luckyseva.com`, `partner.luckyseva.com`, `admin.luckyseva.com`
3. Configure DNS CNAME records

---

## 6. Native Mobile Apps

### 6.1 Build Process

```bash
cd frontend

# Set role and build
export VITE_APP_ROLE=customer   # or "provider"
npm run build
npx cap sync
```

### 6.2 Android

1. Open `android/` in Android Studio
2. Set signing config (for release)
3. Build → Generate Signed APK/Bundle
4. Upload to Google Play Console

### 6.3 iOS (macOS only)

1. Open `ios/App/App.xcworkspace` in Xcode
2. Set Team in Signing & Capabilities
3. Build → Archive → Distribute
4. Upload to App Store Connect

### 6.4 Capacitor Configuration

**File:** `frontend/capacitor.config.ts`

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: process.env.VITE_APP_ROLE === 'provider'
    ? 'com.luckyseva.partner'
    : 'com.luckyseva.app',
  appName: process.env.VITE_APP_ROLE === 'provider'
    ? 'LuckySeva Partner'
    : 'LuckySeva',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

---

## 7. CI/CD Pipeline

### 7.1 GitHub Actions Workflow

**File:** `.github/workflows/ci.yml`

Runs on every push/PR to `master`:

| Job | Steps |
|-----|-------|
| **Frontend** | npm ci → ESLint → TypeScript → Vitest → Build → npm audit |
| **Backend** | pip install → compileall → Ruff → pytest → pip-audit |
| **Migrations** | Apply all migrations to Postgres (twice) → Check for destructive SQL |
| **Edge Functions** | deno fmt → lint → check → tests |

### 7.2 Dependabot

Weekly dependency updates for:
- GitHub Actions (`/.github/workflows/`)
- npm (`/frontend/package.json`)
- pip (`/backend/requirements.txt`)

### 7.3 Branch Protection

- All changes go through PRs to `master`
- CI must pass before merge
- Direct pushes to `master` are forbidden (convention)

---

## 8. Environment Variables Reference

### 8.1 Backend (`backend/.env`)

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # Keep secret
SUPABASE_JWT_SECRET=xxxxx              # From Supabase API Settings

# Optional
ENV=production                          # Enables production mode
API_DOCS_ENABLED=false                  # Disable /docs in production
OTP_DEBUG=false                         # Set true for dev mode (returns OTP in response)
```

### 8.2 Frontend (`frontend/.env`)

```bash
# Supabase
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...          # Public key, safe to expose

# API
VITE_API_URL=http://localhost:8000     # Development
VITE_API_URL=https://api.luckyseva.com  # Production

# Build-time
VITE_APP_ROLE=customer                  # customer | provider | admin
```

---

## 9. Deployment Checklist

### 9.1 Pre-Deployment

- [ ] All migrations applied to Supabase
- [ ] Supabase service role key secured
- [ ] Environment variables configured
- [ ] Custom domains configured (optional)
- [ ] SSL certificates active (automatic on Vercel/Render)

### 9.2 Post-Deployment

- [ ] `GET /health` returns `{"ok": true}` on production API
- [ ] Customer site loads at Vercel URL
- [ ] Provider site loads at Vercel URL
- [ ] Admin dashboard loads at Vercel URL
- [ ] OTP flow works end-to-end
- [ ] Booking flow completes successfully
- [ ] Push notifications work (if configured)

### 9.3 Mobile App Checklist

- [ ] Android APK builds successfully
- [ ] Android signed bundle uploaded to Play Console
- [ ] iOS builds successfully (macOS)
- [ ] iOS app submitted to App Store
- [ ] App signing certificates renewed before expiry

---

## 10. Rollback Procedures

### 10.1 Backend Rollback

1. Go to Render dashboard → Your service
2. Click **Deploys** → find last working deployment
3. Click **Redeploy**

### 10.2 Frontend Rollback

1. Go to Vercel dashboard → Your project
2. Click **Deployments** → find last working deployment
3. Click **...** → **Promote to Production**

### 10.3 Database Rollback

**Not recommended.** Migrations should be additive only.

If critical: Use Supabase dashboard to manually revert table changes, or restore from Supabase backup.

---

## 11. Monitoring & Logging

### 11.1 Backend Logs

Render provides logs in dashboard. For production:

```bash
# SSH to Render container
render logs --service <service-name>

# Stream logs
render logs --follow --service <service-name>
```

### 11.2 Supabase Logs

- **Database logs:** Supabase Dashboard → Database → Logs
- **API logs:** Supabase Dashboard → API → Logs

### 11.3 Uptime Monitoring

Set up external monitoring (e.g., UptimeRobot) to check:
- `https://api.luckyseva.com/health`
- `https://customer.luckyseva.com`

---

## 12. Performance Optimization

### 12.1 Frontend

- Vercel Edge Network serves static assets globally
- Images: Use WebP format, lazy loading
- Code splitting: Already handled by Vite
- Bundle analysis: `npm run build -- --mode analyze`

### 12.2 Backend

- Enable Render's auto-scaling (paid plans)
- Add caching layer (Redis) if needed
- Database query optimization via Supabase dashboard

### 12.3 Database

- Supabase provides connection pooling
- Add indexes for slow queries (check via Supabase Analytics)
- Enable Row Level Security properly

---

## 13. Backup & Recovery

### 13.1 Supabase Backups

Supabase Cloud provides:
- Daily automated backups (retained 7 days)
- Point-in-time recovery (PITR) on Pro plan
- Manual export via pg_dump

### 13.2 Manual Backup

```bash
# Export entire database
pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres \
  -f backup.sql --no-owner --no-acl

# Export specific tables
pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres \
  -t bookings -t reviews -f data.sql
```

### 13.3 Restore

```bash
psql -h db.xxxxx.supabase.co -U postgres -d postgres -f backup.sql
```

---

## 14. Troubleshooting

### 14.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `vite: command not found` | Missing dev dependencies | `npm ci --include=dev` |
| CORS errors in production | Wrong API_URL | Check `VITE_API_URL` has no trailing slash |
| 404 on API routes | Wrong port | Ensure `uvicorn` runs on `$PORT` |
| Migrations fail | Schema conflicts | Check if tables already exist |
| RLS blocks queries | Expected behavior | All access through backend service role |

### 14.2 Debug Mode

Set `OTP_DEBUG=true` in backend to see OTP codes in responses instead of sending SMS.

### 14.3 Health Check Failures

```bash
# Test locally
curl http://localhost:8000/health

# Test production
curl https://api.luckyseva.com/health
```

---

## 15. Security Hardening

Before production launch:

- [ ] Change admin password from default `admin123`
- [ ] Set `ENV=production`
- [ ] Set `API_DOCS_ENABLED=false`
- [ ] Enable CORS restriction (specific origins, not `*`)
- [ ] Set up API rate limiting
- [ ] Configure SSL/TLS (automatic on Vercel/Render)
- [ ] Enable database encryption (Supabase default)
- [ ] Set up proper logging & alerts
