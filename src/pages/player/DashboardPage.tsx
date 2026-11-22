import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  History,
  Play,
  ShieldCheck,
  Shuffle,
  Trophy,
  Wrench,
  X,
} from 'lucide-react';
import { MODE_META } from '../../constants/defaults';
import { useAuth } from '../../contexts/AuthContext';
import type { ActiveGameMode, GameMode } from '../../types';
import type { PlayerNavTab } from '../../components/PlayerLayout';
import { buildOrderedMilestoneSequence, getQuestionTypes } from '../../utils/randomizer';

interface DashboardPageProps {
  onNavigate: (tab: PlayerNavTab) => void;
  onStartMode: (mode: GameMode, categoryId?: string | 'all') => void;
}

interface ModePopupInfo {
  id: ActiveGameMode;
  label: string;
  actionLabel: string;
  badge: string;
  availabilityText: string;
  timeText: string | null;
  note: string;
  canStart: boolean;
  isEnabled: boolean;
}

const DASHBOARD_MODE_ORDER: ActiveGameMode[] = [
  'ujian',
  'practice_only',
  'ujian_acak',
  'troubleshoot',
];

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onStartMode }) => {
  const { player, questions, syntaxPaths, syntaxStages, settings } = useAuth();
  const [selectedMode, setSelectedMode] = useState<ActiveGameMode | null>(null);

  const activeQuestions = useMemo(() => questions.filter((q) => q.active), [questions]);

  const orderedMilestones = useMemo(
    () =>
      buildOrderedMilestoneSequence(
        questions,
        syntaxPaths,
        syntaxStages,
        player?.uid || '',
        settings.prioritizeUnseenVariations,
      ),
    [questions, syntaxPaths, syntaxStages, player?.uid, settings.prioritizeUnseenVariations],
  );

  const modeInfoMap = useMemo(() => {
    const orderedSyntaxCount = orderedMilestones.instances.length;
    const totalExamAvailable = activeQuestions.filter(
      (q) => getQuestionTypes(q).length > 0,
    ).length;
    const activeTroubleCount = activeQuestions.filter((q) =>
      getQuestionTypes(q).includes('troubleshooting'),
    ).length;
    const targetTroubleCount = Math.max(1, settings.troubleshootQuestionCount || 10);
    const examMinutes = Math.max(1, Math.round((settings.examTimeLimitSeconds || 1800) / 60));

    const map = new Map<ActiveGameMode, ModePopupInfo>();

    for (const id of DASHBOARD_MODE_ORDER) {
      const meta = MODE_META[id];
      const isEnabled = settings.enabledModes[id] !== false;

      if (id === 'practice_only') {
        map.set(id, {
          id,
          label: meta.label,
          actionLabel: 'Mulai Latihan',
          badge: 'Latihan Bebas · Tanpa Nilai',
          availabilityText: `${orderedSyntaxCount} milestone berurutan`,
          timeText: null,
          note: 'Urutan soal sama persis dengan modul UKK. Petunjuk dan koreksi warna aktif langsung saat mengetik.',
          canStart: isEnabled && orderedSyntaxCount > 0,
          isEnabled,
        });
      } else if (id === 'ujian') {
        map.set(id, {
          id,
          label: meta.label,
          actionLabel: 'Mulai Ujian',
          badge: 'Mode Ujian · Nilai Maks 100 · Akumulasi Leaderboard',
          availabilityText: `${orderedSyntaxCount} soal berurutan`,
          timeText: `${examMinutes} menit`,
          note: 'Tanpa petunjuk dan tanpa warna koreksi saat mengetik. Penilaian dilakukan saat menekan Submit Jawaban.',
          canStart: isEnabled && orderedSyntaxCount > 0,
          isEnabled,
        });
      } else if (id === 'ujian_acak') {
        map.set(id, {
          id,
          label: meta.label,
          actionLabel: 'Mulai Ujian',
          badge: 'Mode Ujian · Nilai Maks 100 · Akumulasi Leaderboard',
          availabilityText: `Target ${settings.examTotalQuestions} soal (${totalExamAvailable} soal aktif tersedia)`,
          timeText: `${examMinutes} menit`,
          note: 'Soal campuran diacak setiap sesi tanpa duplikasi. Bobot per soal menyesuaikan jumlah soal aktif.',
          canStart: isEnabled && totalExamAvailable > 0,
          isEnabled,
        });
      } else {
        map.set(id, {
          id,
          label: meta.label,
          actionLabel: 'Mulai Ujian',
          badge: 'Mode Ujian · Nilai Maks 100 · Akumulasi Leaderboard',
          availabilityText: `Target ${targetTroubleCount} soal/sesi (${activeTroubleCount} soal aktif tersedia)`,
          timeText: null,
          note: 'Pilihan ganda analisis kasus error jaringan dan server dengan akumulasi poin dan waktu.',
          canStart: isEnabled && activeTroubleCount > 0,
          isEnabled,
        });
      }
    }

    return map;
  }, [
    orderedMilestones.instances.length,
    activeQuestions,
    settings.troubleshootQuestionCount,
    settings.examTimeLimitSeconds,
    settings.examTotalQuestions,
    settings.enabledModes,
  ]);

  useEffect(() => {
    if (!selectedMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedMode(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMode]);

  if (!player) return null;

  const activePopupInfo = selectedMode ? modeInfoMap.get(selectedMode) || null : null;

  const getModeIcon = (mode: ActiveGameMode) => {
    if (mode === 'ujian') return <ShieldCheck className="w-4 h-4 text-white shrink-0" />;
    if (mode === 'practice_only') return <BookOpen className="w-4 h-4 text-yellow-600 shrink-0" />;
    if (mode === 'ujian_acak') return <Shuffle className="w-4 h-4 text-blue-600 shrink-0" />;
    return <Wrench className="w-4 h-4 text-blue-600 shrink-0" />;
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Greeting + Smaller Mode Heading */}
      <section className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance">
          Selamat datang, {player.name}
        </h1>
        <h2 className="text-sm sm:text-base font-medium text-slate-600">
          Pilih Mode Permainan
        </h2>
      </section>

      {/* 4 Compact Single-Row Game Mode Cards */}
      <section className="space-y-3">
        {DASHBOARD_MODE_ORDER.map((mode) => {
          const info = modeInfoMap.get(mode);
          if (!info) return null;

          const isMainExam = mode === 'ujian';
          const isPractice = mode === 'practice_only';

          const cardClasses = isMainExam
            ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700 shadow-sm'
            : 'bg-white border-slate-200 text-slate-900 hover:border-blue-300';

          const actionTextClasses = !info.isEnabled
            ? isMainExam
              ? 'text-emerald-100'
              : 'text-slate-400'
            : isMainExam
              ? 'text-white'
              : isPractice
                ? 'text-yellow-600'
                : 'text-blue-600';

          return (
            <button
              key={mode}
              type="button"
              disabled={!info.isEnabled}
              onClick={() => setSelectedMode(mode)}
              className={`w-full text-left border rounded-xl px-4 py-3.5 flex items-center justify-between gap-4 transition-colors disabled:opacity-60 disabled:cursor-not-allowed group ${cardClasses}`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                {getModeIcon(mode)}
                <span className="text-sm sm:text-base font-semibold leading-snug">
                  {info.label}
                </span>
              </span>

              <span
                className={`text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 group-hover:underline ${actionTextClasses}`}
              >
                {info.isEnabled ? info.actionLabel : 'Dinonaktifkan'}
              </span>
            </button>
          );
        })}
      </section>

      {/* Bottom History & Leaderboard Actions */}
      <section className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => onNavigate('history')}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
        >
          <History className="w-4 h-4 text-slate-600" />
          Riwayat Ujian
        </button>

        <button
          type="button"
          onClick={() => onNavigate('leaderboard')}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
        >
          <Trophy className="w-4 h-4 text-blue-600" />
          Lihat Peringkat
        </button>
      </section>

      {/* Technical Details Pop-up Modal */}
      {activePopupInfo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mode-instruction-title"
          onClick={() => setSelectedMode(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px] p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className={`text-xs font-semibold ${
                    activePopupInfo.id === 'practice_only' ? 'text-yellow-600' : 'text-blue-600'
                  }`}
                >
                  {activePopupInfo.badge}
                </p>
                <h3
                  id="mode-instruction-title"
                  className="text-xl font-bold text-slate-900 mt-1"
                >
                  {activePopupInfo.id === 'practice_only'
                    ? `Petunjuk Latihan — ${activePopupInfo.label}`
                    : `Petunjuk Ujian — ${activePopupInfo.label}`}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Tutup petunjuk"
                onClick={() => setSelectedMode(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs sm:text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Ketersediaan Soal</span>
                <span className="font-semibold text-slate-900 tabular-nums text-right">
                  {activePopupInfo.availabilityText}
                </span>
              </div>
              {activePopupInfo.timeText && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Batas Waktu</span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {activePopupInfo.timeText}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 leading-relaxed space-y-1">
                <p>{MODE_META[activePopupInfo.id].description}</p>
                <p>{activePopupInfo.note}</p>
              </div>
            </div>

            {!activePopupInfo.canStart && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Belum ada soal aktif yang tersedia untuk mode ini. Hubungi Admin/Guru untuk
                  menambahkan soal terlebih dahulu.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setSelectedMode(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!activePopupInfo.canStart}
                onClick={() => {
                  const modeToStart = activePopupInfo.id;
                  setSelectedMode(null);
                  onStartMode(modeToStart, 'all');
                }}
                className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed ${
                  activePopupInfo.id === 'practice_only'
                    ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-950'
                    : activePopupInfo.id === 'ujian'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Play className="w-4 h-4" />
                {activePopupInfo.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
