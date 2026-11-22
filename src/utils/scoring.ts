import type {
  AppSettings,
  LeaderboardEntry,
  RankedLeaderboardEntry,
  SessionAnswer,
} from '../types';

export interface ScoreBreakdown {
  correctnessScore: number;
  accuracyScore: number;
  speedScore: number;
  finalScore: number;
  totalPointsEarned: number;
  totalMaxPoints: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
}

export const CENTRAL_QUESTION_MAX_POINTS = 100;

export function formatDurationReadable(rawSeconds: number): string {
  const safe = Math.max(0, Math.round(rawSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}j ${minutes}m ${seconds}d`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}d`;
  }
  return `${seconds}d`;
}

export function calculateSyntaxPoints(
  maxPoints: number,
  isCompletedCorrect: boolean,
  errorCount: number,
  errorPenaltyPercent: number,
): number {
  if (!isCompletedCorrect) {
    return 0;
  }
  const penaltyFraction = Math.min(0.6, (errorCount * Math.max(0, errorPenaltyPercent)) / 100);
  const earned = Math.round(maxPoints * (1 - penaltyFraction));
  return Math.max(1, Math.min(maxPoints, earned));
}

/**
 * Dynamic equal-weighted exam scoring (max 100 per session).
 * Adapts automatically when active question count changes:
 * - Each question weight = 100 / effectiveQuestionCount
 * - Correct answer = full question weight; wrong/unanswered = 0 points
 * - Session finalScore = (correctCount / effectiveQuestionCount) * 100 (capped [0, 100])
 */
export function calculateExamWeightedScores(
  answers: Pick<
    SessionAnswer,
    'isCompletedCorrect' | 'isCorrectFirstTry' | 'playerAnswer' | 'selectedOption' | 'questionType'
  >[],
  totalQuestions: number,
  durationSeconds: number,
  targetSeconds: number,
): ScoreBreakdown {
  const effectiveQuestionCount = Math.max(totalQuestions, answers.length);
  const perQuestionWeight =
    effectiveQuestionCount > 0 ? 100 / effectiveQuestionCount : 0;

  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let attemptedCount = 0;
  let firstTryCorrectCount = 0;

  for (const ans of answers) {
    const isUnanswered =
      ans.questionType === 'troubleshooting'
        ? ans.selectedOption < 0
        : ans.playerAnswer.trim().length === 0 && !ans.isCompletedCorrect;

    if (isUnanswered) {
      unansweredCount++;
    } else {
      attemptedCount++;
      if (ans.isCompletedCorrect) {
        correctCount++;
      } else {
        wrongCount++;
      }
      if (ans.isCorrectFirstTry) {
        firstTryCorrectCount++;
      }
    }
  }

  if (answers.length < totalQuestions) {
    unansweredCount += totalQuestions - answers.length;
  }

  const finalScore =
    effectiveQuestionCount > 0
      ? Math.min(100, Math.max(0, Number(((correctCount / effectiveQuestionCount) * 100).toFixed(1))))
      : 0;

  const accuracyScore =
    attemptedCount > 0
      ? Math.min(100, Math.max(0, Number(((firstTryCorrectCount / attemptedCount) * 100).toFixed(1))))
      : 0;

  const safeDuration = Math.max(1, durationSeconds);
  const safeTarget = Math.max(1, targetSeconds);
  const speedScore =
    attemptedCount > 0 && correctCount > 0
      ? Math.min(100, Math.max(0, Number(((safeTarget / safeDuration) * 100).toFixed(1))))
      : 0;

  return {
    correctnessScore: finalScore,
    accuracyScore,
    speedScore,
    finalScore,
    totalPointsEarned: Number((correctCount * perQuestionWeight).toFixed(1)),
    totalMaxPoints: effectiveQuestionCount > 0 ? 100 : 0,
    correctCount,
    wrongCount,
    unansweredCount,
  };
}

export function calculateSessionScores(
  answers: Pick<
    SessionAnswer,
    'isCompletedCorrect' | 'isCorrectFirstTry' | 'pointsEarned' | 'maxPoints' | 'playerAnswer' | 'selectedOption' | 'questionType'
  >[],
  totalQuestions: number,
  durationSeconds: number,
  targetSeconds: number,
  _settings?: Pick<AppSettings, 'weightCorrectness' | 'weightAccuracy' | 'weightSpeed'>,
): ScoreBreakdown {
  return calculateExamWeightedScores(answers, totalQuestions, durationSeconds, targetSeconds);
}

/**
 * Sorts leaderboard strictly by:
 * 1. Total accumulated points descending
 * 2. Cumulative total duration ascending (shortest wins ties!)
 * Equal (totalScore, duration) pairs receive identical rank and isTied=true.
 */
export function sortAndRankLeaderboardEntries(
  entries: LeaderboardEntry[],
): RankedLeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const scoreA = Number((a.totalScore ?? 0).toFixed(1));
    const scoreB = Number((b.totalScore ?? 0).toFixed(1));
    if (scoreB !== scoreA) return scoreB - scoreA;

    const durA = Math.max(0, Math.round(a.duration || 0));
    const durB = Math.max(0, Math.round(b.duration || 0));
    if (durA !== durB) return durA - durB;

    return a.playerName.localeCompare(b.playerName);
  });

  const result: RankedLeaderboardEntry[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const curScore = Number((cur.totalScore ?? 0).toFixed(1));
    const curDur = Math.max(0, Math.round(cur.duration || 0));

    let rank = i + 1;
    let isTied = false;

    if (i > 0) {
      const prev = result[i - 1];
      const prevScore = Number((prev.totalScore ?? 0).toFixed(1));
      const prevDur = Math.max(0, Math.round(prev.duration || 0));
      if (curScore === prevScore && curDur === prevDur) {
        rank = prev.rank;
        isTied = true;
        result[i - 1] = { ...prev, isTied: true };
      }
    }

    result.push({
      ...cur,
      rank,
      isTied,
    });
  }

  return result;
}
