import PublicPageLayout from '@/components/chronicle/PublicPageLayout';
import { Link } from 'react-router-dom';

const BASE = 'https://projectchronicle.app';

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    { '@type': 'ListItem', position: 2, name: 'How it works', item: `${BASE}/how-it-works` },
  ],
};

const howTo = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How Project Chronicle works',
  description:
    'A walkthrough of recording, organising and exporting a structured, chronological workplace record in Project Chronicle.',
  step: [
    { '@type': 'HowToStep', name: 'Record', text: 'Capture an incident or daily record in your own words.' },
    { '@type': 'HowToStep', name: 'Preserve', text: 'Original wording is preserved exactly as entered; entries are append-only.' },
    { '@type': 'HowToStep', name: 'Organise', text: 'Entries sit in chronological order across the Timeline and Calendar.' },
    { '@type': 'HowToStep', name: 'Review', text: 'Open any record to see exactly when it happened and when it was recorded.' },
    { '@type': 'HowToStep', name: 'Export', text: 'Produce a single structured document when you need to share a record.' },
  ],
};

/**
 * Neutral visual placeholder — used in lieu of product screenshots so this
 * page can ship without exposing any real data. Designed to be replaced
 * later with safe, anonymised UI examples.
 */
const ScreenPlaceholder = ({ label, lines = 5 }: { label: string; lines?: number }) => (
  <figure className="not-prose my-6 rounded-2xl border border-border/70 bg-card/60 px-5 py-5 shadow-[0_4px_18px_-12px_hsl(220_25%_15%/0.18)]">
    <div className="flex items-center justify-between border-b border-border/60 pb-2.5 mb-3">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
        {label}
      </span>
      <span className="flex gap-1.5" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
      </span>
    </div>
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-2 rounded-full bg-gradient-to-r from-muted-foreground/15 to-transparent"
          style={{ width: `${88 - i * 7}%` }}
        />
      ))}
    </div>
    <figcaption className="mt-3 text-[11px] text-muted-foreground/70 leading-relaxed">
      Illustrative example. No real records are shown.
    </figcaption>
  </figure>
);

const HowItWorksPage = () => (
  <PublicPageLayout
    title="How Project Chronicle works — recording, preserving and exporting a workplace record"
    description="A calm walkthrough of how Project Chronicle records, preserves and exports a structured, chronological workplace record."
    path="/how-it-works"
    jsonLd={[howTo, breadcrumb]}
  >
    <h1 style={{ fontFamily: 'Urbanist, system-ui, sans-serif' }}>How Chronicle works</h1>
    <p>
      Chronicle is a structured, chronological workplace record. It is built around five things:
      recording an event in your own words, preserving that original wording, organising entries in
      date order, reviewing them clearly, and exporting them when needed.
    </p>

    <h2>1. Record an incident or daily note</h2>
    <p>
      Open Chronicle and start a new record. You can type or dictate. Two modes are available — an
      incident record for a specific event, and a daily record for routine work notes — but both
      live in the same chronology.
    </p>
    <ScreenPlaceholder label="Record" lines={4} />

    <h2>2. Original wording is preserved</h2>
    <p>
      Once saved, the original wording of an entry is preserved exactly as you wrote it. Adding a
      follow-up later does not overwrite the earlier entry — updates are appended alongside, so the
      record reads as it was first written.
    </p>

    <h2>3. Entries are organised chronologically</h2>
    <p>
      Every entry is timestamped with both the date the event happened and the date it was recorded.
      The Timeline and Calendar views show entries in date order, so the sequence of events is
      visible at a glance.
    </p>
    <ScreenPlaceholder label="Timeline" lines={6} />

    <h2>4. Review a clear, dated record</h2>
    <p>
      Each record shows what was entered, when, and any later additions. Chronicle does not
      characterise or interpret what you have written. It records what you wrote, in the order you
      wrote it.
    </p>

    <h2>5. Export when you need to</h2>
    <p>
      When you are ready to share a record — with HR, a union representative, an adviser or a
      solicitor — Chronicle produces a single, structured document. The export reflects the
      chronological record, with dates and original wording intact.
    </p>
    <ScreenPlaceholder label="Export" lines={5} />

    <h2>What Chronicle does not do</h2>
    <ul>
      <li>Chronicle does not give legal advice.</li>
      <li>Chronicle does not decide whether something is or is not a grievance, harassment, bullying or discrimination.</li>
      <li>Chronicle does not rewrite, summarise or characterise your entries.</li>
      <li>Chronicle does not contact your employer on your behalf.</li>
    </ul>

    <h2>Privacy</h2>
    <p>
      Records are stored on your device by default. Optional cloud sync is available and is
      controlled by you. For a full explanation see <Link to="/privacy">how your data is handled</Link>.
    </p>

    <h2>Common starting points</h2>
    <ul>
      <li><Link to="/guides/how-to-document-workplace-incidents">How to document workplace incidents</Link></li>
      <li><Link to="/guides/keeping-a-work-diary">Keeping a work diary</Link></li>
      <li><Link to="/guides/preparing-a-timeline-for-a-grievance">Preparing a timeline for a grievance</Link></li>
    </ul>
  </PublicPageLayout>
);

export default HowItWorksPage;
