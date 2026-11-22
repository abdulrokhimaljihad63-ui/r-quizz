import React, { useEffect, useState } from 'react';
import { Search, Trash2, Users, AlertTriangle } from 'lucide-react';
import { deletePlayerAndAssociatedData, getAllPlayers } from '../../services/firestoreService';
import type { Player } from '../../types';
import { formatDurationReadable } from '../../utils/scoring';

export const ManagePlayersPage: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadPlayers = () => {
    setLoading(true);
    getAllPlayers()
      .then((items) => {
        setPlayers(items);
        setSelectedUids(new Set());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  const filtered = players.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.playerId.toLowerCase().includes(q);
  });

  const toggleSelectAll = () => {
    if (selectedUids.size === filtered.length) {
      setSelectedUids(new Set());
    } else {
      setSelectedUids(new Set(filtered.map((p) => p.uid)));
    }
  };

  const toggleSelect = (uid: string) => {
    const next = new Set(selectedUids);
    if (next.has(uid)) {
      next.delete(uid);
    } else {
      next.add(uid);
    }
    setSelectedUids(next);
  };

  const handleDeleteSelected = async () => {
    if (selectedUids.size === 0) return;
    setDeleting(true);
    setSuccessMsg(null);
    try {
      const res = await deletePlayerAndAssociatedData(Array.from(selectedUids));
      setSuccessMsg(
        `Berhasil menghapus ${res.deletedPlayers} profil, ${res.deletedSessions} sesi ujian, ${res.deletedProgress} progres latihan, dan ${res.deletedLeaderboard} entri leaderboard.`,
      );
      setShowConfirmModal(false);
      loadPlayers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus profil.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Pemain</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Daftar siswa beserta akumulasi poin, total waktu kumulatif, dan poin per mode ujian.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {selectedUids.size > 0 && (
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Hapus Terpilih ({selectedUids.size})
            </button>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau ID..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900">
          {successMsg}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat data pemain...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Belum Ada Pemain Terdaftar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedUids.size === filtered.length}
                      onChange={toggleSelectAll}
                      className="accent-blue-600 rounded"
                    />
                  </th>
                  <th className="py-3 px-4">Nama Pemain</th>
                  <th className="py-3 px-4">Absen</th>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4 text-right">Sesi</th>
                  <th className="py-3 px-4 text-right">Total Waktu</th>
                  <th className="py-3 px-4 text-right">Total Poin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filtered.map((p) => {
                  const isChecked = selectedUids.has(p.uid);
                  return (
                    <tr
                      key={p.uid}
                      className={isChecked ? 'bg-red-50/40' : 'hover:bg-slate-50/70'}
                    >
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(p.uid)}
                          className="accent-blue-600 rounded"
                        />
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{p.name}</td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-700 tabular-nums">
                        {p.absenNumber ?? '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">{p.playerId}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {p.totalSessions}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDurationReadable(Number(p.totalDuration ?? 0))}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-blue-700">
                        {Number(p.totalScore ?? 0).toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Konfirmasi Penghapusan Profil</h2>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  Anda akan menghapus{' '}
                  <span className="font-semibold text-slate-900">{selectedUids.size} profil pemain</span>{' '}
                  terpilih beserta seluruh riwayat ujian, progres latihan, dan entri leaderboard terkait.
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1 text-xs">
              {players
                .filter((p) => selectedUids.has(p.uid))
                .map((p) => (
                  <div key={p.uid} className="flex justify-between text-slate-700 font-mono">
                    <span>
                      {p.name} (Absen {p.absenNumber ?? '—'})
                    </span>
                    <span className="text-slate-500">{p.playerId}</span>
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDeleteSelected()}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
