-- CartY Initial Database Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query)

-- ==================== USERS ====================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  country TEXT DEFAULT 'NG',
  state TEXT DEFAULT '',
  is_phone_verified BOOLEAN DEFAULT FALSE,
  push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== OTP CODES ====================

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,  -- 'verify_phone' | 'forgot_password'
  used BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '10 minutes')
);

-- Patch existing tables with missing columns:
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'NG';

-- If otp_codes already exists without the 'used' column, add it:
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT FALSE NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone);

-- ==================== STORES ====================

CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  whatsapp_number TEXT,
  email TEXT,
  logo TEXT,
  -- Subscription
  subscription_status TEXT DEFAULT 'inactive',  -- 'active' | 'inactive'
  subscription_expires_at TIMESTAMPTZ,
  -- Wallet
  wallet_balance FLOAT DEFAULT 0,
  pending_balance FLOAT DEFAULT 0,
  total_earnings FLOAT DEFAULT 0,
  -- Bank details
  bank_code TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_recipient_code TEXT,
  -- Ad account connections
  meta_access_token TEXT,
  meta_ad_account_id TEXT,
  tiktok_access_token TEXT,
  tiktok_advertiser_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);

-- ==================== PRODUCTS ====================

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price FLOAT NOT NULL DEFAULT 0,
  image TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);

-- ==================== ORDERS ====================

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  buyer_address TEXT NOT NULL,
  buyer_note TEXT DEFAULT '',
  total_amount FLOAT NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending',  -- 'pending' | 'paid' | 'completed' | 'cancelled'
  payment_reference TEXT,
  cart_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);

-- ==================== WITHDRAWALS ====================

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  amount FLOAT NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending' | 'success' | 'failed'
  transfer_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_store_id ON withdrawals(store_id);

-- ==================== PENDING SUBSCRIPTIONS ====================

CREATE TABLE IF NOT EXISTS pending_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  reference TEXT UNIQUE NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== AD CAMPAIGNS ====================

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,       -- 'meta' | 'tiktok'
  objective TEXT NOT NULL,      -- 'traffic' | 'awareness' | 'sales'
  status TEXT DEFAULT 'draft',  -- 'draft' | 'launching' | 'active' | 'completed' | 'failed'
  budget_ngn FLOAT NOT NULL DEFAULT 0,
  actual_budget_ngn FLOAT,
  platform_campaign_id TEXT,
  ad_headline TEXT,
  ad_description TEXT,
  ad_image TEXT,
  target_age_min INT DEFAULT 18,
  target_age_max INT DEFAULT 55,
  target_gender TEXT DEFAULT 'all',   -- 'all' | 'male' | 'female'
  target_locations TEXT[] DEFAULT '{}',
  start_date DATE,
  end_date DATE,
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_store_id ON ad_campaigns(store_id);

-- ==================== AD ANALYTICS ====================

CREATE TABLE IF NOT EXISTS ad_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  reach INT DEFAULT 0,
  spend_ngn FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_analytics_campaign_id ON ad_analytics(campaign_id);

-- ==================== APP CONFIG ====================
-- Used for version management and app-wide configuration

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial app config
INSERT INTO app_config (key, value) VALUES
  ('current_version', '1.0.0'),
  ('min_version', '1.0.0'),
  ('android_download_url', 'https://github.com/Gohskoh0/CartY/releases/latest'),
  ('ios_download_url', ''),
  ('release_notes', 'Initial release of CartY — mobile commerce for African vendors.')
ON CONFLICT (key) DO NOTHING;
