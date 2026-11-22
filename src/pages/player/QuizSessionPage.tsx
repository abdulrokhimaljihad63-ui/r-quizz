import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Info,
} from 'lucide-react';
import { MODE_META } from '../../constants/defaults';
import { useAuth } from '../../contexts/AuthContext';
import { ExamFeedbackOverlay, preloadFeedbackSvgs } from '../../components/ExamFeedbackOverlay';
import { SyntaxTerminal } from '../../components/SyntaxTerminal';
import { generateDocId, saveCompletedSession } from '../../services/firestoreService';
import type {
  ActiveSessionResult,
  GameMode,
  SessionAnswer,
  SessionQuestionInstance,
} from '../../types';
import {
  buildExamSessionQuestions,
  buildOrderedMilestoneSequence,
  buildPracticeSessionQuestions,
  buildTroubleshootSessionQuestions,
  markVariationsSeen,
} from '../../utils/randomizer';
import { calculateExamWeightedScores } from '../../utils/scoring';
import { resolveQuestionExpectedAnswers } from '../../utils/dynamicAnswer';
import {
  playErrorTetToot,
  playSuccessFanfare,
  preloadFeedbackSounds,
  stopFeedbackSounds,
  unlockSuccessSound,
} from '../../utils/soundEffects';
import { evaluateSyntaxWithAlternatives } from '../../utils/syntaxEngine';

interface QuizSessionPageProps {
  mode: Exclude<GameMode, 'practice_only' | 'syntax_journey'>;
  categoryId: string | 'all';
  onFinish: (result: ActiveSessionResult) => void;
  onExit: () => void;
}

type DraftAnswer = Omit<SessionAnswer, 'id' | 'sessionId' | 'playerUid' | 'createdAt'>;

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const QuizSessionPage: React.FC<QuizSessionPageProps> = ({
  mode,
  categoryId,
  onFinish,
  onExit,
}) => {
  const { player, questions, syntaxPaths, syntaxStages, settings, refreshPlayer } =
    useAuth();

  const isOrderedUjian = mode === 'ujian';
  const isRandomExam = mode === 'ujian_acak' || mode === 'exam_challenge';
  const isTroubleshootMode = mode === 'troubleshoot';
  const hasCountdownTimer = isOrderedUjian || isRandomExam;

  // Freeze session question set once per mount
  const selection = useMemo(() => {
    if (!player) return null;

    if (isOrderedUjian) {
      const seq = buildOrderedMilestoneSequence(
        questions,
        syntaxPaths,
        syntaxStages,
        player.uid,
        settings.prioritizeUnseenVariations,
      );
      return {
        kind: 'ujian' as const,
        instances: seq.instances,
        hasShortfall: false,
      };
    }

    if (isRandomExam) {
      const data = buildExamSessionQuestions(questions, settings, player.uid);
      return {
        kind: 'ujian_acak' as const,
        instances: data.instances,
        hasShortfall: data.hasShortfall,
        examData: data,
      };
    }

    if (isTroubleshootMode) {
      const count = Math.max(1, settings.troubleshootQuestionCount || 10);
      const data = buildTroubleshootSessionQuestions(
        questions,
        count,
        player.uid,
        settings.prioritizeUnseenVariations,
      );
      return {
        kind: 'troubleshoot' as const,
        instances: data.instances,
        hasShortfall: false,
      };
    }

    const qType =
      mode === 'guided_syntax'
        ? 'guided_syntax'
        : mode === 'blind_syntax'
          ? 'blind_syntax'
          : 'troubleshooting';
    const data = buildPracticeSessionQuestions(
      questions,
      qType,
      categoryId,
      settings.practiceQuestionCount,
      player.uid,
      settings.prioritizeUnseenVariations,
    );
    return {
      kind: 'legacy' as const,
      instances: data.instances,
      hasShortfall: false,
    };
    // Only build once per session mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sessionInstances: SessionQuestionInstance[] = selection?.instances || [];

  const [examShortfallConfirmed, setExamShortfallConfirmed] = useState<boolean>(() => {
    if (!selection) return true;
    return !selection.hasShortfall;
  });

  const [sessionId] = useState<string>(() => generateDocId('sess'));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startTime] = useState<Date>(() => new Date());
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    hasCountdownTimer ? settings.examTimeLimitSeconds : 0,
  );
  const [, setElapsedSeconds] = useState(0);

  // Current question state
  const [syntaxInput, setSyntaxInput] = useState('');
  const [mistakeCount, setMistakeCount] = useState(0);
  const [wrongPositionsSeen, setWrongPositionsSeen] = useState<Set<number>>(() => new Set());
  const [selectedOption, setSelectedOption] = useState<number>(-1);

  // Post-submit animation & lock state for Mode Ujian
  const [feedbackState, setFeedbackState] = useState<'correct' | 'wrong' | null>(null);
  const [feedbackExiting, setFeedbackExiting] = useState(false);
  const [feedbackPlayKey, setFeedbackPlayKey] = useState(0);

  const [collectedAnswers, setCollectedAnswers] = useState<DraftAnswer[]>([]);
  const [submittingSession, setSubmittingSession] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const finalizedRef = useRef(false);
  const submitLockRef = useRef(false);
  const pendingNextAnswersRef = useRef<DraftAnswer[] | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const exitAnimTimerRef = useRef<number | null>(null);
  const soundDelayTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOrderedUjian) {
      preloadFeedbackSvgs();
      if (player?.preferences?.soundEnabled !== false) {
        preloadFeedbackSounds();
      }
    }
    return () => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
      if (exitAnimTimerRef.current !== null) {
        window.clearTimeout(exitAnimTimerRef.current);
      }
      if (soundDelayTimerRef.current !== null) {
        window.clearTimeout(soundDelayTimerRef.current);
      }
      stopFeedbackSounds();
    };
  }, [isOrderedUjian, player?.preferences?.soundEnabled]);

  const currentInstance = sessionInstances[currentIndex] || null;
  const currentQuestion = currentInstance?.question || null;

  const perQuestionWeight = useMemo(() => {
    if (sessionInstances.length === 0) return 0;
    return Number((100 / sessionInstances.length).toFixed(1));
  }, [sessionInstances.length]);

  const buildCurrentDraftAnswer = useCallback((): DraftAnswer | null => {
    if (!currentInstance) return null;
    const q = currentInstance.question;
    const effectiveType = currentInstance.assignedType;

    if (effectiveType === 'troubleshooting') {
      const isCorrect = selectedOption >= 0 && selectedOption === q.correctOption;
      return {
        questionId: q.id,
        questionTitle: q.title,
        questionType: effectiveType,
        promptUsed: currentInstance.promptUsed,
        playerAnswer: selectedOption >= 0 ? q.options[selectedOption] || '' : '',
        correctAnswer: q.options[q.correctOption] || '',
        absenNumberSnapshot: player?.absenNumber,
        answerModeSnapshot: 'static',
        answerTemplateSnapshot: '',
        selectedOption,
        correctOption: q.correctOption,
        isCorrectFirstTry: isCorrect,
        isCompletedCorrect: isCorrect,
        attempts: selectedOption >= 0 ? 1 : 0,
        errorCount: selectedOption >= 0 && !isCorrect ? 1 : 0,
        errorPositions: [],
        pointsEarned: isCorrect ? perQuestionWeight : 0,
        maxPoints: perQuestionWeight,
        explanation: q.explanation,
      };
    }

    const resolvedInfo = resolveQuestionExpectedAnswers(q, player?.absenNumber);
    const evalRes = evaluateSyntaxWithAlternatives(
      syntaxInput,
      resolvedInfo.resolvedAnswers,
      resolvedInfo.syntaxCheckMode,
    );
    const completed = evalRes.isCompleteMatch;
    const isCorrectFirstTry = isOrderedUjian ? completed : completed && mistakeCount === 0;
    const hasTyped = syntaxInput.trim().length > 0;

    return {
      questionId: q.id,
      questionTitle: q.title,
      questionType: effectiveType,
      promptUsed: currentInstance.promptUsed,
      playerAnswer: syntaxInput,
      correctAnswer: completed
        ? evalRes.matchedAlternativeText
        : resolvedInfo.primaryExpectedAnswer,
      acceptedAnswersSnapshot: resolvedInfo.resolvedAnswers,
      syntaxCheckModeSnapshot: resolvedInfo.syntaxCheckMode,
      absenNumberSnapshot: player?.absenNumber,
      answerModeSnapshot: resolvedInfo.answerMode,
      answerTemplateSnapshot: resolvedInfo.primaryTemplate,
      selectedOption: -1,
      correctOption: -1,
      isCorrectFirstTry,
      isCompletedCorrect: completed,
      attempts: hasTyped ? (isOrderedUjian ? 1 : 1 + mistakeCount) : 0,
      errorCount: isOrderedUjian ? (hasTyped && !completed ? 1 : 0) : mistakeCount,
      errorPositions: isOrderedUjian
        ? []
        : Array.from(wrongPositionsSeen).sort((a, b) => a - b),
      pointsEarned: completed ? perQuestionWeight : 0,
      maxPoints: perQuestionWeight,
      explanation: q.explanation,
    };
  }, [
    currentInstance,
    player?.absenNumber,
    selectedOption,
    syntaxInput,
    mistakeCount,
    wrongPositionsSeen,
    isOrderedUjian,
    perQuestionWeight,
  ]);

  const finalizeSession = useCallback(
    async (allAnswers: DraftAnswer[]) => {
      if (finalizedRef.current || !player) return;
      finalizedRef.current = true;
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      if (exitAnimTimerRef.current !== null) {
        window.clearTimeout(exitAnimTimerRef.current);
        exitAnimTimerRef.current = null;
      }
      if (soundDelayTimerRef.current !== null) {
        window.clearTimeout(soundDelayTimerRef.current);
        soundDelayTimerRef.current = null;
      }
      stopFeedbackSounds();
      setFeedbackExiting(false);
      setFeedbackState(null);
      setSubmittingSession(true);
      setSaveError(null);

      try {
        const endTime = new Date();
        const actualDuration = Math.max(
          1,
          Math.round((endTime.getTime() - startTime.getTime()) / 1000),
        );
        const targetSeconds = hasCountdownTimer
          ? settings.examTimeLimitSeconds
          : Math.max(1, sessionInstances.length * settings.practiceTargetSecondsPerQuestion);

        // Pad any unvisited questions as unanswered (0 points)
        const paddedAnswers = [...allAnswers];
        for (let i = paddedAnswers.length; i < sessionInstances.length; i++) {
          const inst = sessionInstances[i];
          const q = inst.question;
          const effType = inst.assignedType;
          const resolvedInfo = resolveQuestionExpectedAnswers(q, player.absenNumber);
          paddedAnswers.push({
            questionId: q.id,
            questionTitle: q.title,
            questionType: effType,
            promptUsed: inst.promptUsed,
            playerAnswer: '',
            correctAnswer:
              effType === 'troubleshooting'
                ? q.options[q.correctOption] || ''
                : resolvedInfo.primaryExpectedAnswer,
            acceptedAnswersSnapshot:
              effType === 'troubleshooting' ? [] : resolvedInfo.resolvedAnswers,
            syntaxCheckModeSnapshot:
              effType === 'troubleshooting' ? 'exact' : resolvedInfo.syntaxCheckMode,
            absenNumberSnapshot: player.absenNumber,
            answerModeSnapshot: effType === 'troubleshooting' ? 'static' : resolvedInfo.answerMode,
            answerTemplateSnapshot:
              effType === 'troubleshooting' ? '' : resolvedInfo.primaryTemplate,
            selectedOption: -1,
            correctOption: effType === 'troubleshooting' ? q.correctOption : -1,
            isCorrectFirstTry: false,
            isCompletedCorrect: false,
            attempts: 0,
            errorCount: 0,
            errorPositions: [],
            pointsEarned: 0,
            maxPoints: perQuestionWeight,
            explanation: q.explanation,
          });
        }

        const scores = calculateExamWeightedScores(
          paddedAnswers,
          sessionInstances.length,
          actualDuration,
          targetSeconds,
        );

        markVariationsSeen(
          player.uid,
          sessionInstances.map((s) => s.variationKey),
        );

        const result = await saveCompletedSession({
          sessionId,
          player,
          mode,
          questionIds: sessionInstances.map((s) => s.question.id),
          startTime,
          endTime,
          duration: actualDuration,
          correctCount: scores.correctCount,
          wrongCount: scores.wrongCount,
          unansweredCount: scores.unansweredCount,
          correctnessScore: scores.correctnessScore,
          accuracyScore: scores.accuracyScore,
          speedScore: scores.speedScore,
          finalScore: scores.finalScore,
          answers: paddedAnswers,
        });

        await refreshPlayer();
        onFinish(result);
      } catch (err) {
        finalizedRef.current = false;
        setSubmittingSession(false);
        setSaveError(err instanceof Error ? err.message : 'Gagal menyimpan hasil sesi.');
      }
    },
    [
      sessionId,
      player,
      startTime,
      hasCountdownTimer,
      settings,
      sessionInstances,
      perQuestionWeight,
      mode,
      refreshPlayer,
      onFinish,
    ],
  );

  // Timer effect
  useEffect(() => {
    if (!examShortfallConfirmed || sessionInstances.length === 0 || submittingSession) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      if (hasCountdownTimer) {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            window.clearInterval(timer);
            if (pendingNextAnswersRef.current) {
              void finalizeSession(pendingNextAnswersRef.current);
            } else {
              const currentDraft = buildCurrentDraftAnswer();
              const merged = currentDraft ? [...collectedAnswers, currentDraft] : collectedAnswers;
              void finalizeSession(merged);
            }
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    examShortfallConfirmed,
    sessionInstances.length,
    submittingSession,
    hasCountdownTimer,
    buildCurrentDraftAnswer,
    collectedAnswers,
    finalizeSession,
  ]);

  const advanceToNextOrFinish = useCallback(
    (nextAnswers: DraftAnswer[]) => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      if (exitAnimTimerRef.current !== null) {
        window.clearTimeout(exitAnimTimerRef.current);
        exitAnimTimerRef.current = null;
      }
      if (soundDelayTimerRef.current !== null) {
        window.clearTimeout(soundDelayTimerRef.current);
        soundDelayTimerRef.current = null;
      }
      stopFeedbackSounds();
      pendingNextAnswersRef.current = null;
      submitLockRef.current = false;
      setFeedbackExiting(false);
      setFeedbackState(null);

      if (currentIndex + 1 >= sessionInstances.length) {
        void finalizeSession(nextAnswers);
        return;
      }

      setCollectedAnswers(nextAnswers);
      setCurrentIndex((prev) => prev + 1);
      setSyntaxInput('');
      setMistakeCount(0);
      setWrongPositionsSeen(new Set());
      setSelectedOption(-1);
    },
    [currentIndex, sessionInstances.length, finalizeSession],
  );

  const handleUjianSubmit = useCallback(() => {
    if (submitLockRef.current || feedbackState !== null || submittingSession) return;
    const draft = buildCurrentDraftAnswer();
    if (!draft) return;

    submitLockRef.current = true;
    const isCorrect = draft.isCompletedCorrect;
    const soundOn = player?.preferences?.soundEnabled !== false;

    if (soundDelayTimerRef.current !== null) {
      window.clearTimeout(soundDelayTimerRef.current);
      soundDelayTimerRef.current = null;
    }

    if (isCorrect) {
      unlockSuccessSound(soundOn);
      soundDelayTimerRef.current = window.setTimeout(() => {
        soundDelayTimerRef.current = null;
        playSuccessFanfare(soundOn);
      }, 1800);
    } else {
      playErrorTetToot(soundOn);
    }

    const nextAnswers = [...collectedAnswers, draft];
    pendingNextAnswersRef.current = nextAnswers;
    setFeedbackPlayKey((k) => k + 1);
    setFeedbackExiting(false);
    setFeedbackState(isCorrect ? 'correct' : 'wrong');

    const exitDelayMs = isCorrect ? 4550 : 2450;
    const advanceDelayMs = isCorrect ? 4950 : 2850;

    exitAnimTimerRef.current = window.setTimeout(() => {
      setFeedbackExiting(true);
    }, exitDelayMs);

    autoAdvanceTimerRef.current = window.setTimeout(() => {
      advanceToNextOrFinish(nextAnswers);
    }, advanceDelayMs);
  }, [
    feedbackState,
    submittingSession,
    buildCurrentDraftAnswer,
    player?.preferences?.soundEnabled,
    collectedAnswers,
    advanceToNextOrFinish,
  ]);

  const handleStandardNextOrFinish = () => {
    if (submittingSession) return;
    const draft = buildCurrentDraftAnswer();
    if (!draft) return;
    advanceToNextOrFinish([...collectedAnswers, draft]);
  };

  if (!player) return null;

  // Empty state when no active questions exist
  if (sessionInstances.length === 0) {
    return (
      <div className="max-w-2xl mx-auto rquizz-panel rounded-2xl p-8 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h1 className="text-xl font-bold text-white">
          Soal Untuk {MODE_META[mode].label} Belum Tersedia
        </h1>
        <p className="text-sm text-slate-300 leading-relaxed">
          {isTroubleshootMode
            ? 'Belum ada soal Troubleshooting aktif di bank soal. Hubungi Admin/Guru untuk menambahkan soal Troubleshooting terlebih dahulu.'
            : isOrderedUjian
              ? 'Belum ada soal sintaks aktif atau milestone di bank soal. Hubungi Admin/Guru untuk menambahkan soal sintaks terlebih dahulu.'
              : 'Bank soal aktif untuk mode ini masih kosong. Hubungi Admin/Guru untuk menambahkan dan mengaktifkan soal terlebih dahulu.'}
        </p>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-950 bg-cyan-400 rounded-lg hover:bg-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  // Random exam shortfall confirmation notice
  if (isRandomExam && !examShortfallConfirmed && selection?.kind === 'ujian_acak') {
    const examData = selection.examData;
    const detail = examData.compositionDetail;
    return (
      <div className="max-w-2xl mx-auto rquizz-panel rounded-2xl p-6 sm:p-8 space-y-5 text-slate-100">
        <div className="flex items-start gap-3">
          <Info className="w-6 h-6 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-bold text-white">Pemberitahuan Jumlah Soal Ujian</h1>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">
              Target <span className="font-semibold text-white">{MODE_META[mode].label}</span> adalah{' '}
              <span className="font-semibold text-white">{examData.requestedTotal}</span> soal, namun bank soal
              aktif saat ini tersedia{' '}
              <span className="font-semibold text-cyan-300">{examData.availableTotal}</span> soal
              (sistem tidak menggandakan soal yang sama).
            </p>
          </div>
        </div>

        <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-2 text-xs text-slate-200">
          <div className="flex justify-between">
            <span>Sintaks Berpetunjuk</span>
            <span className="font-mono tabular-nums">
              {detail.guided.selected} / {detail.guided.requested} soal
            </span>
          </div>
          <div className="flex justify-between">
            <span>Sintaks Tanpa Petunjuk</span>
            <span className="font-mono tabular-nums">
              {detail.blind.selected} / {detail.blind.requested} soal
            </span>
          </div>
          <div className="flex justify-between">
            <span>Troubleshooting</span>
            <span className="font-mono tabular-nums">
              {detail.troubleshooting.selected} / {detail.troubleshooting.requested} soal
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onExit}
            className="px-4 py-2.5 text-sm font-semibold text-slate-200 bg-white/10 rounded-lg hover:bg-white/15 transition-colors"
          >
            Kembali
          </button>
          <button
            type="button"
            onClick={() => setExamShortfallConfirmed(true)}
            className="px-5 py-2.5 text-sm font-bold text-slate-950 bg-emerald-400 rounded-lg hover:bg-emerald-300 transition-colors"
          >
            Mulai Dengan {examData.availableTotal} Soal
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion || !currentInstance) return null;

  const effectiveType = currentInstance.assignedType;
  const isSyntaxQuestion = effectiveType !== 'troubleshooting';
  const isBlindOrUjian = isOrderedUjian || effectiveType === 'blind_syntax';
  const resolvedAnswerInfo = resolveQuestionExpectedAnswers(currentQuestion, player.absenNumber);
  const progressPercent = Math.round(((currentIndex + 1) / sessionInstances.length) * 100);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Session Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="font-bold text-white">{MODE_META[mode].label}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              Soal {currentIndex + 1} dari {sessionInstances.length}
            </span>
          </div>
          <div className="w-48 sm:w-64 h-1.5 bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasCountdownTimer && (
            <div className="flex items-center gap-1.5 text-sm font-mono tabular-nums text-cyan-300">
              <Clock
                className={`w-4 h-4 ${remainingSeconds <= 60 ? 'text-rose-400' : 'text-cyan-400'}`}
              />
              <span className={remainingSeconds <= 60 ? 'text-rose-400 font-bold' : 'font-semibold'}>
                {formatTimer(remainingSeconds)}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={onExit}
            className="px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white border border-white/20 bg-slate-950/75 rounded-lg hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Keluar
          </button>
        </div>
      </div>

      {/* Question Competency & Prompt inside semi-transparent cyber panel */}
      <div className="rquizz-panel rounded-xl p-4 sm:p-5 space-y-1.5">
        <p className="text-xs sm:text-sm font-medium text-slate-400">
          {currentInstance.milestoneTitle || currentQuestion.title}
        </p>
        <h1 className="text-lg sm:text-xl font-bold text-white leading-snug whitespace-pre-line">
          {currentInstance.promptUsed}
        </h1>
      </div>

      {/* Interactive Input Area */}
      {isSyntaxQuestion ? (
        <SyntaxTerminal
          key={`${currentIndex}_${currentQuestion.id}`}
          expectedAnswers={resolvedAnswerInfo.resolvedAnswers}
          syntaxCheckMode={resolvedAnswerInfo.syntaxCheckMode}
          value={syntaxInput}
          onChange={setSyntaxInput}
          disabled={submittingSession || feedbackState !== null}
          onMistakeEvent={
            isOrderedUjian
              ? undefined
              : (pos) => {
                  setMistakeCount((c) => c + 1);
                  setWrongPositionsSeen((prev) => new Set(prev).add(pos));
                }
          }
          onSubmit={
            isOrderedUjian
              ? handleUjianSubmit
              : undefined
          }
          isBlindMode={isBlindOrUjian}
          blindExamTyping={isOrderedUjian}
          hint={!isBlindOrUjian ? currentQuestion.hint : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {currentQuestion.options.map((opt, idx) => {
            const letter = ['A', 'B', 'C', 'D'][idx] || String(idx + 1);
            const isSelected = selectedOption === idx;

            const cardStyle = isSelected
              ? 'border-emerald-400 bg-emerald-500/20 text-white ring-1 ring-emerald-400 backdrop-blur-md'
              : 'border-white/15 bg-slate-950/75 backdrop-blur-md hover:border-cyan-400/50 hover:bg-slate-900/85 text-slate-100';

            return (
              <button
                key={idx}
                type="button"
                disabled={submittingSession || feedbackState !== null}
                onClick={() => setSelectedOption(idx)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-start gap-3 ${cardStyle}`}
              >
                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded shrink-0 mt-0.5 ${
                    isSelected ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-cyan-300'
                  }`}
                >
                  {letter}
                </span>
                <span className="text-sm font-medium leading-snug flex-1">{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {saveError && (
        <div className="rounded-lg bg-red-950/75 border border-red-400/40 p-3 text-xs text-red-200">
          {saveError}
        </div>
      )}

      {/* Right-aligned Green Action Button */}
      <div className="flex justify-end pt-1">
        {isOrderedUjian ? (
          <button
            type="button"
            disabled={submittingSession || feedbackState !== null}
            onClick={handleUjianSubmit}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-950 bg-emerald-400 rounded-lg hover:bg-emerald-300 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 shadow-[0_0_20px_rgba(52,211,153,0.28)]"
          >
            <Check className="w-4 h-4" />
            {submittingSession ? 'Menyimpan...' : 'Cek Jawaban'}
          </button>
        ) : (
          <button
            type="button"
            disabled={submittingSession}
            onClick={handleStandardNextOrFinish}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-950 bg-emerald-400 rounded-lg hover:bg-emerald-300 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 shadow-[0_0_20px_rgba(52,211,153,0.28)]"
          >
            {submittingSession
              ? 'Menyimpan...'
              : currentIndex + 1 >= sessionInstances.length
                ? 'Selesaikan Ujian'
                : 'Lanjut'}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Animated SVG Feedback Overlay displayed directly on top of the active question page */}
      {isOrderedUjian && feedbackState !== null && (
        <ExamFeedbackOverlay
          status={feedbackState}
          playKey={feedbackPlayKey}
          isLastQuestion={currentIndex + 1 >= sessionInstances.length}
          isExiting={feedbackExiting}
          onContinueNow={() => {
            if (pendingNextAnswersRef.current) {
              advanceToNextOrFinish(pendingNextAnswersRef.current);
            }
          }}
        />
      )}
    </div>
  );
};
