import { FileAudio } from 'lucide-react';

interface TranscriptProvenanceChipProps {
  sourceAttachmentId: string | null | undefined;
  sourcePresent: boolean;
  onClick?: () => void;
}

/**
 * Neutral chip surfacing transcript provenance.
 * - "Transcript · source attachment [short ID]" when source still exists
 * - "Transcript source file removed" when source has been deleted
 */
const TranscriptProvenanceChip = ({
  sourceAttachmentId,
  sourcePresent,
  onClick,
}: TranscriptProvenanceChipProps) => {
  if (!sourceAttachmentId && !sourcePresent) {
    // Source pointer was cleared (file deleted)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground/70 text-[11px] font-medium">
        <FileAudio className="h-3 w-3" strokeWidth={1.5} />
        Transcript source file removed
      </span>
    );
  }

  if (!sourceAttachmentId) return null;

  const shortId = sourceAttachmentId.slice(0, 8);
  const Inner = (
    <>
      <FileAudio className="h-3 w-3" strokeWidth={1.5} />
      Transcript · source attachment {shortId}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors text-[11px] font-medium"
      >
        {Inner}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground text-[11px] font-medium">
      {Inner}
    </span>
  );
};

export default TranscriptProvenanceChip;
