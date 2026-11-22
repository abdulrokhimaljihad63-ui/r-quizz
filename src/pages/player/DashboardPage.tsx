import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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
  const [showRoomNotice, setShowRoomNotice] = useState(false);
  const prefersReducedMotion = useReducedMotion();

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
          note: 'Urutan soal sama persis dengan modul RQuizz. Petunjuk dan koreksi warna aktif langsung saat mengetik.',
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
          note: 'Tanpa petunjuk dan tanpa warna koreksi saat mengetik. Penilaian dilakukan saat menekan Cek Jawaban.',
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

  useEffect(() => {
    if (!player?.uid) return;
    const storageKey = `rquizz_room_notice_seen_${player.uid}`;
    try {
      if (window.localStorage.getItem(storageKey) === '1') {
        return;
      }
    } catch {
      return;
    }

    setShowRoomNotice(true);

    const persistTimer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, '1');
      } catch {
        // Ignore storage errors
      }
    }, 300);

    const hideTimer = window.setTimeout(() => {
      setShowRoomNotice(false);
    }, 4500);

    return () => {
      window.clearTimeout(persistTimer);
      window.clearTimeout(hideTimer);
    };
  }, [player?.uid]);

  if (!player) return null;

  const activePopupInfo = selectedMode ? modeInfoMap.get(selectedMode) || null : null;

  const getModeIcon = (mode: ActiveGameMode) => {
    if (mode === 'ujian') return <ShieldCheck className="w-4 h-4 text-white shrink-0" />;
    if (mode === 'practice_only') return <BookOpen className="w-4 h-4 text-amber-300 shrink-0" />;
    if (mode === 'ujian_acak') return <Shuffle className="w-4 h-4 text-sky-400 shrink-0" />;
    return <Wrench className="w-4 h-4 text-sky-400 shrink-0" />;
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 pt-2">
      {/* One-time Top Room Notice Popup */}
      <AnimatePresence>
        {showRoomNotice && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -40 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -40 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md pointer-events-none"
          >
            <div className="bg-[#0d071b]/95 backdrop-blur-xl border border-cyan-400/50 rounded-2xl px-5 py-3.5 shadow-[0_12px_36px_rgba(34,211,238,0.24)] text-center">
              <p className="text-sm font-bold text-white leading-snug">
                anda sedang berada di ruang{' '}
                <span className="text-cyan-300">rquizz-ukk-tkj1-2026</span>
              </p>
              <p className="text-xs font-semibold text-slate-300 mt-1">
                di buat oleh rokhim
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Greeting + Smaller Mode Heading */}
      <section className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
          Selamat datang, {player.name}
        </h1>
        <h2 className="text-sm sm:text-base font-medium text-slate-300">
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
            ? 'bg-emerald-600/90 backdrop-blur-md border-emerald-400/60 text-white hover:bg-emerald-500/95 hover:border-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.28)]'
            : isPractice
              ? 'bg-slate-950/75 backdrop-blur-md border-amber-400/35 text-white hover:border-amber-300/75 hover:bg-slate-900/85'
              : 'bg-slate-950/75 backdrop-blur-md border-fuchsia-400/25 text-white hover:border-cyan-400/65 hover:bg-slate-900/85';

          const actionTextClasses = !info.isEnabled
            ? isMainExam
              ? 'text-emerald-100'
              : 'text-slate-500'
            : isMainExam
              ? 'text-white'
              : isPractice
                ? 'text-amber-300'
                : 'text-sky-400';

          return (
            <button
              key={mode}
              type="button"
              disabled={!info.isEnabled}
              onClick={() => setSelectedMode(mode)}
              className={`w-full text-left border rounded-xl px-4 py-3.5 flex items-center justify-between gap-4 transition-all disabled:opacity-60 disabled:cursor-not-allowed group ${cardClasses}`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                {getModeIcon(mode)}
                <span className="text-sm sm:text-base font-bold leading-snug">
                  {info.label}
                </span>
              </span>

              <span
                className={`text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 group-hover:underline ${actionTextClasses}`}
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
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-100 rquizz-panel rounded-xl hover:border-cyan-400/50 hover:bg-slate-900/85 transition-colors whitespace-nowrap shrink-0"
        >
          <History className="w-4 h-4 text-fuchsia-400" />
          Riwayat Ujian
        </button>

        <button
          type="button"
          onClick={() => onNavigate('leaderboard')}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-100 rquizz-panel rounded-xl hover:border-cyan-400/50 hover:bg-slate-900/85 transition-colors whitespace-nowrap shrink-0"
        >
          <Trophy className="w-4 h-4 text-amber-300" />
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#0d071b]/95 backdrop-blur-xl border border-fuchsia-400/35 rounded-2xl p-6 shadow-[0_0_40px_rgba(168,85,247,0.28)] space-y-5 text-slate-100"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className={`text-xs font-bold ${
                    activePopupInfo.id === 'practice_only' ? 'text-amber-300' : 'text-cyan-300'
                  }`}
                >
                  {activePopupInfo.badge}
                </p>
                <h3
                  id="mode-instruction-title"
                  className="text-xl font-bold text-white mt-1"
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-2.5 text-xs sm:text-sm text-slate-200">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Ketersediaan Soal</span>
                <span className="font-semibold text-white tabular-nums text-right">
                  {activePopupInfo.availabilityText}
                </span>
              </div>
              {activePopupInfo.timeText && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Batas Waktu</span>
                  <span className="font-semibold text-cyan-300 tabular-nums">
                    {activePopupInfo.timeText}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-white/10 text-xs text-slate-300 leading-relaxed space-y-1">
                <p>{MODE_META[activePopupInfo.id].description}</p>
                <p>{activePopupInfo.note}</p>
              </div>
            </div>

            {!activePopupInfo.canStart && (
              <div className="rounded-lg bg-amber-950/70 border border-amber-400/40 p-3 flex items-start gap-2.5 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
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
                className="px-4 py-2 text-sm font-semibold text-slate-200 bg-white/10 rounded-lg hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
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
                className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed ${
                  activePopupInfo.id === 'practice_only'
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                    : activePopupInfo.id === 'ujian'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-sky-400 hover:bg-sky-300 text-slate-950'
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
