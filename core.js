/* Pure recap logic. Shared by the browser and Node tests. */
(function(root){
'use strict';
const labels={week:'Last 7 days',month:'Last month',two:'Last 2 months',three:'Last 3 months',year:'Last year',custom:'Custom dates'};
const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function date(y,m,d){return new Date(y,m,d)}
function dayStart(d){return date(d.getFullYear(),d.getMonth(),d.getDate())}
function addDays(d,n){return date(d.getFullYear(),d.getMonth(),d.getDate()+n)}
function addMonths(d,n){const i=date(d.getFullYear(),d.getMonth()+n,1);return date(i.getFullYear(),i.getMonth(),Math.min(d.getDate(),date(i.getFullYear(),i.getMonth()+1,0).getDate()))}
function localDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return null; const [y,m,d]=s.split('-').map(Number),x=date(y,m-1,d);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d?x:null}
function rangeFor(id,now=new Date(),custom){
 const end=addDays(dayStart(now),1);
 if(id==='custom'&&custom){const start=localDate(custom.start),last=localDate(custom.end);if(!start||!last||start>last)throw Error('Choose a valid end date on or after your start date.');return {start,end:addDays(last,1)}}
 const start=id==='week'? addDays(end,-7):addMonths(end,-({month:1,two:2,three:3,year:12}[id]||1));
 return {start,end};
}
function csv(text){
 let row=[], rows=[], field='', quote=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(quote){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"'){quote=false;}else field+=ch}
 else if(ch==='"'&&!field){quote=true;}else if(ch===','){row.push(field);field='';}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=ch}
 if(quote)throw Error('This CSV has an unclosed quoted field.');
 row.push(field);if(row.some(Boolean))rows.push(row);if(rows.length<2)return [];
 const header=rows.shift().map(k=>k.trim());return rows.map(v=>Object.fromEntries(header.map((k,i)=>[k,v[i]||''])));
}
const cleanKey=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
function parseTime(raw,forceUTC){
 if(typeof raw==='number'||/^\d{10}$|^\d{13}$/.test(raw||'')){const n=Number(raw);return +new Date(n<1e11?n*1000:n)}
 if(typeof raw!=='string'||!raw.trim())return NaN;
 let s=raw.trim();
 if(forceUTC&&/^\d{4}-\d\d-\d\d \d\d:\d\d(:\d\d)?$/.test(s))s=s.replace(' ','T')+(s.length===16?':00Z':'Z');
 return +new Date(s);
}
function normalize(row){
 if(!row||typeof row!=='object')return null;
 const fields=Object.fromEntries(Object.entries(row).map(([k,v])=>[cleanKey(k),v]));
 const get=(...keys)=>keys.map(k=>fields[cleanKey(k)]).find(v=>v!==undefined&&v!==null&&v!=='');
 if(get('episode_name','spotify_episode_uri','audiobook_uri','audiobook_title','audiobook_chapter_uri'))return null;
 const safe=(v,max=230)=>typeof v==='string'?v.trim().slice(0,max):'';
 const isApple=Boolean(get('Track Description','Event End Timestamp','Event Start Timestamp'));
 const daily=isApple&&!!get('Date Played')&&!get('Event Start Timestamp','Event End Timestamp');
 const rawCount=get('Play Count');
 const plays=daily&&rawCount!==undefined?Number(rawCount):1;
 let song=safe(get('master_metadata_track_name','Track Name','Track Title','Track Description','song','track','title','contentName','contentTitle','Media Name','name'));
 let artist=safe(get('master_metadata_album_artist_name','Artist Name','Artist Description','artist','artistName','creator'));
 if(daily&&!artist&&song.includes(' - ')){const i=song.indexOf(' - ');artist=song.slice(0,i).trim();song=song.slice(i+3).trim();}
 if(isApple&&!artist)artist='';
 const album=safe(get('master_metadata_album_album_name','Album Name','Album','albumName'));
 const t=parseTime(get('ts','endTime','Event End Timestamp','Event Start Timestamp','Play Date','Played At','Timestamp','Date Played','Event Date','date','time'),Boolean(fields.endtime));
 const rawms=get('ms_played','msPlayed','Play Duration Milliseconds','Played Duration Millis','Play Duration In Milliseconds','duration_ms','milliseconds','playDurationMs');
 const rawsec=get('Play Duration In Seconds','Play Duration Seconds','seconds','duration_seconds');
 const ms=rawms!==undefined?Number(rawms):rawsec!==undefined?Number(rawsec)*1000:NaN;
 if(!Number.isFinite(t)||!song||(!artist&&!isApple)||!Number.isSafeInteger(plays)||plays<=0|| (Number.isFinite(ms)&&ms<=0))return null;
 return {t,song,artist,album,plays,daily,ms:Number.isFinite(ms)&&ms<=86400000?Math.round(ms):null};
}
function parseHistory(str,filename=''){
 const input=str.replace(/^\uFEFF/,'').trim(); if(!input)return [];
 let rows;
 if(/^[\[{]/.test(input)||/\.json$/i.test(filename)){
  const payload=JSON.parse(input); rows=Array.isArray(payload)?payload:payload?.tracks||payload?.events||payload?.items||payload?.data||payload?.listeningHistory;
  if(!Array.isArray(rows))throw Error('No listening-event array was found in this JSON file.');
 }else rows=csv(input);
 return rows.map(normalize).filter(Boolean);
}
function mergeHistory(batches){
 const max=new Map();
 for(const batch of batches){
  const own=new Map();
  for(const row of batch){const key=JSON.stringify([row.t,row.song,row.artist,row.ms,row.plays||1,!!row.daily]);const ent=own.get(key)||{row,count:0};ent.count++;if(!ent.row.album&&row.album)ent.row=row;own.set(key,ent)}
  for(const [key,ent] of own){const old=max.get(key);if(!old||ent.count>old.count)max.set(key,ent);else if(!old.row.album&&ent.row.album)old.row=ent.row;}
 }
 return [...max.values()].flatMap(({row,count})=>Array(count).fill(row)).sort((a,b)=>a.t-b.t);
}
function recap(rows,{start,end}){
 const tracks=new Map(),artists=new Map(),activity=Array(7).fill(0),dates=new Set();
 let ms=0,known=0,plays=0;
 const add=(map,key,entry,count)=>{const old=map.get(key);map.set(key,old?{...old,count:old.count+count,ms:old.ms+(entry.ms||0)}:{...entry,count,ms:entry.ms||0})}
 for(const r of rows){if(r.t<+start||r.t>=+end)continue; const d=new Date(r.t);dates.add(+dayStart(d));const count=r.plays||1;activity[(d.getDay()+6)%7]+=count;plays+=count;if(r.ms!==null){known+=count;ms+=r.ms}
 add(tracks,JSON.stringify([r.song.toLowerCase(),r.artist.toLowerCase()]),{name:r.song,detail:r.artist||'Artist not in export',ms:r.ms},count);
 if(r.artist)add(artists,r.artist.toLowerCase(),{name:r.artist,detail:'Artist',ms:r.ms},count);}
 const rank=m=>[...m.values()].sort((a,b)=>b.count-a.count||b.ms-a.ms||a.name.localeCompare(b.name));
 return {plays,trackCount:tracks.size,artistCount:artists.size,activeDays:dates.size,tracks:rank(tracks),artists:rank(artists),activity,ms,known};
}
function demo(source,now=new Date()){
 const tracks=[['Velvet Skyline','Nova Static'],['City in Bloom','June Atlas'],['Cerulean Hours','Mira Vale'],['Midnight Signal','Nova Static'],['Honeylight','Luna Fields'],['Paper Satellites','Mira Vale'],['On the Coast','Tidal Echo'],['After the Rain','Luna Fields'],['Slow Orbit','June Atlas'],['Violet Noise','Soft Circuit'],['Blue Film','Soft Circuit'],['Dusk FM','Tidal Echo'],['Palm Lines','Sola Sound'],['Golden Static','Nova Static'],['Out of Phase','Sola Sound'],['Open Water','June Atlas'],['First Light','Sola Sound'],['Station 88','Luna Fields']];
 const rows=[];let seed=source==='apple'?92473:61372;
 const rand=()=>((seed=Math.imul(1664525,seed)+1013904223>>>0)/4294967296);
 const start=dayStart(now);
 for(let i=0;i<370;i++){
  const d=addDays(start,-i); const weekend=[0,6].includes(d.getDay());
  if(rand()<.12)continue;
  const count=Math.floor(12+rand()*28+(weekend?10:0));
  const era=source==='apple'?(i<12?4:i<55?2:i<115?7:9):(i<12?0:i<48?1:i<110?3:5);
  for(let j=0;j<count;j++){
   const track=tracks[(era+Math.floor(rand()**1.9*tracks.length))%tracks.length];const t=new Date(+d);t.setHours(7+Math.floor(rand()*16),Math.floor(rand()*60),j%60);
   rows.push({t:+t,song:track[0],artist:track[1],ms:Math.round(38000+rand()*245000)});
  }
 }
 return rows;
}
const api={labels,days,rangeFor,addDays,addMonths,localDate,parseHistory,mergeHistory,recap,demo};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Afterspin=api;
})(typeof window==='undefined'?globalThis:window);
