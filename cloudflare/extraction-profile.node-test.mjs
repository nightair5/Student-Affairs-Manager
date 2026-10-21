import test from 'node:test'
import assert from 'node:assert/strict'
import {extractionProfile,extractionRequestOptions} from './extraction-profile.mjs'
import {recognitionOutputSchema as full,productGenerationContract as original} from './recognition-product-contract-v1-5.mjs'
import {recognitionOutputSchema as restored,productGenerationContract as compactFull} from './recognition-product-contract-v1-15b.mjs'
import {createHash} from 'node:crypto'
import {createWorker} from './worker.mjs'
import {normalizeRecognitionResult,recognitionSystemPrompt} from './recognition.mjs'
test('actual Worker applies each server profile and refuses client model selection',async()=>{
 let i=0
 for(const [model,thinking,version,tokens] of [['deepseek-v4-flash','disabled','1.5',16384],['deepseek-v4-flash','disabled','1.15b',16384],['deepseek-v4-pro','disabled','1.5',16384],['deepseek-v4-flash','enabled','1.5',32768]]){
  const prompt='recognition-product-contract-'+version+'.0',origin='http://127.0.0.1:'+(7410+i++),source='请提交读书报告。';let sent
  const raw=normalizeRecognitionResult({schemaVersion:'2.0',sourceSummary:{title:'报告',sourceType:'text',summary:source,requiresAction:true},standaloneTasks:[{tempId:'T',actionVerb:'提交',actionObject:'读书报告',title:'提交读书报告',evidenceIds:['E']}],evidence:[{id:'E',quote:source,field:'description'}]},source,'2026-10-21T00:00:00+08:00',model,prompt)
  const worker=createWorker({fetcher:async(_,init)=>{sent=JSON.parse(init.body);return Response.json({choices:[{message:{content:JSON.stringify(raw)},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1}})},logger:()=>{}})
  const response=await worker.fetch(new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({content:source,sourceType:'text',referenceTime:'2026-10-21T00:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'server-only-test-key',ALLOWED_ORIGINS:origin,DEEPSEEK_PRODUCT_CONTRACT_VERSION:prompt,DEEPSEEK_EXTRACTION_MODEL:model,DEEPSEEK_EXTRACTION_THINKING:thinking,DEEPSEEK_EXTRACTION_MAX_TOKENS:tokens})
  assert.equal(response.status,200);assert.equal(sent.model,model);assert.equal(sent.thinking.type,thinking);assert.equal(sent.max_tokens,tokens)
  assert.equal(sent.temperature,thinking==='enabled'?undefined:.1);assert.equal(sent.messages[0].content,recognitionSystemPrompt({modelName:model,productContract:true,promptVersion:prompt}))
 }
})
test('default and explicit server model profiles preserve Flash; thinking never sends ignored sampling',()=>{
 assert.deepEqual(extractionRequestOptions(extractionProfile()),{model:'deepseek-v4-flash',thinking:{type:'disabled'},temperature:.1,max_tokens:6000,response_format:{type:'json_object'}})
 assert.equal(extractionProfile({DEEPSEEK_EXTRACTION_MODEL:'client-injected'}).model,'deepseek-v4-flash')
 const pro=extractionProfile({DEEPSEEK_EXTRACTION_MODEL:'deepseek-v4-pro',DEEPSEEK_EXTRACTION_MAX_TOKENS:16384})
 assert.equal(pro.model,'deepseek-v4-pro');assert.equal(pro.timeoutMs,180000)
 const thinking=extractionRequestOptions(extractionProfile({DEEPSEEK_EXTRACTION_THINKING:'enabled',DEEPSEEK_EXTRACTION_MAX_TOKENS:999999}))
 assert.equal(thinking.max_tokens,32768);assert.equal(thinking.reasoning_effort,'high');assert.equal(Object.hasOwn(thinking,'temperature'),false)
})
test('1.15b restores the entire authoritative Schema without mutating frozen 1.5',()=>{
 const expected=structuredClone(full);expected.properties.promptVersion.const='recognition-product-contract-1.15b.0'
 assert.deepEqual(restored,expected);assert.notEqual(restored,full)
 assert.equal(compactFull().split(JSON.stringify(restored)).length,2)
 assert.equal(full.properties.promptVersion.const,'recognition-product-contract-1.5.0')
 assert.equal(createHash('sha256').update(original()).digest('hex'),'97ba0826ec3bfa6aa45205b08995046689c1979fa5ca1b4fc888636807bd09fe')
})
