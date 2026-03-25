import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Keyboard, Loader2, Check, Eye, Pencil, X } from 'lucide-react';
import ChronicleLogo from '@/components/chronicle/ChronicleLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ───
interface AnalysisResult {
  title?: string;
  summary?: string;
  incident_date?: string;
  incident_time?: string;
  location?: string;
  category?: string;
  severity?: string;
  people_involved?: string[];
  exact_words?: string;
  potential_relevance?: string[];
}

interface SessionIncident {
  raw_narrative: string;
  title?: string;
  ai_summary?: string;
  incident_date?: string;
  incident_time?: string;
  location?: string;
  category?: string;
  severity?: string;
  people_involved?: string[];
  exact_words?: string;
  record_method: string;
}

// ─── Onboarding Steps ───
const STEP_HOOK = 0;
const STEP_CAPTURE = 1;
const STEP_PATTERN = 2;
const STEP_TRUST = 3;
const STEP_RECORD = 4;
const STEP_PREVIEW = 5;
const STEP_SIGNUP = 6;

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const OnboardingScreen = () => {
  const navigate = useNavigate();
  const { signUp, signIn } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(STEP_HOOK);

  // Record state
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [narrative, setNarrative] = useState('');

  // Analysis state (temporary — never persisted)
  const [analysing, setAnalysing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisFailed, setAnalysisFailed] = useState(false);

  // Session incident (saved temporarily before signup)
  const [sessionIncident, setSessionIncident] = useState<SessionIncident | null>(null);

  // Signup state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Discard dialog
  const [showDiscard, setShowDiscard] = useState(false);

  // Screen 1 text animation
  const [showLine2, setShowLine2] = useState(false);
  useEffect(() => {
    if (step === STEP_HOOK) {
      const timer = setTimeout(() => setShowLine2(true), 300);
      return () => clearTimeout(timer);
    }
    setShowLine2(false);
  }, [step]);

  const hasText = narrative.trim().length > 0;
  const canAnalyse = narrative.trim().length >= 20;

  // ─── Analyse ───
  const handleAnalyse = async () => {
    if (!canAnalyse) return;
    setAnalysing(true);
    setAnalysisFailed(false);
    try {
      const { data, error } = await supabase.functions.invoke('analyse-incident', {
        body: { narrative },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setAnalysis(data as AnalysisResult);
      setStep(STEP_PREVIEW);
    } catch {
      setAnalysisFailed(true);
      toast({ title: "Couldn't process this", description: "You can still save it as written.", variant: 'destructive' });
    } finally {
      setAnalysing(false);
    }
  };

  // ─── Save to session ───
  const handleSaveToSession = () => {
    const incident: SessionIncident = {
      raw_narrative: narrative,
      title: analysis?.title || null,
      ai_summary: analysis?.summary || null,
      incident_date: analysis?.incident_date || new Date().toISOString().split('T')[0],
      incident_time: analysis?.incident_time || null,
      location: analysis?.location || null,
      category: analysis?.category || null,
      severity: analysis?.severity || null,
      people_involved: analysis?.people_involved || [],
      exact_words: analysis?.exact_words || null,
      record_method: mode,
    };
    setSessionIncident(incident);
    setStep(STEP_SIGNUP);
  };

  // ─── Save as-written (analysis failed) ───
  const handleSaveAsWritten = () => {
    const incident: SessionIncident = {
      raw_narrative: narrative,
      incident_date: new Date().toISOString().split('T')[0],
      record_method: mode,
    };
    setSessionIncident(incident);
    setStep(STEP_SIGNUP);
  };

  // ─── Edit (back to record) ───
  const handleEdit = () => {
    setStep(STEP_RECORD);
    // Keep analysis cached temporarily but don't persist
  };

  // ─── Discard ───
  const handleDiscard = () => {
    setNarrative('');
    setAnalysis(null);
    setAnalysisFailed(false);
    setSessionIncident(null);
    setShowDiscard(false);
    setStep(STEP_RECORD);
  };

  // ─── Signup & persist ───
  const handleSignup = async () => {
    const newErrors: Record<string, string> = {};
    if (!email.trim()) newErrors.email = 'Email is required.';
    if (!password) newErrors.password = 'Password is required.';
    else if (password.length < 6) newErrors.password = 'At least 6 characters.';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSignupLoading(true);
    const { error } = await signUp(email, password);
    if (error) {
      setSignupLoading(false);
      toast({ title: 'Sign up failed', description: error.message, variant: 'destructive' });
      return;
    }

    // Try to sign in immediately (if auto-confirm is on)
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setSignupLoading(false);
      // Email confirmation required
      toast({ title: 'Account created', description: 'Check your email to confirm, then sign in.' });
      // Store incident for after login
      if (sessionIncident) {
        sessionStorage.setItem('chronicle-pending-incident', JSON.stringify(sessionIncident));
      }
      navigate('/login');
      return;
    }

    // Persist the incident
    if (sessionIncident) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          await supabase.from('incidents').insert({
            raw_narrative: sessionIncident.raw_narrative,
            incident_date: sessionIncident.incident_date || new Date().toISOString().split('T')[0],
            incident_time: sessionIncident.incident_time || null,
            location: sessionIncident.location || null,
            category: sessionIncident.category || null,
            severity: sessionIncident.severity || null,
            title: sessionIncident.title || null,
            ai_summary: sessionIncident.ai_summary || null,
            exact_words: sessionIncident.exact_words || null,
            record_method: sessionIncident.record_method,
            user_id: userData.user.id,
            people_involved: sessionIncident.people_involved || [],
            witnesses: [],
            tags: [],
          });
        }
      } catch {
        // Silent — incident will be lost but user is signed up
      }
    }

    setSignupLoading(false);
    toast({ title: 'Record saved', description: 'Your first record is on your timeline.' });
    navigate('/home');
  };

  // ─── Continue without account ───
  const handleSkip = () => {
    toast({ title: 'Record not saved', description: 'Sign up anytime to start recording.' });
    navigate('/login');
  };

  // ─── Confidence display helper ───
  const confidenceClass = (value: string | undefined | null) => {
    if (!value) return 'text-muted-foreground/40';
    if (value.length < 3) return 'text-muted-foreground/60';
    return 'text-foreground';
  };

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/15" />
      </div>

      <AnimatePresence mode="wait">
        {/* ═══ SCREEN 1: HOOK ═══ */}
        {step === STEP_HOOK && (
          <motion.div key="hook" {...fadeUp} className="flex flex-col items-center justify-center min-h-screen px-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mb-8"
            >
              <ChronicleLogo size={64} />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-[22px] font-bold text-foreground leading-tight mb-3"
            >
              Something didn't feel right.
            </motion.h1>

            <AnimatePresence>
              {showLine2 && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="text-[15px] text-muted-foreground leading-relaxed max-w-[280px]"
                >
                  You don't have to remember it later.
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-10 w-full max-w-xs"
            >
              <Button
                onClick={() => setStep(STEP_CAPTURE)}
                className="w-full h-12 rounded-xl text-[14px] font-semibold bg-primary text-primary-foreground"
              >
                Start a record
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* ═══ SCREEN 2: CAPTURE ═══ */}
        {step === STEP_CAPTURE && (
          <motion.div key="capture" {...fadeUp} className="flex flex-col items-center justify-center min-h-screen px-8 text-center relative">
            {/* Faint horizontal line */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-border/[0.08]" />

            <h1 className="text-[22px] font-bold text-foreground leading-tight mb-3 relative z-10">
              Capture what happened
            </h1>
            <p className="text-[15px] text-muted-foreground leading-relaxed max-w-[280px] relative z-10">
              while it's still clear.
            </p>

            <div className="mt-10 w-full max-w-xs relative z-10">
              <Button
                onClick={() => setStep(STEP_PATTERN)}
                className="w-full h-12 rounded-xl text-[14px] font-semibold bg-primary text-primary-foreground"
              >
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 3: PATTERN ═══ */}
        {step === STEP_PATTERN && (
          <motion.div key="pattern" {...fadeUp} className="flex flex-col items-center justify-center min-h-screen px-8 text-center relative">
            {/* Thin line with progressive dots */}
            <div className="absolute top-[46%] left-8 right-8 h-px bg-border/[0.06]" />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              transition={{ delay: 0.2 }}
              className="absolute top-[46%] left-[25%] w-2 h-2 rounded-full bg-primary -translate-y-1/2"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              transition={{ delay: 0.5 }}
              className="absolute top-[46%] left-[50%] w-2.5 h-2.5 rounded-full bg-primary -translate-y-1/2"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.25 }}
              transition={{ delay: 0.8 }}
              className="absolute top-[46%] left-[72%] w-3 h-3 rounded-full bg-primary -translate-y-1/2"
            />

            <h1 className="text-[22px] font-bold text-foreground leading-tight mb-3 relative z-10">
              Small moments add up.
            </h1>
            <p className="text-[15px] text-muted-foreground leading-relaxed max-w-[280px] relative z-10">
              Patterns become visible.
            </p>

            <div className="mt-10 w-full max-w-xs relative z-10">
              <Button
                onClick={() => setStep(STEP_TRUST)}
                className="w-full h-12 rounded-xl text-[14px] font-semibold bg-primary text-primary-foreground"
              >
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 4: TRUST ═══ */}
        {step === STEP_TRUST && (
          <motion.div key="trust" {...fadeUp} className="flex flex-col items-center justify-center min-h-screen px-8 text-center">
            <h1 className="text-[22px] font-bold text-foreground leading-tight mb-3">
              Your records stay private.
            </h1>
            <p className="text-[15px] text-foreground/80 leading-relaxed max-w-[280px]">
              Always under your control.
            </p>
            <p className="text-[12px] text-muted-foreground/50 mt-3 max-w-[260px]">
              Nothing is shared without your action
            </p>

            <div className="mt-10 w-full max-w-xs">
              <Button
                onClick={() => setStep(STEP_RECORD)}
                className="w-full h-12 rounded-xl text-[14px] font-semibold bg-primary text-primary-foreground"
              >
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 5: FIRST RECORD ═══ */}
        {step === STEP_RECORD && (
          <motion.div key="record" {...fadeUp} className="flex flex-col min-h-screen px-5 pt-12 pb-8 max-w-lg mx-auto">
            <h1 className="text-[22px] font-bold text-foreground mb-1">What happened?</h1>
            <p className="text-[12px] text-muted-foreground/60 mb-5">
              {analysis ? 'Editing your record' : 'Speak naturally or type — we\'ll turn it into a clear record'}
            </p>

            {/* Mode toggle */}
            <div className="flex bg-muted/50 rounded-lg p-0.5 gap-0.5 mb-5">
              <button
                onClick={() => setMode('voice')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-[13px] font-medium transition-colors ${
                  mode === 'voice' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Mic className="h-4 w-4" /> Voice
              </button>
              <button
                onClick={() => setMode('text')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-[13px] font-medium transition-colors ${
                  mode === 'text' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Keyboard className="h-4 w-4" /> Text
              </button>
            </div>

            {/* Text input */}
            <div className="writing-focus rounded-xl border border-border bg-card flex-1 min-h-0">
              <Textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Write what happened — include anything said, done, or noticed."
                className="min-h-[38vh] bg-transparent border-0 rounded-xl focus:ring-0 focus-visible:ring-0 text-[15px] leading-[1.7] shadow-none resize-none p-4"
              />
              {narrative.length > 0 && (
                <p className="text-[11px] text-muted-foreground/40 px-4 pb-2">{narrative.length} characters</p>
              )}
            </div>

            {/* Helper text */}
            {!hasText && (
              <p className="text-[11px] text-muted-foreground/40 text-center mt-3">
                No required fields · Just describe what happened
              </p>
            )}

            {/* Analyse CTA */}
            <div className="mt-5 space-y-3">
              {analysisFailed && hasText && (
                <Button
                  onClick={handleSaveAsWritten}
                  variant="outline"
                  className="w-full h-11 rounded-xl text-[13px] font-medium border-primary/20 text-primary"
                >
                  Save as written
                </Button>
              )}
              <Button
                onClick={handleAnalyse}
                disabled={!canAnalyse || analysing}
                className="w-full h-12 rounded-xl text-[14px] font-semibold bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] disabled:opacity-40"
              >
                {analysing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing…</>
                ) : (
                  'Analyse'
                )}
              </Button>
              {!canAnalyse && hasText && (
                <p className="text-[11px] text-muted-foreground/50 text-center">
                  Add a bit more detail to analyse
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 6: ANALYSIS PREVIEW ═══ */}
        {step === STEP_PREVIEW && analysis && (
          <motion.div key="preview" {...fadeUp} className="flex flex-col min-h-screen px-5 pt-10 pb-8 max-w-lg mx-auto">
            {/* Preview badge */}
            <div className="flex items-center gap-2 mb-5">
              <Eye className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                Preview — not saved
              </span>
            </div>

            <div className="space-y-4">
              {/* Title */}
              {analysis.title && (
                <div>
                  <p className="text-[11px] text-muted-foreground/50 mb-1">Title</p>
                  <h2 className="text-[17px] font-bold text-foreground leading-snug">{analysis.title}</h2>
                </div>
              )}

              {/* Summary */}
              {analysis.summary && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-[11px] text-muted-foreground/50 mb-1.5">Summary</p>
                  <p className="text-[14px] text-body leading-[1.7]">{analysis.summary}</p>
                </div>
              )}

              {/* Extracted fields */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <p className="text-[11px] text-muted-foreground/50 mb-1">Extracted details</p>
                
                {analysis.incident_date && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-[12px] text-muted-foreground">Date</span>
                    <span className={`text-[13px] font-medium ${confidenceClass(analysis.incident_date)}`}>
                      {analysis.incident_date}
                    </span>
                  </div>
                )}
                {analysis.incident_time && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-[12px] text-muted-foreground">Time</span>
                    <span className={`text-[13px] font-medium ${confidenceClass(analysis.incident_time)}`}>
                      {analysis.incident_time}
                    </span>
                  </div>
                )}
                {analysis.location && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-[12px] text-muted-foreground">Location</span>
                    <span className={`text-[13px] font-medium ${confidenceClass(analysis.location)}`}>
                      {analysis.location}
                    </span>
                  </div>
                )}
                {analysis.category && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-[12px] text-muted-foreground">Category</span>
                    <span className="text-[13px] font-medium text-foreground">{analysis.category}</span>
                  </div>
                )}
                {analysis.people_involved && analysis.people_involved.length > 0 && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-[12px] text-muted-foreground">People</span>
                    <span className="text-[13px] font-medium text-foreground">
                      {analysis.people_involved.join(', ')}
                    </span>
                  </div>
                )}

                {/* Low-confidence warning */}
                {(!analysis.incident_date && !analysis.location) && (
                  <p className="text-[11px] text-muted-foreground/50 italic pt-1">
                    Some details couldn't be detected — check before saving
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-auto pt-6 space-y-3">
              <Button
                onClick={handleSaveToSession}
                className="w-full h-12 rounded-xl text-[14px] font-semibold bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]"
              >
                <Check className="h-4 w-4 mr-2" /> Save record
              </Button>
              <div className="flex gap-3">
                <Button
                  onClick={handleEdit}
                  variant="outline"
                  className="flex-1 h-10 rounded-xl text-[13px] font-medium border-border"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
                <Button
                  onClick={() => setShowDiscard(true)}
                  variant="ghost"
                  className="flex-1 h-10 rounded-xl text-[13px] font-medium text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5 mr-1.5" /> Discard
                </Button>
              </div>
            </div>

            {/* Discard confirmation */}
            <AnimatePresence>
              {showDiscard && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6"
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-[var(--shadow-elevated)]"
                  >
                    <h3 className="text-[16px] font-bold text-foreground mb-2">Discard this record?</h3>
                    <p className="text-[13px] text-muted-foreground mb-5">This cannot be undone.</p>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => setShowDiscard(false)}
                        variant="outline"
                        className="flex-1 h-10 rounded-xl text-[13px]"
                      >
                        Keep editing
                      </Button>
                      <Button
                        onClick={handleDiscard}
                        variant="destructive"
                        className="flex-1 h-10 rounded-xl text-[13px]"
                      >
                        Discard
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══ SCREEN 7: ACCOUNT CREATION ═══ */}
        {step === STEP_SIGNUP && (
          <motion.div key="signup" {...fadeUp} className="flex flex-col min-h-screen px-6 pt-14 pb-8 max-w-lg mx-auto">
            {/* Save confirmation */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 mb-6 px-3 py-2.5 bg-primary/[0.06] border border-primary/10 rounded-xl"
            >
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-[13px] text-primary font-medium">Record saved</p>
            </motion.div>

            <h1 className="text-[20px] font-bold text-foreground mb-1">Save your record securely</h1>
            <p className="text-[13px] text-muted-foreground mb-6">
              Create an account to keep your records safe and accessible
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="signup-email" className="text-[13px] font-medium">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5 rounded-lg bg-card"
                />
                {errors.email && <p className="text-[12px] text-destructive mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="signup-password" className="text-[13px] font-medium">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 rounded-lg bg-card"
                />
                {errors.password && <p className="text-[12px] text-destructive mt-1">{errors.password}</p>}
              </div>

              <Button
                onClick={handleSignup}
                disabled={signupLoading}
                className="w-full h-12 rounded-xl text-[14px] font-semibold bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]"
              >
                {signupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {signupLoading ? 'Creating account…' : 'Create account'}
              </Button>

              <button
                onClick={handleSkip}
                className="w-full text-center text-[13px] text-muted-foreground/60 py-2 font-medium hover:text-muted-foreground transition-colors"
              >
                Continue without account
              </button>

              <p className="text-center text-[12px] text-muted-foreground/40 mt-2">
                Already have an account?{' '}
                <button onClick={() => {
                  if (sessionIncident) {
                    sessionStorage.setItem('chronicle-pending-incident', JSON.stringify(sessionIncident));
                  }
                  navigate('/login');
                }} className="text-primary font-medium">
                  Sign in
                </button>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OnboardingScreen;
