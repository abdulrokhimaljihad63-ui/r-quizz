import type {
  AppSettings,
  Question,
  QuestionType,
  SessionQuestionInstance,
  SyntaxPath,
  SyntaxStage,
} from '../types';

const SEEN_VARIATIONS_PREFIX = 'ukk_seen_variations_';

export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getSeenVariationKeys(playerUid: string): string[] {
  try {
    const raw = localStorage.getItem(`${SEEN_VARIATIONS_PREFIX}${playerUid}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markVariationsSeen(playerUid: string, keys: string[]): void {
  if (!playerUid || keys.length === 0) return;
  try {
    const current = new Set(getSeenVariationKeys(playerUid));
    keys.forEach((k) => current.add(k));
    const bounded = Array.from(current).slice(-500);
    localStorage.setItem(`${SEEN_VARIATIONS_PREFIX}${playerUid}`, JSON.stringify(bounded));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Selects a prompt variation for a question without changing expected syntax answers.
 * Applies across all categories and question types.
 */
export function pickPromptVariation(
  question: Question,
  seenKeys: Set<string>,
  prioritizeUnseen: boolean,
): { promptUsed: string; variationKey: string } {
  const candidates = [
    { prompt: question.prompt, key: `${question.id}::main` },
    ...question.promptVariations
      .filter((v) => v.trim().length > 0)
      .map((v, idx) => ({ prompt: v, key: `${question.id}::var_${idx}` })),
  ];

  if (prioritizeUnseen) {
    const unseen = candidates.filter((c) => !seenKeys.has(c.key));
    if (unseen.length > 0) {
      const picked = unseen[Math.floor(Math.random() * unseen.length)];
      return { promptUsed: picked.prompt, variationKey: picked.key };
    }
  }

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  return { promptUsed: picked.prompt, variationKey: picked.key };
}

export function getQuestionTypes(q: Pick<Question, 'type' | 'types'>): QuestionType[] {
  if (Array.isArray(q.types) && q.types.length > 0) {
    return q.types;
  }
  return q.type ? [q.type] : ['guided_syntax'];
}

export function isSyntaxQuestion(q: Pick<Question, 'type' | 'types'>): boolean {
  const types = getQuestionTypes(q);
  return types.includes('guided_syntax') || types.includes('blind_syntax');
}

export interface OrderedMilestoneBuildResult {
  instances: SessionQuestionInstance[];
  progressPathId: string;
}

/**
 * AUTHORITATIVE SINGLE SOURCE OF SEQUENCE FOR BOTH "HANYA LATIHAN" AND "UJIAN":
 * 1. Emits all active SyntaxStages across active SyntaxPaths in strict admin order (path creation order + stage.orderIndex asc).
 *    - Never shuffles stage/question order.
 *    - Picks one active syntax question per milestone (or random variation) without changing the sequence.
 * 2. Appends any active syntax questions (guided_syntax / blind_syntax) that are not linked to an active stage,
 *    ordered deterministically by (orderIndex asc, createdAt asc, id asc).
 *
 * Guarantees identical question pool, identical total count, and identical sequence in both Hanya Latihan & Ujian.
 */
export function buildOrderedMilestoneSequence(
  allQuestions: Question[],
  syntaxPaths: SyntaxPath[],
  syntaxStages: SyntaxStage[],
  playerUid: string,
  prioritizeUnseen: boolean,
): OrderedMilestoneBuildResult {
  const seenKeys = new Set(getSeenVariationKeys(playerUid));
  const activeSyntaxQuestions = allQuestions.filter((q) => q.active && isSyntaxQuestion(q));

  const sortedActivePaths = [...syntaxPaths]
    .filter((p) => p.active)
    .sort((a, b) => {
      const tDiff = (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
      return tDiff !== 0 ? tDiff : a.id.localeCompare(b.id);
    });

  const usedQuestionIds = new Set<string>();
  const instances: SessionQuestionInstance[] = [];
  let orderCounter = 1;

  for (const path of sortedActivePaths) {
    const chapterMap = new Map<string, string>();
    (path.chapters || []).forEach((ch) => chapterMap.set(ch.id, ch.title));

    const stages = syntaxStages
      .filter((s) => s.pathId === path.id && s.active)
      .sort((a, b) => {
        if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
        return a.id.localeCompare(b.id);
      });

    for (const stage of stages) {
      const stageQuestions = activeSyntaxQuestions
        .filter((q) => q.stageId === stage.id)
        .sort((a, b) => {
          const oa = typeof a.orderIndex === 'number' ? a.orderIndex : Number.MAX_SAFE_INTEGER;
          const ob = typeof b.orderIndex === 'number' ? b.orderIndex : Number.MAX_SAFE_INTEGER;
          if (oa !== ob) return oa - ob;
          const ta = a.createdAt?.getTime() || 0;
          const tb = b.createdAt?.getTime() || 0;
          if (ta !== tb) return ta - tb;
          return a.id.localeCompare(b.id);
        });

      if (stageQuestions.length === 0) continue;

      // Mark all questions linked to this stage as represented by this milestone
      stageQuestions.forEach((sq) => usedQuestionIds.add(sq.id));

      // Deterministic question pick for stage (if 1 question doc with N promptVariations, picks that doc + random variation)
      const selectedQ = stageQuestions[0];
      const { promptUsed, variationKey } = pickPromptVariation(
        selectedQ,
        seenKeys,
        prioritizeUnseen,
      );

      instances.push({
        question: selectedQ,
        assignedType: 'guided_syntax',
        promptUsed,
        variationKey,
        milestoneKey: stage.id,
        milestoneTitle: stage.title,
        milestoneDescription: stage.description,
        chapterTitle: stage.chapterId ? chapterMap.get(stage.chapterId) : undefined,
        orderNumber: orderCounter++,
      });
    }
  }

  // Append standalone active syntax questions (not attached to an active stage) in deterministic admin order
  const unlinkedSyntaxQuestions = activeSyntaxQuestions
    .filter((q) => !usedQuestionIds.has(q.id))
    .sort((a, b) => {
      const oa = typeof a.orderIndex === 'number' ? a.orderIndex : Number.MAX_SAFE_INTEGER;
      const ob = typeof b.orderIndex === 'number' ? b.orderIndex : Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      const ta = a.createdAt?.getTime() || 0;
      const tb = b.createdAt?.getTime() || 0;
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });

  for (const q of unlinkedSyntaxQuestions) {
    const { promptUsed, variationKey } = pickPromptVariation(q, seenKeys, prioritizeUnseen);
    instances.push({
      question: q,
      assignedType: 'guided_syntax',
      promptUsed,
      variationKey,
      milestoneKey: `q_${q.id}`,
      milestoneTitle: q.title,
      orderNumber: orderCounter++,
    });
  }

  return {
    instances,
    progressPathId: sortedActivePaths[0]?.id || 'default_practice',
  };
}

export interface PracticeSelectionResult {
  instances: SessionQuestionInstance[];
  availableCount: number;
  requestedCount: number;
}

export function buildPracticeSessionQuestions(
  allQuestions: Question[],
  type: QuestionType,
  categoryId: string | 'all',
  requestedCount: number,
  playerUid: string,
  prioritizeUnseen: boolean,
): PracticeSelectionResult {
  const pool = allQuestions.filter(
    (q) =>
      q.active &&
      getQuestionTypes(q).includes(type) &&
      (categoryId === 'all' || q.categoryId === categoryId),
  );

  const seenKeys = new Set(getSeenVariationKeys(playerUid));
  const shuffled = shuffleArray(pool);
  const selected = shuffled.slice(0, Math.min(requestedCount, shuffled.length));

  const instances = selected.map((q) => {
    const { promptUsed, variationKey } = pickPromptVariation(q, seenKeys, prioritizeUnseen);
    return { question: q, assignedType: type, promptUsed, variationKey };
  });

  return {
    instances,
    availableCount: pool.length,
    requestedCount,
  };
}

export function buildTroubleshootSessionQuestions(
  allQuestions: Question[],
  requestedCount: number,
  playerUid: string,
  prioritizeUnseen: boolean,
): PracticeSelectionResult {
  return buildPracticeSessionQuestions(
    allQuestions,
    'troubleshooting',
    'all',
    requestedCount,
    playerUid,
    prioritizeUnseen,
  );
}

export interface ExamSelectionResult {
  instances: SessionQuestionInstance[];
  requestedTotal: number;
  availableTotal: number;
  compositionDetail: {
    guided: { requested: number; available: number; selected: number };
    blind: { requested: number; available: number; selected: number };
    troubleshooting: { requested: number; available: number; selected: number };
  };
  hasShortfall: boolean;
}

export function buildExamSessionQuestions(
  allQuestions: Question[],
  settings: AppSettings,
  playerUid: string,
): ExamSelectionResult {
  const activePool = allQuestions.filter((q) => q.active);
  const guidedPool = shuffleArray(
    activePool.filter((q) => getQuestionTypes(q).includes('guided_syntax')),
  );
  const blindPool = shuffleArray(
    activePool.filter((q) => getQuestionTypes(q).includes('blind_syntax')),
  );
  const troublePool = shuffleArray(
    activePool.filter((q) => getQuestionTypes(q).includes('troubleshooting')),
  );

  const usedIds = new Set<string>();
  const buckets: Array<{
    type: QuestionType;
    pool: Question[];
    requested: number;
    picked: Array<{ question: Question; assignedType: QuestionType }>;
  }> = [
    { type: 'guided_syntax', pool: guidedPool, requested: settings.examGuidedCount, picked: [] },
    { type: 'blind_syntax', pool: blindPool, requested: settings.examBlindCount, picked: [] },
    {
      type: 'troubleshooting',
      pool: troublePool,
      requested: settings.examTroubleshootingCount,
      picked: [],
    },
  ];

  // Prioritize scarcest pool first so multi-type questions maximize coverage without duplicating IDs
  const sortedBuckets = [...buckets].sort((a, b) => a.pool.length - b.pool.length);
  for (const bucket of sortedBuckets) {
    for (const q of bucket.pool) {
      if (bucket.picked.length >= bucket.requested) break;
      if (usedIds.has(q.id)) continue;
      usedIds.add(q.id);
      bucket.picked.push({ question: q, assignedType: bucket.type });
    }
  }

  const pickedGuided = buckets[0].picked;
  const pickedBlind = buckets[1].picked;
  const pickedTrouble = buckets[2].picked;

  const combined = shuffleArray([...pickedGuided, ...pickedBlind, ...pickedTrouble]);
  const seenKeys = new Set(getSeenVariationKeys(playerUid));

  const instances = combined.map(({ question, assignedType }) => {
    const { promptUsed, variationKey } = pickPromptVariation(
      question,
      seenKeys,
      settings.prioritizeUnseenVariations,
    );
    return { question, assignedType, promptUsed, variationKey };
  });

  const hasShortfall =
    pickedGuided.length < settings.examGuidedCount ||
    pickedBlind.length < settings.examBlindCount ||
    pickedTrouble.length < settings.examTroubleshootingCount;

  return {
    instances,
    requestedTotal: settings.examTotalQuestions,
    availableTotal: combined.length,
    compositionDetail: {
      guided: {
        requested: settings.examGuidedCount,
        available: guidedPool.length,
        selected: pickedGuided.length,
      },
      blind: {
        requested: settings.examBlindCount,
        available: blindPool.length,
        selected: pickedBlind.length,
      },
      troubleshooting: {
        requested: settings.examTroubleshootingCount,
        available: troublePool.length,
        selected: pickedTrouble.length,
      },
    },
    hasShortfall,
  };
}
