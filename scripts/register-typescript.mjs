// Minimal Node test loader using the TypeScript compiler already in devDependencies.
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = { '@google/genai': 'ai', '@clerk/nextjs/server': 'auth', '@notionhq/client': 'notion', 'next/cache': 'cache' };
    if (process.env.COOKBOOK_TEST_MOCKS === '1' && mocks[specifier]) return { url: new URL(`tests/fixtures/${mocks[specifier]}.mjs`, root).href, shortCircuit: true };
    const url = specifier.startsWith('@/') ? new URL(`src/${specifier.slice(2)}`, root) : specifier.startsWith('.') && context.parentURL?.endsWith('.ts') ? new URL(specifier, context.parentURL) : null;
    if (url && specifier.startsWith('@/') && existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
    if (url && existsSync(fileURLToPath(url) + '.ts')) return { url: pathToFileURL(fileURLToPath(url) + '.ts').href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.json') && !url.includes('/node_modules/')) return { format: 'module', shortCircuit: true, source: `export default ${readFileSync(new URL(url), 'utf8')}` };
    if (url.endsWith('.ts') && !url.includes('/node_modules/')) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText,
    };
    return nextLoad(url, context);
  },
});
