import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { useRightsGuidance } from '@/hooks/useRightsGuidance';
import { useIncidents } from '@/hooks/useIncidents';
import PageHeader from '@/components/chronicle/PageHeader';
import MentalHealthSection from '@/components/chronicle/MentalHealthSection';
import { resolveCategory } from '@/lib/categories';

const sourceColors: Record<string, string> = {
  'ACAS': 'bg-primary/[0.08] text-primary border border-primary/[0.12]',
  'HSE': 'bg-severity-serious/[0.08] text-severity-serious border border-severity-serious/[0.12]',
  'gov.uk': 'bg-rep text-rep-foreground border border-rep-foreground/[0.12]',
  'Unite': 'bg-severity-low/[0.08] text-severity-low border border-severity-low/[0.12]',
  'NHS': 'bg-info/[0.08] text-info border border-info/[0.12]',
};

/* Fixed support services — never filtered, never reordered */
const FIXED_SUPPORT_SERVICES = [
  { name: 'ACAS', description: 'Free advice on workplace rights and disputes', url: 'https://www.acas.org.uk' },
  { name: 'Citizens Advice', description: 'Free guidance on a wide range of issues', url: 'https://www.citizensadvice.org.uk' },
  { name: 'Victim Support', description: 'Free support for anyone affected by crime', url: 'https://www.victimsupport.org.uk' },
  { name: 'Police (non-emergency)', description: 'Report incidents online or call 101', url: 'https://www.police.uk' },
];

/* Category group labels */
const CATEGORY_GROUPS: Record<string, string> = {
  'Verbal Comment': 'Communication',
  'Non-Verbal Behaviour': 'Behaviour',
  'Written Communication': 'Communication',
  'Work Allocation': 'Work',
  'Process / Procedure': 'Process',
  'Management Handling': 'Management',
  'Safety / Operational': 'Safety',
  'Other': 'General',
};

const SupportScreen = () => {
  const { data: allGuidance = [], isLoading: guidanceLoading } = useRightsGuidance();
  const { data: incidents = [], isLoading: incidentsLoading } = useIncidents();

  /* Category frequency map */
  const categoryFrequency = useMemo(() => {
    const freq: Record<string, { count: number; latestDate: string }> = {};
    incidents.forEach(i => {
      const cat = resolveCategory(i.category);
      if (!freq[cat]) {
        freq[cat] = { count: 0, latestDate: i.incident_date };
      }
      freq[cat].count++;
      if (i.incident_date > freq[cat].latestDate) {
        freq[cat].latestDate = i.incident_date;
      }
    });
    return freq;
  }, [incidents]);

  /* Primary matches: category appears ≥2 incidents */
  const primaryCategories = useMemo(() =>
    Object.entries(categoryFrequency)
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count || b[1].latestDate.localeCompare(a[1].latestDate))
      .map(([cat]) => cat),
    [categoryFrequency]
  );

  /* Secondary matches: category appears exactly 1 time */
  const secondaryCategories = useMemo(() =>
    Object.entries(categoryFrequency)
      .filter(([, v]) => v.count === 1)
      .sort((a, b) => b[1].latestDate.localeCompare(a[1].latestDate))
      .map(([cat]) => cat),
    [categoryFrequency]
  );

  /* Guidance matched to categories */
  const matchedGuidance = useMemo(() => {
    const allMatchedCats = [...primaryCategories, ...secondaryCategories];
    const results: { guidance: typeof allGuidance[0]; isPrimary: boolean; category: string }[] = [];
    const seen = new Set<string>();

    allMatchedCats.forEach(cat => {
      const isPrimary = primaryCategories.includes(cat);
      allGuidance
        .filter(g => g.incident_category === cat)
        .forEach(g => {
          const key = `${g.source}-${g.title}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ guidance: g, isPrimary, category: cat });
          }
        });
    });

    return results;
  }, [allGuidance, primaryCategories, secondaryCategories]);

  if (guidanceLoading || incidentsLoading) {
    return (
      <div className="min-h-screen bg-background pb-24 flex items-center justify-center">
        <p className="text-muted-foreground text-[14px]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader
        title="Support & Information"
        subtitle="Resources related to recorded events"
      />
      <p className="text-[13px] text-muted-foreground leading-relaxed px-5 -mt-2 mb-5 pl-[50px]">
        Includes external organisations and reference material
      </p>

      {/* Disclaimer */}
      <div className="mx-5 mb-7 px-4 py-2.5 rounded-lg border border-border">
        <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
          General information only — not legal advice.
        </p>
        <p className="text-[11px] text-muted-foreground/50 leading-relaxed mt-0.5">
          This section provides reference material only.
        </p>
      </div>

      {/* Related Information */}
      <div className="mx-5 mb-8">
        <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-4">
          Related information
        </p>

        {matchedGuidance.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              No specific information linked to recorded categories.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {matchedGuidance.map(({ guidance: g, isPrimary, category }) => (
              <a
                key={g.id}
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block bg-card border border-border rounded-2xl p-4 group ${!isPrimary ? 'opacity-80' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${sourceColors[g.source] || 'bg-muted text-muted-foreground'}`}>
                    {g.source}
                  </span>
                </div>
                <div className="mb-1.5">
                  <p className="text-[11px] text-muted-foreground/60 leading-snug">
                    {CATEGORY_GROUPS[category] || 'General'}
                  </p>
                  <p className="text-[11px] text-muted-foreground/50 leading-snug">
                    Category: {category}
                  </p>
                </div>
                <h3 className="text-[14px] font-semibold text-foreground leading-snug mb-0.5 group-hover:underline">
                  {g.title}
                </h3>
                {g.description && (
                  <p className="text-[13px] text-muted-foreground/70 leading-relaxed line-clamp-2 mb-1.5">
                    {g.description}
                  </p>
                )}
                <div className="flex items-center gap-1 text-[12px] text-primary font-medium">
                  View <ExternalLink className="h-3 w-3" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Support Services — fixed, global, static */}
      <div className="mx-5 mb-8">
        <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Support services
        </p>
        <p className="text-[13px] text-muted-foreground/70 leading-relaxed mb-4">
          Support services are available if you choose to access them.
        </p>
        <div className="space-y-2">
          {FIXED_SUPPORT_SERVICES.map(s => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 group"
            >
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-foreground leading-snug">{s.name}</h3>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0 ml-3 group-hover:text-primary transition-colors" />
            </a>
          ))}
        </div>
      </div>

      {/* Mental Health & Wellbeing */}
      <div className="mx-5 mb-8">
        <MentalHealthSection />
      </div>
    </div>
  );
};

export default SupportScreen;
