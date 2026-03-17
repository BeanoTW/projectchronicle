import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const LoginScreen = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
    } else {
      navigate('/timeline');
    }
  };

  return (
    <div className="flex flex-col min-h-screen px-6 pt-16 bg-background max-w-lg mx-auto">
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mb-4">
          <Shield className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
        <p className="text-sm text-muted-foreground mt-1">Sign in to Project Chronicle</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
          <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 bg-card" placeholder="you@example.com" />
        </div>
        <div>
          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
          <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 bg-card" />
        </div>
        <Button onClick={handleLogin} disabled={loading} className="w-full bg-primary text-primary-foreground h-12">
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <button onClick={() => navigate('/')} className="text-primary font-medium">Sign up</button>
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
