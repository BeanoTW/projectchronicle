import { ExternalLink } from 'lucide-react';

const services = [
  {
    name: 'Samaritans',
    description: 'Confidential emotional support, 24/7',
    url: 'https://www.samaritans.org',
    phone: '116 123',
  },
  {
    name: 'NHS mental health',
    description: 'Find NHS mental health services near you',
    url: 'https://www.nhs.uk/mental-health/',
  },
  {
    name: 'Mind',
    description: 'Mental health information and support',
    url: 'https://www.mind.org.uk',
  },
];

const MentalHealthSection = () => {
  return (
    <div>
      <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Mental health & wellbeing
      </p>
      <p className="text-[13px] text-muted-foreground/70 leading-relaxed mb-4">
        Recording difficult experiences can feel heavy. Support is always available.
      </p>
      <div className="space-y-2">
        {services.map(s => (
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
              {s.phone && (
                <p className="text-[11px] text-primary mt-0.5">Call {s.phone}</p>
              )}
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0 ml-3 group-hover:text-primary transition-colors" />
          </a>
        ))}
      </div>
    </div>
  );
};

export default MentalHealthSection;
