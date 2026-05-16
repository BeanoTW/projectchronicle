import PublicPageLayout from '@/components/chronicle/PublicPageLayout';

const PrivacyPage = () => (
  <PublicPageLayout
    title="How your data is handled — Project Chronicle"
    description="A plain explanation of where Chronicle stores your records, how sync works, and what is and is not shared."
    path="/privacy"
  >
    <h1 style={{ fontFamily: '"Cormorant Garamond", serif' }}>How your data is handled</h1>
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

    <h2>Optional encrypted sync</h2>
    <p>
      If you choose to enable cloud sync, your records are also stored in our secure backend so that
      they remain available across your devices and if you reinstall the app. Sync is opt-in and can
      be turned off. Records themselves are not modified by syncing — sync mirrors them, it does not
      rewrite them.
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

    <h2>Status</h2>
    <p>
      Chronicle is an early-stage product currently in controlled testing. This page will be expanded
      as the product develops. For specific data-protection questions, please get in touch via the
      app's support channels.
    </p>
  </PublicPageLayout>
);

export default PrivacyPage;
