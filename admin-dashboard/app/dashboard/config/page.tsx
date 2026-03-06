'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Save, RefreshCw, CheckCircle, AlertCircle, Tag, Link, FileText, Shield, Smartphone } from 'lucide-react';

interface FieldDef { key: string; label: string; placeholder: string; help: string; multiline?: boolean }
interface FieldGroup { group: string; icon: React.ElementType; color: string; bg: string; fields: FieldDef[] }

const FIELDS: FieldGroup[] = [
  {
    group: 'Version Control',
    icon: Tag,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    fields: [
      { key: 'current_version', label: 'Current Version', placeholder: '1.0.0', help: 'Latest app version. Users below this will see an optional update prompt.' },
      { key: 'min_version', label: 'Minimum Version', placeholder: '1.0.0', help: 'Minimum required version. Users below this will see a BLOCKING update prompt.' },
    ],
  },
  {
    group: 'Download URLs',
    icon: Link,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    fields: [
      { key: 'android_download_url', label: 'Android Download URL', placeholder: 'https://github.com/…/releases/latest', help: 'Where Android users download the latest APK.' },
      { key: 'ios_download_url', label: 'iOS Download URL', placeholder: 'https://apps.apple.com/…', help: 'App Store URL for iOS users (leave blank if iOS not available).' },
    ],
  },
  {
    group: 'Release Notes',
    icon: FileText,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    fields: [
      { key: 'release_notes', label: 'Release Notes', placeholder: 'What\'s new in this version…', help: 'Shown in update prompt. Keep it short and friendly.', multiline: true },
    ],
  },
];

export default function ConfigPage() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    fetch('/api/config-read')
      .then(r => r.json())
      .then(data => { setConfig(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setToast({ type: 'success', msg: 'Configuration saved successfully!' });
      } else {
        setToast({ type: 'error', msg: 'Failed to save. Please try again.' });
      }
    } catch {
      setToast({ type: 'error', msg: 'Network error. Check your connection.' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="min-h-full">
      <Header title="App Config" subtitle="Manage version control and app-wide settings" />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-6 space-y-6 max-w-3xl">
        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 border border-indigo-500/20 bg-indigo-500/5"
        >
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-indigo-300 mb-1">How Version Control Works</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                When a user opens CartY, the app checks its version against <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">current_version</code>.
                If the server version is newer, it shows an <strong>optional</strong> update dialog.
                If the server <code className="text-rose-300 bg-rose-500/10 px-1 rounded">min_version</code> is higher than the user's installed version,
                it shows a <strong>blocking</strong> (required) update dialog that cannot be dismissed.
                Changes here take effect immediately — no code deployment needed.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Config sections */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : (
          FIELDS.map(({ group, icon: Icon, color, bg, fields }, gi) => (
            <motion.div
              key={group}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.1 }}
              className="glass rounded-2xl p-5 border border-white/5"
            >
              <div className="flex items-center gap-2 mb-5">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <h3 className="font-semibold text-slate-200">{group}</h3>
              </div>

              <div className="space-y-4">
                {fields.map(({ key, label, placeholder, help, multiline }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
                    {multiline ? (
                      <textarea
                        value={config[key] ?? ''}
                        onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        rows={3}
                        className="input-glass w-full px-3 py-2.5 text-sm resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={config[key] ?? ''}
                        onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="input-glass w-full px-3 py-2.5 text-sm"
                      />
                    )}
                    <p className="text-xs text-slate-600">{help}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))
        )}

        {/* Live preview */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-2xl p-5 border border-white/5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Smartphone className="w-4 h-4 text-slate-400" />
              <h3 className="font-semibold text-slate-200">Update Dialog Preview</h3>
            </div>
            <div className="flex gap-4">
              {/* Optional update preview */}
              <div className="flex-1 bg-navy-800 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Optional Update</p>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-200">Update Available</p>
                  <p className="text-xs text-slate-400">CartY v{config.current_version || '—'} is available.</p>
                  <p className="text-xs text-slate-500 mt-1 italic">{config.release_notes || '—'}</p>
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs px-3 py-1 rounded-lg bg-white/5 text-slate-400">Later</span>
                    <span className="text-xs px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-400">Update</span>
                  </div>
                </div>
              </div>
              {/* Required update preview */}
              <div className="flex-1 bg-navy-800 rounded-xl p-4 border border-rose-500/20">
                <p className="text-xs text-rose-400 mb-2 font-medium uppercase tracking-wider">Required Update</p>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-200">Update Required</p>
                  <p className="text-xs text-slate-400">A required update to v{config.current_version || '—'} is available.</p>
                  <p className="text-xs text-slate-500 mt-1 italic">{config.release_notes || '—'}</p>
                  <div className="mt-3">
                    <span className="text-xs px-3 py-1 rounded-lg bg-rose-500/20 text-rose-400">Update Now</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Save button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
            ) : (
              <><Save className="w-4 h-4" /> Save Configuration</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
