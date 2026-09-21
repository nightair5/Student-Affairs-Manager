import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {build} from 'esbuild'
import {createModelGateway,inspectRequest} from './real-input-model-gateway.mjs'
import {CONTRASTIVE_POLICY,CONTRASTIVE_CANDIDATE_POLICY} from './real-input-budget.mjs'
import {verifyProtectedFiles,HISTORY_DIRECTORY} from './verify-candidate11-analysis.mjs'

const bundled=await build({stdin:{contents:"export {buildCandidate11Request} from './src/experiments/realInput01/candidate11.ts'",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'})
const api=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].contents).toString('base64'))
const context=JSON.parse(readFileSync(HISTORY_DIRECTORY+'/BINDING_FINAL.json')).items[0].context
const request=await api.buildCandidate11Request(context,'V11'),identity=inspectRequest(request.serialized,CONTRASTIVE_CANDIDATE_POLICY)
const raw=JSON.stringify({object:'response',status:'completed',model:'deepseek-flash',id:'engineering-c11-only',
  usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:20,output_tokens_details:{reasoning_tokens:0},total_tokens:120},
  output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{}'}]}]})
const input={method:'POST',path:'/api/real-input/recognize',headers:{host:'127.0.0.1:6633',origin:'http://127.0.0.1:6633','sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':'c'.repeat(64)},
  bodyText:JSON.stringify({unitId:'K01-B',requestSha:identity.requestSha})}

async function fixture(failure='none') {
  const directory=mkdtempSync(join(tmpdir(),'c11-gateway-test-')),path=join(directory,'MOCK_LEDGER.json')
  const state={kind:'ENGINEERING_MOCK_NOT_REAL_BUDGET',reserved:0,settled:0,uncertain:0,transport:0,raw:0}
  const save=()=>writeFileSync(path,JSON.stringify(state));save()
  const budget={snapshot:async()=>({units:[{unitId:'K01-B',...identity}]}),reserve:async()=>{
    if(failure==='full'||state.reserved)throw Error('MOCK_BUDGET_EXHAUSTED_OR_ALREADY_RESERVED')
    state.reserved++;save();return{complete:async()=>{if(failure==='settlement')throw Error('MOCK_SETTLEMENT_FAILED');state.settled++;save();return{usage:JSON.parse(raw).usage,costUpperMicroCny:0}},
      uncertain:async()=>{state.uncertain++;save()}}
  }}
  const gateway=await createModelGateway({origin:'http://127.0.0.1:6633',capability:'c'.repeat(64),requests:{'K01-B':request.serialized},policy:CONTRASTIVE_POLICY,budget,
    readSecret:()=> 'ENGINEERING_PLACEHOLDER_NOT_A_REAL_SECRET',timeoutMs:failure==='timeout'?10:1000,
    fetchImpl:async()=>{state.transport++;save();if(failure==='transport')throw Error('MOCK_TRANSPORT');if(failure==='timeout')return new Promise(()=>{});return new Response(raw,{status:200,headers:{'content-type':'application/json'}})},
    recordRaw:async()=>{if(failure==='raw')throw Error('MOCK_RAW_STORAGE');state.raw++;save()}})
  return {gateway,state,directory,close:()=>rmSync(directory,{recursive:true,force:true})}
}
test('candidate11 is accepted by existing request inspection without changing gateway or policies',()=>{
  assert.equal(identity.requestSha,request.metadata.requestSha);assert.equal(identity.body.model,'deepseek-flash')
})
for(const failure of ['transport','timeout','raw','settlement','full'])test(`candidate11 mock ${failure} retains reserve and never auto-retries`,async()=>{
  const before=verifyProtectedFiles(),f=await fixture(failure)
  try{const r=await f.gateway.handle(input);assert.notEqual(r.status,200);assert.equal(f.state.settled,0)
    assert.equal(f.state.transport,failure==='full'?0:1);assert.equal(f.state.reserved,failure==='full'?0:1)
    if(failure!=='full')assert.equal(f.state.uncertain,1)
    assert.deepEqual(verifyProtectedFiles(),before)
  }finally{f.close()}
})
test('identity mismatch rejects before reservation and transport',async()=>{
  const f=await fixture();try{const r=await f.gateway.handle({...input,bodyText:JSON.stringify({unitId:'K01-B',requestSha:'0'.repeat(64)})})
    assert.equal(r.status,400);assert.equal(f.state.reserved,0);assert.equal(f.state.transport,0)
  }finally{f.close()}
})
test('repeated execution cannot reserve a settled engineering unit twice',async()=>{
  const f=await fixture();try{assert.equal((await f.gateway.handle(input)).status,200);assert.notEqual((await f.gateway.handle(input)).status,200)
    assert.equal(f.state.reserved,1);assert.equal(f.state.transport,1);assert.equal(f.state.settled,1)
  }finally{f.close()}
})
test('same gateway refuses concurrent writer while first request is outstanding',async()=>{
  const f=await fixture('timeout');try{const first=f.gateway.handle(input);const second=await f.gateway.handle(input)
    assert.equal(second.status,409);await first;assert.equal(f.state.reserved,1)
  }finally{f.close()}
})
