export const CHRONICLE_MARK_VIEWBOX = '0 0 64 64';

// “The Bound Record”: a document page, folded corner, and chronological spine.
// Geometry is shared so app chrome, exports and future favicon assets can use
// the same mark without drifting into slightly different versions.
export const CHRONICLE_MARK = {
  page: 'M18 7.5H43.5L54 18v38.5H18z',
  fold: 'M43.5 7.5V18H54',
  spine: 'M18 15.5H11.5v33H18',
  timeline: 'M11.5 19.5v25',
  nodes: [19.5, 32, 44.5] as const,
};
