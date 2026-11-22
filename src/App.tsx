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
import { ModeSelectPage } from './pages/player/ModeSelectPage';
import { ProfilePage } from './pages/player/ProfilePage';
import { QuizSessionPage } from './pages/player/QuizSessionPage';
import { ResultsPage } from './pages/player/ResultsPage';
import { SyntaxJourneyPage } from './pages/player/SyntaxJourneyPage';
import { WelcomePage } from './pages/WelcomePage';
import type { ActiveSessionResult, GameMode } from './types';
import { parseAbsenNumber } from './utils/dynamicAnswer';

function AppRouter() {
  const { authReady, firebaseUser, player, isAdmin, logoutAdmin, updatePlayerAbsenNumber } = useAuth();
  const [absenPromptInput, setAbsenPromptInput] = useState('');
  const [absenPromptSaving, setAbsenPromptSaving] = useState(false);
  const [absenPromptError, setAbsenPromptError] = useState<string | null>(null);

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-500">Menghubungkan ke UKK Challenge...</p>
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

  // Player Onboarding
  if (!player) {
    return <WelcomePage onOpenAdminLogin={() => setShowAdminLogin(true)} />;
  }

  // Legacy Player Gate: ensure existing players without absenNumber fill it before playing
  if (parseAbsenNumber(player.absenNumber) === null) {
    const handleCompleteAbsen = async (e: React.FormEvent) => {
      e.preventDefault();
      setAbsenPromptError(null);
      const parsed = parseAbsenNumber(absenPromptInput);
      if (parsed === null) {
        setAbsenPromptError('Masukkan Nomor Absen berupa angka yang valid (1–999).');
        return;
      }
      setAbsenPromptSaving(true);
      try {
        await updatePlayerAbsenNumber(parsed);
      } catch (err) {
        setAbsenPromptError(err instanceof Error ? err.message : 'Gagal menyimpan nomor absen.');
      } finally {
        setAbsenPromptSaving(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
          <div>
            <p className="text-xs font-medium text-blue-600">Lengkapi Identitas · {player.name}</p>
            <h1 className="text-xl font-bold text-slate-900 mt-1">Masukkan Nomor Absen</h1>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              Nomor absen wajib diisi sebelum memulai permainan agar soal dinamis dan konfigurasi IP
              Address menyesuaikan nomor absenmu.
            </p>
          </div>
          <form onSubmit={handleCompleteAbsen} className="space-y-4">
            <div>
              <label htmlFor="legacy-absen" className="block text-sm font-medium text-slate-700 mb-1.5">
                Nomor Absen
              </label>
              <input
                id="legacy-absen"
                type="text"
                inputMode="numeric"
                value={absenPromptInput}
                onChange={(e) => setAbsenPromptInput(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                placeholder="Contoh: 07 atau 15"
                maxLength={3}
                required
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
            {absenPromptError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {absenPromptError}
              </p>
            )}
            <button
              type="submit"
              disabled={absenPromptSaving}
              className="w-full px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {absenPromptSaving ? 'Menyimpan...' : 'Simpan & Lanjutkan'}
            </button>
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
      setPlayerTab('modes');
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

  return (
    <PlayerLayout
      activeTab={playerTab}
      onNavigate={navigatePlayer}
      onStartQuickExam={() => startQuiz('ujian', 'all')}
      playerName={player.name}
      absenNumber={player.absenNumber}
    >
      {activePractice ? (
        <SyntaxJourneyPage
          onBackToModes={() => {
            setActivePractice(false);
            setPlayerTab('modes');
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
            setPlayerTab('modes');
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
          {playerTab === 'modes' && <ModeSelectPage onStartMode={startQuiz} />}
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
