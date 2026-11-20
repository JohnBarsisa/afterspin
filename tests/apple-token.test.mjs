import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createAppleMusic} from '../server/apple-token-worker.mjs';
import worker from '../dist/server/index.js';

const base='https://issuer.example';
const home='https://afterspin.example';
const mirror='https://example.github.io';
const endpoint='/api/apple-token';
const readiness='/api/apple/status';
const request=(path,origin)=>new Request(base+path,origin?{headers:{Origin:origin}}:undefined);
const issuer=createAppleMusic([base,home,mirror]);

async function credentials(){
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const body=Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64');
 const secret='-----BEGIN PRIVATE KEY-----\n'+body+'\n-----END PRIVATE KEY-----';
 const env={APPLE_MUSIC_TEAM_ID:'TEAM123456',APPLE_MUSIC_KEY_ID:'KEY1234567',APPLE_MUSIC_PRIVATE_KEY:secret};
 return {env,publicKey:keys.publicKey};
}
test('Apple readiness and issuer fail closed without valid signing credentials',async()=>{
 const {env}=await credentials();
 for(const invalid of [{},{...env,APPLE_MUSIC_PRIVATE_KEY:'not a key'},{...env,APPLE_MUSIC_TEAM_ID:'invalid'}]){
  const status=await issuer(request(readiness,home),invalid);
  assert.deepEqual(await status.json(),{configured:false});
  assert.match(status.headers.get('Cache-Control'),/no-store/);
  assert.equal((await issuer(request(endpoint,home),invalid)).status,503);
 }
 assert.equal((await issuer(request(endpoint,'https://unapproved.example'),env)).status,403);
 const active=await issuer(request(readiness,home),env);
 assert.deepEqual(await active.json(),{configured:true});
});
test('Apple token is signed, short-lived and bound to the exact browser origin',async()=>{
 const {env,publicKey}=await credentials();
 for(const origin of [home,mirror,undefined]){
  const response=await issuer(request(endpoint,origin),env);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin||null);
  const {developerToken,expiresAt}=await response.json();
  const [head,body,sig]=developerToken.split('.');
  const decode=v=>JSON.parse(Buffer.from(v,'base64url').toString('utf8'));
  assert.equal(decode(head).alg,'ES256');
  assert.equal(decode(head).kid,env.APPLE_MUSIC_KEY_ID);
  const claims=decode(body);
  assert.deepEqual(claims.origin,[origin||base]);
  assert.equal(claims.iss,env.APPLE_MUSIC_TEAM_ID);
  assert.equal(claims.exp-claims.iat,3600);
  assert.equal(expiresAt,claims.exp);
  assert.equal(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,Buffer.from(sig,'base64url'),new TextEncoder().encode(head+'.'+body)),true);
 }
});
test('the packaged backend serves host plus GitHub Pages status without credentials',async()=>{
 const backend='https://afterspin-listening.jpiyady.chatgpt.site';
 const status=await worker.fetch(new Request(backend+readiness),{});
 assert.equal(status.status,200);
 assert.deepEqual(await status.json(),{configured:false});
 const pages=await worker.fetch(new Request(backend+readiness,{headers:{Origin:'https://johnbarsisa.github.io'}}),{});
 assert.equal(pages.headers.get('Access-Control-Allow-Origin'),'https://johnbarsisa.github.io');
 assert.equal((await worker.fetch(new Request(backend+endpoint),{})).status,503);
});
