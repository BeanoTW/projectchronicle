import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AuthHero from '@/components/chronicle/AuthHero';
import AuthCard from '@/components/chronicle/AuthCard';

const WelcomeScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto flex flex-col">
      <AuthHero tagline="Documenting progress. Building tomorrow." />

      <AuthCard>
        <h2 className="text-[20px] font-semibold text-foreground tracking-[-0.02em]">
          Welcome.
        </h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
          Record events clearly. Build timelines you can rely on.
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

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground/80"
        >
          <Shield className="h-3 w-3" strokeWidth={1.5} />
          <span>Your data. Your record. Your control.</span>
        </motion.div>
      </AuthCard>
    </div>
  );
};

export default WelcomeScreen;
