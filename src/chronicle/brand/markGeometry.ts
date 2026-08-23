export const CHRONICLE_MARK_VIEWBOX = '0 0 64 64';

// “The Bound Folio”: two offset archival leaves, a brass spine, and three
// binding stitches. The silhouette stays legible without relying on a generic
// folded-corner document cue.
export const CHRONICLE_MARK = {
  back: 'M23 8.5H51.5V49.5H45',
  front: 'M15.5 15.5H44.5V56H15.5Z',
  spine: 'M15.5 19V52.5',
  stitches: [23, 36, 49] as const,
};
