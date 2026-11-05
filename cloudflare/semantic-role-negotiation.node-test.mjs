import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createWorker} from './worker.mjs'

test('the direct client opts into the role contract while old clients keep the frozen default',async()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'))
 const source='同学请于11月12日17:00前将申请表交给组长。组长于11月13日12:00前汇总发送申请表。'
 const facts={topic:'申请表',kind:'action',items:[
  {key:'student',kind:'task',title:'向组长提交申请表',action:'提交',object:'申请表',evidence:['同学请于11月12日17:00前将申请表交给组长'],times:[{role:'deadline',raw:'11月12日17:00前'}],assignment:{scope:'audience',actor:'同学',evidence:'同学请于11月12日17:00前将申请表交给组长'}},
  {key:'leader',kind:'task',title:'组长汇总发送申请表',action:'发送',object:'申请表',evidence:['组长于11月13日12:00前汇总发送申请表'],dependsOn:['student'],assignment:{scope:'other',actor:'组长',evidence:'组长于11月13日12:00前汇总发送申请表',relatedTo:'student'}},
 ],materials:[]}
 const prompts=[],worker=createWorker({logger:()=>{},fetcher:async(_url,options)=>{prompts.push(JSON.parse(options.body).messages[0].content);return Response.json({model:'observed-test-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify(facts)}}],usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130}})}})
 const origin='https://student-affairs-manager.example',env={...config.vars,DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',EXTRACTION_RATE_LIMITER:{limit:async()=>({success:true})}}
 const request=contract=>new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json',...(contract?{'x-student-affairs-recognition':contract}:{})},body:JSON.stringify({sourceType:'text',content:source,referenceTime:'2026-11-05T12:00:00+08:00',timezone:'Asia/Shanghai'})})
 const old=await(await worker.fetch(request(null),env)).json(),next=await(await worker.fetch(request('semantic-notice-3.3'),env)).json()
 assert.equal(old.execution.generationMode,'semantic-notice-3.0');assert.equal(old.result.promptVersion,'recognition-semantic-notice-3.2.0')
 assert.equal(next.execution.generationMode,'semantic-notice-3.3');assert.equal(next.result.promptVersion,'recognition-semantic-notice-3.3.0')
 assert.equal(old.result.standaloneTasks.length,2);assert.equal(next.result.standaloneTasks.length,1)
 assert.match(next.result.standaloneTasks[0].description,/后续由组长办理/u);assert.match(prompts[1],/assignment/u)
 assert.equal(prompts.length,2)
})

test('the direct client can opt into the newer role-context contract without changing old callers',async()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'))
 const source='同学请将申请表交给组长。组长汇总申请表。纸质件送至服务大厅。'
 const facts={topic:'申请表',kind:'action',items:[
  {key:'student',kind:'task',title:'向组长提交申请表',action:'提交',object:'申请表',evidence:['同学请将申请表交给组长'],assignment:{scope:'audience',actor:'同学',evidence:'同学请将申请表交给组长'}},
  {key:'leader',kind:'task',title:'组长提交纸质件',action:'提交',object:'纸质件',evidence:['纸质件送至服务大厅'],dependsOn:['student'],assignment:{scope:'other',actor:'组长',evidence:'纸质件送至服务大厅',actorEvidence:'组长汇总申请表',relatedTo:'student'}},
 ],materials:[]}
 const prompts=[],worker=createWorker({logger:()=>{},fetcher:async(_url,options)=>{prompts.push(JSON.parse(options.body).messages[0].content);return Response.json({model:'observed-test-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify(facts)}}],usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130}})}})
 const origin='https://student-affairs-manager.example',env={...config.vars,DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',EXTRACTION_RATE_LIMITER:{limit:async()=>({success:true})}}
 const request=new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json','x-student-affairs-recognition':'semantic-notice-3.4'},body:JSON.stringify({sourceType:'text',content:source,referenceTime:'2026-11-05T12:00:00+08:00',timezone:'Asia/Shanghai'})})
 const next=await(await worker.fetch(request,env)).json()
 assert.equal(next.execution.generationMode,'semantic-notice-3.4');assert.equal(next.result.promptVersion,'recognition-semantic-notice-3.4.0')
 assert.equal(next.result.standaloneTasks.length,1);assert.match(next.result.standaloneTasks[0].description,/后续由组长办理/u)
 assert.match(prompts[0],/actorEvidence/u)
})

test('the 3.5 opt-in preserves cited service context in the real adapter',async()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'))
 const source='同学请将确认单交给助理。服务台在4月6日9:00至11:00受理。'
 const facts={topic:'确认单',kind:'action',items:[{key:'submit',kind:'task',title:'向助理提交确认单',action:'提交',object:'确认单',evidence:['同学请将确认单交给助理'],assignment:{scope:'audience',actor:'同学',evidence:'同学请将确认单交给助理'},contextFacts:[{kind:'receiving_schedule',quote:'服务台在4月6日9:00至11:00受理'}]}],materials:[]}
 const worker=createWorker({logger:()=>{},fetcher:async()=>Response.json({model:'observed-test-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify(facts)}}],usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130}})})
 const origin='https://student-affairs-manager.example',env={...config.vars,DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',EXTRACTION_RATE_LIMITER:{limit:async()=>({success:true})}}
 const request=new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json','x-student-affairs-recognition':'semantic-notice-3.5'},body:JSON.stringify({sourceType:'text',content:source,referenceTime:'2026-11-05T12:00:00+08:00',timezone:'Asia/Shanghai'})})
 const next=await(await worker.fetch(request,env)).json()
 assert.equal(next.execution.generationMode,'semantic-notice-3.5');assert.equal(next.result.promptVersion,'recognition-semantic-notice-3.5.0')
 assert.match(next.result.standaloneTasks[0].description,/相关受理安排：服务台在4月6日/u)
})
