import { auth } from '@clerk/nextjs/server';
import { AiNotConfiguredError, generateText } from '@/lib/gemini';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { question, recipeText } = await req.json() as { question: string; recipeText: string };
  if (!question?.trim()) return Response.json({ error: 'question required' }, { status: 400 });

  try {
    const answer = await generateText({
      tier: 'lite',
      system: `You are a hands-free cooking assistant; your answer is read aloud. Answer questions about the recipe below concisely (1-2 sentences max, plain text, no markdown). Only answer questions about this recipe. Recipe:\n\n${recipeText}`,
      prompt: question,
      temperature: 0.3,
      deadline: Date.now() + 20_000, // inside maxDuration (30 s)
    });
    return Response.json({ answer });
  } catch (err) {
    // The voice UI speaks whatever `answer` holds, so always return one.
    if (!(err instanceof AiNotConfiguredError)) console.error('[voice] AI request failed', err);
    return Response.json({ answer: 'Sorry, I could not answer that right now.' });
  }
}
