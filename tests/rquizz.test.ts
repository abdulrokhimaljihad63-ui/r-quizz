/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_SETTINGS } from '../src/constants/defaults';
import type { AppSettings, LeaderboardEntry, Question, SyntaxPath, SyntaxStage } from '../src/types';
import {
  formatAbsenForTemplate,
  isValidIpv4OrCidr,
  parseAbsenNumber,
  resolveQuestionExpectedAnswers,
  validateDynamicTemplate,
} from '../src/utils/dynamicAnswer';
import {
  buildExamSessionQuestions,
  buildOrderedMilestoneSequence,
  buildPracticeSessionQuestions,
  buildTroubleshootSessionQuestions,
} from '../src/utils/randomizer';
import {
  calculateExamWeightedScores,
  formatDurationReadable,
  sortAndRankLeaderboardEntries,
} from '../src/utils/scoring';
import {
  evaluateFlexibleOrderInput,
  evaluateSyntaxInput,
  evaluateSyntaxWithAlternatives,
} from '../src/utils/syntaxEngine';

function makeQuestion(overrides: Partial<Question>): Question {
  return {
    id: 'q_default',
    type: 'guided_syntax',
    types: ['guided_syntax'],
    categoryId: 'cat_debian',
    stageId: '',
    title: 'Sample Question',
    prompt: 'Prompt utama',
    promptVariations: [],
    correctAnswer: 'apt update',
    hint: '',
    options: [],
    correctOption: -1,
    explanation: '',
    timeLimit: 0,
    active: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('RQuizz Syntax Engine', () => {
  it('evaluates exact single-line & multiline CRLF syntax strictly', () => {
    const exactOk = evaluateSyntaxInput('ip addr\r\nip route', 'ip addr\nip route');
    assert.equal(exactOk.isCompleteMatch, true);
    assert.equal(exactOk.hasAnyError, false);
    assert.deepEqual(exactOk.wrongPositions, []);

    const caseMismatch = evaluateSyntaxInput('IP addr', 'ip addr');
    assert.equal(caseMismatch.isCompleteMatch, false);
    assert.equal(caseMismatch.hasAnyError, true);
    assert.deepEqual(caseMismatch.wrongPositions, [0, 1]);

    const extraTrailingSpace = evaluateSyntaxInput('ip addr ', 'ip addr');
    assert.equal(extraTrailingSpace.isCompleteMatch, false);
    assert.equal(extraTrailingSpace.hasAnyError, true);
    assert.equal(extraTrailingSpace.extraChars.length, 1);
  });

  it('evaluates flexible_order token bag and handles duplicates & partials', () => {
    const reordered = evaluateFlexibleOrderInput(
      'php mariadb-server apache2 install apt',
      'apt install apache2 mariadb-server php',
    );
    assert.equal(reordered.isCompleteMatch, true);
    assert.equal(reordered.hasAnyError, false);
    assert.equal(reordered.missingTokens.length, 0);

    const duplicateErr = evaluateFlexibleOrderInput(
      'apt install apt apache2',
      'apt install apache2',
    );
    assert.equal(duplicateErr.isCompleteMatch, false);
    assert.equal(duplicateErr.hasAnyError, true);
    assert.deepEqual(duplicateErr.wrongTokens, ['apt']);

    const typingPartial = evaluateFlexibleOrderInput('apt inst', 'apt install apache2');
    assert.equal(typingPartial.isCompleteMatch, false);
    assert.equal(typingPartial.hasAnyError, false);
    assert.equal(typingPartial.tokens[1].status, 'partial');
  });

  it('evaluates multiple accepted alternatives and selects matching alternative', () => {
    const resExact = evaluateSyntaxWithAlternatives(
      'systemctl restart apache2',
      ['service apache2 restart', 'systemctl restart apache2'],
      'exact',
    );
    assert.equal(resExact.isCompleteMatch, true);
    assert.equal(resExact.matchedAlternativeIndex, 1);
    assert.equal(resExact.matchedAlternativeText, 'systemctl restart apache2');

    const resFlex = evaluateSyntaxWithAlternatives(
      'restart systemctl nginx',
      ['service nginx restart', 'systemctl restart nginx'],
      'flexible_order',
    );
    assert.equal(resFlex.isCompleteMatch, true);
    assert.equal(resFlex.matchedAlternativeIndex, 1);
  });
});

describe('RQuizz Dynamic Absen & Template Validation', () => {
  it('parses & normalizes absen numbers strictly between 1 and 999', () => {
    assert.equal(parseAbsenNumber('07'), 7);
    assert.equal(parseAbsenNumber(' 15 '), 15);
    assert.equal(parseAbsenNumber(999), 999);
    assert.equal(parseAbsenNumber('0'), null);
    assert.equal(parseAbsenNumber(1000), null);
    assert.equal(parseAbsenNumber('-5'), null);
    assert.equal(parseAbsenNumber('abc'), null);
    assert.equal(parseAbsenNumber(7.5), null);
    assert.equal(formatAbsenForTemplate(null), '1');
  });

  it('validates IPv4 and CIDR notation accurately', () => {
    assert.equal(isValidIpv4OrCidr('192.168.7.1'), true);
    assert.equal(isValidIpv4OrCidr('192.168.7.1/24'), true);
    assert.equal(isValidIpv4OrCidr('192.168.07.1'), false);
    assert.equal(isValidIpv4OrCidr('192.168.256.1'), false);
    assert.equal(isValidIpv4OrCidr('192.168.7.1/33'), false);
  });

  it('validates dynamic templates safely without eval', () => {
    assert.equal(validateDynamicTemplate('192.168.{NO_ABSEN}.1/24', true).valid, true);
    assert.equal(validateDynamicTemplate('', false).valid, false);
    assert.equal(validateDynamicTemplate('192.168.1.1', false).valid, false);
    assert.equal(validateDynamicTemplate('192.168.{ABSEN}.1', false).valid, false);
    assert.equal(validateDynamicTemplate('192.168.{{NO_ABSEN}}.1', false).valid, false);
    assert.equal(validateDynamicTemplate('192.168.{NO_ABSEN', false).valid, false);
    assert.equal(validateDynamicTemplate('999.168.{NO_ABSEN}.1', true).valid, false);
  });

  it('resolves dynamic alternatives with student absen number & keeps legacy static compat', () => {
    const dynQ = makeQuestion({
      answerMode: 'dynamic',
      answerTemplate: 'ip address add 192.168.{NO_ABSEN}.1/24 dev eth0',
      answerAlternatives: [
        'ip address add 192.168.{NO_ABSEN}.1/24 dev eth0',
        'ip a add 192.168.{NO_ABSEN}.1/24 dev eth0',
      ],
      syntaxCheckMode: 'flexible_order',
    });
    const resolved = resolveQuestionExpectedAnswers(dynQ, 7);
    assert.equal(resolved.answerMode, 'dynamic');
    assert.equal(resolved.syntaxCheckMode, 'flexible_order');
    assert.deepEqual(resolved.resolvedAnswers, [
      'ip address add 192.168.7.1/24 dev eth0',
      'ip a add 192.168.7.1/24 dev eth0',
    ]);

    const legacyQ = makeQuestion({
      correctAnswer: 'systemctl status mariadb',
      answerAlternatives: undefined,
      answerMode: undefined,
      syntaxCheckMode: undefined,
    });
    const legacyResolved = resolveQuestionExpectedAnswers(legacyQ, 7);
    assert.equal(legacyResolved.answerMode, 'static');
    assert.equal(legacyResolved.syntaxCheckMode, 'exact');
    assert.deepEqual(legacyResolved.resolvedAnswers, ['systemctl status mariadb']);
  });
});

describe('RQuizz Scoring & Leaderboard Ranking', () => {
  it('computes equal proportional 100-point scores across variable question counts', () => {
    const answers = [
      {
        isCompletedCorrect: true,
        isCorrectFirstTry: true,
        playerAnswer: 'a',
        selectedOption: -1,
        questionType: 'guided_syntax' as const,
      },
      {
        isCompletedCorrect: true,
        isCorrectFirstTry: false,
        playerAnswer: 'b',
        selectedOption: -1,
        questionType: 'blind_syntax' as const,
      },
      {
        isCompletedCorrect: false,
        isCorrectFirstTry: false,
        playerAnswer: 'wrong',
        selectedOption: 2,
        questionType: 'troubleshooting' as const,
      },
      {
        isCompletedCorrect: false,
        isCorrectFirstTry: false,
        playerAnswer: '',
        selectedOption: -1,
        questionType: 'troubleshooting' as const,
      },
    ];

    const breakdown = calculateExamWeightedScores(answers, 4, 120, 240);
    assert.equal(breakdown.correctCount, 2);
    assert.equal(breakdown.wrongCount, 1);
    assert.equal(breakdown.unansweredCount, 1);
    assert.equal(breakdown.finalScore, 50);
    assert.equal(breakdown.accuracyScore, 33.3);
    assert.equal(breakdown.speedScore, 100);
    assert.equal(breakdown.totalMaxPoints, 100);

    const zeroBreakdown = calculateExamWeightedScores([], 0, 10, 60);
    assert.equal(zeroBreakdown.finalScore, 0);
    assert.equal(zeroBreakdown.totalMaxPoints, 0);
  });

  it('ranks leaderboard by totalScore desc, shortest duration asc, and marks exact ties', () => {
    const entries: LeaderboardEntry[] = [
      {
        id: 'u1_overall',
        playerUid: 'u1',
        playerName: 'Budi',
        mode: 'overall',
        bestScore: 90,
        totalScore: 180,
        sessionsCount: 2,
        accuracyScore: 95,
        duration: 150,
        achievedAt: null,
        updatedAt: null,
      },
      {
        id: 'u2_overall',
        playerUid: 'u2',
        playerName: 'Ani',
        mode: 'overall',
        bestScore: 90,
        totalScore: 180,
        sessionsCount: 2,
        accuracyScore: 90,
        duration: 150,
        achievedAt: null,
        updatedAt: null,
      },
      {
        id: 'u3_overall',
        playerUid: 'u3',
        playerName: 'Citra',
        mode: 'overall',
        bestScore: 100,
        totalScore: 200,
        sessionsCount: 2,
        accuracyScore: 100,
        duration: 210,
        achievedAt: null,
        updatedAt: null,
      },
      {
        id: 'u4_overall',
        playerUid: 'u4',
        playerName: 'Deni',
        mode: 'overall',
        bestScore: 90,
        totalScore: 180,
        sessionsCount: 2,
        accuracyScore: 80,
        duration: 120,
        achievedAt: null,
        updatedAt: null,
      },
    ];

    const ranked = sortAndRankLeaderboardEntries(entries);
    assert.deepEqual(
      ranked.map((r) => ({ uid: r.playerUid, rank: r.rank, tied: r.isTied })),
      [
        { uid: 'u3', rank: 1, tied: false },
        { uid: 'u4', rank: 2, tied: false }, // same 180 score as u1/u2, faster duration (120s)
        { uid: 'u2', rank: 3, tied: true }, // 180 score, 150s (alphabetical Ani before Budi)
        { uid: 'u1', rank: 3, tied: true }, // exact tie with Ani
      ],
    );
    assert.equal(formatDurationReadable(3665), '1j 1m 5d');
  });
});

describe('RQuizz Question Sequencing & Randomizer', () => {
  it('builds deterministic ordered milestones shared across Hanya Latihan & Ujian', () => {
    const paths: SyntaxPath[] = [
      {
        id: 'p_active',
        title: 'UKK Paket II',
        description: '',
        categoryId: 'cat_debian',
        active: true,
        chapters: [],
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'p_inactive',
        title: 'Arsip',
        description: '',
        categoryId: 'cat_debian',
        active: false,
        chapters: [],
        createdAt: new Date('2026-01-02T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      },
    ];
    const stages: SyntaxStage[] = [
      {
        id: 's2',
        pathId: 'p_active',
        orderIndex: 2,
        title: 'Tahap 2',
        description: '',
        chapterId: '',
        active: true,
        createdAt: null,
        updatedAt: null,
      },
      {
        id: 's1',
        pathId: 'p_active',
        orderIndex: 1,
        title: 'Tahap 1',
        description: '',
        chapterId: '',
        active: true,
        createdAt: null,
        updatedAt: null,
      },
    ];
    const qs: Question[] = [
      makeQuestion({ id: 'q_unlinked', orderIndex: 5, title: 'Standalone' }),
      makeQuestion({ id: 'q_s2', stageId: 's2', title: 'Soal Tahap 2' }),
      makeQuestion({ id: 'q_s1', stageId: 's1', title: 'Soal Tahap 1' }),
      makeQuestion({
        id: 'q_trouble',
        type: 'troubleshooting',
        types: ['troubleshooting'],
        title: 'Troubleshoot Only',
      }),
      makeQuestion({ id: 'q_off', active: false, title: 'Inactive' }),
    ];

    const seq = buildOrderedMilestoneSequence(qs, paths, stages, 'uid_1', false);
    assert.equal(seq.progressPathId, 'p_active');
    assert.deepEqual(
      seq.instances.map((i) => i.question.id),
      ['q_s1', 'q_s2', 'q_unlinked'],
    );
  });

  it('allocates scarce pools without duplicating multi-type questions in Ujian Acak', () => {
    const qs: Question[] = [
      makeQuestion({ id: 'q1', types: ['guided_syntax', 'blind_syntax'] }),
      makeQuestion({ id: 'q2', types: ['guided_syntax'] }),
      makeQuestion({ id: 'q3', types: ['troubleshooting'], type: 'troubleshooting' }),
    ];
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      examTotalQuestions: 3,
      examGuidedCount: 1,
      examBlindCount: 1,
      examTroubleshootingCount: 1,
    };

    const res = buildExamSessionQuestions(qs, settings, 'uid_1');
    const selectedIds = res.instances.map((i) => i.question.id);
    assert.equal(res.hasShortfall, false);
    assert.equal(res.availableTotal, 3);
    assert.equal(new Set(selectedIds).size, 3);

    const practice = buildPracticeSessionQuestions(qs, 'guided_syntax', 'cat_debian', 5, 'uid_1', false);
    assert.equal(practice.availableCount, 2);
    assert.equal(practice.instances.length, 2);

    const trouble = buildTroubleshootSessionQuestions(qs, 5, 'uid_1', false);
    assert.equal(trouble.availableCount, 1);
    assert.equal(trouble.instances.length, 1);
  });
});
