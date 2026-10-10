import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(p,'utf8');
const shell = read('src/admin/AdminPanel.tsx');
const team = read('src/admin/AdminModules.tsx');
const theme = read('src/admin/premium-admin.css');
const entry = read('src/main.tsx');

test('premium styling is isolated to lazy-loaded admin and never modifies calculator stylesheet',()=>{
 assert.match(shell, /import ['"]\.\/premium-admin\.css['"]/);
 assert.match(entry, /lazy\(\(\) => import\(['"]\.\/admin\/AdminPanel\.tsx['"]\)\)/);
 assert.match(theme, /\.ad-shell/);
 assert.match(theme, /\.ad-access/);
 assert.doesNotMatch(theme, /(?:^|\n)\s*(?::root|html|body|#root)\s*\{/);
});

test('Team and Roles remains connected to real Supabase team API, not a mockup',()=>{
 for(const op of ['getTeam','inviteTeamMember','changeTeamRole'])assert.ok(team.includes(op),op);
 assert.match(team, /Create 7-day invitation/);
 assert.match(team, /pattern="\[0-9a-fA-F\]/);
 assert.match(team, /Verified TOTP session required/);
 assert.match(team, /onChange=\{e=>\{const next/);
});

test('protected owner actions remain explicitly guarded',()=>{
 assert.match(team,/disabled=\{busy\|\|m\.role==='owner'\}/);
 assert.match(team,/window\.confirm\('Remove this team member\?/);
 assert.match(shell,/getCurrentAal\(\)==='aal2'/);
 assert.match(shell,/signInWithPassword\(loginEmail,loginPassword\)/);
});

test('design has four visible roles, tablet and mobile adaptation, and accessible error feedback',()=>{
 for(const role of ['owner','admin','editor','viewer'])assert.match(team,new RegExp(`role:'${role}'`));
 assert.match(theme, /@media \(max-width:1280px\)/);
 assert.match(theme, /@media \(max-width:650px\)/);
 assert.match(team, /messageType==='error'\?'alert':'status'/);
});
