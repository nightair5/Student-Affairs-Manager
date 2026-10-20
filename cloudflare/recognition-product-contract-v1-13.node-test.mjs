import test from 'node:test'
import assert from 'node:assert/strict'
import {recognitionOutputSchema as previous,productGenerationContract as previousContract} from './recognition-product-contract-v1-5.mjs'
import {recognitionOutputSchema as next,productGenerationContract} from './recognition-product-contract-v1-13.mjs'
import {PRODUCT_CONTRACT_PROMPT_VERSION,productGenerationSchema,productGenerationContract as select} from './recognition-output-contract.mjs'
import {createWorker} from './worker.mjs'
import {normalizeRecognitionResult,recognitionSystemPrompt} from './recognition.mjs'

test('entity-first hypothesis changes output sequence only and leaves1.5 default bytes intact',()=>{
  const restored=structuredClone(next)
  restored.properties=Object.fromEntries(Object.keys(previous.properties).map(key=>[key,restored.properties[key]]))
  restored.properties.promptVersion.const=previous.properties.promptVersion.const
  restored.required=previous.required
  assert.deepEqual(restored,previous)
  assert.equal(Object.keys(next.properties).at(-1),'sourceSummary')
  const back=productGenerationContract().replace(JSON.stringify(next),JSON.stringify(previous)).replace(`同一个JSON对象的顶层顺序为${Object.keys(next.properties).join(',')}。`,`同一个JSON对象的顶层顺序为${Object.keys(previous.properties).join(',')}。`)
  assert.equal(back,previousContract())
  assert.equal(PRODUCT_CONTRACT_PROMPT_VERSION,'recognition-product-contract-1.5.0')
  assert.equal(select(),previousContract());assert.equal(productGenerationSchema('recognition-product-contract-1.13.0'),next)
  assert.equal(productGenerationContract().split(JSON.stringify(next)).length,2)
  assert.doesNotMatch(productGenerationContract(),/条件义务的生成顺序：|REAL-SHORT|DEV-|Expected/u)
})

test('actual Worker selects only explicit1.13, preserves unknown obligation and ordinary control selection',async()=>{
  for(const conditional of [true,false]){
    const source=conditional?'获批者请提交研究申请书，本人获批情况未知。':'请提交研究申请书。',referenceTime='2027-05-01T09:00:00+08:00',version='recognition-product-contract-1.13.0'
    let sent
    const raw=normalizeRecognitionResult({schemaVersion:'2.0',sourceSummary:{title:'研究申请',sourceType:'text',summary:source,requiresAction:true},standaloneTasks:[{tempId:'T',title:'提交研究申请书',actionVerb:'提交',actionObject:'研究申请书',evidenceIds:['E'],selected:!conditional}],evidence:[{id:'E',quote:source,field:'requirement'}]},source,referenceTime,'deepseek-v4-flash',version)
    const worker=createWorker({logger:()=>{},fetcher:async(_,init)=>{sent=JSON.parse(init.body);return Response.json({choices:[{message:{content:JSON.stringify(raw)},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}})}})
    const res=await worker.fetch(new Request('http://127.0.0.1:7260/api/deepseek/extract',{method:'POST',headers:{origin:'http://127.0.0.1:7260','content-type':'application/json'},body:JSON.stringify({content:source,referenceTime,timezone:'Asia/Shanghai',sourceType:'text'})}),{DEEPSEEK_API_KEY:'test-only-no-live-value',ALLOWED_ORIGINS:'http://127.0.0.1:7260',DEEPSEEK_PRODUCT_CONTRACT_VERSION:version,DEEPSEEK_EXTRACTION_MAX_TOKENS:16384})
    const body=await res.json();assert.equal(res.status,200,JSON.stringify(body));assert.equal(body.result.standaloneTasks[0].selected,!conditional)
    assert.equal(sent.messages[0].content,recognitionSystemPrompt({modelName:'deepseek-v4-flash',productContract:true,promptVersion:version}));assert.equal(sent.max_tokens,16384)
  }
})

test('sequence experiment does not construct a task from an information-only cancellation',()=>{
  const source='原研究申请已取消，不必再提交。',r=normalizeRecognitionResult({schemaVersion:'2.0',sourceSummary:{title:'申请取消',sourceType:'text',summary:source,requiresAction:false},standaloneTasks:[],evidence:[{id:'E',quote:source,field:'requirement'}]},source,'2027-05-01T09:00:00+08:00','deepseek-v4-flash','recognition-product-contract-1.13.0')
  assert.equal(r.standaloneTasks.length,0);assert.equal(r.sourceSummary.requiresAction,false)
})
