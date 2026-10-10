import ts from'typescript';import{readFileSync,readdirSync}from'node:fs';import{join}from'node:path';
const paths=[];function walk(dir){for(const x of readdirSync(dir,{withFileTypes:true})){const p=join(dir,x.name);if(x.isDirectory())walk(p);else if(/\.tsx?$/.test(x.name))paths.push(p)}}walk('src');
const errors=[];
for(const p of paths){const txt=readFileSync(p,'utf8');const source=ts.createSourceFile(p,txt,ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 if(source.parseDiagnostics.length)errors.push(`${p}: invalid syntax`);
 function inspect(n){if(ts.isIdentifier(n)&&['eval','dangerouslySetInnerHTML'].includes(n.text))errors.push(`${p}: forbidden ${n.text}`);
 if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='Function')errors.push(`${p}: dynamic Function forbidden`);
 ts.forEachChild(n,inspect)}inspect(source);
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}else console.log(`Source lint/syntax guard passed: ${paths.length} files. No ESLint style rules are claimed.`);
