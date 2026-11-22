import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
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
  const { player, syntaxPaths, syntaxStages, questions, settings } = useAuth();

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

  // Active variation override when user clicks randomize variation
  const [activeVariation, setActiveVariation] = useState<{
    question: Question;
    promptUsed: string;
    variationKey: string;
  } | null>(null);
  const [syntaxInput, setSyntaxInput] = useState('');
  const [stageCompletedNow, setStageCompletedNow] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [savingStage, setSavingStage] = useState(false);
  const [sessionUsedVarKeys, setSessionUsedVarKeys] = useState<Set<string>>(() => new Set());

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
  const activeMilestoneRef = useRef(activeMilestone);
  activeMilestoneRef.current = activeMilestone;
  const lastInitializedKeyRef = useRef<string>('');

  // Sync terminal input & variation ONLY when selected milestone key actually changes
  useEffect(() => {
    const milestone = activeMilestoneRef.current;
    if (!milestone || !activeMilestoneKey) {
      lastInitializedKeyRef.current = '';
      setActiveVariation(null);
      setSyntaxInput('');
      setStageCompletedNow(false);
      return;
    }
    if (lastInitializedKeyRef.current === activeMilestoneKey) {
      return;
    }
    lastInitializedKeyRef.current = activeMilestoneKey;
    setActiveVariation({
      question: milestone.question,
      promptUsed: milestone.promptUsed,
      variationKey: milestone.variationKey,
    });
    setSyntaxInput('');
    setStageCompletedNow(false);
    setCheckError(null);
  }, [activeMilestoneKey]);

  const handleRandomizeVariation = () => {
    if (!player || !activeMilestone) return;
    setSyntaxInput('');
    setStageCompletedNow(false);
    setCheckError(null);

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
    if (syntaxInput.trim().length === 0) {
      setCheckError('Ketik jawaban terlebih dahulu.');
      return;
    }
    const resolvedInfo = resolveQuestionExpectedAnswers(
      activeVariation.question,
      player.absenNumber,
    );
    const evalRes = evaluateSyntaxWithAlternatives(
      syntaxInput,
      resolvedInfo.resolvedAnswers,
      resolvedInfo.syntaxCheckMode,
    );
    if (!evalRes.isCompleteMatch) {
      setCheckError('Sintaks belum sesuai, periksa kembali bagian yang berwarna merah.');
      return;
    }

    setCheckError(null);
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
    } catch (err) {
      setCheckError(
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan progres latihan. Periksa koneksi internet Anda.',
      );
    } finally {
      setSavingStage(false);
    }
  };

  if (!player) return null;

  if (orderedMilestones.length === 0) {
    return (
      <div className="max-w-2xl mx-auto rquizz-panel rounded-2xl p-8 text-center space-y-4">
        <BookOpen className="w-10 h-10 text-amber-300 mx-auto" />
        <h1 className="text-xl font-bold text-white">
          Hanya Latihan — Penguasaan Sintaks Berurutan
        </h1>
        <p className="text-sm text-slate-300 leading-relaxed">
          Belum ada soal sintaks aktif atau milestone yang dibuat oleh Admin. Silakan cek kembali
          setelah Admin menambahkan soal sintaks ke Bank Soal atau menu Milestone &amp; Urutan.
        </p>
        {onBackToModes && (
          <button
            type="button"
            onClick={onBackToModes}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-950 bg-cyan-400 rounded-lg hover:bg-cyan-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
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

  const nextMilestone =
    activeMilestoneIndex >= 0 && activeMilestoneIndex + 1 < orderedMilestones.length
      ? orderedMilestones[activeMilestoneIndex + 1]
      : null;

  const totalVariantsForQuestion = activeVariation
    ? 1 + activeVariation.question.promptVariations.filter((v) => v.trim().length > 0).length
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Compact Header & Progress Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="font-bold text-amber-300">Hanya Latihan</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              Tahap {activeMilestoneIndex + 1} dari {orderedMilestones.length} ({percent}%)
            </span>
          </div>
          <div className="w-48 sm:w-64 h-1.5 bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {onBackToModes && (
          <button
            type="button"
            onClick={onBackToModes}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-950/75 border border-white/20 rounded-lg hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Keluar
          </button>
        )}
      </div>

      {/* Compact Milestone Stage Strip */}
      <div className="overflow-x-auto thin-scrollbar pb-1">
        <div className="flex items-center gap-2 min-w-max">
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
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 backdrop-blur-md ${
                  isCurrent
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : isDone
                      ? 'border-emerald-400/35 bg-slate-950/75 text-emerald-300 hover:border-emerald-400/70'
                      : isUnlocked
                        ? 'border-white/15 bg-slate-950/75 text-slate-200 hover:border-cyan-400/50'
                        : 'border-white/10 bg-black/40 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span className="font-mono tabular-nums">Tahap {idx + 1}</span>
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : !isUnlocked ? (
                  <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Question Workspace */}
      {loadingProgress ? (
        <p className="text-sm text-slate-300 py-4">Memuat progres latihan...</p>
      ) : activeMilestone ? (
        <div className="space-y-4">
          {/* Competency (smaller, gray) & Question Prompt (larger, crisp white) in semi-transparent panel */}
          <div className="rquizz-panel rounded-xl p-4 sm:p-5 space-y-1.5">
            <p className="text-xs sm:text-sm font-medium text-slate-400">
              {activeMilestone.milestoneTitle || activeMilestone.question.title}
            </p>
            {activeVariation && (
              <h1 className="text-lg sm:text-xl font-bold text-white leading-snug whitespace-pre-line">
                {activeVariation.promptUsed}
              </h1>
            )}
          </div>

          {!activeVariation ? (
            <div className="rounded-xl bg-amber-950/75 border border-amber-400/40 p-3 flex items-center gap-2.5 text-sm text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <p>Soal untuk tahap ini belum tersedia.</p>
            </div>
          ) : (
            <>
              <SyntaxTerminal
                expectedAnswers={resolvedVariationInfo?.resolvedAnswers || []}
                syntaxCheckMode={resolvedVariationInfo?.syntaxCheckMode || 'exact'}
                value={syntaxInput}
                onChange={(nextVal) => {
                  setSyntaxInput(nextVal);
                  if (checkError) setCheckError(null);
                }}
                onSubmit={() => {
                  if (!stageCompletedNow) {
                    void handleCompleteMilestone();
                  }
                }}
                hint={activeVariation.question.hint}
              />

              {checkError && !stageCompletedNow && (
                <p className="text-xs font-semibold text-rose-300">{checkError}</p>
              )}

              {stageCompletedNow && (
                <div className="rounded-lg bg-emerald-950/75 border border-emerald-400/40 px-3.5 py-2.5 text-xs sm:text-sm text-emerald-200 flex items-center gap-2 backdrop-blur-md">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">
                    Jawaban benar!{activeVariation.question.explanation ? ` ${activeVariation.question.explanation}` : ''}
                  </span>
                </div>
              )}

              <div
                className={`flex flex-wrap items-center gap-3 pt-1 ${
                  totalVariantsForQuestion > 1 ? 'justify-between' : 'justify-end'
                }`}
              >
                {totalVariantsForQuestion > 1 && (
                  <button
                    type="button"
                    onClick={handleRandomizeVariation}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-950/75 border border-white/20 rounded-lg hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-cyan-400" />
                    Acak Variasi Soal
                  </button>
                )}

                {!stageCompletedNow ? (
                  <button
                    type="button"
                    disabled={savingStage}
                    onClick={handleCompleteMilestone}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-950 bg-emerald-400 rounded-lg hover:bg-emerald-300 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 shadow-[0_0_20px_rgba(52,211,153,0.28)]"
                  >
                    <Check className="w-4 h-4" />
                    {savingStage ? 'Menyimpan...' : 'Cek Jawaban'}
                  </button>
                ) : nextMilestone?.milestoneKey ? (
                  <button
                    type="button"
                    onClick={() => setActiveMilestoneKey(nextMilestone.milestoneKey || '')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-950 bg-emerald-400 rounded-lg hover:bg-emerald-300 transition-colors whitespace-nowrap shrink-0 shadow-[0_0_20px_rgba(52,211,153,0.28)]"
                  >
                    Lanjut ke Tahap {activeMilestoneIndex + 2}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-sm font-bold text-emerald-300">
                    Seluruh Latihan Selesai!
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};
