import {readFileSync,existsSync} from 'node:fs';
const files=[
  'database/launch_admin.sql',
  'database/20261009_security_hardening.sql',
  'database/20261010_admin_core.sql',
  'database/20261011_privacy_permissions.sql',
  'database/20261012_branding_consistency.sql',
];
if(files.some(p=>!existsSync(p)))throw Error('Migration file missing');
for(const p of files){
 const s=readFileSync(p,'utf8');
 if(!/create\s+(?:or replace\s+)?function|create\s+table|create\s+schema|alter\s+table/i.test(s)) throw Error(`Migration has no DDL: ${p}`);
}
const upgrades=files.slice(1).map(x=>x.match(/\d{8}/)?.[0]);
if(upgrades.some((x,i)=>!x||(i>0&&x<=upgrades[i-1])))throw Error('Migration chronology invalid');
console.log('Migrations ordered. NEW: launch_admin.sql → 20261010_admin_core.sql → 20261011_privacy_permissions.sql → 20261012_branding_consistency.sql. EXISTING: apply pending dated upgrades only.');
