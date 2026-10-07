import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync,existsSync} from 'node:fs'
import {makeV5NoticeDiagnostic,reportV5Notices,COUNT,sha} from './prepare-v5-current-notice.mjs'
import {AUTHORITATIVE_LEDGER} from './d26-execution-host.mjs'
test('four existing official cells bind current unchanged V5 and original reference time, never Expected or paid permission',async()=>{
 const before=sha(readFileSync(AUTHORITATIVE_LEDGER)),a=await makeV5NoticeDiagnostic(),units=a['PREPARED_REQUEST_IDENTITIES.json'].requests,sources=a['SOURCES.json'].sources
 assert.equal(units.length,COUNT);assert.equal(new Set(units.map(u=>u.unitIdentitySha256)).size,COUNT)
 assert.equal(a['PRE_REGISTRATION.json'].inputMechanismChanged,false)
 const old=JSON.parse(readFileSync('docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/SOURCES.json')).sources
 for(const [i,u]of units.entries()){assert.equal(u.candidate,'SingleAuthority');assert.equal(u.generationContract,'single-authority-source-contract-5.0.0');assert.equal(u.status,'NOT_RUN');assert.equal(u.dispatchAuthorized,false);assert.equal(u.sourceSha256,old[i].sourceSha256);assert.equal(u.referenceTime,old[i].referenceTime);assert.notEqual(u.sourceId,old[i].sourceId);assert.equal(u.body.model,'deepseek-flash');assert.equal(u.body.max_output_tokens,8192);assert.ok(!/\bexpected\b/iu.test(JSON.stringify(u.body)));assert.equal(sources[i].sourceText,old[i].sourceText)}
 assert.equal(sha(readFileSync(AUTHORITATIVE_LEDGER)),before)
})
test('no answers retains full four denominators; disputed prose or an error cannot become whole correct',()=>{
 const refs=Array.from({length:4},(_,i)=>({sourceId:'s'+i,assertions:[{id:'fact'},{id:'prose'}]})),r=reportV5Notices(refs)
 assert.deepEqual(r.summary.modelFirstFacts,{correct:0,incorrect:0,unknown:4,denominator:4})
 const row=(factId,verdict)=>({factId,verdict,reason:'source evidence',outputPointer:'/output'})
 const after=reportV5Notices(refs,[{sourceId:'s0',modelFirstFacts:[row('fact','CORRECT'),row('prose','UNKNOWN')]},{sourceId:'s1',modelFirstFacts:[row('fact','INCORRECT'),row('prose','CORRECT')]}])
 assert.deepEqual(after.summary.modelFirstFacts,{correct:0,incorrect:1,unknown:3,denominator:4});assert.equal(after.selection,'SINGLE_ARM_CURRENT_VERSION_DIAGNOSIS_NO_RELATIVE_WINNER')
})
test('paid commands without THIS authorization stop before package, env, grant, file creation or transport',()=>{
 const before=sha(readFileSync(AUTHORITATIVE_LEDGER)),root='.data/v5-current-notice/execution';assert.equal(existsSync(root+'/AUTHORIZATION.json'),false)
 for(const mode of ['--prepare-authorized','--dispatch-next']){const r=spawnSync(process.execPath,['scripts/v5-current-notice-execution-host.mjs',mode],{encoding:'utf8'});assert.equal(r.status,2);assert.match(r.stderr,/V5_NOTICE_NEW_AUTHORIZATION_REQUIRED_NO_GRANT_NO_SEND/)}
 assert.equal(existsSync(root+'/STATE.json'),false);assert.equal(existsSync(root+'/lock'),false);assert.equal(sha(readFileSync(AUTHORITATIVE_LEDGER)),before)
})
