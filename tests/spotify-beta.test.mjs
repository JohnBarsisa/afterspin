import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSpotifyBeta} from '../server/spotify-beta.mjs';
import worker from '../dist/server/index.js';

const base='https://afterspin.example';
const call=(path,options)=>new Request(base+path,options);
const scopes={SPOTIFY_CLIENT_ID:'a'.repeat(32),SPOTIFY_SESSION_KEY:'ab'.repeat(32)};
const cookie=(r,i=0)=>r.headers.getSetCookie()[i]?.split(';',1)[0];
const allow=(options={})=>new Response(JSON.stringify({access_token:'private-token',refresh_token:'discarded',expires_in:3600,token_type:'Bearer',scope:'user-top-read',...options}),{status:200});
const login=async handle=>{
 const start=await handle(call('/oauth/spotify/login'),scopes);
 const location=new URL(start.headers.get('Location'));
 const state=location.searchParams.get('state');
 const callback=await handle(call('/oauth/spotify/callback?code=test&state='+state,{headers:{Cookie:cookie(start)}}),scopes);
 return {start,location,state,callback,session:cookie(callback,1)};
};

test('a new site reports setup missing and does not advertise a working OAuth flow',async()=>{
 const handle=createSpotifyBeta(()=>assert.fail('Unexpected outbound request'));
 const response=await handle(call('/api/spotify/status'),{});
 assert.deepEqual(await response.json(),{configured:false,connected:false});
 assert.match(response.headers.get('Cache-Control'),/no-store/);
 assert.match((await handle(call('/oauth/spotify/login'),{})).headers.get('Location'),/setup_required/);
});
test('PKCE uses minimal scope and exchanges codes only for the session that started login',async()=>{
 let exchange;
 const handle=createSpotifyBeta(async(url,request)=>{
  assert.equal(url,'https://accounts.spotify.com/api/token');
  exchange=request.body;
  return allow();
 });
 const {start,location,callback,session}=await login(handle);
 assert.equal(location.origin,'https://accounts.spotify.com');
 assert.equal(location.searchParams.get('scope'),'user-top-read');
 assert.equal(location.searchParams.get('code_challenge_method'),'S256');
 assert.equal(location.searchParams.get('redirect_uri'),base+'/oauth/spotify/callback');
 const challenge=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(exchange.get('code_verifier')))).toString('base64url');
 assert.equal(challenge,location.searchParams.get('code_challenge'));
 assert.equal(exchange.get('redirect_uri'),base+'/oauth/spotify/callback');
 assert.equal(callback.headers.get('Location'),'/spotify-top-picks.html');
 assert(session&&!session.includes('private-token')&&!session.includes('discarded'));
 assert.match(callback.headers.getSetCookie()[1],/Max-Age=3600; Path=\/; Secure; HttpOnly; SameSite=Lax/);
 const invalid=await handle(call('/oauth/spotify/callback?code=test&state=wrong',{headers:{Cookie:cookie(start)}}),scopes);
 assert.match(invalid.headers.get('Location'),/state_expired/);
 const rejected=await handle(call('/oauth/spotify/callback?error=access_denied&state='+location.searchParams.get('state'),{headers:{Cookie:cookie(start)}}),scopes);
 assert.match(rejected.headers.get('Location'),/permission_declined/);
});
test('returns only Spotify-ranked items and clears sessions without browser-visible tokens',async()=>{
 const checks=[];
 let providerStatus=200;
 const handle=createSpotifyBeta(async(url,{headers})=>{
  if(url.endsWith('/api/token'))return allow();
  checks.push(new URL(url));
  assert.equal(headers.Authorization,'Bearer private-token');
  return Response.json({items:[
    {name:'First item',artists:[{name:'Artist'}],external_urls:{spotify:'https://open.spotify.com/track/1234'},unnecessary:'discarded'},
    {name:'Wrong origin',external_urls:{spotify:'https://unexpected.example/track/1'}},
    {name:'Second item',external_urls:{spotify:'https://open.spotify.com/track/2345'}},
  ]},{status:providerStatus,headers:{'Retry-After':'25'}});
 });
 const {session}=await login(handle);
 const args={headers:{Cookie:session}};
 const url='/api/spotify/top?type=tracks&range=medium_term';
 assert.equal((await (await handle(call('/api/spotify/status',args),scopes)).json()).connected,true);
 const ranked=await handle(call(url,args),scopes);
 assert.deepEqual((await ranked.json()).items,[{name:'First item',artist:'Artist',url:'https://open.spotify.com/track/1234'},{name:'Second item',artist:'',url:'https://open.spotify.com/track/2345'}]);
 assert.equal(checks[0].searchParams.get('time_range'),'medium_term');
 assert.equal(checks[0].pathname,'/v1/me/top/tracks');
 assert.equal((await handle(call('/api/spotify/top?type=tracks&range=7_days',args),scopes)).status,400);
 assert.equal((await handle(call(url,{headers:{Cookie:session+'invalid'}}),scopes)).status,401);
 providerStatus=429;
 assert.deepEqual(await (await handle(call(url,args),scopes)).json(),{error:'rate_limited',retryAfter:25});
 providerStatus=403;
 const denied=await handle(call(url,args),scopes);
 assert.equal(denied.status,403);assert.match(denied.headers.get('Set-Cookie'),/Max-Age=0/);
 assert.equal((await handle(call('/api/spotify/logout',{method:'POST',headers:{Origin:'https://unexpected.example'}}),scopes)).status,403);
 const logout=await handle(call('/api/spotify/logout',{method:'POST',headers:{Origin:base}}),scopes);
 assert.equal(logout.status,200);assert.match(logout.headers.getSetCookie()[1],/Max-Age=0/);
});
test('the packaged Worker serves the existing home, beta page, and binary artwork',async()=>{
 assert.match(await (await worker.fetch(call('/'),{})).text(),/provider-choices/);
 assert.match(await (await worker.fetch(call('/spotify-top-picks.html'),{})).text(),/INVITE-ONLY BETA/);
 assert.equal((await worker.fetch(call('/assets/ribbon.webp'),{})).headers.get('Content-Type'),'image/webp');
 assert.equal((await worker.fetch(call('/not-found'),{})).status,404);
});
