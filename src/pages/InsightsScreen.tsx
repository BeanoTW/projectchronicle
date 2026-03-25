import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, Clock, AlertCircle, Zap, ShieldAlert, TrendingUp } from 'lucide-react';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import { useInsightsEngine } from '@/hooks/useInsightsEngine';
import EmptyState from '@/components/chronicle/EmptyState';
import PageHeader from '@/components/chronicle/PageHeader';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const InsightsScreen = () => {
  const navigate = useNavigate();
  const { data: incidents = [], isLoading } = useIncidents();
  const { data: allEvidence = [] } = useEvidence();

  const {
    summaryLine,
    standoutSignals,
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

  if (incidents.length < 2) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-5 pt-8"><h1 className="text-[20px] font-semibold text-foreground">What your records show</h1></div>
        <EmptyState icon={<BarChart3 className="h-10 w-10" />} heading="Not enough data yet" body="Patterns will become clearer as you add more records." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="What your records show" />

      {/* Summary line */}
      <div className="mx-5 mb-5 px-4 py-3 bg-card border border-border rounded-xl">
        <p className="text-[13px] text-foreground font-medium">{summaryLine}</p>
      </div>

      {/* Accordion sections */}
      <div className="mx-5 mb-6">
        <Accordion type="multiple" defaultValue={['standout', 'activity']} className="space-y-2">

          {/* What stands out */}
          {standoutSignals.length > 0 && (
            <AccordionItem value="standout" className="border rounded-xl overflow-hidden bg-accent/[0.06] border-accent/20">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent/15 text-accent-foreground">
                    <Zap className="h-3.5 w-3.5" />
                  </span>
                  What stands out
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 space-y-3">
                  {standoutSignals.map((signal) => (
                    <div key={signal.id}>
                      <p className="text-[13px] text-foreground font-medium leading-relaxed">{signal.headline}</p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{signal.explanation}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Activity over time */}
          {filteredActivityInsights.length > 0 && (
            <AccordionItem value="activity" className="border rounded-xl overflow-hidden bg-primary/[0.03] border-primary/15">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                  Activity over time
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 space-y-3">
                  {filteredActivityInsights.map((insight) => (
                    <div key={insight.id}>
                      <p className="text-[13px] text-foreground font-medium leading-relaxed">{insight.fact}</p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{insight.explanation}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* People */}
          {keyIndividuals.length > 0 && (
            <AccordionItem value="people" className="border rounded-xl overflow-hidden bg-primary/[0.03] border-primary/15">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
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
                    <button
                      key={name}
                      onClick={() => navigate(`/timeline?person=${encodeURIComponent(name)}`)}
                      className="block w-full text-left"
                    >
                      <p className="text-[13px] text-foreground font-medium">
                        {name} — {count} record{count > 1 ? 's' : ''}
                      </p>
                      {isTop && !shouldSuppressPeopleExplanation && (
                        <p className="text-[12px] text-muted-foreground mt-0.5">This individual appears more than others in your records</p>
                      )}
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Categories */}
          {categoryPatterns.length > 0 && (
            <AccordionItem value="categories" className="border rounded-xl overflow-hidden bg-primary/[0.03] border-primary/15">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
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
                      <p className="text-[13px] text-foreground font-medium">{category} — {count} record{count > 1 ? 's' : ''}</p>
                      {isTop && !shouldSuppressCategoryExplanation && (
                        <p className="text-[12px] text-muted-foreground mt-0.5">This is the most common category in your records</p>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Record strength */}
          {recordStrengthInsight && (
            <AccordionItem value="strength" className="border rounded-xl overflow-hidden bg-muted/50 border-border">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
                    <ShieldAlert className="h-3.5 w-3.5" />
                  </span>
                  Record strength
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10">
                  <p className="text-[13px] text-foreground font-medium leading-relaxed">{recordStrengthInsight.fact}</p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{recordStrengthInsight.explanation}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Things you could add */}
          {dataGaps.length > 0 && (
            <AccordionItem value="gaps" className="border rounded-xl overflow-hidden bg-muted/50 border-border">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
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
                    <button
                      key={i}
                      onClick={() => navigate(`/timeline?gap=${gap.filterKey}`)}
                      className="w-full text-left py-2 hover:opacity-80 transition-opacity"
                    >
                      <p className="text-[13px] text-foreground">{gap.count} record{gap.count > 1 ? 's' : ''} with {gap.label}</p>
                      <p className="text-[12px] text-primary mt-0.5">{gap.action}</p>
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
    </div>
  );
};

export default InsightsScreen;
