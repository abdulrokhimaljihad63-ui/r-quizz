const RECOVERY_CODE_STORAGE_KEY = 'ukk_player_recovery_code';
const LOCAL_PROFILE_STORAGE_KEY = 'ukk_player_local_meta';

/**
 * Generates an unpredictable local recovery code (UKK-XXXX-XXXX-XXXX).
 * Note: Because Firebase Anonymous Auth ties the primary UID to browser storage
 * without a backend custom-token issuer, this code is kept locally for device backup
 * and never stored in plaintext inside Firestore.
 */
export function generateRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return `UKK-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

export function getOrCreateLocalRecoveryCode(uid: string): string {
  const key = `${RECOVERY_CODE_STORAGE_KEY}_${uid}`;
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const created = generateRecoveryCode();
  localStorage.setItem(key, created);
  return created;
}

export interface LocalPlayerSnapshot {
  uid: string;
  playerId: string;
  name: string;
  absenNumber?: number;
  recoveryCode: string;
  savedAt: string;
}

export function saveLocalPlayerSnapshot(snapshot: LocalPlayerSnapshot): void {
  try {
    localStorage.setItem(LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota issues
  }
}

export function getLocalPlayerSnapshot(): LocalPlayerSnapshot | null {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalPlayerSnapshot;
  } catch {
    return null;
  }
}
