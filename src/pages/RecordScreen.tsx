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
    <div className="min-h-screen bg-tint-record pb-24">
      <div className="px-4 pt-6 pb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Record Incident</h1>
          <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
            Take your time — write this in your own words. It doesn't need to be perfect.
          </p>
        </div>
        <button onClick={() => navigate('/settings')} className="p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Mode Toggle */}
      <div className="px-4 mb-5">
        <div className="flex bg-muted/70 rounded-xl p-1 gap-1">
          <button
            onClick={() => setMode('voice')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              mode === 'voice' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mic className="h-4 w-4" />
            Voice
          </button>
          <button
            onClick={() => setMode('text')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              mode === 'text' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Keyboard className="h-4 w-4" />
            Text
          </button>
        </div>
      </div>

      {/* Voice Mode - Inactive Mic */}
      {mode === 'voice' && (
        <div className="px-4 mb-6 flex flex-col items-center">
          <div className="w-28 h-28 rounded-full bg-muted/60 border-2 border-border/50 flex items-center justify-center mb-4 opacity-40 cursor-not-allowed">
            <Mic className="h-12 w-12 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground font-medium mb-1">Voice capture not yet available</p>
          <p className="text-xs text-muted-foreground/70">Use text entry below to record your incident</p>
        </div>
      )}

      {/* Prompt Cues */}
      <div className="px-4 mb-4">
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <span className="bg-muted/60 px-2.5 py-1 rounded-lg">When it happened</span>
          <span className="bg-muted/60 px-2.5 py-1 rounded-lg">Where</span>
          <span className="bg-muted/60 px-2.5 py-1 rounded-lg">Who was involved</span>
          <span className="bg-muted/60 px-2.5 py-1 rounded-lg">What happened? (include anything said or done)</span>
        </div>
      </div>

      {/* Pattern Alert */}
      {similarPatternAlert && (
        <div className="mx-4 mb-4 px-3.5 py-3 rounded-xl bg-severity-serious/8 border border-severity-serious/15 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-severity-serious flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-severity-serious font-medium leading-relaxed">{similarPatternAlert}</p>
        </div>
      )}

      <div className="px-4 space-y-5">
        {/* Narrative Input */}
        <div>
          <Label htmlFor="narrative" className="text-sm font-medium text-foreground">
            Your account of the incident
          </Label>
          <Textarea
            id="narrative"
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder="Write what happened in your own words — include anything said, done, or noticed."
            className="mt-1.5 min-h-[160px] bg-card/80 border-border rounded-xl focus:ring-primary focus:bg-card text-[15px] leading-relaxed transition-colors"
          />
          {narrative.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1.5">{narrative.length} characters</p>
          )}
          {errors.raw_narrative && (
            <p className="text-xs text-destructive mt-1">{errors.raw_narrative}</p>
          )}
        </div>

        {/* AI Analysis Button */}
        <Button
          variant="outline"
          className="w-full border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 rounded-xl h-11 font-medium shadow-sm"
          onClick={handleAnalyse}
          disabled={analysing || !narrative.trim()}
        >
          {analysing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing...</> : 'Generate Summary'}
        </Button>

        {/* AI Summary Preview */}
        {aiSuggested && aiSummary && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <div className="mb-1.5"><AILabel /></div>
            <p className="text-[11px] text-muted-foreground mb-3">Review and edit before saving.</p>
            <p className="text-[15px] text-body leading-relaxed">{aiSummary}</p>
            <button
              onClick={() => { setAiSummary(''); setAiSuggested(false); setAiRelevance([]); }}
              className="text-xs text-destructive mt-3 font-medium"
            >
              Remove summary
            </button>
          </div>
        )}

        {/* AI Potential Relevance */}
        {aiSuggested && aiRelevance.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <h3 className="text-xs font-semibold text-foreground mb-2">Potential Relevance</h3>
            <div className="mb-1.5"><AILabel /></div>
            <div className="space-y-2">
              {aiRelevance.map((r, i) => (
                <p key={i} className="text-[13px] text-body leading-relaxed flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0 mt-[7px]" />
                  {r}
                </p>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">This is not legal advice. These are neutral observations only.</p>
          </div>
        )}

        <button
          onClick={() => setShowManualForm(!showManualForm)}
          className="flex items-center gap-1.5 text-sm text-primary font-medium py-1"
        >
          {showManualForm ? 'Hide details' : 'Fill in manually'}
          <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${showManualForm ? 'rotate-90' : ''}`} />
        </button>

        {/* Manual Form Fields */}
        {showManualForm && (
          <div className="space-y-5">
            <div>
              <Label htmlFor="title" className="text-sm font-medium">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short title for this incident"
                className="mt-1.5 bg-card rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date" className="text-sm font-medium">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="mt-1.5 bg-card rounded-xl"
                />
                {errors.incident_date && (
                  <p className="text-xs text-destructive mt-1">{errors.incident_date}</p>
                )}
              </div>
              <div>
                <Label htmlFor="time" className="text-sm font-medium">Time</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-1">Approximate is fine.</p>
                <Input
                  id="time"
                  type="time"
                  value={incidentTime}
                  onChange={(e) => setIncidentTime(e.target.value)}
                  className="bg-card rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location" className="text-sm font-medium">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where did it happen?"
                className="mt-1.5 bg-card rounded-xl"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1.5 bg-card rounded-xl">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="people" className="text-sm font-medium">People Involved</Label>
              <Input
                id="people"
                value={peopleInvolved}
                onChange={(e) => setPeopleInvolved(e.target.value)}
                placeholder="Comma-separated names"
                className="mt-1.5 bg-card rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="witnesses" className="text-sm font-medium">Witnesses</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-1">Were any staff or customers present? Even if unnamed, this can help later.</p>
              <Input
                id="witnesses"
                value={witnesses}
                onChange={(e) => setWitnesses(e.target.value)}
                placeholder="Comma-separated names"
                className="bg-card rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="exactWords" className="text-sm font-medium">
                Exact wording <span className="text-primary font-normal">(important)</span>
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">
                Include key phrases or exact words if you remember them.
              </p>
              <Textarea
                id="exactWords"
                value={exactWords}
                onChange={(e) => setExactWords(e.target.value)}
                placeholder="What was said, written, or messaged?"
                className="min-h-[80px] bg-card rounded-xl text-[15px]"
              />
            </div>

            <div>
              <Label htmlFor="impact" className="text-sm font-medium">
                Impact <span className="font-normal text-muted-foreground">(what changed?)</span>
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">
                e.g. felt anxious, avoided area, affected work, raised concern
              </p>
              <Textarea
                id="impact"
                value={impactNote}
                onChange={(e) => setImpactNote(e.target.value)}
                placeholder="How did this affect you?"
                className="mt-0 min-h-[80px] bg-card rounded-xl text-[15px]"
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-3 pb-6">
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground h-12 rounded-xl text-sm font-semibold shadow-[var(--shadow-elevated)] active:scale-[0.98] transition-transform">
            {saving ? 'Saving...' : 'Save Record'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RecordScreen;
