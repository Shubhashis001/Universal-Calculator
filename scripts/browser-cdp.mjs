/** Tiny, dependency-free Chrome DevTools transport for real layout assertions. */
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
export async function startBrowser(executable) {
  const profile = mkdtempSync(join(tmpdir(),'uc-chromium-'));
  const flags=['--headless=new','--disable-gpu','--disable-dev-shm-usage','--disable-extensions',
    '--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'];
  if (process.getuid?.()===0) flags.unshift('--no-sandbox');
  const processHandle=spawn(executable,flags,{stdio:'ignore'});
  try {
    let port;
    for(let i=0;i<100;i++) {
      if(processHandle.exitCode!==null) throw Error('Chrome closed during startup');
      const marker=join(profile,'DevToolsActivePort');
      if(existsSync(marker)) {port=Number(readFileSync(marker,'utf8').split('\n')[0]);break;}
      await delay(100);
    }
    if(!port) throw Error('Chrome DevTools did not start');
    const targets=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
    const tab=targets.find(t=>t.type==='page');
    if(!tab?.webSocketDebuggerUrl) throw Error('Chrome page debugger missing');
    const socket=new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('Timed out connecting to Chrome')),5000);
      socket.addEventListener('open',()=>{clearTimeout(timeout);resolve();},{once:true});
      socket.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('Chrome debugger connection failed'));},{once:true});
    });
    let sequence=0;
    const pending=new Map();
    socket.addEventListener('message',evt=>{
      let message;try{message=JSON.parse(evt.data);}catch{return;}
      if(!message.id || !pending.has(message.id))return;
      const item=pending.get(message.id);pending.delete(message.id);
      clearTimeout(item.timer);
      if(message.error)item.reject(Error(`${item.method}: ${message.error.message}`));else item.resolve(message.result);
    });
    const command=(method,params={})=>new Promise((resolve,reject)=>{
      const id=++sequence;
      const timer=setTimeout(()=>{pending.delete(id);reject(Error(`${method} timed out`));},12000);
      pending.set(id,{resolve,reject,timer,method});
      socket.send(JSON.stringify({id,method,params}));
    });
    const evaluate=async expression=>{
      const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(result.exceptionDetails)throw Error(`Browser script error: ${result.exceptionDetails.text}`);
      return result.result?.value;
    };
    const until=async (expression, timeout=12000)=>{
      const started=Date.now();let result;
      do { result=await evaluate(expression);if(result)return result;await delay(150); }
      while(Date.now()-started<timeout);
      throw Error(`Browser readiness failed (${expression.slice(0,90)})`);
    };
    await command('Page.enable');
    await command('Runtime.enable');
    return {command,evaluate,until,close:async()=>{
      socket.close();processHandle.kill();await delay(150);
      rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
    }};
  } catch(err) {processHandle.kill();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});throw err;}
}
