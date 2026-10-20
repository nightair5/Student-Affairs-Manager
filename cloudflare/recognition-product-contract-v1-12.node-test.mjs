import test from 'node:test'
import assert from 'node:assert/strict'
import {recognitionOutputSchema as previous,productGenerationContract as previousContract} from './recognition-product-contract-v1-5.mjs'
import {recognitionOutputSchema as next,productGenerationContract,CONDITIONAL_OBLIGATION_DECISION} from './recognition-product-contract-v1-12.mjs'
import {PRODUCT_CONTRACT_PROMPT_VERSION,productGenerationSchema,productGenerationContract as selected} from './recognition-output-contract.mjs'
import {createWorker} from './worker.mjs'
import {normalizeRecognitionResult,recognitionSystemPrompt} from './recognition.mjs'

test('conditional experiment stays opt-in and preserves all 1.5 fields and instruction bytes',()=>{
  const same=structuredClone(next);same.properties.promptVersion.const=previous.properties.promptVersion.const
  assert.deepEqual(same,previous)
  assert.equal(productGenerationContract().replace(JSON.stringify(next),JSON.stringify(previous)),previousContract()+'\n'+CONDITIONAL_OBLIGATION_DECISION)
  assert.equal(PRODUCT_CONTRACT_PROMPT_VERSION,'recognition-product-contract-1.5.0')
  assert.equal(selected(),previousContract());assert.equal(productGenerationSchema('recognition-product-contract-1.12.0'),next)
  assert.equal(productGenerationContract().split(JSON.stringify(next)).length,2)
  assert.doesNotMatch(CONDITIONAL_OBLIGATION_DECISION,/REAL-SHORT|DEV-|R2-RES|Expected/u)
})

test('Worker explicitly selects the experimental schema and keeps unknown applicability unselected',async()=>{
  const text='只有获批者需要提交研究申请书，本人获批情况未知。',referenceTime='2027-05-01T09:00:00+08:00';let sent
  const raw=normalizeRecognitionResult({schemaVersion:'2.0',sourceSummary:{title:'研究申请',sourceType:'text',summary:text,requiresAction:true},standaloneTasks:[{tempId:'T',title:'提交研究申请书',actionVerb:'提交',actionObject:'研究申请书',evidenceIds:['E'],selected:false}],evidence:[{id:'E',quote:text,field:'requirement'}]},text,referenceTime,'deepseek-v4-flash','recognition-product-contract-1.12.0')
  const worker=createWorker({logger:()=>{},fetcher:async(_,init)=>{sent=JSON.parse(init.body);return Response.json({choices:[{message:{content:JSON.stringify(raw)},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}})}})
  const res=await worker.fetch(new Request('http://127.0.0.1:7230/api/deepseek/extract',{method:'POST',headers:{origin:'http://127.0.0.1:7230','content-type':'application/json'},body:JSON.stringify({content:text,referenceTime,timezone:'Asia/Shanghai',sourceType:'text'})}),{DEEPSEEK_API_KEY:'server-only-test-key',ALLOWED_ORIGINS:'http://127.0.0.1:7230',DEEPSEEK_PRODUCT_CONTRACT_VERSION:'recognition-product-contract-1.12.0',DEEPSEEK_EXTRACTION_MAX_TOKENS:16384})
  const body=await res.json();assert.equal(res.status,200,JSON.stringify(body));assert.equal(body.result.standaloneTasks[0].selected,false)
  assert.equal(sent.messages[0].content,recognitionSystemPrompt({modelName:'deepseek-v4-flash',productContract:true,promptVersion:'recognition-product-contract-1.12.0'}));assert.equal(sent.max_tokens,16384)
})

test('a negative personal fact cannot be normalized into a selected obligation',async()=>{
  const text='入选者需要提交研究申请书，本人未入选。',raw=normalizeRecognitionResult({schemaVersion:'2.0',sourceSummary:{title:'研究申请',sourceType:'text',summary:text,requiresAction:true},standaloneTasks:[{tempId:'T',title:'提交研究申请书',actionVerb:'提交',actionObject:'研究申请书',evidenceIds:['E'],selected:false}],evidence:[{id:'E',quote:text,field:'requirement'}]},text,'2027-05-01T09:00:00+08:00','deepseek-v4-flash','recognition-product-contract-1.12.0')
  assert.equal(raw.standaloneTasks[0].selected,false)
  assert.equal(raw.evidence[0].quote,text)
})
