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
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Leaderboard Kelas</h1>

      {/* 4 Mode Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rquizz-panel rounded-xl">
        {LEADERBOARD_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActiveMode(m.id)}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors text-center flex items-center justify-center ${
              activeMode === m.id
                ? 'bg-cyan-400 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="rquizz-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-300">Memuat peringkat...</div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Trophy className="w-8 h-8 text-amber-300/70 mx-auto" />
            <p className="text-sm font-bold text-white">Belum Ada Skor di Tab Ini</p>
            <p className="text-xs text-slate-300">
              Jadilah yang pertama menyelesaikan sesi ujian untuk mencatat poin akumulasi di papan
              peringkat.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-black/50 text-xs font-semibold text-slate-300">
                  <th className="py-3.5 px-4 w-28">Peringkat</th>
                  <th className="py-3.5 px-4">Nama Pemain</th>
                  <th className="py-3.5 px-4 text-right">Total Poin</th>
                  <th className="py-3.5 px-4 text-right">Sesi Selesai</th>
                  <th className="py-3.5 px-4 text-right">Total Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-sm">
                {entries.map((entry) => {
                  const isMe = player?.uid === entry.playerUid;
                  return (
                    <tr
                      key={entry.id}
                      className={isMe ? 'bg-cyan-500/15' : 'hover:bg-white/5'}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold tabular-nums text-white whitespace-nowrap">
                        #{entry.rank}
                        {entry.isTied && (
                          <span className="ml-1.5 text-[10px] font-sans font-semibold text-amber-200 bg-amber-500/20 border border-amber-400/35 px-1.5 py-0.5 rounded">
                            Seri
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {entry.playerName}
                        {isMe && (
                          <span className="ml-2 text-xs font-bold text-cyan-300">(Kamu)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-cyan-300 tabular-nums">
                        {entry.totalScore.toFixed(1)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-200 tabular-nums">
                        {entry.sessionsCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300 tabular-nums whitespace-nowrap">
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
