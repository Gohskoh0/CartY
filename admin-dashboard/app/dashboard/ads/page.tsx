'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import DataTable, { StatusBadge } from '@/components/DataTable';
import { DonutChart } from '@/components/Charts';
import { Megaphone, Play, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function AdsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data?page=ads')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-full">
        <Header title="Ad Campaigns" subtitle="Loading…" />
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl h-24 animate-pulse border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const { campaigns } = data;

  const active    = campaigns.filter((c: any) => c.status === 'active').length;
  const launching = campaigns.filter((c: any) => c.status === 'launching').length;
  const failed    = campaigns.filter((c: any) => c.status === 'failed').length;
  const meta      = campaigns.filter((c: any) => c.platform === 'meta').length;
  const tiktok    = campaigns.filter((c: any) => c.platform === 'tiktok').length;
  const totalBudget = campaigns.reduce((s: number, c: any) => s + (c.budget_ngn ?? 0), 0);

  const platformDist = [
    { name: 'Meta', value: meta },
    { name: 'TikTok', value: tiktok },
  ].filter(d => d.value > 0);

  const statusDist = [
    { name: 'Active', value: active },
    { name: 'Launching', value: launching },
    { name: 'Failed', value: failed },
    { name: 'Other', value: campaigns.length - active - launching - failed },
  ].filter(d => d.value > 0);

  const columns = [
    {
      key: 'store',
      label: 'Store',
      render: (c: any) => (
        <div>
          <p className="text-slate-200 text-sm">{c.stores?.name || '—'}</p>
          <p className="text-xs text-slate-500">/{c.stores?.slug}</p>
        </div>
      ),
    },
    {
      key: 'platform',
      label: 'Platform',
      render: (c: any) => (
        <span className={`badge border ${c.platform === 'meta' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
          {c.platform === 'meta' ? '📘 Meta' : '🎵 TikTok'}
        </span>
      ),
    },
    {
      key: 'objective',
      label: 'Objective',
      render: (c: any) => <span className="badge bg-slate-500/10 text-slate-400 border border-slate-500/20">{c.objective}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (c: any) => <StatusBadge status={c.status} />,
    },
    {
      key: 'budget_ngn',
      label: 'Budget',
      render: (c: any) => <span className="font-semibold text-amber-400">₦{(c.budget_ngn ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'ad_headline',
      label: 'Headline',
      render: (c: any) => <span className="text-slate-400 text-xs">{c.ad_headline?.slice(0, 30) || '—'}{(c.ad_headline?.length ?? 0) > 30 ? '…' : ''}</span>,
    },
    {
      key: 'target_gender',
      label: 'Audience',
      render: (c: any) => (
        <div className="text-xs text-slate-500">
          <p>{c.target_gender || 'all'} · {c.target_age_min}–{c.target_age_max}</p>
          <p>{(c.target_locations ?? []).join(', ').slice(0, 20)}</p>
        </div>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (c: any) => (
        <span className="text-slate-500 text-xs">{c.created_at ? format(new Date(c.created_at), 'dd MMM yyyy') : '—'}</span>
      ),
    },
  ];

  return (
    <div className="min-h-full">
      <Header title="Ad Campaigns" subtitle={`${campaigns.length} campaigns across all stores`} />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Campaigns" value={campaigns.length} icon={<Megaphone className="w-5 h-5" />} color="indigo"  delay={0}    />
          <StatCard title="Active"          value={active}           icon={<Play className="w-5 h-5" />}      color="emerald" delay={0.05} />
          <StatCard title="Launching"       value={launching}        icon={<Clock className="w-5 h-5" />}     color="amber"   delay={0.1}  />
          <StatCard title="Failed"          value={failed}           icon={<AlertCircle className="w-5 h-5" />} color="rose"  delay={0.15} />
        </div>

        {/* Charts + budget */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-5 border border-white/5">
            <h3 className="font-semibold text-slate-200 mb-2">By Platform</h3>
            {platformDist.length > 0 ? (
              <DonutChart data={platformDist} />
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-600 text-sm">No campaigns yet</div>
            )}
          </div>
          <div className="glass rounded-2xl p-5 border border-white/5">
            <h3 className="font-semibold text-slate-200 mb-2">By Status</h3>
            {statusDist.length > 0 ? (
              <DonutChart data={statusDist} />
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-600 text-sm">No campaigns yet</div>
            )}
          </div>
          <div className="glass rounded-2xl p-5 border border-white/5 space-y-4">
            <h3 className="font-semibold text-slate-200">Budget Summary</h3>
            <div className="space-y-3">
              {[
                { label: 'Total Budget',       value: `₦${totalBudget.toLocaleString()}`, color: 'text-indigo-400' },
                { label: 'Meta Campaigns',     value: meta.toString(),                    color: 'text-sky-400' },
                { label: 'TikTok Campaigns',   value: tiktok.toString(),                  color: 'text-rose-400' },
                { label: 'Active Now',         value: active.toString(),                  color: 'text-emerald-400' },
                { label: 'Need Attention',     value: (failed + launching).toString(),    color: 'text-amber-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm text-slate-400">{label}</span>
                  <span className={`font-semibold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="glass rounded-2xl p-5 border border-white/5">
          <h3 className="font-semibold text-slate-200 mb-4">All Campaigns</h3>
          <DataTable
            columns={columns}
            data={campaigns}
            searchFields={['ad_headline', 'objective', 'platform']}
            searchPlaceholder="Search by headline, platform…"
            pageSize={20}
          />
        </div>
      </div>
    </div>
  );
}
