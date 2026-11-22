import React, { useState } from 'react';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../contexts/AuthContext';

interface AdminLoginPageProps {
  onBack: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onBack }) => {
  const { loginAdminWithEmail, loginAdminWithGoogle, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalError(null);
    setLoading(true);
    try {
      await loginAdminWithEmail(email, password);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Gagal masuk sebagai admin.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    clearAuthError();
    setLocalError(null);
    setLoading(true);
    try {
      await loginAdminWithGoogle();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Gagal masuk dengan Google Admin.');
    } finally {
      setLoading(false);
    }
  };

  const errorText = localError || authError;

  return (
    <div className="min-h-screen flex flex-col rquizz-cyber-bg text-slate-100">
      <header className="bg-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo size="sm" showText />
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Halaman Pemain
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full rquizz-panel rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300">
              <ShieldCheck className="w-4 h-4" />
              Akses Terbatas Pengelola
            </div>
            <h1 className="text-2xl font-bold text-white">Login Admin RQuizz</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Masuk menggunakan akun admin terdaftar di Firebase Authentication untuk mengelola bank
              soal, kategori, Syntax Journey, dan pengaturan ujian.
            </p>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-xs font-semibold text-slate-200 mb-1.5">
                Email Admin
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@sekolah.sch.id"
                className="w-full px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 bg-black/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-200 mb-1.5">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 bg-black/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400"
              />
            </div>

            {errorText && (
              <div className="rounded-lg bg-red-950/75 border border-red-400/40 p-3 text-xs text-red-200 leading-relaxed">
                {errorText}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-950 bg-cyan-400 rounded-lg hover:bg-cyan-300 transition-colors disabled:opacity-60"
            >
              <Lock className="w-4 h-4" />
              {loading ? 'Memverifikasi...' : 'Masuk dengan Email & Password'}
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-white/15" />
            <span className="shrink mx-3 text-xs text-slate-400">atau</span>
            <div className="flex-grow border-t border-white/15" />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void handleGoogleLogin()}
            className="w-full px-4 py-2.5 text-sm font-semibold text-slate-100 bg-white/10 border border-white/20 rounded-lg hover:bg-white/15 transition-colors disabled:opacity-60"
          >
            Masuk dengan Google Admin Terverifikasi
          </button>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Tidak ada pendaftaran admin publik. Akun admin harus dibuat secara pribadi oleh
            pengelola melalui Firebase Console dan didaftarkan di koleksi <code>admins</code>.
          </p>
        </div>
      </main>
    </div>
  );
};
