import { NextRequest, NextResponse } from 'next/server';

const GROQ_BASE = 'https://api.groq.com/openai/v1';

const MODELS = {
  // Fast everyday chat — substitutions, timing, simple tips
  fast:      'openai/gpt-oss-20b',
  // Multi-step reasoning — dietary analysis, technique explanations, tradeoffs
  reasoning: 'openai/gpt-oss-120b',
  // Live web search — recent research, external info, links
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
  recipeContext: string;    // pre-serialized recipe name + content
  history: ChatMessage[];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });

  const body: ChatRequest = await req.json();
  const { message, recipeContext, history } = body;

  if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  const modelKey = classifyQuery(message);

  const systemPrompt = `You are a knowledgeable, friendly cooking assistant. The user is reading this recipe:

---
${recipeContext}
---

Answer their questions concisely and practically. Focus on actionable advice. If asked about substitutions, give exact amounts. If something can go wrong, warn them briefly. Keep responses under 200 words unless the question genuinely requires more detail.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ];

  const groqRes = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODELS[modelKey],
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 512,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    return NextResponse.json({ error: err }, { status: groqRes.status });
  }

  // Proxy the SSE stream and inject model info as first chunk
  const modelHeader = `data: ${JSON.stringify({ model: modelKey })}\n\n`;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    await writer.write(encoder.encode(modelHeader));
    const reader = groqRes.body!.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
    }
    await writer.close();
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
