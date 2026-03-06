'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search, Download } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  pageSize?: number;
  emptyMessage?: string;
}

export default function DataTable<T extends Record<string, any>>({
  columns, data, keyField = 'id', searchPlaceholder = 'Search…',
  searchFields = [], pageSize = 20, emptyMessage = 'No data found',
}: Props<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const filtered = search && searchFields.length
    ? data.filter(row => searchFields.some(f => String(row[f] ?? '').toLowerCase().includes(search.toLowerCase())))
    : data;

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const slice = filtered.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const handleSearch = (v: string) => { setSearch(v); setPage(0); };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      {searchFields.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="input-glass w-full pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <span className="text-xs text-slate-500">{filtered.length.toLocaleString()} records</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-white/2">
              {columns.map(col => (
                <th key={col.key} className={clsx('px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap', col.className)}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-600">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              slice.map((row, i) => (
                <motion.tr
                  key={row[keyField] ?? i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-white/3 table-row-hover"
                >
                  {columns.map(col => (
                    <td key={col.key} className={clsx('px-4 py-3 text-slate-300 whitespace-nowrap', col.className)}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="w-8 h-8 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const pg = Math.max(0, Math.min(pages - 5, currentPage - 2)) + i;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={clsx(
                    'w-8 h-8 rounded-lg text-xs font-medium transition-all',
                    pg === currentPage
                      ? 'bg-indigo-500 text-white'
                      : 'glass text-slate-400 hover:text-slate-200'
                  )}
                >
                  {pg + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
              disabled={currentPage === pages - 1}
              className="w-8 h-8 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Status badge helper ────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    paid: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    completed: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    launching: 'bg-sky-500/15 text-sky-400 border border-sky-500/20',
    pending: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    draft: 'bg-slate-500/15 text-slate-400 border border-slate-500/20',
    inactive: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
    failed: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
    cancelled: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
  };
  return (
    <span className={clsx('badge', map[status] ?? 'bg-slate-500/15 text-slate-400')}>
      {status}
    </span>
  );
}
