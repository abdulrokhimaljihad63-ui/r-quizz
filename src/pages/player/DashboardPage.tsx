import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Award, BookOpen, Play, Trophy } from 'lucide-react';
import { ACTIVE_MODES, MODE_META } from '../../constants/defaults';
import { useAuth } from '../../contexts/AuthContext';
import { getAllPlayerProgressForUser } from '../../services/firestoreService';
import type { GameMode, PlayerProgress } from '../../types';
import type { PlayerNavTab } from '../../components/PlayerLayout';
import { buildOrderedMilestoneSequence } from '../../utils/randomizer';
import { formatDurationReadable } from '../../utils/scoring';

interface DashboardPageProps {
  onNavigate: (tab: PlayerNavTab) => void;
  onStartMode: (mode: GameMode, categoryId?: string | 'all') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onStartMode }) => {
  const { player, questions, categories, syntaxPaths, syntaxStages, settings } = useAuth();
  const [progressList, setProgressList] = useState<PlayerProgress[]>([]);

  useEffect(() => {
    if (!player) return;
    getAllPlayerProgressForUser(player.uid)
      .then(setProgressList)
      .catch(() => setProgressList([]));
  }, [player]);

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

  if (!player) return null;

  const activeQuestionsCount = questions.filter((q) => q.active).length;
  const activeCategoriesCount = categories.filter((c) => c.active).length;

  const totalOrderedCount = orderedMilestones.instances.length;
  const completedKeysSet = new Set(progressList.flatMap((p) => p.completedStageIds || []));
  const completedPracticeCount = orderedMilestones.instances.filter(
    (m) => m.milestoneKey && completedKeysSet.has(m.milestoneKey),
  ).length;
  const practicePercent =
    totalOrderedCount > 0
      ? Math.min(100, Math.round((completedPracticeCount / totalOrderedCount) * 100))
      : 0;

  const totalAccumulatedScore = Number(player.totalScore ?? 0);
  const totalAccumulatedDuration = Number(player.totalDuration ?? 0);

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-blue-600">
            Dashboard Belajar &amp; Ujian · ID {player.playerId}
            {player.absenNumber ? ` · Nomor Absen ${player.absenNumber}` : ''}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance">
            Selamat datang, {player.name}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Kuasai perintah MikroTik, Debian 12, MariaDB, Apache &amp; PHP, Moodle, Backup,
            Upgrade, serta analisis Troubleshooting melalui mode Hanya Latihan maupun tiga mode ujian
            resmi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('modes')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4" />
            Pilih Mode Permainan
          </button>
          <button
            type="button"
            onClick={() => onNavigate('leaderboard')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            <Trophy className="w-4 h-4 text-blue-600" />
            Lihat Peringkat
          </button>
        </div>
      </section>

      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total Sesi Ujian</p>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {player.totalSessions}
          </p>
          <p className="mt-1 text-xs text-slate-500">Sesi ujian selesai</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Soal Dikerjakan</p>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {player.totalQuestions}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {activeQuestionsCount} soal aktif di bank
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total Poin Akumulasi</p>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-blue-600 tabular-nums">
            {totalAccumulatedScore.toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Waktu kumulatif: {formatDurationReadable(totalAccumulatedDuration)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Progres Hanya Latihan</p>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {practicePercent}%
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {completedPracticeCount} / {totalOrderedCount} milestone selesai
          </p>
        </div>
      </section>

      {/* Notice when Question Bank is Empty */}
      {activeQuestionsCount === 0 && (
        <section className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-950 space-y-1">
            <p className="font-semibold">Bank Soal Masih Kosong</p>
            <p className="text-blue-800 leading-relaxed">
              Belum ada soal aktif yang ditambahkan oleh Admin/Guru ({activeCategoriesCount}{' '}
              kategori tersedia). Setelah Admin menambahkan soal di Dashboard Admin, seluruh mode
              permainan siap dimainkan.
            </p>
          </div>
        </section>
      )}

      {/* 4 Main Modes Overview */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900">4 Mode Permainan Utama</h2>
          <button
            type="button"
            onClick={() => onNavigate('modes')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            Detail Semua Mode
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ACTIVE_MODES.map((mode) => {
            const meta = MODE_META[mode];
            const isEnabled = settings.enabledModes[mode] !== false;
            const modeTotal = Number(player.modeTotalScores?.[mode] ?? 0);
            const modeDuration = Number(player.modeTotalDurations?.[mode] ?? 0);

            return (
              <div
                key={mode}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-blue-300 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span
                      className={`font-medium ${
                        meta.isExam ? 'text-blue-600' : 'text-emerald-700'
                      }`}
                    >
                      {meta.isExam ? 'Mode Ujian · Leaderboard' : 'Latihan Bebas · Tanpa Nilai'}
                    </span>
                    <span className="tabular-nums">
                      {meta.isExam
                        ? modeTotal > 0
                          ? `Poin: ${modeTotal.toFixed(1)} · ${formatDurationReadable(modeDuration)}`
                          : 'Belum ada skor'
                        : `${completedPracticeCount}/${totalOrderedCount} milestone`}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{meta.label}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{meta.description}</p>
                </div>

                <button
                  type="button"
                  disabled={!isEnabled}
                  onClick={() => onStartMode(mode, 'all')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 bg-blue-50/70 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEnabled ? (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Mulai {meta.label}
                    </>
                  ) : (
                    'Dinonaktifkan Admin'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Achievement Summary */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Award className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Ringkasan Pencapaian Ujian</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {player.totalSessions === 0
                ? 'Mulai ujian pertamamu untuk mengumpulkan poin akumulasi dan masuk papan peringkat.'
                : `Kamu telah menyelesaikan ${player.totalSessions} sesi ujian dengan total ${totalAccumulatedScore.toFixed(1)} poin dan total waktu ${formatDurationReadable(totalAccumulatedDuration)}.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('history')}
          className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
        >
          Lihat Riwayat
        </button>
      </section>
    </div>
  );
};
