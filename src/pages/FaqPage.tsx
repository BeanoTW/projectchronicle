import PublicPageLayout from '@/components/chronicle/PublicPageLayout';

const FAQ = [
  { q: 'What is Project Chronicle?', a: 'Chronicle is a private, structured way to document workplace incidents, grievances and daily events — chronologically, with timestamps, and exportable when you need them.' },
  { q: 'Is Chronicle legal advice?', a: 'No. Chronicle is a documentation tool. For advice on workplace rights or grievance procedures, recognised sources include ACAS, Citizens Advice and qualified employment solicitors.' },
  { q: 'Where is my data stored?', a: 'Chronicle is local-first. Your records are stored on your device by default. Encrypted cloud sync is optional and is controlled by you.' },
  { q: 'Can I use Chronicle for an employment tribunal?', a: 'Chronicle can help you keep a clear chronological record, which is the kind of material commonly referenced in workplace processes. Whether and how a record is used in any formal process is a decision for you and any adviser you work with.' },
  { q: 'Can I export my record?', a: 'Yes. Records can be exported as a single structured document for sharing with HR, a union representative, an adviser or a solicitor.' },
  { q: 'Does Chronicle change or interpret my entries?', a: 'No. Records are append-only — original wording is preserved exactly as entered, and earlier entries are not overwritten.' },
  { q: 'Is Chronicle anonymous?', a: 'Chronicle requires an account so that your records can sync securely across your devices if you choose to enable sync. The contents of your records are private to you.' },
  { q: 'Who is Chronicle for?', a: 'Anyone keeping a personal record of workplace events — employees raising concerns, people preparing for a grievance or tribunal, union members, and anyone who wants a clear daily log of work events.' },
];

const FaqPage = () => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <PublicPageLayout
      title="Frequently asked questions — Project Chronicle"
      description="Common questions about Project Chronicle: what it is, how data is handled, and how records are used."
      path="/faq"
      jsonLd={jsonLd}
    >
      <h1 style={{ fontFamily: '"Cormorant Garamond", serif' }}>Frequently asked questions</h1>
      {FAQ.map((f) => (
        <div key={f.q}>
          <h2>{f.q}</h2>
          <p>{f.a}</p>
        </div>
      ))}
    </PublicPageLayout>
  );
};

export default FaqPage;
