import { useCallback, useEffect, useRef, useState } from 'react';
import { LEADERBOARD_MODES } from '../constants/defaults';
import { subscribeLeaderboard } from '../services/firestoreService';
import type { ActiveLeaderboardMode, RankedLeaderboardEntry } from '../types';

export interface RankChangeNotification {
  id: string;
  mode: ActiveLeaderboardMode;
  modeLabel: string;
  direction: 'up' | 'down';
  message: string;
}

interface StoredSnapshotEntry {
  uid: string;
  name: string;
  rank: number;
}

interface StoredModeSnapshot {
  myRank: number | null;
  entries: StoredSnapshotEntry[];
}

function getStorageKey(playerUid: string, mode: ActiveLeaderboardMode): string {
  return `rquizz_lb_snapshot_${playerUid}_${mode}`;
}

function readStoredSnapshot(
  playerUid: string,
  mode: ActiveLeaderboardMode,
): StoredModeSnapshot | null {
  try {
    const raw = window.localStorage.getItem(getStorageKey(playerUid, mode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredModeSnapshot;
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSnapshot(
  playerUid: string,
  mode: ActiveLeaderboardMode,
  snapshot: StoredModeSnapshot,
): void {
  try {
    window.localStorage.setItem(getStorageKey(playerUid, mode), JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota/access errors
  }
}

function toSnapshot(
  entries: RankedLeaderboardEntry[],
  playerUid: string,
): StoredModeSnapshot {
  const me = entries.find((e) => e.playerUid === playerUid);
  return {
    myRank: me ? me.rank : null,
    entries: entries.map((e) => ({
      uid: e.playerUid,
      name: e.playerName,
      rank: e.rank,
    })),
  };
}

function computeRankChangeNotification(
  mode: ActiveLeaderboardMode,
  modeLabel: string,
  prev: StoredModeSnapshot,
  next: StoredModeSnapshot,
  myUid: string,
): RankChangeNotification | null {
  if (next.myRank === null) return null;

  const prevRankMap = new Map<string, number>();
  for (const item of prev.entries) {
    prevRankMap.set(item.uid, item.rank);
  }

  // Case 1: User climbed ranks or newly entered leaderboard above existing players
  if (prev.myRank === null || next.myRank < prev.myRank) {
    const overtaken = next.entries.filter((e) => {
      if (e.uid === myUid) return false;
      const oldRank = prevRankMap.get(e.uid);
      if (oldRank === undefined) return false;
      const wasAheadOrEqual = prev.myRank === null ? true : oldRank <= prev.myRank;
      return wasAheadOrEqual && e.rank > next.myRank!;
    });

    if (prev.myRank === null && overtaken.length === 0) {
      return {
        id: `${mode}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mode,
        modeLabel,
        direction: 'up',
        message: `Kategori ${modeLabel}: Anda masuk peringkat #${next.myRank}!`,
      };
    }

    if (overtaken.length === 1) {
      return {
        id: `${mode}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mode,
        modeLabel,
        direction: 'up',
        message: `Kategori ${modeLabel}: Anda menyalip ${overtaken[0].name} ke peringkat #${next.myRank}!`,
      };
    }

    if (overtaken.length > 1) {
      return {
        id: `${mode}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mode,
        modeLabel,
        direction: 'up',
        message: `Kategori ${modeLabel}: Anda menyalip ${overtaken[0].name} dan ${overtaken.length - 1} pengguna lainnya ke peringkat #${next.myRank}!`,
      };
    }

    return {
      id: `${mode}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      mode,
      modeLabel,
      direction: 'up',
      message: `Kategori ${modeLabel}: Anda naik ke peringkat #${next.myRank}!`,
    };
  }

  // Case 2: User dropped in rank (overtaken by one or more players)
  if (prev.myRank !== null && next.myRank > prev.myRank) {
    const overtakenBy = next.entries.filter((e) => {
      if (e.uid === myUid) return false;
      if (e.rank >= next.myRank!) return false;
      const oldRank = prevRankMap.get(e.uid);
      return oldRank === undefined || oldRank >= prev.myRank!;
    });

    if (overtakenBy.length === 1) {
      return {
        id: `${mode}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mode,
        modeLabel,
        direction: 'down',
        message: `Kategori ${modeLabel}: Anda disalip oleh ${overtakenBy[0].name} (peringkat Anda #${next.myRank}).`,
      };
    }

    if (overtakenBy.length > 1) {
      return {
        id: `${mode}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mode,
        modeLabel,
        direction: 'down',
        message: `Kategori ${modeLabel}: Anda disalip oleh ${overtakenBy[0].name} dan ${overtakenBy.length - 1} pengguna lainnya (peringkat Anda #${next.myRank}).`,
      };
    }

    return {
      id: `${mode}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      mode,
      modeLabel,
      direction: 'down',
      message: `Kategori ${modeLabel}: Peringkat Anda bergeser ke #${next.myRank}.`,
    };
  }

  return null;
}

export function useLeaderboardMonitor(playerUid: string | undefined) {
  const [overallTopLeaderName, setOverallTopLeaderName] = useState<string | null>(null);
  const [overallLoaded, setOverallLoaded] = useState(false);
  const [queue, setQueue] = useState<RankChangeNotification[]>([]);

  const inMemorySnapshotsRef = useRef<Partial<Record<ActiveLeaderboardMode, StoredModeSnapshot>>>(
    {},
  );
  const commitTimersRef = useRef<Partial<Record<ActiveLeaderboardMode, number>>>({});

  const dismissCurrentNotification = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  // Auto-advance notification queue every 6 seconds
  useEffect(() => {
    if (queue.length === 0) return;
    const timer = window.setTimeout(() => {
      setQueue((prev) => prev.slice(1));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [queue]);

  // Subscribe to all leaderboard categories in real-time
  useEffect(() => {
    if (!playerUid) return;

    inMemorySnapshotsRef.current = {};
    setQueue([]);
    setOverallLoaded(false);
    setOverallTopLeaderName(null);

    const unsubscribers = LEADERBOARD_MODES.map(({ id: mode, label: modeLabel }) => {
      return subscribeLeaderboard(
        mode,
        (entries) => {
          if (mode === 'overall') {
            const topEntries = entries.filter((e) => e.rank === 1);
            if (topEntries.length > 0) {
              setOverallTopLeaderName(topEntries.map((e) => e.playerName).join(', '));
            } else {
              setOverallTopLeaderName(null);
            }
            setOverallLoaded(true);
          }

          const nextSnapshot = toSnapshot(entries, playerUid);
          const inMemoryPrev = inMemorySnapshotsRef.current[mode];

          if (inMemoryPrev) {
            // Live in-app update
            const notif = computeRankChangeNotification(
              mode,
              modeLabel,
              inMemoryPrev,
              nextSnapshot,
              playerUid,
            );
            inMemorySnapshotsRef.current[mode] = nextSnapshot;
            writeStoredSnapshot(playerUid, mode, nextSnapshot);
            if (notif) {
              setQueue((prevQ) => [...prevQ, notif]);
            }
            return;
          }

          // First snapshot after mounting (check persisted offline snapshot)
          const storedPrev = readStoredSnapshot(playerUid, mode);
          inMemorySnapshotsRef.current[mode] = nextSnapshot;

          if (storedPrev) {
            const notif = computeRankChangeNotification(
              mode,
              modeLabel,
              storedPrev,
              nextSnapshot,
              playerUid,
            );
            if (notif) {
              setQueue((prevQ) => {
                // Deduplicate identical message in case of rapid double-mount
                if (prevQ.some((item) => item.message === notif.message)) return prevQ;
                return [...prevQ, notif];
              });
            }
          }

          // Delay localStorage write slightly so React StrictMode double-mounts keep storedPrev intact
          const existingTimer = commitTimersRef.current[mode];
          if (existingTimer !== undefined) {
            window.clearTimeout(existingTimer);
          }
          commitTimersRef.current[mode] = window.setTimeout(() => {
            delete commitTimersRef.current[mode];
            writeStoredSnapshot(playerUid, mode, nextSnapshot);
          }, 350);
        },
        () => {
          if (mode === 'overall') {
            setOverallLoaded(true);
          }
        },
      );
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      Object.values(commitTimersRef.current).forEach((timerId) => {
        if (timerId !== undefined) window.clearTimeout(timerId);
      });
      commitTimersRef.current = {};
    };
  }, [playerUid]);

  return {
    overallTopLeaderName,
    overallLoaded,
    currentNotification: queue[0] || null,
    dismissCurrentNotification,
  };
}
