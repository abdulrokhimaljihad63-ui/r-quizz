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
  placeholder = 'Ketik jawaban...',
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
    ? Math.min(6, Math.max(2, typedLines))
    : Math.min(6, Math.max(2, Math.max(expectedLines, typedLines)));

  return (
    <div
      onClick={() => textareaRef.current?.focus()}
      className="rounded-xl bg-slate-950/90 backdrop-blur-md border border-fuchsia-400/30 shadow-[0_0_24px_rgba(168,85,247,0.12)] overflow-hidden cursor-text"
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-black/70 border-b border-white/10 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-mono">
          <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>root@rquizz-lab:~#</span>
        </div>
        {!blindExamTyping && (
          <div className="flex items-center gap-2">
            {evaluation.isCompleteMatch ? (
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
            ) : null}
          </div>
        )}
      </div>

      {/* Live Evaluation Display */}
      <div className="p-3 sm:p-4 space-y-2.5">
        <div
          aria-live="polite"
          className="font-mono text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words min-h-[2.25rem] flex items-start gap-2"
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

        {/* Token Status Strip for Flexible Word Order Mode (disabled in blindExamTyping) */}
        {!blindExamTyping && syntaxCheckMode === 'flexible_order' && flexEval && (
          <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2 space-y-1.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
              <span className="font-semibold text-slate-200">
                Status Token
              </span>
              {!isBlindMode ? (
                <span className="font-mono tabular-nums text-slate-400">
                  {flexEval.correctTokens.length} / {flexEval.expectedTokenCount} token
                </span>
              ) : (
                <span className="font-mono tabular-nums text-slate-400">
                  Token benar: {flexEval.correctTokens.length}
                </span>
              )}
            </div>

            {flexEval.correctTokens.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
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

            {!evaluation.isCompleteMatch && flexEval.missingTokens.length > 0 && !isBlindMode && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-amber-300">
                <span className="font-medium">
                  Kurang {flexEval.missingTokens.length} token
                </span>
              </div>
            )}
          </div>
        )}

        {/* Input Area */}
        <div className="pt-2.5 border-t border-slate-800/80">
          <label htmlFor="syntax-terminal-input" className="sr-only">
            Ketik jawaban
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
            placeholder="Ketik jawaban..."
            className="w-full bg-slate-900 text-white placeholder:text-slate-500 font-mono text-sm sm:text-base px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 resize-none whitespace-pre overflow-x-auto"
          />
        </div>

        {/* Guided Hint inside terminal only if not Blind/Exam Mode and hint exists */}
        {!hideHints && hint && hint.trim().length > 0 && (
          <div className="rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-2 text-xs text-slate-300">
            <span className="font-semibold text-blue-300">Petunjuk: </span>
            <span className="font-mono whitespace-pre-wrap">{hint}</span>
          </div>
        )}
      </div>
    </div>
  );
};
