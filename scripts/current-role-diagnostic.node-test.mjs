import test from 'node:test'
import assert from 'node:assert/strict'
import {makeCurrentRolePacket,sha,json,SOURCE_SELECTION} from './current-role-diagnostic.mjs'
test('current V7 diagnostic freezes four real excerpts without answer leakage or repeated uncertain requests',async()=>{
 const p=await makeCurrentRolePacket(),u=p['PREPARED_REQUEST_IDENTITIES.json'].requests
 assert.deepEqual(p['SOURCES.json'].sources.map(s=>s.id),SOURCE_SELECTION)
 assert.equal(u.length,4);assert.equal(new Set(u.map(r=>r.unitIdentitySha256)).size,4)
 for(const r of u){assert.equal(r.status,'NOT_RUN');assert.equal(r.dispatchAuthorized,false);assert.equal(sha(JSON.stringify(r.body)),r.requestSha256);assert.equal(r.referenceSha256,sha(json(p['REFERENCES.json'])));assert.equal(/\bexpected\b/iu.test(JSON.stringify(r.body)),false);assert.equal(r.body.max_output_tokens,8192);assert.equal(r.generationContract,'role-authority-source-contract-7.0.0')}
 assert.equal(p['PRE_REGISTRATION.json'].singleArm,true)
 assert.equal(p['PRE_REGISTRATION.json'].comparisonWinner,'NOT_APPLICABLE_SINGLE_ARM')
 assert.equal(p['REFERENCES.json'].truth,'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL')
})
