'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import { RevenueAreaChart, OrdersBarChart, DonutChart, UserGrowthChart } from '@/components/Charts';
import { Users, Store, ShoppingBag, CreditCard, TrendingUp, Megaphone, Wallet, Activity } from 'lucide-react';
import { StatusBadge } from '@/components/DataTable';
import { formatDistanceToNow } from 'date-fns';

export default function OverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data?page=overview')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-full">
        <Header title="Overview" subtitle="Welcome back — here's what's happening with CartY" />
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl h-24 animate-pulse border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const { stats, trend, recentOrders, activityFeed, userGrowth } = data;

  const subDistribution = [
    { name: 'Active', value: stats.activeSubscriptions },
    { name: 'Inactive', value: Math.max(0, stats.totalStores - stats.activeSubscriptions) },
  ];

  return (
    <div className="min-h-full">
      <Header title="Overview" subtitle="Welcome back — here's what's happening with CartY" />

      <div className="p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard title="Total Users"       value={stats.totalUsers}           icon={<Users className="w-5 h-5" />}    color="sky"    delay={0}    />
          <StatCard title="Total Stores"      value={stats.totalStores}          icon={<Store className="w-5 h-5" />}    color="violet" delay={0.05} />
          <StatCard title="Total Orders"      value={stats.totalOrders}          icon={<ShoppingBag className="w-5 h-5" />} color="emerald" delay={0.1} />
          <StatCard title="Active Subs"       value={stats.activeSubscriptions}  icon={<CreditCard className="w-5 h-5" />} color="indigo" delay={0.15} />
          <StatCard title="GMV"               value={`₦${stats.gmv.toLocaleString()}`}                   icon={<TrendingUp className="w-5 h-5" />} color="amber" delay={0.2}  />
          <StatCard title="Sub Revenue"       value={`₦${stats.subscriptionRevenue.toLocaleString()}`}   icon={<Wallet className="w-5 h-5" />}     color="rose"   delay={0.25} />
          <StatCard title="Ad Campaigns"      value={stats.totalAdCampaigns}     icon={<Megaphone className="w-5 h-5" />} color="sky"    delay={0.3}  />
          <StatCard title="Total Withdrawn"   value={`₦${stats.totalWithdrawn.toLocaleString()}`}        icon={<Activity className="w-5 h-5" />}   color="violet" delay={0.35} />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 glass rounded-2xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-200">GMV Trend</h3>
                <p className="text-xs text-slate-500">Order revenue over last 12 months</p>
              </div>
              <span className="badge bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Monthly</span>
            </div>
            <RevenueAreaChart data={trend} dataKey="revenue" label="Revenue" />
          </div>

          <div className="glass rounded-2xl p-5 border border-white/5">
            <div className="mb-2">
              <h3 className="font-semibold text-slate-200">Subscriptions</h3>
              <p className="text-xs text-slate-500">Active vs Inactive stores</p>
            </div>
            <DonutChart data={subDistribution} />
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-5 border border-white/5">
            <div className="mb-4">
              <h3 className="font-semibold text-slate-200">Orders per Month</h3>
              <p className="text-xs text-slate-500">Last 12 months</p>
            </div>
            <OrdersBarChart data={trend} />
          </div>

          <div className="glass rounded-2xl p-5 border border-white/5">
            <div className="mb-4">
              <h3 className="font-semibold text-slate-200">User Growth</h3>
              <p className="text-xs text-slate-500">New signups per month</p>
            </div>
            <UserGrowthChart data={userGrowth} />
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent orders */}
          <div className="lg:col-span-2 glass rounded-2xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-200">Recent Orders</h3>
              <a href="/dashboard/orders" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">View all →</a>
            </div>
            <div className="space-y-1">
              {recentOrders.length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-8">No orders yet</p>
              ) : (
                recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-2.5 border-b border-white/3 last:border-0 table-row-hover px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs font-bold">
                        {(order.buyer_name || 'B')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{order.buyer_name}</p>
                        <p className="text-xs text-slate-500">{order.stores?.name}</p>
                      </div>
                    </div>
                    <div className="text-right mr-3">
                      <p className="text-sm font-semibold text-emerald-400">₦{(order.total_amount ?? 0).toLocaleString()}</p>
                      <p className="text-xs text-slate-500">{order.created_at ? formatDistanceToNow(new Date(order.created_at), { addSuffix: true }) : ''}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity feed */}
          <div className="glass rounded-2xl p-5 border border-white/5">
            <h3 className="font-semibold text-slate-200 mb-4">Activity Feed</h3>
            <div className="space-y-3">
              {activityFeed.slice(0, 9).map((event: any, i: number) => {
                const dots: Record<string, string> = { order: 'bg-emerald-500', user: 'bg-sky-500', sub: 'bg-indigo-500' };
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-2 shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${dots[event.type]}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-300 leading-snug">{event.label}</p>
                      <p className="text-xs text-slate-600 truncate">{event.sub}</p>
                    </div>
                    <p className="text-xs text-slate-600 shrink-0 mt-0.5 whitespace-nowrap">
                      {event.time ? formatDistanceToNow(new Date(event.time), { addSuffix: true }) : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
