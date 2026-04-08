/**
 * ExportBuilderModal — Sequence-aware export configuration
 *
 * Users can accept/modify/create sequences and configure export.
 * Sequences persist via localStorage across sessions.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { X, ChevronDown, ChevronRight, Plus, Unlink, Info, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Incident } from "@/hooks/useIncidents";
import type { FollowUpNote } from "@/hooks/useFollowUpNotes";
import type { EvidenceFile } from "@/hooks/useEvidence";
import IncidentRecordCard from "./IncidentRecordCard";
import {
  suggestSequences,
  loadSequenceConfig,
  saveSequenceConfig,
  confirmSequence,
  createManualSequence,
  removeSequence,
  updateSequenceTitle,
  revalidateSequences,
  buildExportItems,
  SEQUENCE_INTEGRITY_STATEMENT,
  type SequenceSuggestion,
  type SequenceConfig,
  type ConfirmedSequence,
  type ExportItem,
} from "@/lib/sequenceEngine";

interface ExportBuilderModalProps {
  open: boolean;
  onClose: () => void;
  incidents: Incident[];
  followUpNotes: FollowUpNote[];
  evidence: EvidenceFile[];
  onExport: (items: ExportItem[], config: SequenceConfig) => void;
  loading?: boolean;
}

const ExportBuilderModal = ({
  open,
  onClose,
  incidents,
  followUpNotes,
  evidence,
  onExport,
  loading,
}: ExportBuilderModalProps) => {
  const [config, setConfig] = useState<SequenceConfig>(() => {
    const loaded = loadSequenceConfig();
    return revalidateSequences(
      loaded,
      incidents.map((i) => i.id),
    );
  });

  const [suggestions, setSuggestions] = useState<SequenceSuggestion[]>([]);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [expandedSequence, setExpandedSequence] = useState<string | null>(null);
  const [manualSelectMode, setManualSelectMode] = useState(false);
  const [selectedForManual, setSelectedForManual] = useState<Set<string>>(new Set());
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState("");

  const activeIncidents = useMemo(() => incidents.filter((i) => !i.voided_at), [incidents]);

  // Generate suggestions on open
  useEffect(() => {
    if (open) {
      const confirmedIds = new Set(config.sequences.flatMap((s) => s.incident_ids));
      const raw = suggestSequences(activeIncidents);
      // Filter out already-confirmed sequences
      const filtered = raw.filter((s) => !s.incident_ids.every((id) => confirmedIds.has(id)));
      setSuggestions(filtered);
    }
  }, [open, activeIncidents, config.sequences]);

  const exportItems = useMemo(() => buildExportItems(activeIncidents, config), [activeIncidents, config]);

  const handleConfirmSuggestion = useCallback(
    (suggestion: SequenceSuggestion) => {
      const updated = confirmSequence(config, suggestion);
      setConfig(updated);
      saveSequenceConfig(updated);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    },
    [config],
  );

  const handleRemoveSequence = useCallback(
    (seqId: string) => {
      const updated = removeSequence(config, seqId);
      setConfig(updated);
      saveSequenceConfig(updated);
    },
    [config],
  );

  const handleRenameSequence = useCallback(
    (seqId: string) => {
      if (!titleInput.trim()) return;
      const updated = updateSequenceTitle(config, seqId, titleInput.trim());
      setConfig(updated);
      saveSequenceConfig(updated);
      setEditingTitle(null);
      setTitleInput("");
    },
    [config, titleInput],
  );

  const handleCreateManualSequence = useCallback(() => {
    if (selectedForManual.size < 2) return;
    const updated = createManualSequence(config, [...selectedForManual], activeIncidents);
    setConfig(updated);
    saveSequenceConfig(updated);
    setSelectedForManual(new Set());
    setManualSelectMode(false);
  }, [config, selectedForManual, activeIncidents]);

  const toggleManualSelect = useCallback((id: string) => {
    setSelectedForManual((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    onExport(exportItems, config);
  }, [exportItems, config, onExport]);

  if (!open) return null;

  const sequencedIds = new Set(config.sequences.flatMap((s) => s.incident_ids));
  const standaloneIncidents = activeIncidents
    .filter((i) => !sequencedIds.has(i.id))
    .sort((a, b) => a.incident_date.localeCompare(b.incident_date));

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 flex flex-col pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
        <div>
          <h2 className="text-[17px] font-bold text-foreground">Export Builder</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {activeIncidents.length} incident{activeIncidents.length !== 1 ? "s" : ""} · {config.sequences.length}{" "}
            sequence{config.sequences.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div>
            <p className="text-[12px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Suggested groupings
            </p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSuggestion(expandedSuggestion === s.id ? null : s.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    {expandedSuggestion === s.id ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground">{s.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.incident_ids.length} incidents
                        {s.reason.same_date && " · same date"}
                        {s.reason.time_proximity && " · time proximity"}
                      </p>
                      {s.needs_review && (
                        <p className="text-[11px] text-primary mt-0.5 font-medium">
                          Large sequence — review before confirming
                        </p>
                      )}
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedSuggestion === s.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 space-y-2">
                          {/* Reason */}
                          <div className="flex items-start gap-2 p-2.5 bg-muted/30 rounded-lg">
                            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="text-[11px] text-muted-foreground space-y-0.5">
                              {s.reason.same_date && <p>Same date</p>}
                              {s.reason.time_proximity && <p>Within {4} hours</p>}
                              {s.reason.supporting_signals.map((sig, i) => (
                                <p key={i}>{sig}</p>
                              ))}
                            </div>
                          </div>
                          {/* Incidents preview */}
                          {s.incident_ids.map((id) => {
                            const inc = activeIncidents.find((i) => i.id === id);
                            if (!inc) return null;
                            return (
                              <IncidentRecordCard
                                key={id}
                                incident={inc}
                                followUps={followUpNotes.filter((n) => n.incident_id === id)}
                                compact
                              />
                            );
                          })}
                          <Button
                            size="sm"
                            className="w-full text-[13px] h-9"
                            onClick={() => handleConfirmSuggestion(s)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Confirm grouping
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmed Sequences */}
        {config.sequences.length > 0 && (
          <div>
            <p className="text-[12px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Confirmed sequences
            </p>
            <div className="space-y-2">
              {config.sequences.map((seq) => (
                <div key={seq.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSequence(expandedSequence === seq.id ? null : seq.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    {expandedSequence === seq.id ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      {editingTitle === seq.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={titleInput}
                            onChange={(e) => setTitleInput(e.target.value)}
                            className="h-8 text-[13px]"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameSequence(seq.id);
                            }}
                            autoFocus
                          />
                          <Button size="sm" className="h-8 text-[12px]" onClick={() => handleRenameSequence(seq.id)}>
                            Save
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="text-[13px] font-semibold text-foreground">{seq.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {seq.incident_ids.length} incidents ·{" "}
                            {seq.source === "user" ? "Grouped by user" : "System suggested"}
                          </p>
                        </>
                      )}
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedSequence === seq.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 space-y-2">
                          {seq.incident_ids.map((id) => {
                            const inc = activeIncidents.find((i) => i.id === id);
                            if (!inc) return null;
                            return (
                              <IncidentRecordCard
                                key={id}
                                incident={inc}
                                followUps={followUpNotes.filter((n) => n.incident_id === id)}
                                compact
                              />
                            );
                          })}
                          <div className="flex gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[12px] h-8"
                              onClick={() => {
                                setEditingTitle(seq.id);
                                setTitleInput(seq.title);
                              }}
                            >
                              Rename
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[12px] h-8 text-destructive border-destructive/20"
                              onClick={() => handleRemoveSequence(seq.id)}
                            >
                              <Unlink className="h-3 w-3 mr-1" /> Ungroup
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual grouping */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
              {manualSelectMode ? "Select incidents to group" : "Ungrouped incidents"}
            </p>
            {!manualSelectMode && standaloneIncidents.length >= 2 && (
              <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => setManualSelectMode(true)}>
                <Plus className="h-3 w-3 mr-1" /> Group manually
              </Button>
            )}
          </div>

          {manualSelectMode && (
            <div className="flex gap-2 mb-3">
              <Button
                size="sm"
                className="text-[12px] h-8"
                disabled={selectedForManual.size < 2}
                onClick={handleCreateManualSequence}
              >
                Group {selectedForManual.size} selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-[12px] h-8"
                onClick={() => {
                  setManualSelectMode(false);
                  setSelectedForManual(new Set());
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            {standaloneIncidents.map((inc) => (
              <div key={inc.id} className="flex items-start gap-2">
                {manualSelectMode && (
                  <Checkbox
                    checked={selectedForManual.has(inc.id)}
                    onCheckedChange={() => toggleManualSelect(inc.id)}
                    className="mt-3 flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  <IncidentRecordCard
                    incident={inc}
                    followUps={followUpNotes.filter((n) => n.incident_id === inc.id)}
                    compact
                  />
                </div>
              </div>
            ))}
            {standaloneIncidents.length === 0 && (
              <p className="text-[12px] text-muted-foreground/60 py-3">All incidents are grouped into sequences.</p>
            )}
          </div>
        </div>

        {/* Integrity statement */}
        {config.sequences.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed italic">
              {SEQUENCE_INTEGRITY_STATEMENT}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border bg-card">
        <Button
          className="w-full h-12 text-[14px] font-semibold"
          onClick={handleExport}
          disabled={loading || activeIncidents.length === 0}
        >
          {loading ? "Generating..." : `Generate Export (${activeIncidents.length} incidents)`}
        </Button>
      </div>
    </div>
  );
};

export default ExportBuilderModal;
