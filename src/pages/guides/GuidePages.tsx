import { Link } from 'react-router-dom';
import PublicPageLayout from '@/components/chronicle/PublicPageLayout';

const BASE = 'https://projectchronicle.app';

const articleSchema = (headline: string, description: string, slug: string) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline,
  description,
  url: `${BASE}/guides/${slug}`,
  inLanguage: 'en-GB',
  author: { '@type': 'Organization', name: 'Project Chronicle' },
  publisher: { '@type': 'Organization', name: 'Project Chronicle' },
});

const faqSchema = (qa: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: qa.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
});

const breadcrumbSchema = (title: string, slug: string) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    { '@type': 'ListItem', position: 2, name: 'Guides', item: `${BASE}/guides` },
    { '@type': 'ListItem', position: 3, name: title, item: `${BASE}/guides/${slug}` },
  ],
});

const H1 = ({ children }: { children: React.ReactNode }) => (
  <h1 style={{ fontFamily: '"Cormorant Garamond", serif' }}>{children}</h1>
);

/** Light contextual aside — varies per guide so the foot of each page doesn't feel templated. */
const RelatedAside = ({
  related,
  note,
}: {
  related: { to: string; label: string }[];
  note?: string;
}) => (
  <div className="not-prose mt-10 rounded-xl border border-border/70 bg-card/50 px-5 py-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
      Related reading
    </p>
    <ul className="mt-2 space-y-1.5 text-[13.5px]">
      {related.map((r) => (
        <li key={r.to}>
          <Link to={r.to} className="text-primary hover:underline">{r.label}</Link>
        </li>
      ))}
    </ul>
    {note && <p className="mt-3 text-[12.5px] text-muted-foreground leading-relaxed">{note}</p>}
  </div>
);

// 1 ─────────────────────────────────────────────────────────
export const HowToDocument = () => {
  const slug = 'how-to-document-workplace-incidents';
  const title = 'How to document workplace incidents';
  const seoTitle = 'How to document workplace incidents — a practical guide';
  const description =
    'A practical, neutral guide to recording workplace incidents clearly and chronologically.';
  const faq = [
    { q: 'What should I include in a workplace incident record?', a: 'Typically: the date and time the event happened, where it took place, who was present, what was said or done in your own words, and any related messages or documents.' },
    { q: 'How soon after an incident should I write it down?', a: 'As soon as is practical. Notes written close to the event are usually considered more reliable than those written later from memory.' },
    { q: 'Do I need to record every small thing?', a: 'There is no fixed rule. Many people record anything that feels relevant at the time, and review it later. A clear record is more useful than a perfect one.' },
  ];
  return (
    <PublicPageLayout
      title={`${seoTitle} — Project Chronicle`}
      description={description}
      path={`/guides/${slug}`}
      jsonLd={[articleSchema(title, description, slug), faqSchema(faq), breadcrumbSchema(title, slug)]}
    >
      <H1>{title}</H1>
      <p>
        Documenting a workplace incident usually means writing down what happened, when it happened, who
        was involved, and what was said or done — in your own words, close to the time of the event.
        Clear, chronological notes tend to be more useful than detailed ones written long after the fact.
      </p>
      <p>
        This guide outlines the elements people commonly include in a workplace record. It is general
        information only and is not legal advice. For guidance on workplace rights and procedures, see{' '}
        <a href="https://www.acas.org.uk" rel="noopener noreferrer">ACAS</a> or{' '}
        <a href="https://www.citizensadvice.org.uk" rel="noopener noreferrer">Citizens Advice</a>.
      </p>

      <h2>What a workplace record usually contains</h2>
      <ul>
        <li><strong>Date and time</strong> the event took place.</li>
        <li><strong>Location</strong> — where it happened (office, meeting, video call, message thread).</li>
        <li><strong>People involved</strong> — who was present or directly part of the event.</li>
        <li><strong>What happened</strong> — a factual account in your own words.</li>
        <li><strong>Exact words</strong>, where you can remember them — quoted in full where possible.</li>
        <li><strong>Supporting material</strong> — related emails, messages, screenshots or documents.</li>
        <li><strong>How it affected you or your work</strong>, briefly and factually.</li>
      </ul>

      <h2>Writing the account itself</h2>
      <p>
        A useful record describes events in the order they happened. Stick to what you saw, heard, said
        or did. Where you are summarising someone else, make it clear it is your recollection rather than
        a verbatim quote. Avoid speculating about motive — record the facts and let the timeline speak.
      </p>

      <h2>Keeping the record over time</h2>
      <p>
        Most people add to a record gradually rather than writing one long document. Each entry sits in
        order alongside the others, building a chronology. Adding a new entry should not change earlier
        ones — older notes are most useful when they remain exactly as first written.
      </p>

      <h2>Common questions</h2>
      {faq.map((f) => (
        <div key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}

      <RelatedAside
        related={[
          { to: '/guides/keeping-a-work-diary', label: 'Keeping a work diary' },
          { to: '/guides/preparing-a-timeline-for-a-grievance', label: 'Preparing a timeline for a grievance' },
        ]}
        note="Chronicle is built around this pattern: each entry is timestamped, the original wording is preserved, and entries sit in chronological order."
      />
    </PublicPageLayout>
  );
};

// 2 ─────────────────────────────────────────────────────────
export const ProveBullying = () => {
  const slug = 'how-to-prove-workplace-bullying';
  const title = 'How to evidence workplace bullying';
  const seoTitle = 'How to prove workplace bullying — what contemporaneous records look like';
  const description =
    'What contemporaneous notes, timelines and supporting material typically look like for workplace bullying concerns.';
  const faq = [
    { q: 'What counts as workplace bullying?', a: 'Definitions vary by employer and country. ACAS describes bullying as offensive, intimidating, malicious or insulting behaviour that undermines or humiliates the person on the receiving end. Your organisation may have its own definition in its policies.' },
    { q: 'What kind of records help when raising a concern about bullying?', a: 'Contemporaneous notes — written close to the time of each event — along with relevant messages, emails and a clear chronological timeline are commonly referred to in workplace processes.' },
    { q: 'Do I need to label something as bullying to record it?', a: 'No. Many people simply record what was said or done at the time, and the pattern across multiple entries becomes the picture.' },
  ];
  return (
    <PublicPageLayout
      title={`${seoTitle} — Project Chronicle`}
      description={description}
      path={`/guides/${slug}`}
      jsonLd={[articleSchema(title, description, slug), faqSchema(faq), breadcrumbSchema(title, slug)]}
    >
      <H1>{title}</H1>
      <p>
        Concerns about workplace bullying are often supported less by a single dramatic event and more
        by a pattern across many smaller ones. Clear, contemporaneous records — written close to the
        time of each event — tend to be the most useful starting point.
      </p>
      <p>
        This guide outlines what those records typically contain. It is general information only and is
        not legal advice. For definitions and process guidance, see{' '}
        <a href="https://www.acas.org.uk/if-youre-treated-unfairly-at-work/being-bullied" rel="noopener noreferrer">ACAS guidance on bullying at work</a>.
      </p>

      <h2>What tends to be recorded</h2>
      <ul>
        <li>The date, time and place of each incident.</li>
        <li>Who was involved and who else was present.</li>
        <li>What was said or done — in your own words, quoted where possible.</li>
        <li>How it affected your work or wellbeing, briefly.</li>
        <li>Any related messages, emails or documents.</li>
      </ul>

      <h2>Why a chronology matters</h2>
      <p>
        A single record on its own often looks ambiguous. A run of entries across weeks or months,
        each with a clear date and exact wording, makes any underlying pattern visible. This is one
        of the reasons keeping entries in order — and not rewriting earlier ones — is widely advised.
      </p>

      <h2>Supporting material</h2>
      <p>
        Where messages, emails or screenshots exist, people typically save copies alongside their
        notes. Original timestamps on the supporting material are usually more useful than copies
        with no metadata.
      </p>

      <h2>Common questions</h2>
      {faq.map((f) => (
        <div key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}

      <RelatedAside
        related={[
          { to: '/guides/how-to-document-workplace-incidents', label: 'How to document workplace incidents' },
          { to: '/guides/raising-a-grievance-at-work', label: 'Raising a grievance at work' },
        ]}
      />
    </PublicPageLayout>
  );
};

// 3 ─────────────────────────────────────────────────────────
export const PrepareTimeline = () => {
  const slug = 'preparing-a-timeline-for-a-grievance';
  const title = 'Preparing a timeline for a grievance';
  const seoTitle = 'Preparing a timeline of events for a workplace grievance';
  const description =
    'How a clear chronological timeline of workplace events can support a grievance and what it typically contains.';
  const faq = [
    { q: 'How far back should a grievance timeline go?', a: 'There is no single rule. Many people include any event they consider relevant to the concern they are raising, in date order.' },
    { q: 'Should the timeline include feelings or just facts?', a: 'A timeline is most useful when it sticks to what happened and when. Impact can be summarised briefly, but the core of the timeline is factual.' },
    { q: 'What format should it be in?', a: 'Any clear format works. A dated list, one entry per event, with people involved and a short description, is a common approach.' },
  ];
  return (
    <PublicPageLayout
      title={`${seoTitle} — Project Chronicle`}
      description={description}
      path={`/guides/${slug}`}
      jsonLd={[articleSchema(title, description, slug), faqSchema(faq), breadcrumbSchema(title, slug)]}
    >
      <H1>{title}</H1>
      <p>
        When raising a workplace grievance, a chronological timeline of events is often easier for
        everyone involved to follow than a long narrative. It lets the person reading it see the
        sequence of events at a glance.
      </p>
      <p>
        For an overview of the grievance process itself, see{' '}
        <a href="https://www.acas.org.uk/grievance-procedure-step-by-step" rel="noopener noreferrer">ACAS — grievance procedure step by step</a>.
      </p>

      <h2>What a useful timeline typically contains</h2>
      <ul>
        <li>One entry per event, in date order.</li>
        <li>The date (and time, if known).</li>
        <li>The people directly involved.</li>
        <li>A short, factual description of what happened.</li>
        <li>A reference to any related document, message or note.</li>
      </ul>

      <h2>Keep the original wording</h2>
      <p>
        Where possible, keep your original notes intact rather than rewriting them. Earlier notes
        written close to events are usually considered more reliable than later summaries.
      </p>

      <h2>Presenting the timeline</h2>
      <p>
        A grievance timeline does not need to argue a case. Its purpose is to lay out events clearly
        and let the reader follow them. Any interpretation can be done separately in the grievance
        letter itself.
      </p>

      <h2>Common questions</h2>
      {faq.map((f) => (
        <div key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}

      <RelatedAside
        related={[
          { to: '/guides/raising-a-grievance-at-work', label: 'Raising a grievance at work' },
          { to: '/guides/evidence-for-an-employment-tribunal', label: 'Evidence for an employment tribunal' },
        ]}
      />
    </PublicPageLayout>
  );
};

// 4 ─────────────────────────────────────────────────────────
export const TribunalEvidence = () => {
  const slug = 'evidence-for-an-employment-tribunal';
  const title = 'Evidence for an employment tribunal';
  const seoTitle = 'Evidence for an employment tribunal — what records are typically referred to';
  const description =
    'A neutral overview of how personal records are typically prepared and presented for employment tribunal processes.';
  const faq = [
    { q: 'What kinds of records are commonly referred to in tribunal processes?', a: 'Contemporaneous notes, emails, messages, formal letters, meeting minutes and timelines of events are all commonly referenced.' },
    { q: 'Are personal notes accepted as evidence?', a: 'Personal notes can be relevant, particularly when they were written close to the events they describe. Their weight is decided in each case.' },
    { q: 'Should I speak to someone before going to tribunal?', a: 'Yes — most people get advice first. ACAS offers free guidance and runs an early conciliation service.' },
  ];
  return (
    <PublicPageLayout
      title={`${seoTitle} — Project Chronicle`}
      description={description}
      path={`/guides/${slug}`}
      jsonLd={[articleSchema(title, description, slug), faqSchema(faq), breadcrumbSchema(title, slug)]}
    >
      <H1>{title}</H1>
      <p>
        Employment tribunal cases are typically supported by a mix of documents written at the time of
        events and documents created later in formal processes. This guide outlines, in general terms,
        the kinds of records people are often asked about. It is information only and not legal advice.
      </p>
      <p>
        For procedural information, see{' '}
        <a href="https://www.gov.uk/employment-tribunals" rel="noopener noreferrer">GOV.UK — Employment Tribunals</a>
        {' '}and <a href="https://www.acas.org.uk" rel="noopener noreferrer">ACAS</a>.
      </p>

      <h2>Records often referred to</h2>
      <ul>
        <li>Contemporaneous notes — written close to the time of events.</li>
        <li>Emails and messages relating to the events in question.</li>
        <li>Formal letters, including grievance letters and responses.</li>
        <li>Meeting minutes or notes from formal meetings.</li>
        <li>A chronological timeline of events.</li>
      </ul>

      <h2>Why contemporaneous notes matter</h2>
      <p>
        Notes written close to events are typically considered more reliable than those written from
        memory much later. Keeping each entry intact — rather than rewriting it later — helps preserve
        that quality.
      </p>

      <h2>Getting advice early</h2>
      <p>
        Most people speak to an adviser before formal steps. Options include union representatives,
        ACAS, Citizens Advice, the{' '}
        <a href="https://www.equalityadvisoryservice.com" rel="noopener noreferrer">Equality Advisory and Support Service</a>{' '}
        and qualified employment solicitors.
      </p>

      <h2>Common questions</h2>
      {faq.map((f) => (
        <div key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}

      <RelatedAside
        related={[
          { to: '/guides/preparing-a-timeline-for-a-grievance', label: 'Preparing a timeline for a grievance' },
          { to: '/guides/how-to-document-workplace-incidents', label: 'How to document workplace incidents' },
        ]}
        note="Tribunal procedure decisions are best made with an adviser. This guide is general information only."
      />
    </PublicPageLayout>
  );
};

// 5 ─────────────────────────────────────────────────────────
export const WorkDiary = () => {
  const slug = 'keeping-a-work-diary';
  const title = 'Keeping a work diary';
  const seoTitle = 'Keeping a work diary — a simple daily record of work events';
  const description =
    'Why people keep a daily work diary, what to include, and how to keep it useful over time.';
  const faq = [
    { q: 'How often should I write in a work diary?', a: 'Whatever rhythm you can keep up with. Many people add a short entry at the end of each working day, plus longer entries for anything notable.' },
    { q: 'What should I include?', a: 'Common entries cover meetings, conversations, decisions, things you delivered, blockers, and anything unusual.' },
    { q: 'Is a work diary the same as an incident record?', a: 'No. A daily diary covers everyday events; an incident record is reserved for specific events you may want to refer to later in more detail.' },
  ];
  return (
    <PublicPageLayout
      title={`${seoTitle} — Project Chronicle`}
      description={description}
      path={`/guides/${slug}`}
      jsonLd={[articleSchema(title, description, slug), faqSchema(faq), breadcrumbSchema(title, slug)]}
    >
      <H1>{title}</H1>
      <p>
        A daily work diary is a short, regular record of what happened during the working day. People
        keep one for many reasons — recall, performance reviews, reflection, or to have a clear log if
        anything later needs to be looked back on.
      </p>

      <h2>What people typically include</h2>
      <ul>
        <li>Meetings attended and key points discussed.</li>
        <li>Decisions made or communicated.</li>
        <li>Work delivered or completed.</li>
        <li>Blockers, delays or things that needed escalating.</li>
        <li>Anything unusual or worth remembering.</li>
      </ul>

      <h2>Keeping it sustainable</h2>
      <p>
        A short daily entry that you actually keep up with is more useful than a detailed one that
        lapses after a fortnight. Many people use a fixed time at the end of the day to write five or
        ten lines.
      </p>

      <h2>Common questions</h2>
      {faq.map((f) => (
        <div key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}

      <RelatedAside
        related={[
          { to: '/guides/how-to-document-workplace-incidents', label: 'How to document workplace incidents' },
          { to: '/how-it-works', label: 'How Chronicle works' },
        ]}
      />
    </PublicPageLayout>
  );
};

// 6 ─────────────────────────────────────────────────────────
export const RaiseGrievance = () => {
  const slug = 'raising-a-grievance-at-work';
  const title = 'Raising a grievance at work';
  const seoTitle = 'How to raise a grievance at work — a neutral overview';
  const description =
    'A neutral overview of how workplace grievances typically work in the UK, including ACAS guidance.';
  const faq = [
    { q: 'What is a workplace grievance?', a: 'A grievance is a concern, problem or complaint that an employee raises with their employer. Most UK employers have a written grievance procedure.' },
    { q: 'Do I have to put a grievance in writing?', a: 'Most formal grievance procedures expect a written grievance letter. ACAS provides a template and step-by-step guidance.' },
    { q: 'What if I want to talk to someone first?', a: 'You can. Options include speaking with your line manager, HR, a trade union representative, ACAS, or Citizens Advice.' },
  ];
  return (
    <PublicPageLayout
      title={`${seoTitle} — Project Chronicle`}
      description={description}
      path={`/guides/${slug}`}
      jsonLd={[articleSchema(title, description, slug), faqSchema(faq), breadcrumbSchema(title, slug)]}
    >
      <H1>{title}</H1>
      <p>
        A workplace grievance is the formal way an employee raises a concern with their employer.
        Most UK employers have a written grievance procedure, and the basic steps tend to be similar:
        raise the concern in writing, attend a meeting to discuss it, receive a written outcome, and
        appeal if needed.
      </p>
      <p>
        The most useful general reference is{' '}
        <a href="https://www.acas.org.uk/grievance-procedure-step-by-step" rel="noopener noreferrer">ACAS — grievance procedure step by step</a>.
        For broader advice, <a href="https://www.citizensadvice.org.uk" rel="noopener noreferrer">Citizens Advice</a>{' '}
        is widely used.
      </p>

      <h2>What a grievance letter usually contains</h2>
      <ul>
        <li>The fact that this is a formal grievance.</li>
        <li>A short summary of the concern.</li>
        <li>The relevant dates and people, in order.</li>
        <li>What you would like to happen next.</li>
      </ul>

      <h2>Where records come in</h2>
      <p>
        A grievance is usually easier to discuss when there is a clear chronology to refer to. Notes
        written at the time of events, plus any supporting messages or documents, give both sides a
        shared starting point.
      </p>

      <h2>Common questions</h2>
      {faq.map((f) => (
        <div key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}

      <RelatedAside
        related={[
          { to: '/guides/preparing-a-timeline-for-a-grievance', label: 'Preparing a timeline for a grievance' },
          { to: '/guides/how-to-document-workplace-incidents', label: 'How to document workplace incidents' },
        ]}
      />
    </PublicPageLayout>
  );
};
