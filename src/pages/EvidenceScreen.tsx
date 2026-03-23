import { useState, useRef } from 'react';
import { Paperclip, Image, FileText, Music, Mail, Plus, Link2, ArrowRight, Eye, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useEvidence, useUploadEvidence } from '@/hooks/useEvidence';
import { useIncidents } from '@/hooks/useIncidents';
import EmptyState from '@/components/chronicle/EmptyState';
import PageHeader from '@/components/chronicle/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import EvidencePreview from '@/components/chronicle/EvidencePreview';

const filterTabs = [
  { label: 'All', value: 'all' },
  { label: 'Photos', value: 'Photo' },
  { label: 'Screenshots', value: 'Screenshot' },
  { label: 'Documents', value: 'Document' },
  { label: 'Audio', value: 'Audio' },
  { label: 'Emails', value: 'Email' },
];

const typeIcons: Record<string, typeof FileText> = {
  Photo: Image,
  Screenshot: Image,
  Document: FileText,
  Audio: Music,
  Email: Mail,
  Other: FileText,
};

const typeAccentClass: Record<string, string> = {
  Photo: 'evidence-accent-photo',
  Screenshot: 'evidence-accent-photo',
  Document: 'evidence-accent-document',
  Audio: 'evidence-accent-audio',
  Email: 'evidence-accent-email',
};

const typeTintBg: Record<string, string> = {
  Photo: 'bg-primary/[0.06]',
  Screenshot: 'bg-primary/[0.06]',
  Document: 'bg-info-light',
  Audio: 'bg-warm-accent-light',
  Email: 'bg-rep',
};

const EvidenceScreen = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const { data: allEvidence = [], isLoading, refetch } = useEvidence();
  const { data: incidents = [] } = useIncidents();
  const uploadEvidence = useUploadEvidence();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = activeFilter === 'all' ? allEvidence : allEvidence.filter(e => e.file_type === activeFilter);
  const unlinkedCount = allEvidence.filter(e => !e.incident_id).length;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadEvidence.mutateAsync({ file });
      toast({ title: 'Evidence uploaded', description: 'Link it to an incident to strengthen your records.' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    }
  };

  const handleLinkEvidence = async (evidenceId: string, incidentId: string) => {
    try {
      const { error } = await supabase.from('evidence_files').update({ incident_id: incidentId }).eq('id', evidenceId);
      if (error) throw error;
      toast({ title: 'Evidence linked to incident' });
      setLinkingId(null);
      setSelectedIncidentId('');
      refetch();
    } catch {
      toast({ title: 'Failed to link', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-background pb-24 flex items-center justify-center"><p className="text-muted-foreground text-[14px]">Loading...</p></div>;
  }

  if (allEvidence.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-5 pt-8 flex items-center justify-between">
          <h1>Evidence</h1>
          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground text-[12px] font-medium rounded-lg cursor-pointer shadow-[var(--shadow-elevated)] active:scale-[0.97] transition-transform">
            <Plus className="h-3.5 w-3.5" /> Upload
            <input type="file" className="hidden" onChange={handleUpload} />
          </label>
        </div>
        <EmptyState
          icon={<Paperclip className="h-10 w-10" />}
          heading="No evidence added yet"
          body="You can upload screenshots, photos, or documents — these files can be linked to incidents to support your records."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="Evidence">
        <label className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-[12px] font-semibold rounded-lg cursor-pointer shadow-[var(--shadow-elevated)] active:scale-[0.97] transition-all duration-150 hover:shadow-[var(--shadow-card-hover)]">
          <Plus className="h-3.5 w-3.5" /> Upload
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleUpload} />
        </label>
      </PageHeader>

      {unlinkedCount > 0 && (
        <div className="mx-5 mb-4 px-4 py-2.5 rounded-lg bg-warm-accent-light border border-warm-accent/15 text-warm-accent-foreground text-[12px] font-medium">
          {unlinkedCount} item{unlinkedCount > 1 ? 's' : ''} awaiting connection
        </div>
      )}

      <div className="px-5 pb-3 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {filterTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`px-3 py-1.5 rounded text-[12px] font-medium transition-all duration-150 ${
                activeFilter === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-5 space-y-2.5">
        {filtered.map((ev) => {
          const Icon = typeIcons[ev.file_type || 'Other'] || FileText;
          const linkedIncident = incidents.find(inc => inc.id === ev.incident_id);
          const isLinking = linkingId === ev.id;
          const accentClass = typeAccentClass[ev.file_type || ''] || 'evidence-accent-default';
          const tintBg = typeTintBg[ev.file_type || ''] || '';
          const iconTint = ev.file_type === 'Photo' || ev.file_type === 'Screenshot'
            ? 'text-primary/70' : ev.file_type === 'Audio'
            ? 'text-warm-accent' : ev.file_type === 'Email'
            ? 'text-rep-foreground' : 'text-muted-foreground';

          return (
            <div
              key={ev.id}
              className={`rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] ${accentClass}`}
            >
              <div className="flex gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tintBg || 'bg-muted/50'}`}>
                  <Icon className={`h-4 w-4 ${iconTint}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/8 text-primary border border-primary/12">
                        E{String(ev.evidence_ref_number || '?').padStart(2, '0')}
                      </span>
                      <p className="text-[13px] font-medium text-foreground truncate">{ev.file_name}</p>
                    </div>
                    {linkedIncident ? (
                      <Badge variant="default" className="text-[10px] px-2 py-0.5 bg-primary/15 text-primary border-primary/20 hover:bg-primary/15 flex-shrink-0">
                        Linked
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-warm-accent-foreground border-warm-accent/25 bg-warm-accent-light flex-shrink-0">
                        Unlinked
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    {ev.file_type || 'File'} · {format(parseISO(ev.upload_date), 'dd MMM yyyy')}
                  </p>
                  {linkedIncident ? (
                    <p className="text-[12px] text-primary mt-1.5 truncate">
                      → {linkedIncident.title || 'Untitled'}
                    </p>
                  ) : (
                    <div className="mt-2">
                      {!isLinking ? (
                        <button
                          onClick={() => setLinkingId(ev.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-primary bg-primary/[0.06] border border-primary/12 hover:bg-primary/10 active:scale-[0.97] transition-all duration-150"
                        >
                          <Link2 className="h-3 w-3" />
                          Link to incident
                          <ArrowRight className="h-3 w-3 opacity-50" />
                        </button>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <Select value={selectedIncidentId} onValueChange={setSelectedIncidentId}>
                            <SelectTrigger className="bg-card text-[12px] h-8 flex-1 rounded-lg">
                              <SelectValue placeholder="Select incident" />
                            </SelectTrigger>
                            <SelectContent>
                              {incidents.slice(0, 20).map(inc => (
                                <SelectItem key={inc.id} value={inc.id}>
                                  {inc.title || format(parseISO(inc.incident_date), 'dd MMM yyyy')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <button onClick={() => selectedIncidentId && handleLinkEvidence(ev.id, selectedIncidentId)} disabled={!selectedIncidentId} className="text-[12px] text-primary font-medium disabled:opacity-40">Link</button>
                          <button onClick={() => { setLinkingId(null); setSelectedIncidentId(''); }} className="text-[12px] text-muted-foreground">Cancel</button>
                        </div>
                      )}
                    </div>
                  )}
                  {ev.description && <p className="text-[12px] text-body mt-1.5 leading-relaxed">{ev.description}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EvidenceScreen;
