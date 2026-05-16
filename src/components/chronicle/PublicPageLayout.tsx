import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ReactNode } from 'react';

interface PublicPageLayoutProps {
  title: string;
  description: string;
  path: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  children: ReactNode;
}

const BASE = 'https://projectchronicle.app';

const PublicPageLayout = ({ title, description, path, jsonLd, children }: PublicPageLayoutProps) => {
  const url = `${BASE}${path}`;
  const jsonLdArr = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <div className="min-h-screen bg-background">
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

      <header className="border-b border-border/60">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="font-serif tracking-[0.18em] text-[15px] text-foreground/80"
            style={{ fontFamily: '"Cormorant Garamond", "Times New Roman", serif', fontWeight: 500 }}
          >
            PROJECT&nbsp;CHRONICLE
          </Link>
          <nav className="flex items-center gap-5 text-[12.5px] text-muted-foreground">
            <Link to="/guides" className="hover:text-foreground">Guides</Link>
            <Link to="/faq" className="hover:text-foreground">FAQ</Link>
            <Link to="/login" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        <article className="prose prose-neutral max-w-none
                            prose-headings:font-medium prose-headings:tracking-[-0.01em]
                            prose-h1:text-[34px] sm:prose-h1:text-[40px] prose-h1:leading-[1.15]
                            prose-h2:text-[22px] sm:prose-h2:text-[24px] prose-h2:mt-10 prose-h2:mb-3
                            prose-h3:text-[17px] prose-h3:mt-7 prose-h3:mb-2
                            prose-p:text-[15.5px] prose-p:leading-[1.7] prose-p:text-foreground/80
                            prose-li:text-[15.5px] prose-li:text-foreground/80
                            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                            prose-strong:text-foreground"
                 style={{ fontFamily: 'inherit' }}>
          {children}
        </article>

        <hr className="my-12 border-border/60" />

        <aside className="rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm px-5 py-4">
          <p className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground mb-1">About Chronicle</p>
          <p className="text-[14px] text-foreground/80 leading-relaxed">
            Project Chronicle is a private, structured way to document workplace incidents, grievances and
            daily events — chronologically, with timestamps, and exportable when you need them. It is a
            documentation tool, not legal advice.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-[13px]">
            <Link to="/about" className="text-primary hover:underline">How Chronicle works</Link>
            <Link to="/privacy" className="text-primary hover:underline">How your data is handled</Link>
            <Link to="/" className="text-primary hover:underline">Open the app</Link>
          </div>
        </aside>
      </main>

      <footer className="border-t border-border/60 mt-6">
        <div className="max-w-3xl mx-auto px-5 py-6 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
          <span>© Project Chronicle</span>
          <div className="flex gap-4">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/faq" className="hover:text-foreground">FAQ</Link>
            <Link to="/guides" className="hover:text-foreground">Guides</Link>
          </div>
          <span className="basis-full text-[11px] text-muted-foreground/70">
            General information only — not legal advice.
          </span>
        </div>
      </footer>
    </div>
  );
};

export default PublicPageLayout;
