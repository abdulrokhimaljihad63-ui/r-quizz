import React, { useState } from 'react';
import { AdminLayout, type AdminTab } from './components/AdminLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PlayerLayout, type PlayerNavTab } from './components/PlayerLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminResultsPage } from './pages/admin/AdminResultsPage';
import { GameSettingsPage } from './pages/admin/GameSettingsPage';
import { ManageCategoriesPage } from './pages/admin/ManageCategoriesPage';
import { ManagePlayersPage } from './pages/admin/ManagePlayersPage';
import { ManageQuestionsPage } from './pages/admin/ManageQuestionsPage';
import { ManageSyntaxJourneyPage } from './pages/admin/ManageSyntaxJourneyPage';
import { DashboardPage } from './pages/player/DashboardPage';
import { HistoryPage } from './pages/player/HistoryPage';
import { LeaderboardPage } from './pages/player/LeaderboardPage';
import { ProfilePage } from './pages/player/ProfilePage';
import { QuizSessionPage } from './pages/player/QuizSessionPage';
import { ResultsPage } from './pages/player/ResultsPage';
import { SyntaxJourneyPage } from './pages/player/SyntaxJourneyPage';
import { WelcomePage } from './pages/WelcomePage';
import { Logo } from './components/Logo';
import type { ActiveSessionResult, GameMode } from './types';
import { parseAbsenNumber } from './utils/dynamicAnswer';

function AppRouter() {
  const { authReady, firebaseUser, player, isAdmin, logoutAdmin, logoutPlayer, registerStudent } = useAuth();
  const [regName, setRegName] = useState(firebaseUser?.displayName || '');
  const [regAbsen, setRegAbsen] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [playerTab, setPlayerTab] = useState<PlayerNavTab>('dashboard');

  const [activePractice, setActivePractice] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<{
    mode: Exclude<GameMode, 'practice_only' | 'syntax_journey'>;
    categoryId: string | 'all';
    sessionKey: number;
  } | null>(null);

  const [lastResult, setLastResult] = useState<ActiveSessionResult | null>(null);

  if (!authReady) {
    return (
      <div className="min-h-screen rquizz-cyber-bg flex items-center justify-center p-6">
        <div className="text-center space-y-2.5">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-200">Menghubungkan ke RQuizz...</p>
        </div>
      </div>
    );
  }

  // Authenticated Admin Workspace
  if (isAdmin && firebaseUser) {
    return (
      <AdminLayout
        activeTab={adminTab}
        onNavigate={setAdminTab}
        adminEmail={firebaseUser.email || 'Admin'}
        onLogout={() => {
          void logoutAdmin();
          setShowAdminLogin(false);
        }}
      >
        {adminTab === 'dashboard' && <AdminDashboardPage onNavigate={setAdminTab} />}
        {adminTab === 'questions' && <ManageQuestionsPage />}
        {adminTab === 'categories' && <ManageCategoriesPage />}
        {adminTab === 'journey' && <ManageSyntaxJourneyPage />}
        {adminTab === 'players' && <ManagePlayersPage />}
        {adminTab === 'results' && <AdminResultsPage />}
        {adminTab === 'settings' && <GameSettingsPage />}
      </AdminLayout>
    );
  }

  // Admin Login View
  if (showAdminLogin) {
    return <AdminLoginPage onBack={() => setShowAdminLogin(false)} />;
  }

  // Not logged in at all -> Welcome Page (Google Sign-In)
  if (!firebaseUser) {
    return <WelcomePage onOpenAdminLogin={() => setShowAdminLogin(true)} />;
  }

  // Logged in with Google, but no player profile yet -> Student Registration Form
  if (!player) {
    const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setRegError(null);
      const trimmed = regName.trim();
      if (trimmed.length < 2) {
        setRegError('Nama minimal 2 karakter.');
        return;
      }
      const parsed = parseAbsenNumber(regAbsen);
      if (parsed === null) {
        setRegError('Nomor absen harus berupa angka antara 1 sampai 999.');
        return;
      }
      setRegSubmitting(true);
      try {
        await registerStudent(trimmed, parsed);
      } catch (err) {
        setRegError(err instanceof Error ? err.message : 'Gagal mendaftarkan profil.');
      } finally {
        setRegSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen rquizz-cyber-bg flex items-center justify-center p-6 text-slate-100">
        <div className="max-w-md w-full mx-auto px-6 py-8 space-y-7 text-center">
          <div className="flex flex-col items-center space-y-3">
            <Logo size="lg" showText={false} />
            <h1 className="text-2xl font-bold text-white tracking-tight">selamat datang di RQuizz</h1>
          </div>

          <form onSubmit={handleRegister} className="space-y-5 text-left">
            <div className="space-y-2">
              <label className="block text-base font-bold text-white">nama</label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="nama lengkap"
                maxLength={60}
                required
                className="w-full px-4 py-3 text-base font-semibold text-white placeholder:text-slate-400 bg-slate-950/75 backdrop-blur-md border border-fuchsia-400/35 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-base font-bold text-white">no absen</label>
              <input
                type="text"
                inputMode="numeric"
                value={regAbsen}
                onChange={(e) => setRegAbsen(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                placeholder="07"
                maxLength={3}
                required
                className="w-full px-4 py-3 text-base font-mono font-bold text-white placeholder:text-slate-400 bg-slate-950/75 backdrop-blur-md border border-fuchsia-400/35 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400"
              />
            </div>
            {regError && (
              <p className="text-xs text-red-200 bg-red-950/75 border border-red-400/40 rounded-lg px-3.5 py-2.5">
                {regError}
              </p>
            )}
            <div className="pt-2">
              <button
                type="submit"
                disabled={regSubmitting}
                className="w-full py-3.5 text-sm font-bold text-slate-950 bg-emerald-400 rounded-xl hover:bg-emerald-300 transition-colors disabled:opacity-60 shadow-[0_0_20px_rgba(52,211,153,0.28)]"
              >
                {regSubmitting ? 'memproses...' : 'simpan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const startQuiz = (mode: GameMode, categoryId: string | 'all' = 'all') => {
    if (mode === 'practice_only' || mode === 'syntax_journey') {
      setActiveQuiz(null);
      setLastResult(null);
      setActivePractice(true);
      setPlayerTab('dashboard');
      return;
    }
    setActivePractice(false);
    setLastResult(null);
    setActiveQuiz({
      mode,
      categoryId,
      sessionKey: Date.now(),
    });
  };

  const navigatePlayer = (tab: PlayerNavTab) => {
    setActivePractice(false);
    setActiveQuiz(null);
    setLastResult(null);
    setPlayerTab(tab);
  };

  const isDashboardView =
    !activePractice && !activeQuiz && !lastResult && playerTab === 'dashboard';

  return (
    <PlayerLayout
      activeTab={playerTab}
      showOverallLeaderBar={isDashboardView}
      onNavigate={navigatePlayer}
      onStartQuickExam={() => startQuiz('ujian', 'all')}
      playerName={player.name}
      absenNumber={player.absenNumber}
    >
      {activePractice ? (
        <SyntaxJourneyPage
          onBackToModes={() => {
            setActivePractice(false);
            setPlayerTab('dashboard');
          }}
        />
      ) : activeQuiz ? (
        <QuizSessionPage
          key={activeQuiz.sessionKey}
          mode={activeQuiz.mode}
          categoryId={activeQuiz.categoryId}
          onFinish={(res) => {
            setActiveQuiz(null);
            setLastResult(res);
          }}
          onExit={() => {
            setActiveQuiz(null);
            setPlayerTab('dashboard');
          }}
        />
      ) : lastResult ? (
        <ResultsPage
          result={lastResult}
          onPlayAgain={() => {
            const m = lastResult.session.mode;
            setLastResult(null);
            startQuiz(m, 'all');
          }}
          onGoDashboard={() => navigatePlayer('dashboard')}
          onGoLeaderboard={() => navigatePlayer('leaderboard')}
          onGoHistory={() => navigatePlayer('history')}
        />
      ) : (
        <>
          {playerTab === 'dashboard' && (
            <DashboardPage onNavigate={navigatePlayer} onStartMode={startQuiz} />
          )}
          {playerTab === 'leaderboard' && <LeaderboardPage />}
          {playerTab === 'history' && <HistoryPage />}
          {playerTab === 'profile' && (
            <ProfilePage onOpenAdminLogin={() => setShowAdminLogin(true)} />
          )}
        </>
      )}
    </PlayerLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
