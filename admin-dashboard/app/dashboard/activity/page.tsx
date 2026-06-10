'use client';
import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import { Activity, Store, ShoppingBag, Wallet } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export default function ActivityPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data?page=activity')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-full">
        <Header title="Activity" subtitle="Loading..." />
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl h-24 animate-pulse border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const sellerActivity = data.sellerActivity ?? [];
  const activeSellers = sellerActivity.filter((s: any) => (s.orders30d ?? 0) > 0).length;
  const sales30d = sellerActivity.reduce((sum: number, s: any) => sum + (s.sales30d ?? 0), 0);
  const walletBalance = sellerActivity.reduce((sum: number, s: any) => sum + (s.wallet_balance ?? 0), 0);
  const withdrawals = sellerActivity.reduce((sum: number, s: any) => sum + (s.withdrawalsRequested ?? 0), 0);

  const columns = [
    {
      key: 'store',
      label: 'Seller / Store',
      render: (s: any) => (
        <div>
          <p className="font-medium text-slate-200">{s.name}</p>
          <p className="text-xs text-slate-600">/{s.slug}</p>
        </div>
      ),
    },
    {
      key: 'sales30d',
      label: '30d Sales',
      render: (s: any) => <span className="font-semibold text-emerald-400">₦{(s.sales30d ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'orders30d',
      label: 'Orders',
      render: (s: any) => <span className="text-slate-300">{s.orders30d} recent / {s.totalOrders} total</span>,
    },
    {
      key: 'products',
      label: 'Products',
      render: (s: any) => <span className="text-slate-300">{s.activeProducts} active / {s.products} total</span>,
    },
    {
      key: 'wallet_balance',
      label: 'Wallet',
      render: (s: any) => <span className="font-semibold text-amber-400">₦{(s.wallet_balance ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'withdrawals',
      label: 'Withdrawals',
      render: (s: any) => <span className="text-slate-300">{s.withdrawalsCompleted} completed / {s.withdrawalsRequested} requested</span>,
    },
    {
      key: 'lastOrderAt',
      label: 'Last Order',
      render: (s: any) => (
        <span className="text-xs text-slate-500">
          {s.lastOrderAt ? formatDistanceToNow(new Date(s.lastOrderAt), { addSuffix: true }) : 'No orders'}
        </span>
      ),
    },
  ];

  return (
    <div className="min-h-full">
      <Header title="Activity" subtitle="Store activity, seller activity, wallets, withdrawals, and recent events" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Active Sellers" value={activeSellers} icon={<Store className="w-5 h-5" />} color="violet" delay={0} />
          <StatCard title="30d Sales" value={`₦${sales30d.toLocaleString()}`} icon={<ShoppingBag className="w-5 h-5" />} color="emerald" delay={0.05} />
          <StatCard title="Wallet Balance" value={`₦${walletBalance.toLocaleString()}`} icon={<Wallet className="w-5 h-5" />} color="amber" delay={0.1} />
          <StatCard title="Withdrawals" value={withdrawals} icon={<Activity className="w-5 h-5" />} color="rose" delay={0.15} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 glass rounded-2xl p-5 border border-white/5">
            <h3 className="font-semibold text-slate-200 mb-4">Seller Activity</h3>
            <DataTable
              columns={columns}
              data={sellerActivity}
              searchFields={['name', 'slug', 'whatsapp_number']}
              searchPlaceholder="Search sellers or stores..."
              pageSize={20}
              emptyMessage="No seller activity yet"
            />
          </div>

          <div className="glass rounded-2xl p-5 border border-white/5">
            <h3 className="font-semibold text-slate-200 mb-4">Recent Events</h3>
            <div className="space-y-3">
              {(data.activityFeed ?? []).map((event: any, i: number) => (
                <div key={i} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-200">{event.label}</p>
                    <span className="badge bg-slate-500/10 text-slate-400 border border-slate-500/20">{event.type}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{event.sub}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {event.time ? `${format(new Date(event.time), 'dd MMM yyyy, HH:mm')} · ${formatDistanceToNow(new Date(event.time), { addSuffix: true })}` : 'No date'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
