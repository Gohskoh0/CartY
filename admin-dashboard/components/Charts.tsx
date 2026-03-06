'use client';

import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { motion } from 'framer-motion';

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(10,15,30,0.95)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: '#E2E8F0',
  fontSize: '13px',
};

// ── Area chart (revenue/orders over time) ──────────────────────────────────

interface AreaData { month: string; [key: string]: number | string }

export function RevenueAreaChart({ data, dataKey = 'revenue', color = '#6366F1', label = 'Revenue' }: {
  data: AreaData[]; dataKey?: string; color?: string; label?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94A3B8' }} formatter={(v: any) => [`₦${Number(v).toLocaleString()}`, label]} />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#grad-${dataKey})`} dot={false} activeDot={{ r: 5, fill: color, strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ── Bar chart ──────────────────────────────────────────────────────────────

export function OrdersBarChart({ data }: { data: { month: string; orders: number }[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94A3B8' }} formatter={(v: any) => [v, 'Orders']} />
          <Bar dataKey="orders" fill="url(#bar-grad)" radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ── User growth line chart ─────────────────────────────────────────────────

export function UserGrowthChart({ data }: { data: { month: string; users: number }[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94A3B8' }} formatter={(v: any) => [v, 'New Users']} />
          <Line type="monotone" dataKey="users" stroke="#38BDF8" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#38BDF8', strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ── Donut/Pie chart ────────────────────────────────────────────────────────

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#F43F5E', '#38BDF8', '#8B5CF6'];

export function DonutChart({ data, title }: { data: { name: string; value: number }[]; title?: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="h-64 flex flex-col items-center">
      {title && <p className="text-sm text-slate-500 mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name) => [`${v}`, name]} />
          <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: '#94A3B8', fontSize: '12px' }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ── Dual bar chart (revenue + orders) ─────────────────────────────────────

export function DualBarChart({ data }: { data: { month: string; revenue: number; orders: number }[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#6366F1" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94A3B8' }} formatter={(v: any, name) => [name === 'revenue' ? `₦${Number(v).toLocaleString()}` : v, name === 'revenue' ? 'Revenue' : 'Orders']} />
          <Bar yAxisId="left" dataKey="revenue" fill="url(#rev-grad)" radius={[4, 4, 0, 0]} maxBarSize={30} />
          <Bar yAxisId="right" dataKey="orders" fill="rgba(16,185,129,0.6)" radius={[4, 4, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
