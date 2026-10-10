import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('../', import.meta.url));
const cache = new Map();
// Transpile the real source in memory, resolving aliases and dependencies.
// No copied implementation or generated test files are used.
async function sourceUrl(relative) {
  if (cache.has(relative)) return cache.get(relative);
  let source = await fs.readFile(path.join(root, relative), 'utf8');
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)];
  for (const [, specifier] of imports) {
    let url;
    if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      let target = specifier.startsWith('@/') ? `src/${specifier.slice(2)}` : path.join(path.dirname(relative), specifier);
      if (!path.extname(target)) {
        try { await fs.access(path.join(root, `${target}.ts`)); target += '.ts'; } catch { target += '.tsx'; }
      }
      url = await sourceUrl(target);
    } else url = import.meta.resolve(specifier);
    source = source.replaceAll(`'${specifier}'`, JSON.stringify(url)).replaceAll(`"${specifier}"`, JSON.stringify(url));
  }
  let code = ts.transpileModule(source, { fileName: relative, compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText;
  // Classic JSX avoids unresolved injected jsx-runtime imports from data URLs.
  if (relative.endsWith('.tsx')) code = `import React from ${JSON.stringify(import.meta.resolve('react'))};\n${code}`;
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  cache.set(relative, url);
  return url;
}
export async function loadSource(relative) { return import(await sourceUrl(relative)); }
export { sourceUrl };
