/**
 * Shared request guards for Chronicle's AI edge functions.
 *
 * Two problems these solve:
 *  1. Unbounded payloads. Every AI function forwards user text straight to the
 *     model, so an oversized body turns into cost and timeouts. The body is
 *     read as text and measured before it is ever parsed.
 *  2. Raw error leakage. Internal messages can carry table names, constraint
 *     identifiers and record wording. Clients get a stable, generic message;
 *     the detail stays in the function log.
 */

/** Hard ceiling on any AI request body. Roughly 60k characters of narrative. */
export const MAX_BODY_BYTES = 64_000;

export type BodyResult<T> = { ok: true; body: T } | { ok: false; response: Response };

const json = (payload: unknown, status: number, corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Reads and size-limits a JSON body. Returns a ready-made 413/400 response
 * when the payload is too large or malformed.
 */
export async function readJsonBody<T = Record<string, unknown>>(
  req: Request,
  corsHeaders: Record<string, string>,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<BodyResult<T>> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: json({ error: 'Request too large' }, 413, corsHeaders) };
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { ok: false, response: json({ error: 'Invalid request' }, 400, corsHeaders) };
  }

  if (new TextEncoder().encode(raw).length > maxBytes) {
    return { ok: false, response: json({ error: 'Request too large' }, 413, corsHeaders) };
  }

  try {
    const parsed = JSON.parse(raw || '{}');
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, response: json({ error: 'Invalid request' }, 400, corsHeaders) };
    }
    return { ok: true, body: parsed as T };
  } catch {
    return { ok: false, response: json({ error: 'Invalid request' }, 400, corsHeaders) };
  }
}

/** Coerces an unknown value into a bounded string, or null when unusable. */
export const boundedString = (value: unknown, maxChars: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxChars);
};

/** Coerces an unknown value into a bounded array of strings. */
export const boundedStringArray = (value: unknown, maxItems: number, maxChars: number): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .slice(0, maxItems)
    .map(v => v.slice(0, maxChars));
};

/** Coerces an unknown value into a bounded array of plain objects. */
export const boundedObjectArray = <T>(value: unknown, maxItems: number): T[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(v => v && typeof v === 'object').slice(0, maxItems) as T[];
};

/**
 * Logs the real failure and returns a generic message to the caller.
 * `label` identifies the function in the logs only.
 */
export const genericError = (
  label: string,
  error: unknown,
  corsHeaders: Record<string, string>,
  status = 500,
  message = 'Something went wrong. Please try again.',
): Response => {
  console.error(`${label} failed:`, error instanceof Error ? error.message : error);
  return json({ error: message }, status, corsHeaders);
};
