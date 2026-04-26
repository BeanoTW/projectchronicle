/**
 * Subtle mountain range backdrop used behind page headers.
 * - Sits behind all UI (z-0, parent should be relative)
 * - Pointer-events: none (never blocks taps)
 * - Soft neutral silhouette, fades into background at the bottom
 */
const MountainBackdrop = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden"
      style={{ height: 120 }}
    >
      <svg
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="mtn-fade-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.085" />
            <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mtn-fade-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.12" />
            <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Back range — softer, lower */}
        <path
          d="M0 88 L40 62 L70 74 L110 48 L150 70 L190 54 L230 72 L275 46 L320 68 L360 56 L400 78 L400 120 L0 120 Z"
          fill="url(#mtn-fade-back)"
        />
        {/* Front range — slightly sharper peaks */}
        <path
          d="M0 102 L25 84 L55 94 L90 72 L130 90 L170 66 L210 88 L250 64 L295 86 L335 76 L375 92 L400 84 L400 120 L0 120 Z"
          fill="url(#mtn-fade-front)"
        />
      </svg>
    </div>
  );
};

export default MountainBackdrop;
