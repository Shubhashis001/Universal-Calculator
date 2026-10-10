import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
test('public and admin are independent deferred route chunks', () => {
  const app = read('src/main.tsx');
  assert.match(app, /const App = lazy\(\(\) => import\(['"]\.\/App\.tsx['"]\)\)/);
  assert.match(app, /const AdminPanel = lazy\(\(\) => import\(['"]\.\/admin\/AdminPanel\.tsx['"]\)\)/);
  assert.doesNotMatch(app, /import App from/);
});

test('only current operational docs live in docs, never release repair notes', () => {
  const rootFiles = readdirSync(new URL('../', import.meta.url));
  assert.equal(rootFiles.filter(f => f.endsWith('.md')).join(','), 'README.md');
  for (const name of ['ADMIN_SETUP.md','DEPLOYMENT.md','PERMISSIONS.md','SECURITY.md','STAGING_TESTS.md']) {
    assert.ok(existsSync(new URL(`../docs/${name}`, import.meta.url)), `missing ${name}`);
    assert.match(read('README.md'), new RegExp(`docs/${name.replace('.', '\\.')}`));
  }
});

test('repository structure guard checks source reachability and duplicates', () => {
  const result = execFileSync(process.execPath, ['scripts/check-structure.mjs'], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.match(result, /Structure PASS: 44 reachable TS\/TSX modules/);
});
