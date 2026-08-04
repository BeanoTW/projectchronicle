import type { PrototypeEntry } from './db';

const daysAgo = (n: number, h = 9, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const dateOnly = (iso: string) => iso.slice(0, 10);

export function seedEntries(): PrototypeEntry[] {
  const rows: Array<Partial<PrototypeEntry> & { original_text: string; days: number; hour?: number }> = [
    {
      original_text:
        "Manager raised voice again in the team stand-up when I asked about the deadline change. Two colleagues went quiet. I felt singled out.",
      days: 1, hour: 10,
      category: 'Bullying', context: 'Team meeting', people: ['Line manager', 'Sam'], title: 'Raised voice in stand-up',
    },
    {
      original_text:
        "HR replied to my email from last week. They said they will 'look into it' but gave no timeline. Copied it to my personal notes.",
      days: 3, hour: 14,
      category: 'HR response', context: 'Email', people: ['HR'], title: null,
    },
    {
      original_text:
        "Overheard comment about my accent in the kitchen. Two people laughed. Not sure they realised I could hear.",
      days: 5, hour: 12,
    },
    {
      original_text:
        "Was excluded from the project kick-off invite. Only found out when a colleague forwarded the notes. This is the third time.",
      days: 8, hour: 9,
      category: 'Exclusion', people: ['Line manager'],
    },
    {
      original_text:
        "One-to-one moved for the fourth week running. No new date offered.",
      days: 12, hour: 16,
      category: 'Pattern', people: ['Line manager'],
    },
    {
      original_text:
        "Positive: colleague pulled me aside and said they had noticed the meeting behaviour too. Offered to be a witness if needed.",
      days: 14, hour: 17,
      people: ['Sam'],
    },
  ];

  return rows.map((r, i) => {
    const sealed = daysAgo(r.days, r.hour ?? 10);
    return {
      id: `proto-${i + 1}`,
      original_text: r.original_text,
      sealed_at: sealed,
      captured_at: sealed,
      category: r.category ?? null,
      context: r.context ?? null,
      people: r.people ?? [],
      event_date: dateOnly(sealed),
      event_time: null,
      clarifications: [],
      in_dossier: i < 4,
      title: r.title ?? null,
    };
  });
}
