'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  title: string;
  value: string | number;
  icon: React.ReactNode;           // rendered JSX — safe to pass from server→client
  trend?: number;
  trendLabel?: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet';
  delay?: number;
}

const colorMap = {
  indigo:  { bg: 'bg-indigo-500/10',  iconCls: 'text-indigo-400',  border: 'border-indigo-500/20'  },
  emerald: { bg: 'bg-emerald-500/10', iconCls: 'text-emerald-400', border: 'border-emerald-500/20' },
  amber:   { bg: 'bg-amber-500/10',   iconCls: 'text-amber-400',   border: 'border-amber-500/20'   },
  rose:    { bg: 'bg-rose-500/10',    iconCls: 'text-rose-400',    border: 'border-rose-500/20'    },
  sky:     { bg: 'bg-sky-500/10',     iconCls: 'text-sky-400',     border: 'border-sky-500/20'     },
  violet:  { bg: 'bg-violet-500/10',  iconCls: 'text-violet-400',  border: 'border-violet-500/20'  },
};

export default function StatCard({ title, value, icon, trend, trendLabel, color = 'indigo', delay = 0 }: Props) {
  const c = colorMap[color];
  const TrendIcon = trend === undefined ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend === undefined ? 'text-slate-500' : trend > 0 ? 'text-emerald-400' : 'text-rose-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={clsx('glass rounded-2xl p-5 border glass-hover relative overflow-hidden', c.border)}
    >
      <div className={clsx('absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-50', c.bg)} />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', c.bg, c.iconCls)}>
            {icon}
          </div>
          {trend !== undefined && (
            <div className={clsx('flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg', trendColor, trend > 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>
              <TrendIcon className="w-3 h-3" />
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <p className="text-2xl font-bold text-slate-100 tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-sm text-slate-500 font-medium mt-1">{title}</p>
        {trendLabel && <p className="text-xs text-slate-600 mt-0.5">{trendLabel}</p>}
      </div>
    </motion.div>
  );
}
