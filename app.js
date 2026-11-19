'use strict';
const A=window.Afterspin, $=s=>document.querySelector(s), all=s=>[...document.querySelectorAll(s)];
const state={source:'spotify',range:'month',custom:null,choice:'spotify',hist:{},appleLive:null,slide:0,slides:[]};
const fmt=new Intl.NumberFormat(), shortDate=new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric'});
const now=new Date(), demo={spotify:A.demo('spotify',now),apple:A.demo('apple',now)};
const sourceNames={spotify:'Spotify',apple:'Apple Music'};
const rangeButtons=all('[data-range]'),sourceButtons=all('[data-source]');
const text=(s,v)=>{$(s).textContent=v};
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const n=v=>fmt.format(v);
const timeLabel=ms=>{const min=Math.floor(ms/60000);return min<1&&ms>0?'<1 min':min<60?n(min)+' min':n(Math.floor(min/60))+'h '+(min%60)+'m'};
const dateISO=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const setPressed=(buttons,key,val)=>buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===val)));
const partition=()=>A.rangeFor(state.range,now,state.custom);
function current(){
 const window=partition(), imported=state.hist[state.source], live=state.source==='apple'&&!imported?state.appleLive:null;
 return {window,imported,live,stats:live?null:A.recap(imported?.rows||demo[state.source],window)};
}
function periodLabel(r){return shortDate.format(r.start)+' – '+shortDate.format(A.addDays(r.end,-1))}
function metric(label,value,detail){return '<article class="stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><span>'+esc(detail)+'</span></article>'}
function ranking(title,items,kind,live=false){
 return '<article class="list-card"><h3>'+esc(title)+'</h3><ol class="rank-list">'+items.slice(0,5).map((item,i)=>
 '<li><span class="rank">'+String(i+1).padStart(2,'0')+'</span><i class="tile" aria-hidden="true" style="--h:'+([265,329,204,87,43][i]+kind)+'"></i><span><strong class="track-name" title="'+esc(item.name)+'">'+esc(item.name)+'</strong><span class="track-detail">'+esc(item.detail)+'</span></span><span class="plays">'+(live?'':n(item.count)+' '+(item.count===1?'play':'plays'))+'</span></li>').join('')+
 '</ol>'+(items.length?'':'<p class="muted">No data returned for this ranking.</p>')+'</article>';
}
function render(){
 const {window:r,stats:s,imported,live}=current();
 setPressed(sourceButtons,'source',state.source);
 setPressed(rangeButtons,'range',live?'':state.range);
 rangeButtons.forEach(b=>b.disabled=Boolean(live));
 $('#custom').hidden=!!live||state.range!=='custom';
 text('#sourceTag',live?'APPLE REPLAY':imported?'IMPORTED HISTORY':'DEMO MODE');
 text('#rangeText',live?'Latest eligible Replay year'+(live.year?' · '+live.year:'') : periodLabel(r)+' · '+(imported?sourceNames[state.source]+' import · file coverage '+shortDate.format(new Date(imported.rows[0].t))+' – '+shortDate.format(new Date(imported.rows.at(-1).t)):'Fictional listening history'));
 let html='';
 if(live){
   html='<div class="empty"><h3>Apple Music Replay</h3><p>Apple supplies these rankings for its latest eligible year. Import timestamped history to unlock your own date ranges and listening totals.</p></div><div class="dash-grid">'+ranking('Top songs',live.tracks,0,true)+ranking('Top artists',live.artists,50,true)+'</div>';
 }else if(!s.plays){
   html='<article class="empty"><h3>No plays in this window</h3><p>Choose a different range or import a file that covers these dates.</p></article>';
 }else{
  html='<div class="metrics">'+metric('Time listened',s.known?timeLabel(s.ms):'—',s.known===s.plays?'Known listening duration':s.known?'Partial · '+n(s.known)+' plays timed':'No durations in this file')+metric('Total plays',n(s.plays),imported?.kind==='daily'?'Reported daily plays':'Recorded listening events')+metric('Tracks',n(s.trackCount),'Different songs')+metric('Artists',n(s.artistCount),'Artists identified in history')+'</div>'+
  '<div class="dash-grid">'+ranking('Top tracks',s.tracks,0)+ranking('Top artists',s.artists,50)+'</div>';
  const hi=Math.max(...s.activity);
  html+='<article class="activity"><h3>Listening rhythm</h3><p class="sub">Recorded plays by day of the week</p><div class="bars">'+A.days.map((d,i)=>'<div class="day'+(s.activity[i]===hi?' peak':'')+'" aria-label="'+d+': '+n(s.activity[i])+' plays" title="'+d+': '+n(s.activity[i])+' plays"><b style="height:'+Math.round(s.activity[i]/hi*72)+'px"></b>'+d+'</div>').join('')+'</div></article>';
 }
 $('#summary').innerHTML=html;
 $('#startStory').disabled=live?!live.tracks.length&&!live.artists.length:!s.plays;
}
sourceButtons.forEach(b=>b.onclick=()=>{state.source=b.dataset.source;render()});
rangeButtons.forEach(b=>b.onclick=()=>{
 state.range=b.dataset.range;
 if(state.range==='custom'&&!state.custom){const d=A.rangeFor('month',now);state.custom={start:dateISO(d.start),end:dateISO(A.addDays(d.end,-1))}}
 if(state.range==='custom'){ $('#dateStart').value=state.custom.start;$('#dateEnd').value=state.custom.end;text('#dateError',''); }
 render();
 if(state.range==='custom')$('#dateStart').focus();
});
$('#custom').onsubmit=e=>{
 e.preventDefault();
 const custom={start:$('#dateStart').value,end:$('#dateEnd').value};
 try{A.rangeFor('custom',now,custom);state.custom=custom;text('#dateError','');render()}catch(err){text('#dateError',err.message)}
};
function choose(source){
 state.choice=source;
 setPressed(all('[data-connect]'),'connect',source);
 $('#importFiles').value='';text('#connectStatus','');
 $('#clearHistory').hidden=!state.hist[source]&&!(source==='apple'&&state.appleLive);
 const spotify=source==='spotify';
 $('#connectDetails').innerHTML=spotify?
 'Request Spotify’s <strong>Extended Streaming History</strong>, unzip it, then select the audio JSON files. <a target="_blank" rel="noreferrer" href="https://www.spotify.com/account/privacy/">Open Spotify privacy settings</a>. Spotify sign-in is not enabled in this build.':
 'Download your Apple Music play history from <a target="_blank" rel="noreferrer" href="https://privacy.apple.com/">Apple Data &amp; Privacy</a>, unzip it, then select either <strong>Play Activity.csv</strong> or <strong>Play History Daily Tracks.csv</strong>. The daily file is useful when the activity file omits artists.<br><button type="button" class="button secondary" id="appleAuth">'+(state.appleLive?'Refresh Apple Replay':'Sign in with Apple Music')+'</button><small>'+(window.AFTERSPIN_CONFIG?.appleTokenEndpoint?'Loads the latest eligible annual Replay.':'Live sign-in needs a MusicKit token endpoint. Local import is available now.')+'</small>';
 if(!spotify){$('#appleAuth').disabled=!window.AFTERSPIN_CONFIG?.appleTokenEndpoint;$('#appleAuth').onclick=connectApple;}
}
function openSource(){choose(state.source);$('#connectDialog').showModal()}
$('#connectOpen').onclick=openSource;$('#sourceAction').onclick=openSource;
all('[data-connect]').forEach(b=>b.onclick=()=>choose(b.dataset.connect));
all('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#importForm').onsubmit=async e=>{
 e.preventDefault();
 const source=state.choice, files=[...$('#importFiles').files], failed=[];
 const importer=$('#importButton');importer.disabled=true;text('#connectStatus','Reading your history on this device…');
 try{
  if(files.reduce((sum,f)=>sum+f.size,0)>64*1024*1024)throw Error('Select up to 64 MB at a time. Split large exports into smaller file batches.');
  const batches=[];
  for(const file of files){
   try{const parsed=A.parseHistory(await file.text(),file.name);if(parsed.length)batches.push(parsed);else failed.push(file.name);}
   catch{failed.push(file.name)}
  }
  if(!batches.length)throw Error('No usable music plays found. Use an unzipped Spotify audio history JSON or Apple Music play history CSV that includes track names and playback dates.');
  const daily=batches.some(rows=>rows.some(x=>x.daily)), events=batches.some(rows=>rows.some(x=>!x.daily));
  if(daily&&events)throw Error('Choose either the Apple daily summary files or the individual play activity files. Combining them would count plays twice.');
  const kind=daily?'daily':'events', prev=state.hist[source];
  const replace=prev&&prev.kind!==kind;
  const old=replace?null:prev?.rows;
  const rows=A.mergeHistory(old?[old,...batches]:batches);
  state.hist[source]={rows,kind};state.source=source;
  const latest=rows.at(-1), r=partition();
  if(!rows.some(x=>x.t>=+r.start&&x.t<+r.end)){
   state.range='custom';
   const last=new Date(latest.t),first=new Date(rows[0].t);const earliest=A.addMonths(A.addDays(last,1),-1);
   state.custom={start:dateISO(first>earliest?first:earliest),end:dateISO(last)};
   $('#dateStart').value=state.custom.start;$('#dateEnd').value=state.custom.end;text('#dateError','');
  }
  render();$('#importFiles').value='';$('#clearHistory').hidden=false;
  if(state.choice===source)text('#connectStatus','Loaded '+n(rows.reduce((sum,row)=>sum+(row.plays||1),0))+' plays.'+(replace?' Previous import format replaced to avoid double-counting.':'')+(failed.length?' Skipped '+failed.length+' unreadable or non-music file(s).':'')+' Close this panel to explore.');
 }catch(err){text('#connectStatus',err.message)}finally{importer.disabled=false}
};
$('#clearHistory').onclick=async()=>{
 const source=state.choice;
 delete state.hist[source];
 if(source==='apple'&&state.appleLive){state.appleLive=null;try{await window.MusicKit?.getInstance().unauthorize()}catch{/* local session is already cleared */}}
 choose(source);render();text('#connectStatus','History removed from this tab.');
};
let sdkPromise;
function musicKit(){
 if(window.MusicKit)return Promise.resolve(window.MusicKit);
 if(!sdkPromise)sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://js-cdn.music.apple.com/musickit/v3/musickit.js';
  const timer=setTimeout(()=>{script.remove();reject(Error('MusicKit did not finish loading. Try again.'))},12000);
  const finish=()=>{if(window.MusicKit){clearTimeout(timer);resolve(window.MusicKit)}};
  document.addEventListener('musickitloaded',finish,{once:true});script.onload=finish;
  script.onerror=()=>{clearTimeout(timer);reject(Error('MusicKit could not load.'))};document.head.append(script);
 }).catch(e=>{sdkPromise=null;throw e});
 return sdkPromise;
}
async function connectApple(){
 const endpoint=window.AFTERSPIN_CONFIG?.appleTokenEndpoint;
 if(!endpoint)return;
 const b=$('#appleAuth');b.disabled=true;text('#connectStatus','Connecting to Apple Music…');
 try{
  const url=new URL(endpoint,location.href);
  if(url.protocol!=='https:'&&url.origin!==location.origin)throw Error('Configure an HTTPS MusicKit token endpoint.');
  const auth=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!auth.ok)throw Error('The developer token endpoint returned '+auth.status+'.');
  const {developerToken}=await auth.json();if(typeof developerToken!=='string'||!developerToken)throw Error('No developer token was returned.');
  const kit=await musicKit();
  await kit.configure({developerToken,app:{name:'Afterspin',build:'1.0.0'}});
  const instance=kit.getInstance();
  const userToken=await instance.authorize();
  const res=await fetch('https://api.music.apple.com/v1/me/music-summaries?filter%5Byear%5D=latest&views=top-artists,top-songs',{headers:{Authorization:'Bearer '+developerToken,'Music-User-Token':userToken},signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Error('Apple Replay could not be loaded ('+res.status+'). Check your subscription, eligibility and developer configuration.');
  const data=(await res.json()).data?.[0];
  if(!data)throw Error('Apple did not return an eligible Replay year yet.');
  const list=(key)=> (data.views?.[key]?.data||[]).filter(v=>v?.attributes?.name).map(v=>({name:v.attributes.name,detail:v.attributes.artistName||(key==='top-artists'?'Artist':'Song')}));
  const tracks=list('top-songs'),artists=list('top-artists');
  if(!tracks.length&&!artists.length)throw Error('Apple did not return Replay rankings for this account.');
  state.appleLive={year:data.attributes?.year,tracks,artists};state.source='apple';delete state.hist.apple;choose('apple');render();text('#connectStatus','Apple Replay loaded.');
 }catch(e){text('#connectStatus',e.message||'Unable to sign in with Apple Music.')}finally{b.disabled=false}
}
function startStory(){
 const {stats:s,imported,live,window:r}=current();
 if(!live&&!s.plays)return;
 const source=sourceNames[state.source];
 const label=live?'Apple Replay · '+(live.year||'latest eligible year'):periodLabel(r);
 const mark=live?'APPLE REPLAY':imported?'IMPORTED HISTORY':'DEMO DATA';
 const tracks=live?live.tracks:s.tracks, artists=live?live.artists:s.artists;
 const top=tracks[0], artist=artists[0];
 const list=tracks.slice(0,5).map(t=>t.name+' · '+t.detail);
 state.slides=[{k:mark,t:'You hit repeat.',p:source+' · '+label},
 live?{k:'THE REPLAY',t:'Your year in music.',p:label}:
 {k:s.known===s.plays?'TIME LISTENED':'TIME LISTENED · PARTIAL OR UNAVAILABLE',t:s.known?timeLabel(s.ms):n(s.plays)+' plays',p:n(s.plays)+' plays across '+n(s.activeDays)+' listening '+(s.activeDays===1?'day.':'days.')},
 {k:'THE TRACK ON REPEAT',t:top?.name||'No top track',p:top?top.detail+(live?'':' · '+n(top.count)+' '+(top.count===1?'play':'plays')):'Apple didn’t return a track ranking.'},
 {k:'YOUR TOP ARTIST',t:artist?.name||'No top artist',p:artist?(live?'No. 1 in your Apple Music Replay':n(artist.count)+' recorded '+(artist.count===1?'play':'plays')+' in this period.'):(live?'Apple didn’t return an artist ranking.':'This file did not identify artists for this period.')},
 {k:'THE TOP TRACKS',t:'On heavy rotation.',p:label,list,small:mark}].map(s=>({...s,mark}));
 state.slide=0;drawStory();$('#storyDialog').showModal();
}
function drawStory(){
 const i=state.slide,s=state.slides[i];$('#storyDialog').dataset.slide=i;
 $('#storyProgress').innerHTML=state.slides.map((_,j)=>'<button type="button" aria-label="Chapter '+(j+1)+'"'+(j===i?' aria-current="step"':'')+' data-chapter="'+j+'"></button>').join('');
 all('[data-chapter]').forEach(b=>b.onclick=()=>{state.slide=Number(b.dataset.chapter);drawStory();$('[data-chapter="'+state.slide+'"]').focus()});
 $('#storyStage').innerHTML='<div><div class="eyebrow">✦ '+esc(s.k)+'</div><h3>'+esc(s.t)+'</h3>'+(s.list?.length?'<ol>'+s.list.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol>':'')+'<p>'+esc(s.p)+'</p></div>';
 $('#prevStory').disabled=i<=0;$('#nextStory').disabled=i>=state.slides.length-1;text('#storyStatus','Chapter '+(i+1)+' of '+state.slides.length+' · '+s.mark);
}
function step(d){const i=state.slide+d;if(i>=0&&i<state.slides.length){state.slide=i;drawStory()}}
$('#startStory').onclick=startStory;$('#prevStory').onclick=()=>step(-1);$('#nextStory').onclick=()=>step(1);
$('#storyDialog').addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();step(e.key==='ArrowRight'?1:-1)}});
let touchX=null;
$('#storyStage').addEventListener('touchstart',e=>{touchX=e.changedTouches[0].clientX},{passive:true});
$('#storyStage').addEventListener('touchend',e=>{const end=e.changedTouches[0].clientX;if(touchX!==null&&Math.abs(end-touchX)>42)step(end<touchX?1:-1);touchX=null},{passive:true});
function saveCard(){
 const s=state.slides[state.slide],c=document.createElement('canvas');c.width=1080;c.height=1350;
 const cv=c.getContext('2d');
 const bg=cv.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,'#170f25');bg.addColorStop(1,'#47256e');cv.fillStyle=bg;cv.fillRect(0,0,1080,1350);
 const img=$('.ribbon');
 if(img.complete&&img.naturalWidth){cv.globalAlpha=.35;cv.drawImage(img,238,80,930,814);cv.globalAlpha=1}
 cv.strokeStyle='#a181d778';cv.lineWidth=2;cv.beginPath();cv.ellipse(785,413,375,215,-.5,0,Math.PI*2);cv.stroke();
 const write=(str,x,y,font,color,max=880)=>{cv.font=font;cv.fillStyle=color;cv.fillText(str,x,y,max)};
 const words=s.t.split(/\s+/),lines=[];let line='';cv.font='800 101px system-ui';
 for(const word of words){const candidate=line?line+' '+word:word;if(line&&cv.measureText(candidate).width>870){lines.push(line);line=word}else line=candidate}if(line)lines.push(line);
 if(lines.length>4){lines.splice(4);lines[3]=lines[3].slice(0,24)+'…'}
 write('afterspin.',83,139,'800 58px system-ui','#dcfb87');write('✦  '+s.k,83,413,'600 27px monospace','#dcfb87');
 let y=535;for(const l of lines){write(l,83,y,'800 101px system-ui','#fcf5ff');y+=108}
 if(s.list?.length)for(const [i,l] of s.list.entries()){write((i+1)+'.  '+l,83,y,'600 35px system-ui','#e6d9fe');y+=62}
 write(s.p,83,Math.min(y+38,1140),'500 36px system-ui','#f0e3fc');write('AFTERSPIN  /  '+s.mark,83,1250,'600 24px monospace','#dcfb87');
 c.toBlob(blob=>{
  if(!blob){text('#storyStatus','Card could not be exported.');return}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='afterspin-chapter-'+(state.slide+1)+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);text('#storyStatus','PNG card downloaded.');
 },'image/png');
}
$('#saveCard').onclick=saveCard;
render();
