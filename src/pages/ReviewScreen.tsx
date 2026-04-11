import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, Loader2, X, Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIncidents, useCreateIncident } from '@/hooks/useIncidents';
import { useCreateEditHistory } from '@/hooks/useEditHistory';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/chronicle/PageHeader';
import CategoryBadge from '@/components/chronicle/CategoryBadge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PRIMARY_CATEGORIES,
  SUBTYPES,
  CATEGORY_DEFINITIONS,
  type PrimaryCategory,
} from '@/lib/categories';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface ReviewDraft {
  narrative: string;
  title: string;
  incidentDate: string;
  incidentTime: string;
  location: string;
  category: string;
  subtype: string;
  categorySource: 'ai' | 'user' | null;
  contextDomain: string;
  peopleInvolved: string[];
  witnesses: string[];
  exactWords: string;
  impactNote: string;
  aiSummary: string;
  recordMethod: string;
  categoryConfidence?: 'high' | 'medium' | 'low';
  peopleConfidence?: 'high' | 'medium' | 'low' | 'none';
}

const ReviewScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const createIncident = useCreateIncident();
  const createEditHistory = useCreateEditHistory();
  const { data: existingIncidents = [] } = useIncidents();

  const draft = location.state?.draft as ReviewDraft | undefined;

  // If no draft, redirect back
  if (!draft) {
    navigate('/record', { replace: true });
    return null;
  }

  const [category, setCategory] = useState(draft.category || '');
  const [subtype, setSubtype] = useState(draft.subtype || '');
  const [categorySource, setCategorySource] = useState<'ai' | 'user' | null>(draft.categorySource);
  const [people, setPeople] = useState<string[]>(draft.peopleInvolved || []);
  const [newPerson, setNewPerson] = useState('');
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Previously used names for suggestions
  const previousNames = useMemo(() => {
    const names = new Set<string>();
    existingIncidents.forEach(i => i.people_involved?.forEach((p: string) => names.add(p)));
    // Remove names already in list
    people.forEach(p => names.delete(p));
    return Array.from(names).sort();
  }, [existingIncidents, people]);

  // Confidence signals
  const catConfidence = draft.categoryConfidence || (category ? 'high' : 'low');
  const peopleConf = draft.peopleConfidence || (people.length > 0 ? 'high' : 'none');

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    setCategorySource('user');
    // Check if current subtype is still valid
    const validSubs = SUBTYPES[newCat as PrimaryCategory] || [];
    if (!validSubs.includes(subtype)) {
      setSubtype('Unclassified');
    }
  };

  const handleRemovePerson = (name: string) => {
    setPeople(prev => prev.filter(p => p !== name));
  };

  const handleAddPerson = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Normalise casing
    const normalised = trimmed.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    if (!people.includes(normalised)) {
      setPeople(prev => [...prev, normalised]);
    }
    setNewPerson('');
    setShowAddPerson(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await createIncident.mutateAsync({
        raw_narrative: draft.narrative,
        incident_date: draft.incidentDate,
        incident_time: draft.incidentTime || null,
        location: draft.location || null,
        category: category || null,
        subtype: subtype || null,
        severity: null,
        people_involved: people,
        witnesses: draft.witnesses || [],
        exact_words: draft.exactWords || null,
        impact_note: draft.impactNote || null,
        ai_summary: draft.aiSummary || null,
        title: draft.title || null,
        record_method: draft.recordMethod,
        context_domain: draft.contextDomain || null,
        category_source: categorySource || 'ai',
      } as any);
      await createEditHistory.mutateAsync({
        incident_id: result.id,
        field_changed: 'incident_recorded',
      });
      localStorage.removeItem('chronicle-draft');
      setSaved(true);
      toast({ title: 'Record saved', description: 'Added to your timeline.' });
      setTimeout(() => navigate('/timeline'), 1200);
    } catch (e) {
      toast({ title: "Something didn't go through", description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const catDef = category ? CATEGORY_DEFINITIONS[category as PrimaryCategory] : null;

  return (
    <div className="min-h-screen pb-24 page-enter">
      <PageHeader
        title="Review"
        subtitle="Review your record before saving"
        onBack={() => navigate('/record', { state: { returnDraft: draft } })}
      />

      <div className="px-5 space-y-5">
        {/* Section 1 — Raw Narrative (read-only) */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Your account</Label>
          <p className="text-[14px] text-foreground leading-[1.7] mt-2 whitespace-pre-wrap">{draft.narrative}</p>
          {draft.exactWords && (
            <div className="mt-3 pt-3 border-t border-border">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Exact words recorded</Label>
              <p className="text-[13px] text-foreground italic leading-relaxed mt-1">"{draft.exactWords}"</p>
            </div>
          )}
        </div>

        {/* Section 2 — Structured Fields */}
        <div className="space-y-4">
          <p className="text-[11px] text-muted-foreground/60 text-center">Review your record before saving</p>

          {/* Category */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[13px] font-medium">Category</Label>
              {catConfidence === 'medium' && (
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Review suggested</span>
              )}
              {catConfidence === 'low' && (
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">No strong category match</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger className="rounded-lg flex-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {PRIMARY_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>
                      <div className="flex flex-col">
                        <span>{c === 'Other' ? 'Unclassified' : c}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {catDef && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground transition-colors" aria-label="Category info">
                      <Info className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 text-[12px] leading-relaxed" side="top">
                    <p className="font-medium text-foreground mb-1">{category === 'Other' ? 'Unclassified' : category}</p>
                    <p className="text-muted-foreground">{catDef.definition}</p>
                    <p className="text-muted-foreground/70 mt-1">Includes: {catDef.includes}</p>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {category && (
              <CategoryBadge category={category} subtype={subtype !== 'Unclassified' ? subtype : undefined} />
            )}

            {/* Subtype */}
            {category && SUBTYPES[category as PrimaryCategory] && (
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground">Subtype</Label>
                <Select value={subtype} onValueChange={(v) => { setSubtype(v); if (categorySource === 'ai') setCategorySource('user'); }}>
                  <SelectTrigger className="mt-1 rounded-lg">
                    <SelectValue placeholder="Select subtype" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBTYPES[category as PrimaryCategory].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* People Involved */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[13px] font-medium">People involved</Label>
              {peopleConf === 'none' && (
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">No people detected — add if relevant</span>
              )}
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-1.5">
              {people.map(person => (
                <button
                  key={person}
                  onClick={() => handleRemovePerson(person)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium bg-muted text-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group"
                >
                  {person}
                  <X className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}

              {!showAddPerson && (
                <button
                  onClick={() => setShowAddPerson(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              )}
            </div>

            {/* Add person input */}
            <AnimatePresence>
              {showAddPerson && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  {/* Suggestions from previous records */}
                  {previousNames.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {previousNames.slice(0, 8).map(name => (
                        <button
                          key={name}
                          onClick={() => handleAddPerson(name)}
                          className="px-2 py-0.5 rounded-full text-[11px] bg-primary/[0.06] text-primary hover:bg-primary/15 transition-colors"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={newPerson}
                      onChange={e => setNewPerson(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddPerson(newPerson); }}
                      placeholder="Name"
                      className="flex-1 h-9 rounded-lg text-[13px]"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddPerson(newPerson)}
                      disabled={!newPerson.trim()}
                      className="h-9 rounded-lg text-[12px]"
                    >
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setShowAddPerson(false); setNewPerson(''); }}
                      className="h-9 rounded-lg text-[12px] text-muted-foreground"
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Date/Time/Location summary (read-only context) */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Details</Label>
            <div className="grid grid-cols-2 gap-y-2 text-[13px]">
              <span className="text-muted-foreground">Date</span>
              <span className="text-foreground">{draft.incidentDate || '—'}</span>
              {draft.incidentTime && (
                <>
                  <span className="text-muted-foreground">Time</span>
                  <span className="text-foreground">{draft.incidentTime}</span>
                </>
              )}
              {draft.location && (
                <>
                  <span className="text-muted-foreground">Location</span>
                  <span className="text-foreground">{draft.location}</span>
                </>
              )}
              {draft.contextDomain && (
                <>
                  <span className="text-muted-foreground">Context</span>
                  <span className="text-foreground">{draft.contextDomain}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="pt-4 pb-8">
          <Button
            onClick={handleSave}
            disabled={saving || saved}
            className="w-full bg-primary text-primary-foreground h-12 rounded-xl text-[14px] font-semibold shadow-[var(--shadow-elevated)] active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:shadow-none"
          >
            {saved ? (
              <><Check className="h-4 w-4 mr-2" /> Saved</>
            ) : saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              'Save record'
            )}
          </Button>
          <AnimatePresence>
            {saved && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="mt-4 text-center space-y-1"
              >
                <p className="text-[14px] text-primary font-semibold">Record saved</p>
                <p className="text-[12px] text-muted-foreground/70">Added to your timeline</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ReviewScreen;
