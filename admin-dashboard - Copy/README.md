# CartY Admin Dashboard Web App

A standalone Next.js web app for monitoring and operating the CartY mobile commerce platform. You can copy this `admin-dashboard/` folder into its own GitHub repository and deploy it separately from the mobile app/backend.

## Features

- **Overview** — Live stats, GMV trend, user growth, order volume, activity feed
- **Users** — All registered users with verification status, country, push-notification enrollment
- **Stores** — All stores with subscription status, wallet balances, ad account connections
- **Orders** — Full order history across all stores with status filters
- **Revenue** — Monthly, quarterly, yearly app revenue estimates, GMV/sales, wallet balances, withdrawal tracking, top earners chart
- **Activity** — Store activity, seller activity, seller wallet balances, withdrawals requested/completed, and recent platform events
- **Subscriptions** — Active/inactive breakdown, expiry alerts, MRR/ARR estimates
- **Ad Campaigns** — All Meta + TikTok campaigns with platform and status breakdowns
- **App Config** — Edit `current_version`, `min_version`, download URLs, release notes in real-time with a live dialog preview

## Tech Stack

- Next.js 14 (App Router, Server Components)
- TypeScript + Tailwind CSS
- Framer Motion (animations)
- Recharts (charts)
- Supabase JS (data)
- JWT session cookies (auth)

## Setup

### 1. Install dependencies
```bash
cd admin-dashboard
npm install
```

### 2. Create `.env.local`
```bash
cp .env.local.example .env.local
```
Fill in:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=<your-service-role-key>
ADMIN_USERNAME=Robust_dev
ADMIN_PASSWORD=#Hack.me1223#
SUBSCRIPTION_PRICE_NGN=7500
ADS_MARGIN_PERCENT=15
JWT_SECRET=any-random-32-char-string
```

### 3. Run Supabase schema
In Supabase Dashboard → SQL Editor, run `../supabase/migrations/001_initial_schema.sql`

### 4. Start development server
```bash
npm run dev
# Opens on http://localhost:3001
```

### 5. Deploy (optional — Vercel recommended)
```bash
npx vercel --prod
```
Set the production env vars in your hosting provider dashboard.

Required production env vars:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `JWT_SECRET`

Optional reporting env vars:
- `SUBSCRIPTION_PRICE_NGN`
- `ADS_MARGIN_PERCENT`

## Version Control Workflow

To push an app update to users:
1. Open the dashboard → **App Config**
2. Update `current_version` to the new version (e.g. `1.1.0`)
3. To make it **optional**: leave `min_version` at the old version
4. To make it **required/blocking**: set `min_version` equal to `current_version`
5. Update the Android/iOS download URL and release notes
6. Click **Save Configuration** — takes effect immediately, no redeployment needed
