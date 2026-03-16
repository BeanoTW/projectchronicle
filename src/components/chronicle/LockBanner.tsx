import { Lock } from 'lucide-react';

const LockBanner = () => (
  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-primary/10 text-primary border border-primary/20">
    <Lock className="h-4 w-4" />
    <span className="text-sm font-medium">This record has been locked against further edits.</span>
  </div>
);

export default LockBanner;
