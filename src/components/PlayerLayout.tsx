import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, Menu, Trophy, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLeaderboardMonitor } from '../hooks/useLeaderboardMonitor';
import { Logo } from './Logo';

export type PlayerNavTab =
  | 'dashboard'
  | 'leaderboard'
  | 'history'
  | 'profile';

interface PlayerLayoutProps {
  activeTab: PlayerNavTab;
  showOverallLeaderBar?: boolean;
  onNavigate: (tab: PlayerNavTab) => void;
  onStartQuickExam: () => void;
  playerName: string;
  absenNumber?: number;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: PlayerNavTab; label: string }> = [
  { id: 'dashboard', label: 'Beranda' },
  { id: 'leaderboard', label: 'Peringkat' },
  { id: 'history', label: 'Riwayat' },
  { id: 'profile', label: 'Profil' },
];

export const PlayerLayout: React.FC<PlayerLayoutProps> = ({
  activeTab,
  showOverallLeaderBar = false,
  onNavigate,
  onStartQuickExam,
  playerName,
  absenNumber,
  children,
}) => {
  const { player } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const {
    overallTopLeaderName,
    overallLoaded,
    currentNotification,
    dismissCurrentNotification,
  } = useLeaderboardMonitor(player?.uid);

  return (
    <div className="min-h-screen flex flex-col rquizz-cyber-bg text-slate-100">
      {/* Pitch-black seamless header */}
      <header className="sticky top-0 z-30 bg-black/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand */}
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-lg"
          >
            <Logo size="sm" showText />
          </button>

          {/* Zone 2: Concise single-line nav links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    isActive
                      ? 'text-cyan-300 border-cyan-400 font-bold'
                      : 'text-slate-300 border-transparent hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden lg:inline text-xs text-slate-300 max-w-[200px] truncate">
              {playerName}
              {absenNumber ? ` · Absen ${absenNumber}` : ''}
            </span>
            <button
              type="button"
              onClick={onStartQuickExam}
              className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 rounded-lg hover:bg-emerald-300 transition-colors whitespace-nowrap shrink-0"
            >
              Mulai Ujian
            </button>
            <button
              type="button"
              aria-label="Menu Navigasi"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-lg text-slate-200 hover:bg-white/10 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#070410]/95 backdrop-blur-xl px-4 py-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                      : 'text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onStartQuickExam();
              }}
              className="w-full mt-2 px-4 py-2.5 text-sm font-bold text-slate-950 bg-emerald-400 rounded-lg hover:bg-emerald-300 transition-colors"
            >
              Mulai Ujian
            </button>
          </div>
        )}
      </header>

      {/* Edge-to-edge Single-Line Yellow #1 Overall Leader Banner on Beranda */}
      {showOverallLeaderBar && (
        <div
          aria-live="polite"
          className="w-full bg-yellow-400 text-slate-950 px-4 py-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
        >
          <Trophy className="w-4 h-4 text-slate-950 shrink-0" />
          <span className="truncate">
            Peringkat 1 Keseluruhan:{' '}
            <span className="font-extrabold">
              {!overallLoaded ? 'Memuat...' : overallTopLeaderName || 'Belum ada'}
            </span>
          </span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        {children}
      </main>

      {/* Real-time Bottom Rank Change Notification */}
      <AnimatePresence>
        {currentNotification && (
          <motion.div
            key={currentNotification.id}
            role="status"
            aria-live="polite"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 36 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 36 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg"
          >
            <div
              className={`bg-[#0d071b]/95 backdrop-blur-xl border rounded-2xl px-4 py-3 shadow-2xl flex items-center justify-between gap-3 ${
                currentNotification.direction === 'up'
                  ? 'border-emerald-400/60 shadow-[0_10px_30px_rgba(52,211,153,0.22)]'
                  : 'border-rose-400/60 shadow-[0_10px_30px_rgba(251,113,133,0.22)]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {currentNotification.direction === 'up' ? (
                  <ArrowUpRight className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <p className="text-xs sm:text-sm font-semibold text-white leading-snug">
                  {currentNotification.message}
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup notifikasi peringkat"
                onClick={dismissCurrentNotification}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
