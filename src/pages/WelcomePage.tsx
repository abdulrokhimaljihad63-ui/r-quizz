import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';

interface WelcomePageProps {
  onOpenAdminLogin: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onOpenAdminLogin }) => {
  const { loginStudentWithGoogle, authError, clearAuthError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    clearAuthError();
    setLocalError(null);
    setSubmitting(true);
    try {
      await loginStudentWithGoogle();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Gagal masuk dengan Google.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen flex flex-col rquizz-cyber-bg text-slate-100">
      <header className="bg-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo size="sm" showText />
          <button
            type="button"
            onClick={onOpenAdminLogin}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-white/5 border border-white/15 rounded-lg hover:border-cyan-400/50 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            Masuk Admin
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md mx-auto space-y-8 text-center">
          <div className="flex flex-col items-center space-y-3">
            <Logo size="lg" showText={false} />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              selamat datang di RQuizz
            </h1>
          </div>

          {displayError && (
            <div className="rounded-xl bg-red-950/75 border border-red-400/40 px-4 py-3 text-xs text-red-200 text-left backdrop-blur-md">
              {displayError}
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleGoogleLogin()}
              className="w-full inline-flex items-center justify-center gap-3 px-5 py-3.5 text-sm font-bold text-slate-900 bg-white rounded-2xl hover:bg-slate-100 transition-colors disabled:opacity-60 shadow-[0_0_24px_rgba(236,72,153,0.28)]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.19v3.15C3.17 21.36 7.23 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.19C.43 8.12 0 9.87 0 12s.43 3.88 1.19 5.42l4.09-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.64 1.19 6.58l4.09 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              {submitting ? 'menghubungkan...' : 'masuk dengan google'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
