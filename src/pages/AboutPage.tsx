import PublicPageLayout from '@/components/chronicle/PublicPageLayout';
import { Link } from 'react-router-dom';

const AboutPage = () => (
  <PublicPageLayout
    title="About Project Chronicle — a structured, chronological workplace record"
    description="What Chronicle is, what it is not, and the principles behind how it records workplace events."
    path="/about"
    jsonLd={{
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      url: 'https://projectchronicle.app/about',
      name: 'About Project Chronicle',
    }}
  >
    <h1 style={{ fontFamily: '"Cormorant Garamond", serif' }}>About Project Chronicle</h1>
    <p>
      Project Chronicle is a structured, chronological workplace record. Entries are timestamped,
      sit in date order, and can be exported as a single document when you need to share them.
      It is independently developed and maintained in the UK.
    </p>

    <h2>What Chronicle is</h2>
    <ul>
      <li>A structured workplace record for personal use.</li>
      <li>Chronological — every entry is dated and kept in order.</li>
      <li>Append-only — earlier entries are preserved exactly as written.</li>
      <li>Local-first — your records live on your device by default, with optional cloud sync.</li>
      <li>Exportable — you can produce a single structured document for HR, a union representative, an adviser or a solicitor.</li>
    </ul>

    <h2>What Chronicle is not</h2>
    <ul>
      <li>It is not a legal service and does not give legal advice.</li>
      <li>It does not decide whether something is or is not a grievance, harassment, bullying or discrimination.</li>
      <li>It does not interpret your records or rewrite them.</li>
      <li>It does not contact your employer on your behalf.</li>
    </ul>

    <h2>Who it is for</h2>
    <p>
      People who want to keep a clear personal record of workplace events. That includes employees
      raising concerns, people preparing for a grievance or tribunal, union members, and anyone
      keeping a daily log of work events for their own reference.
    </p>

    <h2>The principles behind it</h2>
    <ul>
      <li><strong>Neutrality.</strong> Chronicle does not characterise people or events. It records what you wrote.</li>
      <li><strong>Integrity.</strong> Original entries are not rewritten when you add updates later.</li>
      <li><strong>Transparency.</strong> Each entry shows both when the event occurred and when it was recorded.</li>
      <li><strong>Privacy.</strong> Records are local-first; sync is optional and under your control.</li>
    </ul>

    <p>
      For a walkthrough of the product, see <Link to="/how-it-works">how Chronicle works</Link>.
      For an explanation of how data is stored, see <Link to="/privacy">how your data is handled</Link>.
      For common questions, see the <Link to="/faq">FAQ</Link>.
    </p>
  </PublicPageLayout>
);

export default AboutPage;
