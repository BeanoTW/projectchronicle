import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Keyboard, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
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

const severities = ['Low', 'Moderate', 'Serious', 'Critical'];

const severityDescriptions: Record<string, string> = {
  Low: 'Minor or isolated issue',
  Moderate: 'Concerning behaviour — may form part of a pattern',
  Serious: 'Clear impact — may support a formal complaint',
  Critical: 'Significant issue — likely requires escalation',
};

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
  const [severity, setSeverity] = useState<string>('');
  const [peopleInvolved, setPeopleInvolved] = useState('');
  const [exactWords, setExactWords] = useState('');
  const [impactNote, setImpactNote] = useState('');
  const [title, setTitle] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [aiRelevance, setAiRelevance] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [analysing, setAnalysing] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [saving, setSaving] = useState(false);

  // Detect existing patterns for context
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

  // Check for similar incidents to show pattern alert
  const similarPatternAlert = useMemo(() => {
    if (existingIncidents.length < 2) return null;
    if (category) {
      const sameCategory = existingIncidents.filter(i => i.category === category).length;
      if (sameCategory >= 2) return `Similar incidents have been recorded (${sameCategory} in "${category}"). This may form part of a pattern.`;
    }
    const people = peopleInvolved.split(',').map(s => s.trim()).filter(Boolean);
    for (const person of people) {
      const count = existingIncidents.filter(i => i.people_involved.some(p => p.toLowerCase() === person.toLowerCase())).length;
      if (count >= 2) return `${person} appears in ${count} previous incidents. This may indicate a recurring issue.`;
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
      if (data.severity && !severity) setSeverity(data.severity);
      if (data.people_involved?.length && !peopleInvolved) setPeopleInvolved(data.people_involved.join(', '));
      if (data.exact_words && !exactWords) setExactWords(data.exact_words);
      if (data.summary) setAiSummary(data.summary);
      if (data.title && !title) setTitle(data.title);
      if (data.potential_relevance?.length) setAiRelevance(data.potential_relevance);

      setAiSuggested(true);
      setShowManualForm(true);
      toast({ title: 'AI analysis complete', description: 'Review the suggested fields below before saving.' });
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
        severity: severity || null,
        people_involved: peopleInvolved ? peopleInvolved.split(',').map(s => s.trim()).filter(Boolean) : [],
        witnesses: [],
        exact_words: exactWords || null,
        impact_note: impactNote || null,
        ai_summary: aiSummary || null,
        title: title || null,
        record_method: mode,
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
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Record Incident</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Capture what happened. Only your account and the date are required.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="px-4 mb-4">
        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => setMode('voice')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'voice' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Mic className="h-4 w-4" />
            Quick Entry
          </button>
          <button
            onClick={() => setMode('text')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'text' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Keyboard className="h-4 w-4" />
            Full Entry
          </button>
        </div>
      </div>

      {/* Prompt Cues */}
      <div className="px-4 mb-4">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="bg-muted px-2 py-1 rounded">When it happened</span>
          <span className="bg-muted px-2 py-1 rounded">Where</span>
          <span className="bg-muted px-2 py-1 rounded">Who was involved</span>
          <span className="bg-muted px-2 py-1 rounded">What was said or done</span>
        </div>
      </div>

      {/* Pattern Alert */}
      {similarPatternAlert && (
        <div className="mx-4 mb-4 px-3 py-2.5 rounded-lg bg-severity-serious/10 border border-severity-serious/20 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-severity-serious flex-shrink-0 mt-0.5" />
          <p className="text-xs text-severity-serious font-medium">{similarPatternAlert}</p>
        </div>
      )}

      <div className="px-4 space-y-4">
        {/* Narrative Input — shown for both modes */}
        <div>
          <Label htmlFor="narrative" className="text-sm font-medium text-foreground">
            Your account of the incident
          </Label>
          <Textarea
            id="narrative"
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder={mode === 'voice'
              ? 'Describe what happened…'
              : 'Include what happened, who was present, and anything said.'}
            className="mt-1 min-h-[160px] bg-card border-border focus:ring-primary"
          />
          {narrative.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{narrative.length} characters</p>
          )}
          {errors.raw_narrative && (
            <p className="text-xs text-destructive mt-1">{errors.raw_narrative}</p>
          )}
        </div>

        {/* AI Analysis Button */}
        <Button
          variant="outline"
          className="w-full border-primary text-primary"
          onClick={handleAnalyse}
          disabled={analysing || !narrative.trim()}
        >
          {analysing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing...</> : 'Analyse with AI'}
        </Button>

        {/* AI Summary Preview */}
        {aiSuggested && aiSummary && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="mb-2"><AILabel /></div>
            <p className="text-sm text-body">{aiSummary}</p>
            <button
              onClick={() => { setAiSummary(''); setAiSuggested(false); setAiRelevance([]); }}
              className="text-xs text-destructive mt-2"
            >
              Remove AI summary
            </button>
          </div>
        )}

        {/* AI Potential Relevance */}
        {aiSuggested && aiRelevance.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-foreground mb-2">Potential Relevance</h3>
            <div className="mb-1"><AILabel /></div>
            <div className="space-y-1.5">
              {aiRelevance.map((r, i) => (
                <p key={i} className="text-xs text-body">• {r}</p>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">This is not legal advice. These are neutral observations only.</p>
          </div>
        )}

        <button
          onClick={() => setShowManualForm(!showManualForm)}
          className="flex items-center gap-1 text-sm text-primary font-medium"
        >
          {showManualForm ? 'Hide details' : 'Fill in manually'}
          <ChevronRight className={`h-4 w-4 transition-transform ${showManualForm ? 'rotate-90' : ''}`} />
        </button>

        {/* Manual Form Fields */}
        {showManualForm && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-sm font-medium">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short title for this incident"
                className="mt-1 bg-card"
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
                  className="mt-1 bg-card"
                />
                {errors.incident_date && (
                  <p className="text-xs text-destructive mt-1">{errors.incident_date}</p>
                )}
              </div>
              <div>
                <Label htmlFor="time" className="text-sm font-medium">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={incidentTime}
                  onChange={(e) => setIncidentTime(e.target.value)}
                  className="mt-1 bg-card"
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
                className="mt-1 bg-card"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1 bg-card">
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
              <Label className="text-sm font-medium">Severity</Label>
              <div className="flex gap-2 mt-1">
                {severities.map(s => (
                  <button
                    key={s}
                    onClick={() => setSeverity(severity === s ? '' : s)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      severity === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-body border-border hover:border-primary/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {severity && (
                <p className="text-xs text-muted-foreground mt-1.5">{severityDescriptions[severity]}</p>
              )}
            </div>

            <div>
              <Label htmlFor="people" className="text-sm font-medium">People Involved</Label>
              <Input
                id="people"
                value={peopleInvolved}
                onChange={(e) => setPeopleInvolved(e.target.value)}
                placeholder="Comma-separated names (including witnesses)"
                className="mt-1 bg-card"
              />
            </div>

            <div>
              <Label htmlFor="exactWords" className="text-sm font-medium">
                Exact Wording <span className="text-destructive">(important)</span>
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-1">
                Include exact phrases, messages, or wording if possible.
              </p>
              <Textarea
                id="exactWords"
                value={exactWords}
                onChange={(e) => setExactWords(e.target.value)}
                placeholder="Include any exact spoken words, written wording, message text, or other wording directly relevant to the incident."
                className="min-h-[80px] bg-card"
              />
            </div>

            <div>
              <Label htmlFor="impact" className="text-sm font-medium">
                Impact <span className="font-normal text-muted-foreground">(what changed as a result?)</span>
              </Label>
              <Textarea
                id="impact"
                value={impactNote}
                onChange={(e) => setImpactNote(e.target.value)}
                placeholder="How did this affect you? What changed?"
                className="mt-1 min-h-[80px] bg-card"
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2 pb-6">
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground h-12">
            {saving ? 'Saving...' : 'Save Incident'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RecordScreen;
