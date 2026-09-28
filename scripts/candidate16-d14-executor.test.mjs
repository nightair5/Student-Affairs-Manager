import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {frozenRequests,newOfflineState,assertAuthorization,nextOrdinal,validateUnit,conservativeUpperMicroUsd,MAX_INPUT_TOKENS,runOne,offlineAudit,fileLock} from './candidate16-d14-executor.mjs'

const units=frozenRequests(),auth={authorized:true,model:'deepseek-flash',count:24,manifestSha256:'b60a6ee22ab1e8f53088ba34d7a2151bbce3f7c700aafa596097701456a5c167',identitiesSha256:'0a50d55fb8818cacf01319503df7d127fd1020adc1efcb726eb049ae59a5cbda',hardLimitMicroUsd:7_800_000,grantId:'offline-fake',committedHead:'a'.repeat(40),units:units.map(u=>u.unitIdentitySha256)}
const fresh=()=>newOfflineState(units)
function fake(state,fail){const calls=[];const callbacks={state,auth,units,lock:fn=>fn(),preflight:async()=>{calls.push('preflight');if(fail==='preflight')throw Error('injected')},persist:async()=>{calls.push('persist');if(fail==='persist'&&calls.filter(x=>x==='persist').length===2)throw Error('injected')},ledger:{reserve:async()=>{calls.push('reserve');if(fail==='reserve')throw Error('injected')},settle:async()=>{calls.push('settle');if(fail==='settle')throw Error('injected')}},transport:{sendOnce:async()=>{calls.push('send');if(fail==='send')throw Error('injected');return {status:200,text:fail==='usage'?'{"ok":true}':'{"ok":true,"usage":{"input_tokens":10,"output_tokens":20}}',contentType:'application/json'}}},rawStore:{writeOnce:async()=>{calls.push('raw');if(fail==='raw')throw Error('injected')}}};return {callbacks,calls}}
test('frozen comparison and peak-price upper bound',()=>{assert.deepEqual(offlineAudit().arms,{A:12,B:12});assert.equal(offlineAudit().worstMicroUsd,7_785_696);assert.equal(conservativeUpperMicroUsd(MAX_INPUT_TOKENS,8192),324_404)})
test('authorization, identity and ordinal are mechanical gates',()=>{const state=fresh();assert.throws(()=>assertAuthorization(state,undefined,units),/AUTHORIZATION_REQUIRED/);assert.throws(()=>assertAuthorization(state,{...auth,units:[...auth.units.slice(0,23),'bad']},units),/AUTH_IDENTITY_DRIFT/);assert.throws(()=>validateUnit(state,{...units[0],requestSha256:'bad'},auth,units),/ORDER_OR_IDENTITY_DRIFT/);assert.throws(()=>validateUnit(state,units[1],auth,units),/ORDER_OR_IDENTITY_DRIFT/);state.units[0].status='RESERVED';assert.throws(()=>nextOrdinal(state),/UNCERTAIN_OR_DUPLICATE/)})
test('one offline fake unit reserves, sends once, saves raw, settles; duplicate refused',async()=>{const state=fresh(),{callbacks,calls}=fake(state);const result=await runOne(callbacks);assert.equal(result.status,'SETTLED');assert.deepEqual(calls.filter(x=>['reserve','send','raw','settle'].includes(x)),['reserve','send','raw','settle']);await assert.rejects(()=>runOne({...callbacks,units:[units[0],units[0],...units.slice(2)]}),/DUPLICATE|AUTH_IDENTITY_DRIFT|STATE_IDENTITY_DRIFT/)})
for(const failure of ['reserve','send','raw','settle','persist','usage'])test('injected '+failure+' uncertainty halts batch, never resends',async()=>{const state=fresh(),{callbacks,calls}=fake(state,failure);await assert.rejects(()=>runOne(callbacks),/UNCERTAIN/);assert.equal(state.units[0].status,'UNCERTAIN');const sent=failure==='reserve'||failure==='persist'?0:1;assert.equal(calls.filter(x=>x==='send').length,sent);await assert.rejects(()=>runOne(callbacks),/UNCERTAIN_OR_DUPLICATE/);assert.equal(calls.filter(x=>x==='send').length,sent)})
test('failed preflight refuses before reserve or send',async()=>{const {callbacks,calls}=fake(fresh(),'preflight');await assert.rejects(()=>runOne(callbacks),/injected/);assert.deepEqual(calls,['preflight'])})
test('filesystem lock rejects a competing process and keeps uncertainty sealed',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'d14-lock-')),lock=join(dir,'lock')
  try{
    await fileLock(lock,async()=>{assert.throws(()=>fileLock(lock,async()=>undefined),/EEXIST/)})
    await assert.rejects(()=>fileLock(lock,async()=>{throw Error('uncertain')}),/uncertain/)
    assert.throws(()=>fileLock(lock,async()=>undefined),/EEXIST/)
  }finally{rmdirSync(lock);rmdirSync(dir)}
})
