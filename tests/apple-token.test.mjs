import assert from 'node:assert/strict';
import {test} from 'node:test';
import issuer from '../server/apple-token-worker.mjs';

test('signs a scoped, expiring Apple token and rejects unapproved origins', async () => {
  const pair = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const secret = '-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await crypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----';
  const base = 'https://token.example/api/apple-token';
  const origin = 'https://afterspin.example';
  const env = {APPLE_MUSIC_PRIVATE_KEY:secret,APPLE_MUSIC_TEAM_ID:'TEAM-A',APPLE_MUSIC_KEY_ID:'KEY-A',AFTERSPIN_ORIGINS:origin};
  let result = await issuer.fetch(new Request(base,{headers:{Origin:'https://different.example'}}),env);
  assert.equal(result.status,403);
  result = await issuer.fetch(new Request(base,{headers:{Origin:origin}}),env);
  assert.equal(result.status,200);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),origin);
  const [head,body,sig]=(await result.json()).developerToken.split('.');
  const decode=v=>JSON.parse(Buffer.from(v,'base64url').toString('utf8'));
  assert.equal(decode(head).alg,'ES256');
  assert.equal(decode(head).kid,env.APPLE_MUSIC_KEY_ID);
  const claims=decode(body);
  assert.deepEqual(claims.origin,[origin]);
  assert.equal(claims.exp-claims.iat,3600);
  assert.equal(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pair.publicKey,Buffer.from(sig,'base64url'),new TextEncoder().encode(head+'.'+body)),true);
});
