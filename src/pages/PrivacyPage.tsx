import PublicPageLayout from '@/components/chronicle/PublicPageLayout';

const PrivacyPage = () => (
  <PublicPageLayout
    title="How your data is handled — Project Chronicle"
    description="A plain explanation of where Chronicle stores your records, how optional cloud sync works, and what is and is not shared."
    path="/privacy"
  >
    <h1 style={{ fontFamily: 'Urbanist, system-ui, sans-serif' }}>How your data is handled</h1>
    <p className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground/80" style={{ marginTop: '-0.5rem' }}>
      Last updated: 16 May 2026
    </p>
    <p>
      Chronicle is designed around the assumption that your records are personal and may be sensitive.
      This page explains, in plain terms, how data is stored and what happens to it.
    </p>

    <h2>Local-first by default</h2>
    <p>
      When you create a record in Chronicle, it is stored on your device first, in your browser's
      local database. The app works offline, and your records are available to you without needing
      a connection.
    </p>

    <h2>Optional cloud sync</h2>
    <p>
      You can choose to enable cloud sync so that your records remain available across your devices
      and if you reinstall the app. Sync is opt-in and can be turned off at any time. Records are
      mirrored — sync does not rewrite or modify the contents of an entry.
    </p>
    <p>
      Cloud sync runs on a managed backend (Supabase) and is protected by the standard transport
      and at-rest protections that provider offers, together with row-level access rules so your
      records are only readable by your account. Chronicle does not currently advertise end-to-end
      or zero-knowledge encryption, and we will not describe it that way until it is implemented and
      independently verifiable.
    </p>

    <h2>What we do not do</h2>
    <ul>
      <li>We do not read, interpret or analyse the contents of your records for any purpose other than providing the features you use.</li>
      <li>We do not sell data.</li>
      <li>We do not show third-party advertising.</li>
      <li>We do not share your records with employers, third parties or other users.</li>
    </ul>

    <h2>Account and authentication</h2>
    <p>
      An account is used so that authentication, recovery and sync work reliably. Your account
      identifier is linked to the records you create, but the contents of those records are private
      to you.
    </p>

    <h2>Exports</h2>
    <p>
      When you export a record, the resulting file lives wherever you save or send it. From that
      point it is outside Chronicle's control — treat exports like any other document containing
      personal information.
    </p>

    <h2>Security features in the app</h2>
    <ul>
      <li>App lock with PIN or biometric, with automatic lock after inactivity.</li>
      <li>Privacy Shield to mask names, locations and attachments on screen.</li>
      <li>Append-only records — earlier entries are not overwritten by later updates.</li>
    </ul>

    <h2>Status and contact</h2>
    <p>
      Chronicle is an early-stage product currently in controlled testing, independently developed
      and maintained in the UK. This page will be expanded as the product develops. For specific
      data-protection questions, please use the support channels inside the app.
    </p>
  </PublicPageLayout>
);

export default PrivacyPage;
