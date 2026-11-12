import test from 'node:test'
import assert from 'node:assert/strict'
import {decodeSemanticNoticeOutput} from './recognition-output-recovery.mjs'
import {createWorker} from './worker.mjs'
import {safeSemanticExecution} from './semantic-notice-generation-v3.mjs'

const source='校园开放日于12月4日举行，请填写报名表。'
const first={key:'event',kind:'event',title:'校园开放日',evidence:['校园开放日于12月4日举行']}
const second={key:'form',kind:'task',title:'填写报名表',action:'填写',object:'报名表',evidence:['请填写报名表']}
const root={topic:'校园开放日',kind:'mixed',items:[first,second],materials:[]}
const truncated=()=>{const body=JSON.stringify(root);return body.slice(0,body.indexOf('"key":"form"')+15)}

test('truncated semantic response preserves only fully closed items and marks missing materials as partial',()=>{
  const decoded=decodeSemanticNoticeOutput(truncated(),{finishReason:'length'})
  assert.equal(decoded.error,null)
  assert.deepEqual(decoded.value.items,[first])
  assert.deepEqual(decoded.value.materials,[])
  assert.equal(decoded.value.partial,true)
  assert.equal(decoded.audit.partial,true)
  assert(decoded.audit.missingFields.includes('materials'))
  assert.equal(decoded.audit.inferredFacts,0)
})

test('valid semantic JSON missing the material container remains explicitly partial',()=>{
  const {materials,...withoutMaterials}=root
  assert.deepEqual(materials,[])
  const decoded=decodeSemanticNoticeOutput(JSON.stringify(withoutMaterials),{finishReason:'stop'})
  assert.deepEqual(decoded.value.items,root.items)
  assert.deepEqual(decoded.value.materials,[])
  assert.equal(decoded.value.partial,true)
  assert.equal(decoded.audit.reason,'MATERIALS_FIELD_MISSING')
  assert(decoded.audit.missingFields.includes('materials'))
  const missingItems=decodeSemanticNoticeOutput(JSON.stringify({topic:'校园开放日',kind:'event'}),{finishReason:'stop'})
  assert.equal(missingItems.value.materials,undefined)
})

test('semantic recovery does not fabricate missing or malformed roots, items, materials or recover malformed stop responses',()=>{
  for(const [content,reason] of [
    [truncated(),'stop'],
    ['{"topic":"事项","kind":"mixed","items":[{"key":"unfinished','length'],
    ['{"topic":"事项","kind":"mixed","materials":"bad","items":[{"key":"ok","kind":"task","title":"做事"},{"unfinished','length'],
    ['{"topic":"事项","topic":"重复","kind":"mixed","items":[{"key":"ok","kind":"task","title":"做事"},{"unfinished','length'],
    ['前言'+truncated(),'length'],
  ])assert.equal(decodeSemanticNoticeOutput(content,{finishReason:reason}).value,null)
})

test('empty JSON-mode model content is distinguished from a malformed document',()=>{
  const decoded=decodeSemanticNoticeOutput('  \n ',{finishReason:'stop'})
  assert.equal(decoded.value,null)
  assert.equal(decoded.error,'MODEL_OUTPUT_EMPTY')
  assert.equal(decodeSemanticNoticeOutput(null,{finishReason:'stop'}).error,'MODEL_OUTPUT_MISSING')
})

test('rejected semantic results retain only safe, observable billing metadata',()=>{
  const execution={generationMode:'semantic-notice-3.11',promptVersion:'recognition-semantic-notice-3.11.0',twoStep:{compilerVersion:'compiler-1',losses:['private']},modelFactSamples:[{status:200,actualModel:'observed-flash',elapsedMs:4,facts:{content:'private source'},usage:{prompt_tokens:100,completion_tokens:50,total_tokens:150,private:'hidden'}}],networkAttempts:[{status:200}]}
  const observed=safeSemanticExecution(execution)
  assert.deepEqual(observed.modelFactSamples[0].usage,{prompt_tokens:100,completion_tokens:50,total_tokens:150})
  assert.deepEqual(observed.tokenUsage,{input:100,output:50,total:150})
  assert.doesNotMatch(JSON.stringify(observed),/private|hidden/u)
  execution.networkAttempts=[{status:null},{status:200}]
  execution.upstreamUsageComplete=false
  const uncertain=safeSemanticExecution(execution)
  assert.equal(uncertain.modelFactSamples[0].usage,null)
  assert.equal(uncertain.tokenUsage,null)
})

test('worker returns a source-validated partial result and observed usage without a second upstream request',async()=>{
  let count=0
  const worker=createWorker({fetcher:async()=>{count++;return Response.json({model:'observed-flash',choices:[{finish_reason:'length',message:{content:truncated()}}],usage:{prompt_tokens:100,completion_tokens:200,total_tokens:300}})}})
  const response=await worker.fetch(new Request('https://local.test/api/deepseek/extract',{method:'POST',headers:{origin:'https://local.test','content-type':'application/json','x-student-affairs-recognition':'semantic-notice-3.11'},body:JSON.stringify({sourceType:'text',content:source,referenceTime:'2026-11-01T09:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',ALLOWED_ORIGINS:'https://local.test',DEEPSEEK_GENERATION_MODE:'semantic-notice-3.0'})
  const body=await response.json()
  assert.equal(count,1)
  assert.equal(response.status,200,JSON.stringify(body))
  assert.equal(body.result.events.length,1)
  assert.equal(body.result.standaloneTasks.length,0)
  assert.equal(body.result.quality.needsHumanReview,true)
  assert.equal(body.execution.modelFactSamples[0].truncated,true)
  assert.equal(body.execution.modelFactSamples[0].usage.completion_tokens,200)
})

test('missing material container is reported as partial without claiming truncation',async()=>{
  const {materials,...withoutMaterials}=root
  assert.deepEqual(materials,[])
  const worker=createWorker({fetcher:async()=>Response.json({model:'observed-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify(withoutMaterials)}}],usage:{prompt_tokens:100,completion_tokens:200}})})
  const response=await worker.fetch(new Request('https://local.test/api/deepseek/extract',{method:'POST',headers:{origin:'https://local.test','content-type':'application/json','x-student-affairs-recognition':'semantic-notice-3.11'},body:JSON.stringify({sourceType:'text',content:source,referenceTime:'2026-11-01T09:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',ALLOWED_ORIGINS:'https://local.test',DEEPSEEK_GENERATION_MODE:'semantic-notice-3.0'})
  const body=await response.json()
  assert.equal(response.status,200,JSON.stringify(body))
  assert.equal(body.result.quality.needsHumanReview,true)
  assert.equal(body.execution.modelFactSamples[0].truncated,false)
  assert.equal(body.execution.modelFactSamples[0].outputRecovery.reason,'MATERIALS_FIELD_MISSING')
})

test('an empty JSON-mode response fails transparently but still reports observed usage',async()=>{
  let count=0
  const worker=createWorker({fetcher:async()=>{count++;return Response.json({model:'observed-flash',choices:[{finish_reason:'stop',message:{content:'   '}}],usage:{prompt_tokens:100,completion_tokens:20}})}})
  const response=await worker.fetch(new Request('https://local.test/api/deepseek/extract',{method:'POST',headers:{origin:'https://local.test','content-type':'application/json','x-student-affairs-recognition':'semantic-notice-3.11'},body:JSON.stringify({sourceType:'text',content:source,referenceTime:'2026-11-01T09:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',ALLOWED_ORIGINS:'https://local.test',DEEPSEEK_GENERATION_MODE:'semantic-notice-3.0'})
  const body=await response.json()
  assert.equal(count,1);assert.equal(response.status,502)
  assert.equal(body.failureReason,'MODEL_OUTPUT_EMPTY')
  assert.equal(body.execution.modelFactSamples[0].usage.completion_tokens,20)
  assert.equal(body.result,undefined)
})

test('an earlier uncertain send cannot be misreported as fully metered when the later response fails decoding',async()=>{
  let count=0
  const worker=createWorker({fetcher:async()=>{count++;if(count===1)throw new TypeError('synthetic connection failure');return Response.json({model:'observed-flash',choices:[{finish_reason:'stop',message:{content:'   '}}],usage:{prompt_tokens:100,completion_tokens:20}})}})
  const response=await worker.fetch(new Request('https://local.test/api/deepseek/extract',{method:'POST',headers:{origin:'https://local.test','content-type':'application/json','x-student-affairs-recognition':'semantic-notice-3.11'},body:JSON.stringify({sourceType:'text',content:source,referenceTime:'2026-11-01T09:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',ALLOWED_ORIGINS:'https://local.test',DEEPSEEK_GENERATION_MODE:'semantic-notice-3.0',DEEPSEEK_NETWORK_RETRY:'1'})
  const body=await response.json()
  assert.equal(count,2);assert.equal(response.status,502)
  assert.equal(body.execution.modelFactSamples[0].usage,null)
  assert.equal(body.execution.tokenUsage,null)
})

test('an earlier uncertain send remains unmetered even if the later response is valid',async()=>{
  let count=0
  const worker=createWorker({fetcher:async()=>{count++;if(count===1)throw new TypeError('synthetic connection failure');return Response.json({model:'observed-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify(root)}}],usage:{prompt_tokens:100,completion_tokens:20}})}})
  const response=await worker.fetch(new Request('https://local.test/api/deepseek/extract',{method:'POST',headers:{origin:'https://local.test','content-type':'application/json','x-student-affairs-recognition':'semantic-notice-3.11'},body:JSON.stringify({sourceType:'text',content:source,referenceTime:'2026-11-01T09:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',ALLOWED_ORIGINS:'https://local.test',DEEPSEEK_GENERATION_MODE:'semantic-notice-3.0',DEEPSEEK_NETWORK_RETRY:'1'})
  const body=await response.json()
  assert.equal(count,2);assert.equal(response.status,200)
  assert.equal(body.execution.modelFactSamples[0].usage,null)
  assert.equal(body.execution.modelFactSamples[0].observedUsageForLastResponse.completion_tokens,20)
  assert.equal(body.execution.tokenUsage,null)
  assert.equal(body.execution.upstreamUsageComplete,false)
})

test('diagnostic logs distinguish observed failure tokens from unknown usage without logging content',async()=>{
  const entries=[],oldInfo=console.info,oldLog=console.log
  console.info=value=>entries.push(value);console.log=()=>{}
  try {
    for(const usage of [{prompt_tokens:100,completion_tokens:20},undefined]){
      const worker=createWorker({fetcher:async()=>Response.json({model:'observed-flash',choices:[{finish_reason:'stop',message:{content:'   '}}],usage})})
      await worker.fetch(new Request('https://local.test/api/deepseek/extract',{method:'POST',headers:{origin:'https://local.test','content-type':'application/json','x-student-affairs-recognition':'semantic-notice-3.11'},body:JSON.stringify({sourceType:'text',content:source,referenceTime:'2026-11-01T09:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',ALLOWED_ORIGINS:'https://local.test',DEEPSEEK_GENERATION_MODE:'semantic-notice-3.0'})
    }
    assert.equal(entries[0].outputTokens,20)
    assert.equal(entries[1].outputTokens,null)
    assert.doesNotMatch(JSON.stringify(entries),/校园开放日|SYNTHETIC_TEST_PLACEHOLDER/u)
  } finally {console.info=oldInfo;console.log=oldLog}
})
