import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import ChronicleLockup from '@/chronicle/brand/ChronicleLockup';

interface PublicPageLayoutProps {
  title: string;
  description: string;
  path: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  children: ReactNode;
}

const BASE = 'https://projectchronicle.app';

// Brand tokens (ink, accent green, paper) come from `.proto-public` in
// chronicle/premium.css, so public pages match the app in light and dark mode.
const PublicPageLayout = ({ title, description, path, jsonLd, children }: PublicPageLayoutProps) => {
  const url = `${BASE}${path}`;
  const jsonLdArr = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <div className="proto-public min-h-screen">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {jsonLdArr.map((obj, i) => (
          <script key={i} type="application/ld+json">{JSON.stringify(obj)}</script>
        ))}
      </Helmet>

      <header className="border-b">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 py-4 lg:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <Link to="/" aria-label="Chronicle home">
            <ChronicleLockup compact markSize={28} />
          </Link>
          <nav className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-3 sm:gap-5 lg:gap-7 text-[12.5px] lg:text-[13.5px]">
            <Link to="/how-it-works">How it works</Link>
            <Link to="/guides">Guides</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/login">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl lg:max-w-4xl mx-auto px-5 lg:px-8 py-10 sm:py-14 lg:py-20">
        <article className="prose prose-neutral max-w-none
                            prose-headings:tracking-[-0.01em]
                            prose-h1:text-[36px] sm:prose-h1:text-[44px] lg:prose-h1:text-[56px]
                            prose-h2:text-[24px] sm:prose-h2:text-[26px] lg:prose-h2:text-[30px] prose-h2:mt-10 lg:prose-h2:mt-14 prose-h2:mb-3
                            prose-h3:text-[19px] lg:prose-h3:text-[21px] prose-h3:mt-7 prose-h3:mb-2
                            prose-p:text-[15.5px] lg:prose-p:text-[17px] prose-p:leading-[1.7]
                            prose-li:text-[15.5px] lg:prose-li:text-[17px]"
                 style={{ fontFamily: 'inherit' }}>
          {children}
        </article>

        <hr className="my-12 lg:my-16" />

        <aside className="proto-public-aside px-5 lg:px-7 py-4 lg:py-6">
          <p className="proto-public-aside-title">About Chronicle</p>
          <p className="text-[14px] lg:text-[15px] leading-relaxed" style={{ color: 'var(--p-ink-2)' }}>
            Project Chronicle is a private, structured way to document workplace incidents, grievances and
            daily events — chronologically, with timestamps, and exportable when you need them. It is a
            documentation tool, not legal advice.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-[13px] lg:text-[14px]">
            <Link to="/about" className="proto-public-link">How Chronicle works</Link>
            <Link to="/privacy" className="proto-public-link">How your data is handled</Link>
            <Link to="/" className="proto-public-link">Open the app</Link>
          </div>
        </aside>
      </main>

      <footer className="border-t mt-6">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-3 text-[12px]" style={{ color: 'var(--p-muted)' }}>
          <span>© Project Chronicle</span>
          <nav className="flex gap-4" aria-label="Footer">
            <Link to="/how-it-works">How it works</Link>
            <Link to="/about">About</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/guides">Guides</Link>
          </nav>
          <span className="basis-full text-[11px] leading-relaxed">
            Independently developed and maintained in the UK. General information only — not legal advice.
          </span>
        </div>
      </footer>
    </div>
  );
};

export default PublicPageLayout;