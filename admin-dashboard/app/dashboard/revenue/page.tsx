import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import { RevenueAreaChart, DualBarChart } from '@/components/Charts';
import { getRevenueData, getMonthlyTrend } from '@/lib/data';
import { TrendingUp, Wallet, ArrowDownCircle, Store, BadgeDollarSign } from 'lucide-react';

export const revalidate = 60;

export default async function RevenuePage() {
  const [revenue, trend] = await Promise.all([
    getRevenueData(),
    getMonthlyTrend(),
  ]);

  const activeSubCount = revenue.topStores.length; // proxy from top-stores query
  const subRevenue = activeSubCount * 7500;

  return (
    <div className="min-h-full">
      <Header title="Revenue" subtitle="Financial overview and earnings breakdown" />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard title="Total GMV"        value={`₦${revenue.gmv.toLocaleString()}`}              icon={TrendingUp}       color="indigo" delay={0}    />
          <StatCard title="Sub Revenue (Est)" value={`₦${subRevenue.toLocaleString()}`}              icon={BadgeDollarSign}  color="emerald" delay={0.05} />
          <StatCard title="Total Withdrawn"  value={`₦${revenue.totalWithdrawn.toLocaleString()}`}   icon={ArrowDownCircle}  color="rose"    delay={0.1}  />
          <StatCard title="Pending Payouts"  value={`₦${revenue.pendingWithdrawals.toLocaleString()}`} icon={Wallet}          color="amber"   delay={0.15} />
          <StatCard title="Top Stores"       value={revenue.topStores.length}                        icon={Store}            color="violet"  delay={0.2}  />
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
                    {/* Rank */}
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    {/* Store name + bar */}
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
                    {/* Wallet */}
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

        {/* Withdrawal summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Total GMV', value: `₦${revenue.gmv.toLocaleString()}`, sub: 'All paid orders combined', color: 'border-indigo-500/20 bg-indigo-500/5' },
            { label: 'Successfully Withdrawn', value: `₦${revenue.totalWithdrawn.toLocaleString()}`, sub: 'Confirmed bank transfers', color: 'border-emerald-500/20 bg-emerald-500/5' },
            { label: 'Pending Payouts', value: `₦${revenue.pendingWithdrawals.toLocaleString()}`, sub: 'Awaiting processing', color: 'border-amber-500/20 bg-amber-500/5' },
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
