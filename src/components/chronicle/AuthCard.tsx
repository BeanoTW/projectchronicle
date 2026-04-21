import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface AuthCardProps {
  children: ReactNode;
}

/**
 * Light, contained surface that sits below the AuthHero.
 * Provides clear separation from the page background.
 */
const AuthCard = ({ children }: AuthCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: 0.15, ease: [0.22, 0.61, 0.36, 1] }}
    className="relative z-10 -mt-6 mx-4 mb-8 rounded-2xl bg-card border border-border/80 shadow-[0_10px_30px_-12px_hsl(220_25%_12%/0.18),0_2px_6px_-2px_hsl(220_25%_12%/0.08)] px-5 sm:px-6 py-7"
  >
    {children}
  </motion.div>
);

export default AuthCard;
