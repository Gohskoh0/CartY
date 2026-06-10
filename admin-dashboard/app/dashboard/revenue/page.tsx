'use client';
import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import DataTable, { StatusBadge } from '@/components/DataTable';
import { RevenueAreaChart, DualBarChart } from '@/components/Charts';
import { TrendingUp, Wallet, ArrowDownCircle, Store, BadgeDollarSign, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function RevenuePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadRevenue = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch('/api/data?page=revenue');
      const body = await res.json();
      if (!body.error) setData(body);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRevenue(true);
  }, [loadRevenue]);

  const updateWithdrawal = async (id: string, status: 'success' | 'failed') => {
    const confirmed = window.confirm(
      status === 'success'
        ? 'Mark this withdrawal as paid? Do this only after you have manually sent the money.'
        : 'Mark this withdrawal as failed and refund the seller wallet?'
    );
    if (!confirmed) return;

    setActionLoading(`${id}:${status}`);
    try {
      const res = await fetch(`/api/withdrawals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Could not update withdrawal');
      await loadRevenue();
    } catch (err: any) {
      window.alert(err?.message || 'Could not update withdrawal');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || !data) {
    return (
      <div className="min-h-full">
        <Header title="Revenue" subtitle="Loading…" />
        <div className="p-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl h-24 animate-pulse border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const { revenue, trend, financials, sellerActivity } = data;
  const subRevenue = financials.monthly.subscriptionRevenue;
  const withdrawalRequests = revenue.withdrawalRequests ?? [];
  const pendingRequests = withdrawalRequests.filter((w: any) => w.status === 'pending');
  const getStore = (w: any) => Array.isArray(w.stores) ? w.stores[0] : w.stores;
  const getOwner = (w: any) => {
    const store = getStore(w);
    return Array.isArray(store?.users) ? store.users[0] : store?.users;
  };

  const withdrawalColumns = [
    {
      key: 'seller',
      label: 'Seller',
      render: (w: any) => {
        const store = getStore(w);
        const owner = getOwner(w);
        return (
          <div>
            <p className="font-medium text-slate-200">{store?.name || 'Unknown store'}</p>
            <p className="text-xs text-slate-500 font-mono">{owner?.phone || store?.whatsapp_number || 'No phone'}</p>
          </div>
        );
      },
    },
    {
      key: 'bank',
      label: 'Bank Details',
      render: (w: any) => (
        <div>
          <p className="font-medium text-slate-200">{w.bank_name || 'No bank'}</p>
          <p className="text-xs text-slate-500">{w.bank_account_name || 'No account name'}</p>
          <p className="text-xs text-slate-400 font-mono">{w.bank_account_number || 'No account number'}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (w: any) => <span className="font-bold text-emerald-400">₦{(w.amount ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'created_at',
      label: 'Requested',
      render: (w: any) => <span className="text-slate-500 text-xs">{w.created_at ? format(new Date(w.created_at), 'dd MMM yyyy, HH:mm') : '—'}</span>,
    },
    {
      key: 'reference',
      label: 'Reference',
      render: (w: any) => <span className="font-mono text-xs text-slate-500">{w.reference || '—'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (w: any) => <StatusBadge status={w.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (w: any) => w.status === 'pending' ? (
        <div className="flex gap-2">
          <button
            onClick={() => updateWithdrawal(w.id, 'success')}
            disabled={!!actionLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Paid
          </button>
          <button
            onClick={() => updateWithdrawal(w.id, 'failed')}
            disabled={!!actionLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 disabled:opacity-40 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            Refund
          </button>
        </div>
      ) : (
        <span className="text-xs text-slate-600">Closed</span>
      ),
    },
  ];

  return (
    <div className="min-h-full">
      <Header title="Revenue" subtitle="Financial overview and earnings breakdown" />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard title="Total GMV"        value={`₦${revenue.gmv.toLocaleString()}`}                   icon={<TrendingUp className="w-5 h-5" />}       color="indigo"  delay={0}    />
          <StatCard title="Sub Revenue (Est)" value={`₦${subRevenue.toLocaleString()}`}                   icon={<BadgeDollarSign className="w-5 h-5" />}  color="emerald" delay={0.05} />
          <StatCard title="Total Withdrawn"  value={`₦${revenue.totalWithdrawn.toLocaleString()}`}        icon={<ArrowDownCircle className="w-5 h-5" />}  color="rose"    delay={0.1}  />
          <StatCard title="Pending Payouts"  value={`₦${revenue.pendingWithdrawals.toLocaleString()}`}    icon={<Wallet className="w-5 h-5" />}           color="amber"   delay={0.15} />
          <StatCard title="Top Stores"       value={revenue.topStores.length}                             icon={<Store className="w-5 h-5" />}            color="violet"  delay={0.2}  />
        </div>

        {/* Period revenue */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            { label: 'Monthly App Revenue', value: `₦${financials.monthly.appRevenue.toLocaleString()}`, sub: 'subscriptions + ad margin' },
            { label: 'Quarterly App Revenue', value: `₦${financials.quarterly.appRevenue.toLocaleString()}`, sub: 'quarter estimate' },
            { label: 'Yearly App Revenue', value: `₦${financials.yearly.appRevenue.toLocaleString()}`, sub: 'year estimate' },
            { label: 'Monthly Sales', value: `₦${financials.monthly.sales.toLocaleString()}`, sub: `${financials.monthly.orders} paid orders` },
            { label: 'Seller Wallet Balance', value: `₦${financials.wallets.totalWalletBalance.toLocaleString()}`, sub: 'available to sellers' },
            { label: 'Completed Withdrawals', value: financials.withdrawals.completed, sub: `₦${financials.withdrawals.completedAmount.toLocaleString()} paid manually` },
          ].map((item) => (
            <div key={item.label} className="glass rounded-2xl p-4 border border-white/5">
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-2">{item.label}</p>
              <p className="text-xl font-bold text-slate-100">{item.value}</p>
              <p className="text-xs text-slate-600 mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Manual withdrawal queue */}
        <div className="glass rounded-2xl p-5 border border-white/5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
            <div>
              <h3 className="font-semibold text-slate-200">Manual Withdrawal Queue</h3>
              <p className="text-xs text-slate-500 mt-1">Pay sellers outside Paystack, then mark the request as paid. Refund returns the held amount to the seller wallet.</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-amber-300 text-sm font-semibold">
              {pendingRequests.length} pending
            </div>
          </div>
          <DataTable
            columns={withdrawalColumns}
            data={withdrawalRequests}
            searchFields={['reference', 'bank_name', 'bank_account_name', 'bank_account_number']}
            searchPlaceholder="Search withdrawals..."
            pageSize={10}
            emptyMessage="No withdrawal requests yet"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-5 border border-white/5">
            <h3 className="font-semibold text-slate-200 mb-1">Monthly GMV</h3>
            <p className="text-xs text-slate-500 mb-4">Total order value processed per month</p>
            <RevenueAreaChart data={revenue.monthlyRevenue} dataKey="revenue" color="#6366F1" label="GMV" />
          </div>
          <div className="glass rounded-2xl p-5 border border-white/5">
            <h3 className="font-semibold text-slate-200 mb-1">Revenue vs Orders</h3>
            <p className="text-xs text-slate-500 mb-4">Revenue (indigo bars) and order count (green) combined</p>
            <DualBarChart data={trend} />
          </div>
        </div>

        {/* Top stores */}
        <div className="glass rounded-2xl p-5 border border-white/5">
          <h3 className="font-semibold text-slate-200 mb-5">Top Stores by Total Earnings</h3>
          {revenue.topStores.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-4">
              {revenue.topStores.map((store: any, i: number) => {
                const maxEarning = (revenue.topStores[0]?.total_earnings ?? 1) || 1;
                const pct = ((store.total_earnings ?? 0) / maxEarning) * 100;
                const gradients = [
                  'from-indigo-500 to-violet-500',
                  'from-violet-500 to-purple-500',
                  'from-sky-500 to-indigo-500',
                  'from-emerald-500 to-teal-500',
                  'from-amber-500 to-orange-500',
                ];
                return (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm text-slate-300 font-medium truncate">{store.name}</span>
                        <span className="text-sm font-bold text-emerald-400 ml-3 shrink-0">
                          ₦{(store.total_earnings ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-2 rounded-full bg-gradient-to-r ${gradients[i % gradients.length]} transition-all duration-1000`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0 min-w-[80px]">
                      <p className="text-xs text-slate-500">Wallet</p>
                      <p className="text-xs font-semibold text-amber-400">₦{(store.wallet_balance ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Seller wallet activity */}
        <div className="glass rounded-2xl p-5 border border-white/5">
          <h3 className="font-semibold text-slate-200 mb-5">Seller Wallets and Activity</h3>
          <div className="space-y-3">
            {(sellerActivity ?? []).slice(0, 8).map((seller: any) => (
              <div key={seller.id} className="flex flex-col md:flex-row md:items-center gap-3 justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium text-slate-200">{seller.name}</p>
                  <p className="text-xs text-slate-600">/{seller.slug} · {seller.orders30d} orders in 30 days</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-right">
                  <div>
                    <p className="text-xs text-slate-500">30d sales</p>
                    <p className="text-sm font-semibold text-emerald-400">₦{(seller.sales30d ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Wallet</p>
                    <p className="text-sm font-semibold text-amber-400">₦{(seller.wallet_balance ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Withdrawals</p>
                    <p className="text-sm font-semibold text-slate-300">{seller.withdrawalsCompleted}/{seller.withdrawalsRequested}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Withdrawal summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Total GMV', value: `₦${revenue.gmv.toLocaleString()}`, sub: 'All paid orders combined', color: 'border-indigo-500/20 bg-indigo-500/5' },
            { label: 'Successfully Withdrawn', value: `₦${revenue.totalWithdrawn.toLocaleString()}`, sub: 'Confirmed manual payouts', color: 'border-emerald-500/20 bg-emerald-500/5' },
            { label: 'Pending Payouts', value: `₦${revenue.pendingWithdrawals.toLocaleString()}`, sub: 'Awaiting manual processing', color: 'border-amber-500/20 bg-amber-500/5' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className={`glass rounded-2xl p-5 border ${color}`}>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">{label}</p>
              <p className="text-2xl font-bold text-slate-100">{value}</p>
              <p className="text-xs text-slate-600 mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
