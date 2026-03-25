import { ExternalLink } from 'lucide-react';
import type { RightsGuidance } from '@/hooks/useRightsGuidance';

interface RightsCardsProps {
  groupedRights: Record<string, { category: string; types: string[] }[]>;
  relevantGuidance: RightsGuidance[];
  sourceColors: Record<string, string>;
}

const RightsCards = ({ groupedRights, relevantGuidance, sourceColors }: RightsCardsProps) => {
  return (
    <div className="space-y-6">
      {Object.entries(groupedRights).map(([groupName, items]) => (
        <div key={groupName}>
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {groupName}
          </p>
          <div className="space-y-3">
            {items.map(item => {
              const guidance = relevantGuidance.filter(g => g.incident_category === item.category);
              return (
                <div
                  key={item.category}
                  className="bg-card border border-border rounded-2xl p-4 shadow-[var(--shadow-card)]"
                >
                  <p className="text-[11px] text-muted-foreground/60 mb-1">{item.category}</p>
                  <h3 className="text-[15px] font-semibold text-foreground mb-1 leading-snug">
                    {item.types[0] && item.types[0].charAt(0).toUpperCase() + item.types[0].slice(1)}
                  </h3>
                  {item.types.length > 1 && (
                    <p className="text-[13px] text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                      Also relates to {item.types.slice(1).join(', ')}
                    </p>
                  )}
                  {guidance.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      {guidance.slice(0, 2).map(g => (
                        <a
                          key={g.id}
                          href={g.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between py-1.5 group"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceColors[g.source] || 'bg-muted text-muted-foreground'}`}>
                              {g.source}
                            </span>
                            <span className="text-[13px] text-foreground group-hover:underline line-clamp-1">{g.title}</span>
                          </div>
                          <ExternalLink className="h-3 w-3 text-muted-foreground/50 flex-shrink-0 ml-2" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RightsCards;
