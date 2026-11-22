import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, LogOut, Save, ShieldCheck } from 'lucide-react';
import { COMPETITIVE_EXAM_MODES, MODE_META } from '../../constants/defaults';
import { useAuth } from '../../contexts/AuthContext';
import { getAllPlayerProgressForUser } from '../../services/firestoreService';
import type { PlayerProgress } from '../../types';
import { parseAbsenNumber } from '../../utils/dynamicAnswer';
import { buildOrderedMilestoneSequence } from '../../utils/randomizer';
import { getOrCreateLocalRecoveryCode } from '../../utils/recovery';
import { formatDurationReadable } from '../../utils/scoring';

interface ProfilePageProps {
  onOpenAdminLogin: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenAdminLogin }) => {
  const {
    player,
    renamePlayer,
    savePreferences,
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

  const [showRecovery, setShowRecovery] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const recoveryCode = getOrCreateLocalRecoveryCode(player.uid);
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

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profil &amp; Pengaturan Pemain</h1>
        <p className="text-sm text-slate-600 mt-1">
          Kelola nama tampilan, pantau akumulasi poin ujian, dan atur preferensi suara maupun
          terminal.
        </p>
      </div>

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

      {/* Recovery Code Section */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">Kode Pemulihan Perangkat</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Kode ini dibuat secara acak di perangkatmu dan tidak pernah ditampilkan di
              leaderboard maupun disimpan sebagai teks mentah di database publik.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <code className="font-mono text-sm font-semibold text-slate-900 tracking-wider flex-1">
            {showRecovery ? recoveryCode : 'UKK-••••-••••-••••'}
          </code>
          <button
            type="button"
            onClick={() => setShowRecovery((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
          >
            {showRecovery ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showRecovery ? 'Sembunyikan' : 'Tampilkan'}
          </button>
          <button
            type="button"
            onClick={() => void handleCopyCode()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Tersalin' : 'Salin Kode'}
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Catatan arsitektur MVP: Karena login pemain menggunakan Firebase Anonymous Authentication
          (tanpa backend custom-token berbayar), identitas UID Firebase terikat pada penyimpanan
          browser perangkat ini. Simpan kode di atas sebagai catatan identitasmu apabila diperlukan
          verifikasi manual oleh Admin/Guru.
        </p>
      </section>

      {/* Preferences & Session */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Preferensi &amp; Akses</h2>

        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-slate-800">
              Aktifkan Suara Efek Evaluasi Ujian
            </p>
            <p className="text-xs text-slate-500">
              Memutar fanfare saat jawaban benar dan bunyi &ldquo;tet toot&rdquo; saat jawaban salah
              di mode Ujian.
            </p>
          </div>
          <input
            type="checkbox"
            checked={player.preferences?.soundEnabled !== false}
            onChange={(e) =>
              void savePreferences({
                soundEnabled: e.target.checked,
                showKeyboardHints: player.preferences?.showKeyboardHints !== false,
              })
            }
            className="w-4 h-4 accent-blue-600"
          />
        </label>

        <label className="flex items-center justify-between gap-4 cursor-pointer pt-2 border-t border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-800">
              Tampilkan Petunjuk Keyboard Terminal
            </p>
            <p className="text-xs text-slate-500">
              Menampilkan keterangan tombol Backspace &amp; enter di bawah terminal.
            </p>
          </div>
          <input
            type="checkbox"
            checked={player.preferences?.showKeyboardHints !== false}
            onChange={(e) =>
              void savePreferences({
                soundEnabled: player.preferences?.soundEnabled !== false,
                showKeyboardHints: e.target.checked,
              })
            }
            className="w-4 h-4 accent-blue-600"
          />
        </label>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onOpenAdminLogin}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            Portal Admin
          </button>

          <button
            type="button"
            onClick={() => void logoutPlayer()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Keluar dari Sesi Perangkat Ini
          </button>
        </div>
      </section>
    </div>
  );
};
