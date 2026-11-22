import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lock,
  Shuffle,
} from 'lucide-react';
import { SyntaxTerminal } from '../../components/SyntaxTerminal';
import { useAuth } from '../../contexts/AuthContext';
import {
  getPlayerPathProgress,
  savePlayerPathProgress,
} from '../../services/firestoreService';
import type { PlayerProgress, Question, SessionQuestionInstance } from '../../types';
import {
  buildOrderedMilestoneSequence,
  getSeenVariationKeys,
  markVariationsSeen,
  pickPromptVariation,
} from '../../utils/randomizer';
import { resolveQuestionExpectedAnswers } from '../../utils/dynamicAnswer';
import { evaluateSyntaxWithAlternatives } from '../../utils/syntaxEngine';

interface SyntaxJourneyPageProps {
  onBackToModes?: () => void;
}

export const SyntaxJourneyPage: React.FC<SyntaxJourneyPageProps> = ({ onBackToModes }) => {
  const { player, syntaxPaths, syntaxStages, questions, categories, settings } = useAuth();

  // Build ordered milestone sequence identically to Mode Ujian (never shuffled!)
  const milestoneSequence = useMemo(() => {
    if (!player) return { instances: [] as SessionQuestionInstance[], progressPathId: 'default_practice' };
    return buildOrderedMilestoneSequence(
      questions,
      syntaxPaths,
      syntaxStages,
      player.uid,
      settings.prioritizeUnseenVariations,
    );
  }, [questions, syntaxPaths, syntaxStages, player, settings.prioritizeUnseenVariations]);

  const orderedMilestones = milestoneSequence.instances;
  const progressPathId = milestoneSequence.progressPathId;

  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [activeMilestoneKey, setActiveMilestoneKey] = useState<string>('');

  // Active variation override when user clicks "Acak Variasi Soal Lain"
  const [activeVariation, setActiveVariation] = useState<{
    question: Question;
    promptUsed: string;
    variationKey: string;
  } | null>(null);
  const [syntaxInput, setSyntaxInput] = useState('');
  const [stageCompletedNow, setStageCompletedNow] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [sessionUsedVarKeys, setSessionUsedVarKeys] = useState<Set<string>>(() => new Set());

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  useEffect(() => {
    if (!player) return;
    let cancelled = false;
    setLoadingProgress(true);
    getPlayerPathProgress(player.uid, progressPathId)
      .then((prog) => {
        if (cancelled) return;
        setProgress(prog);
        if (orderedMilestones.length > 0) {
          const completedSet = new Set(prog?.completedStageIds || []);
          const firstIncomplete = orderedMilestones.find(
            (m) => m.milestoneKey && !completedSet.has(m.milestoneKey),
          );
          const target =
            firstIncomplete?.milestoneKey ||
            orderedMilestones[orderedMilestones.length - 1]?.milestoneKey ||
            '';
          setActiveMilestoneKey((prev) =>
            prev && orderedMilestones.some((m) => m.milestoneKey === prev) ? prev : target,
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        setProgress(null);
        if (orderedMilestones.length > 0) {
          setActiveMilestoneKey(orderedMilestones[0].milestoneKey || '');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProgress(false);
      });
    return () => {
      cancelled = true;
    };
  }, [player, progressPathId, orderedMilestones]);

  const completedSet = useMemo(
    () => new Set(progress?.completedStageIds || []),
    [progress],
  );

  const firstIncompleteIdx = useMemo(() => {
    const idx = orderedMilestones.findIndex(
      (m) => m.milestoneKey && !completedSet.has(m.milestoneKey),
    );
    return idx === -1 ? Math.max(0, orderedMilestones.length - 1) : idx;
  }, [orderedMilestones, completedSet]);

  const activeMilestoneIndex = useMemo(
    () => orderedMilestones.findIndex((m) => m.milestoneKey === activeMilestoneKey),
    [orderedMilestones, activeMilestoneKey],
  );

  const activeMilestone =
    activeMilestoneIndex >= 0 ? orderedMilestones[activeMilestoneIndex] : null;

  // Sync terminal input & variation whenever selected milestone changes
  useEffect(() => {
    if (!activeMilestone) {
      setActiveVariation(null);
      setSyntaxInput('');
      setStageCompletedNow(false);
      return;
    }
    setActiveVariation({
      question: activeMilestone.question,
      promptUsed: activeMilestone.promptUsed,
      variationKey: activeMilestone.variationKey,
    });
    setSyntaxInput('');
    setStageCompletedNow(false);
  }, [activeMilestoneKey, activeMilestone]);

  const handleRandomizeVariation = () => {
    if (!player || !activeMilestone) return;
    setSyntaxInput('');
    setStageCompletedNow(false);

    const q = activeMilestone.question;
    const totalPrompts = 1 + q.promptVariations.filter((v) => v.trim().length > 0).length;
    if (totalPrompts <= 1) return;

    const seenKeys = new Set([
      ...getSeenVariationKeys(player.uid),
      ...Array.from(sessionUsedVarKeys),
      ...(activeVariation ? [activeVariation.variationKey] : []),
    ]);
    const picked = pickPromptVariation(q, seenKeys, settings.prioritizeUnseenVariations);
    setActiveVariation({
      question: q,
      promptUsed: picked.promptUsed,
      variationKey: picked.variationKey,
    });
  };

  const handleCompleteMilestone = async () => {
    if (!player || !activeMilestone?.milestoneKey || !activeVariation) return;
    const resolvedInfo = resolveQuestionExpectedAnswers(
      activeVariation.question,
      player.absenNumber,
    );
    const evalRes = evaluateSyntaxWithAlternatives(
      syntaxInput,
      resolvedInfo.resolvedAnswers,
      resolvedInfo.syntaxCheckMode,
    );
    if (!evalRes.isCompleteMatch) return;

    setSavingStage(true);
    try {
      const mKey = activeMilestone.milestoneKey;
      const updatedCompleted = Array.from(
        new Set([...(progress?.completedStageIds || []), mKey]),
      );
      const nextOrder = Math.max(progress?.lastCompletedOrder ?? -1, activeMilestoneIndex + 1);
      const nextIncomplete = orderedMilestones.find(
        (m) => m.milestoneKey && !updatedCompleted.includes(m.milestoneKey),
      );
      const nextStageId = nextIncomplete?.milestoneKey || mKey;
      const nextAttempts = (progress?.totalAttempts || 0) + 1;

      await savePlayerPathProgress(player.uid, progressPathId, {
        completedStageIds: updatedCompleted,
        lastCompletedOrder: nextOrder,
        currentStageId: nextStageId,
        totalAttempts: nextAttempts,
      });

      markVariationsSeen(player.uid, [activeVariation.variationKey]);
      setSessionUsedVarKeys((prev) => new Set(prev).add(activeVariation.variationKey));

      setProgress({
        id: `${player.uid}_${progressPathId}`,
        playerUid: player.uid,
        pathId: progressPathId,
        completedStageIds: updatedCompleted,
        lastCompletedOrder: nextOrder,
        currentStageId: nextStageId,
        totalAttempts: nextAttempts,
        updatedAt: new Date(),
      });
      setStageCompletedNow(true);
    } finally {
      setSavingStage(false);
    }
  };

  if (!player) return null;

  if (orderedMilestones.length === 0) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
        <BookOpen className="w-10 h-10 text-blue-600 mx-auto" />
        <h1 className="text-xl font-bold text-slate-900">
          Hanya Latihan — Penguasaan Sintaks Berurutan
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Belum ada soal sintaks aktif atau milestone yang dibuat oleh Admin. Silakan cek kembali
          setelah Admin menambahkan soal sintaks ke Bank Soal atau menu Milestone &amp; Urutan.
        </p>
        {onBackToModes && (
          <button
            type="button"
            onClick={onBackToModes}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Pilihan Mode
          </button>
        )}
      </div>
    );
  }

  const completedCount = orderedMilestones.filter(
    (m) => m.milestoneKey && completedSet.has(m.milestoneKey),
  ).length;
  const percent =
    orderedMilestones.length > 0
      ? Math.round((completedCount / orderedMilestones.length) * 100)
      : 0;

  const resolvedVariationInfo = activeVariation
    ? resolveQuestionExpectedAnswers(activeVariation.question, player.absenNumber)
    : null;

  const isMatch = resolvedVariationInfo
    ? evaluateSyntaxWithAlternatives(
        syntaxInput,
        resolvedVariationInfo.resolvedAnswers,
        resolvedVariationInfo.syntaxCheckMode,
      ).isCompleteMatch
    : false;

  const nextMilestone =
    activeMilestoneIndex >= 0 && activeMilestoneIndex + 1 < orderedMilestones.length
      ? orderedMilestones[activeMilestoneIndex + 1]
      : null;

  const totalVariantsForQuestion = activeVariation
    ? 1 + activeVariation.question.promptVariations.filter((v) => v.trim().length > 0).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-600">
            Mode Latihan Bebas · Tanpa Nilai &amp; Tanpa Leaderboard
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
            Hanya Latihan — Perjalanan Sintaks Berurutan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pelajari seluruh soal sintaks secara berurutan dengan petunjuk dan koreksi warna
            real-time. Mode ini tidak dihitung skor dan tidak memengaruhi peringkat leaderboard.
          </p>
        </div>

        {onBackToModes && (
          <button
            type="button"
            onClick={onBackToModes}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors self-start shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Mode
          </button>
        )}
      </div>

      {/* Horizontal Progress Track */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Jalur Latihan Modul UKK</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Urutan soal sama persis dengan soal yang diujikan pada mode Ujian.
            </p>
          </div>
          <span className="text-xs font-semibold text-blue-700 tabular-nums">
            {completedCount} / {orderedMilestones.length} Milestone ({percent}%)
          </span>
        </div>

        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="overflow-x-auto thin-scrollbar pb-2">
          <div className="flex items-stretch gap-3 min-w-max py-1">
            {orderedMilestones.map((m, idx) => {
              const mKey = m.milestoneKey || `m_${idx}`;
              const isDone = completedSet.has(mKey);
              const isUnlocked = idx <= firstIncompleteIdx || isDone;
              const isCurrent = mKey === activeMilestoneKey;

              return (
                <button
                  key={mKey}
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => setActiveMilestoneKey(mKey)}
                  className={`w-48 text-left p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-2 shrink-0 ${
                    isCurrent
                      ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                      : isDone
                        ? 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300'
                        : isUnlocked
                          ? 'border-slate-200 bg-white hover:border-blue-300'
                          : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold tabular-nums">Tahap {idx + 1}</span>
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : !isUnlocked ? (
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <span className="text-blue-600 font-medium">Aktif</span>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {m.chapterTitle ||
                        categoryNameMap.get(m.question.categoryId) ||
                        m.question.categoryId}
                    </p>
                    <p className="text-xs font-semibold text-slate-900 line-clamp-2 mt-0.5">
                      {m.milestoneTitle || m.question.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Milestone Stage Workspace */}
      {loadingProgress ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
          Memuat progres latihan...
        </div>
      ) : activeMilestone ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-blue-600 tabular-nums">
                Milestone {activeMilestoneIndex + 1} dari {orderedMilestones.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {categoryNameMap.get(activeMilestone.question.categoryId) ||
                  activeMilestone.question.categoryId}
              </span>
              {activeMilestone.milestoneKey && completedSet.has(activeMilestone.milestoneKey) && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-emerald-700">Sudah Selesai</span>
                </>
              )}
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              {activeMilestone.milestoneTitle || activeMilestone.question.title}
            </h3>
            {activeMilestone.milestoneDescription && (
              <p className="text-sm text-slate-600">{activeMilestone.milestoneDescription}</p>
            )}
          </div>

          {!activeVariation ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3 text-sm text-amber-900">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p>Soal untuk milestone ini belum tersedia.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-500">
                    Instruksi Soal {totalVariantsForQuestion > 1 ? '(Variasi Acak)' : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {resolvedVariationInfo?.answerMode === 'dynamic' && player.absenNumber && (
                      <span className="text-[11px] font-mono font-medium text-blue-700">
                        Soal Dinamis (Absen {player.absenNumber})
                      </span>
                    )}
                    {resolvedVariationInfo?.syntaxCheckMode === 'flexible_order' && (
                      <span className="text-[11px] font-medium text-amber-700">
                        Urutan Kata Bebas
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm sm:text-base text-slate-800 leading-relaxed whitespace-pre-line">
                  {activeVariation.promptUsed}
                </p>
              </div>

              <SyntaxTerminal
                expectedAnswers={resolvedVariationInfo?.resolvedAnswers || []}
                syntaxCheckMode={resolvedVariationInfo?.syntaxCheckMode || 'exact'}
                value={syntaxInput}
                onChange={setSyntaxInput}
                onSubmit={() => {
                  if (isMatch && !stageCompletedNow) {
                    void handleCompleteMilestone();
                  }
                }}
                hint={activeVariation.question.hint}
              />

              {stageCompletedNow && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Milestone Selesai &amp; Progres Disimpan!
                  </div>
                  {activeVariation.question.explanation && (
                    <p className="text-xs sm:text-sm text-emerald-900 leading-relaxed">
                      {activeVariation.question.explanation}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {totalVariantsForQuestion > 1 ? (
                  <button
                    type="button"
                    onClick={handleRandomizeVariation}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Acak Variasi Soal Lain
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">
                    Mode latihan bebas tanpa perhitungan poin
                  </span>
                )}

                <div className="flex items-center gap-3">
                  {!stageCompletedNow ? (
                    <button
                      type="button"
                      disabled={!isMatch || savingStage}
                      onClick={handleCompleteMilestone}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      {savingStage ? 'Menyimpan Progres...' : 'Selesaikan Milestone'}
                    </button>
                  ) : nextMilestone?.milestoneKey ? (
                    <button
                      type="button"
                      onClick={() => setActiveMilestoneKey(nextMilestone.milestoneKey || '')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Lanjut ke Tahap {activeMilestoneIndex + 2}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-sm font-semibold text-emerald-700">
                      Seluruh Milestone Latihan Selesai!
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
