import PublicPageLayout from '@/components/chronicle/PublicPageLayout';

const SECTIONS: { heading: string; items: { q: string; a: string }[] }[] = [
  {
    heading: 'What Chronicle is',
    items: [
      { q: 'What is Project Chronicle?', a: 'Chronicle is a structured, chronological workplace record. You document workplace incidents, grievances and daily events in your own words, in date order, and export when you need to.' },
      { q: 'Is Chronicle legal advice?', a: 'No. Chronicle is a documentation tool. For advice on workplace rights or grievance procedures, recognised sources include ACAS, Citizens Advice and qualified employment solicitors.' },
      { q: 'Who is Chronicle for?', a: 'Anyone keeping a personal record of workplace events — employees raising concerns, people preparing for a grievance or tribunal, union members, and anyone who wants a clear daily log of work events.' },
    ],
  },
  {
    heading: 'How your data is handled',
    items: [
      { q: 'Where is my data stored?', a: 'Chronicle is local-first. Your records are stored on your device by default. Optional cloud sync is available and is controlled by you.' },
      { q: 'How does cloud sync protect my records?', a: 'When sync is enabled, records are mirrored to a managed backend using standard transport and at-rest protections, with row-level access rules so your records are only readable by your account. Chronicle does not currently claim end-to-end or zero-knowledge encryption.' },
      { q: 'Is Chronicle anonymous?', a: 'Chronicle requires an account so that authentication, recovery and optional sync work reliably. The contents of your records are private to you.' },
    ],
  },
  {
    heading: 'How records can be used',
    items: [
      { q: 'Can I use Chronicle for an employment tribunal?', a: 'Chronicle helps you keep a clear chronological record, which is the kind of material commonly referenced in workplace processes. Whether and how a record is used in any formal process is a decision for you and any adviser you work with.' },
      { q: 'Can I export my record?', a: 'Yes. Records can be exported as a single structured document for sharing with HR, a union representative, an adviser or a solicitor.' },
      { q: 'Does Chronicle change or interpret my entries?', a: 'No. Records are append-only — original wording is preserved exactly as entered, and earlier entries are not overwritten.' },
    ],
  },
];

const FaqPage = () => {
  const allQA = SECTIONS.flatMap((s) => s.items);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allQA.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <PublicPageLayout
      title="Frequently asked questions — Project Chronicle"
      description="Common questions about Project Chronicle: what it is, how your data is handled, and how records can be used."
      path="/faq"
      jsonLd={jsonLd}
    >
      <h1 style={{ fontFamily: 'Urbanist, system-ui, sans-serif' }}>Frequently asked questions</h1>
      {SECTIONS.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.items.map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </section>
      ))}
    </PublicPageLayout>
  );
};

export default FaqPage;
