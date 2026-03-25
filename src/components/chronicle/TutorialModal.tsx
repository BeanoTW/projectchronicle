import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, BarChart3, Scale } from 'lucide-react';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

const steps = [
  {
    icon: FileText,
    title: 'Record events clearly',
    desc: 'Write or speak what happened — we structure it into a clear record.',
  },
  {
    icon: BarChart3,
    title: 'View them over time',
    desc: 'Your records form a timeline. Patterns become visible as you add more.',
  },
  {
    icon: Scale,
    title: 'Understand your position',
    desc: 'Get guidance on your rights and export everything when you need it.',
  },
];

const TutorialModal = ({ open, onClose }: TutorialModalProps) => (
  <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
    <DialogContent className="max-w-sm rounded-2xl p-6 gap-0">
      <DialogHeader className="mb-5">
        <DialogTitle className="text-[18px] font-bold text-foreground tracking-tight">
          Welcome to Chronicle
        </DialogTitle>
        <DialogDescription className="text-[13px] text-muted-foreground mt-1">
          Here's how it works.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 mb-6">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <s.icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-foreground leading-snug">{s.title}</p>
              <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={onClose}
        className="w-full h-11 rounded-xl text-[14px] font-semibold bg-primary text-primary-foreground active:scale-[0.97] transition-transform"
      >
        Get started
      </Button>
    </DialogContent>
  </Dialog>
);

export default TutorialModal;
