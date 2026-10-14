import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {inspectRequest} from './real-input-model-gateway.mjs'
import {CANDIDATE11_B2_UNIT_POLICY} from './real-input-budget.mjs'
import {D6_BATCH_POLICY,openCandidate13D6Budget,reservationMicroUsd,usageCostUpperMicroUsd,validateCandidate13D6Grant} from './candidate13-d6-budget.mjs'

const root=resolve('.')
const authority='C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl'
const d5=JSON.parse(await readFile(resolve(root,'docs/recognition-optimization/candidate13/d5-development/PREPARED_REQUEST_IDENTITIES.json'),'utf8'))
const sha=value=>createHash('sha256').update(value).digest('hex')
const digest='a'.repeat(64)
const targets=d5.requests.map(packet=>{const request=JSON.stringify(packet.request),identity=inspectRequest(request,CANDIDATE11_B2_UNIT_POLICY);return {
  unitId:packet.unitId,ordinal:packet.ordinal,sourceId:packet.sourceId,sourceVersionId:packet.sourceVersionId,arm:packet.arm,position:packet.position,
  candidateVersion:packet.candidateVersion,promptVersion:packet.promptVersion,sourceSha256:packet.sourceSha256,referenceSha256:packet.referenceSha256,
  compiledReferenceSha256:packet.compiledReferenceSha256,identitySha256:packet.identitySha256,requestSha256:packet.requestSha256,promptSha256:packet.promptSha256,
  exampleSha256:packet.exampleSha256,schemaSha256:packet.schemaSha256,adapterSha256:packet.adapterSha256,scorerVersion:packet.scorerVersion,
  compilerVersion:packet.compilerVersion,requestBytes:packet.requestBytes,unitIdentitySha256:packet.unitIdentitySha256,candidateSha256:identity.candidateSha,inputSha256:identity.inputSha,
  reservedMicroUsd:reservationMicroUsd(packet.requestBytes)}})
const requestText=new Map(d5.requests.map(packet=>[packet.unitId,JSON.stringify(packet.request)]))

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'candidate13-d6-')),ledger=join(dir,'CALL_LEDGER.jsonl'),lockRoot=join(dir,'lock')
  const authorityBytes=await readFile(authority);await writeFile(ledger,authorityBytes.subarray(0,631869));await mkdir(lockRoot)
  const now=Date.now(),grant={version:'candidate13-d6-grant-1',grantId:'11111111-1111-4111-8111-111111111111',
    parentTail:'6812e1b072caeaa4fd3e6e8e55b485c57533bc0a0d9eaaff4dd84bbf48809922',parentSequence:742,ledgerPrefixBytes:631869,
    ledgerPrefixSha:'df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e',d5ManifestSha256:digest,bindingSha256:digest,
    head:'1'.repeat(40),dependenciesSha256:digest,reviewSha256:digest,targets,
    billingEvidence:{checkedAt:new Date(now-1000).toISOString(),validUntil:new Date(now+3600000).toISOString(),evidenceSha256:digest,
      documents:[{url:'https://api-docs.deepseek.com/quick_start/pricing/',claim:'official'}]},
    route:{endpoint:'https://api.deepseek.com/responses',model:'deepseek-flash',temperature:0,reasoning:'none',maxOutputTokens:8192},lockRoot,
    maxBatchRequests:24,maxBatchBudgetMicroUsd:targets.reduce((sum,item)=>sum+item.reservedMicroUsd,0),hardLimitMicroUsd:1000000,
    policy:D6_BATCH_POLICY,repair:0,verifier:0,retry:0}
  return {dir,ledger,lockRoot,grant,cleanup:()=>rm(dir,{recursive:true,force:true})}
}
const envelope=(id,input=100,output=50)=>JSON.stringify({object:'response',status:'completed',model:'deepseek-flash',id,
  usage:{input_tokens:input,input_tokens_details:{cached_tokens:0},output_tokens:output,output_tokens_details:{reasoning_tokens:0},total_tokens:input+output},
  output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{}'}]}]})

test('current frozen byte envelope stays below the authorized US$1 hard cap',()=>{
  const exact=targets.reduce((sum,item)=>sum+item.reservedMicroUsd,0)
  assert.equal(exact,351580);assert.ok(exact<1000000);assert.equal(targets.length,24)
  assert.equal(usageCostUpperMicroUsd(100,50),90)
})

test('grant binds all 24 frozen identities and rejects identity or budget drift',async()=>{
  const f=await fixture();try{
    assert.equal(validateCandidate13D6Grant(f.grant).targets.length,24)
    assert.throws(()=>validateCandidate13D6Grant({...f.grant,hardLimitMicroUsd:1000001}),/GRANT_LIMITS/)
    const drift=structuredClone(f.grant);drift.targets[0].requestSha256='b'.repeat(64)
    assert.throws(()=>validateCandidate13D6Grant(drift),/GRANT_TARGETS|TARGET/)
  }finally{await f.cleanup()}
})

test('reserve and settle are append-only, ordered, single-use and restart safe',async()=>{
  const f=await fixture();try{
    const budget=await openCandidate13D6Budget({ledgerPath:f.ledger,lockRoot:f.lockRoot,grant:f.grant}),unit=targets[0]
    const lease=await budget.reserve(unit.unitId,requestText.get(unit.unitId));const settled=await lease.complete(envelope('d6-test-1'))
    assert.equal(settled.costUpperMicroUsd,90);assert.equal((await budget.snapshot()).reservations[0].status,'settled')
    await assert.rejects(()=>budget.reserve(unit.unitId,requestText.get(unit.unitId)),/REQUEST_OR_ORDER/)
    const restarted=await openCandidate13D6Budget({ledgerPath:f.ledger,lockRoot:f.lockRoot,grant:f.grant})
    assert.equal((await restarted.snapshot()).reservations.length,1)
  }finally{await f.cleanup()}
})

test('pending/transport uncertainty stops the batch and never permits a resend',async()=>{
  const f=await fixture();try{
    const budget=await openCandidate13D6Budget({ledgerPath:f.ledger,lockRoot:f.lockRoot,grant:f.grant}),unit=targets[0]
    const lease=await budget.reserve(unit.unitId,requestText.get(unit.unitId));await lease.uncertain();const state=await budget.snapshot()
    assert.equal(state.stopped,true);assert.equal(state.reservations[0].status,'uncertain')
    await assert.rejects(()=>budget.reserve(targets[1].unitId,requestText.get(targets[1].unitId)),/STOPPED_OR_PENDING/)
    await assert.rejects(()=>budget.reserve(unit.unitId,requestText.get(unit.unitId)),/STOPPED_OR_PENDING/)
  }finally{await f.cleanup()}
})

test('invalid usage or settlement halts successors, and expired pricing writes nothing',async()=>{
  const f=await fixture();try{
    const before=await readFile(f.ledger),budget=await openCandidate13D6Budget({ledgerPath:f.ledger,lockRoot:f.lockRoot,grant:f.grant}),unit=targets[0]
    await assert.rejects(()=>budget.reserve(unit.unitId,requestText.get(unit.unitId),'2020-01-01T00:00:00.000Z'),/PRICE_EXPIRED/)
    assert.deepEqual(await readFile(f.ledger),before)
    const lease=await budget.reserve(unit.unitId,requestText.get(unit.unitId));await assert.rejects(()=>lease.complete(envelope('d6-bad',unit.requestBytes+1,10)),/RESPONSE_OR_USAGE_INVALID/)
    assert.equal((await budget.snapshot()).stopped,true)
  }finally{await f.cleanup()}
})

test('runner contains no retry, repair, verifier or alternate-sample loop',async()=>{
  const text=await readFile(resolve(root,'scripts/run-candidate13-d6.mjs'),'utf8')
  assert.match(text,/retry:0/);assert.match(text,/repairs:0/);assert.match(text,/verifiers:0/)
  assert.doesNotMatch(text,/automaticRepair:true|retryCount:[1-9]|verifierCalls:[1-9]/)
})
