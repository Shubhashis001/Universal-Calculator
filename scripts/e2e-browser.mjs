#!/usr/bin/env node
/** Actual Chromium E2E: mobile menu behavior, route content and layout overflow.
 * The production test remains unauthenticated; use staging:security for live RLS/MFA. */
import {spawn,spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {startBrowser} from './browser-cdp.mjs';

const win = process.platform === 'win32';
const candidates = [process.env.E2E_BROWSER_BIN,
  ...(win ? [
    `${process.env.PROGRAMFILES || 'C:\\Program Files'}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
    `${process.env.LOCALAPPDATA || ''}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
    `${process.env.PROGRAMFILES || 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env.PROGRAMFILES || 'C:\\Program Files'}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ] : ['chromium','chromium-browser','google-chrome','google-chrome-stable','brave-browser','microsoft-edge'] )];
const browserBin=candidates.find(x=>x && (existsSync(x) || spawnSync(x,['--version'],{stdio:'ignore'}).status===0));
if(!browserBin)throw Error('Install Chromium/Chrome or set E2E_BROWSER_BIN to its executable.');
if(!existsSync('dist/index.html') || !existsSync('dist/tools/calculator/index.html'))
  throw Error('Run npm run build before the E2E browser flow.');
const preview=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4173','--strictPort'],
  {shell:process.platform==='win32',stdio:'ignore'});
let browser;
try {
  let ready=false;
  for(let i=0;i<50;i++) {
    try {if((await fetch('http://127.0.0.1:4173/')).ok){ready=true;break;}}catch { /* pending */ }
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  if(!ready)throw Error('Vite preview unavailable on port 4173.');
  browser=await startBrowser(browserBin);
  const scenarios=[
    {name:'small phone QR',route:'/tools/qr/',width:320,height:640,expect:'QR Generator'},
    {name:'phone home',route:'/',width:390,height:844,expect:'Calculator'},
    {name:'tablet converter',route:'/tools/converter/',width:820,height:1180,expect:'Unit Converter'},
    {name:'laptop math',route:'/tools/math/',width:1024,height:768,expect:'Mathematics'},
    {name:'desktop calculator',route:'/tools/calculator/',width:1440,height:900,expect:'Calculator'},
    {name:'mobile admin locked',route:'/admin',width:360,height:740,admin:true},
  ];
  for(const scenario of scenarios) {
    const {width,height}=scenario;
    await browser.command('Emulation.setDeviceMetricsOverride',{
      width,height,deviceScaleFactor:1,mobile:width<1024,screenWidth:width,screenHeight:height,
    });
    await browser.command('Page.navigate',{url:`http://127.0.0.1:4173${scenario.route}`});
    if(scenario.admin) {
      await browser.until(`document.querySelector('meta[name="robots"][content*="noindex"]') !== null && document.querySelector('.ad-access') !== null`);
      const exposed=await browser.evaluate(`document.body.innerText.includes('Operating profit') && document.body.innerText.includes('Recent sessions')`);
      if(exposed)throw Error('Unauthenticated admin displays privileged metrics');
    }else {
      await browser.until(`document.querySelector('#tool-navigation') !== null && document.querySelector('#main-content h1')?.textContent.includes(${JSON.stringify(scenario.expect)})`);
    }
    const layout=await browser.evaluate(`({width:innerWidth,docWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth})`);
    if(layout.docWidth>layout.width+3 || layout.bodyWidth>layout.width+3) {
      throw Error(`Horizontal viewport overflow in ${scenario.name}: ${JSON.stringify(layout)}`);
    }
    if(scenario.name==='small phone QR') {
      await browser.until(`document.querySelector('button[aria-label="Open tools menu"]') !== null`);
      await browser.evaluate(`document.querySelector('button[aria-label="Open tools menu"]').click()`);
      await browser.until(`document.querySelector('#tool-navigation[aria-modal="true"]') !== null`);
      if(!await browser.evaluate(`document.querySelector('.public-shell > div[inert]') !== null`)) {
        throw Error('Mobile drawer does not prevent background interaction');
      }
      await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await browser.until(`document.querySelector('#tool-navigation[aria-modal="true"]') === null`);
    }
    console.log(`Browser PASS ${scenario.name} ${width}x${height}: route, layout${scenario.name==='small phone QR'?', keyboard drawer':''}`);
  }
} finally {
  await browser?.close();
  preview.kill();
}
