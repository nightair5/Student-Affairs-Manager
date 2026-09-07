import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { BILLING_POLICY, sha256, costUpperMicroCny, validateManifest, validateUsageEnvelope, initializeBudget, openBudget } from './real-input-budget.mjs'

async function batchFixture() {
  const f=await recoveryFixture(),r=await openBudget(f.dir,f.manifestSha,{recoveryGrant:f.grant})
  await (await reserve(r,'A02')).complete(envelope('A02'))
  const state=await r.snapshot(),prefix=await readFile(join(f.dir,'CALL_LEDGER.jsonl'))
  const grant={version:'real-input-batch-grant-1',grantId:'22222222-2222-4222-8222-222222222222',
    parentTail:state.tail,parentSequence:state.nextSequence,ledgerPrefixBytes:prefix.length,ledgerPrefixSha:sha256(prefix),
    manifestSha:f.manifestSha,bindingSha:f.grant.bindingSha,head:'a'.repeat(40),sourcesSha:sha256('current42'),
    reviewSha:sha256('batch review'),targets:f.manifest.units.slice(2),billingEvidence:f.manifest.billingEvidence,
    route:f.grant.route,priorNonce:state.reservations[0].nonce,a02ResponseSha:state.reservations[1].responseSha,maxTotalRequests:16}
  return {...f,batchGrant:grant,batchPrefix:prefix}
}
if(process.argv[2]!=='--reserve-child') {
test('batch permits fourteen exact units only and preserves old unknown/settled requests',async()=>{
  const f=await batchFixture(),b=await openBudget(f.dir,f.manifestSha,{batchGrant:f.batchGrant})
  for(const u of f.batchGrant.targets)await (await reserve(b,u.unitId)).complete(envelope(u.unitId))
  const s=await b.snapshot();assert.equal(s.reservations.length,16);assert.equal(s.reservations[0].status,'held-unknown')
  assert.equal(s.reservations[0].costUpperMicroCny,3300000);assert.equal(s.recovery.status,'settled')
  assert.deepEqual((await readFile(join(f.dir,'CALL_LEDGER.jsonl'))).subarray(0,f.batchPrefix.length),f.batchPrefix)
  for(const id of ['A01','A02','A03','C01'])await assert.rejects(()=>reserve(b,id))
  await assert.rejects(()=>f.a01.complete(envelope('A01')))
  const old=await openBudget(f.dir,f.manifestSha);await assert.rejects(()=>reserve(old,'A03'),/HALTED/)
})
test('batch parallel and restart cannot repeat or skip a crashed request',async()=>{
  const f=await batchFixture(),a=await openBudget(f.dir,f.manifestSha,{batchGrant:f.batchGrant})
  const b=await openBudget(f.dir,f.manifestSha,{batchGrant:f.batchGrant})
  const results=await Promise.allSettled([reserve(a,'A03'),reserve(b,'A03')])
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1)
  const restarted=await openBudget(f.dir,f.manifestSha,{batchGrant:f.batchGrant})
  await assert.rejects(()=>reserve(restarted,'A03'));await assert.rejects(()=>reserve(restarted,'A04'))
  assert.equal((await restarted.snapshot()).reservations.length,3)
})
test('batch invalid usage or unknown failure preserves reservation and stops successors',async()=>{
  for(const invalid of [false,true]){
    const f=await batchFixture(),b=await openBudget(f.dir,f.manifestSha,{batchGrant:f.batchGrant}),l=await reserve(b,'A03')
    if(invalid)await assert.rejects(()=>l.complete(envelope('A03').replace('"usage":','"usage":{},"usage":')))
    else await l.uncertain()
    assert.equal((await b.snapshot()).reservations[2].costUpperMicroCny,3300000)
    await assert.rejects(()=>reserve(b,'A04'));await assert.rejects(()=>l.complete(envelope('A03')))
  }
})
test('batch changed grant, prefix, target, price expiry and order fail before dispatch',async()=>{
  const f=await batchFixture()
  for(const mutate of [g=>{g.targets[0].requestSha=sha256('changed')},g=>{g.parentTail=sha256('changed')},g=>{g.maxTotalRequests=24},g=>{g.ledgerPrefixSha=sha256('changed')}]){
    const g=structuredClone(f.batchGrant);mutate(g);await assert.rejects(()=>openBudget(f.dir,f.manifestSha,{batchGrant:g}))
  }
  const b=await openBudget(f.dir,f.manifestSha,{batchGrant:f.batchGrant})
  await assert.rejects(()=>reserve(b,'A04'));await assert.rejects(()=>reserve(b,'A03',BILLING_POLICY,'2027-01-01T00:00:00.000Z'))
  assert.deepEqual(await readFile(join(f.dir,'CALL_LEDGER.jsonl')),f.batchPrefix)
  await (await reserve(b,'A03')).complete(envelope('A03'))
  await assert.rejects(()=>openBudget(f.dir,f.manifestSha,{batchGrant:{...f.batchGrant,reviewSha:sha256('changed')}}))
})
test('batch held A01 is counted against total even after lawful new settlements',async()=>{
  const f=await batchFixture(),b=await openBudget(f.dir,f.manifestSha,{batchGrant:f.batchGrant})
  for(const id of ['A03','A04']){
    const e=JSON.parse(envelope(id));e.usage.input_tokens=1048576;e.usage.output_tokens=8192;e.usage.total_tokens=1056768
    await (await reserve(b,id)).complete(JSON.stringify(e))
  }
  await assert.rejects(()=>reserve(b,'A05'),/LIMIT/);assert.equal((await b.snapshot()).reservations.length,4)
})


}
async function recoveryFixture() {
  const fixture=await setup(),a01=await reserve(fixture.budget,'A01')
  await a01.uncertain()
  const before=await fixture.budget.snapshot(),prefix=await readFile(join(fixture.dir,'CALL_LEDGER.jsonl'))
  const grant={version:'real-input-a02-grant-1',grantId:'11111111-1111-4111-8111-111111111111',
    parentTail:before.tail,parentSequence:before.nextSequence,ledgerPrefixBytes:prefix.length,ledgerPrefixSha:sha256(prefix),
    manifestSha:fixture.manifestSha,bindingSha:sha256('frozen input binding'),priorNonce:before.reservations[0].nonce,
    priorRequestSha:before.reservations[0].requestSha,target:fixture.manifest.units[1],head:'a'.repeat(40),
    sourcesSha:sha256('reviewed42sources'),reviewSha:sha256('independent pass'),
    billingEvidence:fixture.manifest.billingEvidence,route:{proxyHost:'127.0.0.1',proxyPort:10081,targetHost:'api.deepseek.com',targetPort:443}}
  return {...fixture,before,prefix,grant,a01}
}
if(process.argv[2]!=='--reserve-child') {
  test('separate Node crash after recovery reservation cannot return the grant on reopen',async()=>{
    const f=await recoveryFixture()
    const code="import {openBudget} from "+JSON.stringify(new URL('./real-input-budget.mjs',import.meta.url).href)+";"
      +"const b=await openBudget("+JSON.stringify(f.dir)+","+JSON.stringify(f.manifestSha)+",{recoveryGrant:"+JSON.stringify(f.grant)+"});"
      +"await b.reserve('A02',"+JSON.stringify(body('A02'))+",undefined,"+JSON.stringify(NOW)+");process.exit(0)"
    const exit=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',code],{stdio:'ignore',windowsHide:true})
      child.once('error',reject);child.once('exit',resolve)})
    assert.equal(exit,0)
    const b=await openBudget(f.dir,f.manifestSha,{recoveryGrant:f.grant})
    assert.equal(held(await b.snapshot()),6600000)
    await assert.rejects(()=>reserve(b,'A02'),/RECOVERY_CONSUMED/)
  })
  test('recovery rejects expired billing, changed limits and request payload before reservation',async()=>{
    const f=await recoveryFixture(),b=await openBudget(f.dir,f.manifestSha,{recoveryGrant:f.grant})
    await assert.rejects(()=>reserve(b,'A02',BILLING_POLICY,'2027-01-01T00:00:00.000Z'),/RECOVERY_BILLING_EXPIRED/)
    await assert.rejects(()=>reserve(b,'A02',{...BILLING_POLICY,limitMicroCny:20000000}),/POLICY_CHANGED/)
    await assert.rejects(()=>b.reserve('A02','changed',BILLING_POLICY,NOW),/REQUEST_NOT_FROZEN/)
    assert.deepEqual(await readFile(join(f.dir,'CALL_LEDGER.jsonl')),f.prefix)
    assert.ok(await reserve(b,'A02'))
  })
  test('one-shot A02 recovery preserves A01 unknown cost and prefix while normal completion cannot unlock A03',async()=>{
    const f=await recoveryFixture(),b=await openBudget(f.dir,f.manifestSha,{recoveryGrant:f.grant})
    const lease=await reserve(b,'A02'),pending=await b.snapshot()
    assert.equal(pending.reservations.length,2);assert.equal(held(pending),6600000)
    assert.equal(pending.reservations[0].status,'held-unknown')
    const result=await lease.complete(envelope('A02'))
    assert.equal(result.costUpperMicroCny,390)
    const reopened=await openBudget(f.dir,f.manifestSha,{recoveryGrant:f.grant}),after=await reopened.snapshot()
    assert.equal(held(after),3300000);assert.equal(spent(after),390)
    assert.equal(after.recovery.status,'settled');assert.equal(after.recovery.priorHalt,'TRANSPORT_OR_CRASH_UNKNOWN')
    assert.deepEqual((await readFile(join(f.dir,'CALL_LEDGER.jsonl'))).subarray(0,f.prefix.length),f.prefix)
    await assert.rejects(()=>reserve(reopened,'A02'),/RECOVERY_CONSUMED/)
    await assert.rejects(()=>reserve(reopened,'A03'),/RECOVERY_UNIT/)
    const old=await openBudget(f.dir,f.manifestSha);await assert.rejects(()=>reserve(old,'A03'),/HALTED/)
  })
  test('recovery competing callers and crash/reopen consume at most one new reservation without sending',async()=>{
    const f=await recoveryFixture(),b=await openBudget(f.dir,f.manifestSha,{recoveryGrant:f.grant})
    const result=await Promise.allSettled([reserve(b,'A02'),reserve(b,'A02')])
    assert.equal(result.filter(x=>x.status==='fulfilled').length,1)
    const reopened=await openBudget(f.dir,f.manifestSha,{recoveryGrant:f.grant})
    assert.equal(held(await reopened.snapshot()),6600000)
    await assert.rejects(()=>reserve(reopened,'A02'),/RECOVERY_CONSUMED/)
    await assert.rejects(()=>f.a01.complete(envelope('A01')),/LEASE_ALREADY_FINALIZED/)
  })
  test('recovery rejects changed prior, target, route and binding fields before ledger writes',async()=>{
    for(const mutate of [g=>g.parentTail='0'.repeat(64),g=>g.parentSequence++,g=>g.ledgerPrefixSha='0'.repeat(64),
      g=>g.priorNonce='22222222-2222-4222-8222-222222222222',g=>g.priorRequestSha='0'.repeat(64),
      g=>g.target.requestSha='0'.repeat(64),g=>g.target.unitId='A03',g=>g.route.proxyPort=10082,
      g=>g.manifestSha='0'.repeat(64)]) {
      const f=await recoveryFixture(),grant=structuredClone(f.grant);mutate(grant)
      await assert.rejects(async()=>{const b=await openBudget(f.dir,f.manifestSha,{recoveryGrant:grant});await reserve(b,'A02')},/REAL_INPUT_BUDGET_/)
      assert.deepEqual(await readFile(join(f.dir,'CALL_LEDGER.jsonl')),f.prefix)
    }
  })
  test('recovery rejects ordinary pending without the designated transport halt',async()=>{
    const f=await recoveryFixture(),other=await setup();await reserve(other.budget,'A01')
    await assert.rejects(async()=>{const b=await openBudget(other.dir,other.manifestSha,{recoveryGrant:f.grant});await reserve(b,'A02')},/REAL_INPUT_BUDGET_/)
  })
  test('A02 invalid usage and uncertainty retain both reservations and never reopen the grant',async()=>{
    for(const invalid of [true,false]) {
      const f=await recoveryFixture(),b=await openBudget(f.dir,f.manifestSha,{recoveryGrant:f.grant}),lease=await reserve(b,'A02')
      if(invalid)await assert.rejects(()=>lease.complete(envelope('A02').replace('"input_tokens":100','"input_tokens":900,"\\u0069nput_tokens":100')),/RESPONSE_OR_USAGE_INVALID/)
      else await lease.uncertain()
      const reopened=await openBudget(f.dir,f.manifestSha,{recoveryGrant:f.grant})
      assert.equal(held(await reopened.snapshot()),6600000)
      await assert.rejects(()=>reserve(reopened,'A02'),/RECOVERY_CONSUMED/)
      await assert.rejects(()=>lease.complete(envelope('A02')),/LEASE_ALREADY_FINALIZED/)
    }
  })
}

const NOW='2026-09-06T15:00:00.000Z'
const body=id=>JSON.stringify({engineeringBudgetProbe:id}) // No semantic dataset and no fetch.
const row=(id,candidate='candidate-A',input=id)=>({unitId:id,candidateSha:sha256(candidate),requestSha:sha256(body(id)),
  inputSha:sha256(input),scorerSha:sha256('fixed-scorer'),requestBytes:Buffer.byteLength(body(id))})
const baseUnits=()=>Array.from({length:16},(_,i)=>row(`${i<8?'A':'B'}${String(i%8+1).padStart(2,'0')}`))
const candidateC=()=>Array.from({length:8},(_,i)=>row(`C${String(i+1).padStart(2,'0')}`,'candidate-C',`B${String(i+1).padStart(2,'0')}`))
const envelope=(id,input=100,output=10)=>JSON.stringify({id:'resp_'+id,object:'response',status:'completed',model:BILLING_POLICY.model,
  usage:{input_tokens:input,input_tokens_details:{cached_tokens:0},output_tokens:output,output_tokens_details:{reasoning_tokens:0},total_tokens:input+output},
  output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{}'}]}]})
async function setup() {
  const parent=process.env.REAL_INPUT_TEST_TEMP
  assert.ok(parent && resolve(parent)===parent,'Set REAL_INPUT_TEST_TEMP to the predeclared new temporary root')
  const root=await mkdtemp(join(parent,'budget-test-')),dir=join(root,'run'),lockRoot=join(root,'budget-control')
  await mkdir(dir);await mkdir(lockRoot)
  const manifest={version:'real-input-request-manifest-2',packageId:'MAINLINE-REAL-INPUT-01',policy:BILLING_POLICY,
    billingEvidence:{checkedAt:NOW,validUntil:'2026-09-07T15:00:00.000Z',evidenceSha:sha256('zero-call billing fixture, not actual authorization')},lockRoot,units:baseUnits()}
  const manifestSha=await initializeBudget(dir,manifest)
  return {dir,lockRoot,manifest,manifestSha,budget:await openBudget(dir,manifestSha)}
}
const reserve=(b,id,policy=BILLING_POLICY,now=NOW)=>b.reserve(id,body(id),policy,now)
const held=s=>s.reservations.filter(r=>r.status!=='settled').reduce((n,r)=>n+r.reservedMicroCny,0)
const spent=s=>s.reservations.filter(r=>r.status==='settled').reduce((n,r)=>n+r.costUpperMicroCny,0)
async function corruptLast(dir,lockRoot,mutate) {
  const p=join(dir,'CALL_LEDGER.jsonl'),lines=(await readFile(p,'utf8')).trimEnd().split('\n').map(JSON.parse)
  const last=lines.at(-1);mutate(last.event)
  last.hash=sha256(JSON.stringify({sequence:last.sequence,previous:last.previous,event:last.event}))
  await writeFile(p,lines.map(x=>JSON.stringify(x)).join('\n')+'\n')
  await writeFile(join(lockRoot,'records',String(last.sequence).padStart(8,'0')+'.json'),JSON.stringify(last))
}
if (process.argv[2]==='--reserve-child') {
  try {
    const budget=await openBudget(resolve(process.argv[3]),process.argv[4]);await reserve(budget,'A01')
    process.stdout.write('RESERVED')
  } catch(error) {process.stdout.write(error.message);process.exitCode=1}
} else {
  test('ambiguous decoded response keys retain full reserve, survive reopen and halt next dispatch',async()=>{
    const raw=envelope('A01')
    const variants=[
      raw.replace('"input_tokens":100','"input_tokens":1048576,"input_tokens":100'),
      raw.replace('"input_tokens":100','"input_tokens":100,"input_tokens":1048576'),
      raw.replace('"input_tokens":100','"input_tokens":1048576,"\\u0069nput_tokens":100'),
      raw.replace('"cached_tokens":0','"cached_tokens":100,"cached_tokens":0'),
      raw.replace('"reasoning_tokens":0','"reasoning_tokens":5,"reasoning_tokens":0'),
      raw.replace('"usage":{','"usage":{},"usage":{'),
      raw.replace('"model":','"model":"wrong-model","model":'),
      raw.replace('"id":','"id":"wrong-id","id":'),
      raw.replace('"status":','"status":"incomplete","status":'),
      raw.replace('"total_tokens":110','"total_tokens":999,"total_tokens":110'),
      raw.replace('"input_tokens":100','"input_tokens":100,"input_tokens":100'),
    ]
    for(const text of variants){
      const {dir,manifestSha,budget}=await setup(),lease=await reserve(budget,'A01')
      await assert.rejects(()=>lease.complete(text),/RESPONSE_OR_USAGE_INVALID/)
      const reopened=await openBudget(dir,manifestSha),snapshot=await reopened.snapshot()
      assert.equal(held(snapshot),3300000);assert.equal(spent(snapshot),0)
      assert.equal(snapshot.halted,'RESPONSE_OR_USAGE_INVALID');assert.equal(snapshot.reservations[0].status,'pending')
      await assert.rejects(()=>reserve(reopened,'A02'),/HALTED/)
      assert.equal((await readFile(join(dir,'CALL_LEDGER.jsonl'),'utf8')).includes('"kind":"settle"'),false)
    }
  })
  test('valid decoded keys, ordering, whitespace and key-looking model text still settle normally',async()=>{
    const value=JSON.parse(envelope('A01'))
    value.output[0].content[0].text='{"input_tokens":1048576,"input_tokens":100} braces } [ and escaped quote "'
    const raw=JSON.stringify(value,null,2).replace('"input_tokens":','"\\u0069nput_tokens":')
    const {dir,manifestSha,budget}=await setup();await (await reserve(budget,'A01')).complete(raw)
    const reopened=await openBudget(dir,manifestSha);assert.equal(spent(await reopened.snapshot()),390)
    await (await reserve(reopened,'A02')).complete(envelope('A02'))
    assert.equal(spent(await reopened.snapshot()),780)
  })
  test('conservative context envelope and integer settlement have no floating-point budget drift',()=>{
    assert.equal(costUpperMicroCny(1048576,8192),3219456)
    assert.ok(costUpperMicroCny(1048576,8192)<3300000)
    assert.equal(costUpperMicroCny(1,1),12)
    for(const n of [-1,1.5,NaN,Infinity,'10',1048577])assert.throws(()=>costUpperMicroCny(n,1))
  })
  test('normal request reserves durably before completion; only complete usage releases surplus',async()=>{
    const {budget,dir,manifestSha}=await setup(),lease=await reserve(budget,'A01')
    let state=await (await openBudget(dir,manifestSha)).snapshot()
    assert.equal(held(state),3300000);assert.equal(spent(state),0);assert.equal(state.reservations.length,1)
    const value=await lease.complete(envelope('A01'))
    assert.equal(value.costUpperMicroCny,390)
    state=await budget.snapshot();assert.equal(held(state),0);assert.equal(spent(state),390)
    await assert.rejects(()=>lease.complete(envelope('A01')),/LEASE_ALREADY_FINALIZED/)
    await assert.rejects(()=>reserve(budget,'A01'),/DUPLICATE_REQUEST/)
    assert.equal((await budget.snapshot()).reservations.length,1)
  })
  test('all 24 logical units share one ledger across reopened browser/runner handles',async()=>{
    const {dir,manifestSha}=await setup()
    for (const id of baseUnits().map(x=>x.unitId)) {
      const b=await openBudget(dir,manifestSha),lease=await reserve(b,id);await lease.complete(envelope(id))
    }
    const b=await openBudget(dir,manifestSha);await b.registerCandidateC(candidateC())
    for(const id of candidateC().map(x=>x.unitId)){const lease=await reserve(await openBudget(dir,manifestSha),id);await lease.complete(envelope(id))}
    const state=await b.snapshot();assert.equal(state.reservations.length,24);assert.equal(spent(state),24*390)
    await assert.rejects(()=>reserve(b,'C09'),/LIMIT/)
    assert.equal((await b.snapshot()).reservations.length,24)
  })
  test('10 yuan is checked using spent upper cost plus the next full reservation',async()=>{
    const {budget}=await setup()
    for(const id of ['A01','A02','A03']){const lease=await reserve(budget,id);await lease.complete(envelope(id,1048576,8192))}
    assert.equal(spent(await budget.snapshot()),9658368)
    await assert.rejects(()=>reserve(budget,'A04'),/LIMIT/)
    assert.equal((await budget.snapshot()).reservations.length,3)
  })
  test('concurrent tabs cannot reserve twice; cross-instance overlap retains one pending request',async()=>{
    const {budget,dir,manifestSha}=await setup(),b2=await openBudget(dir,manifestSha)
    const results=await Promise.allSettled([reserve(budget,'A01'),reserve(b2,'A01')])
    assert.equal(results.filter(x=>x.status==='fulfilled').length,1)
    assert.equal((await budget.snapshot()).reservations.length,1)
    await assert.rejects(()=>reserve(b2,'A02'),/INFLIGHT_OR_CRASH_UNKNOWN/)
  })
  test('two independent Node processes cannot bypass the shared filesystem lock',async()=>{
    const {dir,manifestSha,budget}=await setup()
    const child=()=>new Promise((done,reject)=>{const p=spawn(process.execPath,[fileURLToPath(import.meta.url),'--reserve-child',dir,manifestSha],{windowsHide:true});let out='';p.stdout.on('data',x=>{out+=x});p.on('error',reject);p.on('close',code=>done({code,out}))})
    const results=await Promise.all([child(),child()])
    assert.equal(results.filter(x=>x.code===0&&x.out==='RESERVED').length,1)
    assert.equal((await budget.snapshot()).reservations.length,1)
  })
  test('process restart after a durable reservation never resends or releases it',async()=>{
    const {dir,manifestSha,budget}=await setup();await reserve(budget,'A01')
    const restarted=await openBudget(dir,manifestSha)
    await assert.rejects(()=>reserve(restarted,'A01'),/DUPLICATE_REQUEST/)
    await assert.rejects(()=>reserve(restarted,'A02'),/INFLIGHT_OR_CRASH_UNKNOWN/)
    assert.equal(held(await restarted.snapshot()),3300000)
  })
  test('timeout/unknown failure retains full reservation and permanently stops this book',async()=>{
    const {budget,dir,manifestSha}=await setup();const lease=await reserve(budget,'A01');await lease.uncertain()
    const restarted=await openBudget(dir,manifestSha),state=await restarted.snapshot()
    assert.equal(held(state),3300000);assert.equal(state.halted,'TRANSPORT_OR_CRASH_UNKNOWN')
    await assert.rejects(()=>reserve(restarted,'A02'),/HALTED/)
    await assert.rejects(()=>lease.complete(envelope('A01')),/LEASE_ALREADY_FINALIZED/)
  })
  for (const [name,mutate] of [
    ['missing usage',e=>{delete e.usage}],['mismatched total',e=>{e.usage.total_tokens++}],
    ['zero tokens for nonempty input',e=>{e.usage.input_tokens=0;e.usage.total_tokens=e.usage.output_tokens}],
    ['excess input',e=>{e.usage.input_tokens=1048577;e.usage.total_tokens=1048587}],
    ['excess output',e=>{e.usage.output_tokens=8193;e.usage.total_tokens=8293}],
    ['wrong model',e=>{e.model='other'}],['incomplete response',e=>{e.status='incomplete'}],
    ['unsupported reasoning',e=>{e.usage.output_tokens_details.reasoning_tokens=1}],
    ['tools',e=>{e.output=[{type:'function_call'}]}],['string usage',e=>{e.usage.input_tokens='100'}],
  ]) test(`${name} cannot settle or release the reservation`,async()=>{
    const {budget}=await setup(),lease=await reserve(budget,'A01'),e=JSON.parse(envelope('A01'));mutate(e)
    await assert.rejects(()=>lease.complete(JSON.stringify(e)),/RESPONSE_OR_USAGE_INVALID/)
    const state=await budget.snapshot();assert.equal(held(state),3300000);assert.equal(spent(state),0)
    await assert.rejects(()=>reserve(budget,'A02'),/HALTED/)
  })
  test('even a parseable HTTP failure is not settled',async()=>{
    const {budget}=await setup(),lease=await reserve(budget,'A01')
    await assert.rejects(()=>lease.complete(envelope('A01'),500),/RESPONSE_OR_USAGE_INVALID/)
    assert.equal(held(await budget.snapshot()),3300000)
  })
  test('response reuse is a binding anomaly, not another cheap completed call',async()=>{
    const {budget}=await setup();await (await reserve(budget,'A01')).complete(envelope('A01'))
    await assert.rejects(()=>(async()=>{await (await reserve(budget,'A02')).complete(envelope('A01'))})(),/RESPONSE_OR_USAGE_INVALID/)
    const state=await budget.snapshot();assert.equal(spent(state),390);assert.equal(held(state),3300000)
  })
  test('price/context/protocol changes halt before dispatch; frozen requests cannot change',async()=>{
    const {budget}=await setup()
    await assert.rejects(()=>budget.reserve('A01','changed',BILLING_POLICY,NOW),/REQUEST_NOT_FROZEN/)
    assert.equal((await budget.snapshot()).reservations.length,0)
    await assert.rejects(()=>reserve(budget,'A01',{...BILLING_POLICY,inputPriceMicroPerMillion:4000000}),/POLICY_CHANGED/)
    await assert.rejects(()=>reserve(budget,'A01'),/HALTED/)
  })
  test('expired billing review and premature C are rejected',async()=>{
    const {budget,manifest}=await setup()
    assert.throws(()=>validateManifest({...manifest,policy:{...BILLING_POLICY,inputTokenCeiling:999999}}),/POLICY_CHANGED/)
    await assert.rejects(()=>budget.registerCandidateC(candidateC()),/C_PRECONDITION/)
    await assert.rejects(()=>reserve(budget,'A01',BILLING_POLICY,'2026-09-08T00:00:00.000Z'),/BILLING_REVIEW_EXPIRED/)
    assert.equal((await budget.snapshot()).reservations.length,0)
  })
  test('returned snapshot cannot change the frozen request, including its byte length',async()=>{
    const {budget,dir,manifestSha}=await setup(),snapshot=await budget.snapshot(),changed=body('different-body')
    snapshot.units[0].requestSha=sha256(changed);snapshot.units[0].requestBytes=Buffer.byteLength(changed)
    await assert.rejects(()=>budget.reserve('A01',changed,BILLING_POLICY,NOW),/REQUEST_NOT_FROZEN/)
    assert.equal(sha256(await readFile(join(dir,'REQUEST_MANIFEST.json'))),manifestSha)
    assert.equal((await budget.snapshot()).reservations.length,0)
    await (await reserve(budget,'A01')).complete(envelope('A01'))
    assert.equal(spent(await budget.snapshot()),390)
  })
  test('snapshot mutation cannot replace B inputs or permit an incompatible C candidate',async()=>{
    const {budget}=await setup()
    for(const id of baseUnits().map(x=>x.unitId))await (await reserve(budget,id)).complete(envelope(id))
    const snapshot=await budget.snapshot(),changed=candidateC()
    for(let i=0;i<8;i++){snapshot.units[8+i].inputSha=sha256('different-input-'+i);changed[i].inputSha=snapshot.units[8+i].inputSha}
    await assert.rejects(()=>budget.registerCandidateC(changed))
    await assert.rejects(()=>budget.registerCandidateC(candidateC().map(x=>({...x,candidateSha:sha256('candidate-A')}))))
    await assert.rejects(()=>budget.registerCandidateC(candidateC().map(x=>({...x,scorerSha:sha256('different-scorer')}))))
    assert.equal((await budget.snapshot()).units.length,16)
    await budget.registerCandidateC(candidateC())
    await (await reserve(budget,'C01')).complete(envelope('C01'))
    assert.equal((await budget.snapshot()).reservations.length,17)
  })
  test('a valid-prefix truncation is detected by the independent write-once receipts',async()=>{
    const {dir,manifest,manifestSha,budget}=await setup();await (await reserve(budget,'A01')).complete(envelope('A01'))
    const p=join(dir,'CALL_LEDGER.jsonl'),first=(await readFile(p,'utf8')).split('\n')[0]
    await writeFile(p,first+'\n')
    await assert.rejects(()=>openBudget(dir,manifestSha),/LEDGER_RECEIPT_COUNT/)
    await assert.rejects(()=>initializeBudget(dir,manifest),/EEXIST/)
  })
  test('missing ledger and abandoned lock do not initialize a fresh allowance',async()=>{
    const a=await setup();await unlink(join(a.dir,'CALL_LEDGER.jsonl'))
    await assert.rejects(()=>openBudget(a.dir,a.manifestSha),/ENOENT/)
    const b=await setup();await mkdir(join(b.lockRoot,'ledger.lock'))
    await assert.rejects(()=>openBudget(b.dir,b.manifestSha),/BUSY_OR_ABANDONED_LOCK/)
  })
  test('recomputing row hashes does not make a mismatched settlement valid',async()=>{
    const {dir,lockRoot,manifestSha,budget}=await setup();await (await reserve(budget,'A01')).complete(envelope('A01'))
    await corruptLast(dir,lockRoot,e=>{e.costUpperMicroCny=0})
    await assert.rejects(()=>openBudget(dir,manifestSha),/SETTLEMENT_AMOUNT/)
  })
  test('manifest changes and response shape tricks fail without coercion',async()=>{
    const {dir,manifestSha,manifest}=await setup()
    const sparse=structuredClone(manifest);sparse.units.length=17;assert.throws(()=>validateManifest(sparse),/JSON_ARRAY/)
    assert.throws(()=>validateUsageEnvelope(envelope('A01'), '200'),/HTTP_OR_RESPONSE_LIMIT/)
    await writeFile(join(dir,'REQUEST_MANIFEST.json'),JSON.stringify({...manifest,packageId:'other'}))
    await assert.rejects(()=>openBudget(dir,manifestSha),/MANIFEST_CHANGED/)
  })
}
