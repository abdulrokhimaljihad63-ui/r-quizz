import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { QUESTION_TYPE_LABELS } from '../../constants/defaults';
import { useAuth } from '../../contexts/AuthContext';
import { saveQuestion } from '../../services/firestoreService';
import type { AnswerMode, Question, QuestionType, SyntaxCheckMode } from '../../types';
import {
  ABSEN_VARIABLE_TOKEN,
  resolveDynamicTemplate,
  validateDynamicTemplate,
} from '../../utils/dynamicAnswer';
import { normalizeLineEndings } from '../../utils/syntaxEngine';

interface QuestionFormModalProps {
  initialQuestion: Question | null;
  defaultStageId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const ALL_QUESTION_TYPES: QuestionType[] = [
  'guided_syntax',
  'blind_syntax',
  'troubleshooting',
];

function getInitialAlternatives(initialQuestion: Question | null): string[] {
  if (!initialQuestion) return [''];
  if (
    Array.isArray(initialQuestion.answerAlternatives) &&
    initialQuestion.answerAlternatives.length > 0
  ) {
    return initialQuestion.answerAlternatives;
  }
  const primary =
    initialQuestion.answerMode === 'dynamic'
      ? initialQuestion.answerTemplate || initialQuestion.correctAnswer || ''
      : initialQuestion.correctAnswer || '';
  return [primary];
}

export const QuestionFormModal: React.FC<QuestionFormModalProps> = ({
  initialQuestion,
  defaultStageId = '',
  onClose,
  onSaved,
}) => {
  const { categories } = useAuth();

  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(() => {
    if (initialQuestion?.types && initialQuestion.types.length > 0) {
      return initialQuestion.types;
    }
    if (initialQuestion?.type) {
      return [initialQuestion.type];
    }
    return ['guided_syntax'];
  });

  const [categoryId, setCategoryId] = useState<string>(
    initialQuestion?.categoryId || categories[0]?.id || '',
  );
  // Preserve existing stageId silently (or defaultStageId when opened from Milestone & Urutan)
  const preservedStageId = initialQuestion?.stageId ?? defaultStageId;
  const [orderIndexInput, setOrderIndexInput] = useState<string>(
    typeof initialQuestion?.orderIndex === 'number' ? String(initialQuestion.orderIndex) : '',
  );

  const [title, setTitle] = useState(initialQuestion?.title || '');
  const [prompt, setPrompt] = useState(initialQuestion?.prompt || '');
  const [promptVariations, setPromptVariations] = useState<string[]>(
    initialQuestion?.promptVariations?.length ? initialQuestion.promptVariations : [],
  );
  const [newVariationText, setNewVariationText] = useState('');

  const [answerAlternatives, setAnswerAlternatives] = useState<string[]>(() =>
    getInitialAlternatives(initialQuestion),
  );
  const [syntaxCheckMode, setSyntaxCheckMode] = useState<SyntaxCheckMode>(
    initialQuestion?.syntaxCheckMode === 'flexible_order' ? 'flexible_order' : 'exact',
  );
  const [answerMode, setAnswerMode] = useState<AnswerMode>(
    initialQuestion?.answerMode === 'dynamic' ? 'dynamic' : 'static',
  );
  const [validateIpFormat, setValidateIpFormat] = useState<boolean>(
    Boolean(initialQuestion?.validateIpFormat),
  );
  const [hint, setHint] = useState(initialQuestion?.hint || '');
  const [options, setOptions] = useState<string[]>(
    initialQuestion?.options?.length === 4 ? initialQuestion.options : ['', '', '', ''],
  );
  const [correctOption, setCorrectOption] = useState<number>(
    initialQuestion && initialQuestion.correctOption >= 0 ? initialQuestion.correctOption : 0,
  );
  const [explanation, setExplanation] = useState(initialQuestion?.explanation || '');
  const [timeLimit, setTimeLimit] = useState<number>(initialQuestion?.timeLimit || 0);
  const [active, setActive] = useState<boolean>(initialQuestion?.active ?? true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSyntax =
    selectedTypes.includes('guided_syntax') || selectedTypes.includes('blind_syntax');
  const hasGuided = selectedTypes.includes('guided_syntax');
  const hasTrouble = selectedTypes.includes('troubleshooting');

  const toggleType = (qType: QuestionType) => {
    setSelectedTypes((prev) =>
      prev.includes(qType) ? prev.filter((t) => t !== qType) : [...prev, qType],
    );
  };

  const addVariation = () => {
    const trimmed = newVariationText.trim();
    if (!trimmed) return;
    if (promptVariations.length >= 30) {
      setError('Maksimal 30 variasi soal per entri.');
      return;
    }
    setPromptVariations((prev) => [...prev, trimmed]);
    setNewVariationText('');
  };

  const removeVariation = (idx: number) => {
    setPromptVariations((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateAlternative = (idx: number, nextVal: string) => {
    const normalized = normalizeLineEndings(nextVal);
    setAnswerAlternatives((prev) => prev.map((item, i) => (i === idx ? normalized : item)));
  };

  const addAlternative = () => {
    if (answerAlternatives.length >= 50) {
      setError('Maksimal 50 alternatif jawaban per soal.');
      return;
    }
    setAnswerAlternatives((prev) => [...prev, '']);
  };

  const removeAlternative = (idx: number) => {
    if (answerAlternatives.length <= 1) return;
    setAnswerAlternatives((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedTypes.length === 0) {
      setError('Pilih minimal satu jenis soal.');
      return;
    }
    if (!categoryId) {
      setError('Pilih kategori terlebih dahulu.');
      return;
    }
    if (!title.trim() || !prompt.trim()) {
      setError('Judul dan skenario/pertanyaan utama wajib diisi.');
      return;
    }

    const cleanedAlternatives = answerAlternatives
      .map((a) => normalizeLineEndings(a))
      .filter((a) => a.trim().length > 0);

    if (hasSyntax) {
      if (cleanedAlternatives.length === 0) {
        setError('Minimal satu jawaban sintaks yang benar wajib diisi.');
        return;
      }
      if (answerAlternatives.some((a) => a.trim().length === 0)) {
        setError('Terdapat kolom alternatif jawaban yang masih kosong. Isi atau hapus kolom tersebut.');
        return;
      }
      if (answerMode === 'dynamic') {
        for (let i = 0; i < cleanedAlternatives.length; i++) {
          const validation = validateDynamicTemplate(cleanedAlternatives[i], validateIpFormat);
          if (!validation.valid) {
            setError(
              `Alternatif #${i + 1}: ${validation.error || 'Template jawaban dinamis tidak valid.'}`,
            );
            return;
          }
        }
      }
    }

    if (hasTrouble) {
      if (options.some((o) => o.trim().length === 0)) {
        setError('Keempat pilihan jawaban Troubleshooting (A, B, C, D) wajib diisi lengkap.');
        return;
      }
      if (correctOption < 0 || correctOption > 3) {
        setError('Pilih tepat satu jawaban yang benar (A/B/C/D).');
        return;
      }
    }

    // Include pending variation text if user typed it and forgot to click '+'
    const finalVariations = [...promptVariations];
    if (newVariationText.trim().length > 0 && finalVariations.length < 30) {
      finalVariations.push(newVariationText.trim());
    }

    const dedupedAlternatives = Array.from(new Set(cleanedAlternatives));
    const primaryAnswer = dedupedAlternatives[0] || '';

    const parsedOrder =
      orderIndexInput.trim().length > 0 && Number.isFinite(Number(orderIndexInput))
        ? Math.max(0, Math.min(10000, Math.floor(Number(orderIndexInput))))
        : undefined;

    setSaving(true);
    try {
      await saveQuestion(initialQuestion?.id || null, {
        types: selectedTypes,
        categoryId,
        stageId: preservedStageId,
        orderIndex: parsedOrder,
        title,
        prompt,
        promptVariations: finalVariations,
        correctAnswer: hasSyntax ? primaryAnswer : '',
        answerAlternatives: hasSyntax ? dedupedAlternatives : [],
        syntaxCheckMode: hasSyntax ? syntaxCheckMode : 'exact',
        answerMode: hasSyntax ? answerMode : 'static',
        answerTemplate: hasSyntax && answerMode === 'dynamic' ? primaryAnswer : '',
        validateIpFormat: hasSyntax && answerMode === 'dynamic' ? validateIpFormat : false,
        hint,
        options,
        correctOption,
        explanation,
        timeLimit,
        active,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan soal.');
    } finally {
      setSaving(false);
    }
  };

  const dynamicValidations =
    hasSyntax && answerMode === 'dynamic'
      ? answerAlternatives.map((alt) => validateDynamicTemplate(alt, validateIpFormat))
      : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-slate-900">
            {initialQuestion ? 'Edit Soal' : 'Buat Soal Baru'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Multi-Select Question Types */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Jenis Soal (Dapat memilih lebih dari satu)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ALL_QUESTION_TYPES.map((qType) => {
                const checked = selectedTypes.includes(qType);
                return (
                  <label
                    key={qType}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                      checked
                        ? 'bg-blue-50 border-blue-600 text-blue-900'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleType(qType)}
                      className="w-4 h-4 accent-blue-600 shrink-0"
                    />
                    <span>{QUESTION_TYPE_LABELS[qType]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Category & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">-- Pilih Kategori --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {!c.active ? '(Nonaktif)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Judul / Kompetensi
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={160}
                placeholder="Contoh: Memperbarui daftar paket APT Debian 12"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Main Prompt */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Skenario / Pertanyaan Utama
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              maxLength={2000}
              placeholder="Tuliskan instruksi atau kasus soal..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          {/* Universal Prompt Variations (Applies to ALL categories & types) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800">
                Variasi Soal General (Berlaku Untuk Semua Kategori)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tambahkan kalimat variasi pertanyaan untuk satu jawaban yang sama. Sistem akan
                mengacak variasi ini pada setiap sesi pengguna.
              </p>
            </div>

            {promptVariations.length > 0 && (
              <div className="space-y-2">
                {promptVariations.map((v, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-2 bg-white border border-slate-200 rounded-lg p-2.5 text-xs"
                  >
                    <span className="font-mono text-slate-400 shrink-0">V{idx + 1}.</span>
                    <span className="flex-1 text-slate-700 whitespace-pre-wrap">{v}</span>
                    <button
                      type="button"
                      onClick={() => removeVariation(idx)}
                      className="text-red-500 hover:text-red-700 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newVariationText}
                onChange={(e) => setNewVariationText(e.target.value)}
                maxLength={2000}
                placeholder="Tambahkan variasi kalimat soal untuk jawaban yang sama..."
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={addVariation}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Variasi
              </button>
            </div>
          </div>

          {/* Multiline Syntax Answer Editor (Alternatives + Exact/Flexible Order + Static/Dynamic) */}
          {hasSyntax && (
            <div className="space-y-4">
              {/* Answer Mode Selector (Static vs Dynamic) */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Jenis Jawaban Sintaks
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      answerMode === 'static'
                        ? 'bg-blue-50 border-blue-600 text-blue-950'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="answerMode"
                      checked={answerMode === 'static'}
                      onChange={() => setAnswerMode('static')}
                      className="w-4 h-4 accent-blue-600 mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="font-semibold">Jawaban Statis</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Jawaban sama persis untuk seluruh siswa.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      answerMode === 'dynamic'
                        ? 'bg-blue-50 border-blue-600 text-blue-950'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="answerMode"
                      checked={answerMode === 'dynamic'}
                      onChange={() => setAnswerMode('dynamic')}
                      className="w-4 h-4 accent-blue-600 mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="font-semibold">Jawaban Dinamis ({ABSEN_VARIABLE_TOKEN})</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Menyesuaikan nomor absen masing-masing siswa secara otomatis.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Syntax Order Method Selector (Exact vs Flexible Order) */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Metode Pemeriksaan Urutan Jawaban
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      syntaxCheckMode === 'exact'
                        ? 'bg-blue-50 border-blue-600 text-blue-950'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="syntaxCheckMode"
                      checked={syntaxCheckMode === 'exact'}
                      onChange={() => setSyntaxCheckMode('exact')}
                      className="w-4 h-4 accent-blue-600 mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="font-semibold">Urutan Tepat (Default)</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Karakter, spasi, dan urutan kata harus persis sesuai salah satu alternatif.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      syntaxCheckMode === 'flexible_order'
                        ? 'bg-blue-50 border-blue-600 text-blue-950'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="syntaxCheckMode"
                      checked={syntaxCheckMode === 'flexible_order'}
                      onChange={() => setSyntaxCheckMode('flexible_order')}
                      className="w-4 h-4 accent-blue-600 mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="font-semibold">Urutan Kata Bebas</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Seluruh kata/token (dipisah spasi) wajib diketik benar, tetapi urutan boleh diacak.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Alternatives List (Static or Dynamic Templates) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">
                      {answerMode === 'dynamic'
                        ? `Alternatif Template Jawaban Dinamis (${ABSEN_VARIABLE_TOKEN})`
                        : 'Alternatif Jawaban Sintaks Benar'}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Siswa cukup mengetik salah satu alternatif di bawah ini dengan benar.
                      Mendukung banyak baris dan spasi persis.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addAlternative}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Alternatif Jawaban
                  </button>
                </div>

                {answerMode === 'dynamic' && (
                  <div className="text-[11px] text-slate-600 space-y-1.5 bg-white border border-slate-200 rounded-lg p-3">
                    <p className="font-semibold text-slate-700">Petunjuk Variabel Dinamis:</p>
                    <p>
                      Letakkan <code className="font-mono font-semibold">{ABSEN_VARIABLE_TOKEN}</code>{' '}
                      pada posisi oktet atau nilai yang mengikuti nomor absen. Contoh untuk absen{' '}
                      <span className="font-mono font-semibold">07</span>:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 font-mono text-[11px] text-slate-700">
                      <li>192.168.{ABSEN_VARIABLE_TOKEN}.1 → 192.168.7.1</li>
                      <li>192.168.1.{ABSEN_VARIABLE_TOKEN} → 192.168.1.7</li>
                      <li>10.{ABSEN_VARIABLE_TOKEN}.10.1 → 10.7.10.1</li>
                    </ul>
                    <label className="inline-flex items-center gap-2 pt-1 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={validateIpFormat}
                        onChange={(e) => setValidateIpFormat(e.target.checked)}
                        className="w-4 h-4 accent-blue-600"
                      />
                      Aktifkan validasi format IP Address (IPv4 / CIDR) pada hasil template
                    </label>
                  </div>
                )}

                <div className="space-y-3">
                  {answerAlternatives.map((alt, idx) => {
                    const lineCount = normalizeLineEndings(alt).split('\n').length;
                    const dynVal = dynamicValidations[idx];
                    return (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700">
                            {idx === 0 ? 'Jawaban Utama (#1)' : `Alternatif Jawaban #${idx + 1}`}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                              {lineCount} baris · {alt.length} karakter
                            </span>
                            {answerAlternatives.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeAlternative(idx)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800"
                                title="Hapus alternatif ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Hapus
                              </button>
                            )}
                          </div>
                        </div>

                        <textarea
                          rows={answerAlternatives.length === 1 ? 4 : 3}
                          value={alt}
                          onChange={(e) => updateAlternative(idx, e.target.value)}
                          required={hasSyntax}
                          maxLength={2000}
                          spellCheck={false}
                          autoCapitalize="none"
                          autoCorrect="off"
                          placeholder={
                            answerMode === 'dynamic'
                              ? `Contoh template #${idx + 1}: 192.168.${ABSEN_VARIABLE_TOKEN}.1`
                              : syntaxCheckMode === 'flexible_order'
                                ? `Contoh alternatif #${idx + 1}: apt install apache2 mariadb-server php`
                                : `Contoh alternatif #${idx + 1}: ip addr`
                          }
                          className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg bg-slate-950 text-white placeholder:text-slate-500 whitespace-pre overflow-x-auto focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                        />

                        {answerMode === 'dynamic' && dynVal && !dynVal.valid && alt.length > 0 && (
                          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                            {dynVal.error}
                          </div>
                        )}

                        {answerMode === 'dynamic' && dynVal?.valid && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs space-y-1">
                            <p className="font-semibold text-emerald-800 text-[11px]">
                              Pratinjau Substitusi (#{idx + 1}):
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px] text-emerald-900">
                              <div className="bg-white border border-emerald-200 rounded p-1.5">
                                <span className="text-slate-500 block">Absen 07:</span>
                                <pre className="whitespace-pre-wrap break-words">
                                  {resolveDynamicTemplate(alt, 7)}
                                </pre>
                              </div>
                              <div className="bg-white border border-emerald-200 rounded p-1.5">
                                <span className="text-slate-500 block">Absen 15:</span>
                                <pre className="whitespace-pre-wrap break-words">
                                  {resolveDynamicTemplate(alt, 15)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {hasGuided && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Petunjuk Opsional (Tampil pada Hanya Latihan, tidak tampil di Mode Ujian)
                  </label>
                  <input
                    type="text"
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    maxLength={500}
                    placeholder="Contoh: Gunakan perintah apt diikuti kata kunci pembaruan indeks..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              )}
            </div>
          )}

          {/* Troubleshooting Options (when Troubleshooting selected) */}
          {hasTrouble && (
            <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <label className="block text-xs font-semibold text-slate-700">
                Pilihan Jawaban Troubleshooting (Pilih tepat 1 jawaban benar)
              </label>
              {options.map((opt, idx) => {
                const letter = ['A', 'B', 'C', 'D'][idx];
                return (
                  <div key={idx} className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctOption === idx}
                      onChange={() => setCorrectOption(idx)}
                      className="w-4 h-4 accent-blue-600 shrink-0"
                      title={`Tandai ${letter} benar`}
                    />
                    <span className="font-mono text-xs font-bold text-slate-600 w-5">{letter}.</span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const next = [...options];
                        next[idx] = e.target.value;
                        setOptions(next);
                      }}
                      required={hasTrouble}
                      maxLength={500}
                      placeholder={`Isi pilihan ${letter}...`}
                      className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Explanation */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Penjelasan Jawaban
            </label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              maxLength={2000}
              placeholder="Penjelasan konsep atau alasan solusi..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          {/* Optional Order Index, Time Limit & Active Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Urutan Soal (Opsional)
              </label>
              <input
                type="number"
                min={0}
                max={10000}
                value={orderIndexInput}
                onChange={(e) => setOrderIndexInput(e.target.value)}
                placeholder="Otomatis / mis. 1, 2, 3"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Batas Waktu Opsional (detik, 0 = bebas)
              </label>
              <input
                type="number"
                min={0}
                max={3600}
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              Aktifkan soal ini di bank soal
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : initialQuestion ? 'Simpan Perubahan' : 'Buat Soal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
