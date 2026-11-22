import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, History } from 'lucide-react';
import { MODE_META } from '../../constants/defaults';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAllPlayerProgressForUser,
  getPlayerSessions,
  getSessionAnswers,
} from '../../services/firestoreService';
import type { GameSession, PlayerProgress, SessionAnswer } from '../../types';
import { buildOrderedMilestoneSequence } from '../../utils/randomizer';
import { formatDurationReadable } from '../../utils/scoring';

export const HistoryPage: React.FC = () => {
  const { player, questions, syntaxPaths, syntaxStages, settings } = useAuth();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [progressList, setProgressList] = useState<PlayerProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answersBySession, setAnswersBySession] = useState<Record<string, SessionAnswer[]>>({});
  const [loadingAnswersId, setLoadingAnswersId] = useState<string | null>(null);

  useEffect(() => {
    if (!player) return;
    setLoading(true);
    Promise.all([getPlayerSessions(player.uid), getAllPlayerProgressForUser(player.uid)])
      .then(([sessList, progList]) => {
        setSessions(
          sessList.filter((s) => s.mode !== 'practice_only' && s.mode !== 'syntax_journey'),
        );
        setProgressList(progList);
      })
      .finally(() => setLoading(false));
  }, [player]);

  const orderedMilestones = useMemo(
    () =>
      buildOrderedMilestoneSequence(
        questions,
        syntaxPaths,
        syntaxStages,
        player?.uid || '',
        settings.prioritizeUnseenVariations,
      ),
    [questions, syntaxPaths, syntaxStages, player?.uid, settings.prioritizeUnseenVariations],
  );

  const completedKeysSet = new Set(progressList.flatMap((p) => p.completedStageIds || []));
  const completedMilestoneCount = orderedMilestones.instances.filter(
    (m) => m.milestoneKey && completedKeysSet.has(m.milestoneKey),
  ).length;

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
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Riwayat Ujian</h1>
        <p className="text-sm text-slate-600">
          Setiap sesi ujian tercatat terpisah beserta poin dan total waktu pengerjaannya.
        </p>
      </div>

      {/* Practice Milestone Progress Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-800">
              Progres Mode Hanya Latihan (Non-Nilai)
            </p>
            <p className="text-xs text-slate-500 tabular-nums">
              {completedMilestoneCount} dari {orderedMilestones.instances.length} milestone latihan
              telah diselesaikan.
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold text-emerald-700 tabular-nums">
          {orderedMilestones.instances.length > 0
            ? `${Math.round((completedMilestoneCount / orderedMilestones.instances.length) * 100)}%`
            : '0%'}
        </span>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
          Memuat riwayat ujian...
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
          <History className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Belum Ada Riwayat Ujian</p>
          <p className="text-xs text-slate-500">
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
                className="bg-white border border-slate-200 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => void toggleExpand(sess.id)}
                  className="w-full p-4 sm:p-5 text-left flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-blue-600">
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
                    <p className="text-sm font-semibold text-slate-900 tabular-nums">
                      Benar {sess.correctCount} · Salah {sess.wrongCount} · Kosong{' '}
                      {sess.unansweredCount} ({sess.totalQuestions} soal)
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Skor Sesi</p>
                      <p className="text-lg font-bold text-blue-700 font-mono tabular-nums">
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
                  <div className="border-t border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="bg-white border border-slate-200 rounded-lg p-3">
                        <span className="text-slate-500">Skor Maksimal</span>
                        <p className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                          {sess.finalScore.toFixed(1)} / 100
                        </p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg p-3">
                        <span className="text-slate-500">Bobot Per Soal</span>
                        <p className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                          {weightPerQ} poin
                        </p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg p-3">
                        <span className="text-slate-500">Waktu Sesi</span>
                        <p className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                          {formatDurationReadable(sess.duration)}
                        </p>
                      </div>
                    </div>

                    {loadingAnswersId === sess.id ? (
                      <p className="text-xs text-slate-500">Memuat detail jawaban...</p>
                    ) : (
                      <div className="space-y-2">
                        {answers.map((a, i) => (
                          <div
                            key={a.id}
                            className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-800">
                                #{i + 1} · {a.questionTitle}
                              </span>
                              <span
                                className={`font-semibold ${
                                  a.isCompletedCorrect ? 'text-emerald-700' : 'text-red-600'
                                }`}
                              >
                                {a.isCompletedCorrect ? 'Benar' : 'Salah/Kosong'} ({a.pointsEarned}
                                /{a.maxPoints})
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                              <div className="space-y-1">
                                <span>Jawaban Pemain:</span>
                                <pre className="font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 whitespace-pre-wrap break-words">
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
                                <pre className="font-mono text-xs text-emerald-800 bg-emerald-50/70 border border-emerald-200 rounded px-2.5 py-1.5 whitespace-pre-wrap break-words">
                                  {a.correctAnswer || '(kosong)'}
                                </pre>
                              </div>
                            </div>
                            {a.acceptedAnswersSnapshot && a.acceptedAnswersSnapshot.length > 1 && (
                              <div className="text-[11px] text-slate-600 pt-1 space-y-1">
                                <span className="block text-slate-500">
                                  Alternatif Jawaban Diterima:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {a.acceptedAnswersSnapshot.map((alt, idxAlt) => (
                                    <code
                                      key={idxAlt}
                                      className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded"
                                    >
                                      {alt}
                                    </code>
                                  ))}
                                </div>
                              </div>
                            )}
                            {a.answerModeSnapshot === 'dynamic' && a.answerTemplateSnapshot && (
                              <div className="text-[11px] text-slate-500 pt-1">
                                <span>Template Admin: </span>
                                <code className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
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
