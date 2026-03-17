const severityConfig: Record<string, { bg: string; text: string }> = {
  Critical: { bg: 'bg-severity-critical/10', text: 'text-severity-critical' },
  Serious: { bg: 'bg-severity-serious/10', text: 'text-severity-serious' },
  Moderate: { bg: 'bg-severity-moderate/10', text: 'text-severity-moderate' },
  Low: { bg: 'bg-severity-low/10', text: 'text-severity-low' },
};

interface SeverityBadgeProps {
  severity: string;
}

const SeverityBadge = ({ severity }: SeverityBadgeProps) => {
  const config = severityConfig[severity];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {severity}
    </span>
  );
};

export default SeverityBadge;
