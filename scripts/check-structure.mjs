/** Keep the source tree small without deleting lazily loaded modules or migrations. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

const root = resolve('.');
const src = join(root, 'src');
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) continue;
    const filename = join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${relative(root, filename)}`);
    if (entry.isDirectory()) walk(filename);
    else if (entry.isFile()) files.push(filename);
  }
}
walk(root);
const problems = [];
const fingerprints = new Map();
for (const filename of files) {
  if (relative(root, filename).includes('package-lock.json')) continue;
  const hash = createHash('sha256').update(readFileSync(filename)).digest('hex');
  const previous = fingerprints.get(hash);
  if (previous) problems.push(`Duplicate identical files: ${relative(root, previous)} and ${relative(root, filename)}`);
  else fingerprints.set(hash, filename);
}
const sourceFiles = files.filter(f => /\.(?:ts|tsx)$/.test(f) && !relative(src, f).startsWith('..') && relative(src, f) !== '');
if (sourceFiles.length === 0) throw new Error('No TypeScript modules discovered. Check source root and path handling.');
const sourceSet = new Set(sourceFiles);
const visited = new Set();
const extensionOptions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
function traverse(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const code = readFileSync(file, 'utf8');
  const importPatterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g,
  ];
  for (const pattern of importPatterns) {
    for (const [, specifier] of code.matchAll(pattern)) {
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
      const base = specifier.startsWith('@/') ? join(src, specifier.slice(2)) : resolve(dirname(file), specifier);
      const target = extensionOptions.map(ext => base + ext).find(candidate => existsSync(candidate) && statSync(candidate).isFile());
      if (!target) { problems.push(`Unresolved local import ${specifier} in ${relative(root, file)}`); continue; }
      if (sourceSet.has(target)) traverse(target);
    }
  }
}
traverse(join(src, 'main.tsx'));
for (const orphan of sourceFiles.filter(f => !visited.has(f))) problems.push(`Unreachable TypeScript module: ${relative(root, orphan)}`);
const unusedRootDocs = files.filter(f => dirname(f) === root && extname(f) === '.md' && f !== join(root, 'README.md'));
for (const filename of unusedRootDocs) problems.push(`Keep operational documentation in docs/: ${relative(root, filename)}`);
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log(`Structure PASS: ${sourceFiles.length} reachable TS/TSX modules, ${files.length} non-duplicate files and a clean project root.`);
