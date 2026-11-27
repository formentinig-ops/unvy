{
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const TODAY=new Date();TODAY.setHours(0,0,0,0);
const T=iso(TODAY);
const GG=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const MM=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
const MF=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const fd=s=>{const d=parse(s);return GG[d.getDay()]+' '+d.getDate()+' '+MM[d.getMonth()]};
const eur=n=>(n<0?'−':'')+Math.abs(n).toLocaleString('it-IT')+' €';
const uid=()=>Math.random().toString(36).slice(2,9);

const IC={
home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
x:'<path d="M6 6l12 12M18 6L6 18" stroke-width="3"/>',
cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
team:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.6.2 4.4 1.9 5 4.9"/>',
more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
camp:'<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8M9.5 17h5"/>',
set:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
pin:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
plus:'<path d="M12 5v14M5 12h14" stroke-width="2.6"/>',
bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'};
const ic=(k,c='i')=>`<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;

/* ---------- dati FIPAV (istantanea) ---------- */
let FIPALL=[],FIP={gyms:[],gare:[],cl:[],all:[],camp:'',agg:'',home:null};
/* ---------- dati di esempio ---------- */
const PIZZA_MOT=['Compleanno','Laurea','Esordio di categoria','Cartellino rosso + giallo','Assenza a una partita','Vacanza durante la stagione','Patente','Rifiuto ingresso in campo','Nascita di un figlio'];

const CFG=window.UNVY_CONFIG;
const TOKK='unvy-tok';
let S=null,RAW='',BUSY=false,DEFERRED=null;
let UI={tab:'home',xseg:'cl',xf:'all',cseg:'ag',form:null,cv:'sett',wk:0,mo:0,sel:null};
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}};
UI.cv=lsGet('unvy-cv')||'sett';
let LG={st:0,code:lsGet('unvy-code')||'',people:[],pid:null,pin:'',first:'',err:''};

async function rpc(fn,body){
  const r=await fetch(CFG.url+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:CFG.key,'Content-Type':'application/json'},body:JSON.stringify(body||{})});
  const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}
  if(!r.ok)throw new Error((j&&j.message)||('HTTP '+r.status));
  return j;
}
const ERR={CODICE:'Codice squadra sbagliato.',PIN:'PIN sbagliato.',BLOCCATO:'Troppi tentativi: riprova tra 15 minuti.',PERMESSO:'Non hai il permesso per farlo.',ADMIN:"I permessi dell'Admin non si possono cambiare.",DATI:'Dati non validi.',SESSIONE:'Sessione scaduta: rientra.',PERSONA:'Profilo non trovato.'};
const errMsg=e=>ERR[e.message]||('Errore: '+e.message);
async function loadFip(){
  for(const u of [CFG.fipav,'data/fipav.json'].filter(Boolean)){
    try{const r=await fetch(u+'?t='+Date.now(),{cache:'no-store'});if(r.ok){FIP=await r.json();FIPALL=FIP.all||[];applyFip();return}}catch(e){}
  }
}
function applyFip(){if(!S)return;S.matches=[...FIP.gare.map(m=>({...m})),...S._m];S.gyms=[...FIP.gyms,...S._g]}
async function refresh(quiet){
  const tok=lsGet(TOKK);if(!tok){S=null;render();return}
  try{
    const st=await rpc('get_state',{tok});
    const raw=JSON.stringify(st);
    if(quiet&&raw===RAW&&S)return;
    RAW=raw;st._m=st.matches||[];st._g=st.gyms||[];S=st;applyFip();render();rtConnect();
  }catch(e){
    if(e.message==='SESSIONE'){lsSet(TOKK,null);S=null;render()}
    else if(!quiet)toast('Connessione',' Non riesco a raggiungere il server. Riprovo tra poco.');
  }
}
async function act(a,x,ok){
  if(BUSY)return false;BUSY=true;
  try{const r=await rpc('act',{tok:lsGet(TOKK),a,x:x||{}});rtPing();pushFlush();await refresh();if(ok)toast(ok[0],ok[1]);return r||true}
  catch(e){if(e.message==='SESSIONE'){lsSet(TOKK,null);S=null;render()}else toast('Ops',' '+errMsg(e));return false}
  finally{BUSY=false}
}
/* ---- tempo reale: quando qualcuno modifica qualcosa, gli altri telefoni si aggiornano subito.
   Il segnale non contiene dati: dice solo "ricarica". I dati passano sempre da get_state con il PIN. */
let WS=null,WSREF=0,WSHB=null,WSRETRY=1000,RTT=null;
const RT_TOPIC='realtime:unvy-squadra';
function rtSend(ev,payload){
  if(!WS||WS.readyState!==1)return;
  const hb=ev==='heartbeat';
  WS.send(JSON.stringify({topic:hb?'phoenix':RT_TOPIC,event:ev,payload,ref:String(++WSREF),join_ref:hb?undefined:'1'}));
}
function rtConnect(){
  if(!S||WS||!CFG.url)return;
  try{WS=new WebSocket((CFG.rt||CFG.url.replace(/^http/,'ws')+'/realtime/v1/websocket')+'?apikey='+encodeURIComponent(CFG.key)+'&vsn=1.0.0')}catch(e){WS=null;return}
  WS.onopen=()=>{WSRETRY=1000;rtSend('phx_join',{config:{broadcast:{self:false,ack:false},presence:{key:''},postgres_changes:[],private:false}});WSHB=setInterval(()=>rtSend('heartbeat',{}),25000)};
  WS.onmessage=m=>{try{const d=JSON.parse(m.data);if(d.event==='broadcast'&&d.payload&&d.payload.event==='changed'){clearTimeout(RTT);RTT=setTimeout(()=>refresh(true),300)}}catch(e){}};
  WS.onclose=()=>{clearInterval(WSHB);WS=null;if(S&&document.visibilityState==='visible'){setTimeout(()=>{rtConnect();refresh(true)},WSRETRY);WSRETRY=Math.min(WSRETRY*2,30000)}};
  WS.onerror=()=>{try{WS.close()}catch(e){}};
}
function rtClose(){if(WS){const w=WS;WS=null;try{w.close()}catch(e){}}}
const rtPing=()=>rtSend('broadcast',{type:'broadcast',event:'changed',payload:{}});
/* ---- notifiche push ---- */
const PUSH_KINDS=[['x','Nuova X o Jolly ricevuta'],['partita','Nuova partita inserita'],['cambi','Partita spostata (orario o palestra)'],['prom','Promemoria il giorno prima della partita'],['pre','Promemoria 3 ore prima della partita'],['ris','Risultato della nostra partita'],['risAll','Risultati delle altre squadre (uno per partita)'],['pizza','Promemoria pizza (lunedì sera)']];
const pushOK=()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const PUSH={endpoint:null};
const u8=s=>{const b=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4));return Uint8Array.from(b,c=>c.charCodeAt(0))};
async function pushEndpoint(){try{const r=await navigator.serviceWorker.ready;const s=await r.pushManager.getSubscription();PUSH.endpoint=s?s.endpoint:null}catch(e){PUSH.endpoint=null}}
function pushFlush(){try{fetch(CFG.url+'/functions/v1/push',{method:'POST',headers:{apikey:CFG.key,'Content-Type':'application/json'},body:'{"mode":"flush"}',keepalive:true}).catch(()=>{})}catch(e){}}
async function pushOn(){
  if(!pushOK())return;
  try{
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){toast('Notifiche non attive',' Hai negato il permesso: puoi riattivarlo dalle impostazioni del telefono.');render();return}
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(CFG.vapid)});
    const j=sub.toJSON();
    const prefs=Object.fromEntries(PUSH_KINDS.map(([k])=>[k,true]));
    if(await act('push_sub',{endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,prefs})){PUSH.endpoint=j.endpoint;await act('push_test',{});render()}
  }catch(e){toast('Ops',' Non riesco ad attivare le notifiche su questo telefono.')}
}
async function pushOff(){
  try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub){await act('push_unsub',{endpoint:sub.endpoint});await sub.unsubscribe()}}catch(e){}
  PUSH.endpoint=null;render();
}
function notifSection(){
  const h='<h2>Notifiche</h2>';
  if(!pushOK())return h+`<div class="card small">${isIOS&&!standalone()?"Su iPhone le notifiche funzionano solo dall'app installata: in Safari tocca Condividi → “Aggiungi alla schermata Home”, poi apri UNVY dall'icona e torna qui.":'Questo browser non supporta le notifiche. Prova con Chrome o Safari aggiornati.'}</div>`;
  if(Notification.permission==='denied')return h+'<div class="card small">Le notifiche sono bloccate per UNVY. Riattivale dalle impostazioni del telefono, poi torna qui.</div>';
  const mine=(S.push||[]).find(s=>s.endpoint===PUSH.endpoint);
  if(!mine)return h+`<div class="card"><p class="small mute" style="margin:0 0 10px">Ricevi gli avvisi anche con l'app chiusa.</p><button class="btn a" style="margin:0" data-a="pushon">Attiva le notifiche</button></div>`;
  return h+`<div class="list">${PUSH_KINDS.map(([k,l])=>`<label class="set"><span>${l}</span><input type="checkbox" class="sw" data-f="pushpref" data-k="${k}" ${mine.prefs[k]!==false?'checked':''}></label>`).join('')}</div><button class="btn ghost" data-a="pushoff">Disattiva su questo telefono</button>`;
}
const catGroups=()=>{const seen=new Set(),out=[];S.cats.forEach(c=>{const k=c.t+c.g;if(!seen.has(k)){seen.add(k);out.push([c.t,c.g])}});return out};
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function installCard(){
  if(standalone()||lsGet('unvy-inst'))return '';
  return `<div class="card" style="margin-bottom:12px;border-color:var(--acc)"><b>Installa l'app sul telefono</b><p class="mute small" style="margin:4px 0 10px">${isIOS?'In Safari tocca Condividi (il quadrato con la freccia in su) e poi “Aggiungi alla schermata Home”.':'Nel menu del browser (⋮) tocca “Installa app” o “Aggiungi a schermata Home”.'}</p><span style="display:flex;gap:8px">${DEFERRED?'<button class="btn sm a" data-a="inst">Installa</button>':''}<button class="btn sm ghost" data-a="instok">Ho capito</button></span></div>`;
}
function loginView(){
  const head=(t,s)=>`<div style="text-align:center;margin:8px 0 18px"><img src="icons/logo-crop.png" alt="UNVY" width="96" height="96" style="border-radius:22px;background:#000"><h1 style="font-size:28px;margin:14px 0 4px">${t}</h1><p class="mute" style="margin:0">${s}</p></div>`;
  const err=LG.err?`<p style="color:var(--xr);text-align:center;font-weight:700">${esc(LG.err)}</p>`:'';
  if(LG.st===0)return head('Entra in squadra',"Il codice te lo dà l'Admin.")+`<form id="lf0"><label class="f" for="lcode">Codice squadra</label><input id="lcode" class="inp" style="text-align:center;font-size:22px;font-weight:800;letter-spacing:.08em;text-transform:uppercase" placeholder="UNVY-XXXXX" autocomplete="off" autocapitalize="characters" value="${esc(LG.code)}">${err}<button class="btn">Continua</button></form>${installCard()}`;
  if(LG.st===1)return head('Chi sei?','Tocca il tuo nome.')+err+`<div class="list">${LG.people.map(p=>`<button class="row" style="grid-template-columns:auto minmax(0,1fr) auto" data-a="lgp" data-v="${esc(p.id)}">${jersey(p,36)}<span class="who"><b>${esc(p.nome+' '+p.cognome)}</b><span>${esc(p.ruolo)}${p.has_pin?'':' · primo accesso'}</span></span><span class="mute">›</span></button>`).join('')}</div><button class="btn ghost" data-a="lgback">Indietro</button>`;
  const p=LG.people.find(x=>x.id===LG.pid)||{};
  const t=p.has_pin?'Il tuo PIN':(LG.first?'Ripeti il PIN':'Scegli il tuo PIN');
  const s=p.has_pin?esc((p.nome||'')+' '+(p.cognome||'')):'4 cifre che sai solo tu. Ti servirà per entrare da un altro telefono.';
  return head(t,s)+`<div class="pin">${[0,1,2,3].map(i=>`<i class="${i<LG.pin.length?'f':''}"></i>`).join('')}</div>${err}<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px auto 0;max-width:320px">${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>k===''?'<span></span>':`<button class="btn ghost" style="margin:0;font-size:24px;height:60px" data-a="pk" data-v="${k}" aria-label="${k==='⌫'?'Cancella':k}">${k}</button>`).join('')}</div><div style="max-width:320px;margin:0 auto"><button class="btn ghost" data-a="lgback">Indietro</button></div>`;
}
async function doLogin(pin){
  try{
    const r=await rpc('login',{code:LG.code,pid:LG.pid,pin});
    if(!r||r.error){LG.err=ERR[(r&&r.error)||'PIN'];LG.pin='';render();return}
    lsSet(TOKK,r.token);lsSet('unvy-code',LG.code);
    const nm=(LG.people.find(x=>x.id===LG.pid)||{}).nome||'';
    LG={st:0,code:LG.code,people:[],pid:null,pin:'',first:'',err:''};
    UI.tab='home';await refresh();toast('Benvenuto',' '+nm+', sei dentro.');
  }catch(e){LG.err=errMsg(e);LG.pin='';render()}
}
const P=id=>S.people.find(p=>p.id===id)||{sopr:'?',nome:'',cognome:'',perms:[],min:[]};
const C=id=>S.cats.find(c=>c.id===id)||{nome:'Categoria rimossa',u:1};
const ME=()=>P(S.me);
const can=k=>ME().perms.includes(k);
const units=e=>C(e.c).u*e.q;

function jersey(p,sz=40){
  if(p.foto)return `<img class="ava" src="${esc(p.foto)}" width="${sz}" height="${sz}" alt="">`;
  const lib=p.ruolo==='Libero';const fill=lib?'var(--acc)':'var(--shirt)';
  const n=p.num??(p.nome[0]+p.cognome[0]);
  const K=1.2,w=Math.round(sz*K); /* maglia più grande, numero della stessa grandezza */
  return `<svg width="${w}" height="${w}" viewBox="0 0 40 40" aria-hidden="true"><path d="M13 4L3 9.5l3.6 8 4.4-2V37h18V15.5l4.4 2 3.6-8L27 4c-1.6 3-4 4.4-7 4.4S14.6 7 13 4z" fill="${fill}" stroke="${lib?'none':'var(--shirtE)'}" stroke-width="1.2"/><text x="20" y="${p.num!=null?29:27}" text-anchor="middle" fill="#fff" font-family="Archivo" font-weight="900" font-stretch="120%" font-size="${((p.num!=null?13:9)/K).toFixed(1)}">${esc(n)}</text></svg>`;
}
function tot(pid){let x=0,j=0;S.entries.forEach(e=>{if(e.p!==pid||e.st!=='ok')return;e.t==='X'?x+=units(e):j+=units(e)});return {x,j,net:(x-j)*S.valX}}
function rank(){return S.people.filter(p=>p.stato!=='fuori').map(p=>({p,...tot(p.id)})).sort((a,b)=>b.x-b.j-(a.x-a.j)||b.x-a.x)}
function cassa(){let x=0,j=0,q=0;S.people.forEach(p=>{const t=tot(p.id);if(p.stato==='gioca'){x+=t.x;j+=t.j}if(p.stato==='esonerato')q+=S.quota});return {x,j,q,tot:(x-j)*S.valX+q}}
const mapsUrl=a=>{const q=encodeURIComponent(a);return /iPhone|iPad|Macintosh/.test(navigator.userAgent)?'https://maps.apple.com/?daddr='+q:'https://www.google.com/maps/dir/?api=1&destination='+q};
const gym=id=>S.gyms.find(g=>g.id===id)||S.gyms[0];
const goBtn=g=>`<a class="go" href="${esc(mapsUrl(g.addr))}" target="_blank" rel="noopener">${ic('pin')}Portami lì</a>`;

function pizzaSched(n){
  const pz=S.pizza,out=[],t=add(TODAY,(2-TODAY.getDay()+7)%7);let i=0;
  for(let w=0;w<60&&i<pz.due.length&&out.length<n;w++){const d=iso(add(t,7*w));
    if(pz.skip[d]||((S.training||{})[d]||{}).annullato){out.push({d,skip:true});continue}
    const x=pz.due[i];out.push({d,p:x.p,why:x.mot,i,id:x.id});i++}
  return out;
}
const TR={1:['20:30','22:30'],2:['20:45','22:45'],4:['20:30','22:30']};
const hm=s=>{const [h,m]=s.split(':').map(Number);return h*60+m};
const plus=(s,n)=>{const t=Math.min(hm(s)+n,1439);return pad(Math.floor(t/60))+':'+pad(t%60)};
let PZ=[];
function evs(k){
  const wd=parse(k).getDay(),it=[];
  S.matches.filter(m=>m.d===k).forEach(m=>it.push({k:'m',ini:m.ora,fine:plus(m.ora,120),m}));
  const ex=(S.training||{})[k];
  if(ex&&ex.annullato){if(TR[wd])it.push({k:'a',ini:TR[wd][0],fine:TR[wd][1],off:true,d:k,ex})}
  else if(ex&&ex.ini)it.push({k:'a',ini:ex.ini,fine:ex.fine||plus(ex.ini,120),d:k,ex});
  else if(TR[wd])it.push({k:'a',ini:TR[wd][0],fine:TR[wd][1],d:k});
  const z=PZ.find(z=>z.d===k&&!z.skip)||(h=>h&&{d:k,p:h.p,why:h.mot+' · pagata'})(S.pizza.hist.find(h=>h.d===k));if(z)it.push({k:'z',ini:'22:45',fine:'23:30',z});
  return it.sort((a,b)=>a.ini.localeCompare(b.ini));
}
const mTitle=m=>m.casa?'UNVY – '+m.avv:m.avv+' – UNVY';
const risHtml=m=>m.ris?`<div style="margin-top:6px"><span class="tag ${(m.casa?m.ris[0]>m.ris[2]:m.ris[2]>m.ris[0])?'a':'x'}">${(m.casa?m.ris[0]>m.ris[2]:m.ris[2]>m.ris[0])?'Vinta':'Persa'} ${esc(m.ris)}</span><span class="small mute">${esc(m.parz)}</span></div>`:'';
const srcTag=m=>m.fip?`<span class="tag">${m.g}ª giornata</span>`:'<span class="tag">Amichevole</span>';
function evBody(e){
  if(e.k==='m'){const m=e.m,g=gym(m.gym);return `<div><span class="tag m">Partita ${esc(m.ora)}</span><span class="tag ${m.casa?'a':''}">${m.casa?'Casa':'Trasferta'}</span>${srcTag(m)}<div class="evt">${esc(mTitle(m))}</div>${risHtml(m)}<div class="mute small">${esc(g.nome)} · ${esc(g.addr)}</div>${m.ris?'':goBtn(g)}${can('partite')&&!m.fip?` <button class="btn sm ghost" data-a="match" data-v="${m.id}">Modifica</button>`:''}</div>`}
  if(e.k==='a'){const g=gym(FIP.home),mod=can('partite')&&e.d?` <button class="btn sm ghost" data-a="tr" data-v="${e.d}">Modifica</button>`:'';
    if(e.off)return `<div><span class="tag x">Allenamento annullato</span><div class="evt num" style="text-decoration:line-through;opacity:.6">${e.ini} – ${e.fine}</div>${e.ex&&e.ex.nota?`<div class="mute small">${esc(e.ex.nota)}</div>`:''}${mod}</div>`;
    return `<div><span class="tag">Allenamento</span>${e.ex?'<span class="tag a">Orario speciale</span>':''}<div class="evt num">${e.ini} – ${e.fine}</div><div class="mute small">${esc(g.nome)}${e.ex&&e.ex.nota?' · '+esc(e.ex.nota):' · arrivo entro 20:45'}</div>${goBtn(g)}${mod}</div>`}
  const z=e.z;return `<div><span class="tag x">Pizza</span><div class="evt">Paga ${esc(P(z.p).sopr)}</div><div class="mute small">${esc(z.why)} · 75 € · 5 mezzi metri</div></div>`;
}
const whenBox=d=>{const x=parse(d);return `<div class="when"><span>${GG[x.getDay()]}</span><b>${x.getDate()}</b><span>${MM[x.getMonth()]}</span></div>`};
function matchCard(m){return `<div class="ev">${whenBox(m.d)}${evBody({k:'m',m})}</div>`}

/* ---------- viste ---------- */
const V={};
V.home=()=>{
  const c=cassa(),r=rank(),top=[r[1],r[0],r[2]],H=[86,120,62];
  const nm=S.matches.filter(m=>m.d>=T).sort((a,b)=>a.d.localeCompare(b.d))[0];
  const z=pizzaSched(4).find(x=>!x.skip);
  return `  <section class="card cassa"><div class="lbl">Cassa X · Serie C 26/27</div><div class="big num">${eur(c.tot)}</div>
  <div class="trio"><div><b class="num">${c.x}</b><span>X assegnate</span></div><div class="j"><b class="num">${c.j}</b><span>Jolly</span></div></div></section>
  ${myBox()}
  <h2>Classifica X</h2>
  <div class="podium">${top.map((t,i)=>t?`<button class="pod p${[2,1,3][i]}" style="border:0;background:none;padding:0" data-a="player" data-v="${t.p.id}">${jersey(t.p,i===1?60:48)}<div class="nm">${esc(t.p.sopr)}</div><div class="eu num">${eur(t.net)}</div><div class="blk" style="height:${H[i]}px">${[2,1,3][i]}</div></button>`:'<div></div>').join('')}</div>
  <button class="link" data-a="tab" data-v="x">Classifica completa</button>
  <h2>Prossima partita</h2>${(()=>{const u=FIP.cl.find(c=>c.sq.startsWith('Univolley'));return u?`<p class="mute" style="margin:-6px 0 10px">In classifica: <b style="color:var(--ink)">${u.pos}° posto · ${u.pt} punti</b> <button class="link" style="display:inline;padding:0;margin:0" data-a="camp">Vedi</button></p>`:''})()}
  <div class="card">${nm?matchCard(nm):'<div class="empty">Nessuna partita in calendario</div>'}</div>
  <h2>Prossima pizza</h2>
  ${z?`<button class="card ev" style="width:100%;text-align:left" data-a="pztab">${whenBox(z.d)}<div><span class="tag x">${esc(z.why)}</span><div class="evt">Paga ${esc(P(z.p).sopr)}</div><div class="mute small">75 € · 5 mezzi metri</div></div></button>`:'<div class="card empty">Nessuno deve la pizza. Per ora.</div>'}`;
};
function myBox(){
  const me=ME();if(me.stato==='fuori')return '';
  const r=rank(),i=r.findIndex(t=>t.p.id===me.id);if(i<0)return '';const t=r[i];
  const val=me.stato==='esonerato'?'quota '+eur(S.quota):t.net<0?'ricevi '+eur(-t.net):eur(t.net);
  return `<h2>Le tue X</h2><button class="card" style="width:100%;text-align:left;display:flex;align-items:center;gap:14px" data-a="player" data-v="${me.id}">${jersey(me,44)}<span style="flex:1"><b style="font-size:22px;font-stretch:112%">${val}</b><span class="small mute" style="display:block">${t.x} X${t.j?' · '+t.j+' Jolly':''} · ${i+1}° in classifica</span></span><span class="mute">›</span></button>`;
}
V.x=()=>{
  if(!['mv','st'].includes(UI.xseg))UI.xseg='cl';
  let h=`<h1>X e Jolly</h1><div class="seg">${[['cl','Classifica'],['mv','Movimenti'],['st','Statistiche']].map(([k,l])=>`<button class="${UI.xseg===k?'on':''}" data-a="xseg" data-v="${k}">${l}</button>`).join('')}</div>`;
  if(UI.xseg==='cl'){
    h+=`<div class="list">${rank().map((t,i)=>`<button class="row" data-a="player" data-v="${t.p.id}"><span class="rk">${i+1}</span>${jersey(t.p,36)}<span class="who"><b>${esc(t.p.sopr)}</b><span>${esc(t.p.ruolo)}</span><span class="cnt"><span class="xx">${t.x} X</span>${t.j?`<span class="jj">${t.j} Jolly</span>`:''}</span></span><span class="eur num"${t.net<0?' style="color:var(--acc)"':''}>${t.net<0?'+'+eur(-t.net):eur(t.net)}${t.p.stato==='esonerato'?'<small>esonerato</small>':t.net<0?'<small>da ricevere</small>':''}</span></button>`).join('')}</div>`;
  }else if(UI.xseg==='mv'){
    h+=`<div class="chips" style="margin-bottom:6px">${[['all','Tutti'],['X','Solo X'],['J','Solo Jolly'],['me','Le mie']].map(([k,l])=>`<button class="chip ${UI.xf===k?'on':''}" data-a="xf" data-v="${k}">${l}</button>`).join('')}</div>`;
    const L=S.entries.filter(e=>e.st==='ok'&&(UI.xf==='all'||UI.xf===e.t||(UI.xf==='me'&&e.p===S.me))).sort((a,b)=>b.d.localeCompare(a.d));
    let cur='';let open=false;
    L.slice(0,80).forEach(e=>{const m=e.d.slice(0,7);if(m!==cur){if(open)h+='</div>';cur=m;const d=parse(e.d);h+=`<div class="mon">${MF[d.getMonth()]} ${d.getFullYear()}</div><div class="list">`;open=true}
      h+=`<button class="row mv" data-a="entry" data-v="${e.id}"><span class="badge ${e.t}">${e.t==='X'?'X':'J'}</span><span class="who"><b>${esc(P(e.p).sopr)}${e.q>1?' ×'+e.q:''}</b><span>${esc(C(e.c).nome)}</span></span><span class="small mute num">${fd(e.d)}</span></button>`});
    if(open)h+='</div>';if(!L.length)h+='<div class="empty">Nessun movimento</div>';
  }else h+=statsView();
  return h+xFooter();
};
function statsView(){
  const X=S.entries.filter(e=>e.st==='ok'&&e.t==='X');
  if(!X.length)return '<div class="empty">Ancora nessuna X</div>';
  const byCat={};X.forEach(e=>{const v=byCat[e.c]||(byCat[e.c]={n:0,u:0});v.n+=e.q;v.u+=units(e)});
  const cats=Object.entries(byCat).sort((a,b)=>b[1].u-a[1].u||b[1].n-a[1].n),mx=Math.max(...cats.map(c=>c[1].u));
  let h=`<div class="card">${cats.slice(0,10).map(([c,v],i)=>`<div class="srank"><div class="srow2"><span>${i+1}. ${esc(C(c).nome)}</span><b class="num">${eur(v.u*S.valX)}</b></div><div class="t"><i style="width:${v.u/mx*100}%"></i></div><div class="small mute">${v.n===1?'1 volta':v.n+' volte'}</div></div>`).join('')}</div>`;
  const months={};X.forEach(e=>{const m=e.d.slice(0,7);const o=months[m]||(months[m]={});o[e.p]=(o[e.p]||0)+units(e)});
  h+=`<div class="list" style="margin-top:18px">${Object.keys(months).sort().reverse().map(m=>{
    const arr=Object.entries(months[m]).sort((a,b)=>b[1]-a[1]),top=arr[0][1],kings=arr.filter(a=>a[1]===top).map(a=>P(a[0])),tot=arr.reduce((t,a)=>t+a[1],0),d=parse(m+'-01');
    return `<button class="qrow" style="grid-template-columns:auto minmax(0,1fr) auto;width:100%;border:0;background:none;text-align:left" data-a="player" data-v="${kings[0].id}">${jersey(kings[0],34)}<div><b>${MF[d.getMonth()]} ${d.getFullYear()}</b><div class="small mute">${esc(kings.map(k=>k.sopr).join(', '))} · ${top} X</div></div><span class="small mute num">${tot} X in tutto</span></button>`}).join('')}</div>`;
  return h;
}
function riepilogoText(){
  const r=rank();
  const det=t=>` (${t.x} X${t.j?`, ${t.j} Jolly`:''})`;
  const lines=r.map(t=>`${t.p.sopr}: ${t.p.stato==='esonerato'?'quota '+eur(S.quota):t.net<0?'riceve '+eur(-t.net):eur(t.net)}${det(t)}`);
  return `Riepilogo X · Serie C 26/27 (al ${fd(T)})\n\n${lines.join('\n')}\n\nTotale cassa: ${eur(cassa().tot)}`;
}
function xFooter(){
  return `<h2>Riepilogo per il pagamento</h2><div class="card"><button class="btn a" style="margin:0" data-a="riep">Copia il riepilogo</button><details style="margin-top:12px"><summary class="small">Vedi il testo</summary><pre class="riep">${esc(riepilogoText())}</pre></details></div>
  <button class="card" style="width:100%;text-align:left;display:flex;align-items:center;gap:12px;margin-top:14px" data-a="regol">${ic('doc')}<span><b>Regolamento Serie C 26/27</b><span class="small mute" style="display:block">Apri il PDF</span></span></button>`;
}
function download(name,type,content){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);
}
V.cal=()=>{
  PZ=pizzaSched(40);
  let h=`<h1>Calendario</h1><div class="seg">${[['ag','Calendario'],['pz','Pizza']].map(([k,l])=>`<button class="${UI.cseg===k?'on':''}" data-a="cseg" data-v="${k}">${l}</button>`).join('')}</div>`;
  if(UI.cseg==='pz')return h+pizzaView();
  h+=`<div class="vsw">${[['sett','Settimana'],['mese','Mese'],['lista','Elenco']].map(([k,l])=>`<button class="chip ${UI.cv===k?'on':''}" data-a="cv" data-v="${k}">${l}</button>`).join('')}</div>`;
  if(UI.cv==='sett')h+=weekView();else if(UI.cv==='mese')h+=monthView();else h+=listView();
  h+=summaryRows();
  return h+`<div class="legend"><span><i style="background:var(--ink)"></i>Partita</span><span><i style="background:var(--acc)"></i>Allenamento</span><span><i style="background:var(--xr)"></i>Pizza</span></div>`;
};
function summaryRows(){
  const lab={m:'Partita',a:'Allenamento',z:'Pizza'};
  const desc=e=>e.k==='m'?mTitle(e.m)+' · '+e.ini:e.k==='a'?(e.off?'Allenamento annullato':'Allenamento '+e.ini+' – '+e.fine):'Pizza · paga '+P(e.z.p).sopr;
  let tE=evs(T),day=T;
  let r1;
  if(tE.length)r1=`<button class="srow" data-a="ev" data-v="${T}|${tE[0].k}"><span class="sk">Oggi</span><span class="sv">${esc(tE.map(desc).join(' · '))}</span><span class="mute">›</span></button>`;
  else{for(let i=1;i<14&&!evs(day=iso(add(TODAY,i))).length;i++);const e=evs(day)[0];r1=`<button class="srow" data-a="ev" data-v="${day}|${e?e.k:''}"><span class="sk">Oggi</span><span class="sv">${TODAY.getDay()===3?'San Mercoledì':'Riposo'}<span class="mute"> · poi ${esc(fd(day))}: ${esc(e?desc(e):'—')}</span></span><span class="mute">›</span></button>`}
  const nm=S.matches.filter(m=>m.d>=T).sort((a,b)=>(a.d+a.ora).localeCompare(b.d+b.ora))[0];
  const lbl='Prossima';
  const r2=nm?`<button class="srow" data-a="ev" data-v="${nm.d}|m"><span class="sk" style="background:var(--ink);color:var(--bg)">${lbl}</span><span class="sv"><b>${esc(mTitle(nm))}</b><span class="mute"> · ${esc(fd(nm.d))} ${esc(nm.ora)} · ${nm.casa?'casa':'trasferta'}</span></span><span class="mute">›</span></button>`:'';
  return `<div class="list" style="margin-top:12px">${r1}${r2}</div>`;
}
function weekView(){
  const mon=add(TODAY,-((TODAY.getDay()+6)%7)+7*UI.wk),days=[...Array(7)].map((_,i)=>add(mon,i)),E=days.map(d=>evs(iso(d)));
  let h0=19,h1=23;E.flat().filter(e=>e.k!=='z'&&!e.off).forEach(e=>{h0=Math.min(h0,Math.floor(hm(e.ini)/60));h1=Math.max(h1,Math.ceil(hm(e.fine)/60))});h1=Math.min(h1,24);
  const PX=52,H=(h1-h0)*PX,sun=days[6];
  const ttl=mon.getMonth()===sun.getMonth()?`${mon.getDate()} – ${sun.getDate()} ${MM[sun.getMonth()]}`:`${mon.getDate()} ${MM[mon.getMonth()]} – ${sun.getDate()} ${MM[sun.getMonth()]}`;
  const nowM=new Date().getHours()*60+new Date().getMinutes();
  let g=`<div class="cnav"><button class="nb" data-a="wk" data-v="-1" aria-label="Settimana precedente">‹</button><span class="ttlw">${ttl}</span><button class="nb" data-a="wk" data-v="1" aria-label="Settimana successiva">›</button>${UI.wk?'<button class="today" data-a="wk" data-v="0">Oggi</button>':''}</div>`;
  g+=`<div class="wk"><div class="wg"><div class="dh"></div>${days.map(d=>`<div class="dh ${iso(d)===T?'td':''}">${GG[d.getDay()].slice(0,1)}<b>${d.getDate()}</b></div>`).join('')}`;
  g+=`<div class="adl">pizza</div>${days.map((d,i)=>`<div class="ad">${E[i].filter(e=>e.k==='z').map(e=>`<button class="chipz" data-a="ev" data-v="${iso(d)}|z">${esc(P(e.z.p).sopr)}</button>`).join('')}</div>`).join('')}`;
  g+=`<div class="hrs" style="height:${H}px">${[...Array(h1-h0)].map((_,i)=>i?`<span style="top:${i*PX}px">${h0+i}</span>`:'').join('')}</div>`;
  g+=days.map((d,i)=>{const k=iso(d),td=k===T;
    return `<div class="col ${td?'td':''}" style="height:${H}px;--hh:${PX}px">${E[i].filter(e=>e.k!=='z'&&!e.off).map(e=>{const top=(hm(e.ini)-h0*60)/60*PX,ht=Math.max(34,(hm(e.fine)-hm(e.ini))/60*PX-2);
      const lab=e.k==='m'?(e.m.casa?'vs ':'@ ')+e.m.avv:'Allen.';
      return `<button class="blk2 ${e.k}" style="top:${top}px;height:${ht}px" data-a="ev" data-v="${k}|${e.k}">${esc(lab)}<small>${e.ini}</small></button>`}).join('')}${td&&nowM>=h0*60&&nowM<=h1*60?`<div class="now" style="top:${(nowM-h0*60)/60*PX}px"></div>`:''}</div>`}).join('');
  return g+'</div></div>';
}
function monthView(){
  const first=new Date(TODAY.getFullYear(),TODAY.getMonth()+UI.mo,1),m=first.getMonth();
  const start=add(first,-((first.getDay()+6)%7));const sel=UI.sel||T;
  let g=`<div class="cnav"><button class="nb" data-a="mo" data-v="-1" aria-label="Mese precedente">‹</button><span class="ttlw">${MF[m]} ${first.getFullYear()}</span><button class="nb" data-a="mo" data-v="1" aria-label="Mese successivo">›</button>${UI.mo?'<button class="today" data-a="mo" data-v="0">Oggi</button>':''}</div>`;
  g+=`<div class="wk"><div class="mg">${['L','M','M','G','V','S','D'].map(x=>`<div class="dn">${x}</div>`).join('')}`;
  const weeks=Math.ceil(((first.getDay()+6)%7+new Date(first.getFullYear(),m+1,0).getDate())/7);
  for(let i=0;i<weeks*7;i++){const d=add(start,i),k=iso(d),E=evs(k);
    g+=`<button class="cell ${d.getMonth()!==m?'out':''} ${k===T?'td':''} ${k===sel?'sel':''}" data-a="sel" data-v="${k}"><b>${d.getDate()}</b><span class="dots">${E.filter(e=>!e.off).map(e=>`<i class="${e.k}"></i>`).join('')}</span></button>`}
  g+='</div></div>';
  const E=evs(sel);
  g+=`<div class="mon">${fd(sel)}${sel===T?' · oggi':''}</div>`+(E.length?`<div class="card">${E.map(evBody).join('<div style="height:14px"></div>')}</div>`:'<div class="card empty">Niente in programma</div>');
  return g;
}
function listView(){
  let h='';
  for(let i=0;i<28;i++){const k=iso(add(TODAY,i)),E=evs(k);if(!E.length)continue;
    h+=`<div class="mon">${fd(k)}${k===T?' · oggi':''}</div><div class="card">${E.map(evBody).join('<div style="height:14px"></div>')}</div>`}
  return h;
}
V.camp=()=>`<h1>Campionato</h1>`+campView();
function curGio(){
  /* giornata corrente: da domenica in poi si passa alla successiva */
  const sun=iso(add(TODAY,-TODAY.getDay())),med={};
  FIPALL.forEach(r=>(med[r[0]]=med[r[0]]||[]).push(r[1]));
  const rounds=Object.keys(med).map(Number).sort((a,b)=>a-b);
  for(const g of rounds){const d=med[g].sort();if(d[Math.floor(d.length/2)]>=sun)return g}
  return rounds[rounds.length-1];
}
function campView(){
  const G=S.matches.filter(m=>m.fip).sort((a,b)=>a.d.localeCompare(b.d)),past=G.filter(m=>m.ris).reverse(),next=G.filter(m=>!m.ris);
  const maxG=Math.max(...FIPALL.map(r=>r[0]));
  if(!UI.gio)UI.gio=curGio();
  let h=`<div class="vsw">${[['gio','Giornata'],['cl','Classifica'],['nos','Le nostre']].map(([k,l])=>`<button class="chip ${(UI.cpv||'gio')===k?'on':''}" data-a="cpv" data-v="${k}">${l}</button>`).join('')}</div>`;
  const v=UI.cpv||'gio';
  if(v==='gio'){
    const R=FIPALL.filter(r=>r[0]===UI.gio).sort((a,b)=>(a[1]+a[2]).localeCompare(b[1]+b[2]));
    const inR=new Set(R.flatMap(r=>[r[3],r[4]])),rest=FIP.cl.map(c=>c.sq).filter(x=>!inR.has(x));
    h+=`<div class="cnav"><button class="nb" data-a="gio" data-v="-1" aria-label="Giornata precedente">‹</button><span class="ttlw">${UI.gio}ª giornata${UI.gio===13?' · inizio ritorno':''}</span><button class="nb" data-a="gio" data-v="1" aria-label="Giornata successiva">›</button></div>`;
    h+=`<div class="list">${R.map(r=>{const me=r[3].startsWith('Univolley')||r[4].startsWith('Univolley'),[sh,sa]=r[5]?r[5].split('-').map(Number):[null,null];
      return `<div style="padding:12px 14px;${me?'background:var(--accbg)':''}" class="${''}"><div class="small mute">${fd(r[1])} · ${esc(r[2])}</div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;margin-top:4px;font-size:16px"><span style="${sh>sa?'font-weight:800':''}">${esc(r[3])}</span><b class="num">${sh??''}</b><span style="${sa>sh?'font-weight:800':''}">${esc(r[4])}</span><b class="num">${sa??''}</b></div>
      ${r[6]?`<div class="small mute" style="margin-top:4px">${esc(r[6])}</div>`:r[5]?'':'<div class="small mute" style="margin-top:4px">Da giocare</div>'}</div>`}).join('<div style="border-top:1px solid var(--line)"></div>')}</div>`;
    if(rest.length)h+=`<p class="mute small">Riposa: ${esc(rest.join(', '))}</p>`;
    UI.maxG=maxG;
  }else if(v==='cl'){
    h+=`<p class="mute" style="margin-top:-4px">${esc(FIP.camp)}</p><div class="card" style="padding:6px 10px"><table class="ptab"><thead><tr><th>#</th><th style="text-align:left">Squadra</th><th>Pt</th><th>G</th><th>V</th><th>P</th></tr></thead><tbody>${FIP.cl.map(c=>{const me=c.sq.startsWith('Univolley');return `<tr style="${me?'font-weight:800;background:var(--accbg);color:var(--acc)':''}"><td>${c.pos}</td><td style="text-align:left">${esc(c.sq)}</td><td><b>${c.pt}</b></td><td>${c.pg}</td><td>${c.pv}</td><td>${c.pp}</td></tr>`}).join('')}</tbody></table></div>`;
  }else{
    h+=`<h2 style="margin-top:6px">Prossime partite</h2><div class="list">${next.slice(0,4).map(m=>`<button class="qrow" style="grid-template-columns:auto minmax(0,1fr);width:100%;border:0;background:none;text-align:left" data-a="ev" data-v="${m.d}|m">${whenBox(m.d)}<div><span class="tag ${m.casa?'a':''}">${m.casa?'Casa':'Trasferta'}</span><span class="small mute">ore ${esc(m.ora)}</span><div class="evt">${esc(mTitle(m))}</div></div></button>`).join('')}</div>`;
    h+=`<h2>Risultati</h2><div class="list">${past.map(m=>`<div class="qrow" style="grid-template-columns:auto minmax(0,1fr)">${whenBox(m.d)}<div><div class="evt">${esc(mTitle(m))}</div>${risHtml(m)}</div></div>`).join('')}</div>`;
  }
  return h;
}
function pizzaView(){
  const pz=S.pizza,ok=can('pizza'),sch=pizzaSched(pz.due.length+8);
  let h='';
  h+=`<div class="list">${sch.length?sch.map((z,n)=>`<div class="qrow" style="grid-template-columns:auto minmax(0,1fr) auto">${whenBox(z.d)}<div>${z.skip?'<div class="evt mute">Martedì saltato</div>':`<div class="evt">${esc(P(z.p).sopr)}</div><span class="tag x">${esc(z.why)}</span>`}${ok?`<span style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${z.skip?`<button class="btn sm ghost" data-a="pskip" data-v="${z.d}">Ripristina martedì</button>`:`${n===0||sch.slice(0,n).every(x=>x.skip)?`<button class="btn sm a" data-a="ppaid" data-v="${z.id}|${z.d}">Pagata</button>`:''}<button class="btn sm ghost" data-a="pskip" data-v="${z.d}">Salta martedì</button><button class="btn sm ghost" data-a="pdel" data-v="${z.id}">Togli</button>`}</span>`:''}</div><span></span></div>`).join(''):'<div class="empty">Nessuno deve la pizza</div>'}</div>`;
  h+=`<h2>Già pagate</h2><div class="list">${pz.hist.length?[...pz.hist].reverse().map(x=>`<div class="qrow"><span>${jersey(P(x.p),28)}</span><div><b>${esc(P(x.p).sopr)}</b> <span class="mute small">· ${esc(x.mot)}</span></div><span class="small mute num">${fd(x.d)}</span></div>`).join(''):'<div class="empty">Nessuna</div>'}</div>`;
  return h;
}
V.team=()=>{
  const grp=(t,L)=>`<h2>${t}</h2><div class="list">${L.map(p=>`<button class="row" style="grid-template-columns:auto minmax(0,1fr) auto" data-a="player" data-v="${p.id}">${jersey(p,40)}<span class="who"><b>${esc(p.sopr)}</b><span>${esc(p.ruolo)}</span>${p.min.length?`<span style="display:block;margin-top:4px">${p.min.map(m=>`<span class="tag a">${esc(m)}</span>`).join('')}</span>`:''}</span><span class="eur num" style="font-size:22px">${p.num??''}</span></button>`).join('')}</div>`;
  const pl=S.people.filter(p=>!p.staff).sort((a,b)=>a.num-b.num);
  return `<h1>Rosa</h1><p class="mute" style="margin-top:-6px">${S.people.length} componenti · maglia verde acqua per i liberi</p>${can('rosa')?'<button class="btn a" style="margin-top:4px" data-a="person" data-v="">Aggiungi un componente</button>':''}${grp('Giocatori',pl)}${grp('Staff',S.people.filter(p=>p.staff))}`;
};
V.more=()=>{
  const me=ME(),ges=can('gestione');
  const ini=S.inizio?fd(S.inizio):'';
  return `<h1>Impostazioni</h1>
  <div class="card prof">${jersey(me,64)}<div><b>${esc(me.sopr)}</b><span class="mute">${esc(me.ruolo)}</span><div>${me.min.map(m=>`<span class="tag a">${esc(m)}</span>`).join('')}</div></div></div>
  <button class="btn ghost" data-a="edit">Modifica il mio profilo</button>
  ${me.admin||(me.min||[]).includes('Admin')?`<h2>Backup dei dati</h2><div class="card" style="display:grid;gap:8px"><button class="btn a" style="margin:0" data-a="bk" data-v="json">Scarica il backup completo</button><button class="btn ghost" style="margin:0" data-a="bk" data-v="csv">Scarica l'elenco X per Excel</button></div>`:''}
  ${notifSection()}
  ${ges&&S.code?`<h2>Codice squadra</h2><div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px"><b style="font-size:22px;letter-spacing:.06em">${esc(S.code)}</b><button class="btn sm ghost" data-a="copycode">Copia</button></div>`:''}
  <h2>Permessi</h2><div class="card" style="padding:8px 12px;overflow-x:auto"><table class="ptab"><thead><tr><th>Chi</th><th>X e Jolly</th><th>Partite</th><th>Pizza</th><th>Rosa</th><th>Gestione</th></tr></thead><tbody>${[...S.people].sort((a,b)=>(a.staff-b.staff)||a.cognome.localeCompare(b.cognome)).map(p=>`<tr><td>${esc(p.sopr)}${p.admin?' <span class="mute small">· admin</span>':p.staff?' <span class="mute small">· staff</span>':''}</td>${['x','partite','pizza','rosa','gestione'].map(k=>`<td><input type="checkbox" data-f="perm" data-p="${p.id}" data-k="${k}" aria-label="${k}" ${p.perms.includes(k)?'checked':''} ${ges&&!p.admin?'':'disabled'}></td>`).join('')}</tr>`).join('')}</tbody></table></div>
  <h2>Categorie</h2><div class="list">${catGroups().map(([t,g])=>`<button class="set" style="width:100%;border:0;background:none;text-align:left" data-a="cats" data-v="${t+g}"><span><span class="badge ${t}" style="display:inline-grid;width:26px;height:26px;font-size:13px;margin-right:8px">${t}</span>${esc(g)}</span><span class="mute">${S.cats.filter(c=>c.t===t&&c.g===g).length} ›</span></button>`).join('')}</div>
  <h2>Stagione</h2><div class="list"><div class="set"><span>Valore di una X o Jolly</span><b>${S.valX} €</b></div><div class="set"><span>Quota esonero</span><b>${S.quota} €</b></div>${ini?`<div class="set"><span>Inizio X</span><b>${ini}</b></div>`:''}</div>
  <h2>Palestre</h2><div class="list">${S.gyms.map(g=>`<div class="set"><span><b>${esc(g.nome)}</b><br><span class="mute small">${esc(g.addr)}</span></span><a class="go" style="margin:0" href="${esc(mapsUrl(g.addr))}" target="_blank" rel="noopener" aria-label="Portami lì">${ic('pin')}</a></div>`).join('')}</div>
  <button class="btn ghost" data-a="logout" style="margin-top:26px">Esci da questo telefono</button>`;
};

/* ---------- fogli ---------- */
const sheet=h=>{$('#panel').innerHTML='<div class="grab"></div><button class="close" data-a="close" aria-label="Chiudi">×</button>'+h;$('#sheet').hidden=false;$('#panel').scrollTop=0};
const close=()=>{$('#sheet').hidden=true;UI.form=null};
function playerSheet(id){
  const p=P(id),t=tot(id),L=S.entries.filter(e=>e.p===id&&e.st==='ok').sort((a,b)=>b.d.localeCompare(a.d));
  const months=[8,9,10,11,0,1,2,3,4,5].map(m=>{let x=0,j=0;L.forEach(e=>{if(parse(e.d).getMonth()===m)e.t==='X'?x+=units(e):j+=units(e)});return {m,x,j}});
  const mx=Math.max(1,...months.map(m=>m.x));
  sheet(`<div class="prof" style="margin-top:6px">${jersey(p,64)}<div><b>${esc(p.sopr)}</b><span class="mute">${esc(p.ruolo)}${p.num!=null?' · n. '+p.num:''}</span><div>${p.min.map(m=>`<span class="tag a">${esc(m)}</span>`).join('')}${p.stato==='esonerato'?'<span class="tag">Quota pagata</span>':''}${p.stato==='fuori'?'<span class="tag">Non partecipa alle X</span>':''}</div></div></div>
  <div class="tot"><div><b style="color:var(--xr)">${t.x}</b><span>X</span></div><div><b style="color:var(--acc)">${t.j}</b><span>Jolly</span></div><div><b class="num"${t.net<0&&p.stato!=='esonerato'?' style="color:var(--acc)"':''}>${p.stato==='esonerato'?eur(S.quota):eur(Math.abs(t.net))}</b><span>${p.stato==='esonerato'?'quota':t.net<0?'da ricevere':'da pagare'}</span></div></div>
  <h2 style="margin-top:8px">Parziali per mese</h2><div class="bars">${months.filter(m=>m.x||m.j||[8,9,10].includes(m.m)).map(m=>`<div class="bar"><span>${MM[m.m]}</span><span class="t"><i style="width:${m.x/mx*100}%"></i></span><span class="num" style="text-align:right">${eur((m.x-m.j)*S.valX)}</span></div>`).join('')}</div>
  <h2>Movimenti</h2><div class="list">${L.length?L.map(e=>`<button class="row mv" data-a="entry" data-v="${e.id}"><span class="badge ${e.t}">${e.t}</span><span class="who"><b>${esc(C(e.c).nome)}${e.q>1?' ×'+e.q:''}</b><span>${e.n?esc(e.n):'Assegnata da '+esc(P(e.by).sopr)}</span></span><span class="small mute num">${fd(e.d)}</span></button>`).join(''):'<div class="empty">Nessun movimento. Per ora.</div>'}</div>
  ${can('rosa')?`<button class="btn ghost" data-a="person" data-v="${p.id}">Modifica nome, numero o ruolo</button>`:''}
  ${(can('gestione')||can('rosa'))&&!p.staff?`<label class="f" for="pst">Partecipazione alle X</label><select id="pst" class="inp" data-f="stato" data-p="${p.id}">${[['gioca','Partecipa'],['esonerato','Esonerato (quota '+S.quota+' €)'],['fuori','Non partecipa']].map(([k,l])=>`<option value="${k}" ${p.stato===k?'selected':''}>${l}</option>`).join('')}</select>`:''}
  ${can('gestione')&&!p.admin&&p.has_pin?`<button class="btn ghost" data-a="pinreset" data-v="${p.id}">Azzera il PIN (ha cambiato telefono o l'ha dimenticato)</button>`:''}
  ${can('gestione')&&!p.has_pin?'<p class="mute small">Non è ancora entrato nell\'app.</p>':''}
  ${can('x')&&p.stato!=='fuori'?`<button class="btn a" data-a="assign" data-v="${id}">Assegna X o Jolly a ${esc(p.sopr)}</button>`:''}`);
}
const RUOLI=['Palleggiatore','Opposto','Schiacciatore','Centrale','Libero','1° allenatore','2° allenatore','Preparatore','Dirigente'];
const isStaffRole=r=>!['Palleggiatore','Opposto','Schiacciatore','Centrale','Libero'].includes(r);
function personSheet(id){
  const p=id?P(id):{nome:'',cognome:'',num:null,ruolo:'Schiacciatore'};
  const storia=id&&(S.entries.some(e=>e.p===id||e.by===id)||S.pizza.due.some(z=>z.p===id)||S.pizza.hist.some(z=>z.p===id));
  sheet(`<h1 style="font-size:26px;margin-top:8px">${id?'Modifica componente':'Nuovo componente'}</h1><form id="psf"><input type="hidden" id="psid" value="${esc(id||'')}">
  <label class="f" for="psn">Nome</label><input id="psn" class="inp" required value="${esc(p.nome)}"><label class="f" for="psc">Cognome</label><input id="psc" class="inp" required value="${esc(p.cognome)}">
  <div style="display:grid;grid-template-columns:96px minmax(0,1fr);gap:10px"><div><label class="f" for="psu">Numero</label><input id="psu" type="number" min="0" max="99" class="inp" value="${p.num??''}"></div><div><label class="f" for="psr">Ruolo</label><select id="psr" class="inp">${RUOLI.map(r=>`<option ${r===p.ruolo?'selected':''}>${r}</option>`).join('')}</select></div></div>
  ${id?'':'<label class="set" style="padding:14px 0 0"><span>X di benvenuto (solo giocatori)</span><input type="checkbox" class="sw" id="psb" checked></label>'}
  <button class="btn a">${id?'Salva':'Aggiungi alla rosa'}</button>
  ${id&&!p.admin&&id!==S.me?(storia?'<p class="mute small">Ha già X o pizze: per toglierlo dalle X imposta "Non partecipa".</p>':`<button type="button" class="btn ghost" data-a="pdel2" data-v="${id}">Elimina dalla rosa</button>`):''}</form>`);
}
function entrySheet(id){
  const e=S.entries.find(x=>x.id===id);if(!e)return close();const c=C(e.c);
  sheet(`<div style="display:flex;gap:12px;align-items:center;margin-top:6px"><span class="badge ${e.t}" style="width:48px;height:48px;font-size:22px">${e.t}</span><div><b style="font-size:20px">${e.t==='X'?'X':'Jolly'} a ${esc(P(e.p).sopr)}</b><div class="mute">${fd(e.d)}</div></div></div>
  <div class="list" style="margin-top:14px"><div class="set"><span>Motivo</span><b style="text-align:right">${esc(c.nome)}</b></div><div class="set"><span>Quantità</span><b>${units(e)} ${e.t==='X'?'X':'Jolly'} · ${eur(units(e)*S.valX)}</b></div><div class="set"><span>Assegnata da</span><b>${esc(P(e.by).sopr)}</b></div>${e.n?`<div class="set"><span>Nota</span><span style="text-align:right">${esc(e.n)}</span></div>`:''}</div>
  ${can('x')?`<button class="btn a" data-a="eedit" data-v="${e.id}">Modifica</button><button class="btn ghost" data-a="del" data-v="${e.id}">Annulla questa ${e.t==='X'?'X':'Jolly'}</button>`:''}`);
}
function assignModes(){return [...(can('x')?[['X','X'],['J','Jolly']]:[]),...(can('pizza')?[['P','Pizza']]:[])]}
function assignSheet(pre,mode){
  const modes=assignModes();if(!modes.length)return;
  if(!UI.form)UI.form={t:mode&&modes.some(m=>m[0]===mode)?mode:modes[0][0],p:pre?[pre]:[],c:'',q:1,d:T,n:'',mot:''};
  const f=UI.form,pz=f.t==='P',ed=!!f.edit;
  const pl=S.people.filter(p=>pz?!p.staff:p.stato!=='fuori');
  const seg=(ed?modes.filter(m=>m[0]!=='P'):modes).length>1?`<div class="seg">${(ed?modes.filter(m=>m[0]!=='P'):modes).map(([k,l])=>`<button class="${f.t===k?'on':''}" data-a="ft" data-v="${k}">${l}</button>`).join('')}</div>`:'';
  const chips=`<label class="f">${pz?'Chi paga':'A chi'}${f.p.length?' · '+f.p.length:''}</label><div class="chips">${pl.map(p=>`<button class="chip ${f.p.includes(p.id)?(f.t==='X'?'on':'onJ'):''}" data-a="fp" data-v="${p.id}">${esc(p.sopr)}</button>`).join('')}</div>`;
  if(pz){
    sheet(`<h1 style="font-size:26px;margin-top:8px">Assegna</h1>${seg}${chips}
    <label class="f" for="fm">Motivo</label><select id="fm" class="inp" data-f="fm"><option value="">Scegli dal regolamento…</option>${PIZZA_MOT.map(m=>`<option ${m===f.mot?'selected':''}>${esc(m)}</option>`).join('')}</select>
    ${f.p.length?`<div class="note">${f.p.length===1?'1 pizza':f.p.length+' pizze'}: ${f.p.length===1?'esce':'escono'} nei primi martedì liberi, dopo quelle già in coda.</div>`:''}
    <button class="btn a" data-a="fsave" ${f.p.length&&f.mot?'':'disabled style="opacity:.4"'}>Aggiungi pizza</button>`);
    return;
  }
  const cats=S.cats.filter(c=>c.t===f.t),cat=S.cats.find(c=>c.id===f.c),groups=[...new Set(cats.map(c=>c.g))];
  sheet(`<h1 style="font-size:26px;margin-top:8px">${ed?'Modifica':'Assegna'}</h1>${seg}${chips}
  <label class="f" for="fc">Motivo</label><select id="fc" class="inp" data-f="fc"><option value="">Scegli dal regolamento…</option>${groups.map(g=>`<optgroup label="${esc(g)}">${cats.filter(c=>c.g===g).map(c=>`<option value="${c.id}" ${c.id===f.c?'selected':''}>${esc(c.nome)}${c.u>1?' ('+c.u+' X)':''}</option>`).join('')}</optgroup>`).join('')}<option value="__new" ${f.newcat?'selected':''}>${f.t==='X'?'+ Nuova X…':'+ Nuovo Jolly…'}</option></select>
  ${f.newcat?`<div class="card" style="margin-top:8px"><label class="f" for="ncn" style="margin-top:0">${f.t==='X'?'Nuova X':'Nuovo Jolly'}: scrivi la dicitura</label><input id="ncn" class="inp" placeholder="${f.t==='X'?'Es. Pallonata al pubblico':'Es. Muro sul 24'}" autocomplete="off"><button type="button" class="btn a" style="margin-top:10px" data-a="catsave">Salva nell'elenco</button></div>`:''}
  ${cat&&cat.q?`<label class="f">${cat.nome.includes('kg')?'Chili dimostrati':cat.nome.includes('minuti')?'Blocchi da 3 minuti':'Quanti oggetti'}</label><div class="step"><button data-a="fq" data-v="-1" aria-label="Meno">−</button><b>${f.q}</b><button data-a="fq" data-v="1" aria-label="Più">+</button></div>`:''}
  <label class="f" for="fd">Data</label><input id="fd" type="date" class="inp" value="${f.d}" data-f="fd">
  <label class="f" for="fn">Nota (facoltativa)</label><input id="fn" class="inp" value="${esc(f.n)}" placeholder="Es. pallone lasciato sotto la panchina" data-f="fn">
  ${cat?`<div class="note">${f.p.length===1?"1 persona":(f.p.length||0)+" persone"} × ${cat.u*f.q} ${f.t==='X'?'X':'Jolly'} = ${eur((f.p.length||0)*cat.u*f.q*S.valX)}${f.t==='J'?' a favore':''}</div>`:''}
  <button class="btn ${f.t==='J'?'a':''}" data-a="fsave" ${f.p.length&&f.c?'':'disabled style="opacity:.4"'}>${ed?'Salva la modifica':'Assegna e avvisa'}</button>`);
}
function trainingSheet(d){
  const day=d||iso(add(TODAY,1)),ex=(S.training||{})[day],wd=parse(day).getDay(),base=TR[wd];
  const st=ex?(ex.annullato?'no':'si'):'si',ini=(ex&&ex.ini)||(base?base[0]:'20:30'),fine=(ex&&ex.fine)||(base?base[1]:'22:30');
  sheet(`<h1 style="font-size:26px;margin-top:8px">${d?'Allenamento':'Allenamento extra'}</h1><form id="tf">
  <label class="f" for="td">Giorno</label><input id="td" type="date" class="inp" value="${day}" ${d?'readonly':''} required>
  <label class="f">Si fa?</label><div class="seg" style="margin:0"><button type="button" class="${st==='si'?'on':''}" data-a="tst" data-v="si">Sì</button><button type="button" class="${st==='no'?'on':''}" data-a="tst" data-v="no">Annullato</button></div><input type="hidden" id="tst" value="${st}">
  <div id="tor" ${st==='no'?'hidden':''} style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px"><div><label class="f" for="ti">Inizio</label><input id="ti" type="time" class="inp" value="${ini}"></div><div><label class="f" for="tfi">Fine</label><input id="tfi" type="time" class="inp" value="${fine}"></div></div>
  <label class="f" for="tn">Nota (facoltativa)</label><input id="tn" class="inp" value="${esc((ex&&ex.nota)||'')}" placeholder="Es. palestra chiusa per le feste">
  <button class="btn a">Salva e avvisa la squadra</button>
  ${ex?`<button type="button" class="btn ghost" data-a="trdel" data-v="${day}">${base?'Torna all\'orario di sempre':'Elimina questo allenamento'}</button>`:''}</form>`);
}
function matchSheet(id){
  const m=S.matches.find(x=>x.id===id)||{id:'',avv:'',casa:true,gym:FIP.home,d:iso(add(TODAY,(6-TODAY.getDay()+7)%7||7)),ora:'21:00'};
  sheet(`<h1 style="font-size:26px;margin-top:8px">${m.id?'Modifica partita':'Nuova partita'}</h1>
  <form id="mf"><label class="f" for="ma">Avversario</label><input id="ma" class="inp" required value="${esc(m.avv)}" placeholder="Es. Pico Volley">
  <label class="f">Dove si gioca</label><div class="seg" style="margin:0"><button type="button" class="${m.casa?'on':''}" data-a="mcasa" data-v="1">Casa</button><button type="button" class="${m.casa?'':'on'}" data-a="mcasa" data-v="0">Trasferta</button></div><input type="hidden" id="mc" value="${m.casa?1:0}">
  <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px"><div><label class="f" for="md">Data</label><input id="md" type="date" class="inp" value="${m.d}" required></div><div><label class="f" for="mo">Ora</label><input id="mo" type="time" class="inp" value="${m.ora}" required></div></div>
  <label class="f" for="mg">Palestra</label><select id="mg" class="inp">${S.gyms.map(g=>`<option value="${g.id}" ${g.id===m.gym?'selected':''}>${esc(g.nome)}</option>`).join('')}<option value="new">+ Nuova palestra…</option></select>
  <div id="ng" hidden><label class="f" for="gn">Nome palestra</label><input id="gn" class="inp" placeholder="Es. Palazzetto dello sport"><label class="f" for="gaddr">Indirizzo (per la navigazione)</label><input id="gaddr" class="inp" placeholder="Via, numero, città"></div>
  <input type="hidden" id="mid" value="${m.id}"><button class="btn">${m.id?'Salva':'Inserisci e avvisa la squadra'}</button>${m.id?`<button type="button" class="btn ghost" data-a="mdel" data-v="${m.id}">Elimina partita</button>`:''}</form>`);
}
function catsSheet(key){
  const [t,g]=[key[0],key.slice(1)];const L=S.cats.filter(c=>c.t===t&&c.g===g);
  sheet(`<h1 style="font-size:26px;margin-top:8px">${t==='X'?'X · ':''}${esc(g)}</h1><div class="list">${L.map(c=>`<div class="set"><span>${esc(c.nome)}${c.q?' <span class="tag">a quantità</span>':''}</span><b class="num">${c.u} ${t==='X'?'X':'J'} · ${eur(c.u*S.valX)}</b></div>`).join('')}</div>`);
}
function editSheet(){
  const me=ME();
  sheet(`<h1 style="font-size:26px;margin-top:8px">Il mio profilo</h1><form id="ef"><div style="display:flex;gap:14px;align-items:center">${jersey(me,72)}<label class="btn ghost sm" style="display:inline-block">Cambia foto<input type="file" accept="image/*" data-f="photo" hidden></label></div>
  <label class="f" for="en">Nome</label><input id="en" class="inp" value="${esc(me.nome)}"><label class="f" for="ec">Cognome</label><input id="ec" class="inp" value="${esc(me.cognome)}">
  <label class="f" for="es">Soprannome</label><input id="es" class="inp" value="${esc(me.sopr)}">
  <div style="display:grid;grid-template-columns:96px minmax(0,1fr);gap:10px"><div><label class="f" for="eu">Numero</label><input id="eu" type="number" min="0" max="99" class="inp" value="${me.num??''}"></div><div><label class="f" for="er">Ruolo</label><select id="er" class="inp">${['Palleggiatore','Opposto','Schiacciatore','Centrale','Libero','1° allenatore','2° allenatore'].map(r=>`<option ${r===me.ruolo?'selected':''}>${r}</option>`).join('')}</select></div></div>
  <button class="btn">Salva</button></form>`);
}

/* ---------- azioni ---------- */
let tt;
function toast(title,body){const t=$('#toast');t.innerHTML=ic('bell')+`<span><b>${esc(title)}</b>${esc(body)}</span>`;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,3200)}
function render(){
  const logged=!!S;$('#nav').hidden=!logged;$('#meBtn').hidden=!logged;
  if(!logged){$('#fab').hidden=true;$('#view').innerHTML=lsGet(TOKK)?'<div class="empty">Caricamento…</div>':loginView();return}
  const tabs=[['camp','Campionato','camp'],['x','X','x'],['home','Home','home'],['cal','Calendario','cal'],['more','Impostazioni','set']];
  $('#nav').innerHTML=tabs.map(([k,l,i])=>k==='home'?`<button class="hm ${UI.tab===k?'on':''}" data-a="tab" data-v="${k}" aria-label="${l}" title="${l}"><span class="ring">${ic(i)}</span></button>`:`<button class="${UI.tab===k?'on':''}" data-a="tab" data-v="${k}" aria-label="${l}" title="${l}">${ic(i)}</button>`).join('');
  $('#view').innerHTML=(UI.tab==='home'?installCard():'')+V[UI.tab]();
  $('#meBtn').innerHTML=jersey(ME(),54);
  const fab=$('#fab');
  if((UI.tab==='home'||UI.tab==='x')&&assignModes().length){fab.hidden=false;fab.innerHTML=ic('plus')+'Assegna';fab.dataset.a='assign';fab.dataset.v=''}
  else if(UI.tab==='cal'&&UI.cseg==='pz'&&can('pizza')){fab.hidden=false;fab.innerHTML=ic('plus')+'Pizza';fab.dataset.a='assign';fab.dataset.v='|P'}
  else if(UI.tab==='cal'&&UI.cseg==='ag'&&can('partite')){fab.hidden=false;fab.innerHTML=ic('plus')+'Aggiungi';fab.dataset.a='evnew';fab.dataset.v=''}
  else fab.hidden=true;
}
const A={
  tab:v=>{UI.tab=v;$('#view').scrollTop=0;render()},
  xseg:v=>{UI.tab='x';UI.xseg=v;render()},xf:v=>{UI.xf=v;render()},cseg:v=>{UI.cseg=v;render()},camp:()=>{UI.tab='camp';UI.cpv='cl';render()},cpv:v=>{UI.cpv=v;render()},gio:v=>{UI.gio=Math.min(UI.maxG||26,Math.max(1,UI.gio+Number(v)));render()},
  player:v=>playerSheet(v),entry:v=>entrySheet(v),close:()=>close(),
  assign:v=>{const [p,m]=(v||'').split('|');UI.form=null;assignSheet(p||null,m||null)},
  ft:v=>{const f=UI.form;f.t=v;f.c='';f.q=1;f.mot='';if(v==='P')f.p=f.p.filter(id=>!P(id).staff);else f.p=f.p.filter(id=>P(id).stato!=='fuori');assignSheet()},
  fp:v=>{const f=UI.form,a=f.p;if(f.edit){f.p=[v]}else{a.includes(v)?a.splice(a.indexOf(v),1):a.push(v)}assignSheet()},
  fq:v=>{UI.form.q=Math.max(1,UI.form.q+Number(v));assignSheet()},
  fsave:async()=>{const f=UI.form;if(!f.p.length)return;
    if(f.t==='P'){
      if(!f.mot)return;let ok=0;
      for(const p of f.p){if(await act('pizza_add',{p,mot:f.mot}))ok++;else break}
      if(ok){const names=f.p.slice(0,ok).map(id=>P(id).sopr).join(', ');close();toast('Fatto',` ${names}: pizza (${f.mot})`)}
      return;
    }
    if(!f.c||f.c==='__new')return;
    if(f.edit){if(await act('entry_edit',{id:f.edit,p:f.p[0],c:f.c,q:f.q,d:f.d,n:f.n.trim()})){close();toast('Fatto',' Modifica salvata.')}return}
    const r=await act('entries_add',{t:f.t,p:f.p,c:f.c,q:f.q,d:f.d,n:f.n.trim()});
    if(r){const names=f.p.map(id=>P(id).sopr).join(', '),cn=C(f.c).nome;close();toast('Fatto',` ${names}: ${f.t==='X'?'nuova X':'nuovo Jolly'} · ${cn}`)}},
  eedit:v=>{const e=S.entries.find(x=>x.id===v);if(!e)return;UI.form={edit:e.id,t:e.t,p:[e.p],c:e.c,q:e.q,d:e.d,n:e.n||'',mot:''};assignSheet()},
  catsave:async()=>{const f=UI.form,nome=($('#ncn')||{}).value?.trim();if(!nome)return toast('Manca la dicitura',' Scrivi il nome della nuova voce.');
    const r=await act('cat_add',{t:f.t,nome});if(r&&r.id){f.c=r.id;f.newcat=false;f.q=1;assignSheet();toast('Salvata',' “'+nome+'” ora è nell\'elenco.')}},
  person:v=>personSheet(v||null),
  pdel2:v=>{const b=document.querySelector('[data-a=pdel2]');if(b&&!b.dataset.ok){b.dataset.ok='1';b.textContent='Tocca di nuovo per confermare';return}
    act('person_del',{p:v},['Fatto',' Componente eliminato.']).then(r=>r&&close())},
  tr:v=>trainingSheet(v),
  evnew:()=>sheet(`<h1 style="font-size:26px;margin-top:8px">Aggiungi</h1><button class="btn a" data-a="match" data-v="">Partita o amichevole</button><button class="btn ghost" data-a="tr" data-v="">Allenamento extra</button>`),
  trdel:v=>act('training_del',{d:v},['Fatto',' Torna l\'orario di sempre.']).then(r=>r&&close()),
  del:v=>act('entry_del',{id:v}).then(r=>r&&close()),
  match:v=>matchSheet(v),
  tst:v=>{$('#tst').value=v;document.querySelectorAll('[data-a=tst]').forEach(b=>b.classList.toggle('on',b.dataset.v===v));$('#tor').hidden=v==='no'},
  mcasa:v=>{$('#mc').value=v;document.querySelectorAll('[data-a=mcasa]').forEach(b=>b.classList.toggle('on',b.dataset.v===v));const g=$('#mg');if(v==='1')g.value=FIP.home},
  mdel:v=>act('match_del',{id:v}).then(r=>r&&close()),
  pskip:v=>act('pizza_skip',{d:v}),
  pdel:v=>act('pizza_del',{id:v}),
  ppaid:v=>{const [id,d]=v.split('|');act('pizza_paid',{id,d},['Pizza segnata',' Grazie!'])},
  pztab:()=>{UI.tab='cal';UI.cseg='pz';render()},
  cv:v=>{UI.cv=v;try{localStorage.setItem('unvy-cv',v)}catch(e){}render()},
  wk:v=>{UI.wk=v==='0'?0:UI.wk+Number(v);render()},
  mo:v=>{UI.mo=v==='0'?0:UI.mo+Number(v);UI.sel=v==='0'?T:null;if(v!=='0'){const d=new Date(TODAY.getFullYear(),TODAY.getMonth()+UI.mo,1);UI.sel=iso(d)}render()},
  sel:v=>{UI.sel=v;render()},
  ev:v=>{const [k,t]=v.split('|');PZ=pizzaSched(40);const e=evs(k).find(x=>x.k===t);if(e)sheet(`<div class="mon" style="margin-top:6px">${fd(k)}</div><div class="card">${evBody(e)}</div>`)},
  edit:()=>editSheet(),
  cats:v=>catsSheet(v),
  riep:async()=>{const t=riepilogoText();
    if(navigator.share){try{await navigator.share({text:t});return}catch(e){if(e&&e.name==='AbortError')return}}
    try{await navigator.clipboard.writeText(t);toast('Copiato',' Incollalo nel gruppo della squadra.')}catch(e){toast('Riepilogo',' Apri "Vedi il testo" e copialo a mano.')}},
  bk:v=>{const day=T;
    if(v==='json'){const data={creato:new Date().toISOString(),stagione:'Serie C 26/27',valX:S.valX,quota:S.quota,
      people:S.people.map(({foto,...p})=>p),cats:S.cats,entries:S.entries,pizza:S.pizza,
      matches:S._m||S.matches.filter(m=>!m.fip),gyms:S._g||[]};
      download(`unvy-backup-${day}.json`,'application/json',JSON.stringify(data,null,1));}
    else{const rows=[['Data','Giocatore','Tipo','Motivo','Quantità','Euro','Nota','Assegnata da']];
      [...S.entries].filter(e=>e.st==='ok').sort((a,b)=>a.d.localeCompare(b.d)).forEach(e=>rows.push([e.d,P(e.p).sopr,e.t==='X'?'X':'Jolly',C(e.c).nome,units(e),(e.t==='X'?1:-1)*units(e)*S.valX,e.n,P(e.by).sopr]));
      const cell=x=>{const s=String(x??'');return /[";\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
      download(`unvy-x-${day}.csv`,'text/csv;charset=utf-8','﻿'+rows.map(r=>r.map(cell).join(';')).join('\r\n'));}
    toast('Backup',' File scaricato: conservalo in un posto sicuro (Drive, mail, computer).')},
  regol:async()=>{try{if(!window._regol){const d=await rpc('get_doc',{tok:lsGet(TOKK),did:'regolamento'});if(!d)return toast('Regolamento',' Non ancora caricato.');const bin=atob(d.b64.replace(/\s/g,''));const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);window._regol=URL.createObjectURL(new Blob([u],{type:d.mime}))}const a=document.createElement('a');a.href=window._regol;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove()}catch(e){toast('Ops',' '+errMsg(e))}},
  lgp:v=>{LG.pid=v;LG.st=2;LG.pin='';LG.first='';LG.err='';render()},
  lgback:()=>{LG.st=Math.max(0,LG.st-1);LG.pin='';LG.first='';LG.err='';render()},
  pk:v=>{LG.err='';LG.pin=v==='⌫'?LG.pin.slice(0,-1):(LG.pin+v).slice(0,4);
    if(LG.pin.length<4)return render();
    const p=LG.people.find(x=>x.id===LG.pid)||{};const pin=LG.pin;
    if(p.has_pin)return doLogin(pin);
    if(!LG.first){LG.first=pin;LG.pin='';return render()}
    if(LG.first!==pin){LG.first='';LG.pin='';LG.err='I due PIN non coincidono: riprova.';return render()}
    doLogin(pin)},
  logout:async()=>{try{await rpc('act',{tok:lsGet(TOKK),a:'logout',x:{}})}catch(e){}lsSet(TOKK,null);S=null;RAW='';LG.st=0;rtClose();render()},
  pinreset:v=>act('pin_reset',{p:v},['Fatto',' Al prossimo accesso sceglierà un nuovo PIN.']).then(()=>playerSheet(v)),
  copycode:()=>{try{navigator.clipboard.writeText(S.code).then(()=>toast('Copiato',' Incollalo nel gruppo della squadra.'),()=>toast('Codice',' '+S.code))}catch(e){toast('Codice',' '+S.code)}},
  pushon:()=>pushOn(),pushoff:()=>pushOff(),
  instok:()=>{lsSet('unvy-inst','1');render()},
  inst:async()=>{if(!DEFERRED)return;DEFERRED.prompt();try{await DEFERRED.userChoice}catch(e){}DEFERRED=null;render()}
};
document.addEventListener('click',e=>{
  if(e.target===$('#sheet'))return close();
  const b=e.target.closest('[data-a]');if(!b)return;
  const f=A[b.dataset.a];if(f){e.preventDefault();f(b.dataset.v)}
});
document.addEventListener('change',e=>{
  const t=e.target,k=t.dataset.f;
  if(k==='fc'){if(t.value==='__new'){UI.form.newcat=true;UI.form.c=''}else{UI.form.c=t.value;UI.form.newcat=false}UI.form.q=1;assignSheet()}
  else if(k==='fd')UI.form.d=t.value;
  else if(k==='fm'){UI.form.mot=t.value;assignSheet()}
  else if(k==='stato'){const id=t.dataset.p;act('stato_set',{p:id,stato:t.value}).then(()=>playerSheet(id))}
  else if(k==='pushpref'){const mine=(S.push||[]).find(s=>s.endpoint===PUSH.endpoint);if(mine)act('push_prefs',{endpoint:PUSH.endpoint,prefs:{...mine.prefs,[t.dataset.k]:t.checked}})}
  else if(k==='perm'){act('perm_set',{p:t.dataset.p,k:t.dataset.k,on:t.checked})}
  else if(k==='photo'&&t.files[0]){const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d'),s=Math.min(im.width,im.height);x.drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,160,160);act('profile',{foto:c.toDataURL('image/jpeg',.8)}).then(()=>editSheet())};im.src=r.result};r.readAsDataURL(t.files[0])}
  else if(t.id==='mg')$('#ng').hidden=t.value!=='new';
});
document.addEventListener('input',e=>{if(e.target.dataset.f==='fn')UI.form.n=e.target.value});
document.addEventListener('submit',async e=>{
  e.preventDefault();const id=e.target.id;
  if(id==='lf0'){
    LG.code=$('#lcode').value.trim().toUpperCase();LG.err='';
    try{LG.people=await rpc('login_people',{code:LG.code});LG.st=1}catch(er){LG.err=errMsg(er)}
    render();
  }
  else if(id==='mf'){
    const x={id:$('#mid').value,avv:$('#ma').value.trim(),casa:$('#mc').value==='1',gym:$('#mg').value,d:$('#md').value,ora:$('#mo').value};
    if(x.gym==='new'){const n=$('#gn').value.trim(),a=$('#gaddr').value.trim();if(!n||!a)return toast('Manca qualcosa',' Scrivi nome e indirizzo della palestra.');x.newgym={nome:n,addr:a};x.gym=''}
    const nuova=!x.id;
    if(await act('match_save',x)){close();if(nuova)toast('Partita inserita',` ${x.avv}, ${fd(x.d)} ore ${x.ora}`)}
  }
  else if(id==='tf'){const no=$('#tst').value==='no';
    if(await act('training_set',{d:$('#td').value,annullato:no,ini:no?null:$('#ti').value,fine:no?null:$('#tfi').value,nota:$('#tn').value.trim()})){close();toast('Fatto',no?' Allenamento annullato: la squadra viene avvisata.':' Orario salvato: la squadra viene avvisata.')}}
  else if(id==='psf'){const id=$('#psid').value,r=$('#psr').value,x={nome:$('#psn').value,cognome:$('#psc').value,num:$('#psu').value,ruolo:r};
    if(id){if(await act('person_edit',{...x,p:id})){close();toast('Fatto',' Dati aggiornati.')}}
    else{const res=await act('person_add',{...x,staff:isStaffRole(r),benvenuto:!!($('#psb')||{}).checked});if(res){close();toast('Benvenuto!',` ${x.nome} ${x.cognome} è in rosa.`+(!isStaffRole(r)&&$('#psb')?.checked!==false?' Ha già la sua X di benvenuto.':''))}}}
  else if(id==='ef'){if(await act('profile',{nome:$('#en').value,cognome:$('#ec').value,sopr:$('#es').value,num:$('#eu').value,ruolo:$('#er').value}))close()}
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();DEFERRED=e;render()});
async function boot(){
  render();
  await loadFip();
  if(lsGet(TOKK))await refresh();else render();
  setInterval(()=>{if(document.visibilityState==='visible'&&S)refresh(true)},30000);
  setInterval(()=>{if(document.visibilityState==='visible')loadFip().then(()=>S&&render())},5*60000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&S){rtConnect();refresh(true);loadFip().then(()=>render())}});
  if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>{r.update();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')r.update()})}).catch(()=>{});
    /* ricarica solo quando arriva una versione nuova, non alla prima installazione */
    const hadSW=!!navigator.serviceWorker.controller;let reloaded=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!hadSW||reloaded||$('#sheet').hidden===false||!S)return;reloaded=true;location.reload()});if(pushOK())pushEndpoint().then(()=>{if(S&&UI.tab==='more')render()})}
}
boot();
}
