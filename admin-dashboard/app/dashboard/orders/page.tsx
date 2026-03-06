import Header from '@/components/Header';
import DataTable, { StatusBadge } from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import { OrdersBarChart } from '@/components/Charts';
import { getAllOrders, getMonthlyTrend } from '@/lib/data';
import { ShoppingBag, CheckCircle, Clock, XCircle, TrendingUp } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export const revalidate = 60;

export default async function OrdersPage() {
  const [{ data: orders, count }, trend] = await Promise.all([
    getAllOrders(0, 500),
    getMonthlyTrend(),
  ]);

  const paid      = orders.filter((o: any) => o.status === 'paid').length;
  const pending   = orders.filter((o: any) => o.status === 'pending').length;
  const cancelled = orders.filter((o: any) => o.status === 'cancelled').length;
  const gmv       = orders.filter((o: any) => o.status === 'paid').reduce((s: number, o: any) => s + (o.total_amount ?? 0), 0);

  const columns = [
    {
      key: 'buyer',
      label: 'Buyer',
      render: (o: any) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs font-bold">
            {(o.buyer_name || 'B')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-slate-200 text-sm">{o.buyer_name}</p>
            <p className="text-xs text-slate-500 font-mono">{o.buyer_phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'store',
      label: 'Store',
      render: (o: any) => (
        <div>
          <p className="text-slate-300 text-sm">{(o as any).stores?.name || '—'}</p>
          <p className="text-xs text-slate-600">/{(o as any).stores?.slug}</p>
        </div>
      ),
    },
    {
      key: 'total_amount',
      label: 'Amount',
      render: (o: any) => (
        <span className="font-semibold text-emerald-400">₦{(o.total_amount ?? 0).toLocaleString()}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (o: any) => <StatusBadge status={o.status} />,
    },
    {
      key: 'payment_reference',
      label: 'Reference',
      render: (o: any) => (
        <span className="font-mono text-xs text-slate-500">{o.payment_reference?.slice(0, 18) || '—'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (o: any) => (
        <div>
          <p className="text-slate-400 text-xs">{o.created_at ? format(new Date(o.created_at), 'dd MMM yyyy') : '—'}</p>
          <p className="text-slate-600 text-xs">{o.created_at ? formatDistanceToNow(new Date(o.created_at), { addSuffix: true }) : ''}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-full">
      <Header title="Orders" subtitle={`${count.toLocaleString()} total orders`} />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Orders" value={count}                             icon={ShoppingBag}  color="emerald" delay={0}    />
          <StatCard title="Paid"         value={paid}                              icon={CheckCircle}  color="emerald" delay={0.05} />
          <StatCard title="Pending"      value={pending}                           icon={Clock}        color="amber"   delay={0.1}  />
          <StatCard title="GMV (Paid)"   value={`₦${gmv.toLocaleString()}`}        icon={TrendingUp}   color="indigo"  delay={0.15} />
        </div>

        {/* Chart */}
        <div className="glass rounded-2xl p-5 border border-white/5">
          <h3 className="font-semibold text-slate-200 mb-1">Orders Over Time</h3>
          <p className="text-xs text-slate-500 mb-4">Monthly order volume — last 12 months</p>
          <OrdersBarChart data={trend} />
        </div>

        {/* Table */}
        <div className="glass rounded-2xl p-5 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200">All Orders</h3>
            <div className="flex gap-2 flex-wrap">
              {[
                { status: 'paid',      cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                { status: 'pending',   cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                { status: 'cancelled', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
              ].map(({ status, cls }) => (
                <span key={status} className={`badge border ${cls}`}>
                  {status}: {orders.filter((o: any) => o.status === status).length}
                </span>
              ))}
            </div>
          </div>
          <DataTable
            columns={columns}
            data={orders}
            searchFields={['buyer_name', 'buyer_phone']}
            searchPlaceholder="Search by buyer name or phone…"
            pageSize={20}
          />
        </div>
      </div>
    </div>
  );
}
