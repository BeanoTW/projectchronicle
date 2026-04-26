import valleyImg from "@/assets/valley-backdrop.jpg";

/**
 * Global decorative header backdrop — single shared implementation.
 *
 * Used identically across every screen via PageHeader. There are NO
 * per-screen overrides: the same height, opacity, fade and placement
 * apply everywhere so the app shell reads as one coherent identity layer.
 *
 * - Fixed height (130px) — sits behind title/subtitle only
 * - Fades fully into the page background well before the first content block
 * - Pointer-events: none, aria-hidden
 */
const MountainBackdrop = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden"
      style={{ height: 130 }}
    >
      <img
        src={valleyImg}
        alt=""
        width={1920}
        height={1088}
        loading="lazy"
        draggable={false}
        className="absolute inset-x-0 top-0 w-full h-full object-cover object-bottom"
        style={{ opacity: 0.6 }}
      />
      {/* Vertical fade — completes before the bottom of the layer so
          content beneath always sits on a clean background. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--background) / 0.05) 0%, hsl(var(--background) / 0.35) 55%, hsl(var(--background) / 0.95) 85%, hsl(var(--background)) 100%)",
        }}
      />
    </div>
  );
};

export default MountainBackdrop;
