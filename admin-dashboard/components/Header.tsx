'use client';

import { motion } from 'framer-motion';
import { Bell, RefreshCw, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

interface Props { title: string; subtitle?: string; }

export default function Header({ title, subtitle }: Props) {
  const router = useRouter();
  const now = new Date();

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-navy-950/80 backdrop-blur-xl"
    >
      <div>
        <h1 className="text-xl font-bold text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Date */}
        <div className="hidden md:flex items-center gap-2 glass rounded-lg px-3 py-1.5 text-xs text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          {format(now, 'EEE, dd MMM yyyy')}
        </div>

        {/* Refresh */}
        <button
          onClick={() => router.refresh()}
          className="w-9 h-9 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30 transition-all glass-hover"
          title="Refresh data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Notification bell (decorative) */}
        <button className="w-9 h-9 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-400 transition-all glass-hover relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 border border-navy-950" />
        </button>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">
          A
        </div>
      </div>
    </motion.header>
  );
}
