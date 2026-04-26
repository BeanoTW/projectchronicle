import valleyImg from "@/assets/valley-backdrop.jpg";

/**
 * Global decorative header backdrop.
 * - Default height 140px — sits behind title/subtitle only
 * - Never overlaps interactive UI (buttons, cards, grids)
 * - Smooth vertical fade completes before content begins
 * - Single instance per screen, rendered via PageHeader
 * - Pointer-events: none
 * - `height` may be overridden per-screen when the header has extra controls
 *   (e.g. Timeline) so the backdrop remains constrained to title only.
 */
const MountainBackdrop = ({ height = 140 }: { height?: number }) => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden"
      style={{ height }}
    >
      <img
        src={valleyImg}
        alt=""
        width={1920}
        height={1088}
        loading="lazy"
        draggable={false}
        className="absolute inset-x-0 top-0 w-full h-full object-cover object-bottom"
        style={{ opacity: 0.55 }}
      />
      {/* Fade fully into background before UI begins */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--background) / 0.1) 0%, hsl(var(--background) / 0.35) 50%, hsl(var(--background) / 0.9) 80%, hsl(var(--background)) 95%)",
        }}
      />
    </div>
  );
};

export default MountainBackdrop;
