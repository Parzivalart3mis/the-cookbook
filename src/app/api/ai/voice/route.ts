import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const { question, recipeText } = await req.json() as { question: string; recipeText: string };
  if (!question?.trim()) return Response.json({ error: 'question required' }, { status: 400 });

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'system',
        content: `You are a cooking assistant. Answer questions about the recipe below concisely (1-2 sentences max). Only answer questions about this recipe. Recipe:\n\n${recipeText}`,
      },
      { role: 'user', content: question },
    ],
    max_tokens: 120,
    temperature: 0.3,
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? 'Sorry, I could not answer that.';
  return Response.json({ answer });
}
