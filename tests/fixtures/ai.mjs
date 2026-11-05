export const calls = [];
export const outcomes = [];
export class ApiError extends Error { constructor(status) { super('test API failure'); this.status = status; } }
export class GoogleGenAI {
  models = { generateContent: async (options) => {
    calls.push(options);
    const outcome = outcomes.shift();
    if (outcome instanceof Error) throw outcome;
    if (typeof outcome === 'function') return outcome(options);
    return { text: outcome ?? '{}' };
  } };
}

export const ThinkingLevel = { LOW: 'LOW' };
