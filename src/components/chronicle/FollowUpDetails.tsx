import { useState } from 'react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { Plus, User, Quote, AlertTriangle, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type { FollowUpNote } from '@/hooks/useFollowUpNotes';

const NOTE_TYPES = [
  { value: 'Witness', label: 'Person involved', icon: User, placeholder: 'Name of the individual...' },
  { value: 'Exact wording', label: 'Exact wording', icon: Quote, placeholder: 'What was said, as closely as you remember...' },
  { value: 'Impact', label: 'Impact', icon: AlertTriangle, placeholder: 'How this affected you or your situation...' },
  { value: 'Update', label: 'Additional detail', icon: Plus, placeholder: 'Any other relevant information...' },
] as const;

interface FollowUpDetailsProps {
  notes: FollowUpNote[];
  originalCreatedAt: string;
  onAddNote: (note: { note_text: string; note_type: string }) => Promise<void>;
  onUploadAttachment?: () => void;
}

const FollowUpDetails = ({ notes, originalCreatedAt, onAddNote, onUploadAttachment }: FollowUpDetailsProps) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [witnessNote, setWitnessNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim() || !selectedType) return;
    setSaving(true);
    const fullContent = selectedType === 'Witness' && witnessNote.trim()
      ? `${content.trim()} — ${witnessNote.trim()}`
      : content.trim();
    await onAddNote({ note_text: fullContent, note_type: selectedType });
    setContent('');
    setWitnessNote('');
    setSelectedType(null);
    setShowForm(false);
    setSaving(false);
  };

  const handleCancel = () => {
    setContent('');
    setWitnessNote('');
    setSelectedType(null);
    setShowForm(false);
  };

  const getAddedLabel = (noteCreatedAt: string) => {
    const daysDiff = differenceInCalendarDays(parseISO(noteCreatedAt), parseISO(originalCreatedAt));
    const dateStr = format(parseISO(noteCreatedAt), 'dd MMM yyyy');
    if (daysDiff === 0) return `Added ${dateStr}`;
    return `Added ${dateStr} · Added after the original record`;
  };

  const typeConfig = NOTE_TYPES.find(t => t.value === selectedType);

  const getTypeIcon = (type: string) => {
    const config = NOTE_TYPES.find(t => t.value === type);
    if (!config) return Plus;
    return config.icon;
  };

  const getTypeLabel = (type: string) => {
    const config = NOTE_TYPES.find(t => t.value === type);
    return config?.label || type;
  };

  return (
    <div>
      <p className="section-group-title">Follow-up details</p>
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-[11px] text-muted-foreground mb-3">
          Added after the original record. These do not modify the original entry.
        </p>

        {notes.length > 0 && (
          <div className="space-y-2.5 mb-4">
            {notes.map(note => {
              const Icon = getTypeIcon(note.note_type);
              return (
                <div key={note.id} className="relative pl-6">
                  <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                    <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-medium text-primary/80">{getTypeLabel(note.note_type)}</span>
                      <span className="text-[10px] text-muted-foreground/50">·</span>
                      <span className="text-[10px] text-muted-foreground/60">{getAddedLabel(note.created_at)}</span>
                    </div>
                    <p className="text-[13px] text-foreground leading-relaxed">{note.note_text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {notes.length === 0 && !showForm && (
          <p className="text-[13px] text-muted-foreground mb-3">No follow-up details added yet.</p>
        )}

        {showForm ? (
          <div className="space-y-3">
            {!selectedType ? (
              <div className="space-y-1.5">
                <p className="text-[12px] font-medium text-foreground mb-2">What would you like to add?</p>
                <div className="grid grid-cols-2 gap-2">
                  {NOTE_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => setSelectedType(type.value)}
                      className="flex items-center gap-2 p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-left"
                    >
                      <type.icon className="h-4 w-4 text-primary" />
                      <span className="text-[13px] font-medium text-foreground">{type.label}</span>
                    </button>
                  ))}
                  {onUploadAttachment && (
                    <button
                      onClick={() => { handleCancel(); onUploadAttachment(); }}
                      className="flex items-center gap-2 p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-left"
                    >
                      <Paperclip className="h-4 w-4 text-primary" />
                      <span className="text-[13px] font-medium text-foreground">Attachment</span>
                    </button>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={handleCancel} className="text-[12px] text-muted-foreground mt-1">
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {typeConfig && <typeConfig.icon className="h-4 w-4 text-primary" />}
                    <span className="text-[13px] font-medium text-foreground">{typeConfig?.label}</span>
                  </div>
                  <button onClick={() => setSelectedType(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {selectedType === 'Witness' ? (
                  <>
                    <Input
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder="Name of the individual"
                      className="text-[13px] bg-background"
                    />
                    <Input
                      value={witnessNote}
                      onChange={e => setWitnessNote(e.target.value)}
                      placeholder="Optional: e.g. Present at the time"
                      className="text-[13px] bg-background"
                    />
                  </>
                ) : (
                  <Textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder={typeConfig?.placeholder}
                    className="min-h-[80px] bg-background text-[13px]"
                  />
                )}

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={!content.trim() || saving} className="text-[13px]">
                    {saving ? 'Saving...' : 'Add'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancel} className="text-[13px]">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-[13px] border-primary/20 text-primary rounded-lg"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add follow-up details
          </Button>
        )}
      </div>
    </div>
  );
};

export default FollowUpDetails;
