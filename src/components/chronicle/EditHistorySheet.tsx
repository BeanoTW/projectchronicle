import { format, parseISO } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { EditHistoryEntry } from '@/hooks/useEditHistory';

interface EditHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: EditHistoryEntry[];
}

function formatFieldName(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatAction(entry: EditHistoryEntry): string {
  if (entry.field_changed === 'incident_recorded') return 'Record created';
  if (entry.field_changed === 'evidence_attached') return `Attachment added: ${entry.new_value ?? ''}`;
  if (entry.field_changed === 'evidence_deleted') return `Attachment removed: ${entry.old_value ?? ''}`;
  if (entry.field_changed === 'record_voided') return 'Record voided';
  if (entry.field_changed === 'record_locked') return 'Record locked';
  if (entry.old_value && entry.new_value) {
    return `${formatFieldName(entry.field_changed)}: ${entry.old_value} → ${entry.new_value}`;
  }
  if (entry.new_value) return `${formatFieldName(entry.field_changed)} added`;
  return `${formatFieldName(entry.field_changed)} updated`;
}

function sourceLabel(src: string | null | undefined): string {
  switch (src) {
    case 'user': return 'User';
    case 'transcription': return 'Transcription';
    case 'system': return 'System';
    case 'sync': return 'Sync';
    default: return src ?? '—';
  }
}

const EditHistorySheet = ({ open, onOpenChange, entries }: EditHistorySheetProps) => {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl border-t border-border max-h-[80vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-[15px] font-semibold text-foreground">Edit history</SheetTitle>
          <p className="text-[12px] text-muted-foreground">
            {sorted.length === 0
              ? 'No changes recorded.'
              : `${sorted.length} entr${sorted.length === 1 ? 'y' : 'ies'} · append-only`}
          </p>
        </SheetHeader>

        {sorted.length === 0 ? (
          <p className="mt-4 text-[12px] text-muted-foreground">
            This record has not been modified since it was created.
          </p>
        ) : (
          <ol className="mt-4 space-y-2.5">
            {sorted.map(entry => {
              const date = parseISO(entry.changed_at);
              return (
                <li key={entry.id} className="text-[12px] text-foreground border-l-2 border-border pl-3">
                  <p className="text-[11px] text-muted-foreground">
                    {format(date, 'd MMM yyyy')} · {format(date, 'HH:mm')} · {sourceLabel(entry.edit_source)}
                  </p>
                  <p className="mt-0.5 leading-relaxed">{formatAction(entry)}</p>
                </li>
              );
            })}
          </ol>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default EditHistorySheet;
