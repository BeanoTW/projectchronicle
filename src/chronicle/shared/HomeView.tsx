// Home — Chronicle's control centre.
//
// Architecture: one dominant action (Capture), one continuity card (the most
// recent record), the two real destinations with genuine context, and a truthful
// attention area that only appears when something actually needs a decision.
// Deliberately not a dashboard: no charts, no invented metrics.
//
// Mobile stacks in priority order with the Capture action within thumb reach.
// Desktop uses the extra width as a two-column control centre rather than a
// stretched phone screen.
import type { HomeState } from './homeModel';
import { formatHomeDate, formatHomeTimestamp } from './homeModel';

interface Props {
  state: HomeState;
  loading?: boolean;
  onCapture: () => void;
  onOpenNotebook: () => void;
  onOpenMyRecord: () => void;
  onOpenRecord: (id: string) => void;
  onNavigate: (path: string) => void;
}

const FIRST_USE_STEPS: Array<[string, string]> = [
  ['Capture', 'Write or speak what happened, in your own words.'],
  ['Notebook', 'Every record is kept in date order, exactly as you wrote it.'],
  ['My Record', 'Bring selected records together and export a clear report.'],
];

const HomeView = ({
  state, loading, onCapture, onOpenNotebook, onOpenMyRecord, onOpenRecord, onNavigate,
}: Props) => {
  const { recordCount, inMyRecordCount, latest, recentCount, attention, isFirstUse } = state;

  return (
    <div className="proto-home" data-testid="home-view">
      <header className="proto-home-head">
        <h1 className="proto-h1">Home</h1>
        <p className="proto-help">
          {loading
            ? 'Loading your record…'
            : isFirstUse
            ? 'Chronicle keeps a clear, dated record of what happened.'
            : `${recordCount} ${recordCount === 1 ? 'record' : 'records'} kept${recentCount > 0 ? ` · ${recentCount} added in the last 7 days` : ''}`}
        </p>
      </header>

      <div className="proto-home-grid">
        <div className="proto-home-col">
          {/* Dominant action. Capture is something you DO, so it leads. */}
          <button type="button" className="proto-home-capture" onClick={onCapture} data-testid="home-capture">
            <span className="proto-home-capture-icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5.5v13M5.5 12h13" />
              </svg>
            </span>
            <span className="proto-home-capture-text">
              <span className="proto-home-capture-title">
                {isFirstUse ? 'Create your first record' : 'Record something'}
              </span>
              <span className="proto-home-capture-sub">Write or speak it while it is fresh</span>
            </span>
          </button>

          {attention.length > 0 && (
            <section className="proto-home-attention" aria-label="Needs your attention">
              {attention.map(a => (
                <div className="proto-home-alert" key={a.kind} data-testid={`home-attention-${a.kind}`}>
                  <div className="proto-home-alert-label">{a.label}</div>
                  <p className="proto-home-alert-detail">{a.detail}</p>
                  <button type="button" className="proto-linkbtn" onClick={() => onNavigate(a.action.path)}>
                    {a.action.label}
                  </button>
                </div>
              ))}
            </section>
          )}

          {isFirstUse && !loading && (
            <section className="proto-home-card" aria-label="How Chronicle works">
              <h2 className="proto-home-card-title">How Chronicle works</h2>
              <ol className="proto-home-steps">
                {FIRST_USE_STEPS.map(([name, copy]) => (
                  <li key={name}>
                    <span className="proto-home-step-name">{name}</span>
                    <span className="proto-home-step-copy">{copy}</span>
                  </li>
                ))}
              </ol>
              <p className="proto-help">Your original wording is preserved. Anything added later is kept separate.</p>
            </section>
          )}

          {latest && (
            <section className="proto-home-card" aria-label="Most recent record">
              <h2 className="proto-home-card-title">Where you left off</h2>
              <button
                type="button"
                className="proto-home-latest"
                onClick={() => onOpenRecord(latest.id)}
                data-testid="home-latest-record"
              >
                <span className="proto-home-latest-title">{latest.title}</span>
                <span className="proto-home-latest-meta">
                  {formatHomeDate(latest.dateKey)}
                  {latest.recordedAt ? ` · recorded ${formatHomeTimestamp(latest.recordedAt)}` : ''}
                </span>
                <span className="proto-chip" data-tone={latest.inMyRecord ? 'brass' : undefined}>
                  {latest.inMyRecord ? 'In My Record' : 'Not in My Record'}
                </span>
              </button>
            </section>
          )}
        </div>

        <div className="proto-home-col">
          <div className="proto-home-tiles">
            <button type="button" className="proto-home-tile" onClick={onOpenNotebook} data-testid="home-notebook-tile">
              <span className="proto-home-tile-name">Notebook</span>
              <span className="proto-home-tile-value">
                {recordCount === 0 ? 'Nothing recorded yet' : `${recordCount} ${recordCount === 1 ? 'record' : 'records'}`}
              </span>
              <span className="proto-home-tile-hint">Your chronology, in date order</span>
            </button>

            <button type="button" className="proto-home-tile" onClick={onOpenMyRecord} data-testid="home-myrecord-tile">
              <span className="proto-home-tile-name">My Record</span>
              <span className="proto-home-tile-value">
                {recordCount === 0
                  ? 'Nothing to include yet'
                  : `${inMyRecordCount} of ${recordCount} included`}
              </span>
              <span className="proto-home-tile-hint">Assemble and export a report</span>
            </button>
          </div>

          <section className="proto-home-card proto-home-quiet" aria-label="Chronicle principles">
            <h2 className="proto-home-card-title">What Chronicle does</h2>
            <ul className="proto-trust">
              <li>Records are kept exactly as you wrote them.</li>
              <li>Clarifications are stored separately from the original.</li>
              <li>Photos, documents and voice notes can be attached.</li>
              <li>Nothing is shared unless you export it yourself.</li>
            </ul>
            <button type="button" className="proto-linkbtn" onClick={() => onNavigate('/settings')}>
              Settings, privacy and backup
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HomeView;
