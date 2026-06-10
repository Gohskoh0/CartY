import { supabase } from './supabase';
import { startOfMonth, startOfQuarter, startOfYear, subDays, subMonths, format } from 'date-fns';

const configuredSubscriptionPrice = Number(process.env.SUBSCRIPTION_PRICE_NGN ?? 7500);
const SUBSCRIPTION_PRICE_NGN = configuredSubscriptionPrice > 100000
  ? configuredSubscriptionPrice / 100
  : configuredSubscriptionPrice;
const ADS_MARGIN_RATE = Number(process.env.ADS_MARGIN_PERCENT ?? 15) / 100;
const PAID_ORDER_STATUSES = new Set(['paid', 'completed']);
const PAID_AD_STATUSES = new Set(['paid', 'active', 'completed']);

function sumBy<T>(rows: T[], pick: (row: T) => number | null | undefined) {
  return rows.reduce((total, row) => total + Number(pick(row) ?? 0), 0);
}

function isOnOrAfter(value: string | null | undefined, start: Date) {
  return value ? new Date(value).getTime() >= start.getTime() : false;
}

// ── Overview stats ──────────────────────────────────────────────────────────

export async function getOverviewStats() {
  const [usersRes, storesRes, ordersRes, activeSubsRes, withdrawRes] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('stores').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id, total_amount, status', { count: 'exact' }),
    supabase.from('stores').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    supabase.from('withdrawals').select('amount').eq('status', 'success'),
  ]);

  // ad_campaigns table may not exist yet — query separately and swallow errors
  let totalAdCampaigns = 0;
  try {
    const adRes = await supabase.from('ad_campaigns').select('id', { count: 'exact', head: true });
    totalAdCampaigns = adRes.count ?? 0;
  } catch {}

  const orders = ordersRes.data ?? [];
  const gmv = orders.filter(o => PAID_ORDER_STATUSES.has(o.status ?? '')).reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const totalWithdrawn = sumBy(withdrawRes.data ?? [], w => w.amount);
  const subscriptionRevenue = (activeSubsRes.count ?? 0) * SUBSCRIPTION_PRICE_NGN;

  return {
    totalUsers: usersRes.count ?? 0,
    totalStores: storesRes.count ?? 0,
    totalOrders: ordersRes.count ?? 0,
    activeSubscriptions: activeSubsRes.count ?? 0,
    totalAdCampaigns,
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
      if (PAID_ORDER_STATUSES.has(o.status ?? '')) months[key].revenue += o.total_amount ?? 0;
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
    .select(`id, buyer_name, buyer_phone, total_amount, status, payment_reference, created_at, stores(name, slug)`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (status) q = q.eq('status', status);
  const { data, count } = await q;
  return { data: data ?? [], count: count ?? 0 };
}

// ── Revenue breakdown ────────────────────────────────────────────────────────

export async function getRevenueData() {
  const [ordersRes, withdrawalsRes, storeWallets, allStoreWallets, withdrawalRequestsRes] = await Promise.all([
    supabase.from('orders').select('total_amount, status, created_at'),
    supabase.from('withdrawals').select('amount, status, created_at'),
    supabase.from('stores').select('name, total_earnings, wallet_balance').order('total_earnings', { ascending: false }).limit(10),
    supabase.from('stores').select('total_earnings, wallet_balance, pending_balance'),
    supabase
      .from('withdrawals')
      .select(`
        id, store_id, amount, status, reference,
        bank_name, bank_code, bank_account_number, bank_account_name,
        created_at, completed_at, admin_note,
        stores(name, slug, whatsapp_number, users(phone, country))
      `)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const orders = ordersRes.data ?? [];
  const withdrawals = withdrawalsRes.data ?? [];

  const paidOrders = orders.filter(o => PAID_ORDER_STATUSES.has(o.status ?? ''));
  const gmv = sumBy(paidOrders, o => o.total_amount);
  const totalWithdrawn = withdrawals.filter(w => w.status === 'success').reduce((s, w) => s + (w.amount ?? 0), 0);
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + (w.amount ?? 0), 0);
  const failedWithdrawals = withdrawals.filter(w => w.status === 'failed').reduce((s, w) => s + (w.amount ?? 0), 0);

  // By month
  const byMonth: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const key = format(subMonths(new Date(), i), 'MMM yy');
    byMonth[key] = 0;
  }
  for (const o of paidOrders) {
    const key = format(new Date(o.created_at), 'MMM yy');
    if (key in byMonth) byMonth[key] += o.total_amount ?? 0;
  }
  const monthlyRevenue = Object.entries(byMonth).map(([month, revenue]) => ({ month, revenue }));
  const topStores = storeWallets.data ?? [];
  const wallets = allStoreWallets.data ?? [];

  return {
    gmv,
    totalWithdrawn,
    pendingWithdrawals,
    failedWithdrawals,
    withdrawalRequests: withdrawalRequestsRes.data ?? [],
    monthlyRevenue,
    topStores,
    walletSummary: {
      totalWalletBalance: sumBy(wallets, s => s.wallet_balance),
      totalPendingBalance: sumBy(wallets, s => s.pending_balance),
      totalSellerEarnings: sumBy(wallets, s => s.total_earnings),
    },
  };
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export async function getFinancialSummary() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const quarterStart = startOfQuarter(now);
  const yearStart = startOfYear(now);

  const [ordersRes, activeSubsRes, adRes, withdrawalRes, storesRes] = await Promise.all([
    supabase.from('orders').select('total_amount, status, created_at'),
    supabase.from('stores').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    supabase.from('ad_campaigns').select('budget_ngn, actual_budget_ngn, status, created_at'),
    supabase.from('withdrawals').select('amount, status, created_at'),
    supabase.from('stores').select('wallet_balance, pending_balance, total_earnings'),
  ]);

  const orders = (ordersRes.data ?? []).filter(o => PAID_ORDER_STATUSES.has(o.status ?? ''));
  const adCampaigns = (adRes.data ?? []).filter(a => PAID_AD_STATUSES.has(a.status ?? ''));
  const withdrawals = withdrawalRes.data ?? [];
  const stores = storesRes.data ?? [];
  const activeSubscriptions = activeSubsRes.count ?? 0;
  const allAdMargin = sumBy(adCampaigns, a => a.actual_budget_ngn ?? a.budget_ngn) * ADS_MARGIN_RATE;

  const period = (start: Date, subscriptionMultiplier: number) => {
    const periodOrders = orders.filter(o => isOnOrAfter(o.created_at, start));
    const periodAds = adCampaigns.filter(a => isOnOrAfter(a.created_at, start));
    const sales = sumBy(periodOrders, o => o.total_amount);
    const adMargin = sumBy(periodAds, a => a.actual_budget_ngn ?? a.budget_ngn) * ADS_MARGIN_RATE;
    const subscriptionRevenue = activeSubscriptions * SUBSCRIPTION_PRICE_NGN * subscriptionMultiplier;
    return {
      sales,
      adMargin,
      subscriptionRevenue,
      appRevenue: subscriptionRevenue + adMargin,
      orders: periodOrders.length,
    };
  };

  return {
    monthly: period(monthStart, 1),
    quarterly: period(quarterStart, 3),
    yearly: period(yearStart, 12),
    allTime: {
      sales: sumBy(orders, o => o.total_amount),
      adMargin: allAdMargin,
      subscriptionRevenue: activeSubscriptions * SUBSCRIPTION_PRICE_NGN,
      appRevenue: activeSubscriptions * SUBSCRIPTION_PRICE_NGN + allAdMargin,
      orders: orders.length,
    },
    wallets: {
      totalWalletBalance: sumBy(stores, s => s.wallet_balance),
      totalPendingBalance: sumBy(stores, s => s.pending_balance),
      totalSellerEarnings: sumBy(stores, s => s.total_earnings),
    },
    withdrawals: {
      requested: withdrawals.length,
      pending: withdrawals.filter(w => w.status === 'pending').length,
      completed: withdrawals.filter(w => w.status === 'success').length,
      failed: withdrawals.filter(w => w.status === 'failed').length,
      pendingAmount: sumBy(withdrawals.filter(w => w.status === 'pending'), w => w.amount),
      completedAmount: sumBy(withdrawals.filter(w => w.status === 'success'), w => w.amount),
    },
  };
}

export async function getSellerActivity() {
  const since = subDays(new Date(), 30);
  const [storesRes, ordersRes, productsRes, withdrawalsRes] = await Promise.all([
    supabase
      .from('stores')
      .select('id, name, slug, whatsapp_number, wallet_balance, pending_balance, total_earnings, created_at, users(phone, country)')
      .order('created_at', { ascending: false }),
    supabase.from('orders').select('store_id, total_amount, status, created_at'),
    supabase.from('products').select('store_id, created_at, is_active'),
    supabase.from('withdrawals').select('store_id, amount, status, created_at'),
  ]);

  const orders = ordersRes.data ?? [];
  const products = productsRes.data ?? [];
  const withdrawals = withdrawalsRes.data ?? [];

  return (storesRes.data ?? []).map((store: any) => {
    const storeOrders = orders.filter(o => o.store_id === store.id);
    const paidOrders = storeOrders.filter(o => PAID_ORDER_STATUSES.has(o.status ?? ''));
    const recentPaidOrders = paidOrders.filter(o => isOnOrAfter(o.created_at, since));
    const storeProducts = products.filter(p => p.store_id === store.id);
    const storeWithdrawals = withdrawals.filter(w => w.store_id === store.id);
    const lastOrderAt = storeOrders
      .map(o => o.created_at)
      .filter(Boolean)
      .sort()
      .at(-1);

    return {
      ...store,
      orders30d: recentPaidOrders.length,
      sales30d: sumBy(recentPaidOrders, o => o.total_amount),
      totalOrders: paidOrders.length,
      totalSales: sumBy(paidOrders, o => o.total_amount),
      products: storeProducts.length,
      activeProducts: storeProducts.filter(p => p.is_active).length,
      withdrawalsRequested: storeWithdrawals.length,
      withdrawalsCompleted: storeWithdrawals.filter(w => w.status === 'success').length,
      lastOrderAt,
      activityScore: recentPaidOrders.length * 3 + storeProducts.filter(p => isOnOrAfter(p.created_at, since)).length,
    };
  }).sort((a: any, b: any) => {
    if (b.activityScore !== a.activityScore) return b.activityScore - a.activityScore;
    return (b.sales30d ?? 0) - (a.sales30d ?? 0);
  });
}

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
  try {
    const { data } = await supabase
      .from('ad_campaigns')
      .select('*, stores(name, slug)')
      .order('created_at', { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

// ── App config ───────────────────────────────────────────────────────────────

export async function getAppConfig() {
  try {
    const { data } = await supabase.from('app_config').select('key, value, updated_at');
    const config: Record<string, string> = {};
    for (const row of data ?? []) config[row.key] = row.value;
    return config;
  } catch {
    return {};
  }
}

// ── Activity feed ─────────────────────────────────────────────────────────────

export async function getActivityFeed() {
  const [orders, users, subs, stores, products, withdrawals] = await Promise.all([
    supabase.from('orders').select('id, buyer_name, total_amount, status, created_at, stores(name)').order('created_at', { ascending: false }).limit(5),
    supabase.from('users').select('id, phone, country, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('stores').select('id, name, subscription_status, subscription_expires_at').eq('subscription_status', 'active').order('subscription_expires_at', { ascending: false }).limit(5),
    supabase.from('stores').select('id, name, slug, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('products').select('id, name, created_at, stores(name)').order('created_at', { ascending: false }).limit(5),
    supabase.from('withdrawals').select('id, amount, status, created_at, stores(name)').order('created_at', { ascending: false }).limit(5),
  ]);

  const events = [
    ...(orders.data ?? []).map(o => ({ type: 'order' as const, label: `New order from ${o.buyer_name}`, sub: `₦${o.total_amount?.toLocaleString()} — ${(o as any).stores?.name}`, time: o.created_at })),
    ...(users.data ?? []).map(u => ({ type: 'user' as const, label: `New user registered`, sub: `${u.phone} (${u.country})`, time: u.created_at })),
    ...(subs.data ?? []).map(s => ({ type: 'sub' as const, label: `Subscription activated`, sub: s.name, time: s.subscription_expires_at ?? '' })),
    ...(stores.data ?? []).map(s => ({ type: 'store' as const, label: `Store created`, sub: `${s.name} /${s.slug}`, time: s.created_at })),
    ...(products.data ?? []).map((p: any) => ({ type: 'product' as const, label: `Product added`, sub: `${p.name} — ${p.stores?.name ?? 'Unknown store'}`, time: p.created_at })),
    ...(withdrawals.data ?? []).map((w: any) => ({ type: 'withdrawal' as const, label: `Withdrawal ${w.status}`, sub: `₦${w.amount?.toLocaleString()} — ${w.stores?.name ?? 'Unknown store'}`, time: w.created_at })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 16);

  return events;
}
