import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { EditHistoryEntry } from '@/types/incident';

interface EditHistoryPanelProps {
  entries: EditHistoryEntry[];
}

function formatAction(entry: EditHistoryEntry): string {
  if (entry.field_changed === 'incident_recorded') return 'Incident recorded';
  if (entry.field_changed === 'evidence_attached') return `Evidence attached: ${entry.new_value}`;
  if (entry.field_changed === 'record_locked') return 'Record locked';
  if (entry.old_value && entry.new_value) {
    return `${formatFieldName(entry.field_changed)} updated: ${entry.old_value} → ${entry.new_value}`;
  }
  if (entry.new_value) return `${formatFieldName(entry.field_changed)} added`;
  return `${formatFieldName(entry.field_changed)} updated`;
}

function formatFieldName(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

const EditHistoryPanel = ({ entries }: EditHistoryPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const sorted = [...entries].sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
      >
        <span>Edit History ({entries.length})</span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {isOpen && (
        <div className="border-t border-border p-3 space-y-2">
          {sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground">No changes recorded yet beyond the original entry.</p>
          ) : (
            sorted.map((entry) => {
              const date = parseISO(entry.changed_at);
              return (
                <div key={entry.history_id} className="text-xs text-body">
                  <span className="text-muted-foreground">
                    {format(date, 'dd MMM yyyy')} at {format(date, 'HH:mm')}
                  </span>
                  {' — '}
                  {formatAction(entry)}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default EditHistoryPanel;
