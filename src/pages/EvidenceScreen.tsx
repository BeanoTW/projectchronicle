import { useState, useRef } from 'react';
import { Paperclip, Image, FileText, Music, Mail, Plus, Link2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useEvidence, useUploadEvidence } from '@/hooks/useEvidence';
import { useIncidents } from '@/hooks/useIncidents';
import EmptyState from '@/components/chronicle/EmptyState';
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

  const filtered = activeFilter === 'all'
    ? allEvidence
    : allEvidence.filter(e => e.file_type === activeFilter);

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
      const { error } = await supabase
        .from('evidence_files')
        .update({ incident_id: incidentId })
        .eq('id', evidenceId);
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
    return <div className="min-h-screen bg-background pb-20 flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (allEvidence.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="px-4 pt-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Evidence</h1>
          <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md cursor-pointer">
            <Plus className="h-3 w-3" /> Upload
            <input type="file" className="hidden" onChange={handleUpload} />
          </label>
        </div>
        <EmptyState
          icon={<Paperclip className="h-12 w-12" />}
          heading="No evidence yet"
          body="Upload evidence files to attach to your incidents."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Evidence</h1>
        <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md cursor-pointer">
          <Plus className="h-3 w-3" /> Upload
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleUpload} />
        </label>
      </div>

      {unlinkedCount > 0 && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-severity-serious/10 text-severity-serious text-xs font-medium">
          {unlinkedCount} file{unlinkedCount > 1 ? 's' : ''} not yet linked to an incident
        </div>
      )}

      <div className="px-4 pb-3 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {filterTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeFilter === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-3">
        {filtered.map(ev => {
          const Icon = typeIcons[ev.file_type || 'Other'] || FileText;
          const linkedIncident = incidents.find(i => i.id === ev.incident_id);
          const isLinking = linkingId === ev.id;

          return (
            <div key={ev.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                      E{String(ev.evidence_ref_number || '?').padStart(2, '0')}
                    </span>
                    <p className="text-sm font-medium text-foreground truncate">{ev.file_name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ev.file_type || 'File'} · {format(parseISO(ev.upload_date), 'dd MMM yyyy')}
                  </p>
                  {linkedIncident ? (
                    <p className="text-xs text-primary mt-0.5 truncate">
                      Linked: {linkedIncident.title || 'Untitled'}
                    </p>
                  ) : (
                    <div className="mt-1">
                      <p className="text-xs text-severity-serious font-medium">Not yet linked to an incident</p>
                      {!isLinking ? (
                        <button
                          onClick={() => setLinkingId(ev.id)}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-primary font-medium"
                        >
                          <Link2 className="h-3 w-3" /> Link to incident
                        </button>
                      ) : (
                        <div className="mt-1.5 flex gap-2 items-center">
                          <Select value={selectedIncidentId} onValueChange={setSelectedIncidentId}>
                            <SelectTrigger className="bg-card text-xs h-8 flex-1">
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
                          <button
                            onClick={() => selectedIncidentId && handleLinkEvidence(ev.id, selectedIncidentId)}
                            disabled={!selectedIncidentId}
                            className="text-xs text-primary font-medium disabled:opacity-40"
                          >
                            Link
                          </button>
                          <button
                            onClick={() => { setLinkingId(null); setSelectedIncidentId(''); }}
                            className="text-xs text-muted-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {ev.description && <p className="text-xs text-body mt-1">{ev.description}</p>}
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
