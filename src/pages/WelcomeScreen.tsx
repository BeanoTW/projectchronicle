import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import AuthHero from '@/components/chronicle/AuthHero';
import AuthCard from '@/components/chronicle/AuthCard';

const WelcomeScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile: stacked hero + card. Desktop: two-column split. */}
      <div className="w-full max-w-lg lg:max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-stretch lg:gap-10 lg:px-8 lg:py-10 flex-1">
        <div className="lg:flex-1 lg:flex lg:flex-col lg:justify-between">
          <AuthHero />

          {/* Desktop-only supporting narrative next to the hero */}
          <div className="hidden lg:block px-2 pt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
              Why Chronicle
            </p>
            <p className="mt-3 text-[18px] leading-[1.55] text-foreground/85 max-w-md"
               style={{ fontFamily: 'Urbanist, system-ui, sans-serif', fontWeight: 500 }}>
              A calm, private place to record workplace events chronologically —
              so if you ever need a clear account, it already exists.
            </p>
            <ul className="mt-6 space-y-2 text-[13.5px] text-foreground/75 max-w-md">
              <li>• Local-first — your records live on your device</li>
              <li>• Original wording preserved, never rewritten</li>
              <li>• Structured, timestamped exports when you need them</li>
            </ul>
          </div>
        </div>

        <div className="lg:flex-1 lg:max-w-md lg:mx-auto lg:flex lg:items-center">
          <div className="w-full">
            <AuthCard>
              <h1 className="text-[20px] lg:text-[24px] font-semibold text-foreground tracking-[-0.02em]">
                A structured, chronological workplace record.
              </h1>
              <p className="mt-1.5 text-[13px] lg:text-[14px] text-muted-foreground leading-relaxed">
                Document workplace incidents, grievances and daily events in your own words,
                in date order, and export when you need to.
              </p>

              <div className="mt-7 space-y-3">
                <Button
                  onClick={() => navigate('/signup')}
                  className="w-full h-[48px] rounded-[10px] text-[14px] font-semibold"
                >
                  Create an account
                </Button>
                <Button
                  onClick={() => navigate('/login')}
                  variant="outline"
                  className="w-full h-[48px] rounded-[10px] text-[14px] font-semibold"
                >
                  Sign in
                </Button>
              </div>

              <p className="mt-4 text-center text-[12px] text-muted-foreground/85 leading-relaxed">
                After signing in you can start a private record, add daily notes,
                and export a structured chronology when needed.
              </p>

              <motion.section
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="mt-7 pt-5 border-t border-border/60"
                aria-labelledby="who-its-for"
              >
                <h2
                  id="who-its-for"
                  className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80"
                >
                  Who Chronicle is for
                </h2>
                <ul className="mt-2 space-y-1 text-[12.5px] text-foreground/75 leading-relaxed">
                  <li>People keeping a personal record of workplace incidents or grievances</li>
                  <li>Anyone preparing for an HR, ACAS or tribunal process</li>
                  <li>Union members and the people who support them</li>
                  <li>Anyone keeping a clear daily log of work events</li>
                </ul>
              </motion.section>
            </AuthCard>
          </div>
        </div>
      </div>

      <nav
        aria-label="Information"
        className="mx-4 mb-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground/80"
      >
        <Link to="/how-it-works" className="hover:text-foreground">How it works</Link>
        <Link to="/about" className="hover:text-foreground">About</Link>
        <Link to="/guides" className="hover:text-foreground">Guides</Link>
        <Link to="/faq" className="hover:text-foreground">FAQ</Link>
        <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
      </nav>
      <p className="mx-4 mb-8 text-center text-[10.5px] text-muted-foreground/60 leading-relaxed">
        Independently developed and maintained in the UK.
        General information only — not legal advice.
      </p>
    </div>
  );
};

export default WelcomeScreen;
