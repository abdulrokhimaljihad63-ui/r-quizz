import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { LEADERBOARD_MODES } from '../../constants/defaults';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeLeaderboard } from '../../services/firestoreService';
import type { ActiveLeaderboardMode, RankedLeaderboardEntry } from '../../types';
import { formatDurationReadable } from '../../utils/scoring';

export const LeaderboardPage: React.FC = () => {
  const { player } = useAuth();
  const [activeMode, setActiveMode] = useState<ActiveLeaderboardMode>('overall');
  const [entries, setEntries] = useState<RankedLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeLeaderboard(
      activeMode,
      (items) => {
        setEntries(items);
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );
    return () => unsub();
  }, [activeMode]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Leaderboard Kelas</h1>
        <p className="text-sm text-slate-600">
          Urutan peringkat: (1) Total Poin Akumulasi tertinggi, (2) Total Waktu Kumulatif tercepat.
          Jika poin dan waktu sama persis, peringkat dianggap seri. Mode Hanya Latihan tidak masuk
          ke papan peringkat.
        </p>
      </div>

      {/* 4 Mode Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-200/70 rounded-xl w-fit max-w-full overflow-x-auto">
        {LEADERBOARD_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActiveMode(m.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeMode === m.id
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat peringkat...</div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Trophy className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Belum Ada Skor di Tab Ini</p>
            <p className="text-xs text-slate-500">
              Jadilah yang pertama menyelesaikan sesi ujian untuk mencatat poin akumulasi di papan
              peringkat.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-4 w-28">Peringkat</th>
                  <th className="py-3.5 px-4">Nama Pemain</th>
                  <th className="py-3.5 px-4 text-right">Total Poin</th>
                  <th className="py-3.5 px-4 text-right">Sesi Selesai</th>
                  <th className="py-3.5 px-4 text-right">Total Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {entries.map((entry) => {
                  const isMe = player?.uid === entry.playerUid;
                  return (
                    <tr
                      key={entry.id}
                      className={isMe ? 'bg-blue-50/70' : 'hover:bg-slate-50/70'}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold tabular-nums text-slate-800 whitespace-nowrap">
                        #{entry.rank}
                        {entry.isTied && (
                          <span className="ml-1.5 text-[10px] font-sans font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            Seri
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {entry.playerName}
                        {isMe && (
                          <span className="ml-2 text-xs font-semibold text-blue-600">(Kamu)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-700 tabular-nums">
                        {entry.totalScore.toFixed(1)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                        {entry.sessionsCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDurationReadable(entry.duration)}
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
