import React, { useEffect, useState } from 'react';
import { BookOpen, FolderKanban, Plus, Users, BarChart3 } from 'lucide-react';
import { MODE_META } from '../../constants/defaults';
import { useAuth } from '../../contexts/AuthContext';
import { getAllPlayers, getAllSessions } from '../../services/firestoreService';
import type { GameMode, GameSession, Player } from '../../types';
import type { AdminTab } from '../../components/AdminLayout';

interface AdminDashboardPageProps {
  onNavigate: (tab: AdminTab) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate }) => {
  const { questions, categories, syntaxPaths, syntaxStages } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([getAllPlayers(), getAllSessions()])
      .then(([pList, sList]) => {
        if (!active) return;
        setPlayers(pList);
        setSessions(sList);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeQuestions = questions.filter((q) => q.active).length;
  const activeCategories = categories.filter((c) => c.active).length;
  const avgScore =
    sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.finalScore, 0) / sessions.length
      : 0;

  const modes: GameMode[] = ['ujian', 'ujian_acak', 'troubleshoot'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Ringkasan bank soal, partisipasi siswa, dan statistik sesi ujian UKK Challenge.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('questions')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Kelola &amp; Tambah Soal
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Pemain</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? '—' : players.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Terdaftar anonim</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Soal Aktif</span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {activeQuestions}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            dari {questions.length} total soal
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Kategori Aktif</span>
            <FolderKanban className="w-4 h-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {activeCategories}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {syntaxPaths.length} jalur · {syntaxStages.length} milestone
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Sesi Ujian</span>
            <BarChart3 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? '—' : sessions.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Rata-rata skor: {avgScore > 0 ? avgScore.toFixed(1) : '—'}
          </p>
        </div>
      </div>

      {/* Mode Breakdown & Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Statistik Mode Ujian</h2>
          <div className="space-y-3">
            {modes.map((m) => {
              const modeSessions = sessions.filter((s) => s.mode === m);
              const modeAvg =
                modeSessions.length > 0
                  ? modeSessions.reduce((sum, s) => sum + s.finalScore, 0) / modeSessions.length
                  : 0;
              return (
                <div
                  key={m}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{MODE_META[m]?.label || m}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {modeSessions.length} sesi dimainkan
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-blue-700 tabular-nums">
                    {modeAvg > 0 ? `${modeAvg.toFixed(1)}` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Aktivitas Terbaru</h2>
            <button
              type="button"
              onClick={() => onNavigate('results')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Lihat Semua
            </button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              Belum ada aktivitas sesi permainan.
            </p>
          ) : (
            <div className="space-y-3">
              {sessions.slice(0, 6).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{s.playerNameSnapshot}</p>
                    <p className="text-xs text-slate-500">
                      {MODE_META[s.mode]?.label || s.mode} · {s.correctCount}/{s.totalQuestions}{' '}
                      benar
                    </p>
                  </div>
                  <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                    {s.finalScore.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
