/**
 * Subtle mountain range backdrop used behind page headers.
 * - Sits behind all UI (z-0, parent should be relative)
 * - Pointer-events: none (never blocks taps)
 * - Very low opacity, fades into background at the bottom
 */
const MountainBackdrop = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden"
      style={{ height: 96 }}
    >
      <svg
        viewBox="0 0 400 96"
        preserveAspectRatio="none"
        className="h-full w-full"
        style={{ opacity: 0.07 }}
      >
        <defs>
          <linearGradient id="mtn-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0" />
          </linearGradient>
          <mask id="mtn-mask">
            <rect width="400" height="96" fill="url(#mtn-fade)" />
          </mask>
        </defs>
        <g mask="url(#mtn-mask)" fill="none" stroke="hsl(var(--foreground))" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round">
          {/* Back range — softer, lower */}
          <path d="M0 78 L40 58 L70 68 L110 46 L150 64 L190 50 L230 66 L275 44 L320 62 L360 52 L400 70 L400 96 L0 96 Z" />
          {/* Front range — slightly sharper peaks */}
          <path d="M0 86 L25 72 L55 80 L90 64 L130 78 L170 60 L210 76 L250 58 L295 74 L335 66 L375 80 L400 72 L400 96 L0 96 Z" />
        </g>
      </svg>
    </div>
  );
};

export default MountainBackdrop;
