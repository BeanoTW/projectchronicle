import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, Clock, AlertCircle, Zap, ShieldAlert, TrendingUp, Lightbulb, FileText, Search } from 'lucide-react';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import { useInsightsEngine } from '@/hooks/useInsightsEngine';
import SummaryBuilderModal from '@/components/chronicle/SummaryBuilderModal';
import PageHeader from '@/components/chronicle/PageHeader';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const previewCategories = [
  { icon: Users, label: 'Repeated individuals', desc: 'People who appear across multiple records' },
  { icon: BarChart3, label: 'Common categories', desc: 'Which types of events come up most' },
  { icon: Clock, label: 'Time clusters', desc: 'Periods where events happened close together' },
  { icon: AlertCircle, label: 'Records without attachments', desc: 'Events that could be strengthened with evidence' },
  { icon: ShieldAlert, label: 'Witness presence', desc: 'Which records include or lack witnesses' },
];

const InsightsScreen = () => {
  const navigate = useNavigate();
  const { data: incidents = [], isLoading } = useIncidents();
  const { data: allEvidence = [] } = useEvidence();
  const [showSummaryBuilder, setShowSummaryBuilder] = useState(false);

  const {
    summaryLine,
    standoutSignals,
    guidanceHints,
    patternSignals,
    filteredActivityInsights,
    keyIndividuals,
    shouldSuppressPeopleExplanation,
    categoryPatterns,
    shouldSuppressCategoryExplanation,
    recordStrengthInsight,
    dataGaps,
  } = useInsightsEngine(incidents, allEvidence);

  if (isLoading) {
    return <div className="min-h-screen bg-background pb-24 flex items-center justify-center"><p className="text-muted-foreground text-[14px]">Loading...</p></div>;
  }

  /* ── Empty / insufficient data state ── */
  if (incidents.length < 2) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <PageHeader title="What your records show" />

        <div className="px-5 pt-2 pb-4 text-center">
          <Search className="h-9 w-9 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-[15px] font-semibold text-foreground mb-1">
            {incidents.length === 0 ? 'No records yet' : 'One record so far'}
          </h3>
          <p className="text-[13px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Patterns become clearer as you add more records. This screen will highlight what stands out across your entries.
          </p>
        </div>

        {/* Preview of what will appear */}
        <div className="px-5 mt-2">
          <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-3">
            What you'll see here
          </p>
          <div className="space-y-2.5 opacity-50 pointer-events-none select-none">
            {previewCategories.map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-card border border-border rounded-xl px-4 py-3">
                <item.icon className="h-4 w-4 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-foreground/70">{item.label}</p>
                  <p className="text-[12px] text-muted-foreground/60 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="What your records show" />

      {/* Summary bar */}
      <div className="mx-5 mb-4 px-4 py-3 bg-card border border-border rounded-xl">
        <p className="text-[13px] text-foreground font-medium">{summaryLine}</p>
      </div>

      {/* Generate summary entry */}
      <div className="mx-5 mb-6">
        <button
          onClick={() => setShowSummaryBuilder(true)}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors w-full text-left"
        >
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-foreground">Build a summary</p>
            <p className="text-[11px] text-muted-foreground">Create a structured narrative from your records</p>
          </div>
        </button>
      </div>

      {/* Accordion sections */}
      <div className="mx-5 mb-6">
        <Accordion type="multiple" defaultValue={['standout']} className="space-y-3">

          {standoutSignals.length > 0 && (
            <AccordionItem value="standout" className="border rounded-xl overflow-hidden bg-accent/[0.06] border-accent/20">
              <AccordionTrigger className="px-4 py-4 text-[15px] font-semibold text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent/15 text-accent-foreground">
                    <Zap className="h-3.5 w-3.5" />
                  </span>
                  What stands out
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 space-y-4">
                  {standoutSignals.map((signal) => (
                    <div key={signal.id}>
                      <p className="text-[13px] text-foreground font-semibold leading-relaxed">{signal.headline}</p>
                      <p className="text-[12px] text-muted-foreground/80 leading-relaxed mt-0.5">{signal.explanation}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {guidanceHints.length > 0 && (
            <AccordionItem value="guidance" className="border rounded-xl overflow-hidden bg-primary/[0.03] border-primary/15">
              <AccordionTrigger className="px-4 py-4 text-[15px] font-semibold text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                    <Lightbulb className="h-3.5 w-3.5" />
                  </span>
                  What this may help with
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 space-y-3">
                  {guidanceHints.map((hint) => (
                    <p key={hint.id} className="text-[13px] text-foreground/80 leading-relaxed">
                      {hint.text}
                    </p>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {patternSignals.length > 0 && (
            <AccordionItem value="signals" className="border rounded-xl overflow-hidden bg-accent/[0.04] border-accent/15">
              <AccordionTrigger className="px-4 py-4 text-[15px] font-semibold text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent/10 text-accent-foreground">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </span>
                  Pattern signals
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 space-y-4">
                  {patternSignals.map((signal) => (
                    <div key={signal.id}>
                      <p className="text-[13px] text-foreground font-semibold leading-relaxed">{signal.label}</p>
                      <p className="text-[12px] text-muted-foreground/80 leading-relaxed mt-0.5">{signal.explanation}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {filteredActivityInsights.length > 0 && (
            <AccordionItem value="activity" className="border rounded-xl overflow-hidden bg-primary/[0.03] border-primary/15">
              <AccordionTrigger className="px-4 py-4 text-[15px] font-semibold text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                  Activity over time
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 space-y-4">
                  {filteredActivityInsights.map((insight) => (
                    <div key={insight.id}>
                      <p className="text-[13px] text-foreground font-semibold leading-relaxed">{insight.fact}</p>
                      <p className="text-[12px] text-muted-foreground/80 leading-relaxed mt-0.5">{insight.explanation}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {keyIndividuals.length > 0 && (
            <AccordionItem value="people" className="border rounded-xl overflow-hidden bg-primary/[0.03] border-primary/15">
              <AccordionTrigger className="px-4 py-4 text-[15px] font-semibold text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  People appearing
                  <span className="text-[12px] text-muted-foreground font-normal">({keyIndividuals.length})</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 space-y-3">
                  {keyIndividuals.map(({ name, count, isTop }) => (
                    <button key={name} onClick={() => navigate(`/timeline?person=${encodeURIComponent(name)}`)} className="block w-full text-left">
                      <p className="text-[13px] text-foreground font-semibold">{name} — {count} record{count > 1 ? 's' : ''}</p>
                      {isTop && !shouldSuppressPeopleExplanation && (
                        <p className="text-[12px] text-muted-foreground/80 mt-0.5">This individual appears more than others in your records</p>
                      )}
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {categoryPatterns.length > 0 && (
            <AccordionItem value="categories" className="border rounded-xl overflow-hidden bg-primary/[0.03] border-primary/15">
              <AccordionTrigger className="px-4 py-4 text-[15px] font-semibold text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                    <BarChart3 className="h-3.5 w-3.5" />
                  </span>
                  Categories
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 space-y-3">
                  {categoryPatterns.slice(0, 5).map(({ category, count, isTop }) => (
                    <div key={category}>
                      <p className="text-[13px] text-foreground font-semibold">{category} — {count} record{count > 1 ? 's' : ''}</p>
                      {isTop && !shouldSuppressCategoryExplanation && (
                        <p className="text-[12px] text-muted-foreground/80 mt-0.5">This is the most common category in your records</p>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {recordStrengthInsight && (
            <AccordionItem value="strength" className="border rounded-xl overflow-hidden bg-muted/50 border-border">
              <AccordionTrigger className="px-4 py-4 text-[15px] font-semibold text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
                    <ShieldAlert className="h-3.5 w-3.5" />
                  </span>
                  Record strength
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10">
                  <p className="text-[13px] text-foreground font-semibold leading-relaxed">{recordStrengthInsight.fact}</p>
                  <p className="text-[12px] text-muted-foreground/80 leading-relaxed mt-0.5">{recordStrengthInsight.explanation}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {dataGaps.length > 0 && (
            <AccordionItem value="gaps" className="border rounded-xl overflow-hidden bg-muted/50 border-border">
              <AccordionTrigger className="px-4 py-4 text-[15px] font-semibold text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5" />
                  </span>
                  Things you could add
                  <span className="text-[11px] text-muted-foreground font-normal">(optional)</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 space-y-2">
                  {dataGaps.map((gap, i) => (
                    <button key={i} onClick={() => navigate(`/timeline?gap=${gap.filterKey}`)} className="w-full text-left py-2 hover:opacity-80 transition-opacity">
                      <p className="text-[13px] text-foreground">{gap.count} record{gap.count > 1 ? 's' : ''} with {gap.label}</p>
                      <p className="text-[12px] text-primary mt-0.5">{gap.action}</p>
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        <SummaryBuilderModal open={showSummaryBuilder} onClose={() => setShowSummaryBuilder(false)} incidents={incidents} />
      </div>
    </div>
  );
};

export default InsightsScreen;
