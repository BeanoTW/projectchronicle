import { motion } from 'framer-motion';
import heroImage from '@/assets/auth-hero-sunrise.jpg';

interface AuthHeroProps {
  /** One short supporting line beneath the wordmark. Optional. */
  tagline?: string;
}

/**
 * Branded auth hero panel. Used on Welcome / Login / Signup / Forgot / Reset.
 * - Contained panel (not full screen)
 * - Cinematic sunrise/mountain photo with controlled overlay
 * - Single serif wordmark + ONE supporting line
 */
const AuthHero = ({ tagline = 'A chronological workplace record you can trust.' }: AuthHeroProps) => {
  return (
    <div
      className="relative w-full overflow-hidden rounded-b-[28px] md:rounded-[24px] md:h-full shadow-[0_8px_24px_-12px_hsl(220_30%_8%/0.35)]"
      style={{ height: 'min(42vh, 320px)', minHeight: 240 }}
    >
      {/* Background photo */}
      <img
        src={heroImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {/* Top→bottom darkening overlay for legibility */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, hsl(220 35% 8% / 0.30) 0%, hsl(220 35% 8% / 0.40) 55%, hsl(220 35% 8% / 0.62) 100%)',
        }}
      />
      {/* Subtle vignette on bottom edge for crisp card transition */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
        style={{ background: 'linear-gradient(180deg, transparent, hsl(220 35% 8% / 0.35))' }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-end px-6 pb-9 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
          className="font-serif text-white tracking-[0.18em] text-[26px] sm:text-[30px] leading-none"
          style={{ fontFamily: '"Cormorant Garamond", "Times New Roman", serif', fontWeight: 500 }}
        >
          PROJECT&nbsp;CHRONICLE
        </motion.h1>

        {/* Decorative mountain motif */}
        <motion.svg
          initial={{ opacity: 0, scaleX: 0.85 }}
          animate={{ opacity: 0.85, scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 0.61, 0.36, 1] }}
          width="120"
          height="14"
          viewBox="0 0 120 14"
          fill="none"
          className="mt-3"
          aria-hidden="true"
        >
          <line x1="0" y1="11" x2="42" y2="11" stroke="hsl(38 70% 70%)" strokeWidth="0.8" strokeOpacity="0.7" />
          <circle cx="46" cy="11" r="1.1" fill="hsl(38 70% 70%)" fillOpacity="0.8" />
          <path d="M50 11 L58 4 L64 8 L70 2 L76 8 L84 11" stroke="hsl(38 75% 72%)" strokeWidth="0.9" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="86" cy="11" r="1.1" fill="hsl(38 70% 70%)" fillOpacity="0.8" />
          <line x1="90" y1="11" x2="120" y2="11" stroke="hsl(38 70% 70%)" strokeWidth="0.8" strokeOpacity="0.7" />
        </motion.svg>

        {tagline && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
            className="mt-3 text-[10.5px] uppercase tracking-[0.22em] text-white/75"
          >
            {tagline}
          </motion.p>
        )}
      </div>
    </div>
  );
};

export default AuthHero;
