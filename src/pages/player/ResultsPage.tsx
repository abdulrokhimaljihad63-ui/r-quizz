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
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-blue-600">
              Hasil Ujian · {MODE_META[session.mode]?.label || session.mode}
              {session.playerAbsenSnapshot ? ` · Absen ${session.playerAbsenSnapshot}` : ''}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              Skor Sesi Ini:{' '}
              <span className="text-blue-600 tabular-nums">
                {session.finalScore.toFixed(1)}
              </span>{' '}
              <span className="text-base font-medium text-slate-400">/ 100</span>
            </h1>
            <p className="text-xs text-slate-600 mt-1.5">
              Total Poin Akumulasi:{' '}
              <span className="font-mono tabular-nums font-bold text-slate-900">
                {newTotalScore.toFixed(1)}
              </span>{' '}
              <span className="text-emerald-700 font-mono tabular-nums">
                ({previousTotalScore.toFixed(1)} + {session.finalScore.toFixed(1)})
              </span>
              {leaderboardRank !== null && (
                <>
                  {' '}
                  · Peringkat Keseluruhan:{' '}
                  <span className="font-semibold text-blue-700 tabular-nums">
                    #{leaderboardRank}
                  </span>
                </>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Rekor tertinggi mode ini:{' '}
              <span className="font-mono tabular-nums font-medium text-slate-700">
                {Math.max(previousBestScore, session.finalScore).toFixed(1)}
              </span>
            </p>
          </div>

          {isNewPersonalBest && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shrink-0">
              <Award className="w-4 h-4 text-emerald-600" />
              Rekor Sesi Pribadi Baru!
            </div>
          )}
        </div>

        {/* Dynamic Exam Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Skor Sesi (Maks 100)</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">
              {session.finalScore.toFixed(1)} / 100
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Bobot Nilai Per Soal</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">
              {perQuestionWeight} poin
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Durasi Pengerjaan</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">
              {formatDurationReadable(session.duration)}
            </p>
          </div>
        </div>

        {/* Counts Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-sm">
          <div>
            <p className="text-xs text-slate-500">Benar</p>
            <p className="font-bold text-emerald-700 tabular-nums">{session.correctCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Salah</p>
            <p className="font-bold text-red-600 tabular-nums">{session.wrongCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tidak Terjawab</p>
            <p className="font-bold text-slate-700 tabular-nums">{session.unansweredCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Soal</p>
            <p className="font-bold text-slate-900 tabular-nums">{session.totalQuestions}</p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onPlayAgain}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Ulangi Mode Ini
          </button>
          <button
            type="button"
            onClick={onGoDashboard}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Home className="w-4 h-4" />
            Kembali ke Dashboard
          </button>
          <button
            type="button"
            onClick={onGoLeaderboard}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Trophy className="w-4 h-4 text-blue-600" />
            Lihat Leaderboard
          </button>
          <button
            type="button"
            onClick={onGoHistory}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <History className="w-4 h-4" />
            Lihat Riwayat
          </button>
        </div>
      </section>

      {/* Per-Question Answer Review */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">
          Pembahasan &amp; Evaluasi Per Soal ({answers.length})
        </h2>

        <div className="space-y-3">
          {answers.map((ans, idx) => {
            const isSyntax = ans.questionType !== 'troubleshooting';
            return (
              <div
                key={ans.id || idx}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-800 tabular-nums">
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
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      Benar
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                      <XCircle className="w-4 h-4" />
                      {ans.attempts === 0 ? 'Tidak Terjawab' : 'Belum Tepat'}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-900">{ans.questionTitle}</h3>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {ans.promptUsed}
                </p>

                {isSyntax ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                    <div>
                      <p className="text-slate-500 mb-1">Jawaban Pemain</p>
                      <pre className="font-mono text-slate-900 whitespace-pre-wrap break-words bg-white border border-slate-200 rounded p-2">
                        {ans.playerAnswer || '(kosong)'}
                      </pre>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">
                        {ans.answerModeSnapshot === 'dynamic'
                          ? `Jawaban Benar (Absen ${ans.absenNumberSnapshot ?? session.playerAbsenSnapshot ?? '—'})`
                          : 'Jawaban Benar'}
                        {ans.syntaxCheckModeSnapshot === 'flexible_order'
                          ? ' · Urutan Kata Bebas'
                          : ''}
                      </p>
                      <pre className="font-mono text-emerald-700 whitespace-pre-wrap break-words bg-white border border-emerald-200 rounded p-2">
                        {ans.correctAnswer}
                      </pre>
                    </div>
                    {ans.acceptedAnswersSnapshot && ans.acceptedAnswersSnapshot.length > 1 && (
                      <div className="sm:col-span-2 bg-white border border-slate-200 rounded p-2 text-slate-600 space-y-1">
                        <span className="text-[11px] font-medium text-slate-500 block">
                          Semua Alternatif Jawaban yang Diterima:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {ans.acceptedAnswersSnapshot.map((alt, i) => (
                            <code
                              key={i}
                              className="font-mono text-[11px] text-slate-800 bg-slate-100 px-2 py-0.5 rounded whitespace-pre-wrap"
                            >
                              {alt}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}
                    {ans.answerModeSnapshot === 'dynamic' && ans.answerTemplateSnapshot && (
                      <div className="sm:col-span-2 bg-white border border-slate-200 rounded p-2 text-slate-600 space-y-0.5">
                        <span className="text-[11px] font-medium text-slate-500">
                          Template Asli Admin (Saat Sesi Berlangsung):
                        </span>
                        <pre className="font-mono text-slate-800 whitespace-pre-wrap break-words">
                          {ans.answerTemplateSnapshot}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                    <div>
                      <p className="text-slate-500 mb-1">Pilihan Pemain</p>
                      <p className="font-medium text-slate-900">
                        {ans.selectedOption >= 0
                          ? `${['A', 'B', 'C', 'D'][ans.selectedOption]}. ${ans.playerAnswer}`
                          : '(tidak memilih)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">Jawaban Benar</p>
                      <p className="font-medium text-emerald-700">
                        {['A', 'B', 'C', 'D'][ans.correctOption]}. {ans.correctAnswer}
                      </p>
                    </div>
                  </div>
                )}

                {ans.explanation && (
                  <div className="text-xs text-slate-600 leading-relaxed pt-1">
                    <span className="font-semibold text-slate-800">Penjelasan: </span>
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
