import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import ts from 'typescript';

// Execute the actual browser adapter under a controlled browser environment,
// not a copied authentication implementation.
function makeClient(fetchOverride){
  const session = new Map(), locations=[], requests=[];
  let href='https://website.example/admin';
  const env={VITE_SUPABASE_URL:'https://example-project.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_testpublickey_12345'};
  let source=readFileSync(new URL('../src/lib/launchApi.ts',import.meta.url),'utf8');
  source=source.replaceAll('import.meta.env','ENV');
  const js=ts.transpileModule(source,{fileName:'launchApi.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const context={ exports:{}, ENV:env,URL,URLSearchParams,Uint8Array,TextEncoder,Date,Math,Promise,Event,console,crypto:webcrypto,btoa,history:{replaceState(_s,_t,to){href=`https://website.example${to}`;}},
    sessionStorage:{getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},
    AbortSignal, get window(){return {location:{get href(){return href},get hash(){return new URL(href).hash},get origin(){return 'https://website.example'},get pathname(){return new URL(href).pathname},get search(){return new URL(href).search},assign(to){locations.push(to)}},dispatchEvent(){}}},
    async fetch(url,opts){requests.push({url,opts});if(fetchOverride)return fetchOverride(url,opts);return {ok:true, status:200,async json(){return {access_token:'test-access-token',refresh_token:'test-refresh-token',token_type:'bearer',expires_in:3600}}}}};
  createContext(context);runInContext(js,context);
  return {api:context.exports, session, locations, requests, setHref:v=>{href=v;},getHref:()=>href};
}

test('email and password are sent to Supabase Auth and only access/refresh tokens are stored',async()=>{
  const browser=makeClient();
  await browser.api.signInWithPassword(' ADMIN@Example.COM ','correct-horse-battery-staple');
  assert.equal(browser.requests.length,1);
  assert.equal(browser.requests[0].url,'https://example-project.supabase.co/auth/v1/token?grant_type=password');
  assert.equal(browser.requests[0].opts.method,'POST');
  assert.equal(browser.requests[0].opts.cache,'no-store');
  assert.ok(browser.requests[0].opts.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(browser.requests[0].opts.body),{
    email:'admin@example.com',password:'correct-horse-battery-staple',
  });
  assert.equal(browser.session.has('uc_admin_password_auth_v2'),true);
  assert.equal(JSON.stringify([...browser.session]).includes('correct-horse-battery-staple'),false);
  assert.equal(browser.locations.length,0,'No Google/OAuth redirect should occur');
});

test('legacy social-login sessions cannot unlock the password-only admin',async()=>{
  const browser=makeClient();
  browser.session.set('uuh_auth_v1',JSON.stringify({access_token:'old',refresh_token:'old',expires_at:Date.now()+3600000}));
  browser.session.set('uuh_google_pkce_v1','legacy-auth');
  assert.equal(await browser.api.getIdentity(),null);
  assert.equal(browser.session.has('uuh_auth_v1'),false);
  assert.equal(browser.session.has('uuh_google_pkce_v1'),false);
  assert.equal(browser.requests.length,0);
});

test('invalid credentials never create a session or reveal whether an account exists',async()=>{
  const browser=makeClient(async()=>({ok:false,status:400}));
  await assert.rejects(browser.api.signInWithPassword('owner@example.com','wrong-password'),/Email or password is incorrect/);
  assert.equal(browser.session.size,0);
  assert.equal(browser.requests.length,1);
});

test('invalid email/password inputs never reach the auth provider',async()=>{
  const browser=makeClient();
  await assert.rejects(browser.api.signInWithPassword('not-an-email','password'),/valid email/);
  await assert.rejects(browser.api.signInWithPassword('admin@example.com',''),/Enter your password/);
  assert.equal(browser.requests.length,0);
});

test('throttled login reports retry without creating a session',async()=>{
  const browser=makeClient(async()=>({ok:false,status:429}));
  await assert.rejects(browser.api.signInWithPassword('admin@example.com','password'),/Too many login attempts/);
  assert.equal(browser.session.size,0);
});

test('signout while first-factor login is pending cannot restore a session',async()=>{
  let finishLogin;
  const pending=new Promise(resolve=>{finishLogin=resolve;});
  const browser=makeClient(()=>pending);
  const attempt=browser.api.signInWithPassword('admin@example.com','password');
  await browser.api.signOut();
  finishLogin({ok:true,status:200,json:async()=>({access_token:'x',refresh_token:'y',token_type:'bearer',expires_in:3600})});
  await assert.rejects(attempt,/Sign-in session changed/);
  assert.equal(browser.session.size,0);
});

test('sign-out immediately clears credentials and cannot be undone by an older token refresh',async()=>{
  let finishRefresh;
  const pending = new Promise(resolve => { finishRefresh = resolve; });
  const browser=makeClient(async url=>{
    if (url.includes('grant_type=refresh_token')) return pending;
    if (url.endsWith('/auth/v1/logout')) return {ok:true,status:204};
    throw Error(`unexpected request: ${url}`);
  });
  browser.session.set('uc_admin_password_auth_v2',JSON.stringify({
    access_token:'old-access',refresh_token:'old-refresh',expires_at:Date.now()-2000,
  }));
  const identityCheck=browser.api.getIdentity();
  for (let i=0; i<10 && browser.requests.length===0; i++) await new Promise(resolve=>setImmediate(resolve));
  assert.match(browser.requests[0]?.url??'',/grant_type=refresh_token/);
  const logout=browser.api.signOut();
  assert.equal(browser.session.has('uc_admin_password_auth_v2'),false,'local logout must not wait on refresh');
  await logout;
  finishRefresh({ok:true,status:200,json:async()=>({
    access_token:'revived-access',refresh_token:'revived-refresh',token_type:'bearer',expires_in:3600,
  })});
  await assert.rejects(identityCheck,/Session changed during refresh/i);
  assert.equal(browser.session.has('uc_admin_password_auth_v2'),false,'stale response must never resurrect tokens');
  assert.equal(browser.requests.some(request=>request.url.endsWith('/auth/v1/user')),false);
});
