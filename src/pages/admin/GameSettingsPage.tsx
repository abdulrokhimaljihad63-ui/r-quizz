import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { ACTIVE_MODES, MODE_META } from '../../constants/defaults';
import { useAuth } from '../../contexts/AuthContext';
import { saveSettings } from '../../services/firestoreService';
import type { AppSettings } from '../../types';

export const GameSettingsPage: React.FC = () => {
  const { settings } = useAuth();
  const [form, setForm] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const compositionSum =
    form.examGuidedCount + form.examBlindCount + form.examTroubleshootingCount;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);

    if (compositionSum !== form.examTotalQuestions) {
      setError(
        `Total komposisi Ujian Latihan Soal Acak (${compositionSum}) harus sama persis dengan Target Total Soal (${form.examTotalQuestions}).`,
      );
      return;
    }

    if (form.troubleshootQuestionCount < 1 || form.troubleshootQuestionCount > 100) {
      setError('Jumlah soal Mode Troubleshoot harus antara 1 sampai 100.');
      return;
    }

    setSaving(true);
    try {
      await saveSettings(form);
      setSavedMsg('Pengaturan permainan berhasil disimpan ke Firestore.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan Permainan</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Atur komposisi Ujian Latihan Soal Acak, jumlah soal Troubleshoot, batas waktu ujian, dan
          status aktif keempat mode permainan.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
            {error}
          </div>
        )}
        {savedMsg && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800">
            {savedMsg}
          </div>
        )}

        {/* Ujian Acak & Troubleshoot Composition */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Komposisi Ujian Latihan Soal Acak &amp; Troubleshoot
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total Soal Ujian Acak
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.examTotalQuestions}
                onChange={(e) =>
                  setForm({ ...form, examTotalQuestions: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sintaks Berpetunjuk
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.examGuidedCount}
                onChange={(e) =>
                  setForm({ ...form, examGuidedCount: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sintaks Tanpa Petunjuk
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.examBlindCount}
                onChange={(e) =>
                  setForm({ ...form, examBlindCount: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Troubleshooting
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.examTroubleshootingCount}
                onChange={(e) =>
                  setForm({ ...form, examTroubleshootingCount: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 tabular-nums">
            Total komposisi Ujian Acak saat ini: {compositionSum} / {form.examTotalQuestions} soal
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jumlah Soal Mode Troubleshoot (Default: 10)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.troubleshootQuestionCount}
                onChange={(e) =>
                  setForm({ ...form, troubleshootQuestionCount: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Batas Waktu Mode Ujian &amp; Ujian Acak (detik)
              </label>
              <input
                type="number"
                min={60}
                max={14400}
                value={form.examTimeLimitSeconds}
                onChange={(e) =>
                  setForm({ ...form, examTimeLimitSeconds: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </section>

        {/* Dynamic Proportional Scoring Policy Info */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2">
          <h2 className="text-base font-bold text-slate-900">
            Sistem Penilaian Proporsional &amp; Akumulasi Leaderboard
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Seluruh mode ujian (<span className="font-semibold">Ujian</span>,{' '}
            <span className="font-semibold">Ujian Latihan Soal Acak</span>, dan{' '}
            <span className="font-semibold">Troubleshoot</span>) menggunakan nilai maksimal{' '}
            <span className="font-semibold text-slate-900">100 poin per sesi</span> dengan bobot
            otomatis <code className="font-mono">100 / jumlah soal aktif</code>. Poin dan total
            waktu pengerjaan setiap sesi terakumulasi ke papan peringkat. Mode{' '}
            <span className="font-semibold">Hanya Latihan</span> bebas nilai dan tidak tercatat di
            leaderboard.
          </p>
        </section>

        {/* Randomization & Enabled Modes */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Randomisasi &amp; Status Mode</h2>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-slate-800">
                Prioritaskan Variasi Soal yang Belum Dimainkan
              </p>
              <p className="text-xs text-slate-500">
                Berlaku di semua kategori saat mengacak variasi kalimat pertanyaan pada sesi pemain.
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.prioritizeUnseenVariations}
              onChange={(e) =>
                setForm({ ...form, prioritizeUnseenVariations: e.target.checked })
              }
              className="w-4 h-4 accent-blue-600"
            />
          </label>

          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <p className="text-xs font-semibold text-slate-700">Aktifkan Mode Permainan</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ACTIVE_MODES.map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.enabledModes[m] !== false}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        enabledModes: {
                          ...form.enabledModes,
                          [m]: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 accent-blue-600"
                  />
                  {MODE_META[m].label}
                </label>
              ))}
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>
    </div>
  );
};
