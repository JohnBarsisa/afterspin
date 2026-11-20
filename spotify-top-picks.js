'use strict';
const beta = id => document.getElementById(id);
const productionOrigin='https://afterspin-listening.jpiyady.chatgpt.site';
try{
 const appearance=JSON.parse(localStorage.getItem('afterspin-appearance-v1'))||{};
 if(['orbit','ruby','forest','ocean','chrome'].includes(appearance.palette))document.documentElement.dataset.palette=appearance.palette;
 document.documentElement.dataset.mode=['dark','light'].includes(appearance.mode)?appearance.mode:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
}catch{document.documentElement.dataset.mode='dark'}
const callbackStatus=new URL(location.href).searchParams.get('status');
if(callbackStatus)history.replaceState(null,'',location.pathname);
const callbackMessages={
 state_expired:'The sign-in request expired or could not be verified. Start again below.',
 permission_declined:'Spotify permission wasn’t granted. You can try again when ready.',
 connection_failed:'Spotify didn’t finish connecting. Try again.',
 setup_required:'The beta is waiting for the owner’s Spotify app configuration.'
};
let generation=0, configured=false;
const api=path=>location.origin+'/api/spotify/'+path;
function configureScreen(connected=false,message){
 beta('spotify-login').hidden=!configured||connected;
 beta('spotify-logout').hidden=!connected;
 beta('spotify-results').hidden=!connected;
 if(!connected){generation++;beta('spotify-items').replaceChildren();beta('spotify-items').hidden=true}
 beta('beta-status').textContent=message;
}
function label(code,result){
 if(code==='rate_limited')return 'Spotify asked us to slow down. '+(result.retryAfter?'Try again in about '+result.retryAfter+' seconds.':'Try again shortly.');
 return 'Spotify rankings are temporarily unavailable. Change the filter to try again.';
}
async function loadPicks(){
 const marker=++generation, list=beta('spotify-items'), info=beta('picks-status');
 const params=new URLSearchParams({type:beta('spotify-type').value,range:beta('spotify-range').value});
 info.textContent='Loading your Spotify rankings…';list.replaceChildren();list.hidden=true;
 try{
  const response=await fetch(api('top')+'?'+params,{cache:'no-store'});
  const data=await response.json();
  if(marker!==generation)return;
  if(response.status===403){configureScreen(false,'Spotify did not grant this account beta access. Ask the Afterspin owner to check your allowlist and consent.');return;}
  if(response.status===401){configureScreen(false,'Your Spotify session ended. Connect again to load your rankings.');return;}
  if(!response.ok){info.textContent=label(data.error,data);return;}
  for(const [i,item] of data.items.entries()){
   const row=document.createElement('li'), rank=document.createElement('span'), detail=document.createElement('span'), link=document.createElement('a');
   rank.className='rank';rank.textContent=String(i+1).padStart(2,'0');
   link.className='track-name';link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=item.name;
   detail.className='track-detail';detail.textContent=item.artist||'Open on Spotify';
   const text=document.createElement('span');text.append(link,detail);
   row.append(rank,text);list.append(row);
  }
  list.hidden=!data.items.length;
  info.textContent=data.items.length?'':'Spotify has no rankings for this selection yet. Try another window.';
 }catch{if(marker===generation)info.textContent='Could not reach Spotify. Try another filter or reload.';}
}
async function boot(){
 // GitHub Pages and downloaded copies have no server-side Spotify session.
 if(location.protocol==='file:'||/\.github\.io$/i.test(location.hostname)){
  beta('spotify-alternate').hidden=false;configureScreen(false,'The Spotify connection runs on the hosted beta.');return;
 }
 try{
  const response=await fetch(api('status'),{cache:'no-store'});
  if(!response.ok)throw Error();
  const status=await response.json();
  configured=!!status.configured;
  configureScreen(!!status.connected,status.connected?'Connected to Spotify. Your session expires within an hour.':callbackMessages[callbackStatus]||(configured?'Connect an account that is on the beta allowlist.':'The beta is waiting for the owner’s Spotify app configuration.'));
  if(status.connected)loadPicks();
 }catch{
  if(location.origin!==productionOrigin)beta('spotify-alternate').hidden=false;
  configureScreen(false,'The Spotify beta could not be checked. Try again later.');
 }
}
beta('spotify-type').onchange=loadPicks;beta('spotify-range').onchange=loadPicks;
beta('spotify-logout').onclick=async()=>{
 const b=beta('spotify-logout');b.disabled=true;
 try{
  const r=await fetch(api('logout'),{method:'POST'});
  if(!r.ok)throw Error();
  configureScreen(false,'Spotify disconnected from this browser.');
 }catch{beta('beta-status').textContent='Could not disconnect. Please retry.'}finally{b.disabled=false}
};
boot();
