import { Link } from 'react-router-dom';
import PublicPageLayout from '@/components/chronicle/PublicPageLayout';

export const GUIDES = [
  {
    slug: 'how-to-document-workplace-incidents',
    title: 'How to document workplace incidents',
    description: 'A practical, neutral guide to recording workplace incidents clearly and chronologically.',
  },
  {
    slug: 'how-to-prove-workplace-bullying',
    title: 'How to evidence workplace bullying',
    description: 'What contemporaneous notes, timelines and supporting material typically look like for bullying concerns.',
  },
  {
    slug: 'preparing-a-timeline-for-a-grievance',
    title: 'Preparing a timeline for a grievance',
    description: 'How a clear chronological timeline can help when raising a workplace grievance.',
  },
  {
    slug: 'evidence-for-an-employment-tribunal',
    title: 'Evidence for an employment tribunal',
    description: 'A neutral overview of how records are typically prepared and presented for tribunal processes.',
  },
  {
    slug: 'keeping-a-work-diary',
    title: 'Keeping a work diary',
    description: 'Why people keep a daily work diary, what to include, and how to keep it useful over time.',
  },
  {
    slug: 'raising-a-grievance-at-work',
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
      <h1 style={{ fontFamily: '"Cormorant Garamond", serif' }}>Guides</h1>
      <p>
        Plain, neutral guides on how people typically document workplace incidents, grievances and daily
        work events. Information only — not legal advice. Where relevant, we point to recognised UK bodies
        such as <a href="https://www.acas.org.uk" rel="noopener noreferrer">ACAS</a> and{' '}
        <a href="https://www.citizensadvice.org.uk" rel="noopener noreferrer">Citizens Advice</a>.
      </p>
      <ul>
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link to={`/guides/${g.slug}`}>{g.title}</Link> — {g.description}
          </li>
        ))}
      </ul>
    </PublicPageLayout>
  );
};

export default GuidesIndex;
