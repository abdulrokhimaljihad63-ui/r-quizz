import React, { useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Compass,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { Footer } from './Footer';
import { Logo } from './Logo';

export type AdminTab =
  | 'dashboard'
  | 'questions'
  | 'categories'
  | 'journey'
  | 'players'
  | 'results'
  | 'settings';

interface AdminLayoutProps {
  activeTab: AdminTab;
  onNavigate: (tab: AdminTab) => void;
  adminEmail: string;
  onLogout: () => void;
  children: React.ReactNode;
}

const ADMIN_NAV: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'questions', label: 'Bank Soal', icon: BookOpen },
  { id: 'categories', label: 'Kategori', icon: FolderKanban },
  { id: 'journey', label: 'Milestone & Urutan', icon: Compass },
  { id: 'players', label: 'Pemain', icon: Users },
  { id: 'results', label: 'Hasil Sesi', icon: BarChart3 },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  activeTab,
  onNavigate,
  adminEmail,
  onLogout,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Toggle Menu Admin"
              onClick={() => setSidebarOpen((p) => !p)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Logo size="sm" showText />
            <span className="hidden sm:inline text-xs font-medium text-blue-600 border-l border-slate-200 pl-3">
              Admin Panel
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-500 max-w-[200px] truncate">
              {adminEmail}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6 items-start">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:block w-56 shrink-0 bg-white border border-slate-200 rounded-2xl p-3 space-y-1 sticky top-22">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Mobile Drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/40"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="relative w-64 max-w-[80vw] bg-white h-full p-4 space-y-1.5 shadow-xl">
              <div className="pb-3 mb-3 border-b border-slate-200">
                <Logo size="sm" showText />
                <p className="text-xs text-slate-500 mt-1 truncate">{adminEmail}</p>
              </div>
              {ADMIN_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      <Footer />
    </div>
  );
};
