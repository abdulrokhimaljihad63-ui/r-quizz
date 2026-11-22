import React, { useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { getAllPlayers } from '../../services/firestoreService';
import type { Player } from '../../types';
import { formatDurationReadable } from '../../utils/scoring';

export const ManagePlayersPage: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAllPlayers()
      .then(setPlayers)
      .finally(() => setLoading(false));
  }, []);

  const filtered = players.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.playerId.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Pemain</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Daftar siswa beserta akumulasi poin, total waktu kumulatif, dan poin per mode ujian.
          </p>
        </div>

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
                  <th className="py-3 px-4">Nama Pemain</th>
                  <th className="py-3 px-4">Absen</th>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4 text-right">Sesi</th>
                  <th className="py-3 px-4 text-right">Total Waktu</th>
                  <th className="py-3 px-4 text-right">Total Poin</th>
                  <th className="py-3 px-4 text-right">Ujian</th>
                  <th className="py-3 px-4 text-right">Ujian Acak</th>
                  <th className="py-3 px-4 text-right">Troubleshoot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filtered.map((p) => {
                  const ujianVal = p.modeTotalScores?.ujian;
                  const ujianAcakVal = p.modeTotalScores?.ujian_acak;
                  const troubleVal = p.modeTotalScores?.troubleshoot;
                  return (
                    <tr key={p.uid} className="hover:bg-slate-50/70">
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
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {ujianVal ? Number(ujianVal).toFixed(1) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {ujianAcakVal ? Number(ujianAcakVal).toFixed(1) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {troubleVal ? Number(troubleVal).toFixed(1) : '—'}
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
