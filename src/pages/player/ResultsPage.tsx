import React from 'react';
import { Award, CheckCircle2, History, Home, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { MODE_META, QUESTION_TYPE_LABELS } from '../../constants/defaults';
import type { ActiveSessionResult } from '../../types';
import { formatDurationReadable } from '../../utils/scoring';

interface ResultsPageProps {
  result: ActiveSessionResult;
  onPlayAgain: () => void;
  onGoDashboard: () => void;
  onGoLeaderboard: () => void;
  onGoHistory: () => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
  result,
  onPlayAgain,
  onGoDashboard,
  onGoLeaderboard,
  onGoHistory,
}) => {
  const {
    session,
    answers,
    previousBestScore,
    previousTotalScore,
    newTotalScore,
    isNewPersonalBest,
    leaderboardRank,
  } = result;

  const perQuestionWeight =
    session.totalQuestions > 0 ? Number((100 / session.totalQuestions).toFixed(1)) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Main Score Card */}
      <section className="rquizz-panel rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-cyan-300">
              Hasil Ujian · {MODE_META[session.mode]?.label || session.mode}
              {session.playerAbsenSnapshot ? ` · Absen ${session.playerAbsenSnapshot}` : ''}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Skor Sesi Ini:{' '}
              <span className="text-cyan-300 tabular-nums">
                {session.finalScore.toFixed(1)}
              </span>{' '}
              <span className="text-base font-medium text-slate-400">/ 100</span>
            </h1>
            <p className="text-xs text-slate-300 mt-1.5">
              Total Poin Akumulasi:{' '}
              <span className="font-mono tabular-nums font-bold text-white">
                {newTotalScore.toFixed(1)}
              </span>{' '}
              <span className="text-emerald-400 font-mono tabular-nums">
                ({previousTotalScore.toFixed(1)} + {session.finalScore.toFixed(1)})
              </span>
              {leaderboardRank !== null && (
                <>
                  {' '}
                  · Peringkat Keseluruhan:{' '}
                  <span className="font-bold text-cyan-300 tabular-nums">
                    #{leaderboardRank}
                  </span>
                </>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Rekor tertinggi mode ini:{' '}
              <span className="font-mono tabular-nums font-semibold text-slate-200">
                {Math.max(previousBestScore, session.finalScore).toFixed(1)}
              </span>
            </p>
          </div>

          {isNewPersonalBest && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold shrink-0">
              <Award className="w-4 h-4 text-emerald-400" />
              Rekor Sesi Pribadi Baru!
            </div>
          )}
        </div>

        {/* Dynamic Exam Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-black/45 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400">Skor Sesi (Maks 100)</p>
            <p className="text-xl font-bold text-white tabular-nums mt-1">
              {session.finalScore.toFixed(1)} / 100
            </p>
          </div>
          <div className="bg-black/45 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400">Bobot Nilai Per Soal</p>
            <p className="text-xl font-bold text-white tabular-nums mt-1">
              {perQuestionWeight} poin
            </p>
          </div>
          <div className="bg-black/45 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400">Durasi Pengerjaan</p>
            <p className="text-xl font-bold text-white tabular-nums mt-1">
              {formatDurationReadable(session.duration)}
            </p>
          </div>
        </div>

        {/* Counts Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-sm">
          <div>
            <p className="text-xs text-slate-400">Benar</p>
            <p className="font-bold text-emerald-400 tabular-nums">{session.correctCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Salah</p>
            <p className="font-bold text-rose-400 tabular-nums">{session.wrongCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Tidak Terjawab</p>
            <p className="font-bold text-slate-200 tabular-nums">{session.unansweredCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Soal</p>
            <p className="font-bold text-white tabular-nums">{session.totalQuestions}</p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onPlayAgain}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-950 bg-emerald-400 rounded-lg hover:bg-emerald-300 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Ulangi Mode Ini
          </button>
          <button
            type="button"
            onClick={onGoDashboard}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-200 bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 transition-colors"
          >
            <Home className="w-4 h-4" />
            Kembali ke Dashboard
          </button>
          <button
            type="button"
            onClick={onGoLeaderboard}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-200 bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 transition-colors"
          >
            <Trophy className="w-4 h-4 text-amber-300" />
            Lihat Leaderboard
          </button>
          <button
            type="button"
            onClick={onGoHistory}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-200 bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 transition-colors"
          >
            <History className="w-4 h-4 text-fuchsia-400" />
            Lihat Riwayat
          </button>
        </div>
      </section>

      {/* Per-Question Answer Review */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white">
          Pembahasan &amp; Evaluasi Per Soal ({answers.length})
        </h2>

        <div className="space-y-3">
          {answers.map((ans, idx) => {
            const isSyntax = ans.questionType !== 'troubleshooting';
            return (
              <div
                key={ans.id || idx}
                className="rquizz-panel rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-bold text-white tabular-nums">
                      Soal #{idx + 1}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{QUESTION_TYPE_LABELS[ans.questionType]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      Skor soal: {ans.pointsEarned} / {ans.maxPoints}
                    </span>
                  </div>

                  {ans.isCompletedCorrect ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Benar
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400">
                      <XCircle className="w-4 h-4" />
                      {ans.attempts === 0 ? 'Tidak Terjawab' : 'Belum Tepat'}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-white">{ans.questionTitle}</h3>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {ans.promptUsed}
                </p>

                {isSyntax ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-black/45 border border-white/10 rounded-lg p-3.5">
                    <div>
                      <p className="text-slate-400 mb-1">Jawaban Pemain</p>
                      <pre className="font-mono text-slate-100 whitespace-pre-wrap break-words bg-black/60 border border-white/10 rounded p-2">
                        {ans.playerAnswer || '(kosong)'}
                      </pre>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">
                        {ans.answerModeSnapshot === 'dynamic'
                          ? `Jawaban Benar (Absen ${aPlaceholder(ans.absenNumberSnapshot, session.playerAbsenSnapshot)})`
                          : 'Jawaban Benar'}
                        {ans.syntaxCheckModeSnapshot === 'flexible_order'
                          ? ' · Urutan Kata Bebas'
                          : ''}
                      </p>
                      <pre className="font-mono text-emerald-300 whitespace-pre-wrap break-words bg-emerald-950/50 border border-emerald-400/30 rounded p-2">
                        {ans.correctAnswer}
                      </pre>
                    </div>
                    {ans.acceptedAnswersSnapshot && ans.acceptedAnswersSnapshot.length > 1 && (
                      <div className="sm:col-span-2 bg-black/50 border border-white/10 rounded p-2 text-slate-300 space-y-1">
                        <span className="text-[11px] font-medium text-slate-400 block">
                          Semua Alternatif Jawaban yang Diterima:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {ans.acceptedAnswersSnapshot.map((alt, i) => (
                            <code
                              key={i}
                              className="font-mono text-[11px] text-slate-100 bg-white/10 px-2 py-0.5 rounded whitespace-pre-wrap"
                            >
                              {alt}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}
                    {ans.answerModeSnapshot === 'dynamic' && ans.answerTemplateSnapshot && (
                      <div className="sm:col-span-2 bg-black/50 border border-white/10 rounded p-2 text-slate-300 space-y-0.5">
                        <span className="text-[11px] font-medium text-slate-400">
                          Template Asli Admin (Saat Sesi Berlangsung):
                        </span>
                        <pre className="font-mono text-slate-100 whitespace-pre-wrap break-words">
                          {ans.answerTemplateSnapshot}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-black/45 border border-white/10 rounded-lg p-3.5">
                    <div>
                      <p className="text-slate-400 mb-1">Pilihan Pemain</p>
                      <p className="font-semibold text-white">
                        {ans.selectedOption >= 0
                          ? `${['A', 'B', 'C', 'D'][ans.selectedOption]}. ${ans.playerAnswer}`
                          : '(tidak memilih)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">Jawaban Benar</p>
                      <p className="font-semibold text-emerald-300">
                        {['A', 'B', 'C', 'D'][ans.correctOption]}. {ans.correctAnswer}
                      </p>
                    </div>
                  </div>
                )}

                {ans.explanation && (
                  <div className="text-xs text-slate-300 leading-relaxed pt-1">
                    <span className="font-bold text-white">Penjelasan: </span>
                    {ans.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

function aPlaceholder(snap?: number, sessSnap?: number): string {
  return String(snap ?? sessSnap ?? '—');
}
