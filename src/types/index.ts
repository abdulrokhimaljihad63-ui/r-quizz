export type QuestionType = 'guided_syntax' | 'blind_syntax' | 'troubleshooting';

export type ActiveGameMode =
  | 'practice_only'
  | 'ujian'
  | 'ujian_acak'
  | 'troubleshoot';

export type LegacyGameMode =
  | 'guided_syntax'
  | 'blind_syntax'
  | 'troubleshooting'
  | 'exam_challenge'
  | 'syntax_journey';

export type GameMode = ActiveGameMode | LegacyGameMode;

export type ActiveLeaderboardMode =
  | 'overall'
  | 'ujian'
  | 'ujian_acak'
  | 'troubleshoot';

export type LegacyLeaderboardMode =
  | 'exam_challenge'
  | 'guided_syntax'
  | 'blind_syntax'
  | 'troubleshooting';

export type LeaderboardMode = ActiveLeaderboardMode | LegacyLeaderboardMode;

export type Difficulty = 'easy' | 'medium' | 'hard';

export type AnswerMode = 'static' | 'dynamic';

export type SyntaxCheckMode = 'exact' | 'flexible_order';

export interface PlayerPreferences {
  soundEnabled: boolean;
  showKeyboardHints: boolean;
}

export interface Player {
  uid: string;
  playerId: string;
  name: string;
  absenNumber?: number;
  bestScores: Partial<Record<GameMode, number>>;
  totalScore: number;
  modeTotalScores: Partial<Record<GameMode, number>>;
  totalDuration?: number;
  modeTotalDurations?: Partial<Record<GameMode, number>>;
  totalSessions: number;
  totalQuestions: number;
  preferences?: PlayerPreferences;
  createdAt: Date | null;
  updatedAt: Date | null;
  lastPlayedAt?: Date | null;
}

export interface LeaderboardEntry {
  id: string;
  playerUid: string;
  playerName: string;
  mode: LeaderboardMode;
  bestScore: number;
  totalScore: number;
  sessionsCount: number;
  totalAccuracySum?: number;
  lastSessionScore?: number;
  accuracyScore: number;
  duration: number;
  achievedAt: Date | null;
  updatedAt: Date | null;
}

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number;
  isTied: boolean;
}

export interface AdminUser {
  uid: string;
  email: string;
  role: 'admin';
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  active: boolean;
  orderIndex: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface Question {
  id: string;
  type: QuestionType;
  types: QuestionType[];
  categoryId: string;
  stageId: string;
  orderIndex?: number;
  title: string;
  prompt: string;
  promptVariations: string[];
  correctAnswer: string;
  answerAlternatives?: string[];
  syntaxCheckMode?: SyntaxCheckMode;
  answerMode?: AnswerMode;
  answerTemplate?: string;
  validateIpFormat?: boolean;
  hint: string;
  options: string[];
  correctOption: number;
  explanation: string;
  difficulty?: Difficulty;
  points?: number;
  timeLimit: number;
  active: boolean;
  sourceReference?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SyntaxChapter {
  id: string;
  title: string;
  orderIndex: number;
}

export interface SyntaxPath {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  active: boolean;
  chapters: SyntaxChapter[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SyntaxStage {
  id: string;
  pathId: string;
  orderIndex: number;
  title: string;
  description: string;
  chapterId: string;
  active: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface GameSession {
  id: string;
  playerUid: string;
  playerNameSnapshot: string;
  playerAbsenSnapshot?: number;
  mode: GameMode;
  questionIds: string[];
  startTime: Date | null;
  endTime: Date | null;
  duration: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  correctnessScore: number;
  accuracyScore: number;
  speedScore: number;
  finalScore: number;
  status: 'in_progress' | 'completed';
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SessionAnswer {
  id: string;
  sessionId: string;
  playerUid: string;
  questionId: string;
  questionTitle: string;
  questionType: QuestionType;
  promptUsed: string;
  playerAnswer: string;
  correctAnswer: string;
  acceptedAnswersSnapshot?: string[];
  syntaxCheckModeSnapshot?: SyntaxCheckMode;
  absenNumberSnapshot?: number;
  answerModeSnapshot?: AnswerMode;
  answerTemplateSnapshot?: string;
  selectedOption: number;
  correctOption: number;
  isCorrectFirstTry: boolean;
  isCompletedCorrect: boolean;
  attempts: number;
  errorCount: number;
  errorPositions: number[];
  pointsEarned: number;
  maxPoints: number;
  explanation: string;
  createdAt: Date | null;
}

export interface PlayerProgress {
  id: string;
  playerUid: string;
  pathId: string;
  completedStageIds: string[];
  lastCompletedOrder: number;
  currentStageId: string;
  totalAttempts: number;
  updatedAt: Date | null;
}

export interface AppSettings {
  examTotalQuestions: number;
  examGuidedCount: number;
  examBlindCount: number;
  examTroubleshootingCount: number;
  troubleshootQuestionCount: number;
  examTimeLimitSeconds: number;
  practiceQuestionCount: number;
  practiceTargetSecondsPerQuestion: number;
  defaultPointsEasy: number;
  defaultPointsMedium: number;
  defaultPointsHard: number;
  syntaxErrorPenaltyPercent: number;
  weightCorrectness: number;
  weightAccuracy: number;
  weightSpeed: number;
  prioritizeUnseenVariations: boolean;
  enabledModes: Partial<Record<GameMode, boolean>>;
  updatedAt?: Date | null;
}

export interface SessionQuestionInstance {
  question: Question;
  assignedType: QuestionType;
  promptUsed: string;
  variationKey: string;
  milestoneKey?: string;
  milestoneTitle?: string;
  milestoneDescription?: string;
  chapterTitle?: string;
  orderNumber?: number;
}

export interface ActiveSessionResult {
  session: GameSession;
  answers: SessionAnswer[];
  previousBestScore: number;
  previousTotalScore: number;
  newTotalScore: number;
  isNewPersonalBest: boolean;
  leaderboardRank: number | null;
}
