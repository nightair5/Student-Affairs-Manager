import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {makeAuthorityComparison,reportAuthorityFacts,COUNT} from './single-authority-comparison.mjs'
test('four coverage cells freeze exact two arms, parameters, source/ref binding without permission or Expected',async()=>{
 const a=await makeAuthorityComparison(),ids=a['PREPARED_REQUEST_IDENTITIES.json'].requests
 assert.equal(ids.length,COUNT);assert.equal(new Set(ids.map(u=>u.unitIdentitySha256)).size,COUNT)
 for(const s of a['SOURCES.json'].sources){assert.equal(ids.filter(u=>u.sourceId===s.sourceId).length,2)}
 for(const u of ids){assert.equal(u.dispatchAuthorized,false);assert.equal(u.status,'NOT_RUN');assert.equal(u.body.max_output_tokens,8192);assert.equal(u.body.model,'deepseek-flash');assert.ok(!/\bexpected\b/i.test(JSON.stringify(u.body)))}
 assert.equal(a['SELECTION.json'].exactOverlapOldSources.length,0)
})
test('missing/duplicate/prose-unknown adjudication keeps all sources and layers unknown; one error cannot be offset',()=>{
 const refs=[{sourceId:'s',assertions:[{id:'entities'},{id:'prose'}]}],r=reportAuthorityFacts(refs)
 assert.deepEqual(r.summary.Candidate19.modelFirstFacts,{correct:0,incorrect:0,unknown:1,denominator:1})
 const check=(factId,verdict)=>({factId,verdict,reason:'source test',outputPointer:'/output'})
 const x=reportAuthorityFacts(refs,[{sourceId:'s',candidate:'SingleAuthority',modelFirstFacts:[check('entities','INCORRECT'),check('prose','CORRECT')]}])
 assert.equal(x.summary.SingleAuthority.modelFirstFacts.incorrect,1);assert.equal(x.summary.Candidate19.modelFirstFacts.unknown,1)
})
test('paid CLI without a new authorization stops before package/transport/ledger or grant',()=>{
 for(const mode of ['--prepare-authorized','--dispatch-next']){const r=spawnSync(process.execPath,['scripts/single-authority-execution-host.mjs',mode],{encoding:'utf8'});assert.equal(r.status,2);assert.match(r.stderr,/AUTHORITY_NEW_AUTHORIZATION_REQUIRED_NO_GRANT_NO_SEND/)}
})
