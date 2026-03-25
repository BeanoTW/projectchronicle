import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ChronicleLogo from '@/components/chronicle/ChronicleLogo';
import { Button } from '@/components/ui/button';

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

const WelcomeScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center min-h-screen bg-background px-6 max-w-lg mx-auto">
      <div className="pt-[120px]" />

      <motion.div {...fade(0)}>
        <ChronicleLogo size={72} />
      </motion.div>

      <motion.h1
        className="text-[24px] font-bold text-foreground text-center mt-8 tracking-[-0.03em] leading-tight"
        {...fade(0.1)}
      >
        Project Chronicle
      </motion.h1>

      <motion.p
        className="text-[14px] text-muted-foreground text-center mt-3 max-w-[260px] leading-relaxed"
        {...fade(0.2)}
      >
        Record events clearly. Build timelines you can rely on.
      </motion.p>

      <motion.div className="mt-12 w-full max-w-xs space-y-3" {...fade(0.3)}>
        <Button
          onClick={() => navigate('/signup')}
          className="w-full h-[50px] rounded-[11px] text-[14px] font-semibold bg-primary text-primary-foreground shadow-[0_2px_8px_-3px_hsl(var(--primary)/0.25)] active:scale-[0.97] transition-transform"
        >
          Sign up
        </Button>
        <Button
          onClick={() => navigate('/login')}
          variant="outline"
          className="w-full h-[50px] rounded-[11px] text-[14px] font-semibold border-border/50 text-foreground active:scale-[0.97] transition-transform"
        >
          Sign in
        </Button>
      </motion.div>
    </div>
  );
};

export default WelcomeScreen;
