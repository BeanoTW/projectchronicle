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
  | 'auth_verification_failed'
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

const AUTH_METHOD = 'getUser';

function jsonError(code: ErrorCode, message: string, status: number, details?: unknown) {
  return new Response(
    JSON.stringify({ error: message, code, details: details ?? null }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

function logEvent(level: 'info' | 'warn' | 'error', event: string, details: Record<string, unknown> = {}) {
  const message = `[transcribe-audio] ${event}`;
  if (level === 'error') {
    console.error(message, details);
    return;
  }
  if (level === 'warn') {
    console.warn(message, details);
    return;
  }
  console.info(message, details);
}

function getHost(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return 'invalid-url';
  }
}

function previewText(value: string, max = 120): string {
  return value.replace(/\s+/g, ' ').slice(0, max);
}

async function probeUserVerification(url: string, anon: string, token: string) {
  const verifyUrl = new URL('/auth/v1/user', url).toString();
  const response = await fetch(verifyUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anon,
    },
  });

  const contentType = response.headers.get('content-type') ?? 'unknown';
  const bodyText = await response.text();
  let userId: string | null = null;

  if (contentType.toLowerCase().includes('application/json') && bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      userId = parsed?.id ?? parsed?.user?.id ?? null;
    } catch (e) {
      logEvent('warn', 'auth probe JSON parse failed', {
        authMethod: AUTH_METHOD,
        status: response.status,
        contentType,
        bodyPreview: previewText(bodyText),
        reason: (e as Error)?.message ?? 'unknown',
      });
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    contentType,
    bodyPreview: bodyText ? previewText(bodyText) : null,
    userId,
  };
}

async function authenticateRequest(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : '';
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const authHost = getHost(url);

  logEvent('info', 'auth context', {
    hasSupabaseUrl: !!url,
    hasSupabaseAnonKey: !!anon,
    authHost,
    hasAuthorizationHeader: !!authHeader,
    bearerTokenLength: token.length,
    authMethod: AUTH_METHOD,
  });

  if (!authHeader?.startsWith('Bearer ')) {
    logEvent('warn', 'auth missing bearer header', { authMethod: AUTH_METHOD });
    return jsonError('unauthorized', 'Unauthorized', 401);
  }
  if (!url || !anon) {
    logEvent('error', 'auth environment missing', {
      hasSupabaseUrl: !!url,
      hasSupabaseAnonKey: !!anon,
      authHost,
      authMethod: AUTH_METHOD,
    });
    return jsonError('service_not_configured', 'Auth service not configured', 500);
  }
  if (token.length < 20) {
    logEvent('warn', 'auth token too short', {
      bearerTokenLength: token.length,
      authMethod: AUTH_METHOD,
    });
    return jsonError('unauthorized', 'Unauthorized', 401);
  }

  try {
    const supabase = createClient(url, anon, {
      global: { headers: { authorization: authHeader } },
    });

    logEvent('info', 'auth verification started', {
      authMethod: AUTH_METHOD,
      authHost,
    });

    const { data, error } = await supabase.auth.getUser(token);
    const userId = data?.user?.id;

    if (!error && userId) {
      logEvent('info', 'auth verification succeeded', {
        authMethod: AUTH_METHOD,
        authHost,
      });
      return { userId };
    }

    const reason = error?.message ?? 'No user returned from auth verification';
    logEvent('warn', 'auth verification rejected', {
      authMethod: AUTH_METHOD,
      authHost,
      reason,
    });

    if (reason.includes("Unexpected token '<'")) {
      try {
        const probe = await probeUserVerification(url, anon, token);
        logEvent(probe.ok ? 'info' : 'warn', 'auth verification probe response', {
          authMethod: AUTH_METHOD,
          authHost,
          status: probe.status,
          contentType: probe.contentType,
          bodyPreview: probe.bodyPreview,
        });

        if (probe.ok && probe.userId) {
          logEvent('info', 'auth verification recovered via direct probe', {
            authMethod: AUTH_METHOD,
            authHost,
          });
          return { userId: probe.userId };
        }

        if (probe.status === 401) {
          return jsonError('unauthorized', 'Unauthorized', 401);
        }

        return jsonError('auth_verification_failed', 'Authentication verification failed', 502, {
          authMethod: AUTH_METHOD,
          authHost,
          status: probe.status,
          contentType: probe.contentType,
        });
      } catch (probeError) {
        logEvent('error', 'auth verification probe failed', {
          authMethod: AUTH_METHOD,
          authHost,
          reason: (probeError as Error)?.message ?? 'unknown',
        });
        return jsonError('auth_verification_failed', 'Authentication verification failed', 502);
      }
    }

    return jsonError('unauthorized', 'Unauthorized', 401);
  } catch (e) {
    logEvent('error', 'auth unexpected error', {
      authMethod: AUTH_METHOD,
      authHost,
      reason: (e as Error)?.message ?? 'unknown',
    });
    return jsonError('auth_verification_failed', 'Authentication verification failed', 502);
  }
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
