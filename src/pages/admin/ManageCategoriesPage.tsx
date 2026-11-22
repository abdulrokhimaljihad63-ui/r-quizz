import React, { useState } from 'react';
import { Check, Edit2, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  deleteCategory,
  saveCategory,
  seedInitialCategories,
} from '../../services/firestoreService';
import type { Category } from '../../types';

export const ManageCategoriesPage: React.FC = () => {
  const { categories, questions } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [orderIndex, setOrderIndex] = useState(1);
  const [active, setActive] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const openNew = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setOrderIndex(categories.length + 1);
    setActive(true);
    setShowForm(true);
    setFeedback(null);
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description);
    setOrderIndex(cat.orderIndex);
    setActive(cat.active);
    setShowForm(true);
    setFeedback(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      await saveCategory(editingId, { name, description, active, orderIndex });
      setShowForm(false);
      setFeedback(editingId ? 'Kategori diperbarui.' : 'Kategori baru ditambahkan.');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedInitial = async () => {
    setSaving(true);
    try {
      const added = await seedInitialCategories();
      setFeedback(
        added > 0
          ? `${added} kategori awal RQuizz berhasil dimuat.`
          : 'Semua kategori awal RQuizz sudah ada.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    const count = questions.filter((q) => q.categoryId === cat.id).length;
    if (count > 0) {
      setFeedback(
        `Kategori "${cat.name}" masih memiliki ${count} soal. Pindahkan atau nonaktifkan kategori daripada menghapusnya.`,
      );
      return;
    }
    await deleteCategory(cat.id);
    setFeedback(`Kategori "${cat.name}" dihapus.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kelola Kategori Materi</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Tambah, ubah, aktifkan/nonaktifkan kategori RQuizz secara dinamis.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSeedInitial()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Muat 9 Kategori Awal
          </button>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Tambah Kategori
          </button>
        </div>
      </div>

      {feedback && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-900">
          {feedback}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              {editingId ? 'Edit Kategori' : 'Kategori Baru'}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Kategori
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
                placeholder="Contoh: MikroTik"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Urutan</label>
              <input
                type="number"
                min={0}
                max={1000}
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={400}
              placeholder="Ringkasan ruang lingkup materi..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            Aktifkan kategori
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Menyimpan...' : 'Simpan Kategori'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {categories.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Belum ada kategori. Klik &ldquo;Muat 9 Kategori Awal&rdquo; atau &ldquo;Tambah
            Kategori&rdquo;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 w-16">Urutan</th>
                  <th className="py-3 px-4">Nama Kategori</th>
                  <th className="py-3 px-4">Soal</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {categories.map((cat) => {
                  const qCount = questions.filter((q) => q.categoryId === cat.id).length;
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                        {cat.orderIndex}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{cat.name}</p>
                        {cat.description && (
                          <p className="text-xs text-slate-500 line-clamp-1">{cat.description}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{qCount}</td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() =>
                            void saveCategory(cat.id, {
                              name: cat.name,
                              description: cat.description,
                              active: !cat.active,
                              orderIndex: cat.orderIndex,
                            })
                          }
                          className={`text-xs font-semibold ${
                            cat.active ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {cat.active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(cat)}
                          className="p-1.5 text-slate-600 hover:text-blue-600"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(cat)}
                          className="p-1.5 text-slate-600 hover:text-red-600 ml-1"
                          title="Hapus"
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
    </div>
  );
};
