export type CharMatchStatus = 'correct' | 'wrong' | 'pending';

export interface EvaluatedChar {
  index: number;
  expectedChar: string;
  typedChar: string;
  status: CharMatchStatus;
}

export interface SyntaxEvaluation {
  chars: EvaluatedChar[];
  extraChars: { index: number; typedChar: string }[];
  isCompleteMatch: boolean;
  hasAnyError: boolean;
  wrongPositions: number[];
  matchedPrefixLength: number;
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Evaluates typed syntax strictly character-by-character:
 * - Case sensitive
 * - Multiline line breaks (\n), indentation, whitespace, digits, punctuation, symbols checked strictly
 * - No trimming or collapsing whitespace
 */
export function evaluateSyntaxInput(rawTyped: string, rawExpected: string): SyntaxEvaluation {
  const typed = normalizeLineEndings(rawTyped);
  const expected = normalizeLineEndings(rawExpected);
  const chars: EvaluatedChar[] = [];
  const extraChars: { index: number; typedChar: string }[] = [];
  const wrongPositions: number[] = [];

  for (let i = 0; i < expected.length; i++) {
    const expectedChar = expected[i];
    if (i < typed.length) {
      const typedChar = typed[i];
      const isMatch = typedChar === expectedChar;
      if (!isMatch) {
        wrongPositions.push(i);
      }
      chars.push({
        index: i,
        expectedChar,
        typedChar,
        status: isMatch ? 'correct' : 'wrong',
      });
    } else {
      chars.push({
        index: i,
        expectedChar,
        typedChar: '',
        status: 'pending',
      });
    }
  }

  if (typed.length > expected.length) {
    for (let i = expected.length; i < typed.length; i++) {
      wrongPositions.push(i);
      extraChars.push({
        index: i,
        typedChar: typed[i],
      });
    }
  }

  let matchedPrefixLength = 0;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i].status === 'correct') {
      matchedPrefixLength++;
    } else {
      break;
    }
  }

  const hasAnyError = wrongPositions.length > 0;
  const isCompleteMatch = typed.length === expected.length && !hasAnyError && expected.length > 0;

  return {
    chars,
    extraChars,
    isCompleteMatch,
    hasAnyError,
    wrongPositions,
    matchedPrefixLength,
  };
}

export type TokenMatchStatus = 'correct' | 'partial' | 'wrong';

export interface EvaluatedToken {
  text: string;
  start: number;
  end: number;
  status: TokenMatchStatus;
}

export interface FlexibleOrderEvaluation {
  tokens: EvaluatedToken[];
  correctTokens: string[];
  wrongTokens: string[];
  missingTokens: string[];
  expectedTokenCount: number;
  isCompleteMatch: boolean;
  hasAnyError: boolean;
  wrongPositions: number[];
  wrongCharCount: number;
}

export interface TokenSpan {
  text: string;
  start: number;
  end: number;
}

/**
 * Extracts whitespace-delimited tokens along with their exact character offsets in rawText.
 */
export function extractTokenSpans(rawText: string): TokenSpan[] {
  const text = normalizeLineEndings(rawText);
  const spans: TokenSpan[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    spans.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return spans;
}

export function tokenizeSyntax(rawText: string): string[] {
  return extractTokenSpans(rawText).map((s) => s.text);
}

/**
 * Evaluates typed syntax in flexible word order mode:
 * - Tokens are separated by whitespace (spaces / newlines).
 * - Order of tokens does not matter.
 * - Every expected token (exact multiplicity) must be typed accurately (case-sensitive).
 * - Missing tokens or extra/unknown/duplicate tokens prevent completion.
 */
export function evaluateFlexibleOrderInput(
  rawTyped: string,
  rawExpected: string,
): FlexibleOrderEvaluation {
  const typed = normalizeLineEndings(rawTyped);
  const expectedTokens = tokenizeSyntax(rawExpected);
  const typedSpans = extractTokenSpans(typed);
  const endsWithWhitespace = typed.length > 0 && /\s$/.test(typed);

  const remainingCounts = new Map<string, number>();
  for (const tok of expectedTokens) {
    remainingCounts.set(tok, (remainingCounts.get(tok) || 0) + 1);
  }

  const tokens: EvaluatedToken[] = [];
  const correctTokens: string[] = [];
  const wrongTokens: string[] = [];
  const wrongPositions: number[] = [];
  let hasPartial = false;

  // First pass: assign exact matches in typed order so valid completed tokens consume counts first,
  // unless an exact token only belongs to remaining pool.
  // Note: because a token like "a" could be a prefix of "ab" while also being an exact match if "a" is remaining,
  // checking remainingCounts.get(span.text) > 0 first ensures exact match takes priority immediately.
  for (let idx = 0; idx < typedSpans.length; idx++) {
    const span = typedSpans[idx];
    const isLastInProgress = idx === typedSpans.length - 1 && !endsWithWhitespace;
    const avail = remainingCounts.get(span.text) || 0;

    if (avail > 0) {
      remainingCounts.set(span.text, avail - 1);
      tokens.push({ ...span, status: 'correct' });
      correctTokens.push(span.text);
      continue;
    }

    if (isLastInProgress) {
      let matchesRemainingPrefix = false;
      for (const [remTok, count] of remainingCounts.entries()) {
        if (count > 0 && remTok.startsWith(span.text)) {
          matchesRemainingPrefix = true;
          break;
        }
      }
      if (matchesRemainingPrefix) {
        hasPartial = true;
        tokens.push({ ...span, status: 'partial' });
        continue;
      }
    }

    tokens.push({ ...span, status: 'wrong' });
    wrongTokens.push(span.text);
    for (let p = span.start; p < span.end; p++) {
      wrongPositions.push(p);
    }
  }

  // Collect remaining missing tokens in their original admin order
  const missingCounts = new Map(remainingCounts);
  const missingTokens: string[] = [];
  for (const tok of expectedTokens) {
    const c = missingCounts.get(tok) || 0;
    if (c > 0) {
      missingTokens.push(tok);
      missingCounts.set(tok, c - 1);
    }
  }

  const hasAnyError = wrongTokens.length > 0;
  const isCompleteMatch =
    expectedTokens.length > 0 &&
    !hasAnyError &&
    !hasPartial &&
    missingTokens.length === 0;

  return {
    tokens,
    correctTokens,
    wrongTokens,
    missingTokens,
    expectedTokenCount: expectedTokens.length,
    isCompleteMatch,
    hasAnyError,
    wrongPositions,
    wrongCharCount: wrongPositions.length,
  };
}

export interface MultiSyntaxEvaluation {
  syntaxCheckMode: 'exact' | 'flexible_order';
  isCompleteMatch: boolean;
  hasAnyError: boolean;
  matchedAlternativeIndex: number;
  matchedAlternativeText: string;
  exactEval: SyntaxEvaluation | null;
  flexibleEval: FlexibleOrderEvaluation | null;
  wrongPositions: number[];
}

/**
 * Evaluates typed syntax against 1 or more accepted answer alternatives,
 * using either 'exact' (character-by-character order) or 'flexible_order' (token-bag order).
 */
export function evaluateSyntaxWithAlternatives(
  rawTyped: string,
  rawExpectedAlternatives: string[],
  syntaxCheckMode: 'exact' | 'flexible_order' = 'exact',
): MultiSyntaxEvaluation {
  const typed = normalizeLineEndings(rawTyped);
  const alternatives =
    rawExpectedAlternatives.length > 0
      ? rawExpectedAlternatives.map((a) => normalizeLineEndings(a))
      : [''];

  if (syntaxCheckMode === 'flexible_order') {
    const candidates = alternatives.map((alt, idx) => ({
      idx,
      alt,
      ev: evaluateFlexibleOrderInput(typed, alt),
    }));

    // Rank:
    // 1. Complete match first
    // 2. Fewest wrong tokens
    // 3. Most correct tokens (plus partial progress bonus)
    // 4. Fewest missing tokens
    // 5. Original index
    const sorted = [...candidates].sort((a, b) => {
      if (a.ev.isCompleteMatch !== b.ev.isCompleteMatch) {
        return a.ev.isCompleteMatch ? -1 : 1;
      }
      if (a.ev.wrongTokens.length !== b.ev.wrongTokens.length) {
        return a.ev.wrongTokens.length - b.ev.wrongTokens.length;
      }
      const aProgress =
        a.ev.correctTokens.length + (a.ev.tokens.some((t) => t.status === 'partial') ? 0.5 : 0);
      const bProgress =
        b.ev.correctTokens.length + (b.ev.tokens.some((t) => t.status === 'partial') ? 0.5 : 0);
      if (bProgress !== aProgress) {
        return bProgress - aProgress;
      }
      if (a.ev.missingTokens.length !== b.ev.missingTokens.length) {
        return a.ev.missingTokens.length - b.ev.missingTokens.length;
      }
      return a.idx - b.idx;
    });

    const best = sorted[0];
    return {
      syntaxCheckMode: 'flexible_order',
      isCompleteMatch: best.ev.isCompleteMatch,
      hasAnyError: best.ev.hasAnyError,
      matchedAlternativeIndex: best.idx,
      matchedAlternativeText: best.alt,
      exactEval: null,
      flexibleEval: best.ev,
      wrongPositions: best.ev.wrongPositions,
    };
  }

  // Exact mode across multiple alternatives
  const candidates = alternatives.map((alt, idx) => ({
    idx,
    alt,
    startsWithTyped: typed.length > 0 && alt.startsWith(typed),
    ev: evaluateSyntaxInput(typed, alt),
  }));

  const sorted = [...candidates].sort((a, b) => {
    if (a.ev.isCompleteMatch !== b.ev.isCompleteMatch) {
      return a.ev.isCompleteMatch ? -1 : 1;
    }
    if (a.startsWithTyped !== b.startsWithTyped) {
      return a.startsWithTyped ? -1 : 1;
    }
    if (b.ev.matchedPrefixLength !== a.ev.matchedPrefixLength) {
      return b.ev.matchedPrefixLength - a.ev.matchedPrefixLength;
    }
    if (a.ev.wrongPositions.length !== b.ev.wrongPositions.length) {
      return a.ev.wrongPositions.length - b.ev.wrongPositions.length;
    }
    const aLenDiff = Math.abs(a.alt.length - typed.length);
    const bLenDiff = Math.abs(b.alt.length - typed.length);
    if (aLenDiff !== bLenDiff) {
      return aLenDiff - bLenDiff;
    }
    return a.idx - b.idx;
  });

  const best = sorted[0];
  return {
    syntaxCheckMode: 'exact',
    isCompleteMatch: best.ev.isCompleteMatch,
    hasAnyError: best.ev.hasAnyError,
    matchedAlternativeIndex: best.idx,
    matchedAlternativeText: best.alt,
    exactEval: best.ev,
    flexibleEval: null,
    wrongPositions: best.ev.wrongPositions,
  };
}
