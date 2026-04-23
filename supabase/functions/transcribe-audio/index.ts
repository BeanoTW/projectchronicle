import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALLOWED_MIME_PREFIX = 'audio/';
const KNOWN_AUDIO_MIMES = [
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
  'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/aac',
  'audio/m4a', 'audio/x-m4a',
];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MIN_FILE_SIZE = 256; // bytes — silence/empty guard

type ErrorCode =
  | 'unauthorized'
  | 'method_not_allowed'
  | 'invalid_form'
  | 'no_audio_file'
  | 'empty_audio'
  | 'audio_too_large'
  | 'unsupported_format'
  | 'service_not_configured'
  | 'provider_error'
  | 'provider_rate_limited'
  | 'provider_payment_required'
  | 'unknown_error';

function jsonError(code: ErrorCode, message: string, status: number, details?: unknown) {
  return new Response(
    JSON.stringify({ error: message, code, details: details ?? null }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

function pickAudioFormat(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('webm')) return 'webm';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'mp4';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('flac')) return 'flac';
  return 'wav';
}

async function authenticateRequest(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn('[transcribe-audio] auth: missing bearer header');
    return jsonError('unauthorized', 'Unauthorized', 401);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) {
    console.error('[transcribe-audio] auth: SUPABASE_URL or SUPABASE_ANON_KEY missing');
    return jsonError('service_not_configured', 'Auth service not configured', 500);
  }
  try {
    const supabase = createClient(url, anon, {
      global: { headers: { authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
      console.warn('[transcribe-audio] auth: token rejected', { reason: error?.message });
      return jsonError('unauthorized', 'Unauthorized', 401);
    }
    return { userId: data.user.id };
  } catch (e) {
    console.error('[transcribe-audio] auth: unexpected error', { message: (e as Error)?.message });
    return jsonError('unauthorized', 'Unauthorized', 401);
  }
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // chunked to avoid call stack overflow on large arrays
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[transcribe-audio] request received', {
    method: req.method,
    contentType: req.headers.get('content-type'),
  });

  if (req.method !== 'POST') {
    return jsonError('method_not_allowed', 'Method not allowed', 405);
  }

  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    console.error('[transcribe-audio] invalid form-data', { message: (e as Error)?.message });
    return jsonError('invalid_form', 'Invalid request body', 400);
  }

  const audioFile = formData.get('audio');
  if (!audioFile || !(audioFile instanceof File) && !(audioFile instanceof Blob)) {
    console.warn('[transcribe-audio] no audio field in form');
    return jsonError('no_audio_file', 'No audio file provided', 400);
  }

  const file = audioFile as File;
  const fileSize = file.size ?? 0;
  const rawMime = (file.type || '').toLowerCase();
  const mimeType = rawMime || 'audio/webm';

  console.log('[transcribe-audio] file detected', {
    name: (file as File).name ?? 'unknown',
    mimeType,
    fileSize,
  });

  if (fileSize === 0) {
    console.warn('[transcribe-audio] empty audio payload');
    return jsonError('empty_audio', 'Audio file is empty', 400);
  }
  if (fileSize < MIN_FILE_SIZE) {
    console.warn('[transcribe-audio] audio too small to transcribe', { fileSize });
    return jsonError('empty_audio', 'Audio recording is too short to transcribe', 400);
  }
  if (fileSize > MAX_FILE_SIZE) {
    console.warn('[transcribe-audio] audio exceeds max size', { fileSize });
    return jsonError('audio_too_large', 'Audio file exceeds maximum size of 25MB', 400);
  }

  if (!mimeType.startsWith(ALLOWED_MIME_PREFIX)) {
    console.warn('[transcribe-audio] unsupported mime type', { mimeType });
    return jsonError('unsupported_format', 'Unsupported audio format', 400);
  }
  if (rawMime && !KNOWN_AUDIO_MIMES.some(m => mimeType.startsWith(m))) {
    // Not a hard fail — log and continue. Provider may still accept it.
    console.warn('[transcribe-audio] uncommon audio mime, attempting anyway', { mimeType });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('[transcribe-audio] LOVABLE_API_KEY missing — service not configured');
    return jsonError('service_not_configured', 'Transcription service not configured', 503);
  }

  // Decode audio to base64
  let base64Audio: string;
  try {
    const audioBuffer = await file.arrayBuffer();
    base64Audio = bufferToBase64(audioBuffer);
  } catch (e) {
    console.error('[transcribe-audio] failed to read audio buffer', { message: (e as Error)?.message });
    return jsonError('invalid_form', 'Could not read audio payload', 400);
  }

  const audioFormat = pickAudioFormat(mimeType);
  console.log('[transcribe-audio] provider request starting', { audioFormat });

  let response: Response;
  try {
    response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcribe this audio recording exactly as spoken. Output ONLY the transcription text, nothing else. No labels, no formatting, no commentary. If the audio is unclear or empty, respond with "[inaudible]".',
              },
              {
                type: 'input_audio',
                input_audio: { data: base64Audio, format: audioFormat },
              },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });
  } catch (e) {
    console.error('[transcribe-audio] provider network error', { message: (e as Error)?.message });
    return jsonError('provider_error', 'Transcription provider unreachable', 502);
  }

  console.log('[transcribe-audio] provider response received', { status: response.status });

  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch { /* ignore */ }
    if (response.status === 429) {
      console.warn('[transcribe-audio] provider rate limited');
      return jsonError('provider_rate_limited', 'Transcription temporarily unavailable, please try again later.', 429);
    }
    if (response.status === 402) {
      console.warn('[transcribe-audio] provider payment required');
      return jsonError('provider_payment_required', 'Transcription quota exceeded.', 402);
    }
    console.error('[transcribe-audio] provider error', { status: response.status, detailLength: detail.length });
    return jsonError('provider_error', 'Transcription failed', 502, { providerStatus: response.status });
  }

  let result: any;
  try {
    result = await response.json();
  } catch (e) {
    console.error('[transcribe-audio] provider returned non-JSON', { message: (e as Error)?.message });
    return jsonError('provider_error', 'Unexpected response from transcription service', 502);
  }

  const transcript = (result?.choices?.[0]?.message?.content ?? '').toString().trim();
  console.log('[transcribe-audio] transcription complete', { transcriptLength: transcript.length });

  return new Response(JSON.stringify({ transcript }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
