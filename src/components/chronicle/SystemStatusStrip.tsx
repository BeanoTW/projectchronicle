// Low-profile, factual system status strip.
// Surfaces neutral, technical statements about how the app handles data.
// No reassurance language, no marketing tone — system metadata only.
import { useEffect, useState } from "react";
import { Database } from "lucide-react";

const STATEMENTS = [
  "Local-first storage (IndexedDB)",
  "Append-only records (no overwrite)",
  "Original input preserved",
  "Dual timestamps: recorded_at / incident_date",
  "Offline capture supported",
  "Sync does not modify original entries",
];

interface SystemStatusStripProps {
  /** Distance from bottom of viewport in px (sits above the nav bar). */
  bottomOffset?: number;
}

const SystemStatusStrip = ({ bottomOffset = 76 }: SystemStatusStripProps) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % STATEMENTS.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="fixed left-1/2 z-40 -translate-x-1/2 pointer-events-none"
      style={{
        bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
        width: "calc(100% - 64px)",
        maxWidth: "560px",
      }}
      aria-hidden="true"
    >
      <div className="flex items-center justify-center gap-1.5">
        <Database
          className="h-3 w-3 text-muted-foreground/50 flex-shrink-0"
          strokeWidth={1.75}
        />
        <span
          key={index}
          className="text-[10.5px] tracking-[0.01em] text-muted-foreground/60 font-normal truncate transition-opacity duration-500"
        >
          {STATEMENTS[index]}
        </span>
      </div>
    </div>
  );
};

export default SystemStatusStrip;
