#!/usr/bin/env node
/** Local preflight, not a replacement for live pentests, WAF, DB advisors or npm audit. */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['node_modules','dist','.git','coverage','.cache','.next']);
const textFiles = /\.(?:[cm]?[jt]sx?|json|md|yml|yaml|html|css|sql|toml|env|txt)$/i;
const secretPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{20,}/],
  ['service role JWT', /eyJ[A-Za-z0-9_-]{25,}\.eyJ[A-Za-z0-9_-]{25,}\.[A-Za-z0-9_-]{15,}/],
  ['cloud provider access key', /AKIA[0-9A-Z]{16}/],
  ['Stripe private key', /sk_(?:live|test)_[A-Za-z0-9]{18,}/],
  ['GitHub token', /gh[ps]_[A-Za-z0-9]{30,}/],
];
const failures = [];
const walk = (dir, out=[]) => {
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) continue;
    const filename=join(dir,name);
    if (statSync(filename).isDirectory()) walk(filename,out);
    else out.push(filename);
  }
  return out;
};
const files = walk(root);
const contents = (file) => readFileSync(file,'utf8');
const rel=(file)=>relative(root,file).replaceAll('\\','/');
for (const file of files.filter(x=>textFiles.test(x) && !x.includes('package-lock.json'))) {
  const name=rel(file);
  const value=contents(file);
  // Scan documentation, tests and scripts too: leaked credentials can hide in fixtures.
  // Exclude only this scanner's own literal detection patterns.
  if (name !== 'scripts/security-audit.mjs') {
    for (const [kind,pattern] of secretPatterns) if (pattern.test(value)) failures.push(`${name}: possible ${kind} (value hidden)`);
    if (/VITE_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET|PRIVATE_KEY|PASSWORD)/.test(value)) failures.push(`${name}: unsafe frontend environment variable name`);
  }
  if (name.startsWith('public/') && /(?:^|\/)(?:\.env(?:\..*)?|id_rsa|\.npmrc|\.git|.*\.pem|.*\.key)$/i.test(name)) failures.push(`${name}: sensitive file within public assets`);
}
for (const entry of ['.env','.env.local','.env.production','.env.development']) {
  const file=join(root,entry);
  if (existsSync(file)) {
    const content=contents(file);
    if (/^VITE_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET|PRIVATE_KEY|PASSWORD)\s*=/m.test(content)) failures.push(`${entry}: secret configured in browser-exposed VITE_ variable`);
  }
}
const pkg=JSON.parse(contents(join(root,'package.json')));
const lock=JSON.parse(contents(join(root,'package-lock.json')));
for (const kind of ['dependencies','devDependencies']) {
  for (const [name,version] of Object.entries(pkg[kind]??{})) {
    if (lock.packages?.['']?.[kind]?.[name] !== version) failures.push(`package-lock.json: ${name} does not match package.json`);
  }
}
for (const name of ['vercel.json','public/_headers']) if (!existsSync(join(root,name))) failures.push(`Missing ${name}`);
const vercel=JSON.parse(contents(join(root,'vercel.json')));
const headerEntries=vercel.headers?.find(x=>x.source==='/(.*)')?.headers??[];
for (const name of ['Content-Security-Policy','X-Content-Type-Options','Strict-Transport-Security','Referrer-Policy','X-Frame-Options']) {
  if (!headerEntries.some(x=>x.key===name)) failures.push(`Vercel: missing ${name}`);
  if (!contents(join(root,'public/_headers')).includes(`${name}:`)) failures.push(`Netlify: missing ${name}`);
}
const vite=contents(join(root,'vite.config.ts'));
if (!/sourcemap:\s*false/.test(vite)) failures.push('Production sourcemaps must be explicitly disabled');
try {
  const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',maxBuffer:5e6,stdio:['ignore','pipe','ignore']}).split('\0').filter(Boolean);
  for (const name of tracked) if (/(^|\/)\.env($|\.)|(^|\/)(?:id_rsa|.*\.pem|.*\.key)$/i.test(name) && !name.endsWith('.env.example')) failures.push(`Git-tracked sensitive path: ${name}`);
  // Inspect committed additions/deletions too, so currently removed keys do not go unnoticed.
  const history=execFileSync('git',['log','--all','-p','--no-ext-diff','--format=','--unified=0'],{cwd:root,encoding:'utf8',maxBuffer:25e6,stdio:['ignore','pipe','ignore']});
  for (const [kind,pattern] of secretPatterns) if (history.split('\n').some(line=>/^\+(?!\+)|^-(?!-)/.test(line) && pattern.test(line.slice(1)))) failures.push(`Git history: possible ${kind} (redacted)`);
  console.log(`Git secret scan: checked ${tracked.length} tracked files plus reachable patch history.`);
} catch (e) {
  if (e?.status === 128) console.log('Git secret history: NOT CHECKED (source ZIP has no .git folder).');
  else failures.push('Git secret history not completely scanned; inspect repository history separately.');
}
if (failures.length) {
  for (const issue of failures) console.error(`FAIL ${issue}`);
  process.exitCode=1;
} else console.log(`Local security preflight PASS (${files.length} project files). This does not prove live configuration is secure.`);
