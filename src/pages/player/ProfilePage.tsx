import React, { useEffect, useMemo, useState } from 'react';
import { LogOut, Save, ShieldCheck } from 'lucide-react';
import { COMPETITIVE_EXAM_MODES, MODE_META } from '../../constants/defaults';
import { useAuth } from '../../contexts/AuthContext';
import { getAllPlayerProgressForUser } from '../../services/firestoreService';
import type { PlayerProgress } from '../../types';
import { parseAbsenNumber } from '../../utils/dynamicAnswer';
import { buildOrderedMilestoneSequence } from '../../utils/randomizer';
import { formatDurationReadable } from '../../utils/scoring';

interface ProfilePageProps {
  onOpenAdminLogin: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenAdminLogin }) => {
  const {
    player,
    renamePlayer,
    logoutPlayer,
    questions,
    syntaxPaths,
    syntaxStages,
    settings,
  } = useAuth();
  const [nameInput, setNameInput] = useState(player?.name || '');
  const [absenInput, setAbsenInput] = useState(
    player?.absenNumber ? String(player.absenNumber) : '',
  );
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);

  const [progressList, setProgressList] = useState<PlayerProgress[]>([]);

  useEffect(() => {
    if (player) {
      setNameInput(player.name);
      setAbsenInput(player.absenNumber ? String(player.absenNumber) : '');
      getAllPlayerProgressForUser(player.uid)
        .then(setProgressList)
        .catch(() => setProgressList([]));
    }
  }, [player]);

  const orderedMilestones = useMemo(
    () =>
      buildOrderedMilestoneSequence(
        questions,
        syntaxPaths,
        syntaxStages,
        player?.uid || '',
        settings.prioritizeUnseenVariations,
      ),
    [questions, syntaxPaths, syntaxStages, player?.uid, settings.prioritizeUnseenVariations],
  );

  if (!player) return null;

  const totalOrderedCount = orderedMilestones.instances.length;
  const completedKeysSet = new Set(progressList.flatMap((p) => p.completedStageIds || []));
  const completedMilestoneCount = orderedMilestones.instances.filter(
    (m) => m.milestoneKey && completedKeysSet.has(m.milestoneKey),
  ).length;

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameMsg(null);
    setNameErr(null);

    const parsedAbsen = parseAbsenNumber(absenInput);
    if (parsedAbsen === null) {
      setNameErr('Nomor absen wajib berupa angka yang valid (1–999).');
      return;
    }

    setSavingName(true);
    try {
      await renamePlayer(nameInput, parsedAbsen);
      setNameMsg('Identitas & Nomor Absen berhasil diperbarui tanpa mengubah riwayat skormu.');
    } catch (err) {
      setNameErr(err instanceof Error ? err.message : 'Gagal memperbarui identitas.');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Profil Pemain</h1>

      {/* Rename Form */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Identitas Pemain</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ID Pemain:{' '}
              <span className="font-mono font-semibold text-slate-700">{player.playerId}</span>
              {player.absenNumber ? (
                <>
                  {' '}
                  · Nomor Absen:{' '}
                  <span className="font-mono font-semibold text-blue-700">
                    {player.absenNumber}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <form onSubmit={handleRename} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-6">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nama Lengkap</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              minLength={2}
              maxLength={60}
              required
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nomor Absen</label>
            <input
              type="text"
              inputMode="numeric"
              value={absenInput}
              onChange={(e) => setAbsenInput(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
              placeholder="07 / 15"
              maxLength={3}
              required
              className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={savingName}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              {savingName ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>

        {nameMsg && <p className="text-xs text-emerald-700">{nameMsg}</p>}
        {nameErr && <p className="text-xs text-red-600">{nameErr}</p>}
      </section>

      {/* Stats Summary */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Statistik Poin &amp; Waktu Ujian</h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              Total waktu kumulatif: {formatDurationReadable(Number(player.totalDuration ?? 0))}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-right">
            <p className="text-[11px] font-medium text-blue-700">Total Poin Akumulasi</p>
            <p className="text-xl font-bold text-blue-700 font-mono tabular-nums">
              {Number(player.totalScore ?? 0).toFixed(1)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {COMPETITIVE_EXAM_MODES.map((m) => {
            const modeTotal = Number(player.modeTotalScores?.[m] ?? 0);
            const modeDur = Number(player.modeTotalDurations?.[m] ?? 0);
            const modeBest = Number(player.bestScores?.[m] ?? 0);
            return (
              <div key={m} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <p className="text-xs font-medium text-slate-600">{MODE_META[m].label}</p>
                <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                  {modeTotal > 0 ? modeTotal.toFixed(1) : '—'}
                </p>
                <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                  {modeTotal > 0
                    ? `Waktu: ${formatDurationReadable(modeDur)} · Terbaik: ${modeBest.toFixed(1)}`
                    : 'Belum dimainkan'}
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-600 tabular-nums">
          Progres Hanya Latihan: {completedMilestoneCount} dari {totalOrderedCount} milestone
          selesai (tidak dihitung skor).
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenAdminLogin}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          Portal Admin
        </button>

        <button
          type="button"
          onClick={() => void logoutPlayer()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </div>
  );
};
