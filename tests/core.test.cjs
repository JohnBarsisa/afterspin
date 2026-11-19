const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const A=require('../core.js');
const fixture=name=>fs.readFileSync(require('node:path').join(__dirname,'../fixtures',name),'utf8');
const now=new Date(2026,10,20,14);
test('weekly range is seven local calendar days including today',()=>{
 const {start,end}=A.rangeFor('week',now);
 assert.equal(+start,+new Date(2026,10,14));assert.equal(+end,+new Date(2026,10,21));
});
test('custom start and end dates are inclusive and invalid dates are rejected',()=>{
 const {start,end}=A.rangeFor('custom',now,{start:'2026-11-17',end:'2026-11-17'});
 assert.equal(+start,+new Date(2026,10,17));assert.equal(+end,+new Date(2026,10,18));
 assert.throws(()=>A.rangeFor('custom',now,{start:'2026-11-18',end:'2026-11-17'}));
 assert.equal(A.localDate('2026-02-30'),null);assert.equal(+A.addMonths(new Date(2026,2,31),-1),+new Date(2026,1,28));
});
test('Spotify extended audio rows aggregate, podcast and zero-duration plays are excluded',()=>{
 const rows=A.parseHistory(fixture('spotify-history.json'),'spotify.json');
 const s=A.recap(rows,A.rangeFor('week',now));assert.equal(s.plays,3);assert.equal(s.ms,592000);
 assert.equal(s.tracks[0].name,'Midnight Signal');assert.equal(s.tracks[0].count,2);
 assert.equal(A.parseHistory('[{"episode_name":"News","ms_played":17000}]','spotify.json').length,0);
});
test('Spotify basic export endTime parsed in UTC; case-insensitive grouping',()=>{
 const r=A.parseHistory('[{"endTime":"2026-11-15 18:45","artistName":"Stella","trackName":"TIDE","msPlayed":1200},{"ts":"2026-11-15T18:48:00Z","artist":"stella","track":"Tide","ms_played":1550}]');
 assert.equal(r[0].t,+new Date('2026-11-15T18:45:00Z'));assert.equal(A.recap(r,A.rangeFor('week',now)).trackCount,1);
});
test('Apple CSV supports quoted names, CRLF and blank duration as unknown',()=>{
 const r=A.parseHistory(fixture('apple-history.csv').replaceAll('\n','\r\n'),'apple.csv');
 assert.equal(r.length,3);assert.equal(r[0].song,'Moonlight, Elsewhere');
 const x=A.parseHistory('Played At,Track,Artist,ms_played\n2026-11-17T10:00:00Z,"Say ""Hi""",A,\n');
 const s=A.recap(x,A.rangeFor('week',now));assert.equal(s.known,0);assert.equal(s.plays,1);assert.equal(x[0].song,'Say "Hi"');
});
test('overlapping imports keep duplicates in a single source file, without multiplying duplicate files',()=>{
 const rows=A.parseHistory(fixture('spotify-history.json'));assert.equal(A.mergeHistory([rows,rows]).length,3);
 assert.equal(A.mergeHistory([[rows[0],rows[0]],rows]).length,4);
});
test('end boundary is exclusive; all presets widen the same anchor; demos distinct',()=>{
 const sp=A.demo('spotify',now);const ap=A.demo('apple',now);
 const sizes=['week','month','two','three','year'].map(r=>A.recap(sp,A.rangeFor(r,now)).plays);
 assert(sizes.every((v,j)=>v>0&&(j===0||v>sizes[j-1])));
 assert.notEqual(A.recap(sp,A.rangeFor('week',now)).tracks[0].name,A.recap(ap,A.rangeFor('week',now)).tracks[0].name);
 const w=A.rangeFor('week',now);
 assert.equal(A.recap([{t:+w.end,song:'a',artist:'b',ms:12}],w).plays,0);
});
test('Apple daily summaries count grouped plays once and keep missing artists out of artist ranks',()=>{
 const daily=A.parseHistory('Track Description,Date Played,Play Count,Play Duration Milliseconds\nMira Vale - Moonlight,2026-11-17,3,555000\nUnknown song,2026-11-17,1,90000','Apple Music - Play History Daily Tracks.csv');
 const stats=A.recap(daily,A.rangeFor('week',now));assert.equal(stats.plays,4);assert.equal(stats.ms,645000);
 assert.equal(stats.artistCount,1);assert.equal(stats.artists[0].count,3);assert.equal(stats.tracks[0].name,'Moonlight');
 const events=A.parseHistory('Track Description,Event Start Timestamp,Play Duration Milliseconds\nMoonlight,2026-11-17 14:30:00,90000','Apple Music Play Activity.csv');
 assert.equal(events[0].artist,'');assert.equal(events[0].t,+new Date('2026-11-17T14:30:00Z'));
});
