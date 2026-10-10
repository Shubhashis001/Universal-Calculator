import { useEffect,useState } from 'react';
import { ShieldCheck,LockKeyhole,ArrowRight } from 'lucide-react';
import { cancelTotp,enrollTotp,getCurrentAal,getTotpFactors,verifyTotp } from '@/lib/launchApi';
import type { Enrollment,MfaFactor } from '@/lib/launchApi';

/** Enrollment/challenge requires a Supabase identity; all privileged data is gated in Postgres. */
export default function MfaGate({onComplete,onSignOut}: {onComplete:()=>Promise<void>;onSignOut:()=>Promise<void>}) {
 const [factors,setFactors]=useState<MfaFactor[]>([]);
 const [enrollment,setEnrollment]=useState<Enrollment|null>(null);
 const [code,setCode]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [qr,setQr]=useState<string|null>(null);
 useEffect(()=>{void getTotpFactors().then(setFactors).catch(()=>setMessage('Unable to load authenticator factors.'));},[]);
 useEffect(()=>{
   if(!enrollment) {setQr(null);return;}
   let cancelled=false;
   void import('qrcode').then(q=>q.toDataURL(enrollment.totp.uri,{width:192,margin:2})).then(u=>{if(!cancelled)setQr(u);})
   .catch(()=>setMessage('QR unavailable. Enter the secret manually in your authenticator.'));
   return ()=>{cancelled=true;};
 },[enrollment]);
 const verified=factors.filter(f=>f.status==='verified');
 const id=enrollment?.id??verified[0]?.id;
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await fn();}catch(e){setMessage(e instanceof Error?e.message:'Verification failed');}finally{setBusy(false);}};
 return <div className="ad-access"><div className="ad-access-card">
   <div className="ad-mark large"><ShieldCheck size={25}/></div>
   <div className="ad-kicker">ACCOUNT PROTECTION · TOTP</div>
   <h1>Enter your 6-digit code</h1>
   <p>{getCurrentAal()==='aal2'?'Your session is verified.':'Password accepted. Now enter the six-digit code from Google Authenticator on your phone to unlock the admin dashboard.'}</p>
   {verified.length===0&&!enrollment&&<button className="ad-btn ad-btn-primary ad-btn-wide" disabled={busy} onClick={()=>void run(async()=>{
     const data=await enrollTotp();setEnrollment(data);setFactors(await getTotpFactors());
   })}><LockKeyhole size={17}/> Set up authenticator</button>}
   {enrollment&&<div className="ad-setup-mini">
     <p>First-time setup: open Google Authenticator on your phone, tap +, and scan this QR code. Then enter the six-digit code.</p>
     {qr&&<img src={qr} width={192} height={192} alt="Authenticator QR code" style={{margin:'12px auto'}}/>}
     <span>Manual secret (only shown during setup):</span><code style={{overflowWrap:'anywhere'}}>{enrollment.totp.secret}</code>
     <button className="ad-btn ad-btn-outline" disabled={busy} onClick={()=>void run(async()=>{
       await cancelTotp(enrollment.id);setEnrollment(null);setFactors(await getTotpFactors());setQr(null);
     })}>Cancel enrollment</button>
   </div>}
   {id&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{
     await verifyTotp(id,code);setCode('');setEnrollment(null);await onComplete();
   });}}>
     <label className="ad-full-field">Google Authenticator code
       <input required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
         value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" />
     </label>
     <button type="submit" disabled={busy||code.length!==6} className="ad-btn ad-btn-primary ad-btn-wide">{busy?'Checking…':'Verify MFA'} <ArrowRight size={16}/></button>
   </form>}
   {message&&<p role="alert" className="ad-error">{message}</p>}
   <p className="ad-hint">To recover a lost factor, contact your database/Auth administrator for a verified identity recovery procedure. Self-service MFA bypass is not supported.</p>
   <button type="button" className="ad-btn ad-btn-outline ad-btn-wide" disabled={busy} onClick={()=>void onSignOut()}>Use another account</button>
   <a className="ad-back" href="/">Return to calculator</a>
 </div></div>;
}
