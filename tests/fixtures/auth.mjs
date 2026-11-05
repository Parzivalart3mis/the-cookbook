export async function auth() { return { userId: globalThis.testUser === undefined ? 'test-user' : globalThis.testUser }; }
