import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {buildB1Outputs,loadB1Api,verifyB1Outputs,SNAPSHOT_LEDGER} from './prepare-candidate11-b1.mjs'
import {verifyProtectedFiles} from './verify-candidate11-analysis.mjs'

const beforeLedger=readFileSync(SNAPSHOT_LEDGER),beforeProtection=verifyProtectedFiles()
const first=await buildB1Outputs(),second=await buildB1Outputs(),api=await loadB1Api()

test('B1 prepares six complete engineering references and 24 unique zero-call identities deterministically',()=>{
  assert.equal(first.report.preparedRequests,24);assert.equal(first.report.completeEngineeringReferences,6)
  assert.equal(first.report.partialReferences,0);assert.equal(first.report.independentHumanReferences,0)
  assert.equal(first.report.modelCalls,0);assert.equal(first.manifest.authorization,'AWAITING_NEW_MODEL_CALL_AUTHORIZATION')
  assert.equal(new Set(first.manifest.units.map(unit=>unit.unitId)).size,24)
  assert.equal(new Set(first.manifest.units.map(unit=>unit.unitIdentitySha)).size,24)
  assert.equal(isDeepStrictEqual(first,second),true)
})

test('each source has the same input and fixed non-experimental parameters across four arms',()=>{
  for(const sourceId of [...new Set(first.manifest.units.map(unit=>unit.sourceId))]){
    const units=first.manifest.units.filter(unit=>unit.sourceId===sourceId)
    assert.equal(units.length,4);assert.equal(new Set(units.map(unit=>unit.inputSha)).size,1)
    assert.equal(new Set(units.map(unit=>unit.schemaSha)).size,1)
    assert.equal(new Set(units.map(unit=>JSON.stringify(unit.modelConfig))).size,1)
    assert.deepEqual(new Set(units.map(unit=>unit.variant)),new Set(['V00','V10','V01','V11']))
  }
  for(const row of Object.values(first.manifest.balance.positions))assert.ok(Math.max(...row)-Math.min(...row)<=1)
})

test('identity, request and context drift are rejected by frozen reconstruction',async()=>{
  for(const mode of ['request','identity','context']){
    const packet=structuredClone(first.preparedPackage.requests[0].prepared)
    if(mode==='request')packet.request.input[1].content[0].text='{}'
    if(mode==='identity')packet.identity.promptSha='0'.repeat(64)
    if(mode==='context')packet.context.index.sourceContent+='漂移'
    await assert.rejects(()=>api.validateCandidate11Prepared(packet),/C11_PREPARED_IDENTITY_CHANGED|REAL_INPUT_SOURCE_INDEX_MISMATCH/)
  }
})

test('prepared and repeated execution attempts have no authorization path',async()=>{
  const packet=first.preparedPackage.requests[0].prepared
  await assert.rejects(()=>api.denyCandidate11Dispatch(packet),/C11_MODEL_CALL_NOT_AUTHORIZED/)
  await assert.rejects(()=>api.denyCandidate11Dispatch(packet),/C11_MODEL_CALL_NOT_AUTHORIZED/)
  assert.equal(packet.modelCallsEnabled,false);assert.equal(packet.mode,'ENGINEERING_NO_AUTHORIZATION')
})

test('verification is read-only for the protected ledger and 84-file baseline',async()=>{
  await verifyB1Outputs()
  assert.deepEqual(readFileSync(SNAPSHOT_LEDGER),beforeLedger)
  assert.deepEqual(verifyProtectedFiles(),beforeProtection)
  assert.equal(beforeProtection.count,84)
})
