'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import DataTable, { StatusBadge } from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import { DonutChart } from '@/components/Charts';
import { Store, CreditCard, Wallet, Link } from 'lucide-react';
import { format } from 'date-fns';

export default function StoresPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data?page=stores')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-full">
        <Header title="Stores" subtitle="Loading…" />
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl h-24 animate-pulse border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const { stores } = data;

  const active = stores.filter((s: any) => s.subscription_status === 'active').length;
  const withMeta = stores.filter((s: any) => s.meta_ad_account_id).length;
  const withTikTok = stores.filter((s: any) => s.tiktok_advertiser_id).length;
  const totalWallet = stores.reduce((sum: number, s: any) => sum + (s.wallet_balance ?? 0), 0);

  const subDist = [
    { name: 'Active', value: active },
    { name: 'Inactive', value: stores.length - active },
  ];

  const columns = [
    {
      key: 'name',
      label: 'Store',
      render: (s: any) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 text-xs font-bold">
            {s.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-slate-200">{s.name}</p>
            <p className="text-xs text-slate-500">/{s.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'owner',
      label: 'Owner',
      render: (s: any) => (
        <div>
          <p className="font-mono text-xs text-slate-400">{s.users?.phone}</p>
          <p className="text-xs text-slate-600">{s.users?.country}</p>
        </div>
      ),
    },
    {
      key: 'subscription_status',
      label: 'Subscription',
      render: (s: any) => (
        <div>
          <StatusBadge status={s.subscription_status} />
          {s.subscription_expires_at && (
            <p className="text-xs text-slate-600 mt-0.5">Exp: {format(new Date(s.subscription_expires_at), 'dd MMM yyyy')}</p>
          )}
        </div>
      ),
    },
    {
      key: 'wallet_balance',
      label: 'Wallet',
      render: (s: any) => (
        <span className="font-semibold text-emerald-400">₦{(s.wallet_balance ?? 0).toLocaleString()}</span>
      ),
    },
    {
      key: 'ads',
      label: 'Ad Accounts',
      render: (s: any) => (
        <div className="flex gap-1">
          {s.meta_ad_account_id && <span className="badge bg-sky-500/10 text-sky-400 border border-sky-500/20">Meta</span>}
          {s.tiktok_advertiser_id && <span className="badge bg-rose-500/10 text-rose-400 border border-rose-500/20">TikTok</span>}
          {!s.meta_ad_account_id && !s.tiktok_advertiser_id && <span className="text-slate-600 text-xs">None</span>}
        </div>
      ),
    },
    {
      key: 'whatsapp_number',
      label: 'WhatsApp',
      render: (s: any) => <span className="text-slate-500 text-xs font-mono">{s.whatsapp_number || '—'}</span>,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (s: any) => <span className="text-slate-500 text-xs">{s.created_at ? format(new Date(s.created_at), 'dd MMM yyyy') : '—'}</span>,
    },
  ];

  return (
    <div className="min-h-full">
      <Header title="Stores" subtitle={`${stores.length} stores registered`} />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Stores" value={stores.length} icon={<Store className="w-5 h-5" />} color="violet" delay={0} />
          <StatCard title="Active Subs" value={active} icon={<CreditCard className="w-5 h-5" />} color="emerald" delay={0.05} />
          <StatCard title="Total Wallet" value={`₦${totalWallet.toLocaleString()}`} icon={<Wallet className="w-5 h-5" />} color="amber" delay={0.1} />
          <StatCard title="Ad Accounts" value={withMeta + withTikTok} icon={<Link className="w-5 h-5" />} color="sky" delay={0.15} />
        </div>

        {/* Sub distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-5 border border-white/5">
            <h3 className="font-semibold text-slate-200 mb-2">Subscription Split</h3>
            <DonutChart data={subDist} />
          </div>
          <div className="glass rounded-2xl p-5 border border-white/5">
            <h3 className="font-semibold text-slate-200 mb-4">Ad Account Connections</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Meta / Facebook</span>
                  <span className="text-sky-400 font-semibold">{withMeta}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div className="h-2 rounded-full bg-sky-500" style={{ width: `${stores.length ? (withMeta / stores.length) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">TikTok</span>
                  <span className="text-rose-400 font-semibold">{withTikTok}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div className="h-2 rounded-full bg-rose-500" style={{ width: `${stores.length ? (withTikTok / stores.length) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">No Ad Account</span>
                  <span className="text-slate-400 font-semibold">{stores.length - withMeta - withTikTok}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div className="h-2 rounded-full bg-slate-600" style={{ width: `${stores.length ? ((stores.length - withMeta - withTikTok) / stores.length) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>
          <div className="glass rounded-2xl p-5 border border-white/5">
            <h3 className="font-semibold text-slate-200 mb-4">Subscription Revenue</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Price / month</span>
                <span className="text-slate-200 font-semibold">₦7,500</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Active stores</span>
                <span className="text-emerald-400 font-semibold">{active}</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-3">
                <span className="text-slate-300 text-sm font-medium">Est. MRR</span>
                <span className="gradient-text font-bold">₦{(active * 7500).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="glass rounded-2xl p-5 border border-white/5">
          <h3 className="font-semibold text-slate-200 mb-4">All Stores</h3>
          <DataTable
            columns={columns}
            data={stores}
            searchFields={['name', 'slug']}
            searchPlaceholder="Search by name or slug…"
            pageSize={20}
          />
        </div>
      </div>
    </div>
  );
}
