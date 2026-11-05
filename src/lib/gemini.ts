import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { AiOutputError, AiTimeoutError, errorStatus, matchesSchema, retryableAiError } from './ai-errors';

/**
 * One Gemini client for every AI feature in the app.
 *
 * Two tiers:
 *  - `full` — recipe ideas, pantry recipes, meal plans (quality matters)
 *  - `lite` — voice answers, substitutions (latency matters)
 *
 * Each tier is a fallback chain: the env override first, then current models,
 * then Google's rolling `-latest` alias. If a model is retired (404) or over
 * quota / overloaded (429, 5xx) we move to the next one, so a deprecation
 * doesn't take the feature down. If a model is merely slow, the next one is
 * started alongside it and the first answer wins, all inside one deadline.
 */
export type ModelTier = 'full' | 'lite';

const DEFAULT_CHAIN: Record<ModelTier, string[]> = {
  full: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest'],
  lite: ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'],
};

export function modelChain(tier: ModelTier): string[] {
  const override = tier === 'full' ? process.env.GEMINI_MODEL : process.env.GEMINI_MODEL_LITE;
  return [...new Set([override?.trim(), ...DEFAULT_CHAIN[tier]].filter((m): m is string => !!m))];
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super('GEMINI_API_KEY is not set');
  }
}

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  _client ??= new GoogleGenAI({ apiKey });
  return _client;
}

type GenerateOptions = {
  tier: ModelTier;
  system: string;
  prompt: string;
  temperature?: number;
  /**
   * Epoch ms by which an answer must arrive, across every model tried. Set it
   * so the route still finishes inside its maxDuration.
   */
  deadline?: number;
  requestId?: string;
};

/** Used when a caller passes no deadline. */
const DEFAULT_BUDGET_MS: Record<ModelTier, number> = { full: 50_000, lite: 20_000 };

/**
 * If a model hasn't answered after this long, start the next one alongside it.
 * Healthy full-tier answers take 5–25 s; lite ones about 1 s.
 */
const HEDGE_MS: Record<ModelTier, number> = { full: 10_000, lite: 5_000 };

/** Not worth starting a model with less time than this left. */
const MIN_ATTEMPT_MS = 1_000;

function generate(
  opts: GenerateOptions & { schema?: object }
): Promise<{ text: string; model: string }> {
  const ai = client();
  const requestId = opts.requestId ?? crypto.randomUUID();
  const startedAt = Date.now();
  const chain = modelChain(opts.tier);
  const deadline = opts.deadline ?? Date.now() + DEFAULT_BUDGET_MS[opts.tier];
  // Short budgets hedge sooner, so a slow first model still leaves room for the next.
  const hedgeMs = Math.min(HEDGE_MS[opts.tier], Math.max(0, (deadline - Date.now()) * 0.4));

  const attempt = async (model: string, signal: AbortSignal, timeoutMs: number) => {
    const res = await ai.models.generateContent({
      model,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        temperature: opts.temperature ?? 0.7,
        abortSignal: signal,
        // Our fallback chain owns retries and the total deadline. SDK retries
        // otherwise add hidden backoff inside each model attempt.
        httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } },
        // These recipe requests do not need the default medium thinking level.
        // Keep unknown overrides/rolling aliases on their provider defaults.
        ...(/^gemini-3[.-]/.test(model) && !model.includes('lite')
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        ...(opts.schema
          ? { responseMimeType: 'application/json', responseJsonSchema: opts.schema }
          : {}),
      },
    });
    const text = res.text?.trim();
    if (!text) throw new AiOutputError('The model returned an empty answer');
    if (opts.schema) {
      let data: unknown;
      try { data = JSON.parse(text); } catch { throw new AiOutputError('The model returned invalid JSON'); }
      if (!matchesSchema(data, opts.schema)) throw new AiOutputError('The model returned an incomplete answer');
    }
    return text;
  };

  return new Promise((resolve, reject) => {
    const controllers: AbortController[] = [];
    let next = 0;
    let running = 0;
    let done = false;
    let fatal = false; // a non-retryable error: start no more models
    let lastError: unknown = new AiTimeoutError('No model answered before the deadline');
    let hedge: ReturnType<typeof setTimeout> | undefined;

    const settle = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(hedge);
      clearTimeout(expiry);
      controllers.forEach(c => c.abort()); // stop the models that lost
      fn();
    };

    const launch = () => {
      clearTimeout(hedge);
      const remaining = deadline - Date.now();
      if (done || fatal || next >= chain.length || remaining < MIN_ATTEMPT_MS) {
        if (running === 0) settle(() => reject(lastError));
        return;
      }
      const model = chain[next++];
      const controller = new AbortController();
      controllers.push(controller);
      running++;
      const attemptAt = Date.now();
      console.info('[gemini]', { requestId, event: 'attempt', model, remainingMs: remaining });
      if (next < chain.length) {
        hedge = setTimeout(() => {
          console.info('[gemini]', { requestId, event: 'hedge', model, nextModel: chain[next] });
          launch();
        }, hedgeMs);
      }
      attempt(model, controller.signal, remaining).then(
        text => settle(() => {
          console.info('[gemini]', { requestId, event: 'success', model, attemptMs: Date.now() - attemptAt, totalMs: Date.now() - startedAt });
          resolve({ text, model });
        }),
        err => {
          running--;
          if (done) return;
          lastError = err;
          console.warn('[gemini]', { requestId, event: 'attempt_failed', model, attemptMs: Date.now() - attemptAt, status: errorStatus(err), errorType: err instanceof Error ? err.name : 'unknown' });
          if (!retryableAiError(err)) fatal = true;
          launch();
        }
      );
    };

    const expiry = setTimeout(() => settle(() => {
      console.warn('[gemini]', { requestId, event: 'deadline', totalMs: Date.now() - startedAt });
      reject(new AiTimeoutError('AI generation exceeded its deadline'));
    }), Math.max(0, deadline - Date.now()));
    launch();
  });
}

/** Structured output: the response is forced to match `schema` (JSON Schema). */
export async function generateJson<T>(opts: GenerateOptions & { schema: object }): Promise<T> {
  const { text, model } = await generate(opts);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiOutputError(`${model} returned invalid JSON`);
  }
}

export async function generateText(opts: GenerateOptions): Promise<string> {
  return (await generate(opts)).text;
}

/** How long Google asks us to wait, from a 429's RetryInfo, in seconds. */
function retryDelaySeconds(err: ApiError): number | null {
  const m = /"retryDelay":"(\d+(?:\.\d+)?)s"/.exec(err.message);
  return m ? Number(m[1]) : null;
}

function quotaMessage(err: ApiError): string {
  const wait = retryDelaySeconds(err);
  if (wait === null || wait <= 120) return 'AI quota reached, try again in a minute.';
  // A daily limit (the free tier allows a set number of requests per model per day).
  const hours = Math.max(1, Math.round(wait / 3600));
  return `Gemini’s daily limit is used up. Try again in about ${hours} hour${hours === 1 ? '' : 's'}.`;
}

/** Uniform JSON error for AI route handlers. */
export function aiErrorResponse(err: unknown, requestId = crypto.randomUUID()): Response {
  if (err instanceof AiNotConfiguredError) {
    return Response.json({ error: 'AI is not configured (GEMINI_API_KEY missing).', code: 'not_configured', requestId }, { status: 503 });
  }
  console.error('[gemini]', { requestId, event: 'request_failed', status: errorStatus(err), errorType: err instanceof Error ? err.name : 'unknown' });
  if (err instanceof ApiError && err.status === 429) {
    return Response.json({ error: quotaMessage(err), code: 'quota', requestId }, { status: 429 });
  }
  if (errorStatus(err) === 504 || errorStatus(err) === 408 || err instanceof AiTimeoutError || (err instanceof Error && ['AbortError', 'TimeoutError'].includes(err.name))) {
    return Response.json({ error: 'AI took too long to answer. Try again; your pantry and saved recipes are still available.', code: 'timeout', requestId }, { status: 504 });
  }
  if (err instanceof AiOutputError) return Response.json({ error: 'AI returned an incomplete answer. Please try generating again.', code: 'invalid_output', requestId }, { status: 502 });
  const status = errorStatus(err);
  if (status === 400) return Response.json({ error: 'The AI service rejected the request format. Please report this reference so the server configuration can be checked.', code: 'invalid_request', requestId }, { status: 502 });
  if (status === 401 || status === 403) return Response.json({ error: 'AI access was rejected. Check the server’s Gemini key and permissions.', code: 'access', requestId }, { status: 503 });
  return Response.json({ error: 'The AI service is temporarily unavailable. Try again shortly.', code: 'unavailable', requestId }, { status: 502 });
}
