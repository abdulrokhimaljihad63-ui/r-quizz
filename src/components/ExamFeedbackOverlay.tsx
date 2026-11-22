import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';

interface ExamFeedbackOverlayProps {
  status: 'correct' | 'wrong';
  isLastQuestion: boolean;
  isExiting?: boolean;
  onContinueNow: () => void;
}

const CONFETTI_PIECES = [
  { x: -300, y: -165, rot: -140, color: 'bg-amber-400', size: 'w-2.5 h-2.5' },
  { x: -235, y: -210, rot: 95, color: 'bg-emerald-400', size: 'w-2 h-3.5' },
  { x: -165, y: -175, rot: 160, color: 'bg-sky-400', size: 'w-2.5 h-2' },
  { x: -95, y: -220, rot: -75, color: 'bg-rose-400', size: 'w-2 h-3' },
  { x: -30, y: -190, rot: 120, color: 'bg-yellow-400', size: 'w-3 h-2' },
  { x: 40, y: -215, rot: -115, color: 'bg-teal-400', size: 'w-2 h-3' },
  { x: 110, y: -185, rot: 85, color: 'bg-amber-300', size: 'w-2.5 h-2' },
  { x: 185, y: -200, rot: -155, color: 'bg-blue-500', size: 'w-2 h-3.5' },
  { x: 255, y: -165, rot: 135, color: 'bg-pink-400', size: 'w-2.5 h-2.5' },
  { x: 325, y: -115, rot: -65, color: 'bg-lime-400', size: 'w-2.5 h-2' },
  { x: -315, y: 120, rot: 110, color: 'bg-indigo-400', size: 'w-2 h-3' },
  { x: -245, y: 165, rot: -90, color: 'bg-yellow-400', size: 'w-2.5 h-2' },
  { x: -165, y: 195, rot: 145, color: 'bg-emerald-500', size: 'w-2 h-2.5' },
  { x: -85, y: 175, rot: -130, color: 'bg-cyan-400', size: 'w-3 h-2' },
  { x: 20, y: 195, rot: 75, color: 'bg-rose-400', size: 'w-2 h-3' },
  { x: 100, y: 180, rot: -105, color: 'bg-amber-400', size: 'w-2.5 h-2' },
  { x: 180, y: 190, rot: 165, color: 'bg-sky-400', size: 'w-2 h-2.5' },
  { x: 255, y: 155, rot: -80, color: 'bg-lime-500', size: 'w-2.5 h-2.5' },
  { x: 320, y: 105, rot: 125, color: 'bg-orange-400', size: 'w-2 h-2.5' },
  { x: -340, y: -35, rot: -55, color: 'bg-pink-400', size: 'w-2.5 h-2' },
  { x: 340, y: -25, rot: 65, color: 'bg-emerald-400', size: 'w-2.5 h-2' },
  { x: -195, y: -105, rot: 45, color: 'bg-yellow-300', size: 'w-2 h-2.5' },
  { x: 200, y: -100, rot: -50, color: 'bg-cyan-300', size: 'w-2 h-2.5' },
  { x: 0, y: -155, rot: 90, color: 'bg-amber-300', size: 'w-2.5 h-2.5' },
];

function buildSerratedCirclePoints(
  cx: number,
  cy: number,
  teethCount: number,
  outerRadius: number,
  innerRadius: number,
): string {
  const totalPoints = teethCount * 2;
  const coords: string[] = [];
  for (let i = 0; i < totalPoints; i++) {
    const angle = (i * Math.PI) / teethCount - Math.PI / 2;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const x = (cx + r * Math.cos(angle)).toFixed(2);
    const y = (cy + r * Math.sin(angle)).toFixed(2);
    coords.push(`${x},${y}`);
  }
  return coords.join(' ');
}

export const ExamFeedbackOverlay: React.FC<ExamFeedbackOverlayProps> = ({
  status,
  isLastQuestion,
  isExiting = false,
  onContinueNow,
}) => {
  const isCorrect = status === 'correct';
  const prefersReducedMotion = useReducedMotion();

  const serratedPoints = useMemo(() => buildSerratedCirclePoints(80, 80, 24, 76, 67), []);

  const palette = isCorrect
    ? {
        strapGradient:
          'linear-gradient(180deg, #047857 0%, #10b981 30%, #059669 72%, #065f46 100%)',
        sealStart: '#10b981',
        sealMid: '#059669',
        sealEnd: '#047857',
        sealBorder: '#065f46',
      }
    : {
        strapGradient:
          'linear-gradient(180deg, #b91c1c 0%, #ef4444 30%, #dc2626 72%, #991b1b 100%)',
        sealStart: '#ef4444',
        sealMid: '#dc2626',
        sealEnd: '#b91c1c',
        sealBorder: '#991b1b',
      };

  const gradientId = isCorrect ? 'seal-grad-correct' : 'seal-grad-wrong';

  return (
    <motion.div
      role="status"
      aria-live="assertive"
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: isExiting ? 0.42 : 0.16, ease: 'easeOut' }}
      className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Confetti burst layer behind the ribbon & serrated circle */}
      {isCorrect && !prefersReducedMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
        >
          {CONFETTI_PIECES.map((piece, idx) => (
            <motion.span
              key={idx}
              initial={{ x: 0, y: 0, scale: 0.3, opacity: 1, rotate: 0 }}
              animate={{
                x: piece.x,
                y: piece.y,
                scale: [0.5, 1.3, 1],
                opacity: [1, 1, 0],
                rotate: piece.rot * 2,
              }}
              transition={{
                duration: 2.35,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.1 + (idx % 5) * 0.04,
              }}
              className={`absolute rounded-xs shadow-sm ${piece.size} ${piece.color}`}
            />
          ))}
        </div>
      )}

      {/* Edge-to-edge horizontal ribbon strap launching from left to right */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { x: '-100%', opacity: 1 }}
        animate={
          prefersReducedMotion
            ? { opacity: isExiting ? 0 : 1 }
            : { x: isExiting ? '8%' : '0%', opacity: isExiting ? 0 : 1 }
        }
        transition={
          prefersReducedMotion
            ? { duration: 0.2 }
            : isExiting
              ? { duration: 0.42, ease: 'easeInOut' }
              : {
                  duration: 0.62,
                  ease: [0.22, 1, 0.36, 1],
                }
        }
        className="relative z-10 w-full flex items-center justify-center"
      >
        {/* Slim horizontal strap spanning edge-to-edge with white side border lines */}
        <div
          style={{ background: palette.strapGradient }}
          className="relative w-full h-10 sm:h-11 shadow-lg flex items-center justify-center overflow-hidden"
        >
          {/* Crisp white border trim lines along top & bottom sides of the ribbon */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-[4px] h-[2px] bg-white/90"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-[4px] h-[2px] bg-white/90"
          />

          {/* Subtle satin sheen sweep from left to right */}
          {!prefersReducedMotion && (
            <motion.div
              aria-hidden="true"
              initial={{ x: '-40%' }}
              animate={{ x: '260%' }}
              transition={{ duration: 1.0, ease: 'easeOut', delay: 0.18 }}
              className="pointer-events-none absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12"
            />
          )}
        </div>

        {/* Center Serrated / Scalloped Circular Seal (Lingkaran Bergerigi) */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.72, opacity: 0 }}
          animate={
            prefersReducedMotion
              ? { opacity: isExiting ? 0 : 1 }
              : { scale: isExiting ? 0.92 : 1, opacity: isExiting ? 0 : 1 }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0.2 }
              : {
                  duration: 0.38,
                  delay: isExiting ? 0 : 0.16,
                  ease: [0.16, 1, 0.3, 1],
                }
          }
          className="absolute z-20 flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 drop-shadow-xl"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 160 160"
            className="w-full h-full overflow-visible"
          >
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={palette.sealStart} />
                <stop offset="55%" stopColor={palette.sealMid} />
                <stop offset="100%" stopColor={palette.sealEnd} />
              </linearGradient>
            </defs>

            {/* Outer serrated badge body with crisp white edge outline */}
            <polygon
              points={serratedPoints}
              fill={`url(#${gradientId})`}
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinejoin="round"
            />

            {/* Subtle inner white ring framing the center badge text */}
            <circle
              cx="80"
              cy="80"
              r="55"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.7"
              strokeWidth="1.75"
            />
          </svg>

          {/* Centered Status Icon & Label inside the serrated circle */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-white select-none">
            {isCorrect ? (
              <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-xs" />
            ) : (
              <XCircle className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-xs" />
            )}
            <span className="text-base sm:text-lg font-extrabold tracking-[0.16em] leading-none drop-shadow-xs">
              {isCorrect ? 'BENAR' : 'SALAH'}
            </span>
          </div>
        </motion.div>
      </motion.div>

      {/* Quick Continue Button placed cleanly below the serrated circle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isExiting ? 0 : 1, y: isExiting ? 6 : 0 }}
        transition={{ duration: 0.25, delay: isExiting ? 0 : 0.28 }}
        className="relative z-20 mt-14 sm:mt-16 px-4 pointer-events-auto"
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
