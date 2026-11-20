// MusicKit token issuer. APPLE_MUSIC_PRIVATE_KEY is a host secret, never a public asset.
const musicEncoder = new TextEncoder();
const musicBase64 = data => btoa(String.fromCharCode(...data))
  .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const musicJson = data => musicBase64(musicEncoder.encode(JSON.stringify(data)));
const musicPaths = new Set(['/api/apple/status', '/api/apple-token']);

export function createAppleMusic(defaultOrigins=[]) {
  let priorPrivateKey, signingKey;
  async function loadKey(env) {
    if(!/^[A-Z0-9]{10}$/.test(env.APPLE_MUSIC_TEAM_ID||'')||
       !/^[A-Z0-9]{10}$/.test(env.APPLE_MUSIC_KEY_ID||'')||
       typeof env.APPLE_MUSIC_PRIVATE_KEY!=='string')return null;
    const raw=env.APPLE_MUSIC_PRIVATE_KEY;
    if(raw!==priorPrivateKey){
      priorPrivateKey=raw;
      signingKey=(async()=>{
        const pem=raw.replaceAll('\\n','\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
        const der=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
        return crypto.subtle.importKey('pkcs8',der,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
      })().catch(()=>null);
    }
    return signingKey;
  }
  return async function appleMusic(request,env={}) {
    const url=new URL(request.url);
    if(!musicPaths.has(url.pathname))return null;
    const configuredOrigins=(env.AFTERSPIN_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
    const origins=configuredOrigins.length?configuredOrigins:defaultOrigins;
    const claimedOrigin=request.headers.get('Origin');
    const origin=claimedOrigin||url.origin;
    const headers={'Cache-Control':'private, no-store',Vary:'Origin','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
    const send=(body,status)=>new Response(JSON.stringify(body),{status,headers});
    if(!origins.includes(origin)||!origin.startsWith('https://'))return send({error:'origin_not_allowed'},403);
    if(claimedOrigin)headers['Access-Control-Allow-Origin']=origin;
    if(request.method==='OPTIONS'){
      headers['Access-Control-Allow-Methods']='GET, OPTIONS';
      return new Response(null,{status:204,headers});
    }
    if(request.method!=='GET')return send({error:'method_not_allowed'},405);
    const key=await loadKey(env);
    if(url.pathname==='/api/apple/status')return send({configured:!!key},200);
    if(!key)return send({error:'setup_required'},503);
    try {
      const iat=Math.floor(Date.now()/1000), exp=iat+3600;
      const unsigned=musicJson({alg:'ES256',kid:env.APPLE_MUSIC_KEY_ID,typ:'JWT'})+'.'+musicJson({iss:env.APPLE_MUSIC_TEAM_ID,iat,exp,origin:[origin]});
      const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,musicEncoder.encode(unsigned));
      return send({developerToken:unsigned+'.'+musicBase64(new Uint8Array(signature)),expiresAt:exp},200);
    } catch {
      return send({error:'apple_authorization_unavailable'},503);
    }
  };
}

const standaloneAppleMusic=createAppleMusic();
export default {async fetch(request,env) {
  return await standaloneAppleMusic(request,env)||new Response('Not found',{status:404});
}};
