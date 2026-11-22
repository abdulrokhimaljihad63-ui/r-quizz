import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';

export type PlayerNavTab =
  | 'dashboard'
  | 'leaderboard'
  | 'history'
  | 'profile';

interface PlayerLayoutProps {
  activeTab: PlayerNavTab;
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
  onNavigate,
  onStartQuickExam,
  playerName,
  absenNumber,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Three-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand */}
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg"
          >
            <Logo size="sm" showText />
          </button>

          {/* Zone 2: Concise single-line nav links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    isActive
                      ? 'text-blue-600 border-blue-600 font-semibold'
                      : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden lg:inline text-xs text-slate-500 max-w-[200px] truncate">
              {playerName}
              {absenNumber ? ` · Absen ${absenNumber}` : ''}
            </span>
            <button
              type="button"
              onClick={onStartQuickExam}
              className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              Mulai Ujian
            </button>
            <button
              type="button"
              aria-label="Menu Navigasi"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
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
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
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
              className="w-full mt-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Mulai Ujian
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        {children}
      </main>
    </div>
  );
};
