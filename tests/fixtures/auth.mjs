export async function auth() { return { userId: globalThis.testUser === undefined ? 'test-user' : globalThis.testUser }; }

export async function clerkClient() {
  return { users: { getUser: async id => globalThis.testClerkUser ?? ({ id, primaryEmailAddressId: 'primary', emailAddresses: [{ id: 'primary', emailAddress: `${id}@example.com`, verification: { status: 'verified' } }] }) } };
}
