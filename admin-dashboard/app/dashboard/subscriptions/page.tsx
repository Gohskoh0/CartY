import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import DataTable, { StatusBadge } from '@/components/DataTable';
import { DonutChart } from '@/components/Charts';
import { getSubscriptionData } from '@/lib/data';
import { CreditCard, CheckCircle, XCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';

export const revalidate = 60;

export default async function SubscriptionsPage() {
  const { all, active, inactive, expiringSoon } = await getSubscriptionData();

  const donutData = [
    { name: 'Active', value: active.length },
    { name: 'Inactive', value: inactive.length },
  ];

  const columns = [
    {
      key: 'name',
      label: 'Store',
      render: (s: any) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold">
            {s.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-slate-200 text-sm font-medium">{s.name}</p>
            <p className="text-xs text-slate-500 font-mono">/{s.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'owner',
      label: 'Owner',
      render: (s: any) => (
        <div>
          <p className="font-mono text-xs text-slate-400">{s.users?.phone || '—'}</p>
          <p className="text-xs text-slate-600">{s.users?.country}</p>
        </div>
      ),
    },
    {
      key: 'subscription_status',
      label: 'Status',
      render: (s: any) => <StatusBadge status={s.subscription_status} />,
    },
    {
      key: 'subscription_expires_at',
      label: 'Expires',
      render: (s: any) => {
        if (!s.subscription_expires_at) return <span className="text-slate-600 text-xs">—</span>;
        const d = new Date(s.subscription_expires_at);
        const expired = isPast(d);
        const soon = !expired && d.getTime() - Date.now() < 7 * 86400000;
        return (
          <div>
            <p className={`text-xs font-medium ${expired ? 'text-rose-400' : soon ? 'text-amber-400' : 'text-slate-400'}`}>
              {format(d, 'dd MMM yyyy')}
            </p>
            <p className="text-xs text-slate-600">{formatDistanceToNow(d, { addSuffix: true })}</p>
          </div>
        );
      },
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (s: any) => <span className="text-slate-500 text-xs">{s.created_at ? format(new Date(s.created_at), 'dd MMM yyyy') : '—'}</span>,
    },
  ];

  const mrr = active.length * 7500;

  return (
    <div className="min-h-full">
      <Header title="Subscriptions" subtitle="Monitor store subscription health and revenue" />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Active Subs" value={active.length} icon={CheckCircle} color="emerald" delay={0} />
          <StatCard title="Inactive" value={inactive.length} icon={XCircle} color="rose" delay={0.05} />
          <StatCard title="Expiring Soon" value={expiringSoon.length} icon={AlertTriangle} color="amber" delay={0.1} />
          <StatCard title="Est. MRR" value={`₦${mrr.toLocaleString()}`} icon={TrendingUp} color="indigo" delay={0.15} />
        </div>

        {/* Visual breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Donut */}
          <div className="glass rounded-2xl p-5 border border-white/5">
            <h3 className="font-semibold text-slate-200 mb-2">Subscription Status</h3>
            <DonutChart data={donutData} />
          </div>

          {/* Revenue calc */}
          <div className="glass rounded-2xl p-5 border border-white/5 space-y-4">
            <h3 className="font-semibold text-slate-200">Revenue Metrics</h3>
            <div className="space-y-3">
              {[
                { label: 'Monthly price', value: '₦7,500', sub: 'per store per month' },
                { label: 'Active stores', value: active.length.toString(), sub: 'currently subscribed' },
                { label: 'Est. MRR', value: `₦${mrr.toLocaleString()}`, sub: 'monthly recurring revenue', highlight: true },
                { label: 'Est. ARR', value: `₦${(mrr * 12).toLocaleString()}`, sub: 'annualized revenue', highlight: true },
              ].map(({ label, value, sub, highlight }) => (
                <div key={label} className={`p-3 rounded-xl ${highlight ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-white/3'}`}>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">{label}</span>
                    <span className={`font-bold ${highlight ? 'gradient-text' : 'text-slate-200'}`}>{value}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Expiring soon */}
          <div className="glass rounded-2xl p-5 border border-white/5">
            <h3 className="font-semibold text-slate-200 mb-4">Expiring in 7 Days</h3>
            {expiringSoon.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-600">
                <CheckCircle className="w-8 h-8 mb-2 text-emerald-600" />
                <p className="text-sm">No expiries soon</p>
              </div>
            ) : (
              <div className="space-y-2">
                {expiringSoon.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm text-slate-200">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.users?.phone}</p>
                    </div>
                    <p className="text-xs text-amber-400 font-medium">
                      {s.subscription_expires_at ? formatDistanceToNow(new Date(s.subscription_expires_at), { addSuffix: true }) : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Full table */}
        <div className="glass rounded-2xl p-5 border border-white/5">
          <h3 className="font-semibold text-slate-200 mb-4">All Store Subscriptions</h3>
          <DataTable
            columns={columns}
            data={all}
            searchFields={['name', 'slug']}
            searchPlaceholder="Search by store name…"
            pageSize={20}
          />
        </div>
      </div>
    </div>
  );
}
