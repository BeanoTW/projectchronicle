import { FileText, Clock, Paperclip, Package, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const exportTypes = [
  {
    title: 'Incident Report',
    description: 'Export a single incident as a detailed PDF.',
    icon: FileText,
  },
  {
    title: 'Chronology',
    description: 'All incidents in chronological order with monthly grouping.',
    icon: Clock,
  },
  {
    title: 'Evidence Index',
    description: 'Table of all evidence with E-ref numbers and linked incidents.',
    icon: Paperclip,
  },
  {
    title: 'Full Case Bundle',
    description: 'Rep-ready bundle with cover page, timeline, evidence index, and full records.',
    icon: Package,
  },
];

const ExportScreen = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Export</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Generate reports from your recorded incidents. All exports include mandatory disclaimers.
        </p>
      </div>

      <div className="px-4 space-y-3">
        {exportTypes.map(({ title, description, icon: Icon }) => (
          <div key={title} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-xs text-body mt-0.5">{description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs border-primary text-primary h-9"
                  disabled
                >
                  <Download className="h-3 w-3 mr-1" />
                  Generate (requires Cloud)
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-4 mt-6 p-3 rounded-lg bg-muted">
        <p className="text-[10px] text-muted-foreground">
          Project Chronicle provides documentation support only — not legal advice. Always consult a qualified employment solicitor or union representative before taking formal action.
        </p>
      </div>
    </div>
  );
};

export default ExportScreen;
