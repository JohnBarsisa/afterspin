// Optional Cloudflare Worker, configured separately from the public static app.
// APPLE_MUSIC_PRIVATE_KEY is a Worker secret. Never put a .p8 file in Git.
const encoder = new TextEncoder();
const b64url = data => btoa(String.fromCharCode(...data))
  .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const json = data => b64url(encoder.encode(JSON.stringify(data)));

export default {
  async fetch(request, env) {
    const origins = (env.AFTERSPIN_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin');
    const headers = {'Cache-Control':'no-store', Vary:'Origin', 'Content-Type':'application/json; charset=utf-8'};
    const send = (body, status) => new Response(JSON.stringify(body), {status, headers});
    if(new URL(request.url).pathname !== '/api/apple-token')return send({error:'Not found'},404);
    if(!origin || !origins.includes(origin))return send({error:'Origin not allowed'},403);
    headers['Access-Control-Allow-Origin']=origin;
    if(request.method==='OPTIONS'){
      headers['Access-Control-Allow-Methods']='GET, OPTIONS';
      return new Response(null,{status:204,headers});
    }
    if(request.method!=='GET')return send({error:'Method not allowed'},405);
    try {
      if(!env.APPLE_MUSIC_TEAM_ID||!env.APPLE_MUSIC_KEY_ID||!env.APPLE_MUSIC_PRIVATE_KEY)throw Error('Missing signing configuration');
      const pem=env.APPLE_MUSIC_PRIVATE_KEY.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
      const der=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
      const key=await crypto.subtle.importKey('pkcs8',der,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
      const now=Math.floor(Date.now()/1000);
      const unsigned=json({alg:'ES256',kid:env.APPLE_MUSIC_KEY_ID,typ:'JWT'})+'.'+json({iss:env.APPLE_MUSIC_TEAM_ID,iat:now,exp:now+3600,origin:[origin]});
      const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,encoder.encode(unsigned));
      return send({developerToken:unsigned+'.'+b64url(new Uint8Array(signature))},200);
    } catch {
      return send({error:'Apple Music authorization is unavailable'},503);
    }
  }
};
