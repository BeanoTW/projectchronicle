import { useState, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { X, ChevronRight, ChevronLeft, Check, Copy, RefreshCw, FileText, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { Incident } from "@/hooks/useIncidents";
import type { FollowUpNote } from "@/hooks/useFollowUpNotes";
import type { EvidenceFile } from "@/hooks/useEvidence";
import {
  generateSummary,
  type SummaryOptions,
  type SummaryResult,
} from "@/lib/summaryPipeline";

interface Props {
  open: boolean;
  onClose: () => void;
  incidents: Incident[];
  preSelected?: string[];
  followUpNotes?: FollowUpNote[];
  evidenceFiles?: EvidenceFile[];
}

const SummaryBuilderModal = ({ open, onClose, incidents, preSelected, followUpNotes = [], evidenceFiles = [] }: Props) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preSelected || []));
  const [options, setOptions] = useState<SummaryOptions>({ includePatterns: true, includeNames: true });
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterPerson, setFilterPerson] = useState<string | null>(null);

  const validIncidents = useMemo(
    () =>
      incidents
        .filter((i) => !i.voided_at)
        .sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime()),
    [incidents],
  );

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
    const result = generateSummary({
      incidents: validIncidents,
      selectedIds: Array.from(selectedIds),
      allIncidentCount: validIncidents.length,
      mode: 'structured-record',
      customPurpose: '',
      options,
      followUpNotes,
      evidenceFiles,
    });
    setSummaryResult(result);
    setStep(2);
  }, [validIncidents, selectedIds, options, followUpNotes, evidenceFiles]);

  const copyToClipboard = useCallback(() => {
    if (!summaryResult) return;
    navigator.clipboard.writeText(summaryResult.renderedText).then(() => {
      toast.success("Copied to clipboard");
    });
  }, [summaryResult]);

  const regenerate = useCallback(() => {
    const result = generateSummary({
      incidents: validIncidents,
      selectedIds: Array.from(selectedIds),
      allIncidentCount: validIncidents.length,
      mode: 'structured-record',
      customPurpose: '',
      options,
      followUpNotes,
      evidenceFiles,
    });
    setSummaryResult(result);
    toast.success("Regenerated");
  }, [validIncidents, selectedIds, options, followUpNotes, evidenceFiles]);

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
          <h2 className="text-[18px] font-bold text-foreground">Generate structured record</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {step === 1 && "Select records to include"}
            {step === 2 && "Review output"}
          </p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Progress */}
      <div className="px-5 pb-4 flex gap-1.5">
        {[1, 2].map((s) => (
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
                  {selectedIds.size} record{selectedIds.size !== 1 ? "s" : ""} selected
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
                          {displayTitle(inc)}
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

              {/* Options */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] text-foreground">Include activity breakdown</label>
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

          {step === 2 && summaryResult && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              {/* Selection info */}
              <div className="text-[12px] text-muted-foreground mb-3 space-y-0.5">
                <p className="font-medium text-foreground/70">
                  Based on {selectedIncidents.length} selected record{selectedIncidents.length !== 1 ? "s" : ""}
                  {summaryResult.selectedScope === 'manual' && ' (manual selection)'}
                </p>
                {dateRange && (
                  <p>
                    Date range: {dateRange.from} – {dateRange.to}
                  </p>
                )}
              </div>

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

              {/* Structured output — read-only */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-4">
                {summaryResult.sections.map((section) => (
                  <div key={section.key}>
                    {section.title && (
                      <p className="text-[12px] font-semibold text-foreground mb-1">{section.title}</p>
                    )}
                    {section.content && (
                      <p className="text-[13px] text-muted-foreground whitespace-pre-line leading-relaxed">{section.content}</p>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer navigation */}
      <div className="sticky bottom-24 px-5 py-3 pb-4 flex items-center justify-between bg-transparent">
        {step > 1 ? (
          <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        ) : (
          <div />
        )}

        {step === 1 && (
          <Button
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={generate}
            className="shadow-lg shadow-black/10"
          >
            <FileText className="h-4 w-4 mr-1" /> Generate structured record
          </Button>
        )}
        {step === 2 && (
          <Button size="sm" onClick={onClose}>
            <Check className="h-4 w-4 mr-1" /> Done
          </Button>
        )}
      </div>
    </div>
  );
};

export default SummaryBuilderModal;
