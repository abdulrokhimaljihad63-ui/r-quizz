import React, { useEffect, useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { MODE_META } from '../../constants/defaults';
import { getAllSessions, getSessionAnswers } from '../../services/firestoreService';
import type { GameSession, SessionAnswer } from '../../types';
import { formatDurationReadable } from '../../utils/scoring';

export const AdminResultsPage: React.FC = () => {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answersMap, setAnswersMap] = useState<Record<string, SessionAnswer[]>>({});
  const [loadingAnswersId, setLoadingAnswersId] = useState<string | null>(null);
  const [answersErrorMap, setAnswersErrorMap] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    getAllSessions()
      .then(setSessions)
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat hasil permainan.');
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = sessions.filter((s) => filterMode === 'all' || s.mode === filterMode);

  const toggleExpand = async (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);
    if (!answersMap[sessionId]) {
      setLoadingAnswersId(sessionId);
      setAnswersErrorMap((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      try {
        const list = await getSessionAnswers(sessionId);
        setAnswersMap((prev) => ({ ...prev, [sessionId]: list }));
      } catch (err) {
        setAnswersErrorMap((prev) => ({
          ...prev,
          [sessionId]: err instanceof Error ? err.message : 'Gagal memuat detail jawaban sesi ini.',
        }));
      } finally {
        setLoadingAnswersId(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hasil &amp; Riwayat Permainan</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Pantau seluruh percobaan siswa dan analisis jawaban per soal.
          </p>
        </div>

        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value)}
          className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
        >
          <option value="all">Semua Mode</option>
          <option value="ujian">Ujian</option>
          <option value="ujian_acak">Ujian Latihan Soal Acak</option>
          <option value="troubleshoot">Troubleshoot</option>
          <option value="exam_challenge">Exam Challenge (Arsip)</option>
          <option value="guided_syntax">Guided Syntax (Arsip)</option>
          <option value="blind_syntax">Blind Syntax (Arsip)</option>
          <option value="troubleshooting">Troubleshooting (Arsip)</option>
        </select>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
          Memuat seluruh hasil sesi...
        </div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-sm text-red-700">
          {loadError}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
          <BarChart3 className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Belum Ada Sesi Permainan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const isOpen = expandedId === s.id;
            const answers = answersMap[s.id] || [];
            return (
              <div
                key={s.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => void toggleExpand(s.id)}
                  className="w-full p-4 text-left flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {s.playerNameSnapshot}
                      {s.playerAbsenSnapshot ? (
                        <span className="ml-2 text-xs font-mono font-medium text-blue-700">
                          (Absen {s.playerAbsenSnapshot})
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      {MODE_META[s.mode]?.label || s.mode} · Benar {s.correctCount}/
                      {s.totalQuestions} · Durasi {formatDurationReadable(s.duration)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-bold text-blue-700 tabular-nums">
                      {s.finalScore.toFixed(1)}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                    {loadingAnswersId === s.id ? (
                      <p className="text-slate-500 py-2">Memuat detail jawaban...</p>
                    ) : answersErrorMap[s.id] ? (
                      <p className="text-red-600 py-2">{answersErrorMap[s.id]}</p>
                    ) : (
                      answers.map((a, idx) => (
                      <div
                        key={a.id}
                        className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="font-semibold text-slate-800">
                            #{idx + 1} · {a.questionTitle}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <span className="text-[11px] text-slate-500">Jawaban Pemain:</span>
                              <pre className="text-slate-700 font-mono text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 whitespace-pre-wrap break-words mt-0.5">
                                {a.playerAnswer || '(kosong)'}
                              </pre>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-500">
                                {a.answerModeSnapshot === 'dynamic'
                                  ? `Kunci Sesi (Absen ${a.absenNumberSnapshot ?? s.playerAbsenSnapshot ?? '—'}):`
                                  : 'Kunci Sesi:'}
                                {a.syntaxCheckModeSnapshot === 'flexible_order'
                                  ? ' (Urutan Kata Bebas)'
                                  : ''}
                              </span>
                              <pre className="text-emerald-800 font-mono text-xs bg-emerald-50/70 border border-emerald-200 rounded px-2.5 py-1.5 whitespace-pre-wrap break-words mt-0.5">
                                {a.correctAnswer || '(kosong)'}
                              </pre>
                            </div>
                          </div>
                          {a.acceptedAnswersSnapshot && a.acceptedAnswersSnapshot.length > 1 && (
                            <div className="text-[11px] text-slate-600 space-y-1">
                              <span className="text-slate-500 block">
                                Alternatif Diterima:
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
                            <p className="text-[11px] text-slate-500">
                              Template Admin:{' '}
                              <code className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                {a.answerTemplateSnapshot}
                              </code>
                            </p>
                          )}
                        </div>
                        <span
                          className={`font-semibold shrink-0 ${
                            a.isCompletedCorrect ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          Skor: {a.pointsEarned}/{a.maxPoints}
                        </span>
                      </div>
                      ))
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
