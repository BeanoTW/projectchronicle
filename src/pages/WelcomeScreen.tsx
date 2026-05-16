import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import AuthHero from '@/components/chronicle/AuthHero';
import AuthCard from '@/components/chronicle/AuthCard';

const WelcomeScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto flex flex-col">
      <AuthHero tagline="Documenting progress. Building tomorrow." />

      <AuthCard>
        <h1 className="text-[20px] font-semibold text-foreground tracking-[-0.02em]">
          A private, structured way to document workplace events.
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
          Record incidents, grievances and daily events — chronologically, with timestamps,
          and exportable when you need them.
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

        {/* Who this is for — restrained, factual */}
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mt-7"
          aria-labelledby="who-its-for"
        >
          <h2 id="who-its-for" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
            Who Chronicle is for
          </h2>
          <ul className="mt-2 space-y-1 text-[12.5px] text-foreground/75 leading-relaxed">
            <li>Employees keeping a record of workplace incidents or grievances</li>
            <li>People preparing for HR, ACAS or tribunal processes</li>
            <li>Union members and the people who support them</li>
            <li>Anyone keeping a clear daily log of work events</li>
          </ul>
        </motion.section>

        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 space-y-1 text-center text-[11.5px] text-muted-foreground/80 leading-snug"
        >
          <li>Local-first storage by default</li>
          <li>Encrypted sync when enabled</li>
          <li>Your records stay under your control</li>
          <li>No interpretation or alteration of your entries</li>
        </motion.ul>

        {/* Public information links — small, unobtrusive */}
        <nav
          aria-label="Information"
          className="mt-6 pt-4 border-t border-border/60 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground/80"
        >
          <Link to="/about" className="hover:text-foreground">About</Link>
          <Link to="/guides" className="hover:text-foreground">Guides</Link>
          <Link to="/faq" className="hover:text-foreground">FAQ</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        </nav>
        <p className="mt-2 text-center text-[10.5px] text-muted-foreground/60">
          General information only — not legal advice.
        </p>
      </AuthCard>
    </div>
  );
};

export default WelcomeScreen;
