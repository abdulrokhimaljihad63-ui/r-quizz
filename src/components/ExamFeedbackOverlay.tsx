import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

export const SUCCESS_SVG_SRC = '/assets/aistudio/Success_e36ec0af.svg';
export const ERROR_SVG_SRC = '/assets/aistudio/Sign_for_error___Flat_style_e9ee8230.svg';

const svgBlobCache = new Map<string, Blob>();
const svgFetchPromises = new Map<string, Promise<Blob | null>>();

function fetchSvgBlob(src: string): Promise<Blob | null> {
  const cached = svgBlobCache.get(src);
  if (cached) return Promise.resolve(cached);

  const pending = svgFetchPromises.get(src);
  if (pending) return pending;

  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return Promise.resolve(null);
  }

  const promise = fetch(src)
    .then(async (res) => {
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: 'image/svg+xml' });
      svgBlobCache.set(src, blob);
      return blob;
    })
    .catch(() => null)
    .finally(() => {
      svgFetchPromises.delete(src);
    });

  svgFetchPromises.set(src, promise);
  return promise;
}

export function preloadFeedbackSvgs(): void {
  void fetchSvgBlob(SUCCESS_SVG_SRC);
  void fetchSvgBlob(ERROR_SVG_SRC);
}

interface ExamFeedbackOverlayProps {
  status: 'correct' | 'wrong';
  playKey: number;
  isLastQuestion: boolean;
  isExiting?: boolean;
  onContinueNow: () => void;
}

export const ExamFeedbackOverlay: React.FC<ExamFeedbackOverlayProps> = ({
  status,
  playKey,
  isLastQuestion,
  isExiting = false,
  onContinueNow,
}) => {
  const isCorrect = status === 'correct';
  const prefersReducedMotion = useReducedMotion();
  const baseSrc = isCorrect ? SUCCESS_SVG_SRC : ERROR_SVG_SRC;

  const [imgSrc, setImgSrc] = useState<string>(() => {
    const cachedBlob = svgBlobCache.get(baseSrc);
    if (cachedBlob) {
      return URL.createObjectURL(cachedBlob);
    }
    return `${baseSrc}?play=${playKey}`;
  });

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    const cached = svgBlobCache.get(baseSrc);
    if (cached) {
      createdUrl = URL.createObjectURL(cached);
      setImgSrc(createdUrl);
    } else {
      setImgSrc(`${baseSrc}?play=${playKey}`);
      void fetchSvgBlob(baseSrc).then((blob) => {
        if (!active || !blob) return;
        // Pre-cached for subsequent submissions so this play doesn't flicker mid-animation
      });
    }

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [baseSrc, playKey]);

  return (
    <motion.div
      role="status"
      aria-live="assertive"
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: isExiting ? 0.38 : 0.14, ease: 'easeOut' }}
      className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center p-4 overflow-hidden"
    >
      <span className="sr-only">
        {isCorrect ? 'Jawaban benar.' : 'Jawaban salah.'}
      </span>

      {/* Animated SVG directly over the question screen (no dim backdrop) */}
      <motion.div
        key={`${status}-${playKey}`}
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
        animate={
          prefersReducedMotion
            ? { opacity: isExiting ? 0 : 1 }
            : { scale: isExiting ? 0.94 : 1, opacity: isExiting ? 0 : 1 }
        }
        transition={{ duration: isExiting ? 0.38 : 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex items-center justify-center"
      >
        <img
          src={imgSrc}
          alt={isCorrect ? 'Animasi jawaban benar' : 'Animasi jawaban salah'}
          className={
            isCorrect
              ? 'w-72 h-72 sm:w-88 sm:h-88 object-contain select-none pointer-events-none drop-shadow-md'
              : 'w-48 h-48 sm:w-60 sm:h-60 object-contain select-none pointer-events-none drop-shadow-md'
          }
        />
      </motion.div>

      {/* Quick Continue Button placed cleanly below the SVG */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: isExiting ? 0 : 1, y: isExiting ? 4 : 0 }}
        transition={{ duration: 0.22, delay: isExiting ? 0 : 0.25 }}
        className="relative z-20 mt-2 pointer-events-auto"
      >
        <button
          type="button"
          onClick={onContinueNow}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-lg shadow-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          {isLastQuestion ? 'Lihat Hasil Ujian' : 'Lanjut Sekarang'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </motion.div>
  );
};
