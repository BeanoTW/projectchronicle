import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

/**
 * Silent tutorial video shown on the Home screen.
 * - Muted autoplay + loop, calm presentation
 * - Tap to toggle play/pause
 * - Respects prefers-reduced-motion (no autoplay, poster shown until tapped)
 */
const DemoVideo = () => {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion && ref.current) {
      ref.current.pause();
      setPaused(true);
    }
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
    setShowOverlay(true);
    window.setTimeout(() => setShowOverlay(false), 900);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={paused ? 'Play demonstration' : 'Pause demonstration'}
      className="relative w-full overflow-hidden rounded-2xl border border-border bg-card shadow-[0_2px_10px_-4px_hsl(var(--foreground)/0.05)] aspect-[9/16] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <video
        ref={ref}
        src="/chronicle-demo.mp4"
        poster="/chronicle-demo-poster.jpg"
        muted
        autoPlay
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
          paused || showOverlay ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/55 backdrop-blur-sm">
          {paused ? (
            <Play className="h-5 w-5 text-white ml-0.5" strokeWidth={2} />
          ) : (
            <Pause className="h-5 w-5 text-white" strokeWidth={2} />
          )}
        </span>
      </span>
    </button>
  );
};

export default DemoVideo;
