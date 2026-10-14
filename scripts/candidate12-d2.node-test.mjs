import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {copyFile,mkdtemp,mkdir,readFile,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {CANDIDATE11_B2_UNIT_POLICY} from './real-input-budget.mjs'
import {CANDIDATE12_D2_POLICY,openCandidate12D2Budget,validateCandidate12D2Grant} from './candidate12-d2-budget.mjs'

const AUTHORITY=resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
const sha=value=>createHash('sha256').update(value).digest('hex')
const request='frozen request body'

function targets(){
  const result=[];let ordinal=0
  for(let source=1;source<=12;source++)for(const arm of (source%2===1?['A','B']:['B','A'])){
    const id=String(source).padStart(2,'0'),digest=sha(`${id}-${arm}`)
    result.push({unitId:`C12-D1-PD${id}-${arm}`,ordinal:++ordinal,sourceId:`C12-PD${id}`,sourceVersionId:`C12-PD${id}-v1`,arm,position:source%2===1?(arm==='A'?1:2):(arm==='B'?1:2),
      sourceSha256:digest,referenceSha256:digest,candidateVersion:arm==='A'?'real-input-source-semantics-3':'real-input-source-semantics-12',candidateBundleSha:digest,
      identitySha:digest,unitIdentitySha:digest,requestSha:ordinal===1?sha(request):digest,inputSha:digest,promptSha:digest,exampleSha:digest,schemaSha:digest,
      scorerSha:digest,adapterVersion:'real-input-model-wire-1',candidateSha:digest,requestBytes:ordinal===1?Buffer.byteLength(request):100})
  }
  return result
}

function grant(lockRoot,{checkedAt=new Date(Date.now()-1000).toISOString(),validUntil=new Date(Date.now()+3600000).toISOString()}={}){
  return {version:'candidate12-d2-grant-1',grantId:randomUUID(),parentTail:'13b520d270d26335072f99920e47a4443e8bc586365eb20cda61c4122d7ab3bd',parentSequence:693,
    ledgerPrefixBytes:572913,ledgerPrefixSha:'2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e',d1ManifestSha:'e2a14c8a920613f8cdd44afa57699f674f266f102df28b2eb926e1b750b1e005',
    bindingSha:'1'.repeat(64),head:'2'.repeat(40),sourcesSha:'3'.repeat(64),reviewSha:'4'.repeat(64),targets:targets(),billingEvidence:{checkedAt,validUntil,evidenceSha:'5'.repeat(64),documents:[{url:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/'}]},
    route:{endpoint:'https://api.deepseek.com/responses',model:'deepseek-flash',temperature:0,reasoning:'none',maxOutputTokens:8192},lockRoot,maxBatchRequests:24,maxTotalRequests:362,
    maxBatchBudgetMicroCny:51904512,policy:CANDIDATE12_D2_POLICY,repair:0,verifier:0,retry:0}
}

async function fixture(options={}){
  const root=await mkdtemp(join(tmpdir(),'candidate12-d2-')),ledgerPath=join(root,'ledger.jsonl'),lockRoot=join(root,'lock')
  await copyFile(AUTHORITY,ledgerPath)
  return {root,ledgerPath,lockRoot,grant:grant(lockRoot,options)}
}

test('D2 grant freezes 24 ordered units, exact ledger prefix and the worst-case cap',async()=>{
  const f=await fixture()
  try{const checked=validateCandidate12D2Grant(f.grant);assert.equal(checked.targets.length,24);assert.equal(checked.maxBatchBudgetMicroCny,51904512);assert.equal(checked.maxTotalRequests,362)}
  finally{await rm(f.root,{recursive:true,force:true})}
})

test('one grant, reserve and settle append once and produce matching receipts',async()=>{
  const f=await fixture()
  try{
    const budget=await openCandidate12D2Budget({ledgerPath:f.ledgerPath,lockRoot:f.lockRoot,grant:f.grant}),lease=await budget.reserve(f.grant.targets[0].unitId,request,CANDIDATE11_B2_UNIT_POLICY)
    const raw=JSON.stringify({object:'response',status:'completed',model:'deepseek-flash',id:'d2-test-response',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:20,output_tokens_details:{reasoning_tokens:0},total_tokens:120},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{}'}]}]})
    await lease.complete(raw,200)
    const state=await budget.snapshot();assert.equal(state.reservations.length,1);assert.equal(state.reservations[0].status,'settled');assert.equal(state.ledger.rows,696)
    assert.equal((await readFile(join(f.lockRoot,'records','000000693.json'),'utf8')).includes('candidate12D2Grant'),true)
  }finally{await rm(f.root,{recursive:true,force:true})}
})

test('expired pricing blocks before grant or reservation append',async()=>{
  const f=await fixture({checkedAt:new Date(Date.now()-7200000).toISOString(),validUntil:new Date(Date.now()-3600000).toISOString()})
  try{
    const before=sha(await readFile(f.ledgerPath)),budget=await openCandidate12D2Budget({ledgerPath:f.ledgerPath,lockRoot:f.lockRoot,grant:f.grant})
    await assert.rejects(()=>budget.reserve(f.grant.targets[0].unitId,request,CANDIDATE11_B2_UNIT_POLICY),/PRICE_EXPIRED/)
    assert.equal(sha(await readFile(f.ledgerPath)),before)
  }finally{await rm(f.root,{recursive:true,force:true})}
})

test('request identity drift and an existing writer lock fail closed',async()=>{
  const f=await fixture()
  try{
    const budget=await openCandidate12D2Budget({ledgerPath:f.ledgerPath,lockRoot:f.lockRoot,grant:f.grant})
    await assert.rejects(()=>budget.reserve(f.grant.targets[0].unitId,request+' mutation',CANDIDATE11_B2_UNIT_POLICY),/REQUEST_OR_ORDER/)
    await mkdir(join(f.lockRoot,'ledger.lock'))
    await assert.rejects(()=>budget.snapshot(),/BUSY_OR_ABANDONED_LOCK/)
  }finally{await rm(f.root,{recursive:true,force:true})}
})

test('an uncertain transport result permanently stops the batch with zero retry path',async()=>{
  const f=await fixture()
  try{
    const budget=await openCandidate12D2Budget({ledgerPath:f.ledgerPath,lockRoot:f.lockRoot,grant:f.grant}),lease=await budget.reserve(f.grant.targets[0].unitId,request,CANDIDATE11_B2_UNIT_POLICY)
    await lease.uncertain();const state=await budget.snapshot();assert.equal(state.stopped,true);assert.equal(state.reservations[0].status,'uncertain')
    await assert.rejects(()=>budget.reserve(f.grant.targets[1].unitId,'anything',CANDIDATE11_B2_UNIT_POLICY),/STOPPED_OR_PENDING/)
  }finally{await rm(f.root,{recursive:true,force:true})}
})

test('a crash after durable raw capture resumes by settlement without another request',async()=>{
  const f=await fixture()
  try{
    const budget=await openCandidate12D2Budget({ledgerPath:f.ledgerPath,lockRoot:f.lockRoot,grant:f.grant})
    await budget.reserve(f.grant.targets[0].unitId,request,CANDIDATE11_B2_UNIT_POLICY)
    const raw=JSON.stringify({object:'response',status:'completed',model:'deepseek-flash',id:'d2-resumed-response',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:20,output_tokens_details:{reasoning_tokens:0},total_tokens:120},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{}'}]}]})
    const resumed=await budget.reconcilePending(raw),state=await budget.snapshot()
    assert.equal(resumed.status,'settled');assert.equal(state.reservations[0].status,'settled');assert.equal(state.ledger.rows,696)
  }finally{await rm(f.root,{recursive:true,force:true})}
})
