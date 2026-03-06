import { supabase } from './supabase';
import { startOfMonth, subMonths, format } from 'date-fns';

// ── Overview stats ──────────────────────────────────────────────────────────

export async function getOverviewStats() {
  const [usersRes, storesRes, ordersRes, activeSubsRes, adRes, withdrawRes] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('stores').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id, total_amount, status', { count: 'exact' }),
    supabase.from('stores').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    supabase.from('ad_campaigns').select('id', { count: 'exact', head: true }),
    supabase.from('withdrawals').select('amount').eq('status', 'success'),
  ]);

  const orders = ordersRes.data ?? [];
  const gmv = orders.filter(o => o.status === 'paid').reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const totalWithdrawn = (withdrawRes.data ?? []).reduce((s, w) => s + (w.amount ?? 0), 0);
  const subscriptionRevenue = (activeSubsRes.count ?? 0) * 7500;

  return {
    totalUsers: usersRes.count ?? 0,
    totalStores: storesRes.count ?? 0,
    totalOrders: ordersRes.count ?? 0,
    activeSubscriptions: activeSubsRes.count ?? 0,
    totalAdCampaigns: adRes.count ?? 0,
    gmv,
    subscriptionRevenue,
    totalWithdrawn,
  };
}

// ── Monthly orders/revenue trend (last 12 months) ──────────────────────────

export async function getMonthlyTrend() {
  const since = subMonths(new Date(), 11);
  const { data } = await supabase
    .from('orders')
    .select('total_amount, status, created_at')
    .gte('created_at', since.toISOString());

  const months: Record<string, { month: string; orders: number; revenue: number }> = {};
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const key = format(d, 'yyyy-MM');
    months[key] = { month: format(d, 'MMM yy'), orders: 0, revenue: 0 };
  }

  for (const o of data ?? []) {
    const key = format(new Date(o.created_at), 'yyyy-MM');
    if (months[key]) {
      months[key].orders += 1;
      if (o.status === 'paid') months[key].revenue += o.total_amount ?? 0;
    }
  }
  return Object.values(months);
}

// ── Monthly user signups ────────────────────────────────────────────────────

export async function getUserGrowth() {
  const since = subMonths(new Date(), 11);
  const { data } = await supabase.from('users').select('created_at').gte('created_at', since.toISOString());

  const months: Record<string, { month: string; users: number }> = {};
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const key = format(d, 'yyyy-MM');
    months[key] = { month: format(d, 'MMM yy'), users: 0 };
  }

  for (const u of data ?? []) {
    const key = format(new Date(u.created_at), 'yyyy-MM');
    if (months[key]) months[key].users += 1;
  }
  return Object.values(months);
}

// ── Recent orders (last 10) ──────────────────────────────────────────────────

export async function getRecentOrders(limit = 10) {
  const { data } = await supabase
    .from('orders')
    .select('id, buyer_name, total_amount, status, created_at, store_id, stores(name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ── All users ────────────────────────────────────────────────────────────────

export async function getAllUsers(page = 0, pageSize = 50, search = '') {
  let q = supabase
    .from('users')
    .select('id, phone, country, state, is_phone_verified, push_token, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (search) q = q.ilike('phone', `%${search}%`);
  const { data, count } = await q;
  return { data: data ?? [], count: count ?? 0 };
}

// ── All stores ───────────────────────────────────────────────────────────────

export async function getAllStores() {
  const { data } = await supabase
    .from('stores')
    .select(`
      id, name, slug, email, whatsapp_number,
      subscription_status, subscription_expires_at,
      wallet_balance, pending_balance, total_earnings,
      bank_name, bank_account_number,
      meta_ad_account_id, tiktok_advertiser_id,
      created_at,
      users(phone, country)
    `)
    .order('created_at', { ascending: false });
  return data ?? [];
}

// ── All orders ───────────────────────────────────────────────────────────────

export async function getAllOrders(page = 0, pageSize = 50, status = '') {
  let q = supabase
    .from('orders')
    .select(`id, buyer_name, buyer_phone, total_amount, status, created_at, stores(name, slug)`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (status) q = q.eq('status', status);
  const { data, count } = await q;
  return { data: data ?? [], count: count ?? 0 };
}

// ── Revenue breakdown ────────────────────────────────────────────────────────

export async function getRevenueData() {
  const [ordersRes, withdrawalsRes, storeWallets] = await Promise.all([
    supabase.from('orders').select('total_amount, status, created_at').eq('status', 'paid'),
    supabase.from('withdrawals').select('amount, status, created_at'),
    supabase.from('stores').select('name, total_earnings, wallet_balance').order('total_earnings', { ascending: false }).limit(10),
  ]);

  const orders = ordersRes.data ?? [];
  const withdrawals = withdrawalsRes.data ?? [];

  const gmv = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const totalWithdrawn = withdrawals.filter(w => w.status === 'success').reduce((s, w) => s + (w.amount ?? 0), 0);
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + (w.amount ?? 0), 0);

  // By month
  const byMonth: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const key = format(subMonths(new Date(), i), 'MMM yy');
    byMonth[key] = 0;
  }
  for (const o of orders) {
    const key = format(new Date(o.created_at), 'MMM yy');
    if (key in byMonth) byMonth[key] += o.total_amount ?? 0;
  }
  const monthlyRevenue = Object.entries(byMonth).map(([month, revenue]) => ({ month, revenue }));

  return {
    gmv,
    totalWithdrawn,
    pendingWithdrawals,
    monthlyRevenue,
    topStores: storeWallets.data ?? [],
  };
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export async function getSubscriptionData() {
  const { data } = await supabase
    .from('stores')
    .select('id, name, slug, subscription_status, subscription_expires_at, users(phone, country), created_at')
    .order('subscription_expires_at', { ascending: true });

  const stores = data ?? [];
  const active = stores.filter(s => s.subscription_status === 'active');
  const inactive = stores.filter(s => s.subscription_status !== 'active');
  const expiringSoon = active.filter(s => {
    if (!s.subscription_expires_at) return false;
    const diff = new Date(s.subscription_expires_at).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  });

  return { all: stores, active, inactive, expiringSoon };
}

// ── Ad campaigns ─────────────────────────────────────────────────────────────

export async function getAdCampaigns() {
  const { data } = await supabase
    .from('ad_campaigns')
    .select('*, stores(name, slug)')
    .order('created_at', { ascending: false });
  return data ?? [];
}

// ── App config ───────────────────────────────────────────────────────────────

export async function getAppConfig() {
  const { data } = await supabase.from('app_config').select('key, value, updated_at');
  const config: Record<string, string> = {};
  for (const row of data ?? []) config[row.key] = row.value;
  return config;
}

// ── Activity feed ─────────────────────────────────────────────────────────────

export async function getActivityFeed() {
  const [orders, users, subs] = await Promise.all([
    supabase.from('orders').select('id, buyer_name, total_amount, status, created_at, stores(name)').order('created_at', { ascending: false }).limit(5),
    supabase.from('users').select('id, phone, country, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('stores').select('id, name, subscription_status, subscription_expires_at').eq('subscription_status', 'active').order('subscription_expires_at', { ascending: false }).limit(5),
  ]);

  const events = [
    ...(orders.data ?? []).map(o => ({ type: 'order' as const, label: `New order from ${o.buyer_name}`, sub: `₦${o.total_amount?.toLocaleString()} — ${(o as any).stores?.name}`, time: o.created_at })),
    ...(users.data ?? []).map(u => ({ type: 'user' as const, label: `New user registered`, sub: `${u.phone} (${u.country})`, time: u.created_at })),
    ...(subs.data ?? []).map(s => ({ type: 'sub' as const, label: `Subscription activated`, sub: s.name, time: s.subscription_expires_at ?? '' })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 12);

  return events;
}
