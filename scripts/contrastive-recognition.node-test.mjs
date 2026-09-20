import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {inspectRequest,createModelGateway} from './real-input-model-gateway.mjs'
import {CONTRASTIVE_POLICY,CONTRASTIVE_BASELINE_POLICY,CONTRASTIVE_CANDIDATE_POLICY,contrastivePolicyFor,openBudget,RECOVERY_ROUTE,sha256} from './real-input-budget.mjs'
import {contrastiveOrder} from './run-contrastive-recognition.mjs'
import {scoreContrastiveCase,aggregateContrastiveScores} from './score-contrastive-recognition.mjs'

const run='docs/recognition-optimization/mainline-real-input-01/runs',prepared=run+'/opensource-methods-20260920a/prepared',ledgerDir=run+'/usage-resume-20260907a'

test('frozen candidate03/candidate10 requests keep one input and differ by candidate identity',()=>{
  const rows=JSON.parse(readFileSync(prepared+'/REQUESTS.json')),order=contrastiveOrder()
  assert.equal(order.filter(pair=>pair[0]==='A').length,6)
  for(let index=0;index<12;index++){
    const pair=rows.filter(row=>row.id===`OS${String(index+1).padStart(2,'0')}`),a=pair.find(row=>row.arm==='baseline'),b=pair.find(row=>row.arm==='contrastive')
    const ai=inspectRequest(JSON.stringify(a.body),CONTRASTIVE_BASELINE_POLICY),bi=inspectRequest(JSON.stringify(b.body),CONTRASTIVE_CANDIDATE_POLICY)
    assert.equal(ai.inputSha,bi.inputSha);assert.notEqual(ai.candidateSha,bi.candidateSha);assert.equal(contrastivePolicyFor(`K${String(index+1).padStart(2,'0')}-A`),CONTRASTIVE_BASELINE_POLICY)
  }
})

test('semantic checklist distinguishes a complete property case from an extra invented task',()=>{
  const deliver={id:'deliver',action:{surface:'交'},object:{surface:'校史照片'},detail:{title:'交校史照片',description:'',dependencyTempIds:[],timePointTempIds:[]},semantics:{validity:'active',status:'pending',polarity:'affirmative'},condition:{value:'not_applicable'}}
  const perfect={tasks:[deliver],materials:[{name:'防潮盒',relatedTaskTempIds:['deliver']}],timePoints:[],revisions:[]}
  assert.equal(scoreContrastiveCase('OS01',perfect).complete,true)
  const bad=structuredClone(perfect);bad.tasks.push({...deliver,id:'buy',action:{surface:'购买'},object:{surface:'防潮盒'},detail:{...deliver.detail,title:'购买防潮盒'}})
  assert.equal(scoreContrastiveCase('OS01',bad).complete,false)
  const summary=aggregateContrastiveScores([{id:'OS01',arm:'A',assembled:perfect},{id:'OS01',arm:'B',assembled:bad}])
  assert.equal(summary.arms.A.completeCaseRate,1);assert.equal(summary.arms.B.completeCaseRate,0)
})

test('gateway accepts a K unit only through the contrastive policy and settles returned usage',async()=>{
  const row=JSON.parse(readFileSync(prepared+'/REQUESTS.json')).find(value=>value.id==='OS01'&&value.arm==='baseline'),body=JSON.stringify(row.body),identity=inspectRequest(body,CONTRASTIVE_BASELINE_POLICY)
  let completed=0,recorded=0
  const envelope={object:'response',status:'completed',model:'deepseek-flash',id:'contrastive_gateway_response',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:20,output_tokens_details:{reasoning_tokens:0},total_tokens:120},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{}'}]}]}
  const gateway=await createModelGateway({origin:'http://127.0.0.1:6631',capability:'a'.repeat(64),requests:{'K01-A':body},policy:CONTRASTIVE_POLICY,
    budget:{snapshot:async()=>({units:[{unitId:'K01-A',...identity}]}),reserve:async(id,text,policy)=>{assert.equal(id,'K01-A');assert.equal(text,body);assert.equal(policy,CONTRASTIVE_BASELINE_POLICY);return{complete:async()=>{completed++;return{usage:envelope.usage,costUpperMicroCny:360}},uncertain:async()=>{throw Error('UNEXPECTED')}}}},
    readSecret:()=> 'NOT_A_REAL_CREDENTIAL_FOR_ENGINEERING',fetchImpl:async()=>new Response(JSON.stringify(envelope),{status:200,headers:{'content-type':'application/json'}}),recordRaw:async row=>{recorded++;assert.equal(row.unitId,'K01-A')}})
  const result=await gateway.handle({method:'POST',path:'/api/real-input/recognize',headers:{host:'127.0.0.1:6631',origin:'http://127.0.0.1:6631','sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':'a'.repeat(64)},bodyText:JSON.stringify({unitId:'K01-A',requestSha:identity.requestSha})})
  assert.equal(result.status,200);assert.equal(completed,1);assert.equal(recorded,1)
})

test('new 314-call budget grant binds and settles after the existing 290 calls in an isolated ledger clone',async()=>{
  const temp=mkdtempSync(join(tmpdir(),'contrastive-budget-'))
  try{
    const lockRoot=join(temp,'control'),records=join(lockRoot,'records');mkdirSync(lockRoot);mkdirSync(records)
    const manifest=JSON.parse(readFileSync(ledgerDir+'/REQUEST_MANIFEST.json'));manifest.lockRoot=lockRoot
    const manifestText=JSON.stringify(manifest,null,2)+'\n',manifestSha=sha256(manifestText);writeFileSync(temp+'/REQUEST_MANIFEST.json',manifestText)
    const original=readFileSync(ledgerDir+'/CALL_LEDGER.jsonl','utf8').trimEnd().split('\n').map(JSON.parse),lines=[];let previous='0'.repeat(64)
    for(const [sequence,source] of original.entries()){const event=structuredClone(source.event);if(sequence===0)event.manifestSha=manifestSha
      if(event.grant){event.grant.manifestSha=manifestSha;event.grant.parentTail=previous;event.grant.ledgerPrefixSha=sha256(Buffer.from(lines.map(line=>JSON.stringify(line)).join('\n')+(lines.length?'\n':'')))}
      const data={sequence,previous,event},line={...data,hash:sha256(JSON.stringify(data))};lines.push(line);writeFileSync(join(records,String(sequence).padStart(8,'0')+'.json'),JSON.stringify(line));previous=line.hash}
    const ledger=Buffer.from(lines.map(line=>JSON.stringify(line)).join('\n')+'\n');writeFileSync(temp+'/CALL_LEDGER.jsonl',ledger)
    const rows=JSON.parse(readFileSync(prepared+'/REQUESTS.json')),targets=[]
    for(let index=0;index<12;index++)for(const arm of (index<6?['A','B']:['B','A'])){const sourceArm=arm==='A'?'baseline':'contrastive',row=rows.find(value=>value.id===`OS${String(index+1).padStart(2,'0')}`&&value.arm===sourceArm),unitId=`K${String(index+1).padStart(2,'0')}-${arm}`,identity=inspectRequest(JSON.stringify(row.body),contrastivePolicyFor(unitId));targets.push({unitId,candidateSha:identity.candidateSha,requestSha:identity.requestSha,inputSha:identity.inputSha,scorerSha:'1'.repeat(64),requestBytes:identity.requestBytes})}
    const now=new Date(),grant={version:'real-input-contrastive-grant-1',grantId:randomUUID(),parentTail:lines[594].hash,parentSequence:595,ledgerPrefixBytes:ledger.length,ledgerPrefixSha:sha256(ledger),manifestSha,bindingSha:'2'.repeat(64),head:'3'.repeat(40),sourcesSha:'4'.repeat(64),reviewSha:'5'.repeat(64),targets,
      billingEvidence:{checkedAt:new Date(now.getTime()-1000).toISOString(),validUntil:new Date(now.getTime()+60000).toISOString(),evidenceSha:'6'.repeat(64)},route:RECOVERY_ROUTE,priorNonce:lines[1].event.nonce,a02ResponseSha:lines[4].event.responseSha,maxTotalRequests:314,policy:CONTRASTIVE_POLICY}
    const budget=await openBudget(temp,manifestSha,{batchGrant:grant}),before=await budget.snapshot();assert.equal(before.reservations.length,290);assert.equal(before.units.at(-24).unitId,targets[0].unitId);assert.equal(before.contrastive,undefined)
    const request=rows.find(value=>value.id==='OS01'&&value.arm==='baseline'),lease=await budget.reserve('K01-A',JSON.stringify(request.body),CONTRASTIVE_BASELINE_POLICY,now.toISOString())
    const raw=JSON.stringify({object:'response',status:'completed',model:'deepseek-flash',id:'contrastive_budget_response',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:20,output_tokens_details:{reasoning_tokens:0},total_tokens:120},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{}'}]}]})
    await lease.complete(raw,200);const after=await budget.snapshot();assert.equal(after.reservations.length,291);assert.equal(after.reservations.at(-1).status,'settled');assert.equal(after.contrastive.stopped,false)
  }finally{rmSync(temp,{recursive:true,force:true})}
})
