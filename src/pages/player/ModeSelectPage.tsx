import React, { useMemo } from 'react';
import { BookOpen, Play, ShieldCheck } from 'lucide-react';
import { ACTIVE_MODES, MODE_META } from '../../constants/defaults';
import { useAuth } from '../../contexts/AuthContext';
import type { ActiveGameMode, GameMode } from '../../types';
import { buildOrderedMilestoneSequence, getQuestionTypes } from '../../utils/randomizer';

interface ModeSelectPageProps {
  onStartMode: (mode: GameMode, categoryId: string | 'all') => void;
}

export const ModeSelectPage: React.FC<ModeSelectPageProps> = ({ onStartMode }) => {
  const { player, questions, syntaxPaths, syntaxStages, settings } = useAuth();

  const activeQuestions = useMemo(() => questions.filter((q) => q.active), [questions]);

  const orderedMilestones = useMemo(() => {
    return buildOrderedMilestoneSequence(
      questions,
      syntaxPaths,
      syntaxStages,
      player?.uid || '',
      settings.prioritizeUnseenVariations,
    );
  }, [questions, syntaxPaths, syntaxStages, player?.uid, settings.prioritizeUnseenVariations]);

  const orderedSyntaxCount = orderedMilestones.instances.length;
  const totalExamAvailable = activeQuestions.filter((q) => getQuestionTypes(q).length > 0).length;
  const activeTroubleCount = activeQuestions.filter((q) =>
    getQuestionTypes(q).includes('troubleshooting'),
  ).length;
  const targetTroubleCount = Math.max(1, settings.troubleshootQuestionCount || 10);

  const cards: Array<{
    id: ActiveGameMode;
    badge: string;
    availableText: string;
    canStart: boolean;
    note: string;
  }> = ACTIVE_MODES.map((id) => {
    const isEnabled = settings.enabledModes[id] !== false;
    if (id === 'practice_only') {
      return {
        id,
        badge: 'Latihan Bebas · Tanpa Nilai',
        availableText: `${orderedSyntaxCount} milestone berurutan`,
        canStart: isEnabled && orderedSyntaxCount > 0,
        note: 'Urutan soal sama persis dengan mode Ujian. Petunjuk & koreksi warna aktif saat mengetik.',
      };
    }
    if (id === 'ujian') {
      return {
        id,
        badge: 'Mode Ujian · Maks 100 · Akumulasi Leaderboard',
        availableText: `${orderedSyntaxCount} soal berurutan`,
        canStart: isEnabled && orderedSyntaxCount > 0,
        note: 'Tanpa petunjuk dan tanpa warna koreksi saat mengetik. Penilaian dilakukan saat klik Submit Jawaban.',
      };
    }
    if (id === 'ujian_acak') {
      return {
        id,
        badge: 'Mode Ujian · Maks 100 · Akumulasi Leaderboard',
        availableText: `${totalExamAvailable} soal tersedia · target ${settings.examTotalQuestions} soal`,
        canStart: isEnabled && totalExamAvailable > 0,
        note: 'Soal campuran diacak setiap sesi tanpa duplikasi. Bobot per soal menyesuaikan jumlah soal aktif.',
      };
    }
    return {
      id,
      badge: 'Mode Ujian · Maks 100 · Akumulasi Leaderboard',
      availableText: `${activeTroubleCount} soal aktif · target ${targetTroubleCount} soal/sesi`,
      canStart: isEnabled && activeTroubleCount > 0,
      note: 'Pilihan ganda analisis kasus error jaringan dan server dengan akumulasi poin dan waktu.',
    };
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Pilih Mode Permainan</h1>
        <p className="text-sm text-slate-600">
          Gunakan mode <span className="font-semibold text-slate-800">Hanya Latihan</span> untuk
          mempelajari perintah tanpa tekanan nilai, lalu uji kemampuanmu di tiga mode ujian resmi
          untuk mengumpulkan poin leaderboard.
        </p>
      </div>

      {/* 4 Main Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {cards.map((m) => {
          const meta = MODE_META[m.id];
          const isEnabled = settings.enabledModes[m.id] !== false;
          const isPractice = !meta.isExam;

          return (
            <div
              key={m.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      isPractice ? 'text-emerald-700' : 'text-blue-600'
                    }`}
                  >
                    {isPractice ? (
                      <BookOpen className="w-3.5 h-3.5" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    {m.badge}
                  </span>
                  <span className="text-slate-500 tabular-nums">{m.availableText}</span>
                </div>

                <h2 className="text-lg font-bold text-slate-900">{meta.label}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{meta.description}</p>
                <p className="text-xs text-slate-500 pt-1 leading-relaxed">{m.note}</p>
              </div>

              <button
                type="button"
                disabled={!m.canStart}
                onClick={() => onStartMode(m.id, 'all')}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed ${
                  isPractice
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {!isEnabled ? (
                  'Mode Dinonaktifkan Admin'
                ) : !m.canStart ? (
                  'Belum Ada Soal Tersedia'
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    {isPractice ? 'Mulai Hanya Latihan' : `Mulai ${meta.label}`}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
