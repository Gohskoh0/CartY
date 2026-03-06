'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import { UserGrowthChart } from '@/components/Charts';
import { Users, ShieldCheck, Globe, Smartphone } from 'lucide-react';
import { format } from 'date-fns';

export default function UsersPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data?page=users')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-full">
        <Header title="Users" subtitle="Loading…" />
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl h-24 animate-pulse border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const { users, count, growth } = data;

  const verified = users.filter((u: any) => u.is_phone_verified).length;
  const withPush = users.filter((u: any) => u.push_token).length;
  const countries = [...new Set(users.map((u: any) => u.country))].length;

  const columns = [
    {
      key: 'phone',
      label: 'Phone',
      render: (u: any) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 text-xs font-bold">
            {u.phone?.slice(-2)}
          </div>
          <span className="font-mono text-slate-300">{u.phone}</span>
        </div>
      ),
    },
    {
      key: 'country',
      label: 'Country',
      render: (u: any) => (
        <span className="badge bg-slate-500/10 text-slate-400 border border-slate-500/20">{u.country || '—'}</span>
      ),
    },
    {
      key: 'state',
      label: 'State',
      render: (u: any) => <span className="text-slate-500 text-xs">{u.state || '—'}</span>,
    },
    {
      key: 'is_phone_verified',
      label: 'Verified',
      render: (u: any) => u.is_phone_verified
        ? <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">✓ Verified</span>
        : <span className="badge bg-rose-500/15 text-rose-400 border border-rose-500/20">✗ Unverified</span>,
    },
    {
      key: 'push_token',
      label: 'Push',
      render: (u: any) => u.push_token
        ? <span className="badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">Enabled</span>
        : <span className="text-slate-600 text-xs">—</span>,
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (u: any) => (
        <span className="text-slate-500 text-xs">{u.created_at ? format(new Date(u.created_at), 'dd MMM yyyy') : '—'}</span>
      ),
    },
  ];

  return (
    <div className="min-h-full">
      <Header title="Users" subtitle={`${count.toLocaleString()} registered users`} />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Users" value={count} icon={<Users className="w-5 h-5" />} color="sky" delay={0} />
          <StatCard title="Verified" value={verified} icon={<ShieldCheck className="w-5 h-5" />} color="emerald" delay={0.05} />
          <StatCard title="Push Enabled" value={withPush} icon={<Smartphone className="w-5 h-5" />} color="indigo" delay={0.1} />
          <StatCard title="Countries" value={countries} icon={<Globe className="w-5 h-5" />} color="violet" delay={0.15} />
        </div>

        {/* Growth chart */}
        <div className="glass rounded-2xl p-5 border border-white/5">
          <h3 className="font-semibold text-slate-200 mb-1">New Users Per Month</h3>
          <p className="text-xs text-slate-500 mb-4">Last 12 months</p>
          <UserGrowthChart data={growth} />
        </div>

        {/* Table */}
        <div className="glass rounded-2xl p-5 border border-white/5">
          <h3 className="font-semibold text-slate-200 mb-4">All Users</h3>
          <DataTable
            columns={columns}
            data={users}
            searchFields={['phone', 'country', 'state']}
            searchPlaceholder="Search by phone, country…"
            pageSize={25}
            emptyMessage="No users found"
          />
        </div>
      </div>
    </div>
  );
}
