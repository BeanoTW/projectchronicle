import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Keyboard, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { IncidentCategory, IncidentSeverity } from '@/types/incident';

const categories: IncidentCategory[] = [
  'Verbal Comment', 'Written Communication', 'Safety Concern',
  'Scheduling or Shift Change', 'Disciplinary Meeting',
  'Management Conduct', 'Pay or Payroll Issue',
  'Policy Application', 'Workplace Meeting', 'Other',
];

const severities: IncidentSeverity[] = ['Low', 'Moderate', 'Serious', 'Critical'];

const RecordScreen = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'voice' | 'text'>('text');
  const [showManualForm, setShowManualForm] = useState(false);
  const [narrative, setNarrative] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<string>('');
  const [severity, setSeverity] = useState<string>('');
  const [peopleInvolved, setPeopleInvolved] = useState('');
  const [witnesses, setWitnesses] = useState('');
  const [exactWords, setExactWords] = useState('');
  const [impactNote, setImpactNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!narrative.trim()) newErrors.raw_narrative = 'Please enter your account of the incident.';
    if (!incidentDate) newErrors.incident_date = 'Please select the incident date.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    // TODO: Save to database via Lovable Cloud
    navigate('/timeline');
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
            Voice
          </button>
          <button
            onClick={() => setMode('text')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'text' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Keyboard className="h-4 w-4" />
            Text
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

      <div className="px-4 space-y-4">
        {mode === 'voice' ? (
          <div className="flex flex-col items-center py-12">
            <button className="w-24 h-24 rounded-full bg-primary flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors">
              <Mic className="h-10 w-10 text-primary-foreground" />
            </button>
            <p className="text-sm text-muted-foreground mt-4">Tap to start recording</p>
            <p className="text-xs text-muted-foreground mt-1">Voice recording will be available with Lovable Cloud</p>
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor="narrative" className="text-sm font-medium text-foreground">
                Your account of the incident
              </Label>
              <Textarea
                id="narrative"
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="What happened? Include when, where, who was involved, and what was said or done."
                className="mt-1 min-h-[160px] bg-card border-border focus:ring-primary"
              />
              {narrative.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{narrative.length} characters</p>
              )}
              {errors.raw_narrative && (
                <p className="text-xs text-destructive mt-1">{errors.raw_narrative}</p>
              )}
            </div>

            {/* AI button placeholder */}
            <Button variant="outline" className="w-full border-primary text-primary" disabled>
              Analyse with AI (coming soon)
            </Button>

            <button
              onClick={() => setShowManualForm(!showManualForm)}
              className="flex items-center gap-1 text-sm text-primary font-medium"
            >
              {showManualForm ? 'Hide details' : 'Fill in manually'}
              <ChevronRight className={`h-4 w-4 transition-transform ${showManualForm ? 'rotate-90' : ''}`} />
            </button>
          </>
        )}

        {/* Manual Form Fields */}
        {(showManualForm || mode === 'voice') && (
          <div className="space-y-4">
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
            </div>

            <div>
              <Label htmlFor="people" className="text-sm font-medium">People Involved</Label>
              <Input
                id="people"
                value={peopleInvolved}
                onChange={(e) => setPeopleInvolved(e.target.value)}
                placeholder="Comma-separated names"
                className="mt-1 bg-card"
              />
            </div>

            <div>
              <Label htmlFor="witnesses" className="text-sm font-medium">Witnesses</Label>
              <Input
                id="witnesses"
                value={witnesses}
                onChange={(e) => setWitnesses(e.target.value)}
                placeholder="Comma-separated names"
                className="mt-1 bg-card"
              />
            </div>

            <div>
              <Label htmlFor="exactWords" className="text-sm font-medium">
                Relevant Wording <span className="font-normal text-muted-foreground">(verbatim where possible)</span>
              </Label>
              <Textarea
                id="exactWords"
                value={exactWords}
                onChange={(e) => setExactWords(e.target.value)}
                placeholder="Include any exact spoken words, written wording, message text, or other wording directly relevant to the incident."
                className="mt-1 min-h-[80px] bg-card"
              />
            </div>

            <div>
              <Label htmlFor="impact" className="text-sm font-medium">Impact Note</Label>
              <Textarea
                id="impact"
                value={impactNote}
                onChange={(e) => setImpactNote(e.target.value)}
                placeholder="How did this affect you?"
                className="mt-1 min-h-[80px] bg-card"
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2 pb-6">
          <Button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground h-12">
            Save Incident
          </Button>
          <Button variant="outline" className="flex-1 border-primary text-primary h-12" disabled>
            Attach Evidence
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RecordScreen;
