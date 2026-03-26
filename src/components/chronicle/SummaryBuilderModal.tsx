import { useState, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { X, ChevronRight, ChevronLeft, Check, Copy, RefreshCw, FileText, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Incident } from "@/hooks/useIncidents";
import {
  buildSummary,
  CONTEXT_OPTIONS,
  type SummaryContext,
  type SummaryOptions,
  type GeneratedSummary,
} from "@/lib/summaryBuilder";

interface Props {
  open: boolean;
  onClose: () => void;
  incidents: Incident[];
  preSelected?: string[];
}

type SummaryMode = "strict" | "expanded";

const SummaryBuilderModal = ({ open, onClose, incidents, preSelected }: Props) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preSelected || []));
  const [context, setContext] = useState<SummaryContext>("general");
  const [customLabel, setCustomLabel] = useState("");
  const [options, setOptions] = useState<SummaryOptions>({ includePatterns: true, includeNames: true });
  const [editedText, setEditedText] = useState("");
  const [generated, setGenerated] = useState<GeneratedSummary | null>(null);
  const [mode, setMode] = useState<SummaryMode>("strict");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterPerson, setFilterPerson] = useState<string | null>(null);

  const validIncidents = useMemo(
    () =>
      incidents
        .filter((i) => !i.voided_at)
        .sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime()),
    [incidents],
  );

  // Quick filter options
  const availableCategories = useMemo(
    () => [...new Set(validIncidents.map((i) => i.category).filter(Boolean))] as string[],
    [validIncidents],
  );

  const availablePeople = useMemo(
    () => [...new Set(validIncidents.flatMap((i) => i.people_involved).filter(Boolean))],
    [validIncidents],
  );

  const filteredIncidents = useMemo(() => {
    let list = validIncidents;
    if (filterCategory) list = list.filter((i) => i.category === filterCategory);
    if (filterPerson) list = list.filter((i) => i.people_involved.includes(filterPerson));
    return list;
  }, [validIncidents, filterCategory, filterPerson]);

  const selectedIncidents = useMemo(
    () => validIncidents.filter((i) => selectedIds.has(i.id)),
    [validIncidents, selectedIds],
  );

  const dateRange = useMemo(() => {
    if (selectedIncidents.length === 0) return null;
    const sorted = [...selectedIncidents].sort(
      (a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime(),
    );
    return {
      from: format(parseISO(sorted[0].incident_date), "d MMM yyyy"),
      to: format(parseISO(sorted[sorted.length - 1].incident_date), "d MMM yyyy"),
    };
  }, [selectedIncidents]);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const targetIds = filteredIncidents.map((i) => i.id);
    const allSelected = targetIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        targetIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        targetIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [filteredIncidents, selectedIds]);

  const generate = useCallback(() => {
    const result = buildSummary(selectedIncidents, context, customLabel, options);
    setGenerated(result);
    setEditedText(result.fullText);
    setStep(3);
  }, [selectedIncidents, context, customLabel, options]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(editedText).then(() => {
      toast.success("Summary copied to clipboard");
    });
  }, [editedText]);

  const regenerate = useCallback(() => {
    const result = buildSummary(selectedIncidents, context, customLabel, options);
    setGenerated(result);
    setEditedText(result.fullText);
    toast.success("Summary regenerated");
  }, [selectedIncidents, context, customLabel, options]);

  const clearFilters = useCallback(() => {
    setFilterCategory(null);
    setFilterPerson(null);
  }, []);

  if (!open) return null;

  const hasFilters = filterCategory || filterPerson;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h2 className="text-[18px] font-bold text-foreground">Build a summary</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {step === 1 && "Select incidents"}
            {step === 2 && "Choose context"}
            {step === 3 && "Review and edit"}
          </p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Progress */}
      <div className="px-5 pb-4 flex gap-1.5">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted/40"}`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-32">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              {/* Quick filters */}
              {(availableCategories.length > 1 || availablePeople.length > 0) && (
                <div className="mb-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                    <Filter className="h-3 w-3" /> Quick filters
                    {hasFilters && (
                      <button onClick={clearFilters} className="text-primary ml-auto text-[11px]">
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {availableCategories.slice(0, 5).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                          filterCategory === cat
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                    {availablePeople.slice(0, 3).map((person) => (
                      <button
                        key={person}
                        onClick={() => setFilterPerson(filterPerson === person ? null : person)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                          filterPerson === person
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        {person}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-medium text-foreground">
                  {selectedIds.size} incident{selectedIds.size !== 1 ? "s" : ""} selected
                </p>
                <button onClick={selectAll} className="text-[12px] text-primary font-medium">
                  {filteredIncidents.every((i) => selectedIds.has(i.id)) && filteredIncidents.length > 0
                    ? "Deselect all"
                    : "Select all"}
                </button>
              </div>

              {dateRange && selectedIds.size >= 2 && (
                <p className="text-[11px] text-muted-foreground mb-3">
                  From {dateRange.from} to {dateRange.to}
                </p>
              )}

              <div className="space-y-2">
                {filteredIncidents.map((inc) => (
                  <button
                    key={inc.id}
                    onClick={() => toggleId(inc.id)}
                    className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all duration-150 ${
                      selectedIds.has(inc.id)
                        ? "border-primary/30 bg-primary/[0.04]"
                        : "border-border bg-card hover:bg-muted/20"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <Checkbox checked={selectedIds.has(inc.id)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">
                          {inc.title || inc.category || "Untitled"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {format(parseISO(inc.incident_date), "d MMM yyyy")}
                          {inc.people_involved.length > 0 && ` · ${inc.people_involved.join(", ")}`}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              <p className="text-[13px] text-muted-foreground mb-4">
                This affects tone and framing only — not the content of your records.
              </p>

              <div className="space-y-2">
                {CONTEXT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setContext(opt.value)}
                    className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all duration-150 ${
                      context === opt.value
                        ? "border-primary/30 bg-primary/[0.04]"
                        : "border-border bg-card hover:bg-muted/20"
                    }`}
                  >
                    <p className="text-[13px] font-medium text-foreground">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{opt.description}</p>
                  </button>
                ))}
              </div>

              {context === "custom" && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="e.g. Housing dispute, community issue..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}

              {/* Options */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] text-foreground">Include pattern summary</label>
                  <Switch
                    checked={options.includePatterns}
                    onCheckedChange={(v) => setOptions((o) => ({ ...o, includePatterns: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-[13px] text-foreground">Include names</label>
                  <Switch
                    checked={options.includeNames}
                    onCheckedChange={(v) => setOptions((o) => ({ ...o, includeNames: v }))}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              {/* Selection info */}
              <div className="text-[12px] text-muted-foreground mb-3 space-y-0.5">
                <p className="font-medium text-foreground/70">
                  Based on {selectedIncidents.length} selected incident{selectedIncidents.length !== 1 ? "s" : ""}
                </p>
                {dateRange && (
                  <p>
                    Date range: {dateRange.from} – {dateRange.to}
                  </p>
                )}
              </div>

              {/* Mode toggle */}
              <div className="flex gap-1.5 mb-3">
                <button
                  onClick={() => {
                    setMode("strict");
                    regenerate();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 ${
                    mode === "strict"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  Structured summary
                </button>
                <button
                  onClick={() => {
                    setMode("expanded");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 ${
                    mode === "expanded"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  Expanded narrative
                </button>
              </div>

              {mode === "expanded" && (
                <p className="text-[11px] text-muted-foreground/60 mb-2 italic">
                  Editable — you may adjust phrasing freely
                </p>
              )}

              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
                <button
                  onClick={regenerate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 text-muted-foreground text-[12px] font-medium hover:bg-muted/60"
                >
                  <RefreshCw className="h-3 w-3" /> Regenerate
                </button>
              </div>

              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                readOnly={mode === "strict"}
                className={`w-full min-h-[400px] text-[14px] leading-7 font-sans whitespace-pre-wrap break-words border-border bg-card ${
  mode === 'strict' ? 'opacity-90' : ''
}`}
${mode === 'strict' ? 'opacity-90' : ''}
`}
                  mode === "strict" ? "opacity-90" : ""
                }`}
              />

              {mode === "strict" && (
                <p className="text-[11px] text-muted-foreground/50 mt-2">Switch to expanded narrative to edit</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer navigation */}
      <div className="sticky bottom-24 px-5 py-3 pb-4 flex items-center justify-between bg-transparent">
        {step > 1 ? (
          <Button variant="ghost" size="sm" onClick={() => setStep((step - 1) as 1 | 2)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        ) : (
          <div />
        )}

        {step === 1 && (
          <Button
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={() => setStep(2)}
            className="shadow-lg shadow-black/10"
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
        {step === 2 && (
          <Button size="sm" onClick={generate}>
            <FileText className="h-4 w-4 mr-1" /> Generate
          </Button>
        )}
        {step === 3 && (
          <Button size="sm" onClick={onClose}>
            <Check className="h-4 w-4 mr-1" /> Done
          </Button>
        )}
      </div>
    </div>
  );
};

export default SummaryBuilderModal;
