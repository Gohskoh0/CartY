# CartY Admin Dashboard

A comprehensive Next.js admin dashboard for monitoring the CartY mobile commerce platform.

## Features

- **Overview** — Live stats, GMV trend, user growth, order volume, activity feed
- **Users** — All registered users with verification status, country, push-notification enrollment
- **Stores** — All stores with subscription status, wallet balances, ad account connections
- **Orders** — Full order history across all stores with status filters
- **Revenue** — GMV, subscription revenue, withdrawal tracking, top earners chart
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
SUPABASE_URL=https://uzldiienmprkvaqlywia.supabase.co
SUPABASE_SERVICE_KEY=<your-service-role-key>
ADMIN_PASSWORD=choose-a-strong-password
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
Set the same 4 env vars in the Vercel dashboard.

## Version Control Workflow

To push an app update to users:
1. Open the dashboard → **App Config**
2. Update `current_version` to the new version (e.g. `1.1.0`)
3. To make it **optional**: leave `min_version` at the old version
4. To make it **required/blocking**: set `min_version` equal to `current_version`
5. Update the Android/iOS download URL and release notes
6. Click **Save Configuration** — takes effect immediately, no redeployment needed
