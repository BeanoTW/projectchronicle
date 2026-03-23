import { useState, useRef } from 'react';
import { Paperclip, Image, FileText, Music, Mail, Plus, Link2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useEvidence, useUploadEvidence } from '@/hooks/useEvidence';
import { useIncidents } from '@/hooks/useIncidents';
import EmptyState from '@/components/chronicle/EmptyState';
import PageHeader from '@/components/chronicle/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

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
          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground text-[12px] font-medium rounded-lg cursor-pointer shadow-[var(--shadow-card)] active:scale-[0.97] transition-transform">
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
      <div className="px-5 pt-8 pb-3 flex items-center justify-between">
        <h1>Evidence</h1>
        <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground text-[12px] font-medium rounded-lg cursor-pointer shadow-[var(--shadow-card)] active:scale-[0.97] transition-transform">
          <Plus className="h-3.5 w-3.5" /> Upload
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleUpload} />
        </label>
      </div>

      {unlinkedCount > 0 && (
        <div className="mx-5 mb-4 px-4 py-2.5 rounded-lg bg-warm-accent-light border border-warm-accent/15 text-warm-accent-foreground text-[12px] font-medium">
          {unlinkedCount} file{unlinkedCount > 1 ? 's' : ''} not yet linked to an incident
        </div>
      )}

      <div className="px-5 pb-3 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {filterTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
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

      <div className="mx-5 bg-card border border-border rounded-xl overflow-hidden">
        {filtered.map((ev, i) => {
          const Icon = typeIcons[ev.file_type || 'Other'] || FileText;
          const linkedIncident = incidents.find(inc => inc.id === ev.incident_id);
          const isLinking = linkingId === ev.id;

          return (
            <div key={ev.id} className={`p-4 ${i > 0 ? 'border-t border-border' : ''}`}>
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-muted/50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/8 text-primary border border-primary/12">
                      E{String(ev.evidence_ref_number || '?').padStart(2, '0')}
                    </span>
                    <p className="text-[13px] font-medium text-foreground truncate">{ev.file_name}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    {ev.file_type || 'File'} · {format(parseISO(ev.upload_date), 'dd MMM yyyy')}
                  </p>
                  {linkedIncident ? (
                    <p className="text-[12px] text-primary mt-1 truncate">
                      Linked: {linkedIncident.title || 'Untitled'}
                    </p>
                  ) : (
                    <div className="mt-1.5">
                      <p className="text-[12px] text-warm-accent-foreground font-medium">Not yet linked</p>
                      {!isLinking ? (
                        <button onClick={() => setLinkingId(ev.id)} className="mt-1 inline-flex items-center gap-1 text-[12px] text-primary font-medium">
                          <Link2 className="h-3 w-3" /> Link to incident
                        </button>
                      ) : (
                        <div className="mt-2 flex gap-2 items-center">
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
