const FLOW = '__Host-afterspin_spotify_flow';
const SESSION = '__Host-afterspin_spotify_session';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const provider = 'https://accounts.spotify.com';
const service = 'https://api.spotify.com/v1';
const betaPage = '/spotify-top-picks.html';
const oauth = '/oauth/spotify/';
const api = '/api/spotify/';
const ranges = new Set(['short_term','medium_term','long_term']);

const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
function decode(s) {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw Error('Invalid encoding');
  return Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
}
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
const now = () => Math.floor(Date.now()/1000);
const validId = value => typeof value==='string' && /^[a-fA-F0-9]{32}$/.test(value);
const hex = s => Uint8Array.from(s.match(/../g), x=>Number.parseInt(x,16));
function readConfig(env, url) {
  if (!validId(env.SPOTIFY_CLIENT_ID)||!/^([a-fA-F0-9]{2}){32}$/.test(env.SPOTIFY_SESSION_KEY||'')) return null;
  if(url.protocol!=='https:')return null;
  return {clientId:env.SPOTIFY_CLIENT_ID,key:env.SPOTIFY_SESSION_KEY,redirectUri:url.origin+oauth+'callback'};
}
async function seal(secret, purpose, value) {
  const key = await crypto.subtle.importKey('raw',hex(secret),'AES-GCM',false,['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(purpose)},key,encoder.encode(JSON.stringify(value)));
  return encode(iv)+'.'+encode(cipher);
}
async function unseal(secret, purpose, value) {
  try {
    if(!value||value.length>3600)return null;
    const [iv,cipher,...rest]=value.split('.');
    if(rest.length)return null;
    const key=await crypto.subtle.importKey('raw',hex(secret),'AES-GCM',false,['decrypt']);
    const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:encoder.encode(purpose)},key,decode(cipher));
    const payload=JSON.parse(decoder.decode(bytes));
    return payload.exp>now()?payload:null;
  } catch { return null; }
}
const cookie = (key, value, ttl) => key+'='+value+'; Max-Age='+ttl+'; Path=/; Secure; HttpOnly; SameSite=Lax';
function stored(request, key) {
  return (request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='))?.slice(key.length+1);
}
function headers(cookies=[]) {
  const h=new Headers({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
  for(const c of cookies)h.append('Set-Cookie',c);
  return h;
}
function json(data, status=200, cookies=[]) {
  const h=headers(cookies);h.set('Content-Type','application/json; charset=utf-8');
  return new Response(JSON.stringify(data),{status,headers:h});
}
function redirect(location,cookies=[]) {
  const h=headers(cookies);h.set('Location',location);
  return new Response(null,{status:303,headers:h});
}
const flowExpired=()=>cookie(FLOW,'',0);
const sessionExpired=()=>cookie(SESSION,'',0);
const failCallback=reason=>redirect(betaPage+'?status='+reason,[flowExpired()]);
function itemForSpotify(item,type) {
  if(typeof item?.name!=='string')return null;
  const url=item.external_urls?.spotify;
  if(typeof url!=='string')return null;
  const category=type==='tracks'?'track':'artist';
  let link;
  try{link=new URL(url)}catch{return null;}
  if(link.origin!=='https://open.spotify.com'||!new RegExp('^/'+category+'/[0-9A-Za-z]+$').test(link.pathname))return null;
  const artist=Array.isArray(item.artists)?item.artists.map(x=>x?.name).filter(x=>typeof x==='string').slice(0,8).join(', '):'';
  return {name:item.name.slice(0,300),artist:artist.slice(0,300),url:link.origin+link.pathname};
}

export function createSpotifyBeta(send=fetch) {
  return async function handle(request,env={}) {
    const url=new URL(request.url), path=url.pathname;
    if (!path.startsWith(api)&&!path.startsWith(oauth))return null;
    const cfg=readConfig(env,url);
    if (path===api+'status'&&request.method==='GET') {
      const s=cfg&&await unseal(cfg.key,SESSION,stored(request,SESSION));
      return json({configured:!!cfg,connected:!!s});
    }
    if (path===api+'logout'&&request.method==='POST') {
      if(request.headers.get('Origin')!==url.origin)return json({error:'invalid_origin'},403);
      return json({connected:false},200,[flowExpired(),sessionExpired()]);
    }
    if(!cfg) {
      return path.startsWith(oauth)?redirect(betaPage+'?status=setup_required',[flowExpired()]):json({error:'setup_required'},503);
    }
    if(path===oauth+'login'&&request.method==='GET'){
      const state=random(), verifier=random(), challenge=encode(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)));
      const flow=await seal(cfg.key,FLOW,{state,verifier,exp:now()+600});
      const entry=new URL(provider+'/authorize');
      entry.search=new URLSearchParams({client_id:cfg.clientId,response_type:'code',redirect_uri:cfg.redirectUri,scope:'user-top-read',state,code_challenge_method:'S256',code_challenge:challenge});
      return redirect(entry.href,[cookie(FLOW,flow,600)]);
    }
    if(path===oauth+'callback'&&request.method==='GET'){
      const flow=await unseal(cfg.key,FLOW,stored(request,FLOW));
      if(!flow||url.searchParams.get('state')!==flow.state)return failCallback('state_expired');
      if(url.searchParams.has('error'))return failCallback('permission_declined');
      const code=url.searchParams.get('code');
      if(!code||code.length>2000)return failCallback('connection_failed');
      try {
        const res=await send(provider+'/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(8000),body:new URLSearchParams({grant_type:'authorization_code',client_id:cfg.clientId,code,redirect_uri:cfg.redirectUri,code_verifier:flow.verifier})});
        if(!res.ok)return failCallback('connection_failed');
        const {access_token,expires_in,token_type,scope}=await res.json();
        if(typeof access_token!=='string'||!access_token||access_token.length>1900||!Number.isFinite(expires_in)||expires_in<1||token_type?.toLowerCase()!=='bearer')return failCallback('connection_failed');
        if(typeof scope==='string'&&!scope.split(/\s+/).includes('user-top-read'))return failCallback('permission_declined');
        const ttl=Math.min(Math.floor(expires_in),3600);
        // The refresh token is intentionally discarded. The short-lived access token is
        // encrypted and authenticated, and only the Worker can read it.
        const session=await seal(cfg.key,SESSION,{access:access_token,exp:now()+ttl});
        return redirect(betaPage,[flowExpired(),cookie(SESSION,session,ttl)]);
      } catch { return failCallback('connection_failed'); }
    }
    if(path===api+'top'&&request.method==='GET'){
      const type=url.searchParams.get('type'), range=url.searchParams.get('range');
      if(!['tracks','artists'].includes(type)||!ranges.has(range))return json({error:'invalid_filter'},400);
      const s=await unseal(cfg.key,SESSION,stored(request,SESSION));
      if(!s)return json({error:'sign_in_required'},401,[sessionExpired()]);
      try {
        const query=new URLSearchParams({time_range:range,limit:'10'});
        const res=await send(service+'/me/top/'+type+'?'+query,{headers:{Authorization:'Bearer '+s.access},signal:AbortSignal.timeout(8000)});
        if(res.status===401)return json({error:'sign_in_required'},401,[sessionExpired()]);
        if(res.status===403)return json({error:'beta_access_required'},403,[sessionExpired()]);
        if(res.status===429){
          const retry=Number(res.headers.get('Retry-After'));
          return json({error:'rate_limited',retryAfter:Number.isFinite(retry)&&retry>0?Math.ceil(retry):null},429);
        }
        if(!res.ok)return json({error:'spotify_unavailable'},502);
        const batch=await res.json();
        if(!Array.isArray(batch?.items))return json({error:'spotify_unavailable'},502);
        return json({items:batch.items.slice(0,10).map(i=>itemForSpotify(i,type)).filter(Boolean)});
      } catch { return json({error:'spotify_unavailable'},502); }
    }
    return json({error:'not_found'},404);
  };
}
