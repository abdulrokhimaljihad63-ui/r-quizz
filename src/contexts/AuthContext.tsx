import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { DEFAULT_SETTINGS } from '../constants/defaults';
import { auth } from '../lib/firebase';
import {
  checkIsAdmin,
  createPlayerProfile,
  ensureAdminDoc,
  getAllPlayers,
  getPlayerProfile,
  seedInitialCategories,
  subscribeCategories,
  subscribeQuestions,
  subscribeSettings,
  subscribeSyntaxPaths,
  subscribeSyntaxStages,
  updatePlayerAbsen,
  updatePlayerName,
  updatePlayerPreferences,
} from '../services/firestoreService';
import { parseAbsenNumber } from '../utils/dynamicAnswer';
import type {
  AppSettings,
  Category,
  Player,
  PlayerPreferences,
  Question,
  SyntaxPath,
  SyntaxStage,
} from '../types';
import { getOrCreateLocalRecoveryCode, saveLocalPlayerSnapshot } from '../utils/recovery';

interface AuthContextValue {
  firebaseUser: User | null;
  player: Player | null;
  isAdmin: boolean;
  authReady: boolean;
  authError: string | null;
  categories: Category[];
  questions: Question[];
  syntaxPaths: SyntaxPath[];
  syntaxStages: SyntaxStage[];
  settings: AppSettings;
  dataLoading: boolean;
  loginStudentWithGoogle: () => Promise<void>;
  registerStudent: (name: string, absenNumber: number) => Promise<void>;
  renamePlayer: (name: string, absenNumber?: number) => Promise<void>;
  updatePlayerAbsenNumber: (absenNumber: number) => Promise<void>;
  savePreferences: (prefs: PlayerPreferences) => Promise<void>;
  loginAdminWithEmail: (email: string, password: string) => Promise<void>;
  loginAdminWithGoogle: () => Promise<void>;
  logoutAdmin: () => Promise<void>;
  logoutPlayer: () => Promise<void>;
  refreshPlayer: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [syntaxPaths, setSyntaxPaths] = useState<SyntaxPath[]>([]);
  const [syntaxStages, setSyntaxStages] = useState<SyntaxStage[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [dataLoading, setDataLoading] = useState(true);

  const loadUserContext = useCallback(async (user: User | null) => {
    if (!user) {
      setPlayer(null);
      setIsAdmin(false);
      return;
    }

    const adminStatus = await checkIsAdmin(user.uid, user.email, user.emailVerified);
    setIsAdmin(adminStatus);

    if (adminStatus && user.email) {
      try {
        await ensureAdminDoc(user.uid, user.email);
        await seedInitialCategories();
      } catch {
        // Non-fatal if rules deny when unverified
      }
      setPlayer(null);
    } else {
      const existingPlayer = await getPlayerProfile(user.uid);
      setPlayer(existingPlayer);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      try {
        await loadUserContext(user);
      } catch (err) {
        console.error(err);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, [loadUserContext]);

  // Subscribe to shared Firestore collections only after authenticated
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    let loadedFlags = 0;
    const markLoaded = () => {
      loadedFlags++;
      if (loadedFlags >= 4) {
        setDataLoading(false);
      }
    };
    const handleSubError = (err: unknown) => {
      markLoaded();
      console.error('Firestore subscription error:', err);
    };

    const unsubCats = subscribeCategories((items) => {
      setCategories(items);
      markLoaded();
    }, handleSubError);
    const unsubQuestions = subscribeQuestions((items) => {
      setQuestions(items);
      markLoaded();
    }, handleSubError);
    const unsubPaths = subscribeSyntaxPaths((items) => {
      setSyntaxPaths(items);
      markLoaded();
    }, handleSubError);
    const unsubStages = subscribeSyntaxStages((items) => {
      setSyntaxStages(items);
      markLoaded();
    }, handleSubError);
    const unsubSettings = subscribeSettings(
      (s) => {
        setSettings(s);
      },
      (err) => console.error('Firestore settings error:', err),
    );

    return () => {
      unsubCats();
      unsubQuestions();
      unsubPaths();
      unsubStages();
      unsubSettings();
    };
  }, [authReady, firebaseUser]);

  const loginStudentWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const adminOk = await checkIsAdmin(cred.user.uid, cred.user.email, cred.user.emailVerified);
      if (adminOk) {
        await signOut(auth);
        throw new Error('Akun admin tidak dapat masuk melalui portal siswa.');
      }
      const existingPlayer = await getPlayerProfile(cred.user.uid);
      setPlayer(existingPlayer);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      setAuthError(message);
      throw err;
    }
  }, []);

  const registerStudent = useCallback(
    async (rawName: string, rawAbsen: number) => {
      setAuthError(null);
      if (!firebaseUser) {
        throw new Error('Belum terautentikasi dengan Google.');
      }
      const trimmed = rawName.trim();
      if (trimmed.length < 2) {
        throw new Error('Nama minimal 2 karakter.');
      }
      const cleanAbsen = parseAbsenNumber(rawAbsen);
      if (cleanAbsen === null) {
        throw new Error('Nomor absen wajib berupa angka antara 1 sampai 999.');
      }

      try {
        const all = await getAllPlayers();
        const conflict = all.find((p: Player) => p.absenNumber === cleanAbsen && p.uid !== firebaseUser.uid);
        if (conflict) {
          throw new Error(
            `Nomor absen ${cleanAbsen} sudah digunakan oleh siswa lain (${conflict.name}).`,
          );
        }

        const profile = await createPlayerProfile(firebaseUser.uid, trimmed, cleanAbsen);
        setPlayer(profile);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal mendaftarkan profil siswa.';
        setAuthError(message);
        throw err;
      }
    },
    [firebaseUser],
  );

  const renamePlayer = useCallback(
    async (rawName: string, rawAbsen?: number) => {
      if (!firebaseUser || !player) {
        throw new Error('Profil pemain belum aktif.');
      }
      const trimmed = rawName.trim();
      if (trimmed.length < 2) {
        throw new Error('Nama minimal 2 karakter.');
      }
      let cleanAbsen: number | undefined;
      if (rawAbsen !== undefined) {
        const parsed = parseAbsenNumber(rawAbsen);
        if (parsed === null) {
          throw new Error('Nomor absen wajib berupa angka antara 1 sampai 999.');
        }
        cleanAbsen = parsed;
        const all = await getAllPlayers();
        const conflict = all.find((p: Player) => p.absenNumber === cleanAbsen && p.uid !== firebaseUser.uid);
        if (conflict) {
          throw new Error(
            `Nomor absen ${cleanAbsen} sudah digunakan oleh siswa lain (${conflict.name}).`,
          );
        }
      }
      await updatePlayerName(firebaseUser.uid, trimmed, cleanAbsen);
      const updated = await getPlayerProfile(firebaseUser.uid);
      setPlayer(updated);
    },
    [firebaseUser, player],
  );

  const updatePlayerAbsenNumber = useCallback(
    async (rawAbsen: number) => {
      if (!firebaseUser || !player) {
        throw new Error('Profil pemain belum aktif.');
      }
      const cleanAbsen = parseAbsenNumber(rawAbsen);
      if (cleanAbsen === null) {
        throw new Error('Nomor absen wajib berupa angka antara 1 sampai 999.');
      }
      await updatePlayerAbsen(firebaseUser.uid, cleanAbsen);
      const updated = await getPlayerProfile(firebaseUser.uid);
      setPlayer(updated);
      if (updated) {
        const recoveryCode = getOrCreateLocalRecoveryCode(updated.uid);
        saveLocalPlayerSnapshot({
          uid: updated.uid,
          playerId: updated.playerId,
          name: updated.name,
          absenNumber: updated.absenNumber,
          recoveryCode,
          savedAt: new Date().toISOString(),
        });
      }
    },
    [firebaseUser, player],
  );

  const savePreferences = useCallback(
    async (prefs: PlayerPreferences) => {
      if (!firebaseUser || !player) return;
      await updatePlayerPreferences(firebaseUser.uid, prefs);
      const updated = await getPlayerProfile(firebaseUser.uid);
      setPlayer(updated);
    },
    [firebaseUser, player],
  );

  const loginAdminWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const adminOk = await checkIsAdmin(
        cred.user.uid,
        cred.user.email,
        cred.user.emailVerified,
      );
      if (!adminOk) {
        await signOut(auth);
        throw new Error(
          'Akun ini tidak terdaftar sebagai admin atau email belum diverifikasi di koleksi admins.',
        );
      }
      if (cred.user.email) {
        await ensureAdminDoc(cred.user.uid, cred.user.email).catch(() => undefined);
        await seedInitialCategories().catch(() => undefined);
      }
      setIsAdmin(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/operation-not-allowed') {
        const msg =
          'Email/Password Authentication belum diaktifkan di Firebase Console. Aktifkan di Authentication > Sign-in method > Email/Password, atau gunakan Login Google Admin.';
        setAuthError(msg);
        throw new Error(msg);
      }
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        const msg = 'Email atau password admin salah.';
        setAuthError(msg);
        throw new Error(msg);
      }
      const message = err instanceof Error ? err.message : 'Gagal masuk sebagai admin.';
      setAuthError(message);
      throw err;
    }
  }, []);

  const loginAdminWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const adminOk = await checkIsAdmin(
        cred.user.uid,
        cred.user.email,
        cred.user.emailVerified,
      );
      if (!adminOk) {
        await signOut(auth);
        throw new Error('Akun Google ini tidak memiliki hak akses admin.');
      }
      if (cred.user.email) {
        await ensureAdminDoc(cred.user.uid, cred.user.email);
        await seedInitialCategories();
      }
      setIsAdmin(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal masuk dengan Google Admin.';
      setAuthError(message);
      throw err;
    }
  }, []);

  const logoutAdmin = useCallback(async () => {
    await signOut(auth);
    setIsAdmin(false);
    setPlayer(null);
  }, []);

  const logoutPlayer = useCallback(async () => {
    await signOut(auth);
    setPlayer(null);
  }, []);

  const refreshPlayer = useCallback(async () => {
    if (!firebaseUser) return;
    const updated = await getPlayerProfile(firebaseUser.uid);
    setPlayer(updated);
  }, [firebaseUser]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        player,
        isAdmin,
        authReady,
        authError,
        categories,
        questions,
        syntaxPaths,
        syntaxStages,
        settings,
        dataLoading,
        loginStudentWithGoogle,
        registerStudent,
        renamePlayer,
        updatePlayerAbsenNumber,
        savePreferences,
        loginAdminWithEmail,
        loginAdminWithGoogle,
        logoutAdmin,
        logoutPlayer,
        refreshPlayer,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
