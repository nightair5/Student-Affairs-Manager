import test from 'node:test'
import assert from 'node:assert/strict'
import {themeExample,twoStepSystemPrompt,validateExampleAlignment,TWO_STEP_VERSION} from './recognition-two-step-contract-v2-4.mjs'
import {createWorker} from './worker.mjs'
import {twoStep21Request} from './two-step-generation-v2-1.mjs'
import {twoStepSystemPrompt as oldPrompt} from './recognition-two-step-contract-v2-3.mjs'

test('2.4 adds literal series and topic example without changing 2.3 prompt',()=>{
 assert.equal(validateExampleAlignment(),true);assert(twoStepSystemPrompt().length<=3000);assert.equal(TWO_STEP_VERSION,'recognition-two-step-2.4.0')
 const p=twoStep21Request({model:'deepseek-v4-flash',thinking:'disabled',maxOutputTokens:4096},'test','two-step-2.3');assert.equal(p.messages[0].content,oldPrompt())
})
test('2.4 selects new prompt and preserves topic in one event',async()=>{
 const [source,raw]=themeExample,origin='https://test.example',sent=[]
 const worker=createWorker({logger:()=>{},fetcher:async(_,init)=>{sent.push(JSON.parse(init.body));return Response.json({model:'deepseek-flash',choices:[{message:{content:JSON.stringify(raw)},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}})}})
 const req=new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({content:source,sourceType:'text',referenceTime:'2028-04-01T12:00:00+08:00',timezone:'Asia/Shanghai'})})
 const r=await worker.fetch(req,{ALLOWED_ORIGINS:origin,DEEPSEEK_API_KEY:'server-only-test-key',DEEPSEEK_EXTRACTION_MAX_TOKENS:'16384',DEEPSEEK_GENERATION_MODE:'two-step-2.4'}),json=await r.json()
 assert.equal(r.status,200,JSON.stringify(json));assert.equal(json.result.promptVersion,TWO_STEP_VERSION);assert.equal(json.result.events.length,1);assert.match(json.result.events[0].description,/记录城市：街区影像实践/u);assert.equal(sent[0].messages[0].content,twoStepSystemPrompt())
})
