import test from'node:test';import assert from'node:assert/strict';
import{readFileSync}from'node:fs';import{createContext,runInContext}from'node:vm';import ts from'typescript';

function client(){
 const requests=[],session=new Map();const config={VITE_SUPABASE_URL:'https://demo-project.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example_public_key'};
 const raw=readFileSync('src/lib/launchApi.ts','utf8').replaceAll('import.meta.env','ENV');
 const js=ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const mkToken=aal=>'aaa.'+Buffer.from(JSON.stringify({aal})).toString('base64url')+'.sig';
 const tokenData=aal=>({access_token:mkToken(aal),refresh_token:'valid-refresh',token_type:'bearer',expires_in:3600});
 session.set('uc_admin_password_auth_v2',JSON.stringify({...tokenData('aal1'),expires_at:Date.now()+3600000}));
 const context={exports:{},ENV:config,window:{dispatchEvent(){}},Event,sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},
  atob,btoa,URL,URLSearchParams,crypto,Date,Math,Promise,TextEncoder,Uint8Array,console,fetch:async(url,options)=>{
   requests.push({url,options});let body={};if(url.endsWith('/factors'))body={id:'factor-test',totp:{qr_code:'',uri:'otpauth://totp/sample',secret:'sample'}};
   if(url.endsWith('/challenge'))body={id:'challenge-test'};
   if(url.endsWith('/verify'))body=tokenData('aal2');
   if(url.endsWith('/user'))body={id:'user-id',factors:[{id:'factor-test',factor_type:'totp',status:'verified'}]};
   return{ok:true,status:200,json:async()=>body};
  }};
 createContext(context);runInContext(js,context);
 return{api:context.exports,requests,session};
}
test('actual frontend MFA code requires numeric TOTP before issuing factor challenge',async()=>{
 const b=client();assert.equal(b.api.getCurrentAal(),'aal1');
 await assert.rejects(b.api.verifyTotp('factor-test','wrong'),/six-digit/i);assert.equal(b.requests.length,0);
 await b.api.verifyTotp('factor-test','123456');
 assert.equal(b.api.getCurrentAal(),'aal2');
 assert.equal(b.requests.length,2);
 assert.ok(b.requests[0].url.endsWith('/factors/factor-test/challenge'));
 assert.ok(b.requests[1].url.endsWith('/factors/factor-test/verify'));
 assert.equal(JSON.parse(b.requests[1].options.body).challenge_id,'challenge-test');
 assert.equal(JSON.parse(b.requests[1].options.body).code,'123456');
 assert.ok(!JSON.stringify([...b.session]).includes('123456'));
});
test('TOTP enrollment/cancellation uses authenticated factor API',async()=>{
 const b=client();const factors=await b.api.getTotpFactors();assert.equal(factors.length,1);
 const enrolled=await b.api.enrollTotp();assert.equal(enrolled.id,'factor-test');
 await b.api.cancelTotp('factor-test');
 assert.equal(b.requests[0].options.method,'GET');
 assert.equal(b.requests[1].options.method,'POST');
 assert.equal(b.requests[2].options.method,'DELETE');
 assert.ok(b.requests.every(r=>r.options.headers.Authorization.startsWith('Bearer ')));
});
