const fs=require('node:fs'),vm=require('node:vm');
const {test}=require('node:test');
const a=require('node:assert/strict');
const file=name=>fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8');
function harness(appleEndpoint=''){
 const attrs={};
 const make=(dataset={})=>({dataset,attrs:{},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},focus(){},scrollIntoView(){},isConnected:true});
 const map=new Map(), providers=['spotify','apple'].map(provider=>make({provider}));
 const ranges=['week','month','two','three','year','custom'].map(range=>make({range}));
 const document={documentElement:make(),querySelector(s){if(!map.has(s))map.set(s,make());return map.get(s);},querySelectorAll(s){return s==='[data-provider]'?providers:s==='[data-range]'?ranges:[];}};
 const calls=[];
 const config={appleTokenEndpoint:appleEndpoint};
 const fakeApple={async configure(){calls.push('configure')},getInstance(){return {async authorize(){calls.push('authorize');return 'user-token'}}}};
 const fetch=async(url,{headers})=>{
  if(String(url).includes('issuer'))return {ok:true,json:async()=>({developerToken:'developer-token'})};
  a.equal(headers.Authorization,'Bearer developer-token');a.equal(headers['Music-User-Token'],'user-token');
  return {ok:true,json:async()=>({data:[{attributes:{year:2026},views:{'top-songs':{data:[{attributes:{name:'Real Song',artistName:'Real Artist'}}]}}}]})};
 };
 const context=vm.createContext({document,window:{AFTERSPIN_CONFIG:config,MusicKit:fakeApple},localStorage:{getItem:k=>attrs[k],setItem:(k,v)=>{attrs[k]=v;}},Intl,URL,AbortSignal,fetch,location:{href:'https://afterspin.example/',origin:'https://afterspin.example'}});
 for(const name of ['core.js','app.js'])new vm.Script(file(name)).runInContext(context);
 return {$:s=>document.querySelector(s),root:document.documentElement,providers,attrs,calls};
}
test('public home never creates demo stats and opens honest provider dialogs',()=>{
 const h=harness();
 a.match(file('index.html'),/id="recap"[^>]* hidden/);
 a.equal(h.$('#recap').hidden,true);
 a.equal(h.$('#summary').textContent,'');
 h.providers[0].onclick();
 a.match(h.$('#connectDetails').innerHTML,/Spotify Wrapped/);
 h.providers[1].onclick();
 a.match(h.$('#connectDetails').innerHTML,/Apple Music Replay/);
 a.equal(h.$('#recap').hidden,true);
});
test('both modes and all five themes update the appearance and persist preference',()=>{
 const h=harness();
 const original=h.root.dataset.mode;
 h.$('#modeToggle').onclick();
 a.notEqual(h.root.dataset.mode,original);
 for(const value of ['orbit','ruby','forest','ocean','chrome']){
  h.$('#palette').onchange({target:{value}});
  a.equal(h.root.dataset.palette,value);
 }
 a.equal(JSON.parse(h.attrs['afterspin-appearance-v1']).palette,'chrome');
});
test('configured Apple flow requests permission on the Apple screen and then displays the returned data',async()=>{
 const h=harness('https://issuer.example/api/apple-token');
 h.providers[1].onclick();
 await new Promise(r=>setImmediate(r));
 a.equal(h.$('#appleAuth').textContent,'Sign in with Apple Music');
 a.deepEqual(h.calls,['configure']);
 await h.$('#appleAuth').onclick();
 a.deepEqual(h.calls,['configure','authorize']);
 a.equal(h.$('#recap').hidden,false);
 a.match(h.$('#summary').innerHTML,/Real Song/);
 a.equal(h.$('#connectDialog').open,false);
});
