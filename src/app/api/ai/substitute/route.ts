import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const { ingredient, recipeName } = await req.json() as { ingredient: string; recipeName: string };
  if (!ingredient?.trim()) return Response.json({ error: 'ingredient required' }, { status: 400 });

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `You are a cooking assistant. Suggest 1-2 ingredient substitutions. Reply ONLY with valid JSON in this exact format, no markdown, no explanation:
{"substitutes":[{"name":"substitute name","note":"brief effect on dish"}]}`,
      },
      {
        role: 'user',
        content: `Recipe: ${recipeName}\nIngredient to substitute: ${ingredient}`,
      },
    ],
    max_tokens: 200,
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
    return Response.json(parsed);
  } catch {
    return Response.json({ substitutes: [] });
  }
}
