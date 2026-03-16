import { useState } from 'react';
import { Paperclip, Image, FileText, Music, Mail } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { mockEvidence, mockIncidents } from '@/data/mockData';
import EmptyState from '@/components/chronicle/EmptyState';
import type { EvidenceType } from '@/types/incident';

const filterTabs: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Photos', value: 'Photo' },
  { label: 'Screenshots', value: 'Screenshot' },
  { label: 'Documents', value: 'Document' },
  { label: 'Audio', value: 'Audio' },
  { label: 'Emails', value: 'Email' },
];

const typeIcons: Record<EvidenceType, typeof FileText> = {
  Photo: Image,
  Screenshot: Image,
  Document: FileText,
  Audio: Music,
  Email: Mail,
  Other: FileText,
};

const EvidenceScreen = () => {
  const [activeFilter, setActiveFilter] = useState('all');

  const filtered = activeFilter === 'all'
    ? mockEvidence
    : mockEvidence.filter(e => e.file_type === activeFilter);

  if (mockEvidence.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="px-4 pt-6"><h1 className="text-2xl font-bold text-foreground">Evidence</h1></div>
        <EmptyState
          icon={<Paperclip className="h-12 w-12" />}
          heading="No evidence yet"
          body="No evidence uploaded yet. Open an incident to attach files."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-foreground">Evidence</h1>
      </div>

      {/* Filter Tabs */}
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
          const Icon = typeIcons[ev.file_type] || FileText;
          const linkedIncident = mockIncidents.find(i => i.incident_id === ev.incident_id);
          return (
            <div key={ev.file_id} className="bg-card border border-border rounded-lg p-4 flex gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{ev.file_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ev.file_type} · {format(parseISO(ev.upload_date), 'dd MMM yyyy')}
                </p>
                {linkedIncident ? (
                  <p className="text-xs text-primary mt-0.5 truncate">
                    Linked: {linkedIncident.title}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">Unlinked</p>
                )}
                {ev.description && <p className="text-xs text-body mt-1">{ev.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EvidenceScreen;
