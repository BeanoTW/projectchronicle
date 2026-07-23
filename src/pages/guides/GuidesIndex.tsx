import { Link } from 'react-router-dom';
import PublicPageLayout from '@/components/chronicle/PublicPageLayout';

export const GUIDES = [
  {
    slug: 'how-to-document-workplace-incidents',
    eyebrow: 'Documenting',
    title: 'How to document workplace incidents',
    description: 'A practical, neutral guide to recording workplace incidents clearly and chronologically.',
  },
  {
    slug: 'how-to-prove-workplace-bullying',
    eyebrow: 'Bullying',
    title: 'How to prove workplace bullying',
    description: 'What contemporaneous notes, timelines and supporting material typically look like for bullying concerns.',
  },
  {
    slug: 'preparing-a-timeline-for-a-grievance',
    eyebrow: 'Grievance',
    title: 'Preparing a timeline for a grievance',
    description: 'How a clear chronological timeline can help when raising a workplace grievance.',
  },
  {
    slug: 'evidence-for-an-employment-tribunal',
    eyebrow: 'Tribunal',
    title: 'Evidence for an employment tribunal',
    description: 'A neutral overview of how records are typically prepared and presented for tribunal processes.',
  },
  {
    slug: 'keeping-a-work-diary',
    eyebrow: 'Daily record',
    title: 'Keeping a work diary',
    description: 'Why people keep a daily work diary, what to include, and how to keep it useful over time.',
  },
  {
    slug: 'raising-a-grievance-at-work',
    eyebrow: 'Process',
    title: 'Raising a grievance at work',
    description: 'A neutral overview of the grievance process in UK workplaces, including ACAS guidance.',
  },
];

const GuidesIndex = () => {
  return (
    <PublicPageLayout
      title="Workplace documentation guides — Project Chronicle"
      description="Practical, neutral guides to documenting workplace incidents, grievances and daily events."
      path="/guides"
      jsonLd={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Workplace documentation guides',
        url: 'https://projectchronicle.app/guides',
        description: 'Practical, neutral guides to documenting workplace incidents, grievances and daily events.',
      }}
    >
      <h1 style={{ fontFamily: 'Urbanist, system-ui, sans-serif' }}>Guides</h1>
      <p>
        Plain, neutral guides on how people typically document workplace incidents, grievances and daily
        work events. Information only — not legal advice. Where relevant, we point to recognised UK bodies
        such as <a href="https://www.acas.org.uk" rel="noopener noreferrer">ACAS</a> and{' '}
        <a href="https://www.citizensadvice.org.uk" rel="noopener noreferrer">Citizens Advice</a>.
      </p>

      {/* Card-style hub — replaces the flat <ul> */}
      <div className="not-prose mt-6 grid gap-3">
        {GUIDES.map((g) => (
          <Link
            key={g.slug}
            to={`/guides/${g.slug}`}
            className="group block rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm px-5 py-4 transition hover:border-primary/40 hover:bg-card"
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              {g.eyebrow}
            </p>
            <h2 className="mt-1 text-[16.5px] font-medium text-foreground tracking-[-0.005em] group-hover:text-primary">
              {g.title}
            </h2>
            <p className="mt-1 text-[13.5px] leading-[1.55] text-foreground/70">
              {g.description}
            </p>
          </Link>
        ))}
      </div>
    </PublicPageLayout>
  );
};

export default GuidesIndex;
