import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, Info } from 'lucide-react';
import { Footer } from '../components/Footer';
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
      setLocalError('Masukkan nama lengkap atau panggilan minimal 2 karakter.');
      return;
    }
    if (trimmed.length > 60) {
      setLocalError('Nama maksimal 60 karakter.');
      return;
    }

    const parsedAbsen = parseAbsenNumber(absenInput);
    if (parsedAbsen === null) {
      setLocalError('Masukkan Nomor Absen berupa angka yang valid (1–999).');
      return;
    }

    setSubmitting(true);
    try {
      await enterAsPlayer(trimmed, parsedAbsen);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Gagal masuk ke aplikasi.');
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

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Intro Section */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <div className="flex items-center gap-4">
              <Logo size="lg" showText={false} />
              <div>
                <p className="text-sm font-medium text-blue-600">
                  Persiapan Uji Kompetensi Keahlian
                </p>
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
                  UKK Challenge — Latihan Interaktif XII TKJ
                </h1>
              </div>
            </div>

            <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
              Platform latihan mandiri dan simulasi ujian untuk materi Administrasi Sistem
              Jaringan: MikroTik, Debian 12, MariaDB, Apache &amp; PHP, Moodle, Backup,
              Upgrade, dan Troubleshooting.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-slate-900 mb-1">
                  Pemeriksaan Sintaks Real-Time
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Setiap karakter, huruf kapital, spasi, dan simbol diperiksa langsung di
                  terminal interaktif.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-slate-900 mb-1">
                  5 Mode Latihan &amp; Simulasi
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Guided Syntax, Blind Syntax, Troubleshooting, Exam Challenge, dan Syntax
                  Journey.
                </p>
              </div>
            </div>
          </div>

          {/* Right Entry Form */}
          <div className="lg:col-span-5 flex">
            <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Mulai Latihan</h2>
                <p className="text-sm text-slate-500 mb-6">
                  Masukkan namamu untuk menyimpan progres, riwayat, dan skor leaderboard.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="player-name"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Nama Lengkap / Nama Panggilan
                    </label>
                    <input
                      id="player-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: Ahmad XIITKJ1"
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
                      Nomor Absen
                    </label>
                    <input
                      id="player-absen"
                      type="text"
                      inputMode="numeric"
                      value={absenInput}
                      onChange={(e) => setAbsenInput(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                      placeholder="Contoh: 07 atau 15"
                      maxLength={3}
                      required
                      className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Wajib diisi untuk penyesuaian konfigurasi IP Address &amp; soal dinamis pada
                      semua mode permainan.
                    </p>
                  </div>

                  {displayError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 leading-relaxed">
                      {displayError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Membuat Sesi Pemain...' : 'Masuk ke Dashboard'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Tidak perlu email atau password. Identitasmu dibuat otomatis menggunakan
                  Firebase Anonymous Auth dan tersimpan di perangkat ini.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
