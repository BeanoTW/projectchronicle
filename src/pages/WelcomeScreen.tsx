// Phase 12 — signed-out landing. Focused product introduction, not a
// marketing site: proposition, the two auth actions, then a short, honest
// explanation of the workflow.
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '@/chronicle/shared/AuthShell';

const STEPS = [
  ['Capture', 'Record something while it is fresh.'],
  ['Notebook', 'Keep everything organised chronologically.'],
  ['My Record', 'Bring together the entries you may later need.'],
  ['Report', 'Create a clear PDF or Word record when you are ready.'],
];

const WelcomeScreen = () => {
  const navigate = useNavigate();

  return (
    <AuthShell
      wide
      title="A clear record of what happened."
      lede="Chronicle helps you record what happened, preserve your original account, organise supporting evidence, and build a clear record you can use later if needed."
      aside={
        <div className="proto-preview" aria-label="Example of a Chronicle notebook">
          <p className="proto-preview-head">Notebook</p>
          {[
            { meta: '12 Mar · 08:41', chip: 'In My Record' },
            { meta: '9 Mar · 17:05', chip: '2 attachments' },
            { meta: '2 Mar · 12:20', chip: 'Clarification added' },
          ].map(row => (
            <div className="proto-preview-card" key={row.meta}>
              <div className="proto-preview-meta">
                {row.meta} · <span className="proto-chip">{row.chip}</span>
              </div>
              <div className="proto-preview-line" />
              <div className="proto-preview-line" data-w="mid" />
              <div className="proto-preview-line" data-w="short" />
            </div>
          ))}
          <p className="proto-help">Your own wording, kept in date order.</p>
        </div>
      }
      footer={
        <>
          <nav aria-label="Information" className="proto-authlinks">
            <Link to="/how-it-works">How it works</Link>
            <Link to="/about">About</Link>
            <Link to="/guides">Guides</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/privacy">Privacy</Link>
          </nav>
          <p style={{ marginTop: 10 }}>
            Independently developed and maintained in the UK. General information only — not legal advice.
          </p>
        </>
      }
    >
      <div className="proto-auth-actions">
        <button
          type="button"
          className="proto-btn"
          data-variant="primary"
          onClick={() => navigate('/signup')}
        >
          Create account
        </button>
        <button type="button" className="proto-btn" onClick={() => navigate('/login')}>
          Log in
        </button>
      </div>

      <h2 className="proto-h2" style={{ marginTop: 30 }}>How Chronicle works</h2>
      <ul className="proto-steps">
        {STEPS.map(([name, copy]) => (
          <li key={name}>
            <div className="proto-step-name">{name}</div>
            <div className="proto-step-copy">{copy}</div>
          </li>
        ))}
      </ul>

      <h2 className="proto-h2" style={{ marginTop: 26 }}>What Chronicle does with your words</h2>
      <ul className="proto-trust">
        <li>Your original wording is preserved.</li>
        <li>Anything you clarify later is kept separate from the original entry.</li>
        <li>Photos, documents and voice notes can be attached to a record.</li>
        <li>Privacy controls let you hide names and wording on screen.</li>
        <li>Records can be organised into My Record and exported as a report.</li>
      </ul>
    </AuthShell>
  );
};

export default WelcomeScreen;
