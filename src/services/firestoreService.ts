import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_SETTINGS, INITIAL_CATEGORIES } from '../constants/defaults';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  ActiveSessionResult,
  AnswerMode,
  AppSettings,
  Category,
  GameMode,
  GameSession,
  LeaderboardEntry,
  LeaderboardMode,
  Player,
  PlayerPreferences,
  PlayerProgress,
  Question,
  QuestionType,
  RankedLeaderboardEntry,
  SessionAnswer,
  SyntaxCheckMode,
  SyntaxPath,
  SyntaxStage,
} from '../types';
import { sortAndRankLeaderboardEntries } from '../utils/scoring';
import { normalizeLineEndings } from '../utils/syntaxEngine';

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return null;
}

function makePlayerId(): string {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timePart = Date.now().toString(36).slice(-4).toUpperCase();
  return `PLR-${timePart}${randomPart}`;
}

export function generateDocId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

function computeFallbackTotalScore(bestScores: Record<string, unknown> | undefined): number {
  if (!bestScores) return 0;
  return Number(
    Object.values(bestScores)
      .reduce<number>((sum, val) => sum + Number(val || 0), 0)
      .toFixed(1),
  );
}

function isCompetitiveExamMode(mode: GameMode): boolean {
  return mode !== 'practice_only' && mode !== 'syntax_journey';
}

// --- PLAYER PROFILE ---

export async function getPlayerProfile(uid: string): Promise<Player | null> {
  const path = `players/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'players', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    const bestScores = d.bestScores || {};
    return {
      uid: d.uid,
      playerId: d.playerId,
      name: d.name,
      absenNumber: typeof d.absenNumber === 'number' ? d.absenNumber : undefined,
      bestScores,
      totalScore: Number(d.totalScore ?? computeFallbackTotalScore(bestScores)),
      modeTotalScores: d.modeTotalScores || bestScores,
      totalDuration: Number(d.totalDuration ?? 0),
      modeTotalDurations: d.modeTotalDurations || {},
      totalSessions: Number(d.totalSessions || 0),
      totalQuestions: Number(d.totalQuestions || 0),
      preferences: d.preferences || { soundEnabled: true, showKeyboardHints: true },
      createdAt: toDate(d.createdAt),
      updatedAt: toDate(d.updatedAt),
      lastPlayedAt: toDate(d.lastPlayedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createPlayerProfile(
  uid: string,
  rawName: string,
  absenNumber: number,
): Promise<Player> {
  const name = rawName.trim().slice(0, 60);
  const cleanAbsen = Math.max(1, Math.min(999, Math.floor(absenNumber)));
  const playerId = makePlayerId();
  const path = `players/${uid}`;
  const payload = {
    uid,
    playerId,
    name,
    absenNumber: cleanAbsen,
    bestScores: {},
    totalScore: 0,
    modeTotalScores: {},
    totalDuration: 0,
    modeTotalDurations: {},
    totalSessions: 0,
    totalQuestions: 0,
    preferences: {
      soundEnabled: true,
      showKeyboardHints: true,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'players', uid), payload);
    const created = await getPlayerProfile(uid);
    if (!created) {
      throw new Error('Gagal membaca profil pemain yang baru dibuat.');
    }
    return created;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePlayerAbsen(uid: string, absenNumber: number): Promise<void> {
  const cleanAbsen = Math.max(1, Math.min(999, Math.floor(absenNumber)));
  const path = `players/${uid}`;
  try {
    await updateDoc(doc(db, 'players', uid), {
      absenNumber: cleanAbsen,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updatePlayerName(
  uid: string,
  rawName: string,
  absenNumber?: number,
): Promise<void> {
  const name = rawName.trim().slice(0, 60);
  const path = `players/${uid}`;
  try {
    const updatePayload: Record<string, unknown> = {
      name,
      updatedAt: serverTimestamp(),
    };
    if (typeof absenNumber === 'number' && absenNumber >= 1 && absenNumber <= 999) {
      updatePayload.absenNumber = Math.floor(absenNumber);
    }
    await updateDoc(doc(db, 'players', uid), updatePayload);

    // Synchronize playerName across all active & legacy leaderboard docs owned by uid
    const modes: LeaderboardMode[] = [
      'overall',
      'ujian',
      'ujian_acak',
      'troubleshoot',
      'exam_challenge',
      'guided_syntax',
      'blind_syntax',
      'troubleshooting',
    ];
    for (const mode of modes) {
      const entryId = `${uid}_${mode}`;
      const lbRef = doc(db, 'leaderboard', entryId);
      const lbSnap = await getDoc(lbRef);
      if (lbSnap.exists()) {
        await updateDoc(lbRef, {
          playerName: name,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updatePlayerPreferences(
  uid: string,
  preferences: PlayerPreferences,
): Promise<void> {
  const path = `players/${uid}`;
  try {
    await updateDoc(doc(db, 'players', uid), {
      preferences,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function getAllPlayers(): Promise<Player[]> {
  const path = 'players';
  try {
    const snap = await getDocs(query(collection(db, 'players'), orderBy('createdAt', 'desc')));
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      const bestScores = d.bestScores || {};
      return {
        uid: d.uid,
        playerId: d.playerId,
        name: d.name,
        absenNumber: typeof d.absenNumber === 'number' ? d.absenNumber : undefined,
        bestScores,
        totalScore: Number(d.totalScore ?? computeFallbackTotalScore(bestScores)),
        modeTotalScores: d.modeTotalScores || bestScores,
        totalDuration: Number(d.totalDuration ?? 0),
        modeTotalDurations: d.modeTotalDurations || {},
        totalSessions: Number(d.totalSessions || 0),
        totalQuestions: Number(d.totalQuestions || 0),
        preferences: d.preferences || { soundEnabled: true, showKeyboardHints: true },
        createdAt: toDate(d.createdAt),
        updatedAt: toDate(d.updatedAt),
        lastPlayedAt: toDate(d.lastPlayedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// --- ADMIN ---

export async function checkIsAdmin(uid: string, email?: string | null, emailVerified?: boolean): Promise<boolean> {
  if (email === 'oim67193@gmail.com' && emailVerified === true) {
    return true;
  }
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists() && snap.data()?.role === 'admin';
  } catch {
    return false;
  }
}

export async function ensureAdminDoc(uid: string, email: string): Promise<void> {
  const path = `admins/${uid}`;
  try {
    const existing = await getDoc(doc(db, 'admins', uid));
    if (!existing.exists()) {
      await setDoc(doc(db, 'admins', uid), {
        uid,
        email: email.slice(0, 120),
        role: 'admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- CATEGORIES ---

export function subscribeCategories(
  onData: (items: Category[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, 'categories'), orderBy('orderIndex', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: Category[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          description: data.description || '',
          active: Boolean(data.active),
          orderIndex: Number(data.orderIndex || 0),
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, 'categories');
    },
  );
}

export async function saveCategory(
  id: string | null,
  input: { name: string; description: string; active: boolean; orderIndex: number },
): Promise<string> {
  const docId = id || generateDocId('cat');
  const path = `categories/${docId}`;
  try {
    if (id) {
      await updateDoc(doc(db, 'categories', docId), {
        name: input.name.trim().slice(0, 80),
        description: input.description.trim().slice(0, 400),
        active: input.active,
        orderIndex: Math.max(0, Math.min(1000, Number(input.orderIndex) || 0)),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'categories', docId), {
        name: input.name.trim().slice(0, 80),
        description: input.description.trim().slice(0, 400),
        active: input.active,
        orderIndex: Math.max(0, Math.min(1000, Number(input.orderIndex) || 0)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return docId;
  } catch (error) {
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const path = `categories/${id}`;
  try {
    await deleteDoc(doc(db, 'categories', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedInitialCategories(): Promise<number> {
  const path = 'categories';
  try {
    const existingSnap = await getDocs(collection(db, 'categories'));
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));
    let createdCount = 0;

    for (const cat of INITIAL_CATEGORIES) {
      if (!existingIds.has(cat.id)) {
        await setDoc(doc(db, 'categories', cat.id), {
          name: cat.name,
          description: cat.description,
          active: true,
          orderIndex: cat.orderIndex,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        createdCount++;
      }
    }
    return createdCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- QUESTIONS (BANK SOAL + GENERAL VARIATIONS) ---

export function subscribeQuestions(
  onData: (items: Question[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, 'questions'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: Question[] = snap.docs.map((d) => {
        const data = d.data();
        const normalizedTypes: QuestionType[] =
          Array.isArray(data.types) && data.types.length > 0
            ? Array.from(
                new Set(
                  data.types.filter(
                    (t: unknown): t is QuestionType =>
                      t === 'guided_syntax' ||
                      t === 'blind_syntax' ||
                      t === 'troubleshooting',
                  ),
                ),
              )
            : data.type
              ? [data.type as QuestionType]
              : ['guided_syntax'];

        return {
          id: d.id,
          type: normalizedTypes[0],
          types: normalizedTypes,
          categoryId: data.categoryId,
          stageId: data.stageId || '',
          orderIndex: typeof data.orderIndex === 'number' ? data.orderIndex : undefined,
          title: data.title,
          prompt: data.prompt,
          promptVariations: Array.isArray(data.promptVariations) ? data.promptVariations : [],
          correctAnswer: data.correctAnswer || '',
          answerAlternatives:
            Array.isArray(data.answerAlternatives) && data.answerAlternatives.length > 0
              ? data.answerAlternatives.filter((a: unknown): a is string => typeof a === 'string')
              : data.correctAnswer
                ? [data.correctAnswer]
                : [],
          syntaxCheckMode:
            data.syntaxCheckMode === 'flexible_order' ? 'flexible_order' : 'exact',
          answerMode: data.answerMode === 'dynamic' ? 'dynamic' : 'static',
          answerTemplate: typeof data.answerTemplate === 'string' ? data.answerTemplate : '',
          validateIpFormat: Boolean(data.validateIpFormat),
          hint: data.hint || '',
          options: Array.isArray(data.options) ? data.options : [],
          correctOption: typeof data.correctOption === 'number' ? data.correctOption : -1,
          explanation: data.explanation || '',
          difficulty: data.difficulty,
          points: typeof data.points === 'number' ? data.points : undefined,
          timeLimit: Number(data.timeLimit || 0),
          active: Boolean(data.active),
          sourceReference: data.sourceReference,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, 'questions');
    },
  );
}

export interface SaveQuestionInput {
  types: QuestionType[];
  categoryId: string;
  stageId?: string;
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
  timeLimit: number;
  active: boolean;
}

export async function saveQuestion(
  id: string | null,
  input: SaveQuestionInput,
): Promise<string> {
  const docId = id || generateDocId('q');
  const path = `questions/${docId}`;

  const uniqueTypes: QuestionType[] = Array.from(
    new Set(
      input.types.filter(
        (t): t is QuestionType =>
          t === 'guided_syntax' || t === 'blind_syntax' || t === 'troubleshooting',
      ),
    ),
  );
  if (uniqueTypes.length === 0) {
    uniqueTypes.push('guided_syntax');
  }

  const hasSyntax =
    uniqueTypes.includes('guided_syntax') || uniqueTypes.includes('blind_syntax');
  const hasGuided = uniqueTypes.includes('guided_syntax');
  const hasTrouble = uniqueTypes.includes('troubleshooting');

  const sanitizedVariations = input.promptVariations
    .map((v) => v.trim().slice(0, 2000))
    .filter((v) => v.length > 0)
    .slice(0, 30);

  const sanitizedOptions = hasTrouble
    ? input.options.map((o) => o.trim().slice(0, 500)).slice(0, 4)
    : [];

  const isDynamicMode = hasSyntax && input.answerMode === 'dynamic';
  const syntaxCheckMode: SyntaxCheckMode =
    hasSyntax && input.syntaxCheckMode === 'flexible_order' ? 'flexible_order' : 'exact';

  const rawAlternatives =
    Array.isArray(input.answerAlternatives) && input.answerAlternatives.length > 0
      ? input.answerAlternatives
      : [isDynamicMode ? input.answerTemplate || input.correctAnswer : input.correctAnswer];

  const sanitizedAlternatives = hasSyntax
    ? Array.from(
        new Set(
          rawAlternatives
            .map((a) => normalizeLineEndings(a).slice(0, 2000))
            .filter((a) => a.trim().length > 0),
        ),
      ).slice(0, 50)
    : [];

  const primarySyntaxValue =
    sanitizedAlternatives[0] ??
    (hasSyntax
      ? normalizeLineEndings(
          isDynamicMode ? input.answerTemplate || '' : input.correctAnswer,
        ).slice(0, 2000)
      : '');

  const preservedTemplate = isDynamicMode ? primarySyntaxValue : '';
  const preservedAnswer = hasSyntax ? primarySyntaxValue : '';

  const payload = {
    type: uniqueTypes[0],
    types: uniqueTypes,
    categoryId: input.categoryId,
    stageId: hasSyntax ? (input.stageId || '').trim().slice(0, 128) : '',
    ...(typeof input.orderIndex === 'number' && Number.isFinite(input.orderIndex)
      ? { orderIndex: Math.max(0, Math.min(10000, Math.floor(input.orderIndex))) }
      : {}),
    title: input.title.trim().slice(0, 160),
    prompt: input.prompt.trim().slice(0, 2000),
    promptVariations: sanitizedVariations,
    correctAnswer: preservedAnswer,
    answerAlternatives: sanitizedAlternatives,
    syntaxCheckMode,
    answerMode: (isDynamicMode ? 'dynamic' : 'static') as AnswerMode,
    answerTemplate: preservedTemplate,
    validateIpFormat: isDynamicMode ? Boolean(input.validateIpFormat) : false,
    hint: hasGuided ? input.hint.trim().slice(0, 500) : '',
    options: sanitizedOptions,
    correctOption: hasTrouble ? Math.max(0, Math.min(3, input.correctOption)) : -1,
    explanation: input.explanation.trim().slice(0, 2000),
    timeLimit: Math.max(0, Math.min(3600, Number(input.timeLimit) || 0)),
    active: Boolean(input.active),
    updatedAt: serverTimestamp(),
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'questions', docId), payload);
    } else {
      await setDoc(doc(db, 'questions', docId), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    return docId;
  } catch (error) {
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function toggleQuestionActive(question: Question): Promise<void> {
  const path = `questions/${question.id}`;
  try {
    await updateDoc(doc(db, 'questions', question.id), {
      active: !question.active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteQuestion(id: string): Promise<void> {
  const path = `questions/${id}`;
  try {
    await deleteDoc(doc(db, 'questions', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- ORDERED MILESTONE PATHS & STAGES ---

export function subscribeSyntaxPaths(
  onData: (items: SyntaxPath[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, 'syntaxPaths'), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: SyntaxPath[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title,
          description: data.description || '',
          categoryId: data.categoryId || '',
          active: Boolean(data.active),
          chapters: Array.isArray(data.chapters) ? data.chapters : [],
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, 'syntaxPaths');
    },
  );
}

export async function saveSyntaxPath(
  id: string | null,
  input: Omit<SyntaxPath, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const docId = id || generateDocId('path');
  const path = `syntaxPaths/${docId}`;
  const payload = {
    title: input.title.trim().slice(0, 160),
    description: input.description.trim().slice(0, 1000),
    categoryId: input.categoryId.trim().slice(0, 128),
    active: Boolean(input.active),
    chapters: input.chapters.slice(0, 30),
    updatedAt: serverTimestamp(),
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'syntaxPaths', docId), payload);
    } else {
      await setDoc(doc(db, 'syntaxPaths', docId), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    return docId;
  } catch (error) {
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteSyntaxPath(id: string): Promise<void> {
  const path = `syntaxPaths/${id}`;
  try {
    await deleteDoc(doc(db, 'syntaxPaths', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeSyntaxStages(
  onData: (items: SyntaxStage[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, 'syntaxStages'), orderBy('orderIndex', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: SyntaxStage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          pathId: data.pathId,
          orderIndex: Number(data.orderIndex || 0),
          title: data.title,
          description: data.description || '',
          chapterId: data.chapterId || '',
          active: Boolean(data.active),
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, 'syntaxStages');
    },
  );
}

export async function saveSyntaxStage(
  id: string | null,
  input: Omit<SyntaxStage, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const docId = id || generateDocId('stage');
  const path = `syntaxStages/${docId}`;
  const payload = {
    pathId: input.pathId,
    orderIndex: Math.max(0, Math.min(500, Number(input.orderIndex) || 0)),
    title: input.title.trim().slice(0, 160),
    description: input.description.trim().slice(0, 1000),
    chapterId: input.chapterId.trim().slice(0, 128),
    active: Boolean(input.active),
    updatedAt: serverTimestamp(),
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'syntaxStages', docId), payload);
    } else {
      await setDoc(doc(db, 'syntaxStages', docId), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    return docId;
  } catch (error) {
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteSyntaxStage(id: string): Promise<void> {
  const path = `syntaxStages/${id}`;
  try {
    await deleteDoc(doc(db, 'syntaxStages', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function reorderSyntaxStages(stages: SyntaxStage[]): Promise<void> {
  const path = 'syntaxStages';
  try {
    const batch = writeBatch(db);
    stages.forEach((stage, idx) => {
      batch.update(doc(db, 'syntaxStages', stage.id), {
        orderIndex: idx + 1,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- SETTINGS ---

export function subscribeSettings(
  onData: (settings: AppSettings) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'settings', 'global'),
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_SETTINGS);
        return;
      }
      const d = snap.data();
      onData({
        examTotalQuestions: Number(d.examTotalQuestions ?? DEFAULT_SETTINGS.examTotalQuestions),
        examGuidedCount: Number(d.examGuidedCount ?? DEFAULT_SETTINGS.examGuidedCount),
        examBlindCount: Number(d.examBlindCount ?? DEFAULT_SETTINGS.examBlindCount),
        examTroubleshootingCount: Number(
          d.examTroubleshootingCount ?? DEFAULT_SETTINGS.examTroubleshootingCount,
        ),
        troubleshootQuestionCount: Number(
          d.troubleshootQuestionCount ?? DEFAULT_SETTINGS.troubleshootQuestionCount,
        ),
        examTimeLimitSeconds: Number(
          d.examTimeLimitSeconds ?? DEFAULT_SETTINGS.examTimeLimitSeconds,
        ),
        practiceQuestionCount: Number(
          d.practiceQuestionCount ?? DEFAULT_SETTINGS.practiceQuestionCount,
        ),
        practiceTargetSecondsPerQuestion: Number(
          d.practiceTargetSecondsPerQuestion ?? DEFAULT_SETTINGS.practiceTargetSecondsPerQuestion,
        ),
        defaultPointsEasy: Number(d.defaultPointsEasy ?? DEFAULT_SETTINGS.defaultPointsEasy),
        defaultPointsMedium: Number(d.defaultPointsMedium ?? DEFAULT_SETTINGS.defaultPointsMedium),
        defaultPointsHard: Number(d.defaultPointsHard ?? DEFAULT_SETTINGS.defaultPointsHard),
        syntaxErrorPenaltyPercent: Number(
          d.syntaxErrorPenaltyPercent ?? DEFAULT_SETTINGS.syntaxErrorPenaltyPercent,
        ),
        weightCorrectness: Number(d.weightCorrectness ?? DEFAULT_SETTINGS.weightCorrectness),
        weightAccuracy: Number(d.weightAccuracy ?? DEFAULT_SETTINGS.weightAccuracy),
        weightSpeed: Number(d.weightSpeed ?? DEFAULT_SETTINGS.weightSpeed),
        prioritizeUnseenVariations: Boolean(
          d.prioritizeUnseenVariations ?? DEFAULT_SETTINGS.prioritizeUnseenVariations,
        ),
        enabledModes: {
          ...DEFAULT_SETTINGS.enabledModes,
          ...(d.enabledModes || {}),
        },
        updatedAt: toDate(d.updatedAt),
      });
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.GET, 'settings/global');
    },
  );
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const path = 'settings/global';
  try {
    await setDoc(doc(db, 'settings', 'global'), {
      examTotalQuestions: settings.examTotalQuestions,
      examGuidedCount: settings.examGuidedCount,
      examBlindCount: settings.examBlindCount,
      examTroubleshootingCount: settings.examTroubleshootingCount,
      troubleshootQuestionCount: settings.troubleshootQuestionCount,
      examTimeLimitSeconds: settings.examTimeLimitSeconds,
      practiceQuestionCount: settings.practiceQuestionCount,
      practiceTargetSecondsPerQuestion: settings.practiceTargetSecondsPerQuestion,
      defaultPointsEasy: settings.defaultPointsEasy,
      defaultPointsMedium: settings.defaultPointsMedium,
      defaultPointsHard: settings.defaultPointsHard,
      syntaxErrorPenaltyPercent: settings.syntaxErrorPenaltyPercent,
      weightCorrectness: settings.weightCorrectness,
      weightAccuracy: settings.weightAccuracy,
      weightSpeed: settings.weightSpeed,
      prioritizeUnseenVariations: settings.prioritizeUnseenVariations,
      enabledModes: settings.enabledModes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- GAME SESSIONS, ANSWERS, CUMULATIVE SCORES & LEADERBOARD ---

export async function saveCompletedSession(params: {
  sessionId?: string;
  player: Player;
  mode: GameMode;
  questionIds: string[];
  startTime: Date;
  endTime: Date;
  duration: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  correctnessScore: number;
  accuracyScore: number;
  speedScore: number;
  finalScore: number;
  answers: Array<Omit<SessionAnswer, 'id' | 'sessionId' | 'playerUid' | 'createdAt'>>;
}): Promise<ActiveSessionResult> {
  // Defensive guard: Hanya Latihan must NEVER record exam points, duration, or leaderboard entries
  if (!isCompetitiveExamMode(params.mode)) {
    throw new Error('Mode Hanya Latihan tidak masuk ke penilaian ujian maupun leaderboard.');
  }

  const sessionId = params.sessionId || generateDocId('sess');
  const sessionPath = `gameSessions/${sessionId}`;
  const roundedDuration = Math.max(0, Math.round(params.duration));
  const cleanScore = Math.min(100, Math.max(0, Number(params.finalScore.toFixed(1))));

  const sessionPayload = {
    playerUid: params.player.uid,
    playerNameSnapshot: params.player.name.slice(0, 60),
    ...(typeof params.player.absenNumber === 'number' && params.player.absenNumber >= 1
      ? { playerAbsenSnapshot: Math.min(999, Math.floor(params.player.absenNumber)) }
      : {}),
    mode: params.mode,
    questionIds: params.questionIds.slice(0, 100),
    startTime: Timestamp.fromDate(params.startTime),
    endTime: Timestamp.fromDate(params.endTime),
    duration: roundedDuration,
    totalQuestions: params.questionIds.length,
    correctCount: params.correctCount,
    wrongCount: params.wrongCount,
    unansweredCount: params.unansweredCount,
    correctnessScore: params.correctnessScore,
    accuracyScore: params.accuracyScore,
    speedScore: params.speedScore,
    finalScore: cleanScore,
    status: 'completed',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const sessionRef = doc(db, 'gameSessions', sessionId);
    const playerRef = doc(db, 'players', params.player.uid);
    const modeLbId = `${params.player.uid}_${params.mode}`;
    const modeLbRef = doc(db, 'leaderboard', modeLbId);
    const overallLbId = `${params.player.uid}_overall`;
    const overallLbRef = doc(db, 'leaderboard', overallLbId);

    // Atomic transaction guarantees:
    // 1. Idempotency: a given sessionId can NEVER be counted twice
    // 2. Player cumulative totalScore + totalDuration and leaderboard cumulative scores + durations update atomically
    const txResult = await runTransaction(db, async (tx) => {
      const existingSessSnap = await tx.get(sessionRef);
      const playerSnap = await tx.get(playerRef);
      const modeLbSnap = await tx.get(modeLbRef);
      const overallLbSnap = await tx.get(overallLbRef);

      const playerData = playerSnap.exists() ? playerSnap.data() : {};
      const existingBestScores: Record<string, number> = playerData.bestScores || {};
      const previousBest = Number(existingBestScores[params.mode] ?? 0);
      const fallbackTotal = computeFallbackTotalScore(existingBestScores);
      const currentPlayerTotal = Number(playerData.totalScore ?? fallbackTotal);
      const currentPlayerDuration = Number(playerData.totalDuration ?? 0);

      if (existingSessSnap.exists()) {
        return {
          alreadyExists: true,
          previousBest,
          previousTotalScore: currentPlayerTotal,
          newTotalScore: currentPlayerTotal,
          isNewPersonalBest: false,
        };
      }

      const isNewPersonalBest = cleanScore > previousBest;
      const nextBestScores = {
        ...existingBestScores,
        [params.mode]: isNewPersonalBest ? cleanScore : previousBest,
      };
      const newTotalScore = Number((currentPlayerTotal + cleanScore).toFixed(1));
      const existingModeTotals: Record<string, number> =
        playerData.modeTotalScores || existingBestScores;
      const prevModeTotal = Number(existingModeTotals[params.mode] ?? 0);
      const nextModeTotals = {
        ...existingModeTotals,
        [params.mode]: Number((prevModeTotal + cleanScore).toFixed(1)),
      };

      const existingModeDurations: Record<string, number> = playerData.modeTotalDurations || {};
      const prevModeDuration = Number(existingModeDurations[params.mode] ?? 0);
      const nextModeDurations = {
        ...existingModeDurations,
        [params.mode]: prevModeDuration + roundedDuration,
      };
      const newTotalDuration = currentPlayerDuration + roundedDuration;

      tx.set(sessionRef, sessionPayload);

      if (playerSnap.exists()) {
        tx.update(playerRef, {
          bestScores: nextBestScores,
          totalScore: newTotalScore,
          modeTotalScores: nextModeTotals,
          totalDuration: newTotalDuration,
          modeTotalDurations: nextModeDurations,
          totalSessions: Number(playerData.totalSessions || 0) + 1,
          totalQuestions: Number(playerData.totalQuestions || 0) + params.questionIds.length,
          lastPlayedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Per-mode cumulative leaderboard
      if (!modeLbSnap.exists()) {
        tx.set(modeLbRef, {
          playerUid: params.player.uid,
          playerName: params.player.name.slice(0, 60),
          mode: params.mode,
          bestScore: cleanScore,
          totalScore: cleanScore,
          sessionsCount: 1,
          totalAccuracySum: params.accuracyScore,
          lastSessionScore: cleanScore,
          accuracyScore: params.accuracyScore,
          duration: roundedDuration,
          achievedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const existingLb = modeLbSnap.data();
        const prevTotal = Number(existingLb.totalScore ?? existingLb.bestScore ?? 0);
        const prevCount = Number(existingLb.sessionsCount ?? (prevTotal > 0 ? 1 : 0));
        const prevAccSum = Number(
          existingLb.totalAccuracySum ??
            (prevCount > 0 ? Number(existingLb.accuracyScore || 0) * prevCount : 0),
        );
        const nextCount = prevCount + 1;
        const nextTotal = Number((prevTotal + cleanScore).toFixed(1));
        const nextAccSum = Number((prevAccSum + params.accuracyScore).toFixed(1));
        const nextAvgAcc = Number((nextAccSum / nextCount).toFixed(1));

        tx.update(modeLbRef, {
          playerName: params.player.name.slice(0, 60),
          bestScore: Math.max(Number(existingLb.bestScore || 0), cleanScore),
          totalScore: nextTotal,
          sessionsCount: nextCount,
          totalAccuracySum: nextAccSum,
          lastSessionScore: cleanScore,
          accuracyScore: nextAvgAcc,
          duration: Number(existingLb.duration || 0) + roundedDuration,
          achievedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Overall cumulative leaderboard across exam modes
      if (!overallLbSnap.exists()) {
        const priorSessions = Number(playerData.totalSessions || 0);
        const overallInitTotal = Number((currentPlayerTotal + cleanScore).toFixed(1));
        const overallInitBest = Math.max(
          cleanScore,
          ...Object.values(existingBestScores).map((v) => Number(v || 0)),
        );
        const overallInitCount = priorSessions + 1;

        tx.set(overallLbRef, {
          playerUid: params.player.uid,
          playerName: params.player.name.slice(0, 60),
          mode: 'overall',
          bestScore: Math.min(100, overallInitBest),
          totalScore: overallInitTotal,
          sessionsCount: overallInitCount,
          totalAccuracySum: Number((params.accuracyScore * overallInitCount).toFixed(1)),
          lastSessionScore: cleanScore,
          accuracyScore: params.accuracyScore,
          duration: newTotalDuration,
          achievedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const existingOverall = overallLbSnap.data();
        const prevTotal = Number(existingOverall.totalScore ?? existingOverall.bestScore ?? 0);
        const prevCount = Number(existingOverall.sessionsCount ?? (prevTotal > 0 ? 1 : 0));
        const prevAccSum = Number(
          existingOverall.totalAccuracySum ??
            (prevCount > 0 ? Number(existingOverall.accuracyScore || 0) * prevCount : 0),
        );
        const nextCount = prevCount + 1;
        const nextTotal = Number((prevTotal + cleanScore).toFixed(1));
        const nextAccSum = Number((prevAccSum + params.accuracyScore).toFixed(1));
        const nextAvgAcc = Number((nextAccSum / nextCount).toFixed(1));

        tx.update(overallLbRef, {
          playerName: params.player.name.slice(0, 60),
          bestScore: Math.max(Number(existingOverall.bestScore || 0), cleanScore),
          totalScore: nextTotal,
          sessionsCount: nextCount,
          totalAccuracySum: nextAccSum,
          lastSessionScore: cleanScore,
          accuracyScore: nextAvgAcc,
          duration: Number(existingOverall.duration || 0) + roundedDuration,
          achievedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      return {
        alreadyExists: false,
        previousBest,
        previousTotalScore: currentPlayerTotal,
        newTotalScore,
        isNewPersonalBest,
      };
    });

    // Write answer details only if this transaction created the session
    const savedAnswers: SessionAnswer[] = [];
    if (!txResult.alreadyExists && params.answers.length > 0) {
      const batch = writeBatch(db);
      params.answers.forEach((ans, idx) => {
        const answerId = `ans_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`;
        const ansDoc = {
          sessionId,
          playerUid: params.player.uid,
          questionId: ans.questionId.slice(0, 128),
          questionTitle: ans.questionTitle.slice(0, 160),
          questionType: ans.questionType,
          promptUsed: ans.promptUsed.slice(0, 2000),
          playerAnswer: normalizeLineEndings(ans.playerAnswer).slice(0, 2000),
          correctAnswer: normalizeLineEndings(ans.correctAnswer).slice(0, 2000),
          ...(Array.isArray(ans.acceptedAnswersSnapshot) && ans.acceptedAnswersSnapshot.length > 0
            ? {
                acceptedAnswersSnapshot: ans.acceptedAnswersSnapshot
                  .map((a) => normalizeLineEndings(a).slice(0, 2000))
                  .slice(0, 50),
              }
            : {}),
          ...(ans.syntaxCheckModeSnapshot
            ? { syntaxCheckModeSnapshot: ans.syntaxCheckModeSnapshot }
            : {}),
          ...(typeof ans.absenNumberSnapshot === 'number' && ans.absenNumberSnapshot >= 0
            ? { absenNumberSnapshot: Math.min(999, Math.floor(ans.absenNumberSnapshot)) }
            : {}),
          ...(ans.answerModeSnapshot ? { answerModeSnapshot: ans.answerModeSnapshot } : {}),
          ...(typeof ans.answerTemplateSnapshot === 'string'
            ? {
                answerTemplateSnapshot: normalizeLineEndings(ans.answerTemplateSnapshot).slice(
                  0,
                  2000,
                ),
              }
            : {}),
          selectedOption: ans.selectedOption,
          correctOption: ans.correctOption,
          isCorrectFirstTry: Boolean(ans.isCorrectFirstTry),
          isCompletedCorrect: Boolean(ans.isCompletedCorrect),
          attempts: Math.max(0, ans.attempts),
          errorCount: Math.max(0, ans.errorCount),
          errorPositions: ans.errorPositions.slice(0, 100),
          pointsEarned: Math.max(0, ans.pointsEarned),
          maxPoints: Math.max(0, ans.maxPoints),
          explanation: ans.explanation.slice(0, 2000),
          createdAt: serverTimestamp(),
        };
        batch.set(doc(db, 'gameSessions', sessionId, 'answers', answerId), ansDoc);
        savedAnswers.push({
          ...ansDoc,
          id: answerId,
          createdAt: new Date(),
        });
      });
      await batch.commit();
    }

    // Compute overall cumulative rank across players using strict tie-breaking rules
    let leaderboardRank: number | null = null;
    const lbAllSnap = await getDocs(
      query(collection(db, 'leaderboard'), where('mode', '==', 'overall')),
    );
    const entries: LeaderboardEntry[] = lbAllSnap.docs.map((d) => {
      const data = d.data();
      const bestScore = Number(data.bestScore || 0);
      return {
        id: d.id,
        playerUid: data.playerUid,
        playerName: data.playerName || '',
        mode: data.mode,
        bestScore,
        totalScore: Number(data.totalScore ?? bestScore),
        sessionsCount: Number(data.sessionsCount ?? 1),
        accuracyScore: Number(data.accuracyScore || 0),
        duration: Number(data.duration || 0),
        achievedAt: toDate(data.achievedAt),
        updatedAt: toDate(data.updatedAt),
      };
    });
    const ranked = sortAndRankLeaderboardEntries(entries);
    const myRankEntry = ranked.find((item) => item.id === overallLbId);
    leaderboardRank = myRankEntry ? myRankEntry.rank : null;

    const sessionResult: GameSession = {
      id: sessionId,
      playerUid: params.player.uid,
      playerNameSnapshot: params.player.name,
      playerAbsenSnapshot: params.player.absenNumber,
      mode: params.mode,
      questionIds: params.questionIds,
      startTime: params.startTime,
      endTime: params.endTime,
      duration: roundedDuration,
      totalQuestions: params.questionIds.length,
      correctCount: params.correctCount,
      wrongCount: params.wrongCount,
      unansweredCount: params.unansweredCount,
      correctnessScore: params.correctnessScore,
      accuracyScore: params.accuracyScore,
      speedScore: params.speedScore,
      finalScore: cleanScore,
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return {
      session: sessionResult,
      answers: savedAnswers,
      previousBestScore: txResult.previousBest,
      previousTotalScore: txResult.previousTotalScore,
      newTotalScore: txResult.newTotalScore,
      isNewPersonalBest: txResult.isNewPersonalBest,
      leaderboardRank,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, sessionPath);
  }
}

export async function getPlayerSessions(playerUid: string): Promise<GameSession[]> {
  const path = 'gameSessions';
  try {
    const snap = await getDocs(
      query(collection(db, 'gameSessions'), where('playerUid', '==', playerUid)),
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          playerUid: data.playerUid,
          playerNameSnapshot: data.playerNameSnapshot,
          playerAbsenSnapshot:
            typeof data.playerAbsenSnapshot === 'number' ? data.playerAbsenSnapshot : undefined,
          mode: data.mode,
          questionIds: data.questionIds || [],
          startTime: toDate(data.startTime),
          endTime: toDate(data.endTime),
          duration: Number(data.duration || 0),
          totalQuestions: Number(data.totalQuestions || 0),
          correctCount: Number(data.correctCount || 0),
          wrongCount: Number(data.wrongCount || 0),
          unansweredCount: Number(data.unansweredCount || 0),
          correctnessScore: Number(data.correctnessScore || 0),
          accuracyScore: Number(data.accuracyScore || 0),
          speedScore: Number(data.speedScore || 0),
          finalScore: Number(data.finalScore || 0),
          status: data.status,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        } as GameSession;
      })
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getAllSessions(): Promise<GameSession[]> {
  const path = 'gameSessions';
  try {
    const snap = await getDocs(query(collection(db, 'gameSessions'), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        playerUid: data.playerUid,
        playerNameSnapshot: data.playerNameSnapshot,
        playerAbsenSnapshot:
          typeof data.playerAbsenSnapshot === 'number' ? data.playerAbsenSnapshot : undefined,
        mode: data.mode,
        questionIds: data.questionIds || [],
        startTime: toDate(data.startTime),
        endTime: toDate(data.endTime),
        duration: Number(data.duration || 0),
        totalQuestions: Number(data.totalQuestions || 0),
        correctCount: Number(data.correctCount || 0),
        wrongCount: Number(data.wrongCount || 0),
        unansweredCount: Number(data.unansweredCount || 0),
        correctnessScore: Number(data.correctnessScore || 0),
        accuracyScore: Number(data.accuracyScore || 0),
        speedScore: Number(data.speedScore || 0),
        finalScore: Number(data.finalScore || 0),
        status: data.status,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getSessionAnswers(sessionId: string): Promise<SessionAnswer[]> {
  const path = `gameSessions/${sessionId}/answers`;
  try {
    const snap = await getDocs(collection(db, 'gameSessions', sessionId, 'answers'));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        sessionId: data.sessionId,
        playerUid: data.playerUid,
        questionId: data.questionId,
        questionTitle: data.questionTitle,
        questionType: data.questionType,
        promptUsed: data.promptUsed,
        playerAnswer: data.playerAnswer,
        correctAnswer: data.correctAnswer,
        acceptedAnswersSnapshot: Array.isArray(data.acceptedAnswersSnapshot)
          ? data.acceptedAnswersSnapshot.filter((a: unknown): a is string => typeof a === 'string')
          : undefined,
        syntaxCheckModeSnapshot:
          data.syntaxCheckModeSnapshot === 'flexible_order'
            ? 'flexible_order'
            : data.syntaxCheckModeSnapshot === 'exact'
              ? 'exact'
              : undefined,
        absenNumberSnapshot:
          typeof data.absenNumberSnapshot === 'number' ? data.absenNumberSnapshot : undefined,
        answerModeSnapshot:
          data.answerModeSnapshot === 'dynamic'
            ? 'dynamic'
            : data.answerModeSnapshot === 'static'
              ? 'static'
              : undefined,
        answerTemplateSnapshot:
          typeof data.answerTemplateSnapshot === 'string'
            ? data.answerTemplateSnapshot
            : undefined,
        selectedOption: Number(data.selectedOption ?? -1),
        correctOption: Number(data.correctOption ?? -1),
        isCorrectFirstTry: Boolean(data.isCorrectFirstTry),
        isCompletedCorrect: Boolean(data.isCompletedCorrect),
        attempts: Number(data.attempts || 0),
        errorCount: Number(data.errorCount || 0),
        errorPositions: Array.isArray(data.errorPositions) ? data.errorPositions : [],
        pointsEarned: Number(data.pointsEarned || 0),
        maxPoints: Number(data.maxPoints || 0),
        explanation: data.explanation || '',
        createdAt: toDate(data.createdAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// --- LEADERBOARD ---

export function subscribeLeaderboard(
  mode: LeaderboardMode,
  onData: (entries: RankedLeaderboardEntry[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, 'leaderboard'), where('mode', '==', mode));
  return onSnapshot(
    q,
    (snap) => {
      const items: LeaderboardEntry[] = snap.docs.map((d) => {
        const data = d.data();
        const bestScore = Number(data.bestScore || 0);
        const totalScore = Number(data.totalScore ?? bestScore);
        const sessionsCount = Number(data.sessionsCount ?? (bestScore > 0 ? 1 : 0));
        return {
          id: d.id,
          playerUid: data.playerUid,
          playerName: data.playerName,
          mode: data.mode,
          bestScore,
          totalScore,
          sessionsCount,
          totalAccuracySum:
            typeof data.totalAccuracySum === 'number' ? data.totalAccuracySum : undefined,
          lastSessionScore:
            typeof data.lastSessionScore === 'number' ? data.lastSessionScore : undefined,
          accuracyScore: Number(data.accuracyScore || 0),
          duration: Number(data.duration || 0),
          achievedAt: toDate(data.achievedAt),
          updatedAt: toDate(data.updatedAt),
        };
      });
      onData(sortAndRankLeaderboardEntries(items));
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, 'leaderboard');
    },
  );
}

// --- PLAYER HANYA LATIHAN PROGRESS ---

export async function getPlayerPathProgress(
  playerUid: string,
  pathId: string,
): Promise<PlayerProgress | null> {
  const docId = `${playerUid}_${pathId}`;
  const path = `playerProgress/${docId}`;
  try {
    const snap = await getDoc(doc(db, 'playerProgress', docId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id,
      playerUid: d.playerUid,
      pathId: d.pathId,
      completedStageIds: Array.isArray(d.completedStageIds) ? d.completedStageIds : [],
      lastCompletedOrder: Number(d.lastCompletedOrder ?? -1),
      currentStageId: d.currentStageId || '',
      totalAttempts: Number(d.totalAttempts || 0),
      updatedAt: toDate(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getAllPlayerProgressForUser(playerUid: string): Promise<PlayerProgress[]> {
  const path = 'playerProgress';
  try {
    const snap = await getDocs(
      query(collection(db, 'playerProgress'), where('playerUid', '==', playerUid)),
    );
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        playerUid: d.playerUid,
        pathId: d.pathId,
        completedStageIds: Array.isArray(d.completedStageIds) ? d.completedStageIds : [],
        lastCompletedOrder: Number(d.lastCompletedOrder ?? -1),
        currentStageId: d.currentStageId || '',
        totalAttempts: Number(d.totalAttempts || 0),
        updatedAt: toDate(d.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function savePlayerPathProgress(
  playerUid: string,
  pathId: string,
  input: {
    completedStageIds: string[];
    lastCompletedOrder: number;
    currentStageId: string;
    totalAttempts: number;
  },
): Promise<void> {
  const docId = `${playerUid}_${pathId}`;
  const path = `playerProgress/${docId}`;
  try {
    await setDoc(doc(db, 'playerProgress', docId), {
      playerUid,
      pathId,
      completedStageIds: input.completedStageIds.slice(0, 500),
      lastCompletedOrder: input.lastCompletedOrder,
      currentStageId: input.currentStageId.slice(0, 128),
      totalAttempts: input.totalAttempts,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
