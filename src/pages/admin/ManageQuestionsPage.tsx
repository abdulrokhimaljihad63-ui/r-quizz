import React, { useMemo, useState } from 'react';
import { BookOpen, Edit2, Plus, Search, Trash2 } from 'lucide-react';
import { QUESTION_TYPE_LABELS } from '../../constants/defaults';
import { useAuth } from '../../contexts/AuthContext';
import { deleteQuestion, toggleQuestionActive } from '../../services/firestoreService';
import type { Question, QuestionType } from '../../types';
import { getQuestionTypes } from '../../utils/randomizer';
import { QuestionFormModal } from './QuestionFormModal';

export const ManageQuestionsPage: React.FC = () => {
  const { questions, categories } = useAuth();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'title'>('newest');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const filteredQuestions = useMemo(() => {
    const qLower = search.trim().toLowerCase();
    return questions
      .filter((q) => {
        if (filterCategory !== 'all' && q.categoryId !== filterCategory) return false;
        if (
          filterType !== 'all' &&
          !getQuestionTypes(q).includes(filterType as QuestionType)
        ) {
          return false;
        }
        if (filterStatus === 'active' && !q.active) return false;
        if (filterStatus === 'inactive' && q.active) return false;
        if (qLower) {
          const alts = (q.answerAlternatives || []).join(' ');
          const hay = `${q.title} ${q.prompt} ${q.correctAnswer} ${alts} ${q.promptVariations.join(' ')}`.toLowerCase();
          if (!hay.includes(qLower)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
      });
  }, [questions, search, filterCategory, filterType, filterStatus, sortBy]);

  const handleDelete = async (q: Question) => {
    if (busyId) return;
    setBusyId(q.id);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await deleteQuestion(q.id);
      setFeedback(`Soal "${q.title}" berhasil dihapus.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghapus soal.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (q: Question) => {
    if (busyId) return;
    setBusyId(q.id);
    setErrorMsg(null);
    try {
      await toggleQuestionActive(q);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengubah status soal.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kelola Bank Soal</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Buat soal secara manual beserta variasi soal general untuk semua kategori.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingQuestion(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Soal
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-800">
          {errorMsg}
        </div>
      )}

      {feedback && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-900">
          {feedback}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul, soal, atau sintaks..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="all">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="all">Semua Jenis</option>
          <option value="guided_syntax">Guided Syntax</option>
          <option value="blind_syntax">Blind Syntax</option>
          <option value="troubleshooting">Troubleshooting</option>
        </select>

        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'title')}
            className="flex-1 px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="newest">Terbaru</option>
            <option value="title">Judul A-Z</option>
          </select>
        </div>
      </div>

      {/* Questions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {filteredQuestions.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              {questions.length === 0
                ? 'Bank Soal Masih Kosong'
                : 'Tidak Ada Soal yang Cocok Dengan Filter'}
            </p>
            <p className="text-xs text-slate-500">
              {questions.length === 0
                ? 'Klik tombol "Tambah Soal" untuk mulai mengisi bank soal RQuizz secara manual.'
                : 'Ubah kata kunci pencarian atau filter di atas.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Judul &amp; Skenario</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Jenis Soal</th>
                  <th className="py-3 px-4 text-center">Variasi</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredQuestions.map((q) => {
                  const qTypes = getQuestionTypes(q);
                  const altCount = q.answerAlternatives?.length || (q.correctAnswer ? 1 : 0);
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {typeof q.orderIndex === 'number' && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded shrink-0">
                              #{q.orderIndex}
                            </span>
                          )}
                          <p className="font-semibold text-slate-900 truncate">{q.title}</p>
                          {q.answerMode === 'dynamic' && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded shrink-0">
                              {'{NO_ABSEN}'}
                            </span>
                          )}
                          {altCount > 1 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded shrink-0">
                              {altCount} alternatif
                            </span>
                          )}
                          {q.syntaxCheckMode === 'flexible_order' && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded shrink-0">
                              Urutan Bebas
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{q.prompt}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                        {categoryMap.get(q.categoryId) || q.categoryId}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        <div className="flex flex-wrap gap-1">
                          {qTypes.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium whitespace-nowrap"
                            >
                              {QUESTION_TYPE_LABELS[t]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono tabular-nums text-xs text-slate-700">
                        {1 + q.promptVariations.length}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          disabled={busyId === q.id}
                          onClick={() => void handleToggleActive(q)}
                          className={`text-xs font-semibold disabled:opacity-50 ${
                            q.active ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {q.active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestion(q);
                            setModalOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-blue-600"
                          title="Edit Soal"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={busyId === q.id}
                          onClick={() => void handleDelete(q)}
                          className="p-1.5 text-slate-600 hover:text-red-600 ml-1 disabled:opacity-50"
                          title="Hapus Soal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <QuestionFormModal
          initialQuestion={editingQuestion}
          onClose={() => setModalOpen(false)}
          onSaved={() =>
            setFeedback(editingQuestion ? 'Soal berhasil diperbarui.' : 'Soal baru berhasil dibuat.')
          }
        />
      )}
    </div>
  );
};
