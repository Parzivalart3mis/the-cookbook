import { ApiError, GoogleGenAI } from '@google/genai';

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

/** Errors that mean "try the next model", not "give up". */
function isRetryable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 404 || err.status === 429 || err.status >= 500;
  return false;
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
};

/** Used when a caller passes no deadline. */
const DEFAULT_BUDGET_MS: Record<ModelTier, number> = { full: 50_000, lite: 20_000 };

/**
 * If a model hasn't answered after this long, start the next one alongside it.
 * Healthy full-tier answers take 5–25 s; lite ones about 1 s.
 */
const HEDGE_MS: Record<ModelTier, number> = { full: 20_000, lite: 5_000 };

/** Not worth starting a model with less time than this left. */
const MIN_ATTEMPT_MS = 1_000;

function generate(
  opts: GenerateOptions & { schema?: object }
): Promise<{ text: string; model: string }> {
  const ai = client();
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
        httpOptions: { timeout: timeoutMs },
        ...(opts.schema
          ? { responseMimeType: 'application/json', responseJsonSchema: opts.schema }
          : {}),
      },
    });
    const text = res.text?.trim();
    if (!text) throw new Error(`Empty response from ${model}`);
    return text;
  };

  return new Promise((resolve, reject) => {
    const controllers: AbortController[] = [];
    let next = 0;
    let running = 0;
    let done = false;
    let fatal = false; // a non-retryable error: start no more models
    let lastError: unknown = new Error('No Gemini model answered before the deadline');
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
      if (next < chain.length) {
        hedge = setTimeout(() => {
          console.warn(`[gemini] ${model} slow after ${Math.round(hedgeMs / 1000)}s; also trying ${chain[next]}`);
          launch();
        }, hedgeMs);
      }
      attempt(model, controller.signal, remaining).then(
        text => settle(() => resolve({ text, model })),
        err => {
          running--;
          if (done) return;
          lastError = err;
          if (isRetryable(err)) {
            console.warn(`[gemini] ${model} unavailable (${(err as ApiError).status}); trying next model`);
          } else {
            fatal = true;
          }
          launch();
        }
      );
    };

    const expiry = setTimeout(() => settle(() => reject(lastError)), Math.max(0, deadline - Date.now()));
    launch();
  });
}

/** Structured output: the response is forced to match `schema` (JSON Schema). */
export async function generateJson<T>(opts: GenerateOptions & { schema: object }): Promise<T> {
  const { text, model } = await generate(opts);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${model} returned invalid JSON`);
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
export function aiErrorResponse(err: unknown): Response {
  if (err instanceof AiNotConfiguredError) {
    return Response.json({ error: 'AI is not configured (GEMINI_API_KEY missing).' }, { status: 503 });
  }
  console.error('[gemini] request failed', err);
  if (err instanceof ApiError && err.status === 429) {
    return Response.json({ error: quotaMessage(err) }, { status: 429 });
  }
  return Response.json({ error: 'AI request failed, try again.' }, { status: 502 });
}
