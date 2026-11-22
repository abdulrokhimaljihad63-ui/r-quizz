import type {
  ActiveGameMode,
  ActiveLeaderboardMode,
  AppSettings,
  GameMode,
  QuestionType,
} from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  examTotalQuestions: 20,
  examGuidedCount: 7,
  examBlindCount: 7,
  examTroubleshootingCount: 6,
  troubleshootQuestionCount: 10,
  examTimeLimitSeconds: 1800,
  practiceQuestionCount: 10,
  practiceTargetSecondsPerQuestion: 45,
  defaultPointsEasy: 10,
  defaultPointsMedium: 20,
  defaultPointsHard: 30,
  syntaxErrorPenaltyPercent: 10,
  weightCorrectness: 0.6,
  weightAccuracy: 0.25,
  weightSpeed: 0.15,
  prioritizeUnseenVariations: true,
  enabledModes: {
    practice_only: true,
    ujian: true,
    ujian_acak: true,
    troubleshoot: true,
    guided_syntax: true,
    blind_syntax: true,
    troubleshooting: true,
    exam_challenge: true,
    syntax_journey: true,
  },
};

export const INITIAL_CATEGORIES: Array<{
  id: string;
  name: string;
  description: string;
  orderIndex: number;
}> = [
  {
    id: 'mikrotik',
    name: 'MikroTik',
    description: 'Konfigurasi interface, DHCP Client/Server, Bridge, Firewall NAT, dan Port Forwarding.',
    orderIndex: 1,
  },
  {
    id: 'networking',
    name: 'Networking',
    description: 'Pengalamatan IP, subnetting, routing dasar, DNS, dan konektivitas antar host.',
    orderIndex: 2,
  },
  {
    id: 'debian-linux',
    name: 'Debian/Linux',
    description: 'Instalasi, manajemen user, konfigurasi jaringan, repositori APT, dan layanan systemd.',
    orderIndex: 3,
  },
  {
    id: 'mariadb',
    name: 'MariaDB',
    description: 'Instalasi server database, pembuatan database, hak akses user, dan bind-address.',
    orderIndex: 4,
  },
  {
    id: 'apache-php',
    name: 'Apache & PHP',
    description: 'Web server Apache2, modul PHP, pengaturan php.ini, dan direktori web.',
    orderIndex: 5,
  },
  {
    id: 'moodle',
    name: 'Moodle',
    description: 'Instalasi LMS Moodle, moodledata, config.php dinamis, dan konfigurasi situs.',
    orderIndex: 6,
  },
  {
    id: 'backup',
    name: 'Backup',
    description: 'Backup database mysqldump, arsip tar konfigurasi, dan penjadwalan crontab.',
    orderIndex: 7,
  },
  {
    id: 'upgrade',
    name: 'Upgrade',
    description: 'Pembaruan sistem paket APT, upgrade versi Moodle, dan maintenance mode.',
    orderIndex: 8,
  },
  {
    id: 'troubleshooting',
    name: 'Troubleshooting',
    description: 'Analisis masalah jaringan, layanan, permission, dan kesalahan konfigurasi server.',
    orderIndex: 9,
  },
];

export const ACTIVE_MODES: ActiveGameMode[] = [
  'practice_only',
  'ujian',
  'ujian_acak',
  'troubleshoot',
];

export const COMPETITIVE_EXAM_MODES: ActiveGameMode[] = [
  'ujian',
  'ujian_acak',
  'troubleshoot',
];

export const MODE_META: Record<
  GameMode,
  { label: string; shortLabel: string; description: string; accent: string; isExam: boolean }
> = {
  practice_only: {
    label: 'Hanya Latihan',
    shortLabel: 'Latihan',
    description:
      'Latihan bertahap berurutan dengan petunjuk dan koreksi warna real-time tanpa skor atau leaderboard.',
    accent: 'cyan',
    isExam: false,
  },
  ujian: {
    label: 'Ujian',
    shortLabel: 'Ujian',
    description:
      'Ujian sintaks berurutan sesuai modul RQuizz tanpa petunjuk; dinilai per soal saat menekan Submit Jawaban.',
    accent: 'blue',
    isExam: true,
  },
  ujian_acak: {
    label: 'Ujian Latihan Soal Acak',
    shortLabel: 'Ujian Acak',
    description:
      'Simulasi ujian acak 20 soal campuran dari seluruh jenis soal dengan nilai maksimal 100.',
    accent: 'indigo',
    isExam: true,
  },
  troubleshoot: {
    label: 'Troubleshoot',
    shortLabel: 'Troubleshoot',
    description:
      'Ujian analisis kasus error jaringan dan server dengan penilaian maksimal 100 dan akumulasi leaderboard.',
    accent: 'sky',
    isExam: true,
  },
  // Legacy entries retained strictly for rendering historical session/admin data cleanly
  guided_syntax: {
    label: 'Guided Syntax (Arsip)',
    shortLabel: 'Guided',
    description: 'Mode latihan lama dengan petunjuk langkah.',
    accent: 'blue',
    isExam: true,
  },
  blind_syntax: {
    label: 'Blind Syntax (Arsip)',
    shortLabel: 'Blind',
    description: 'Mode ujian sintaks lama tanpa petunjuk.',
    accent: 'indigo',
    isExam: true,
  },
  troubleshooting: {
    label: 'Troubleshooting (Arsip)',
    shortLabel: 'Troubleshoot',
    description: 'Mode troubleshooting versi lama.',
    accent: 'sky',
    isExam: true,
  },
  exam_challenge: {
    label: 'Exam Challenge (Arsip)',
    shortLabel: 'Exam',
    description: 'Mode ujian campuran versi lama.',
    accent: 'blue',
    isExam: true,
  },
  syntax_journey: {
    label: 'Syntax Journey (Arsip)',
    shortLabel: 'Journey',
    description: 'Mode perjalanan sintaks versi lama.',
    accent: 'cyan',
    isExam: false,
  },
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  guided_syntax: 'Sintaks Berpetunjuk (Latihan)',
  blind_syntax: 'Sintaks Tanpa Petunjuk (Ujian)',
  troubleshooting: 'Troubleshooting (Pilihan Ganda)',
};

export const LEADERBOARD_MODES: Array<{ id: ActiveLeaderboardMode; label: string }> = [
  { id: 'overall', label: 'Keseluruhan' },
  { id: 'ujian', label: 'Ujian' },
  { id: 'ujian_acak', label: 'Ujian Latihan Soal Acak' },
  { id: 'troubleshoot', label: 'Troubleshoot' },
];

export const LOGO_URL = '/assets/aistudio/Desain_tanpa_judul_20261122_141104_0000_fb4a92db.png';
