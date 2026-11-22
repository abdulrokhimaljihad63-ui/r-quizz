import React, { useEffect, useMemo, useRef } from 'react';
import { CheckCircle2, AlertCircle, Terminal } from 'lucide-react';
import type { SyntaxCheckMode } from '../types';
import {
  evaluateSyntaxWithAlternatives,
  normalizeLineEndings,
} from '../utils/syntaxEngine';

interface SyntaxTerminalProps {
  expectedAnswer?: string;
  expectedAnswers?: string[];
  syntaxCheckMode?: SyntaxCheckMode;
  value: string;
  onChange: (nextValue: string) => void;
  onMistakeEvent?: (position: number) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  isBlindMode?: boolean;
  blindExamTyping?: boolean;
  hint?: string;
  placeholder?: string;
}

export const SyntaxTerminal: React.FC<SyntaxTerminalProps> = ({
  expectedAnswer = '',
  expectedAnswers,
  syntaxCheckMode = 'exact',
  value,
  onChange,
  onMistakeEvent,
  onSubmit,
  disabled = false,
  isBlindMode = false,
  blindExamTyping = false,
  hint,
  placeholder = 'Ketik perintah atau sintaks di sini...',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevValueRef = useRef<string>(value);

  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  const hideHints = isBlindMode || blindExamTyping;

  const normalizedAlternatives = useMemo(() => {
    if (Array.isArray(expectedAnswers) && expectedAnswers.length > 0) {
      return expectedAnswers.map((a) => normalizeLineEndings(a));
    }
    return [normalizeLineEndings(expectedAnswer)];
  }, [expectedAnswer, expectedAnswers]);

  const normalizedValue = useMemo(() => normalizeLineEndings(value), [value]);

  const evaluation = useMemo(
    () => evaluateSyntaxWithAlternatives(normalizedValue, normalizedAlternatives, syntaxCheckMode),
    [normalizedValue, normalizedAlternatives, syntaxCheckMode],
  );

  const normalizedExpected = evaluation.matchedAlternativeText;
  const isMultilineExpected = normalizedAlternatives.some((a) => a.includes('\n'));

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    const next = normalizeLineEndings(e.target.value);
    const prev = normalizeLineEndings(prevValueRef.current);

    if (!blindExamTyping && next.length > prev.length && onMistakeEvent) {
      const nextEval = evaluateSyntaxWithAlternatives(
        next,
        normalizedAlternatives,
        syntaxCheckMode,
      );

      if (syntaxCheckMode === 'flexible_order') {
        const wrongSet = new Set(nextEval.wrongPositions);
        for (let i = prev.length; i < next.length; i++) {
          if (wrongSet.has(i)) {
            onMistakeEvent(i);
          }
        }
      } else {
        const wrongSet = new Set(nextEval.wrongPositions);
        const matchesAnyPrefix = normalizedAlternatives.some((alt) => alt.startsWith(next));
        if (!matchesAnyPrefix) {
          for (let i = prev.length; i < next.length; i++) {
            if (wrongSet.has(i)) {
              onMistakeEvent(i);
            }
          }
        }
      }
    }

    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (blindExamTyping) {
        if ((e.ctrlKey || e.metaKey) && onSubmit) {
          e.preventDefault();
          onSubmit();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && evaluation.isCompleteMatch && onSubmit) {
        e.preventDefault();
        onSubmit();
        return;
      }
      if (!isMultilineExpected && evaluation.isCompleteMatch && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    }
  };

  // Pure white neutral rendering for Ujian mode (no error/success color cues until Submit)
  const renderNeutralExamChars = () => {
    if (normalizedValue.length === 0) {
      return <span className="text-slate-500 select-none">{placeholder}</span>;
    }
    return <span className="text-white">{normalizedValue}</span>;
  };

  // Render typed characters in Exact Order mode
  const renderExactTerminalChars = () => {
    if (normalizedValue.length === 0) {
      return <span className="text-slate-500 select-none">{placeholder}</span>;
    }

    const elements: React.ReactNode[] = [];

    for (let i = 0; i < normalizedValue.length; i++) {
      const ch = normalizedValue[i];
      const isMatch = i < normalizedExpected.length && ch === normalizedExpected[i];

      if (ch === '\n') {
        const nlClass = evaluation.isCompleteMatch
          ? 'text-emerald-400/70 select-none'
          : isMatch
            ? 'text-slate-500 select-none'
            : 'bg-red-500/40 text-red-200 rounded-xs px-0.5 select-none';
        elements.push(
          <React.Fragment key={i}>
            <span className={nlClass}>↵</span>
            {'\n'}
          </React.Fragment>,
        );
        continue;
      }

      let colorClass = 'text-white';
      if (evaluation.isCompleteMatch) {
        colorClass = 'text-emerald-400';
      } else if (!isMatch) {
        colorClass =
          ch === ' '
            ? 'bg-red-500/40 text-red-200 rounded-xs'
            : ch === '\t'
              ? 'bg-red-500/40 text-red-200 rounded-xs'
              : 'text-red-400 underline decoration-red-500/70';
      }

      elements.push(
        <span key={i} className={colorClass}>
          {ch}
        </span>,
      );
    }

    // In Guided mode (not Blind/Exam), show subtle neutral remaining length slots preserving line structure
    if (
      !hideHints &&
      !evaluation.isCompleteMatch &&
      normalizedValue.length < normalizedExpected.length
    ) {
      const limit = Math.min(normalizedExpected.length, normalizedValue.length + 120);
      const pendingNodes: React.ReactNode[] = [];
      for (let j = normalizedValue.length; j < limit; j++) {
        if (normalizedExpected[j] === '\n') {
          pendingNodes.push(
            <React.Fragment key={`p_${j}`}>
              <span>↵</span>
              {'\n'}
            </React.Fragment>,
          );
        } else {
          pendingNodes.push(<React.Fragment key={`p_${j}`}>·</React.Fragment>);
        }
      }
      elements.push(
        <span key="pending" className="text-slate-600 select-none">
          {pendingNodes}
        </span>,
      );
    }

    return elements;
  };

  // Render typed tokens in Flexible Word Order mode (preserving exact whitespace)
  const renderFlexibleTerminalChars = () => {
    if (normalizedValue.length === 0) {
      return <span className="text-slate-500 select-none">{placeholder}</span>;
    }

    const flex = evaluation.flexibleEval;
    if (!flex) return <span className="text-white">{normalizedValue}</span>;

    const elements: React.ReactNode[] = [];
    let cursor = 0;

    flex.tokens.forEach((tok, idx) => {
      if (tok.start > cursor) {
        const ws = normalizedValue.slice(cursor, tok.start);
        elements.push(
          <span key={`ws_${idx}`} className="text-slate-500">
            {ws}
          </span>,
        );
      }

      let colorClass = 'text-white';
      if (evaluation.isCompleteMatch) {
        colorClass = 'text-emerald-400';
      } else if (tok.status === 'wrong') {
        colorClass = 'text-red-400 underline decoration-red-500/70';
      } else if (tok.status === 'correct') {
        colorClass = 'text-white';
      }

      elements.push(
        <span key={`tok_${idx}`} className={colorClass}>
          {tok.text}
        </span>,
      );
      cursor = tok.end;
    });

    if (cursor < normalizedValue.length) {
      elements.push(
        <span key="ws_tail" className="text-slate-500">
          {normalizedValue.slice(cursor)}
        </span>,
      );
    }

    return elements;
  };

  const flexEval = evaluation.flexibleEval;
  const typedLines = normalizedValue.split('\n').length;
  const expectedLines = normalizedExpected.split('\n').length;
  const textareaRows = hideHints
    ? Math.min(10, Math.max(3, typedLines + 1))
    : Math.min(12, Math.max(2, Math.max(expectedLines, typedLines) + (isMultilineExpected ? 1 : 0)));

  return (
    <div
      onClick={() => textareaRef.current?.focus()}
      className="rounded-xl bg-slate-950 border border-slate-800 shadow-sm overflow-hidden cursor-text"
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-mono">
          <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>root@ukk-lab:~#</span>
          {!blindExamTyping && syntaxCheckMode === 'flexible_order' && (
            <span className="px-1.5 py-0.5 text-[10px] font-sans font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded">
              Urutan Kata Bebas
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {blindExamTyping ? (
            <span className="text-slate-400">Menunggu Submit Jawaban</span>
          ) : evaluation.isCompleteMatch ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {syntaxCheckMode === 'flexible_order'
                ? 'Semua Token Cocok'
                : 'Sintaks Cocok'}
            </span>
          ) : evaluation.hasAnyError ? (
            <span className="inline-flex items-center gap-1.5 text-red-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {syntaxCheckMode === 'flexible_order'
                ? 'Periksa Token Merah'
                : 'Periksa Karakter Merah'}
            </span>
          ) : (
            <span className="text-slate-400">
              {syntaxCheckMode === 'flexible_order' &&
              normalizedValue.length > 0 &&
              (flexEval?.missingTokens.length || 0) > 0
                ? 'Menunggu Token Lengkap'
                : 'Menunggu Input'}
            </span>
          )}
        </div>
      </div>

      {/* Live Evaluation Display */}
      <div className="p-4 sm:p-5 space-y-4">
        <div
          aria-live="polite"
          className="font-mono text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words min-h-[3.25rem] flex items-start gap-2"
        >
          <span className="text-blue-400 select-none shrink-0">$</span>
          <div className="flex-1 min-w-0 whitespace-pre-wrap">
            {blindExamTyping
              ? renderNeutralExamChars()
              : syntaxCheckMode === 'flexible_order'
                ? renderFlexibleTerminalChars()
                : renderExactTerminalChars()}
          </div>
        </div>

        {/* Token Status Strip for Flexible Word Order Mode (disabled in blindExamTyping!) */}
        {!blindExamTyping && syntaxCheckMode === 'flexible_order' && flexEval && (
          <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-3.5 py-2.5 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
              <span className="font-semibold text-slate-200">
                Status Token (Urutan Bebas)
              </span>
              {!isBlindMode ? (
                <span className="font-mono tabular-nums text-slate-400">
                  Terpenuhi: {flexEval.correctTokens.length} / {flexEval.expectedTokenCount} token
                </span>
              ) : (
                <span className="font-mono tabular-nums text-slate-400">
                  Token benar: {flexEval.correctTokens.length}
                </span>
              )}
            </div>

            {flexEval.correctTokens.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-emerald-400 font-medium mr-1">
                  Token benar:
                </span>
                {flexEval.correctTokens.map((tok, i) => (
                  <span
                    key={`ok_${i}`}
                    className="px-2 py-0.5 font-mono text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded"
                  >
                    ✓ {tok}
                  </span>
                ))}
              </div>
            )}

            {flexEval.wrongTokens.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-red-400 font-medium mr-1">
                  Token salah / tambahan:
                </span>
                {flexEval.wrongTokens.map((tok, i) => (
                  <span
                    key={`err_${i}`}
                    className="px-2 py-0.5 font-mono text-[11px] bg-red-500/20 text-red-300 border border-red-500/40 rounded"
                  >
                    ✕ {tok}
                  </span>
                ))}
              </div>
            )}

            {!evaluation.isCompleteMatch && flexEval.missingTokens.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-amber-300">
                {!isBlindMode ? (
                  <>
                    <span className="font-medium">
                      Masih kurang {flexEval.missingTokens.length} token:
                    </span>
                    {flexEval.missingTokens.map((tok, i) => (
                      <span
                        key={`miss_${i}`}
                        className="px-2 py-0.5 font-mono bg-slate-800 text-slate-400 border border-slate-700 rounded select-none"
                      >
                        {'·'.repeat(Math.min(14, Math.max(2, tok.length)))}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="font-medium">
                    Masih ada token yang kurang untuk melengkapi perintah.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dedicated Multiline-Capable Input Area */}
        <div className="pt-3 border-t border-slate-800/80">
          <label htmlFor="syntax-terminal-input" className="sr-only">
            Ketik perintah sintaks
          </label>
          <textarea
            ref={textareaRef}
            id="syntax-terminal-input"
            rows={textareaRows}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder={
              blindExamTyping
                ? 'Ketik jawaban sintaks secara utuh (tanpa koreksi langsung), lalu tekan tombol Submit Jawaban...'
                : syntaxCheckMode === 'flexible_order'
                  ? 'Ketik semua kata/token perintah dipisahkan spasi (urutan bebas; huruf besar/kecil sensitif)...'
                  : 'Ketik sintaks di sini (mendukung beberapa baris dengan Enter; spasi & huruf besar/kecil sensitif)...'
            }
            className="w-full bg-slate-900 text-white placeholder:text-slate-500 font-mono text-sm sm:text-base px-3.5 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 resize-y whitespace-pre overflow-x-auto"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              Karakter:{' '}
              <span className="font-mono tabular-nums text-slate-200">{normalizedValue.length}</span>
              {!hideHints && syntaxCheckMode === 'exact' && (
                <>
                  {' '}
                  / <span className="font-mono tabular-nums text-slate-300">{normalizedExpected.length}</span>
                </>
              )}
              {' · '}Baris: <span className="font-mono tabular-nums text-slate-200">{typedLines}</span>
              {!hideHints && syntaxCheckMode === 'exact' && expectedLines > 1 && (
                <>
                  {' '}
                  / <span className="font-mono tabular-nums text-slate-300">{expectedLines}</span>
                </>
              )}
            </span>
            <span>
              {blindExamTyping
                ? 'Backspace untuk koreksi sebelum Submit · Ctrl+Enter atau klik Submit Jawaban'
                : syntaxCheckMode === 'flexible_order'
                  ? 'Backspace untuk koreksi · Enter / tombol lanjut saat semua token cocok'
                  : 'Enter untuk baris baru · Ctrl+Enter atau tombol lanjut untuk selesai'}
            </span>
          </div>
        </div>

        {/* Guided Hint inside terminal only if not Blind/Exam Mode and hint exists */}
        {!hideHints && hint && hint.trim().length > 0 && (
          <div className="rounded-lg bg-slate-900/80 border border-slate-800 px-3.5 py-2.5 text-xs text-slate-300">
            <span className="font-semibold text-blue-300">Petunjuk: </span>
            <span className="font-mono whitespace-pre-wrap">{hint}</span>
          </div>
        )}
      </div>
    </div>
  );
};
