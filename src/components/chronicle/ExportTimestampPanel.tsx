/**
 * ExportTimestampPanel — surfaces the export fingerprint and the status of
 * its independent trusted timestamp.
 *
 * Wording rules (strict):
 *   - Never claim legal proof, authenticity, or chain of custody.
 *   - Never imply the contents are verified — only the fingerprint.
 *   - When timestamping is unavailable, say so plainly.
 */
import { Fingerprint, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ExportTimestampRecord } from '@/lib/exportTimestamp';
import { describeTimestampStatus } from '@/lib/exportTimestamp';

interface Props {
  record: ExportTimestampRecord | null;
  loading?: boolean;
}

const ExportTimestampPanel = ({ record, loading }: Props) => {
  if (loading) {
    return (
      <div className="bg-muted/30 border border-border rounded-lg p-3">
        <p className="text-[12px] text-muted-foreground">Computing export fingerprint…</p>
      </div>
    );
  }
  if (!record) return null;

  const statusIcon = (() => {
    switch (record.status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-foreground/70" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-foreground/70" />;
      case 'pending': return <Clock className="h-4 w-4 text-foreground/70" />;
      case 'unavailable':
      default: return <Clock className="h-4 w-4 text-foreground/50" />;
    }
  })();

  const statusLabel = (() => {
    switch (record.status) {
      case 'success': return 'Independently timestamped';
      case 'failed': return 'Fingerprint recorded · independent timestamp failed';
      case 'pending': return 'Fingerprint recorded · independent timestamp pending';
      case 'unavailable':
      default: return 'Fingerprint recorded · independent timestamping not yet enabled';
    }
  })();

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <Fingerprint className="h-4 w-4 text-foreground/70 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-foreground">Export fingerprint</p>
          <p className="text-[10.5px] text-muted-foreground font-mono break-all mt-0.5 leading-relaxed">
            {record.exportHash}
          </p>
          <p className="text-[10.5px] text-muted-foreground/80 mt-1">
            Export ID: <span className="font-mono">{record.exportId.slice(0, 8).toUpperCase()}</span>
          </p>
          <p className="text-[10.5px] text-muted-foreground/80 mt-1.5 leading-relaxed">
            The fingerprint covers the export content above the integrity section.
          </p>
          <p className="text-[10.5px] text-muted-foreground/70 mt-0.5 leading-relaxed">
            The fingerprint was calculated before this integrity section was added.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 pt-2 border-t border-border/60">
        {statusIcon}
        <div className="flex-1">
          <p className="text-[12px] font-semibold text-foreground">{statusLabel}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
            {describeTimestampStatus(record)}
          </p>
          <p className="text-[10.5px] text-muted-foreground/70 leading-relaxed mt-1.5 italic">
            A fingerprint helps detect if the file changes later. It does not prove who wrote the records, where they came from, or that the contents are true.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExportTimestampPanel;
