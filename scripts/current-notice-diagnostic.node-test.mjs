import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync,mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {currentNoticeMaterialPlan} from './current-notice-reference.mjs'
import {makeCurrentNoticeDiagnostic,BATCH,sha,json} from './prepare-current-notice-diagnostic.mjs'
import {reportPublicNotices} from './public-notice-scoring.mjs'
import {AUTHORITATIVE_LEDGER} from './d26-execution-host.mjs'
import {createScopedEngine} from './scoped-execution-core.mjs'

test('four source-first college excerpts exclude historical clock and high-school controls without changing original bytes',()=>{
 const p=currentNoticeMaterialPlan()
 assert.deepEqual(p.selection.selected,['FRESH-02','FRESH-04','FRESH-05','FRESH-06'])
 assert.equal(p.sources.length,4)
 for(const s of p.sources){assert.equal(sha(s.sourceText),s.sourceSha256);assert.equal(s.seenStatus,'SEEN_DURING_LOCAL_DEVELOPMENT_NO_MODEL_OUTPUT');assert.equal(s.timezone,'Asia/Shanghai')}
 assert.equal(p.references[0].assertions.some(x=>x.category==='revision'),true)
 assert.equal(p.references[1].assertions.some(x=>x.category==='channel'),true)
 assert.equal(p.references[2].assertions.some(x=>x.statement.includes('2026-06-30T17:00')),true)
 assert.equal(p.references[3].assertions.some(x=>x.statement.includes('2026-10-11T12:00')),true)
 assert.equal(p.references.every(r=>r.assertions.some(x=>x.category==='prose-extras')),true)
})

test('current C19 single-arm requests preserve original clocks and remain unauthorized; references never enter request',async()=>{
 const a=await makeCurrentNoticeDiagnostic(),rows=a['PREPARED_REQUEST_IDENTITIES.json'].requests,refs=a['REFERENCES.json']
 assert.equal(rows.length,4)
 assert.equal(new Set(rows.map(r=>r.requestSha256)).size,4)
 for(const [i,r]of rows.entries()){
  assert.equal(r.batch,BATCH);assert.equal(r.ordinal,i+1);assert.equal(r.candidate,'Candidate19');assert.equal(r.arm,'SINGLE');assert.equal(r.status,'NOT_RUN');assert.equal(r.dispatchAuthorized,false)
  assert.equal(r.referenceSha256,sha(json(refs)));assert.equal(r.requestSha256,sha(JSON.stringify(r.body)))
  assert.equal(r.body.model,'deepseek-flash');assert.equal(r.body.max_output_tokens,8192);assert.equal(r.body.reasoning.effort,'none');assert.equal(r.body.stream,false)
  assert.equal(JSON.stringify(r.body).includes(r.referenceTime),true)
  assert.equal(refs.references.some(ref=>JSON.stringify(r.body).includes(ref.assertions[0].statement)),false)
 }
 assert.equal(a['MANIFEST.json'].components.some(f=>f.path==='src/experiments/candidate19Recorded/browser.tsx'),true)
 assert.equal(a['MANIFEST.json'].components.some(f=>f.path==='scripts/scoped-execution-host.mjs'),true)
})

test('first facts, first display and human outcome stay separate; omitted and wrong facts never disappear from four-source denominator',()=>{
 const refs=currentNoticeMaterialPlan().references
 const rows=refs[0].assertions.map(f=>({factId:f.id,verdict:'CORRECT',reason:'OFFLINE TEST ONLY: source-backed literal checked',outputPointer:'OFFLINE wire.tasks/timePoints'}))
 const a={sourceId:refs[0].sourceId,modelFirstFacts:rows,displayBeforeHuman:rows.slice(0,-1),humanFinal:rows.map((r,i)=>i===1?{...r,verdict:'INCORRECT',reason:'OFFLINE changed source date/owner'}:r)}
 const r=reportPublicNotices(refs,[a])
 assert.deepEqual(r.summary.modelFirstFacts,{correct:1,incorrect:0,unknown:3,denominator:4})
 assert.deepEqual(r.summary.displayBeforeHuman,{correct:0,incorrect:0,unknown:4,denominator:4})
 assert.deepEqual(r.summary.humanFinal,{correct:0,incorrect:1,unknown:3,denominator:4})
 const disputed=reportPublicNotices(refs,[{...a,modelFirstFacts:rows.map((r,i)=>i===0?{...r,verdict:'UNKNOWN',reason:'OFFLINE role dispute unresolved'}:r)}])
 assert.equal(disputed.summary.modelFirstFacts.unknown,4)
})

test('missing new authorization blocks both paid CLI modes without execution directory or authority mutation',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'current-notice-no-auth-')),root=join(cwd,'.data/current-real-notice/execution'),before=readFileSync(AUTHORITATIVE_LEDGER)
 for(const mode of ['--prepare-authorized','--dispatch-next']){
  const r=spawnSync(process.execPath,[resolve('scripts/current-notice-execution-host.mjs'),mode],{encoding:'utf8',cwd})
  assert.equal(r.status,2);assert.match(r.stderr,/CURRENT_NEW_AUTHORIZATION_REQUIRED_NO_GRANT_NO_SEND/u)
  assert.equal(existsSync(root),false);assert.deepEqual(readFileSync(AUTHORITATIVE_LEDGER),before)
 }
})

test('the same numeric USD cap does not authorize a different batch; new four identities must match exactly',()=>{
 const engine=createScopedEngine({batch:BATCH,count:4}),units=Array.from({length:4},(_,i)=>({ordinal:i+1,unitIdentitySha256:sha('OFFLINE new identity '+i),requestSha256:sha('OFFLINE new request '+i)})),binding={manifestSha256:sha('OFFLINE manifest'),identitiesSha256:sha('OFFLINE identities')},state=engine.newState(units,binding)
 const pricing={sourceUrl:'https://api-docs.deepseek.com/quick_start/pricing/',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),peakInputUsdPerMillion:.3,peakOutputUsdPerMillion:1.2,maxInputTokens:1048576}
 const auth={authorized:true,authorizationSource:'CURRENT_USER_MESSAGE',userMessageSha256:sha('OFFLINE FAKE NOT USER CONSENT'),batch:BATCH,count:4,model:'deepseek-flash',...binding,hardLimitMicroUsd:1300000,grantId:'OFFLINE-FAKE-NO-LEDGER-WRITE',committedHead:'a'.repeat(40),endpoint:'https://api.deepseek.com/responses',retry:0,repair:0,verifier:0,pricing,units:units.map(u=>u.unitIdentitySha256),requestSha256s:units.map(u=>u.requestSha256)}
 assert.doesNotThrow(()=>engine.assertAuthorization(state,auth,units,binding))
 assert.throws(()=>engine.assertAuthorization(state,{...auth,batch:'C19-PUBLIC-DEVELOPMENT-R1'},units,binding),/AUTHORIZATION_REQUIRED/u)
 assert.throws(()=>engine.assertAuthorization(state,{...auth,units:[...auth.units.slice(1),auth.units[0]]},units,binding),/IDENTITY_DRIFT/u)
 assert.throws(()=>engine.assertAuthorization(state,{...auth,hardLimitMicroUsd:1297615},units,binding),/BUDGET_UNRESOLVED/u)
})
