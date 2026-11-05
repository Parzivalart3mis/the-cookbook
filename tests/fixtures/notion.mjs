export class Client {
  blocks = { children: { list: async (options) => globalThis.testNotionBlocks(options) } };
}
