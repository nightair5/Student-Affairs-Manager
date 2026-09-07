import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { request } from 'node:http'
import { createLocalApp } from './serve-mainline-real-input-01.mjs'
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { verifyPreparedUnitIdentity, verifySendApproval, verifyRecoverySendApproval, compileBatchScorer, verifyBatchSendApproval } from './run-mainline-real-input-01.mjs'
import { inspectProtection, verifyRecoveryScope } from './check-mainline-real-input-01.mjs'
import { BILLING_POLICY, RECOVERY_ROUTE, sha256 } from './real-input-budget.mjs'

const carrierManifest=process.env.REAL_INPUT_CARRIERS_MANIFEST
test('batch gate preserves original inputs and actual scorer closure while binding current reviewed code; no credential access',async()=>{
  const D='docs/recognition-optimization/mainline-real-input-01/runs/replay-a02-implementation-20260907a/'
  const old='docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/'
  const bindingBytes=readFileSync(old+'STATE.json'),binding=JSON.parse(bindingBytes),manifestBytes=readFileSync(old+'REQUEST_MANIFEST.json')
  const baselineBytes=readFileSync(D+'BATCH_BASELINE.json'),baseline=JSON.parse(baselineBytes)
  const protection=inspectProtection({stage:'batch-14'}),sources=protection.sources.map(s=>({path:s.path,sha256:s.workingSha256}))
  const closure=await compileBatchScorer(binding),billing=JSON.parse(readFileSync(D+'BATCH_BILLING.json'))
  const events=readFileSync(old+'CALL_LEDGER.jsonl','utf8').trimEnd().split('\n').map(l=>JSON.parse(l).event)
  // In-memory review/authorization is a gate fixture, not a live dispatch approval.
  const plan={version:'real-input-batch-authorization-1',originalRun:resolve(old),grantBasis:{version:'real-input-batch-grant-1',
    grantId:'11111111-1111-4111-8111-111111111111',head:protection.head,sourcesSha:sha256(JSON.stringify(sources)),bindingSha:sha256(bindingBytes),
    manifestSha:sha256(manifestBytes),parentTail:baseline.ledgerBoundary.tail,parentSequence:5,ledgerPrefixBytes:baseline.ledgerBoundary.bytes,
    ledgerPrefixSha:baseline.ledgerBoundary.sha256,priorNonce:events[1].nonce,a02ResponseSha:events[4].responseSha,
    targets:binding.units.slice(2),route:RECOVERY_ROUTE,maxTotalRequests:16,
    billingEvidence:{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha:sha256(JSON.stringify(billing))}}}
  const planBytes=Buffer.from(JSON.stringify(plan)),review={status:'PASS',scope:'REAL_INPUT_BATCH_14_SEND',head:protection.head,sources,
    bindingSha:sha256(bindingBytes),planSha:sha256(planBytes),baselineSha:sha256(baselineBytes),billingEvidenceSha:sha256(JSON.stringify(billing)),scorerBundleSha:closure.bundleSha}
  const args={bindingBytes,binding,manifestBytes,baselineBytes,baseline,planBytes,plan,billing,review,protection,closure}
  assert.equal(verifyBatchSendApproval(args).targets.length,14)
  assert.throws(()=>verifyBatchSendApproval({...args,review:{...review,status:'BLOCKED'}}),/REVIEW_STATUS/)
  assert.throws(()=>verifyBatchSendApproval({...args,protection:{...protection,head:'0'.repeat(40)}}),/REVIEW_HEAD/)
  const changed=structuredClone(protection);changed.sources[0].workingSha256='0'.repeat(64)
  assert.throws(()=>verifyBatchSendApproval({...args,protection:changed}),/REVIEW_SHA/)
  assert.throws(()=>verifyBatchSendApproval({...args,closure:{...closure,dependencies:closure.dependencies.slice(1)}}),/BATCH_SCORER_BINDING/)
  const wrong=structuredClone(binding);wrong.requests.A03+=' '
  assert.throws(()=>verifyBatchSendApproval({...args,binding:wrong}),/BATCH_ORIGINAL_BINDING/)
  const rebind=mutate=>{const p=structuredClone(plan);mutate(p);const bytes=Buffer.from(JSON.stringify(p));return {...args,plan:p,planBytes:bytes,review:{...review,planSha:sha256(bytes)}}}
  assert.throws(()=>verifyBatchSendApproval(rebind(p=>p.grantBasis.targets[0]=binding.units[0])),/BATCH_GRANT_BINDING/)
  assert.throws(()=>verifyBatchSendApproval(rebind(p=>p.originalRun=resolve('elsewhere'))),/BATCH_POLICY/)
  assert.throws(()=>verifyBatchSendApproval(rebind(p=>p.grantBasis.maxTotalRequests=24)),/BATCH_GRANT_BINDING/)
  assert.throws(()=>verifyBatchSendApproval(rebind(p=>p.grantBasis.priorNonce='0'.repeat(36))),/BATCH_GRANT_BINDING/)
  const badBilling={...billing,policy:{...billing.policy,reservationMicroCny:1}}
  assert.throws(()=>verifyBatchSendApproval({...args,billing:badBilling,review:{...review,billingEvidenceSha:sha256(JSON.stringify(badBilling))}}),/BATCH_POLICY/)
})
test('A02 send gate binds new review to original input, grant, old ledger, current code and exact public evidence without sending',()=>{
  const old='docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/'
  const baselineBytes=readFileSync('docs/recognition-optimization/mainline-real-input-01/runs/recovery-a02-20260907a/BASELINE.json'),baseline=JSON.parse(baselineBytes)
  const bindingBytes=readFileSync(old+'STATE.json'),binding=JSON.parse(bindingBytes),manifestBytes=readFileSync(old+'REQUEST_MANIFEST.json')
  const a01=JSON.parse(readFileSync(old+'CALL_LEDGER.jsonl','utf8').split('\n')[1]).event,protection=inspectProtection({stage:'recovery-a02'})
  // Date changes below are an in-memory gate fixture, never live billing evidence.
  const billing={...JSON.parse(readFileSync(old+'ENGINEERING.json')).billing,checkedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+60000).toISOString()}
  const sources=protection.sources.map(s=>({path:s.path,sha256:s.workingSha256}))
  const plan={version:'real-input-a02-recovery-plan-1',unitId:'A02',originalRun:resolve(old),grantBasis:{
    version:'real-input-a02-grant-1',grantId:'11111111-1111-4111-8111-111111111111',head:protection.head,sourcesSha:sha256(JSON.stringify(sources)),
    bindingSha:sha256(bindingBytes),manifestSha:sha256(manifestBytes),parentTail:baseline.ledgerBoundary.tailHash,parentSequence:3,
    ledgerPrefixBytes:baseline.ledgerBoundary.bytes,ledgerPrefixSha:baseline.ledgerBoundary.sha256,priorNonce:a01.nonce,priorRequestSha:a01.requestSha,
    target:binding.units[1],route:RECOVERY_ROUTE,billingEvidence:{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha:sha256(JSON.stringify(billing))}}}
  const planBytes=Buffer.from(JSON.stringify(plan)),review={status:'PASS',scope:'REAL_INPUT_A02_RECOVERY',head:protection.head,sources,
    bindingSha:sha256(bindingBytes),planSha:sha256(planBytes),baselineSha:sha256(baselineBytes),billingEvidenceSha:sha256(JSON.stringify(billing))}
  const args={bindingBytes,binding,protection,review,billing,planBytes,plan,baselineBytes,baseline,manifestBytes}
  assert.equal(verifyRecoverySendApproval(args).target.unitId,'A02')
  assert.throws(()=>verifyRecoverySendApproval({...args,review:{...review,status:'BLOCKED'}}),/REVIEW_STATUS/)
  assert.throws(()=>verifyRecoverySendApproval({...args,review:{...review,planSha:'0'.repeat(64)}}),/RECOVERY_APPROVAL/)
  const changed=structuredClone(args);changed.protection.sources[0].workingSha256='0'.repeat(64)
  assert.throws(()=>verifyRecoverySendApproval(changed),/REVIEW_SHA/)
  const other={...args,plan:structuredClone(plan)};other.plan.grantBasis.target=structuredClone(binding.units[2])
  assert.throws(()=>verifyRecoverySendApproval(other),/RECOVERY_GRANT_BINDING/)
  const wrongPrior={...args,plan:structuredClone(plan)};wrongPrior.plan.grantBasis.priorNonce='22222222-2222-4222-8222-222222222222'
  assert.throws(()=>verifyRecoverySendApproval(wrongPrior),/RECOVERY_A01_BINDING/)
  const wrongBody={...args,binding:structuredClone(binding)};wrongBody.binding.requests.A02+=' '
  assert.throws(()=>verifyRecoverySendApproval(wrongBody),/SEND_UNIT_BINDING/)
})
test('recovery scope permits only seven scripts and rejects HEAD, readonly source and protection drift',()=>{
  const baseline=JSON.parse(readFileSync('docs/recognition-optimization/mainline-real-input-01/runs/recovery-a02-20260907a/BASELINE.json'))
  const current=inspectProtection({stage:'recovery-a02'}),args={head:current.head,baseline,sources:current.sources,protectedSummary:baseline.protected}
  assert.equal(verifyRecoveryScope(args),true)
  assert.throws(()=>inspectProtection(),/AUTHORIZED_GIT/) // Historical stage remains blocked.
  assert.throws(()=>verifyRecoveryScope({...args,head:'0'.repeat(40)}),/RECOVERY_HEAD/)
  const changed=structuredClone(args);changed.sources.find(x=>x.path==='src/App.tsx').workingSha256='0'.repeat(64)
  assert.throws(()=>verifyRecoveryScope(changed),/RECOVERY_READONLY_SOURCE/)
  const escaped=structuredClone(args);escaped.sources[0].path='../escape'
  assert.throws(()=>verifyRecoveryScope(escaped),/RECOVERY_PATH/)
  assert.throws(()=>verifyRecoveryScope({...args,protectedSummary:{count:945,sha256:'0'.repeat(64)}}),/RECOVERY_PROTECTION/)
})
if(!carrierManifest)throw Error('REAL_INPUT_CARRIERS_MANIFEST_REQUIRED_NO_FALLBACK')
test('send gate binds independent approval, all current code, input artifacts, exact candidate and current billing without sending',()=>{
  const bindingBytes=readFileSync('docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/STATE.json')
  // Historical validator identity only, not permission for a current request.
  const binding=JSON.parse(bindingBytes),protection={...inspectProtection({stage:'recovery-a02'}),head:JSON.parse(bindingBytes).head},billing={policy:BILLING_POLICY,
    checkedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+60000).toISOString()}
  const review={status:'PASS',scope:'REAL_INPUT_FIRST_SEND',head:protection.head,bindingSha:sha256(bindingBytes),billingEvidenceSha:sha256(JSON.stringify(billing)),
    sources:protection.sources.map(s=>({path:s.path,sha256:s.workingSha256}))}
  const normal={bindingBytes,binding,protection,review,billing}
  assert.equal(verifySendApproval(normal),true)
  assert.throws(()=>verifySendApproval({...normal,review:{...review,status:'BLOCKED'}}),/REVIEW_STATUS/)
  assert.throws(()=>verifySendApproval({...normal,review:{...review,bindingSha:'0'.repeat(64)}}),/SEND_APPROVAL/)
  const changedCode=structuredClone(protection);changedCode.sources[0].workingSha256='0'.repeat(64)
  assert.throws(()=>verifySendApproval({...normal,protection:changedCode}),/REVIEW_SHA/)
  const changedRequest=structuredClone(binding);changedRequest.requests.A01=changedRequest.requests.A02
  assert.throws(()=>verifySendApproval({...normal,binding:changedRequest}),/SEND_UNIT_BINDING/)
  const changedDependency=structuredClone(binding);changedDependency.dependencies[0].sha256='0'.repeat(64)
  assert.throws(()=>verifySendApproval({...normal,binding:changedDependency}),/SCORER_LIST/)
  assert.throws(()=>verifySendApproval({...normal,billing:{...billing,policy:{...BILLING_POLICY,reservationMicroCny:1}}}),/SEND_APPROVAL/)
})
test('binding ties each actual prepared source to its database, unit and engineering carrier',()=>{
  const preparationFile=process.env.REAL_INPUT_PREPARATION_FILE,repositoryFile=process.env.REAL_INPUT_REPOSITORY_FILE
  assert.ok(preparationFile&&repositoryFile,'explicit new browser evidence paths are required')
  const preparation=JSON.parse(readFileSync(preparationFile)),read=JSON.parse(readFileSync(repositoryFile)),carriers=JSON.parse(readFileSync(carrierManifest))
  const input=i=>{const item=preparation.preparations[i],carrier=carriers.records[i%8]
    return {item,source:read.workspace.sources.find(s=>s.id===item.handle.sourceId),read,id:item.unitId,carrier,caseName:carrier.caseName,notice:carrier.sourceText}}
  for(let i=0;i<16;i++)assert.doesNotThrow(()=>verifyPreparedUnitIdentity(input(i)))
  const renamed=structuredClone(input(0));renamed.read.name+='-renamed'
  assert.throws(()=>verifyPreparedUnitIdentity(renamed),/ACTUAL_DATABASE_ID/)
  const copied=structuredClone(input(8));copied.id='B02';copied.item.unitId='B02'
  assert.throws(()=>verifyPreparedUnitIdentity(copied),/UNIT_SOURCE_IDENTITY/)
  const wrongFile=structuredClone(input(9));wrongFile.item.reading.inputReceipt.file=structuredClone(input(8).item.reading.inputReceipt.file)
  assert.throws(()=>verifyPreparedUnitIdentity(wrongFile),/ACTUAL_CARRIER_IDENTITY/)
  const wrongCase=structuredClone(input(9));wrongCase.carrier.caseName='multi'
  assert.throws(()=>verifyPreparedUnitIdentity(wrongCase),/CARRIER_CASE_IDENTITY/)
})
test('local real App serves exact assets, rejects secret paths and unbound endpoints, and retains normal replay',async t=>{
  const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve))
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve))
  const {server,evidence}=await createLocalApp({port,carrierManifest})
  t.after(()=>new Promise(resolve=>server.close(resolve)))
  const origin='http://127.0.0.1:'+port
  await t.test('real App bundle; no upstream sender or emitted engineering answers',async()=>{
    assert.equal(evidence.realApp,true);assert.equal(evidence.upstreamEnabled,false)
    assert.deepEqual(evidence.forbiddenBrowserInputs,[]);assert.equal(evidence.carriers,8)
    const response=await fetch(origin+'/');assert.equal(response.status,200)
    assert.match(await response.text(),/browser\.js/)
    const script=await (await fetch(origin+'/browser.js')).text()
    assert.doesNotMatch(script,/function artificialResponse|function engineeringReply|function engineeringReceipt/)
    assert.doesNotMatch(script,/DEEPSEEK_API_KEY|Bearer sk-/)
  })
  await t.test('secret, root traversal and unregistered paths are not a static file server',async()=>{
    for(const path of ['/.env','/.dev.vars','/package.json','/src/App.tsx','/real-input-assets/../../../.env','/%2eenv'])
      assert.equal((await fetch(origin+path)).status,400,path)
  })
  await t.test('cross-origin, host substitution and wrong session capability reject',async()=>{
    assert.equal((await fetch(origin+'/browser.js',{headers:{Origin:'http://attacker.invalid'}})).status,400)
    // Undici normalizes Host; node:http preserves the malicious header on wire.
    const hostStatus=await new Promise((resolve,reject)=>{
      const req=request(origin+'/',{headers:{Host:'attacker.invalid'}},res=>{res.resume();resolve(res.statusCode)})
      req.on('error',reject);req.end()
    })
    assert.equal(hostStatus,400)
    assert.equal((await fetch(origin+'/api/real-input/replay',{method:'POST',headers:{Origin:origin,'Sec-Fetch-Site':'same-origin',
      'Content-Type':'application/json','X-Real-Input-Capability':'0'.repeat(64)},body:'{}'})).status,400)
  })
  await t.test('live endpoint is unavailable in explicit zero-call mode',async()=>{
    assert.equal((await fetch(origin+'/api/real-input/recognize',{method:'POST',body:'{}'})).status,400)
  })
  await t.test('valid known engineering source returns labelled replay, unknown source does not fallback',async()=>{
    const script=await(await fetch(origin+'/browser.js')).text(),capability=script.match(/capability:\s*"([a-f0-9]{64})"/)?.[1]
    assert.ok(capability,'public session capability exists; it is not provider credential')
    const bundle=await build({stdin:{contents:"export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts'; export {notices} from './src/experiments/realInput01/seenInputs.ts'",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',target:'node24'})
    const {indexImmutableScopesV11,notices}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'))
    const send=async text=>fetch(origin+'/api/real-input/replay',{method:'POST',headers:{Origin:origin,'Sec-Fetch-Site':'same-origin',
      'Content-Type':'application/json','X-Real-Input-Capability':capability},body:JSON.stringify({index:await indexImmutableScopesV11('engineering-source','engineering-version',text),
      referenceTime:'2026-09-07T00:00:00.000Z',timezone:'Asia/Shanghai'})})
    const response=await send(notices['no-date']);assert.equal(response.status,200)
    const value=await response.json();assert.equal(value.label,'seen_engineering_replay');assert.equal(typeof value.rawHttpText,'string')
    assert.equal((await send('这不是登记的旧工程通知。')).status,400)
  })
})
