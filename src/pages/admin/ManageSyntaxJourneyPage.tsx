import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Compass, Edit2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  deleteSyntaxPath,
  deleteSyntaxStage,
  reorderSyntaxStages,
  saveSyntaxPath,
  saveSyntaxStage,
} from '../../services/firestoreService';
import type { Question, SyntaxChapter, SyntaxPath, SyntaxStage } from '../../types';
import { QuestionFormModal } from './QuestionFormModal';

export const ManageSyntaxJourneyPage: React.FC = () => {
  const { syntaxPaths, syntaxStages, questions, categories } = useAuth();
  const [selectedPathId, setSelectedPathId] = useState<string>('');

  // Path form
  const [showPathForm, setShowPathForm] = useState(false);
  const [editingPath, setEditingPath] = useState<SyntaxPath | null>(null);
  const [pathTitle, setPathTitle] = useState('');
  const [pathDesc, setPathDesc] = useState('');
  const [pathCatId, setPathCatId] = useState('');
  const [pathActive, setPathActive] = useState(true);
  const [chapters, setChapters] = useState<SyntaxChapter[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');

  // Stage form
  const [showStageForm, setShowStageForm] = useState(false);
  const [editingStage, setEditingStage] = useState<SyntaxStage | null>(null);
  const [stageTitle, setStageTitle] = useState('');
  const [stageDesc, setStageDesc] = useState('');
  const [stageChapterId, setStageChapterId] = useState('');
  const [stageActive, setStageActive] = useState(true);

  // Linked question/variation modal
  const [questionModalStageId, setQuestionModalStageId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (syntaxPaths.length > 0 && !syntaxPaths.some((p) => p.id === selectedPathId)) {
      setSelectedPathId(syntaxPaths[0].id);
    }
  }, [syntaxPaths, selectedPathId]);

  const currentPath = useMemo(
    () => syntaxPaths.find((p) => p.id === selectedPathId) || null,
    [syntaxPaths, selectedPathId],
  );

  const stagesForPath = useMemo(() => {
    if (!currentPath) return [];
    return syntaxStages
      .filter((s) => s.pathId === currentPath.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [syntaxStages, currentPath]);

  const openNewPath = () => {
    setEditingPath(null);
    setPathTitle('');
    setPathDesc('');
    setPathCatId(categories[0]?.id || '');
    setPathActive(true);
    setChapters([]);
    setShowPathForm(true);
  };

  const openEditPath = (p: SyntaxPath) => {
    setEditingPath(p);
    setPathTitle(p.title);
    setPathDesc(p.description);
    setPathCatId(p.categoryId);
    setPathActive(p.active);
    setChapters(p.chapters || []);
    setShowPathForm(true);
  };

  const addChapter = () => {
    if (!newChapterTitle.trim()) return;
    setChapters((prev) => [
      ...prev,
      {
        id: `chap_${Date.now().toString(36)}`,
        title: newChapterTitle.trim(),
        orderIndex: prev.length + 1,
      },
    ]);
    setNewChapterTitle('');
  };

  const handleSavePath = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = await saveSyntaxPath(editingPath?.id || null, {
      title: pathTitle,
      description: pathDesc,
      categoryId: pathCatId,
      active: pathActive,
      chapters,
    });
    setSelectedPathId(id);
    setShowPathForm(false);
    setFeedback(editingPath ? 'Jalur milestone diperbarui.' : 'Jalur milestone baru dibuat.');
  };

  const openNewStage = () => {
    setEditingStage(null);
    setStageTitle('');
    setStageDesc('');
    setStageChapterId(currentPath?.chapters[0]?.id || '');
    setStageActive(true);
    setShowStageForm(true);
  };

  const openEditStage = (st: SyntaxStage) => {
    setEditingStage(st);
    setStageTitle(st.title);
    setStageDesc(st.description);
    setStageChapterId(st.chapterId);
    setStageActive(st.active);
    setShowStageForm(true);
  };

  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPath) return;
    await saveSyntaxStage(editingStage?.id || null, {
      pathId: currentPath.id,
      orderIndex: editingStage ? editingStage.orderIndex : stagesForPath.length + 1,
      title: stageTitle,
      description: stageDesc,
      chapterId: stageChapterId,
      active: stageActive,
    });
    setShowStageForm(false);
    setFeedback(editingStage ? 'Milestone diperbarui.' : 'Milestone baru ditambahkan.');
  };

  const moveStage = async (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= stagesForPath.length) return;
    const reordered = [...stagesForPath];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, item);
    await reorderSyntaxStages(reordered);
    setFeedback('Urutan milestone diperbarui.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kelola Milestone &amp; Urutan Soal</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Atur urutan modul, bab/chapter, dan milestone yang digunakan secara identik oleh mode
            Hanya Latihan maupun mode Ujian.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewPath}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Buat Jalur Modul
        </button>
      </div>

      {feedback && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-900">
          {feedback}
        </div>
      )}

      {/* Path Form */}
      {showPathForm && (
        <form
          onSubmit={handleSavePath}
          className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900">
            {editingPath ? 'Edit Jalur Modul' : 'Jalur Modul Baru'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Jalur</label>
              <input
                type="text"
                value={pathTitle}
                onChange={(e) => setPathTitle(e.target.value)}
                required
                placeholder="Contoh: UKK Paket II — Debian, MariaDB & Moodle"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kategori Utama (Opsional)
              </label>
              <select
                value={pathCatId}
                onChange={(e) => setPathCatId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Lintas Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi</label>
            <textarea
              rows={2}
              value={pathDesc}
              onChange={(e) => setPathDesc(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          {/* Chapters Editor */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-700">Bab / Chapter (Opsional)</p>
            <div className="flex flex-wrap gap-2">
              {chapters.map((ch, idx) => (
                <div
                  key={ch.id}
                  className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
                >
                  <span>
                    {idx + 1}. {ch.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => setChapters((prev) => prev.filter((c) => c.id !== ch.id))}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder="Nama chapter baru..."
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={addChapter}
                className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg"
              >
                + Chapter
              </button>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={pathActive}
              onChange={(e) => setPathActive(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            Aktifkan jalur ini untuk pemain
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPathForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Simpan Jalur
            </button>
          </div>
        </form>
      )}

      {/* Path List & Selected Path Milestones */}
      {syntaxPaths.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
          <Compass className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Belum Ada Jalur Modul &amp; Milestone</p>
          <p className="text-xs text-slate-500">
            Buat jalur baru untuk menyusun tahapan milestone berurutan (digunakan di Hanya Latihan
            &amp; Ujian). Soal sintaks tanpa milestone juga tetap tampil berurutan sesuai nomor
            urutannya.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Path Selector Strip */}
          <div className="flex flex-wrap gap-2">
            {syntaxPaths.map((p) => (
              <div
                key={p.id}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold ${
                  p.id === selectedPathId
                    ? 'bg-blue-50 border-blue-600 text-blue-800'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <button type="button" onClick={() => setSelectedPathId(p.id)}>
                  {p.title} {!p.active ? '(Nonaktif)' : ''}
                </button>
                <button
                  type="button"
                  onClick={() => openEditPath(p)}
                  className="text-slate-500 hover:text-blue-600"
                  title="Edit Jalur"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSyntaxPath(p.id)}
                  className="text-slate-500 hover:text-red-600"
                  title="Hapus Jalur"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {currentPath && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Milestone: {currentPath.title}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Disarankan minimal 3 variasi per milestone agar pertanyaan tidak monoton.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openNewStage}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Milestone
                </button>
              </div>

              {showStageForm && (
                <form
                  onSubmit={handleSaveStage}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
                >
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingStage ? 'Edit Milestone' : 'Milestone Baru'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={stageTitle}
                      onChange={(e) => setStageTitle(e.target.value)}
                      required
                      placeholder="Judul milestone (mis. Memperbarui daftar paket APT)"
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <select
                      value={stageChapterId}
                      onChange={(e) => setStageChapterId(e.target.value)}
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">Tanpa Chapter</option>
                      {currentPath.chapters.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    value={stageDesc}
                    onChange={(e) => setStageDesc(e.target.value)}
                    placeholder="Deskripsi singkat kompetensi milestone..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={stageActive}
                        onChange={(e) => setStageActive(e.target.checked)}
                        className="w-4 h-4 accent-blue-600"
                      />
                      Aktif
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowStageForm(false)}
                        className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg"
                      >
                        Simpan Milestone
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {stagesForPath.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  Belum ada milestone di jalur ini.
                </p>
              ) : (
                <div className="space-y-3">
                  {stagesForPath.map((st, idx) => {
                    const linkedQuestions = questions.filter((q) => q.stageId === st.id);
                    const totalVariants = linkedQuestions.reduce(
                      (sum, q) => sum + 1 + q.promptVariations.length,
                      0,
                    );
                    const chapterTitle =
                      currentPath.chapters.find((c) => c.id === st.chapterId)?.title || '';

                    return (
                      <div
                        key={st.id}
                        className="border border-slate-200 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="font-mono font-bold text-blue-600 tabular-nums">
                                #{idx + 1}
                              </span>
                              {chapterTitle && (
                                <>
                                  <span>·</span>
                                  <span>{chapterTitle}</span>
                                </>
                              )}
                              <span>·</span>
                              <span
                                className={`font-semibold ${
                                  totalVariants >= 3 ? 'text-emerald-700' : 'text-amber-600'
                                }`}
                              >
                                {totalVariants} variasi soal
                              </span>
                              {!st.active && <span className="text-red-500">· Nonaktif</span>}
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 mt-0.5">{st.title}</h3>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => void moveStage(idx, -1)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                              title="Naikkan Urutan"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === stagesForPath.length - 1}
                              onClick={() => void moveStage(idx, 1)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                              title="Turunkan Urutan"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQuestion(null);
                                setQuestionModalStageId(st.id);
                              }}
                              className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 ml-1"
                            >
                              + Soal/Variasi
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditStage(st)}
                              className="p-1.5 text-slate-500 hover:text-blue-600"
                              title="Edit Milestone"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteSyntaxStage(st.id)}
                              className="p-1.5 text-slate-500 hover:text-red-600"
                              title="Hapus Milestone"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {linkedQuestions.length > 0 && (
                          <div className="pl-3 border-l-2 border-slate-200 space-y-1.5">
                            {linkedQuestions.map((lq) => (
                              <div
                                key={lq.id}
                                className="flex items-center justify-between gap-2 text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-lg"
                              >
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold">{lq.title}</span>
                                    <span className="text-slate-500">
                                      · {1 + lq.promptVariations.length} variasi
                                    </span>
                                  </div>
                                  {lq.correctAnswer && (
                                    <pre className="text-slate-600 font-mono text-[11px] whitespace-pre-wrap break-words bg-white border border-slate-200 rounded px-2 py-1">
                                      {lq.correctAnswer}
                                    </pre>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingQuestion(lq);
                                    setQuestionModalStageId(st.id);
                                  }}
                                  className="text-blue-600 hover:underline shrink-0"
                                >
                                  Edit
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {questionModalStageId !== null && (
        <QuestionFormModal
          initialQuestion={editingQuestion}
          defaultStageId={questionModalStageId}
          onClose={() => setQuestionModalStageId(null)}
          onSaved={() => setFeedback('Soal & variasi milestone berhasil disimpan.')}
        />
      )}
    </div>
  );
};
