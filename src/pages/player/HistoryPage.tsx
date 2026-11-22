import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { MODE_META } from '../../constants/defaults';
import { useAuth } from '../../contexts/AuthContext';
import {
  getPlayerSessions,
  getSessionAnswers,
} from '../../services/firestoreService';
import type { GameSession, SessionAnswer } from '../../types';
import { formatDurationReadable } from '../../utils/scoring';

export const HistoryPage: React.FC = () => {
  const { player } = useAuth();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answersBySession, setAnswersBySession] = useState<Record<string, SessionAnswer[]>>({});
  const [loadingAnswersId, setLoadingAnswersId] = useState<string | null>(null);

  useEffect(() => {
    if (!player) return;
    setLoading(true);
    getPlayerSessions(player.uid)
      .then((sessList) => {
        setSessions(
          sessList.filter((s) => s.mode !== 'practice_only' && s.mode !== 'syntax_journey'),
        );
      })
      .finally(() => setLoading(false));
  }, [player]);

  const toggleExpand = async (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);
    if (!answersBySession[sessionId]) {
      setLoadingAnswersId(sessionId);
      try {
        const list = await getSessionAnswers(sessionId);
        setAnswersBySession((prev) => ({ ...prev, [sessionId]: list }));
      } finally {
        setLoadingAnswersId(null);
      }
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Riwayat Ujian</h1>

      {loading ? (
        <div className="rquizz-panel rounded-2xl p-8 text-center text-sm text-slate-300">
          Memuat riwayat ujian...
        </div>
      ) : sessions.length === 0 ? (
        <div className="rquizz-panel rounded-2xl p-10 text-center space-y-2">
          <History className="w-8 h-8 text-fuchsia-400/70 mx-auto" />
          <p className="text-sm font-bold text-white">Belum Ada Riwayat Ujian</p>
          <p className="text-xs text-slate-300">
            Selesaikan satu sesi Ujian, Ujian Latihan Soal Acak, atau Troubleshoot untuk melihat
            riwayatnya di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((sess) => {
            const isOpen = expandedId === sess.id;
            const answers = answersBySession[sess.id] || [];
            const weightPerQ =
              sess.totalQuestions > 0 ? (100 / sess.totalQuestions).toFixed(1) : '0';

            return (
              <div
                key={sess.id}
                className="rquizz-panel rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => void toggleExpand(sess.id)}
                  className="w-full p-4 sm:p-5 text-left flex flex-wrap items-center justify-between gap-4 hover:bg-white/5 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                      <span className="font-bold text-cyan-300">
                        {MODE_META[sess.mode]?.label || sess.mode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {sess.createdAt
                          ? sess.createdAt.toLocaleString('id-ID', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatDurationReadable(sess.duration)}</span>
                      {sess.playerAbsenSnapshot ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">Absen {sess.playerAbsenSnapshot}</span>
                        </>
                      ) : null}
                    </div>
                    <p className="text-sm font-bold text-white tabular-nums">
                      Benar {sess.correctCount} · Salah {sess.wrongCount} · Kosong{' '}
                      {sess.unansweredCount} ({sess.totalQuestions} soal)
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Skor Sesi</p>
                      <p className="text-lg font-bold text-cyan-300 font-mono tabular-nums">
                        {sess.finalScore.toFixed(1)}
                      </p>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/10 bg-black/45 p-4 sm:p-5 space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="bg-slate-950/75 border border-white/10 rounded-lg p-3">
                        <span className="text-slate-400">Skor Maksimal</span>
                        <p className="font-mono font-bold text-white tabular-nums mt-0.5">
                          {sess.finalScore.toFixed(1)} / 100
                        </p>
                      </div>
                      <div className="bg-slate-950/75 border border-white/10 rounded-lg p-3">
                        <span className="text-slate-400">Bobot Per Soal</span>
                        <p className="font-mono font-bold text-white tabular-nums mt-0.5">
                          {weightPerQ} poin
                        </p>
                      </div>
                      <div className="bg-slate-950/75 border border-white/10 rounded-lg p-3">
                        <span className="text-slate-400">Waktu Sesi</span>
                        <p className="font-mono font-bold text-white tabular-nums mt-0.5">
                          {formatDurationReadable(sess.duration)}
                        </p>
                      </div>
                    </div>

                    {loadingAnswersId === sess.id ? (
                      <p className="text-xs text-slate-300">Memuat detail jawaban...</p>
                    ) : (
                      <div className="space-y-2">
                        {answers.map((a, i) => (
                          <div
                            key={a.id}
                            className="bg-slate-950/80 border border-white/10 rounded-lg p-3 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-white">
                                #{i + 1} · {a.questionTitle}
                              </span>
                              <span
                                className={`font-bold ${
                                  a.isCompletedCorrect ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {a.isCompletedCorrect ? 'Benar' : 'Salah/Kosong'} ({a.pointsEarned}
                                /{a.maxPoints})
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                              <div className="space-y-1">
                                <span>Jawaban Pemain:</span>
                                <pre className="font-mono text-xs text-slate-100 bg-black/60 border border-white/10 rounded px-2.5 py-1.5 whitespace-pre-wrap break-words">
                                  {a.playerAnswer || '(kosong)'}
                                </pre>
                              </div>
                              <div className="space-y-1">
                                <span>
                                  {a.answerModeSnapshot === 'dynamic'
                                    ? `Jawaban Benar (Absen ${a.absenNumberSnapshot ?? sess.playerAbsenSnapshot ?? '—'}):`
                                    : 'Jawaban Benar:'}
                                  {a.syntaxCheckModeSnapshot === 'flexible_order'
                                    ? ' (Urutan Kata Bebas)'
                                    : ''}
                                </span>
                                <pre className="font-mono text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-400/30 rounded px-2.5 py-1.5 whitespace-pre-wrap break-words">
                                  {a.correctAnswer || '(kosong)'}
                                </pre>
                              </div>
                            </div>
                            {a.acceptedAnswersSnapshot && a.acceptedAnswersSnapshot.length > 1 && (
                              <div className="text-[11px] text-slate-300 pt-1 space-y-1">
                                <span className="block text-slate-400">
                                  Alternatif Jawaban Diterima:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {a.acceptedAnswersSnapshot.map((alt, idxAlt) => (
                                    <code
                                      key={idxAlt}
                                      className="font-mono text-slate-200 bg-white/10 px-1.5 py-0.5 rounded"
                                    >
                                      {alt}
                                    </code>
                                  ))}
                                </div>
                              </div>
                            )}
                            {a.answerModeSnapshot === 'dynamic' && a.answerTemplateSnapshot && (
                              <div className="text-[11px] text-slate-400 pt-1">
                                <span>Template Admin: </span>
                                <code className="font-mono text-slate-200 bg-white/10 px-1.5 py-0.5 rounded">
                                  {a.answerTemplateSnapshot}
                                </code>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
