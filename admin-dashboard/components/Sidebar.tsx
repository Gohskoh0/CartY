'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Store, ShoppingBag, TrendingUp,
  CreditCard, Megaphone, Settings, LogOut, ChevronLeft,
  ChevronRight, ShieldCheck, Zap,
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview', color: 'text-indigo-400' },
  { href: '/dashboard/users', icon: Users, label: 'Users', color: 'text-sky-400' },
  { href: '/dashboard/stores', icon: Store, label: 'Stores', color: 'text-violet-400' },
  { href: '/dashboard/orders', icon: ShoppingBag, label: 'Orders', color: 'text-emerald-400' },
  { href: '/dashboard/revenue', icon: TrendingUp, label: 'Revenue', color: 'text-amber-400' },
  { href: '/dashboard/subscriptions', icon: CreditCard, label: 'Subscriptions', color: 'text-rose-400' },
  { href: '/dashboard/ads', icon: Megaphone, label: 'Ad Campaigns', color: 'text-sky-400' },
  { href: '/dashboard/config', icon: Settings, label: 'App Config', color: 'text-slate-400' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col h-screen bg-navy-900/80 backdrop-blur-xl border-r border-white/5 shrink-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <p className="font-bold text-sm gradient-text">CartY</p>
              <p className="text-xs text-slate-500">Admin Dashboard</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label, color }) => {
          const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden',
                isActive
                  ? 'nav-active'
                  : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/10 to-violet-500/5"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              <Icon className={clsx('w-4.5 h-4.5 shrink-0 relative z-10', isActive ? color : 'group-hover:' + color)} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-medium relative z-10 whitespace-nowrap"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-4 border-t border-white/5 space-y-1">
        <button
          onClick={logout}
          disabled={loggingOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 group"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm font-medium">
                {loggingOut ? 'Signing out…' : 'Sign Out'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-6 -right-3 w-6 h-6 rounded-full bg-navy-700 border border-white/10 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-indigo-500/30 transition-all z-50 shadow-lg"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </motion.aside>
  );
}
