import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Keyboard, ChevronRight, Loader2, AlertTriangle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useIncidents, useCreateIncident } from '@/hooks/useIncidents';
import { useCreateEditHistory } from '@/hooks/useEditHistory';
import { useToast } from '@/hooks/use-toast';
import AILabel from '@/components/chronicle/AILabel';
import { supabase } from '@/integrations/supabase/client';

const categories = [
  'Verbal Comment', 'Written Communication', 'Safety Concern',
  'Scheduling or Shift Change', 'Disciplinary Meeting',
  'Management Conduct', 'Pay or Payroll Issue',
  'Policy Application', 'Workplace Meeting', 'Other',
];

const RecordScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: existingIncidents = [] } = useIncidents();
  const createIncident = useCreateIncident();
  const createEditHistory = useCreateEditHistory();
  const { toast } = useToast();

  const [mode, setMode] = useState<'voice' | 'text'>('text');
  const [showManualForm, setShowManualForm] = useState(false);
  const [narrative, setNarrative] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<string>('');
  const [peopleInvolved, setPeopleInvolved] = useState('');
  const [witnesses, setWitnesses] = useState('');
  const [exactWords, setExactWords] = useState('');
  const [impactNote, setImpactNote] = useState('');
  const [title, setTitle] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [aiRelevance, setAiRelevance] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [analysing, setAnalysing] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [saving, setSaving] = useState(false);

  const existingPatterns = useMemo(() => {
    const result: string[] = [];
    const peopleCounts: Record<string, number> = {};
    existingIncidents.forEach(i => i.people_involved.forEach(p => { peopleCounts[p] = (peopleCounts[p] || 0) + 1; }));
    Object.entries(peopleCounts).filter(([, c]) => c >= 2).forEach(([name, count]) => {
      result.push(`${name} appears in ${count} recorded incidents.`);
    });
    const catCounts: Record<string, number> = {};
    existingIncidents.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    Object.entries(catCounts).filter(([, c]) => c >= 3).forEach(([cat, count]) => {
      result.push(`${count} incidents relate to ${cat}.`);
    });
    return result;
  }, [existingIncidents]);

  const similarPatternAlert = useMemo(() => {
    if (existingIncidents.length < 2) return null;
    if (category) {
      const sameCategory = existingIncidents.filter(i => i.category === category).length;
      if (sameCategory >= 2) return `${sameCategory} previous incidents recorded under "${category}".`;
    }
    const people = peopleInvolved.split(',').map(s => s.trim()).filter(Boolean);
    for (const person of people) {
      const count = existingIncidents.filter(i => i.people_involved.some(p => p.toLowerCase() === person.toLowerCase())).length;
      if (count >= 2) return `${person} appears in ${count} previous incidents.`;
    }
    return null;
  }, [category, peopleInvolved, existingIncidents]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!narrative.trim()) newErrors.raw_narrative = 'Please enter your account of the incident.';
    if (!incidentDate) newErrors.incident_date = 'Please select the incident date.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAnalyse = async () => {
    if (!narrative.trim()) {
      setErrors({ raw_narrative: 'Please enter your account first.' });
      return;
    }
    setAnalysing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyse-incident', {
        body: { narrative, existingPatterns: existingPatterns.length > 0 ? existingPatterns : undefined },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.incident_date && !incidentDate) setIncidentDate(data.incident_date);
      if (data.incident_time && !incidentTime) setIncidentTime(data.incident_time);
      if (data.location && !location) setLocation(data.location);
      if (data.category && !category) setCategory(data.category);
      if (data.people_involved?.length && !peopleInvolved) setPeopleInvolved(data.people_involved.join(', '));
      if (data.exact_words && !exactWords) setExactWords(data.exact_words);
      if (data.summary) setAiSummary(data.summary);
      if (data.title && !title) setTitle(data.title);
      if (data.potential_relevance?.length) setAiRelevance(data.potential_relevance);

      setAiSuggested(true);
      setShowManualForm(true);
      toast({ title: 'Analysis complete', description: 'Review the suggested fields below before saving.' });
    } catch (e) {
      toast({ title: 'Analysis failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setAnalysing(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const result = await createIncident.mutateAsync({
        raw_narrative: narrative,
        incident_date: incidentDate,
        incident_time: incidentTime || null,
        location: location || null,
        category: category || null,
        severity: null,
        people_involved: peopleInvolved ? peopleInvolved.split(',').map(s => s.trim()).filter(Boolean) : [],
        witnesses: witnesses ? witnesses.split(',').map(s => s.trim()).filter(Boolean) : [],
        exact_words: exactWords || null,
        impact_note: impactNote || null,
        ai_summary: aiSummary || null,
        title: title || null,
        record_method: 'text',
      });

      await createEditHistory.mutateAsync({
        incident_id: result.id,
        field_changed: 'incident_recorded',
      });

      toast({ title: 'Incident saved' });
      navigate('/timeline');
    } catch (e) {
      toast({ title: 'Failed to save', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <div className="px-5 pt-8 pb-5 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">Record Incident</h1>
          <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed max-w-[280px]">
            Take your time — write this in your own words. It doesn't need to be perfect.
          </p>
        </div>
        <button onClick={() => navigate('/settings')} className="p-2 -mr-1 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50">
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Mode Toggle */}
      <div className="px-5 mb-5">
        <div className="flex bg-muted/50 rounded-lg p-1 gap-1">
          <button
            onClick={() => setMode('voice')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'voice' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mic className="h-4 w-4" />
            Voice
          </button>
          <button
            onClick={() => setMode('text')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'text' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Keyboard className="h-4 w-4" />
            Text
          </button>
        </div>
      </div>

      {/* Voice Mode */}
      {mode === 'voice' && (
        <div className="px-5 mb-6 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-muted/40 border-2 border-border/30 flex items-center justify-center mb-4 opacity-30 cursor-not-allowed">
            <Mic className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground font-medium mb-1">Voice capture not yet available</p>
          <p className="text-xs text-muted-foreground/60">Use text entry to record your incident</p>
        </div>
      )}

      {/* Prompt Cues */}
      <div className="px-5 mb-4">
        <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
          <span className="bg-muted/40 px-2.5 py-1.5 rounded-md">When it happened</span>
          <span className="bg-muted/40 px-2.5 py-1.5 rounded-md">Where</span>
          <span className="bg-muted/40 px-2.5 py-1.5 rounded-md">Who was involved</span>
          <span className="bg-muted/40 px-2.5 py-1.5 rounded-md">What happened?</span>
        </div>
      </div>

      {/* Pattern Alert */}
      {similarPatternAlert && (
        <div className="mx-5 mb-4 px-4 py-3 rounded-lg bg-warm-accent-light border border-warm-accent/12 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-warm-accent flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-warm-accent-foreground font-medium leading-relaxed">{similarPatternAlert}</p>
        </div>
      )}

      <div className="px-5 space-y-5">
        {/* Narrative Input */}
        <div className="writing-focus rounded-xl border border-border p-1 transition-all duration-200">
          <Label htmlFor="narrative" className="text-[13px] font-medium text-foreground/80 px-3 pt-2 block">
            Your account
          </Label>
          <Textarea
            id="narrative"
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder="Write what happened in your own words — include anything said, done, or noticed."
            className="min-h-[200px] bg-transparent border-0 rounded-lg focus:ring-0 focus-visible:ring-0 text-[15px] leading-[1.75] shadow-none resize-none"
          />
          {narrative.length > 0 && (
            <p className="text-[11px] text-muted-foreground/50 px-3 pb-2">{narrative.length} characters</p>
          )}
        </div>
        {errors.raw_narrative && (
          <p className="text-xs text-destructive -mt-3">{errors.raw_narrative}</p>
        )}

        {/* Generate Summary */}
        <Button
          variant="outline"
          className="w-full border-primary/20 text-primary bg-primary/4 hover:bg-primary/8 rounded-xl h-11 font-medium transition-colors"
          onClick={handleAnalyse}
          disabled={analysing || !narrative.trim()}
        >
          {analysing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing...</> : 'Generate Summary'}
        </Button>

        {/* AI Summary */}
        {aiSuggested && aiSummary && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <div className="mb-1"><AILabel /></div>
            <p className="text-[11px] text-muted-foreground mb-2.5">Structured summary (for review)</p>
            <p className="text-[15px] text-body leading-[1.75]">{aiSummary}</p>
            <button
              onClick={() => { setAiSummary(''); setAiSuggested(false); setAiRelevance([]); }}
              className="text-xs text-destructive/70 mt-3 font-medium hover:text-destructive transition-colors"
            >
              Remove summary
            </button>
          </div>
        )}

        {/* AI Relevance */}
        {aiSuggested && aiRelevance.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <h3 className="text-xs font-semibold text-foreground mb-2">Potential Relevance</h3>
            <div className="mb-1"><AILabel /></div>
            <div className="space-y-2">
              {aiRelevance.map((r, i) => (
                <p key={i} className="text-[13px] text-body leading-relaxed">{r}</p>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-2.5">This is not legal advice. These are neutral observations only.</p>
          </div>
        )}

        <button
          onClick={() => setShowManualForm(!showManualForm)}
          className="flex items-center gap-1.5 text-sm text-primary font-medium py-1"
        >
          {showManualForm ? 'Hide details' : 'Fill in manually'}
          <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${showManualForm ? 'rotate-90' : ''}`} />
        </button>

        {/* Manual Form */}
        {showManualForm && (
          <div className="space-y-5 bg-card rounded-xl p-4 border border-border shadow-[var(--shadow-card)]">
            <div>
              <Label htmlFor="title" className="text-sm font-medium">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title for this incident" className="mt-1.5 rounded-lg" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date" className="text-sm font-medium">Date *</Label>
                <Input id="date" type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className="mt-1.5 rounded-lg" />
                {errors.incident_date && <p className="text-xs text-destructive mt-1">{errors.incident_date}</p>}
              </div>
              <div>
                <Label htmlFor="time" className="text-sm font-medium">Time</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-1">Approximate is fine.</p>
                <Input id="time" type="time" value={incidentTime} onChange={(e) => setIncidentTime(e.target.value)} className="rounded-lg" />
              </div>
            </div>

            <div>
              <Label htmlFor="location" className="text-sm font-medium">Location</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where did it happen?" className="mt-1.5 rounded-lg" />
            </div>

            <div>
              <Label className="text-sm font-medium">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1.5 rounded-lg"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="people" className="text-sm font-medium">People Involved</Label>
              <Input id="people" value={peopleInvolved} onChange={(e) => setPeopleInvolved(e.target.value)} placeholder="Comma-separated names" className="mt-1.5 rounded-lg" />
            </div>

            <div>
              <Label htmlFor="witnesses" className="text-sm font-medium">Witnesses</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-1">Were any staff or customers present? Even if unnamed, this can help later.</p>
              <Input id="witnesses" value={witnesses} onChange={(e) => setWitnesses(e.target.value)} placeholder="Comma-separated names" className="rounded-lg" />
            </div>

            <div>
              <Label htmlFor="exactWords" className="text-sm font-medium">
                Exact wording <span className="text-primary font-normal">(important)</span>
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">Include key phrases or exact words if you remember them.</p>
              <Textarea id="exactWords" value={exactWords} onChange={(e) => setExactWords(e.target.value)} placeholder="What was said, written, or messaged?" className="min-h-[80px] rounded-lg text-[15px]" />
            </div>

            <div>
              <Label htmlFor="impact" className="text-sm font-medium">
                Impact <span className="font-normal text-muted-foreground">(what changed?)</span>
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">e.g. felt anxious, avoided area, affected work, raised concern</p>
              <Textarea id="impact" value={impactNote} onChange={(e) => setImpactNote(e.target.value)} placeholder="How did this affect you?" className="min-h-[80px] rounded-lg text-[15px]" />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 pb-8">
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground h-12 rounded-xl text-sm font-semibold shadow-[var(--shadow-elevated)] active:scale-[0.98] transition-all duration-200">
            {saving ? 'Saving...' : 'Save Record'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RecordScreen;
