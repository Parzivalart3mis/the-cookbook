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
 * doesn't take the feature down.
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
  /** Per-attempt timeout. Keep the sum under the route's maxDuration. */
  timeoutMs?: number;
};

async function generate(
  opts: GenerateOptions & { schema?: object }
): Promise<{ text: string; model: string }> {
  const ai = client();
  let lastError: unknown;
  for (const model of modelChain(opts.tier)) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          temperature: opts.temperature ?? 0.7,
          httpOptions: { timeout: opts.timeoutMs ?? 45_000 },
          ...(opts.schema
            ? { responseMimeType: 'application/json', responseJsonSchema: opts.schema }
            : {}),
        },
      });
      const text = res.text?.trim();
      if (!text) throw new Error(`Empty response from ${model}`);
      return { text, model };
    } catch (err) {
      lastError = err;
      if (!isRetryable(err)) break;
      console.warn(`[gemini] ${model} unavailable (${(err as ApiError).status}); trying next model`);
    }
  }
  throw lastError;
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

/** Uniform JSON error for AI route handlers. */
export function aiErrorResponse(err: unknown): Response {
  if (err instanceof AiNotConfiguredError) {
    return Response.json({ error: 'AI is not configured (GEMINI_API_KEY missing).' }, { status: 503 });
  }
  console.error('[gemini] request failed', err);
  const status = err instanceof ApiError && err.status === 429 ? 429 : 502;
  return Response.json(
    { error: status === 429 ? 'AI quota reached, try again in a minute.' : 'AI request failed, try again.' },
    { status }
  );
}
