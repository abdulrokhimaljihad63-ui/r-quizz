import React, { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { parseAbsenNumber } from '../utils/dynamicAnswer';

interface WelcomePageProps {
  onOpenAdminLogin: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onOpenAdminLogin }) => {
  const { enterAsPlayer, authError, clearAuthError } = useAuth();
  const [name, setName] = useState('');
  const [absenInput, setAbsenInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalError(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setLocalError('Nama minimal 2 karakter.');
      return;
    }
    if (trimmed.length > 60) {
      setLocalError('Nama maksimal 60 karakter.');
      return;
    }

    const parsedAbsen = parseAbsenNumber(absenInput);
    if (parsedAbsen === null) {
      setLocalError('Nomor absen harus angka (1–999).');
      return;
    }

    setSubmitting(true);
    try {
      await enterAsPlayer(trimmed, parsedAbsen);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Gagal masuk.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo size="sm" showText />
          <button
            type="button"
            onClick={onOpenAdminLogin}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg hover:border-blue-200 transition-colors whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            Masuk Admin
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="player-name"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Nama
              </label>
              <input
                id="player-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masukkan nama"
                maxLength={60}
                required
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="player-absen"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                No. Absen
              </label>
              <input
                id="player-absen"
                type="text"
                inputMode="numeric"
                value={absenInput}
                onChange={(e) => setAbsenInput(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                placeholder="Contoh: 07"
                maxLength={3}
                required
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            {displayError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
                {displayError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {submitting ? 'Memproses...' : 'Masuk ke Dashboard'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
