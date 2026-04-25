import valleyImg from "@/assets/valley-backdrop.jpg";

/**
 * Soft, realistic layered-valley backdrop used behind page headers.
 * - Anchored to the top (header area only)
 * - Low contrast / low opacity — must not compete with UI
 * - Smooth vertical fade into the page background colour at the bottom
 * - Pointer-events: none (never blocks taps)
 * - Parent must be `relative`
 */
const MountainBackdrop = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden"
      style={{ height: 280 }}
    >
      {/* Simplified layered valley illustration */}
      <img
        src={valleyImg}
        alt=""
        width={1920}
        height={1088}
        loading="lazy"
        draggable={false}
        className="absolute inset-x-0 top-0 w-full h-full object-cover object-bottom"
        style={{ opacity: 0.9 }}
      />
      {/* Soft atmospheric fade into UI */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--background) / 0.15) 0%, hsl(var(--background) / 0) 30%, hsl(var(--background) / 0.4) 70%, hsl(var(--background)) 100%)",
        }}
      />
    </div>
  );
};

export default MountainBackdrop;
