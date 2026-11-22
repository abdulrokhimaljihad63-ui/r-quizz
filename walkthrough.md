# Security Summary

**Reviewed Files**: 42
**Issues Resolved**: 3

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Exposed Solution Document in Public Assets | `public/assets/aistudio/PENYELESAIAN_SOAL_UKK_PAKET_2_2026_-_FIX_4019a747.pdf` | — | Unreferenced exam solution PDF, module PDF, paste file, and superseded logo assets were stored inside `public/assets/aistudio/`, causing `vite build` to copy the UKK solution key directly into `dist/assets/aistudio/` where any visitor could download it. | High | Fixed | Removed all 5 unreferenced files from `public/assets/aistudio/`, retaining only the 6 media assets actively rendered by the application. |
| Unsafe UI Dialog & Silent Cascade Deletion Failures | `src/pages/admin/ManagePlayersPage.tsx`, `src/services/firestoreService.ts` | 66, 1442–1506 | Admin deletion used `window.alert()` (blocked inside embedded frames) and `deletePlayerAndAssociatedData` caught and suppressed errors while counting nonexistent leaderboard documents as deleted. | Medium | Fixed | Replaced `window.alert()` with an inline error banner, switched leaderboard/progress/answer deletion to `writeBatch` after checking existence, and surfaced real errors cleanly. |
| Unvalidated Admin Game Settings Inputs | `src/pages/admin/GameSettingsPage.tsx` | 22–48 | Numeric settings inputs (`examTotalQuestions`, `examGuidedCount`, `examBlindCount`, `examTroubleshootingCount`, `examTimeLimitSeconds`) could submit non-integer or out-of-range values before reaching Firestore rules. | Medium | Fixed | Added finite integer range checks matching `firestore.rules` before submitting updates. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| No Hardcoded Secrets or Raw HTML Sinks | `src/` (`grep` verified) | Zero private API keys, OAuth secrets, `eval()`, `new Function()`, or `dangerouslySetInnerHTML` calls exist anywhere in frontend code; `{NO_ABSEN}` substitution uses pure literal string splitting. |
| Firestore Default-Deny & Owner/Admin Boundaries | `firestore.rules` | Top-level `match /{document=**} { allow read, write: if false; }` denies unauthenticated access; admin writes (`categories`, `questions`, `syntaxPaths`, `syntaxStages`, `settings`) require verified admin identity; `gameSessions` cannot be modified after `status == 'completed'`; player scores and leaderboard totals enforce monotonic non-decreasing bounds (`<= 100` per session). |
| Safe React Output & Authentication | `src/contexts/AuthContext.tsx`, `src/components/SyntaxTerminal.tsx` | Student-supplied names, syntax answers, and prompts render through standard React text nodes; student and admin authentication rely on Firebase Auth with Google Sign-In and Email/Password. |

### Architectural Notes (Needs Follow-Up if Strict Anti-Cheat Required)
- **Client-Side Quiz Evaluation**: Because RQuizz runs as a static SPA directly against Firestore without a custom Node/Cloud Functions grading backend, authenticated signed-in users can query `questions` (needed for real-time character-by-character terminal feedback) and submit session scores validated up to `100` per session by `firestore.rules`. For low-stakes classroom drills and teacher-monitored UKK sessions this works as designed; if high-stakes unsupervised anti-cheat is needed later, move question answers and score calculation into Cloud Functions.
- **Duplicate `{NO_ABSEN}` Check Visibility**: `players` allows authenticated `list` queries so registration and profile edits can verify no two students claim the same `absenNumber`; player documents store only display names, `playerId`, `absenNumber`, and game stats (no emails or phone numbers).

## PoC Verification

### 1. Public Static Exposure of UKK Solution PDF
#### Summary
| Field | Value |
|---|---|
| Issue Type | Sensitive Static Asset Exposure in `public/` |
| Impact | High |
| Affected File | `public/assets/aistudio/PENYELESAIAN_SOAL_UKK_PAKET_2_2026_-_FIX_4019a747.pdf` |
| Test Scenario | `GET /assets/aistudio/PENYELESAIAN_SOAL_UKK_PAKET_2_2026_-_FIX_4019a747.pdf` against production `dist/` output |

#### How It Was Fixed
Removed all unreferenced uploaded files (including the UKK Paket 2 solution PDF and module PDF) from `public/assets/aistudio/` after verifying via codebase-wide `grep` that zero source files reference them.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `vite build` copies static files from `public/` into `dist/` | Only the 6 actively used UI images/SVGs/MP3s exist in `public/assets/aistudio/` |
| 2 | A user or browser requests `/assets/aistudio/PENYELESAIAN_SOAL_UKK_PAKET_2_2026_-_FIX_4019a747.pdf` | File does not exist in `dist/assets/aistudio/` |
| 3 | SPA fallback serves normal app shell / 404 without leaking solutions | **Handled Safely** |

#### Conclusion
**Fix Verified** - Neither `public/assets/aistudio/` nor production builds (`dist/assets/aistudio/`) contain the UKK solution PDF.

### 2. Out-of-Bounds / Non-Integer Admin Settings Payload
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Client-Side Bounds Validation |
| Impact | Medium |
| Affected File | `src/pages/admin/GameSettingsPage.tsx:22-56` |
| Test Scenario | Admin submits `examTimeLimitSeconds = 10` or `NaN` in the Settings form |

#### How It Was Fixed
Added strict `Number.isInteger` range checks (`examTotalQuestions` 1–100, composition counts 0–100 summing to total, `troubleshootQuestionCount` 1–100, `examTimeLimitSeconds` 60–14400) before calling `saveSettings()`, backing up the server-side `isValidSettings()` guard in `firestore.rules:276-310`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Admin alters `examTimeLimitSeconds` to `10` or clears input (`NaN`) and submits | `handleSave` intercepts submission at `src/pages/admin/GameSettingsPage.tsx:52` |
| 2 | `isIntInRange(form.examTimeLimitSeconds, 60, 14400)` returns `false` | Validation fails immediately with a clear Indonesian message |
| 3 | `saveSettings(form)` is never called; invalid write blocked locally and by `firestore.rules:297` | **Handled Safely** |

#### Conclusion
**Fix Verified** - Invalid numeric settings are caught cleanly in the UI and additionally enforced by Firestore Security Rules.
