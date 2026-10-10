import { useCallback,useEffect,useState } from 'react';
import { Crown, ShieldCheck, Eye, FilePenLine, UserCog, UserRoundPlus, Users, LockKeyhole, CheckCircle2, Trash2, Send } from 'lucide-react';
import { tools } from '@/lib/registry';
import {getAdminUtilitySettings,updateAdminUtilitySettings,getTeam,inviteTeamMember,changeTeamRole,getAuditLog,getMyInvites,acceptTeamInvite,getSettingsHistory,restoreSettingsRevision} from '@/lib/launchApi';
import type { UtilitySettings,AdminRole,AdminTeamMember,SettingsRevision } from '@/lib/launchApi';

const roles:AdminRole[]=['owner','admin','editor','viewer'];
const box='ad-panel ad-table-panel';
export function SettingsManager({canEdit,owner}:{canEdit:boolean;owner:boolean}){
 const [data,setData]=useState<UtilitySettings|null>(null);
 const [revisions,setRevisions]=useState<SettingsRevision[]>([]);
 const [savedSnapshot,setSavedSnapshot]=useState('');
 const [loading,setLoading]=useState(true);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const load=useCallback(()=>{setLoading(true);void Promise.all([getAdminUtilitySettings(),getSettingsHistory()]).then(([s,h])=>{setData(s);setSavedSnapshot(JSON.stringify(s));setRevisions(h);}).catch(e=>setMessage(String(e))).finally(()=>setLoading(false));},[]);
 useEffect(load,[load]);
 const dirty=data!==null && savedSnapshot!=='' && JSON.stringify(data)!==savedSnapshot;
 useEffect(()=>{if(!dirty&&!busy)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[busy,dirty]);
 useEffect(()=>{if(!dirty)return;const guard=(event:Event)=>{if(!window.confirm('Leave website settings without publishing your changes?'))event.preventDefault();};window.addEventListener('utility-admin-navigate',guard);return()=>window.removeEventListener('utility-admin-navigate',guard);},[dirty]);
 const toggle=(id:string)=>setData(v=>v?{...v,enabled_tools:v.enabled_tools.includes(id)?v.enabled_tools.filter(x=>x!==id):[...v.enabled_tools,id]}:v);
 return <section className={box}><h2>Public website settings</h2><p>Changes are saved to the database and applied to the public toolkit. At least one tool must stay enabled.</p>
   {loading?<p>Loading settings…</p>:data?<form onSubmit={e=>{e.preventDefault();if(!canEdit)return;
     setBusy(true);setMessage('');void updateAdminUtilitySettings(data).then(()=>{setMessage('Published settings saved.');load();}).catch(e=>setMessage(e instanceof Error?e.message:'Save failed')).finally(()=>setBusy(false));
   }}>
     <div className="ad-form-grid ad-site-identity-fields"><label>Website title<input maxLength={60} required value={data.title} disabled={!canEdit} onChange={e=>setData({...data,title:e.target.value})}/></label>
     <label>Subtitle<input maxLength={120} value={data.tagline} disabled={!canEdit} onChange={e=>setData({...data,tagline:e.target.value})}/></label></div>
     <h3 style={{marginTop:20}}>Visible tools</h3><div className="ad-checkbox-grid">
       {tools.map(t=><label key={t.id}><input type="checkbox" checked={data.enabled_tools.includes(t.id)} disabled={!canEdit} onChange={()=>toggle(t.id)}/>{t.name}</label>)}
     </div>
     {dirty&&<p role="status" className="ad-hint">You have unsaved website changes.</p>}
     {message&&<p role="status" className="ad-hint">{message}</p>}
     {canEdit&&<button type="submit" className="ad-btn ad-btn-primary" disabled={busy||!dirty||!data.title.trim()||data.enabled_tools.length===0}>{busy?'Saving…':'Save & publish'}</button>}
     <button type="button" className="ad-btn ad-btn-outline" onClick={()=>{if((!dirty&&!busy)||(window.confirm('Discard your unpublished changes and reload saved settings?')))load();}}>Discard / refresh</button>
     <h3 style={{marginTop:22}}>Previous published revisions</h3>
     <div className="ad-checkbox-grid">{revisions.map(r=><div key={r.id} className="ad-help"><strong>Version {r.prior_version}</strong><span>{new Date(r.created_at).toLocaleString()} · {r.snapshot.title}</span>
       {owner&&<button type="button" className="ad-btn ad-btn-outline" disabled={busy} onClick={()=>{
         if(!window.confirm('Restore this website revision? Current settings will be retained in history.'))return;
         setBusy(true);setMessage('');void restoreSettingsRevision(r.id,data.row_version).then(()=>{setMessage('Revision restored; reload public website to see it.');load();})
           .catch(e=>setMessage(e instanceof Error?e.message:'Restore failed')).finally(()=>setBusy(false));
       }}>Restore</button>}</div>)}</div>
   </form>:<div>{message&&<p role="alert" className="ad-error">{message}</p>}<button className="ad-btn ad-btn-outline" onClick={load}>Retry</button></div>}
 </section>;
}
const roleCards = [
 { role:'owner', title:'Owner', description:'Full workspace and team control, including protected settings.', icon:Crown, badge:'Highest access' },
 { role:'admin', title:'Admin', description:'Manage approved operations and team workflows.', icon:UserCog, badge:'Manage operations' },
 { role:'editor', title:'Editor', description:'Edit permitted content and settings without owner privileges.', icon:FilePenLine, badge:'Limited access' },
 { role:'viewer', title:'Viewer', description:'Read-only access to authorized workspace information.', icon:Eye, badge:'Read only' },
] as const;

export function TeamManager({owner}:{owner:boolean}){
 const [members,setMembers]=useState<AdminTeamMember[]>([]);
 const [userId,setUserId]=useState('');
 const [role,setRole]=useState<AdminRole>('viewer');
 const [message,setMessage]=useState('');
 const [messageType,setMessageType]=useState<'success'|'error'>('success');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const load=useCallback(()=>{setLoading(true);void getTeam().then(setMembers).catch(e=>{setMessageType('error');setMessage(e instanceof Error?e.message:String(e));}).finally(()=>setLoading(false));},[]);
 useEffect(load,[load]);
 const perform=async(action:()=>Promise<unknown>,success='Team updated.')=>{
  setBusy(true);setMessage('');
  try {await action();setMessageType('success');setMessage(success);load();}
  catch(e){setMessageType('error');setMessage(e instanceof Error?e.message:'Operation failed. Please retry.');}
  finally{setBusy(false);}
 };
 return <div className="ad-team-screen">
  <div className="ad-security-banner"><div className="ad-security-emblem"><ShieldCheck size={23}/></div><div>
   <strong>Role-based access control</strong>
   <span>Supabase enforces access to protected records. Admin sessions require verified authenticator MFA (AAL2).</span>
  </div><span className="ad-security-lock"><LockKeyhole size={16}/> AAL2 required</span></div>
  <div className="ad-role-grid" aria-label="Workspace role descriptions">{roleCards.map(item=><article key={item.role} className={`ad-role-card ad-role-${item.role}`}>
   <div className="ad-role-icon"><item.icon size={23} strokeWidth={1.9}/></div>
   <div className="ad-role-copy"><h3>{item.title}</h3><p>{item.description}</p></div>
   <span className="ad-role-tag">{item.badge}</span>
  </article>)}</div>
  {owner&&<section className="ad-panel ad-team-panel" aria-labelledby="invite-heading">
   <div className="ad-team-panel-title"><span className="ad-team-title-icon"><UserRoundPlus size={23}/></span><div><h2 id="invite-heading">Add / Invite Member</h2><p>Invite an existing Supabase email/password user by their Auth UUID. Invitations remain pending until accepted.</p></div></div>
   <form className="ad-invite-form" onSubmit={e=>{e.preventDefault();void perform(async()=>{await inviteTeamMember(userId.trim(),role);setUserId('');},'Invitation created. The member must accept it and verify TOTP before access.');}}>
    <label className="ad-team-field ad-team-uuid">Existing Auth user UUID
     <input required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" title="Enter the full 36-character Supabase Auth user UUID" value={userId} onChange={e=>setUserId(e.target.value)} placeholder="e.g. 123e4567-e89b-42d3-a456-426614174000" autoComplete="off" disabled={busy}/>
    </label>
    <label className="ad-team-field">Role
     <select value={role} onChange={e=>setRole(e.target.value as AdminRole)} disabled={busy}>{roles.map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}</select>
    </label>
    <button type="submit" disabled={busy||!userId.trim()} className="ad-btn ad-btn-primary ad-team-submit"><Send size={17}/>{busy?'Creating…':'Create 7-day invitation'}</button>
   </form>
   <p className="ad-team-footnote"><ShieldCheck size={14}/> Email addresses are not accepted here; use the existing Supabase Auth UUID. No public signup or automatic roles.</p>
  </section>}
  <section className="ad-panel ad-team-panel" aria-labelledby="members-heading">
   <div className="ad-team-panel-title"><span className="ad-team-title-icon"><Users size={23}/></span><div><h2 id="members-heading">Current Members</h2><p>Review team permissions and manage existing authorized accounts.</p></div><span className="ad-count">{members.length} {members.length===1?'member':'members'}</span></div>
   <div className="ad-table-scroll"><table className="ad-table ad-member-table"><thead><tr><th scope="col">Auth user ID</th><th scope="col">Role</th><th scope="col">Security requirement</th><th scope="col">Actions</th></tr></thead><tbody>
   {members.map(m=><tr key={m.user_id}><td><div className="ad-member-cell"><span className="ad-member-avatar">{m.role.charAt(0).toUpperCase()}</span><div><strong>{m.user_id}</strong><small>Supabase Auth user</small></div></div></td>
    <td><span className={`ad-member-role ad-member-role-${m.role}`}>{m.role}</span></td>
    <td><span className="ad-member-security"><LockKeyhole size={14}/> Verified TOTP session required</span></td>
    <td>{owner?<div className="ad-member-actions"><select aria-label={`Role for ${m.user_id}`} value={m.role} disabled={busy||m.role==='owner'} title={m.role==='owner'?'Owner is protected from removal or reassignment':''} onChange={e=>{const next=e.target.value as AdminRole;if(next!==m.role&&window.confirm(`Change this member's role to ${next}?`))void perform(()=>changeTeamRole(m.user_id,next));}}>{roles.map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}</select>
    <button type="button" className="ad-btn ad-btn-outline ad-danger-btn" disabled={busy||m.role==='owner'} title={m.role==='owner'?'Owner account cannot be removed here':'Remove team member'} onClick={()=>{if(window.confirm('Remove this team member? This immediately revokes their admin role.'))void perform(()=>changeTeamRole(m.user_id,null));}}><Trash2 size={15}/> Remove</button></div>:<span className="ad-hint">Owner only</span>}</td>
   </tr>)}
   {!members.length&&<tr><td colSpan={4}>{loading?'Loading team members…':'No team members found.'}</td></tr>}
   </tbody></table></div>
  </section>
  {message&&<div role={messageType==='error'?'alert':'status'} className={`ad-team-message ${messageType==='error'?'is-error':''}`}><CheckCircle2 size={16}/>{message}</div>}
 </div>;
}
export function InviteGate({onAccepted}:{onAccepted:()=>Promise<void>}){
 const [invites,setInvites]=useState<{id:string;role:AdminRole}[]>([]),[message,setMessage]=useState('');
 useEffect(()=>{void getMyInvites().then(setInvites).catch(()=>undefined);},[]);
 if(!invites.length)return null;
 return <div className="ad-setup-mini"><strong>Pending invitations</strong>{invites.map(i=><button key={i.id} className="ad-btn ad-btn-primary" onClick={()=>void acceptTeamInvite(i.id).then(onAccepted).catch(e=>setMessage(String(e)))}>Accept {i.role} invitation</button>)}{message&&<p role="alert">{message}</p>}</div>;
}
export function AuditViewer(){
 const [entries,setEntries]=useState<{id:number;action:string;entity:string;entity_id:string;occurred_at:string;actor_snapshot:string|null}[]>([]),[page,setPage]=useState(0),[message,setMessage]=useState('');
 useEffect(()=>{void getAuditLog(page*30).then(setEntries).catch(e=>setMessage(String(e)));},[page]);
 return <section className={box}><h2>Access & change history</h2><p>Append-only team, finance and publishing actions.</p>
   {message&&<p role="alert">{message}</p>}
   <div className="ad-table-scroll"><table className="ad-table"><thead><tr><th>Time</th><th>Action</th><th>Object</th><th>Actor</th></tr></thead><tbody>
   {entries.map(e=><tr key={e.id}><td>{new Date(e.occurred_at).toLocaleString()}</td><td>{e.action}</td><td>{e.entity} / {e.entity_id}</td><td><code>{e.actor_snapshot??'system'}</code></td></tr>)}
   {!entries.length&&<tr><td colSpan={4}>No recorded changes.</td></tr>}</tbody></table></div>
   <div className="ad-dialog-actions"><button className="ad-btn ad-btn-outline" disabled={page===0} onClick={()=>setPage(v=>v-1)}>Previous</button><span>Page {page+1}</span><button className="ad-btn ad-btn-outline" disabled={entries.length<30} onClick={()=>setPage(v=>v+1)}>Next</button></div>
 </section>;
}

// Factor removal is supported only from an already verified AAL2 session.
// Prevent removing the last working admin factor from the UI; use controlled
// Auth-admin recovery if the last factor is lost.
export function FactorManager(){
 const [factors,setFactors]=useState<{id:string;status:string;friendly_name?:string}[]>([]);
 const [message,setMessage]=useState('');
 const load=useCallback(()=>{void import('@/lib/launchApi').then(a=>a.getTotpFactors()).then(setFactors).catch(()=>setMessage('Cannot list factors.'));},[]);
 useEffect(load,[load]);
 const verified=factors.filter(x=>x.status==='verified');
 return <section className={box}><h2>Authenticator factors</h2><p>Current TOTP factors: {verified.length}. Keep at least one verified factor to avoid lockout. Lost-factor recovery requires a verified Auth administrator.</p>
 {verified.map(f=><div className="ad-setting-row" key={f.id}><span>{f.friendly_name??'Authenticator'} · {f.id.slice(0,8)}…</span>
  <button className="ad-btn ad-btn-outline" disabled={verified.length<2} onClick={()=>{
    if(!window.confirm('Remove this authenticator?'))return;
    void import('@/lib/launchApi').then(a=>a.cancelTotp(f.id)).then(()=>{setMessage('Factor removed.');load();}).catch(e=>setMessage(String(e)));
  }}>Remove factor</button></div>)}
 {message&&<p role="status">{message}</p>}
 </section>;
}
