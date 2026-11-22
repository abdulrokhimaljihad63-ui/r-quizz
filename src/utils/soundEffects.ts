const CORRECT_SOUND_SRC = '/assets/aistudio/dragon-studio-correct-472358_a106868f.mp3';
const WRONG_SOUND_SRC = '/assets/aistudio/universfield-wrong-answer-129254_4d349c08.mp3';

let correctAudio: HTMLAudioElement | null = null;
let wrongAudio: HTMLAudioElement | null = null;

function getFeedbackAudio(type: 'correct' | 'wrong'): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;

  try {
    if (type === 'correct') {
      if (!correctAudio) {
        correctAudio = new Audio(CORRECT_SOUND_SRC);
        correctAudio.preload = 'auto';
        correctAudio.volume = 0.9;
      }
      return correctAudio;
    }

    if (!wrongAudio) {
      wrongAudio = new Audio(WRONG_SOUND_SRC);
      wrongAudio.preload = 'auto';
      wrongAudio.volume = 0.9;
    }
    return wrongAudio;
  } catch {
    return null;
  }
}

export function preloadFeedbackSounds(): void {
  const ok = getFeedbackAudio('correct');
  const err = getFeedbackAudio('wrong');
  try {
    ok?.load();
    err?.load();
  } catch {
    // Ignore preload restrictions
  }
}

/**
 * Unlocks the HTMLAudioElement during a synchronous user click/keypress gesture
 * so delayed playback (e.g. 1.8s later when the checkmark draws) is never blocked by autoplay rules.
 */
export function unlockSuccessSound(soundEnabled = true): void {
  if (!soundEnabled) return;
  const target = getFeedbackAudio('correct');
  if (!target) return;

  try {
    target.muted = true;
    const playPromise = target.play();
    if (playPromise && typeof playPromise.then === 'function') {
      void playPromise
        .then(() => {
          target.pause();
          target.currentTime = 0;
          target.muted = false;
        })
        .catch(() => {
          target.muted = false;
        });
    } else {
      target.pause();
      target.currentTime = 0;
      target.muted = false;
    }
  } catch {
    target.muted = false;
  }
}

export function stopFeedbackSounds(): void {
  try {
    if (correctAudio) {
      correctAudio.pause();
      correctAudio.currentTime = 0;
      correctAudio.muted = false;
    }
    if (wrongAudio) {
      wrongAudio.pause();
      wrongAudio.currentTime = 0;
      wrongAudio.muted = false;
    }
  } catch {
    // Ignore cleanup errors
  }
}

function playFeedbackAudio(type: 'correct' | 'wrong', soundEnabled = true): void {
  if (!soundEnabled) return;

  const target = getFeedbackAudio(type);
  const other = type === 'correct' ? wrongAudio : correctAudio;

  try {
    if (other && !other.paused) {
      other.pause();
      other.currentTime = 0;
    }
    if (!target) return;

    target.muted = false;
    target.pause();
    target.currentTime = 0;
    const playPromise = target.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      void playPromise.catch(() => {
        // Ignore browser autoplay / audio hardware restrictions cleanly
      });
    }
  } catch {
    // Ignore audio hardware / policy restrictions cleanly
  }
}

/**
 * Plays the Dragon Studio correct answer sound effect once.
 */
export function playSuccessFanfare(soundEnabled = true): void {
  playFeedbackAudio('correct', soundEnabled);
}

/**
 * Plays the Universfield wrong answer sound effect once.
 */
export function playErrorTetToot(soundEnabled = true): void {
  playFeedbackAudio('wrong', soundEnabled);
}
