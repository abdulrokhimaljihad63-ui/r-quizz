import type { AnswerMode, Question, SyntaxCheckMode } from '../types';
import { normalizeLineEndings } from './syntaxEngine';

export const ABSEN_VARIABLE_TOKEN = '{NO_ABSEN}';

/**
 * Parses and normalizes student absen number (e.g. "07" -> 7, "15" -> 15).
 * Accepts positive integers 1..999. Returns null if invalid.
 */
export function parseAbsenNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || raw < 1 || raw > 999) return null;
    return raw;
  }
  const trimmed = raw.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) return null;
  return parsed;
}

/**
 * Formats absen number for substitution into templates ("07" -> "7", "15" -> "15").
 */
export function formatAbsenForTemplate(absenNumber: number | null | undefined): string {
  const parsed = parseAbsenNumber(absenNumber);
  return parsed !== null ? String(parsed) : '1';
}

/**
 * Checks if a token is a valid IPv4 address or IPv4/CIDR string (e.g. 192.168.7.1 or 192.168.7.1/24).
 */
export function isValidIpv4OrCidr(rawToken: string): boolean {
  const token = rawToken.trim();
  if (!token) return false;

  const slashParts = token.split('/');
  if (slashParts.length > 2) return false;

  const ipPart = slashParts[0];
  const octets = ipPart.split('.');
  if (octets.length !== 4) return false;

  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) return false;
    // Reject leading zeros on multi-digit octets like "07" to catch raw un-normalized formats
    if (octet.length > 1 && octet.startsWith('0')) return false;
    const num = Number.parseInt(octet, 10);
    if (num < 0 || num > 255) return false;
  }

  if (slashParts.length === 2) {
    const cidr = slashParts[1];
    if (!/^\d{1,2}$/.test(cidr)) return false;
    const prefix = Number.parseInt(cidr, 10);
    if (prefix < 0 || prefix > 32) return false;
  }

  return true;
}

/**
 * Validates all IPv4 tokens in a resolved string when IP validation is active.
 * - If the entire text is a single token (no whitespace/newlines), the whole string must be valid IPv4/CIDR.
 * - If multi-word or multiline, checks all dotted numeric/CIDR tokens that came from {NO_ABSEN} or look like IPv4.
 */
export function validateResolvedIpOutput(
  template: string,
  resolvedText: string,
): { valid: boolean; invalidTokens: string[] } {
  const trimmedResolved = normalizeLineEndings(resolvedText).trim();
  if (!trimmedResolved) {
    return { valid: false, invalidTokens: ['(kosong)'] };
  }

  const hasWhitespace = /\s/.test(trimmedResolved);
  if (!hasWhitespace) {
    const ok = isValidIpv4OrCidr(trimmedResolved);
    return { valid: ok, invalidTokens: ok ? [] : [trimmedResolved] };
  }

  // Extract whitespace-separated tokens from template and resolved output to verify IP tokens
  const templateTokens = normalizeLineEndings(template).trim().split(/\s+/);
  const resolvedTokens = trimmedResolved.split(/\s+/);
  const invalidTokens: string[] = [];

  for (let i = 0; i < resolvedTokens.length; i++) {
    const rTok = resolvedTokens[i].replace(/[,;]+$/, '');
    const tTok = templateTokens[i] || '';
    const looksLikeIpv4 = /^\d+\.\d+/.test(rTok) || (tTok.includes(ABSEN_VARIABLE_TOKEN) && rTok.includes('.'));
    if (looksLikeIpv4 && !isValidIpv4OrCidr(rTok)) {
      invalidTokens.push(rTok);
    }
  }

  if (invalidTokens.length === 0) {
    // Also ensure at least one valid IPv4 token exists when IP validation is explicitly enabled
    const hasAnyValidIp = resolvedTokens.some((tok) => isValidIpv4OrCidr(tok.replace(/[,;]+$/, '')));
    if (!hasAnyValidIp) {
      return { valid: false, invalidTokens: ['Tidak ditemukan alamat IPv4 yang valid'] };
    }
  }

  return { valid: invalidTokens.length === 0, invalidTokens };
}

export interface DynamicTemplateValidationResult {
  valid: boolean;
  error: string | null;
  detectedVariables: string[];
}

/**
 * Safely validates a dynamic answer template without using eval() or arbitrary script execution.
 * Detects:
 * - Empty template
 * - Unbalanced curly braces '{' or '}'
 * - Unrecognized variables other than {NO_ABSEN}
 * - Missing {NO_ABSEN} placeholder
 * - Invalid IP format when validateIpFormat is enabled
 */
export function validateDynamicTemplate(
  rawTemplate: string,
  validateIpFormat: boolean,
): DynamicTemplateValidationResult {
  const template = normalizeLineEndings(rawTemplate);
  if (template.length === 0 || template.trim().length === 0) {
    return {
      valid: false,
      error: 'Template jawaban dinamis wajib diisi.',
      detectedVariables: [],
    };
  }

  // Check balanced braces and inspect every {...} placeholder
  let openCount = 0;
  for (let i = 0; i < template.length; i++) {
    const ch = template[i];
    if (ch === '{') {
      openCount++;
      if (openCount > 1) {
        return {
          valid: false,
          error: 'Format tanda kurung kurawal "{...}" tidak valid (kurung bersarang tidak diizinkan).',
          detectedVariables: [],
        };
      }
    } else if (ch === '}') {
      if (openCount === 0) {
        return {
          valid: false,
          error: 'Terdapat tanda "}" tanpa pasangan "{" pada template jawaban.',
          detectedVariables: [],
        };
      }
      openCount--;
    }
  }

  if (openCount !== 0) {
    return {
      valid: false,
      error: 'Terdapat tanda "{" yang belum ditutup dengan "}" pada template jawaban.',
      detectedVariables: [],
    };
  }

  const matches: string[] = template.match(/\{[^}]*\}/g) ?? [];
  const unknownVars = matches.filter((m) => m !== ABSEN_VARIABLE_TOKEN);
  if (unknownVars.length > 0) {
    return {
      valid: false,
      error: `Variabel tidak dikenali: ${Array.from(new Set(unknownVars)).join(', ')}. Hanya variabel ${ABSEN_VARIABLE_TOKEN} yang didukung.`,
      detectedVariables: matches,
    };
  }

  if (!matches.includes(ABSEN_VARIABLE_TOKEN)) {
    return {
      valid: false,
      error: `Template jawaban dinamis harus mengandung variabel ${ABSEN_VARIABLE_TOKEN}.`,
      detectedVariables: matches,
    };
  }

  if (validateIpFormat) {
    // Validate against sample classroom absen numbers (e.g. 7 and 15)
    for (const sampleAbsen of [7, 15]) {
      const sampleResolved = resolveDynamicTemplate(template, sampleAbsen);
      const ipCheck = validateResolvedIpOutput(template, sampleResolved);
      if (!ipCheck.valid) {
        return {
          valid: false,
          error: `Validasi format IP gagal (${ipCheck.invalidTokens.join(', ')}). Pastikan format IPv4 benar, misalnya 192.168.${ABSEN_VARIABLE_TOKEN}.1`,
          detectedVariables: matches,
        };
      }
    }
  }

  return {
    valid: true,
    error: null,
    detectedVariables: matches,
  };
}

/**
 * Safely substitutes {NO_ABSEN} with the normalized player absen number without eval().
 */
export function resolveDynamicTemplate(
  rawTemplate: string,
  absenNumber: number | null | undefined,
): string {
  const template = normalizeLineEndings(rawTemplate);
  const absenStr = formatAbsenForTemplate(absenNumber);
  return template.split(ABSEN_VARIABLE_TOKEN).join(absenStr);
}

/**
 * Resolves the exact expected answer for a question based on answerMode and player's absenNumber.
 * Fully backward compatible with legacy static questions.
 */
export function resolveQuestionExpectedAnswer(
  question: Pick<Question, 'correctAnswer' | 'answerMode' | 'answerTemplate'>,
  absenNumber: number | null | undefined,
): {
  answerMode: AnswerMode;
  template: string;
  resolvedAnswer: string;
} {
  const isDynamic =
    question.answerMode === 'dynamic' &&
    typeof question.answerTemplate === 'string' &&
    question.answerTemplate.length > 0;

  if (isDynamic) {
    const template = normalizeLineEndings(question.answerTemplate!);
    return {
      answerMode: 'dynamic',
      template,
      resolvedAnswer: resolveDynamicTemplate(template, absenNumber),
    };
  }

  return {
    answerMode: 'static',
    template: '',
    resolvedAnswer: normalizeLineEndings(question.correctAnswer || ''),
  };
}

export interface ResolvedExpectedAnswers {
  answerMode: AnswerMode;
  syntaxCheckMode: SyntaxCheckMode;
  templates: string[];
  resolvedAnswers: string[];
  primaryExpectedAnswer: string;
  primaryTemplate: string;
}

/**
 * Resolves all accepted syntax answer alternatives for a question,
 * substituting {NO_ABSEN} when answerMode is 'dynamic'.
 * Backward compatible with legacy single-answer questions and questions lacking syntaxCheckMode.
 */
export function resolveQuestionExpectedAnswers(
  question: Pick<
    Question,
    'correctAnswer' | 'answerAlternatives' | 'syntaxCheckMode' | 'answerMode' | 'answerTemplate'
  >,
  absenNumber: number | null | undefined,
): ResolvedExpectedAnswers {
  const syntaxCheckMode: SyntaxCheckMode =
    question.syntaxCheckMode === 'flexible_order' ? 'flexible_order' : 'exact';

  const isDynamic = question.answerMode === 'dynamic';

  const fallbackPrimary = normalizeLineEndings(
    isDynamic && typeof question.answerTemplate === 'string' && question.answerTemplate.length > 0
      ? question.answerTemplate
      : question.correctAnswer || '',
  );

  const rawList: string[] =
    Array.isArray(question.answerAlternatives) && question.answerAlternatives.length > 0
      ? question.answerAlternatives
          .map((item) => normalizeLineEndings(item))
          .filter((item) => item.trim().length > 0)
      : fallbackPrimary.length > 0
        ? [fallbackPrimary]
        : [''];

  const dedupedRaw = Array.from(new Set(rawList));
  if (dedupedRaw.length === 0) {
    dedupedRaw.push('');
  }

  if (isDynamic) {
    const resolvedAnswers = dedupedRaw.map((tpl) => resolveDynamicTemplate(tpl, absenNumber));
    return {
      answerMode: 'dynamic',
      syntaxCheckMode,
      templates: dedupedRaw,
      resolvedAnswers,
      primaryExpectedAnswer: resolvedAnswers[0] || '',
      primaryTemplate: dedupedRaw[0] || '',
    };
  }

  return {
    answerMode: 'static',
    syntaxCheckMode,
    templates: [],
    resolvedAnswers: dedupedRaw,
    primaryExpectedAnswer: dedupedRaw[0] || '',
    primaryTemplate: '',
  };
}
