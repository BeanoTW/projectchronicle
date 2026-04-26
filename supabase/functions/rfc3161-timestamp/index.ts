/**
 * rfc3161-timestamp — Best-effort RFC 3161 trusted timestamping for an
 * export fingerprint.
 *
 * SECURITY RULES (must be preserved):
 *   - Accepts ONLY a 64-char lowercase hex SHA-256 hash. Anything else → 400.
 *   - Never logs the hash payload, headers, or response body content.
 *   - Never accepts HTML, narrative text, attachments, or any record content.
 *   - Failure NEVER throws to the client; always returns a structured JSON
 *     status so the export pipeline can continue uninterrupted.
 *
 * Configuration (env):
 *   RFC3161_TSA_URL          — TSA endpoint, e.g. "https://freetsa.org/tsr"
 *   RFC3161_TSA_NAME         — Display name, e.g. "freetsa.org"
 *   RFC3161_TSA_AUTH_HEADER  — Optional "Header: value" forwarded to TSA
 *
 * If RFC3161_TSA_URL is missing → returns { status: "unavailable" }.
 *
 * Response shape (success):
 *   { status: "success", authority, timestampAt, token, tokenFormat }
 * Response shape (failure / unavailable):
 *   { status: "failed" | "unavailable", authority: null, timestampAt: null,
 *     token: null, note: "<safe reason>" }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const HEX64 = /^[0-9a-f]{64}$/;

// ───────────────────── ASN.1 / DER minimal encoder ──────────────────────
// Just enough to build an RFC 3161 TimeStampReq:
//   TimeStampReq ::= SEQUENCE {
//     version           INTEGER (1),
//     messageImprint    SEQUENCE { hashAlgorithm AlgorithmIdentifier, hashedMessage OCTET STRING },
//     reqPolicy         OBJECT IDENTIFIER OPTIONAL,
//     nonce             INTEGER OPTIONAL,
//     certReq           BOOLEAN DEFAULT FALSE,
//     extensions        [0] IMPLICIT Extensions OPTIONAL
//   }

function encodeLength(len: number): Uint8Array {
  if (len < 0x80) return new Uint8Array([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) { bytes.unshift(n & 0xff); n >>>= 8; }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function tlv(tag: number, value: Uint8Array): Uint8Array {
  const len = encodeLength(value.length);
  const out = new Uint8Array(1 + len.length + value.length);
  out[0] = tag;
  out.set(len, 1);
  out.set(value, 1 + len.length);
  return out;
}

function encInteger(n: number | Uint8Array): Uint8Array {
  let bytes: number[];
  if (typeof n === 'number') {
    if (n === 0) bytes = [0];
    else {
      bytes = [];
      let x = n;
      while (x > 0) { bytes.unshift(x & 0xff); x = Math.floor(x / 256); }
      // Ensure positive (high bit clear)
      if (bytes[0] & 0x80) bytes.unshift(0);
    }
  } else {
    bytes = Array.from(n);
    if (bytes.length === 0) bytes = [0];
    if (bytes[0] & 0x80) bytes = [0, ...bytes];
  }
  return tlv(0x02, new Uint8Array(bytes));
}

function encOctetString(b: Uint8Array): Uint8Array { return tlv(0x04, b); }
function encNull(): Uint8Array { return new Uint8Array([0x05, 0x00]); }
function encSequence(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { buf.set(p, off); off += p.length; }
  return tlv(0x30, buf);
}

// OID encoder
function encOid(oid: string): Uint8Array {
  const parts = oid.split('.').map((x) => parseInt(x, 10));
  const first = 40 * parts[0] + parts[1];
  const out: number[] = [first];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    const stack: number[] = [];
    do { stack.unshift(v & 0x7f); v >>>= 7; } while (v > 0);
    for (let j = 0; j < stack.length - 1; j++) stack[j] |= 0x80;
    out.push(...stack);
  }
  return tlv(0x06, new Uint8Array(out));
}

const OID_SHA256 = '2.16.840.1.101.3.4.2.1';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function buildTimeStampReq(hashHex: string): Uint8Array {
  const hashBytes = hexToBytes(hashHex);
  const algId = encSequence(encOid(OID_SHA256), encNull());
  const messageImprint = encSequence(algId, encOctetString(hashBytes));

  // Random 8-byte positive nonce
  const nonceBytes = new Uint8Array(8);
  crypto.getRandomValues(nonceBytes);
  nonceBytes[0] &= 0x7f; // ensure positive
  const nonce = encInteger(nonceBytes);

  // certReq = TRUE so the TSA includes its certificate
  const certReq = new Uint8Array([0x01, 0x01, 0xff]);

  return encSequence(encInteger(1), messageImprint, nonce, certReq);
}

// ────────────────── Minimal DER parser (genTime extraction) ─────────────
// Walks the TimeStampResp → TimeStampToken (CMS SignedData) → TSTInfo
// looking for the first GeneralizedTime (tag 0x18) which is genTime.

function parseLength(buf: Uint8Array, off: number): { len: number; next: number } {
  const first = buf[off];
  if ((first & 0x80) === 0) return { len: first, next: off + 1 };
  const n = first & 0x7f;
  let len = 0;
  for (let i = 0; i < n; i++) len = (len << 8) | buf[off + 1 + i];
  return { len, next: off + 1 + n };
}

function findFirstGeneralizedTime(buf: Uint8Array): string | null {
  // Recursive walk of constructed types looking for tag 0x18 (GeneralizedTime).
  let off = 0;
  while (off < buf.length) {
    if (off + 2 > buf.length) return null;
    const tag = buf[off];
    const { len, next } = parseLength(buf, off + 1);
    const end = next + len;
    if (end > buf.length) return null;
    if (tag === 0x18) {
      const s = new TextDecoder().decode(buf.slice(next, end));
      return generalizedTimeToIso(s);
    }
    // Constructed (bit 0x20) — recurse
    if ((tag & 0x20) !== 0 || (tag & 0xc0) !== 0) {
      const inner = findFirstGeneralizedTime(buf.slice(next, end));
      if (inner) return inner;
    }
    off = end;
  }
  return null;
}

function generalizedTimeToIso(s: string): string | null {
  // Forms: YYYYMMDDHHMMSSZ, YYYYMMDDHHMMSS.fffZ
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se, frac] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${se}${frac ?? ''}Z`;
}

// Extract the TimeStampToken (ContentInfo) from the TimeStampResp.
// TimeStampResp ::= SEQUENCE { status PKIStatusInfo, timeStampToken TimeStampToken OPTIONAL }
function extractTokenFromResp(resp: Uint8Array): Uint8Array | null {
  if (resp[0] !== 0x30) return null;
  const { len, next } = parseLength(resp, 1);
  const end = next + len;
  // Skip status (SEQUENCE)
  let off = next;
  if (resp[off] !== 0x30) return null;
  const statusLen = parseLength(resp, off + 1);
  off = statusLen.next + statusLen.len;
  if (off >= end) return null;
  // Remaining is the TimeStampToken (ContentInfo SEQUENCE 0x30)
  if (resp[off] !== 0x30) return null;
  const tokLen = parseLength(resp, off + 1);
  return resp.slice(off, tokLen.next + tokLen.len);
}

function getStatusValue(resp: Uint8Array): number | null {
  // First field of inner SEQUENCE is PKIStatusInfo SEQUENCE { status INTEGER, ... }
  if (resp[0] !== 0x30) return null;
  const outer = parseLength(resp, 1);
  let off = outer.next;
  if (resp[off] !== 0x30) return null;
  const status = parseLength(resp, off + 1);
  off = status.next;
  if (resp[off] !== 0x02) return null;
  const intLen = parseLength(resp, off + 1);
  let v = 0;
  for (let i = 0; i < intLen.len; i++) v = (v << 8) | resp[intLen.next + i];
  return v;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

// ───────────────────────────── Handler ──────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Auth — accept any valid Supabase user.
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Strict input validation. The hash is the ONLY accepted field.
  let body: { hash?: unknown };
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const hash = typeof body.hash === 'string' ? body.hash.toLowerCase() : '';
  if (!HEX64.test(hash)) {
    return new Response(JSON.stringify({ error: 'hash must be 64-char SHA-256 hex' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const tsaUrl = Deno.env.get('RFC3161_TSA_URL');
  const tsaName = Deno.env.get('RFC3161_TSA_NAME') ?? (tsaUrl ? new URL(tsaUrl).hostname : null);
  const tsaAuth = Deno.env.get('RFC3161_TSA_AUTH_HEADER');

  if (!tsaUrl) {
    return new Response(JSON.stringify({
      status: 'unavailable',
      authority: null, timestampAt: null, token: null,
      note: 'No timestamp authority configured',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Build & POST the TimeStampReq.
  try {
    const tsq = buildTimeStampReq(hash);
    const headers: Record<string, string> = {
      'Content-Type': 'application/timestamp-query',
      'Accept': 'application/timestamp-reply',
    };
    if (tsaAuth && tsaAuth.includes(':')) {
      const idx = tsaAuth.indexOf(':');
      headers[tsaAuth.slice(0, idx).trim()] = tsaAuth.slice(idx + 1).trim();
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    let resp: Response;
    try {
      resp = await fetch(tsaUrl, {
        method: 'POST', headers, body: tsq, signal: ctrl.signal,
      });
    } finally { clearTimeout(timer); }

    if (!resp.ok) {
      return new Response(JSON.stringify({
        status: 'failed', authority: tsaName, timestampAt: null, token: null,
        note: `TSA returned HTTP ${resp.status}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tsrBytes = new Uint8Array(await resp.arrayBuffer());
    const statusVal = getStatusValue(tsrBytes);
    if (statusVal !== 0 && statusVal !== 1) {
      return new Response(JSON.stringify({
        status: 'failed', authority: tsaName, timestampAt: null, token: null,
        note: `TSA rejected request (PKIStatus=${statusVal ?? 'unknown'})`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tokenBytes = extractTokenFromResp(tsrBytes);
    if (!tokenBytes) {
      return new Response(JSON.stringify({
        status: 'failed', authority: tsaName, timestampAt: null, token: null,
        note: 'TSA response did not contain a TimeStampToken',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const genTime = findFirstGeneralizedTime(tokenBytes);
    const timestampAt = genTime ?? new Date().toISOString();

    return new Response(JSON.stringify({
      status: 'success',
      authority: tsaName,
      timestampAt,
      token: bytesToBase64(tokenBytes),
      tokenFormat: 'rfc3161-tsr-base64',
      note: genTime ? null : 'genTime not parsed; using server receive time',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'TSA request error';
    return new Response(JSON.stringify({
      status: 'failed', authority: tsaName, timestampAt: null, token: null,
      note: msg.slice(0, 200),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
