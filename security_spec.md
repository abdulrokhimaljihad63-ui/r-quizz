# Security Specification — UKK Challenge Firestore Rules

## 1. Data Invariants
1. **Default-Deny Baseline**: Every unmapped path is denied (`allow read, write: if false`).
2. **Player Ownership**: A player authenticated via Firebase Auth can only read or modify their own `players/{uid}`, `gameSessions`, `answers`, `playerProgress`, and their own `leaderboard/{uid}_{mode}` entry.
3. **Admin Exclusivity**: Only authenticated admins (present in `/admins/{uid}` OR verified bootstrapped email `oim67193@gmail.com` with `email_verified == true`) can create/update/delete `categories`, `questions`, `syntaxPaths`, `syntaxStages`, `settings`, or list all `players` and `gameSessions`.
4. **No Self-Promotion**: An unprivileged user cannot write to `admins/{uid}` to grant themselves admin privileges.
5. **Leaderboard Monotonicity & PII Isolation**: `leaderboard` documents only contain `playerUid`, `playerName`, `mode`, `bestScore`, `accuracyScore`, `duration`, `achievedAt`, `updatedAt` (no email, no recovery code). Lower scores cannot overwrite higher `bestScore` on update.
6. **Terminal State Locking**: Once a `gameSessions/{sessionId}` reaches `status == 'completed'`, the player cannot mutate it anymore (only admin can).
7. **Strict Schema & Timestamps**: Every document creation enforces `hasAll` and `hasOnly` key checks, bounded strings/arrays, valid IDs (`^[a-zA-Z0-9_-]+$`), and server timestamps (`request.time`) on `createdAt`/`updatedAt`.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read on Players**: `get /players/user1` with `auth == null`.
2. **Cross-Player Profile Read**: `get /players/victimUid` as `attackerUid`.
3. **Self-Admin Escalation**: `create /admins/attackerUid` with `{ uid: "attackerUid", email: "evil@test.com", role: "admin" }` as anonymous/unverified user.
4. **Unverified Admin Email Spoof**: Write to `/questions/q1` with `auth.token.email == "oim67193@gmail.com"` and `auth.token.email_verified == false`.
5. **Player Creating Question**: `create /questions/q1` as anonymous player.
6. **Player Modifying Settings**: `update /settings/global` as anonymous player.
7. **Shadow Field Injection on Player**: `create /players/user1` including ghost field `isAdmin: true`.
8. **Score Downgrade / Leaderboard Hijack**: `update /leaderboard/victim_exam_challenge` as `attackerUid`.
9. **Oversized ID Poisoning**: `create /players/<1500-char-id>` attempting resource exhaustion.
10. **Session Tampering After Completion**: `update /gameSessions/sess1` changing `finalScore` when existing `status == 'completed'`.
11. **Cross-Player Session Scraping (`list`)**: `list /gameSessions` without `where('playerUid', '==', auth.uid)` as non-admin.
12. **Client Timestamp Spoofing**: `create /players/user1` with backdated `createdAt` not equal to `request.time`.
