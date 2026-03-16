import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const onboardingSteps = [
  {
    id: 'welcome',
    content: (onNext: () => void) => (
      <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center bg-background">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6">
          <Shield className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Project Chronicle</h1>
        <p className="text-body text-sm mb-8">Record events. Preserve evidence. Build the truth.</p>
        <Button onClick={onNext} className="w-full max-w-xs bg-primary text-primary-foreground h-12">
          Get Started
        </Button>
      </div>
    ),
  },
  {
    id: 'privacy',
    content: (onNext: () => void) => (
      <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center bg-background">
        <div className="w-16 h-16 bg-integrity rounded-2xl flex items-center justify-center mb-6">
          <Lock className="h-8 w-8 text-integrity-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-3">Your Records Stay Private</h2>
        <p className="text-body text-sm mb-8 max-w-xs">
          Your records stay private on your device. Nothing is shared without your action.
        </p>
        <Button onClick={onNext} className="w-full max-w-xs bg-primary text-primary-foreground h-12">
          Continue
        </Button>
      </div>
    ),
  },
];

const OnboardingScreen = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleRegister = () => {
    const newErrors: Record<string, string> = {};
    if (!email.trim()) newErrors.email = 'Email is required.';
    if (!password) newErrors.password = 'Password is required.';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    // TODO: Register with Lovable Cloud auth
    setStep(3);
  };

  const handleSkip = () => {
    localStorage.setItem('chronicle_onboarded', 'true');
    navigate('/timeline');
  };

  const handleRecordFirst = () => {
    localStorage.setItem('chronicle_onboarded', 'true');
    navigate('/record');
  };

  if (step < 2) {
    const stepConfig = onboardingSteps[step];
    return stepConfig.content(() => setStep(step + 1));
  }

  if (step === 2) {
    return (
      <div className="flex flex-col min-h-screen px-6 pt-12 bg-background">
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
          <UserPlus className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-1">Create Account</h2>
        <p className="text-xs text-muted-foreground mb-6">Your data is stored securely and never shared without your action.</p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 bg-card" placeholder="you@example.com" />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 bg-card" />
            {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
          </div>
          <div>
            <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 bg-card" />
            {errors.confirmPassword && <p className="text-xs text-destructive mt-1">{errors.confirmPassword}</p>}
          </div>

          <div className="flex items-start gap-3 py-2">
            <Checkbox id="consent" checked={consent} onCheckedChange={(c) => setConsent(c === true)} className="mt-0.5" />
            <Label htmlFor="consent" className="text-xs text-body leading-relaxed cursor-pointer">
              I agree to my anonymised, non-identifiable data being used to identify workplace incident patterns.
            </Label>
          </div>

          <Button onClick={handleRegister} className="w-full bg-primary text-primary-foreground h-12">
            Sign Up
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: First incident prompt
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center bg-background">
      <h2 className="text-xl font-bold text-foreground mb-3">Record your first incident now?</h2>
      <p className="text-sm text-body mb-8 max-w-xs">
        You can start documenting right away, or explore the app first.
      </p>
      <div className="w-full max-w-xs space-y-3">
        <Button onClick={handleRecordFirst} className="w-full bg-primary text-primary-foreground h-12">
          Record Incident
        </Button>
        <Button onClick={handleSkip} variant="outline" className="w-full border-primary text-primary h-12">
          Skip for Now
        </Button>
      </div>
    </div>
  );
};

export default OnboardingScreen;
