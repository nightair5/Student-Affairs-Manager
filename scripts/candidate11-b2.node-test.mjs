import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {inspectRequest,createModelGateway,assertModelGatewayConfigured} from './real-input-model-gateway.mjs'
import {CANDIDATE11_B2_POLICY,CANDIDATE11_B2_UNIT_POLICY,costUpperMicroCny} from './real-input-budget.mjs'
import {openCandidate11B2Budget,validateCandidate11B2Grant} from './candidate11-b2-budget.mjs'

const sha=value=>createHash('sha256').update(value).digest('hex')
const ROOT=resolve('.')
const LEDGER=resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
const LEGACY=resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/REQUEST_MANIFEST.json')
const packets=JSON.parse(await readFile(join(ROOT,'docs/recognition-optimization/candidate11/b1-preparation/PREPARED_REQUESTS.json'),'utf8')).requests
const scorerSha=sha(await readFile(join(ROOT,'scripts/score-candidate11-recognition.mjs')))
const frozenLedgerPrefix=(await readFile(LEDGER)).subarray(0,519152)
const seedLedger=path=>writeFile(path,frozenLedgerPrefix)

function makeGrant(lockRoot){
  const units=packets.map(packet=>{const identity=inspectRequest(packet.requestSerialized,CANDIDATE11_B2_UNIT_POLICY);return {unitId:packet.unitId,ordinal:packet.ordinal,sourceId:packet.sourceId,sourceVersionId:packet.sourceVersionId,variant:packet.variant,position:packet.position,
    sourceSha:packet.sourceSha,referenceSha:packet.referenceSha,identitySha:packet.identitySha,requestSha:packet.requestSha,inputSha:packet.inputSha,promptSha:packet.promptSha,exampleSha:packet.exampleSha,schemaSha:packet.schemaSha,
    scorerSha,adapterVersion:'real-input-model-wire-1',candidateSha:identity.candidateSha,requestBytes:packet.requestBytes}})
  return {version:'candidate11-b2-grant-1',grantId:'11111111-1111-4111-8111-111111111111',parentTail:'37ffce66d2e92d036481308f84b08a24c70d42c313cdaf7aaa8ad505f3f2822e',parentSequence:644,
    ledgerPrefixBytes:519152,ledgerPrefixSha:'dc52d9cd04b809be9d22d5298bd45d0e6f0a01307017d48a91aaa91a45e8e597',legacyManifestSha:sha(awaitRead(LEGACY)),
    b1ManifestSha:'af1f1d2427eec1795691e1d4a62056a614bac72f0254103667632b341794744e',bindingSha:'a'.repeat(64),head:'a'.repeat(40),sourcesSha:'b'.repeat(64),reviewSha:'c'.repeat(64),targets:units,
    billingEvidence:{checkedAt:'2026-09-21T00:00:00.000Z',validUntil:'2026-09-21T12:00:00.000Z',evidenceSha:'d'.repeat(64),documents:[{url:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/'}]},
    route:{endpoint:'https://api.deepseek.com/responses',model:'deepseek-flash',temperature:0,reasoning:'none',maxOutputTokens:8192},lockRoot,maxBatchRequests:24,maxTotalRequests:338,maxBatchBudgetMicroCny:51904512,
    policy:CANDIDATE11_B2_POLICY,repair:0,verifier:0,retry:0}
}
function awaitRead(path){return globalThis.__files.get(path)}
globalThis.__files=new Map([[LEGACY,await readFile(LEGACY)]])
function response(id='b2-test-response'){const usage={input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50,output_tokens_details:{reasoning_tokens:0},total_tokens:150};return JSON.stringify({object:'response',status:'completed',model:'deepseek-flash',id,usage,output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{}'}]}]})}

test('grant fixes 24 identities, model route, zero retry and exact worst budget',async()=>{
  const root=await mkdtemp(join(tmpdir(),'c11-b2-grant-')),grant=validateCandidate11B2Grant(makeGrant(join(root,'lock')))
  assert.equal(grant.targets.length,24);assert.equal(grant.maxBatchBudgetMicroCny,51904512);assert.equal(grant.retry,0)
  assert.equal(CANDIDATE11_B2_POLICY.reservationMicroCny*24,51904512)
})

test('append-only budget grants, reserves and settles once in frozen order',async()=>{
  const root=await mkdtemp(join(tmpdir(),'c11-b2-budget-')),ledger=join(root,'ledger.jsonl'),lockRoot=join(root,'lock');await seedLedger(ledger)
  const grant=makeGrant(lockRoot),budget=await openCandidate11B2Budget({ledgerPath:ledger,lockRoot,grant}),packet=packets[0]
  const lease=await budget.reserve(packet.unitId,packet.requestSerialized,CANDIDATE11_B2_UNIT_POLICY,'2026-09-21T06:00:00.000Z')
  const settled=await lease.complete(response(),200),state=await budget.snapshot()
  assert.equal(state.reservations.length,1);assert.equal(state.reservations[0].status,'settled');assert.equal(state.ledger.rows,647)
  assert.equal(settled.costUpperMicroCny,costUpperMicroCny(100,50,CANDIDATE11_B2_UNIT_POLICY))
  await assert.rejects(()=>budget.reserve(packet.unitId,packet.requestSerialized,CANDIDATE11_B2_UNIT_POLICY,'2026-09-21T06:00:00.000Z'),/REQUEST_OR_ORDER/)
})

test('expired evidence and configuration failure do not reserve',async()=>{
  const root=await mkdtemp(join(tmpdir(),'c11-b2-gateway-')),ledger=join(root,'ledger.jsonl'),lockRoot=join(root,'lock');await seedLedger(ledger)
  const grant=makeGrant(lockRoot),budget=await openCandidate11B2Budget({ledgerPath:ledger,lockRoot,grant})
  assert.throws(()=>assertModelGatewayConfigured(()=>undefined),/NOT_CONFIGURED/)
  await assert.rejects(()=>budget.reserve(packets[0].unitId,packets[0].requestSerialized,CANDIDATE11_B2_UNIT_POLICY,'2026-09-22T00:00:00.000Z'),/PRICE_EXPIRED/)
  const requests=Object.fromEntries(packets.map(packet=>[packet.unitId,packet.requestSerialized])),origin='http://127.0.0.1:6631',capability='a'.repeat(64)
  const gateway=await createModelGateway({origin,capability,budget,requests,policy:CANDIDATE11_B2_POLICY,readSecret:()=>undefined,fetchImpl:async()=>{throw Error('MUST_NOT_SEND')},recordRaw:async()=>{throw Error('MUST_NOT_WRITE')}})
  const result=await gateway.handle({method:'POST',path:'/api/real-input/recognize',headers:{host:'127.0.0.1:6631',origin,'sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':capability},bodyText:JSON.stringify({unitId:packets[0].unitId,requestSha:packets[0].requestSha})})
  assert.equal(result.status,409);assert.equal((await budget.snapshot()).reservations.length,0)
})

test('uncertain result halts the whole batch and cannot be retried',async()=>{
  const root=await mkdtemp(join(tmpdir(),'c11-b2-uncertain-')),ledger=join(root,'ledger.jsonl'),lockRoot=join(root,'lock');await seedLedger(ledger)
  const grant=makeGrant(lockRoot),budget=await openCandidate11B2Budget({ledgerPath:ledger,lockRoot,grant}),packet=packets[0]
  const lease=await budget.reserve(packet.unitId,packet.requestSerialized,CANDIDATE11_B2_UNIT_POLICY,'2026-09-21T06:00:00.000Z');await lease.uncertain()
  const state=await budget.snapshot();assert.equal(state.stopped,true);assert.equal(state.reservations[0].status,'uncertain')
  await assert.rejects(()=>budget.reserve(packets[1].unitId,packets[1].requestSerialized,CANDIDATE11_B2_UNIT_POLICY,'2026-09-21T06:00:00.000Z'),/STOPPED_OR_PENDING/)
})
