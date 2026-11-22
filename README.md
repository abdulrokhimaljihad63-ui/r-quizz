# RQuizz — Dokumentasi Aplikasi & Pemeliharaan

Platform latihan dan ujian interaktif berbasis web untuk persiapan Uji Kompetensi Keahlian (UKK TKJ), dibangun menggunakan React, TypeScript, Vite, Tailwind CSS v4, dan Firebase (Authentication + Cloud Firestore).

---

## 1. Struktur Project

```text
├── firebase-applet-config.json   # Konfigurasi Firebase project & firestoreDatabaseId
├── firebase-blueprint.json       # Skema koleksi & relasi database Firestore
├── firestore.rules               # Aturan keamanan Firestore (default-deny, role admin, owner guard)
├── index.html                    # Entry HTML, metadata SEO, dan Google Fonts (Fredoka, Nunito, IBM Plex Mono)
├── metadata.json                 # Identitas aplikasi RQuizz
├── public/assets/aistudio/       # Aset media aktif (logo, background cyber, SVG feedback, SFX MP3)
├── src/
│   ├── components/               # Komponen UI reusable (PlayerLayout, AdminLayout, SyntaxTerminal, Logo, dll.)
│   ├── constants/defaults.ts     # Metadata 4 mode utama, 9 kategori awal, pengaturan default
│   ├── contexts/AuthContext.tsx  # State autentikasi Firebase, profil pemain, status admin, & listener realtime
│   ├── hooks/                    # Hook pemantau peringkat real-time (useLeaderboardMonitor)
│   ├── lib/firebase.ts           # Inisialisasi Firebase app, Auth, Firestore, & helper error
│   ├── pages/
│   │   ├── WelcomePage.tsx       # Portal login Google siswa + pendaftaran nama & no absen
│   │   ├── player/               # Dashboard, Hanya Latihan, Sesi Ujian, Hasil, Riwayat, Leaderboard, Profil
│   │   └── admin/                # Login Admin, Ringkasan, Kategori, Bank Soal, Milestone, Pemain, Hasil, Pengaturan
│   ├── services/firestoreService.ts # Seluruh operasi CRUD & transaksi Firestore
│   ├── types/index.ts            # Definisi tipe TypeScript utama
│   └── utils/                    # Mesin evaluasi sintaks, template {NO_ABSEN}, scoring, randomizer, SFX
└── tests/rquizz.test.ts          # Unit test otomatis untuk logika penilaian, sintaks, absen dinamis, & randomizer
```

---

## 2. Teknologi yang Digunakan

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4
- **Ikon & Animasi**: `lucide-react`, `motion`
- **Backend / Database / Auth**: Firebase Authentication (Google Sign-In & Email/Password) dan Cloud Firestore (named database sesuai `firebase-applet-config.json`)
- **Validasi Rules & Testing**: `@firebase/eslint-plugin-security-rules`, Node Test Runner (`tsx --test`)

---

## 3. Cara Menjalankan di Lokal

1. Pastikan Node.js (>= 20) sudah terpasang.
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Jalankan server pengembangan pada port `3000`:
   ```bash
   npm run dev
   ```
4. Menjalankan pengecekan tipe, lint rules, dan unit test:
   ```bash
   npm run lint
   npx eslint firestore.rules
   npx tsx --test tests/rquizz.test.ts
   ```

---

## 4. Cara Mengelola & Mengembangkan Fitur

- **Menambah/mengubah Kategori & Soal**: Dapat dilakukan langsung lewat **Portal Admin** tanpa menyentuh kode (`/admin` atau tombol *Portal Admin* di Profil). Mendukung variasi soal, banyak alternatif jawaban, mode urutan kata bebas (`flexible_order`), dan variabel dinamis `{NO_ABSEN}`.
- **Mengubah Kode Ruang / Pesan Awal**: Kode ruang `rquizz-ukk-tkj1-2026` tertera pada `src/pages/player/DashboardPage.tsx` (notifikasi satu kali) dan `src/pages/player/ProfilePage.tsx`.
- **Menambah Mode atau Pengaturan Penilaian**: Perbarui `src/constants/defaults.ts`, `src/types/index.ts`, `src/pages/admin/GameSettingsPage.tsx`, serta validator `isValidSettings` di `firestore.rules`.

---

## 5. Cara Build Produksi

Jalankan perintah berikut sebelum mengunggah ke layanan hosting:
```bash
npm run build
```
Hasil siap produksi tersimpan di folder `dist/`. Uji lokal hasil produksi dengan:
```bash
npm run preview
```

---

## 6. Panduan Deployment & Re-Deploy (Firebase Hosting — Paket Spark / Gratis)

Karena RQuizz adalah **Single Page Application (SPA)**, konfigurasi hosting wajib mengarahkan semua rute ke `/index.html`.

1. Pastikan Firebase CLI terpasang (`npm i -g firebase-tools`) dan login (`firebase login`).
2. Buat `firebase.json` di root project (bila belum ada):
   ```json
   {
     "hosting": {
       "public": "dist",
       "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
       "rewrites": [
         { "source": "**", "destination": "/index.html" }
       ]
     }
   }
   ```
3. Pastikan domain hosting produksi ditambahkan di **Firebase Console → Authentication → Settings → Authorized domains** agar Login Google berjalan tanpa error.
4. Build dan deploy ulang kapan pun ada perubahan:
   ```bash
   npm run build
   firebase deploy --only hosting,firestore:rules
   ```

---

## 7. Backup & Pemulihan Data Firestore

- **Backup Berkala**: Gunakan `gcloud firestore export` ke bucket Cloud Storage atau ekspor koleksi penting (`categories`, `questions`, `syntaxPaths`, `syntaxStages`, `settings`, `players`, `gameSessions`, `leaderboard`) melalui Firebase Console sebelum ujian massal dimulai.
- **Pemulihan**: Impor kembali dari snapshot export apabila terjadi penghapusan data tidak sengaja. Selalu uji `firestore.rules` dengan `npx eslint firestore.rules` sebelum melakukan deploy rules baru.
