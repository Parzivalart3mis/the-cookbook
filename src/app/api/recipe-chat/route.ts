import { NextRequest, NextResponse } from 'next/server';

const GROQ_BASE = 'https://api.groq.com/openai/v1';

const MODELS = {
  fast:      'openai/gpt-oss-20b',
  reasoning: 'openai/gpt-oss-120b',
  search:    'groq/compound',
} as const;

type ModelKey = keyof typeof MODELS;

const SEARCH_TRIGGERS = [
  'latest', 'recent', 'research', 'study', 'studies', 'science behind',
  'look up', 'search', 'find', 'current recommendation', 'news',
];
const REASONING_TRIGGERS = [
  'explain why', 'analyze', 'compare', 'difference between', 'how does',
  'science', 'optimize', 'calculate', 'nutrition breakdown', 'plan',
  'tradeoff', 'pros and cons', 'should i', 'is it safe',
];

function classifyQuery(message: string): ModelKey {
  const lower = message.toLowerCase();
  if (SEARCH_TRIGGERS.some((w) => lower.includes(w))) return 'search';
  if (REASONING_TRIGGERS.some((w) => lower.includes(w))) return 'reasoning';
  return 'fast';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  recipeContext: string;
  history: ChatMessage[];
  modelOverride?: ModelKey;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { message, recipeContext, history, modelOverride } = body;
  if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  const modelKey: ModelKey = modelOverride ?? classifyQuery(message);
  const modelId = MODELS[modelKey];

  // Keep input well under the 8 000-token model limit.
  // ~4 chars per token → 14 000 chars ≈ 3 500 tokens for the recipe,
  // leaving ~4 500 tokens for the system wrapper, history, and user message.
  const MAX_CONTEXT_CHARS = 14_000;
  const safeContext =
    recipeContext.length > MAX_CONTEXT_CHARS
      ? recipeContext.slice(0, MAX_CONTEXT_CHARS) + '\n[recipe truncated for length]'
      : recipeContext;

  const systemPrompt = `You are a knowledgeable, friendly cooking assistant. The user is reading this recipe:

---
${safeContext}
---

Answer concisely and practically. For substitutions give exact amounts. Keep responses under 150 words unless the question genuinely needs more.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ];

  let groqRes: Response;
  try {
    groqRes = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });
  } catch (err) {
    console.error('[recipe-chat] Groq fetch failed:', err);
    return NextResponse.json({ error: 'Failed to reach Groq' }, { status: 502 });
  }

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    console.error('[recipe-chat] Groq error:', groqRes.status, errText);
    return NextResponse.json({ error: errText }, { status: groqRes.status });
  }

  const encoder = new TextEncoder();
  // Inject model key as first SSE event so the client can show the badge
  const modelHeader = `data: ${JSON.stringify({ model: modelKey })}\n\n`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(modelHeader));
        const reader = groqRes.body!.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (err) {
        console.error('[recipe-chat] Stream error:', err);
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
