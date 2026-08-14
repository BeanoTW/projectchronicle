import { ExternalLink } from 'lucide-react';
import PageHeader from '@/components/chronicle/PageHeader';

const APP_SECTIONS = [
  { title: 'Record', primary: 'Capture events in your own words', secondary: 'This is the foundation of your record' },
  { title: 'Timeline', primary: 'View events in chronological order', secondary: 'See how situations develop over time' },
  { title: 'Calendar', primary: 'Navigate your record by date', secondary: 'Identify when activity occurred' },
  { title: 'Chronicle', primary: 'Bring chosen records together', secondary: 'The records you have selected, ready to generate a report from' },
  { title: 'Export', primary: 'Turn your record into a document for sharing', secondary: 'Includes dates, entries, and recorded details exactly as entered' },
];

const INTEGRITY_POINTS = [
  'Your entries are preserved as recorded',
  'Updates are added and do not overwrite original entries',
  'Each entry includes a date and recorded timestamp',
  'The system does not interpret or alter your account',
];

const SUPPORT_SERVICES = [
  { name: 'ACAS', description: 'Free advice on workplace rights and disputes', url: 'https://www.acas.org.uk' },
  { name: 'Citizens Advice', description: 'Free guidance on a wide range of issues', url: 'https://www.citizensadvice.org.uk' },
  { name: 'Victim Support', description: 'Free support for anyone affected by crime', url: 'https://www.victimsupport.org.uk' },
  { name: 'Police (non-emergency)', description: 'Report incidents online or call 101', url: 'https://www.police.uk' },
  { name: 'Samaritans', description: 'Confidential emotional support, 24/7', url: 'https://www.samaritans.org' },
  { name: 'NHS mental health', description: 'Find NHS mental health services near you', url: 'https://www.nhs.uk/mental-health/' },
  { name: 'Mind', description: 'Mental health information and support', url: 'https://www.mind.org.uk' },
];

const USEFULNESS_POINTS = [
  'Recalling events over time',
  'Discussing situations with others',
  'Providing a structured account',
];

const SupportScreen = () => {
  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader
        title="Support & Information"
        subtitle="How this system works and where to find help"
      />

      {/* Disclaimer */}
      <div className="mx-5 mb-7 px-4 py-2.5 rounded-lg border border-border">
        <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
          General information only — not legal advice.
        </p>
      </div>

      {/* Section 1 — Using your record */}
      <div className="mx-5 mb-8">
        <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
          Using your record
        </p>
        <p className="text-[13px] text-muted-foreground/70 leading-relaxed mb-4">
          This system helps you build a structured record over time. Each part of the app supports how that record is created and organised.
        </p>
        <div className="space-y-2">
          {APP_SECTIONS.map(s => (
            <div key={s.title} className="bg-card border border-border rounded-xl px-4 py-3">
              <h3 className="text-[14px] font-semibold text-foreground leading-snug">{s.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{s.primary}</p>
              <p className="text-[11px] text-muted-foreground/50 leading-relaxed mt-0.5">{s.secondary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2 — How your record works */}
      <div className="mx-5 mb-8">
        <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
          How your record works
        </p>
        <ul className="space-y-2 pl-1">
          {INTEGRITY_POINTS.map((point, i) => (
            <li key={i} className="text-[13px] text-foreground/80 leading-relaxed flex items-start gap-2">
              <span className="block w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0 mt-1.5" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      {/* Section 2b — Security & Privacy */}
      <div className="mx-5 mb-8">
        <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Security & Privacy
        </p>
        <div className="space-y-3 pl-1">
          {[
            { title: 'App lock', body: 'Requires a PIN or biometric to open the app. Locks automatically after inactivity or when returning from the background.' },
            { title: 'Privacy Shield', body: 'Masks names, locations, and attachments.' },
            { title: 'Attachment visibility', body: 'Attachments may be hidden while Privacy Shield is active. Unlock with your PIN to view.' },
            { title: 'Attachment integrity', body: 'Files can include a fingerprint and timestamps to help identify them later.' },
            { title: 'Scope', body: 'These features control how information is displayed and accessed. They do not alter or remove saved records or exported data.' },
          ].map(item => (
            <div key={item.title}>
              <h3 className="text-[13px] font-semibold text-foreground leading-snug">{item.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3 — External support services */}
      <div className="mx-5 mb-8">
        <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
          External support services
        </p>
        <p className="text-[13px] text-muted-foreground/70 leading-relaxed mb-4">
          Support services are available if you choose to access them.
        </p>
        <div className="space-y-2">
          {SUPPORT_SERVICES.map(s => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 group"
            >
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-foreground leading-snug">{s.name}</h3>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0 ml-3 group-hover:text-primary transition-colors" />
            </a>
          ))}
        </div>
      </div>

      {/* Section 4 — When this record may be useful */}
      <div className="mx-5 mb-8">
        <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
          When this record may be useful
        </p>
        <p className="text-[13px] text-muted-foreground/70 leading-relaxed mb-3">
          This record may be useful when:
        </p>
        <ul className="space-y-2 pl-1">
          {USEFULNESS_POINTS.map((point, i) => (
            <li key={i} className="text-[13px] text-foreground/80 leading-relaxed flex items-start gap-2">
              <span className="block w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0 mt-1.5" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SupportScreen;
