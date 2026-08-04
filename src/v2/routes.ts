// Chronicle V2 (candidate) route map.
//
// V2 currently mounts at V2_BASE. `/prototype/*` remains as a compatibility
// redirect so existing bookmarks keep working during the transition; see
// docs/v2/route-transition.md for the planned production cutover.
export const V2_BASE = '/v2';

export const V2_LEGACY_BASE = '/prototype';

export const v2Path = {
  notebook: `${V2_BASE}/notebook`,
  capture: `${V2_BASE}/capture`,
  dossier: `${V2_BASE}/dossier`,
  entry: (id: string) => `${V2_BASE}/entry/${id}`,
  review: (id: string) => `${V2_BASE}/review/${id}`,
} as const;
