import test from 'node:test'
import assert from 'node:assert/strict'
import {semanticNoticeSystemPrompt,SEMANTIC_NOTICE_VERSION} from './semantic-notice-contract-v3-8-0.mjs'
import {createWorker} from './worker.mjs'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'

test('unified contract is standalone and defines consistent choice, actors and event grouping',()=>{
 const prompt=semanticNoticeSystemPrompt()
 assert.equal(SEMANTIC_NOTICE_VERSION,'recognition-semantic-notice-3.8.0')
 assert.ok(prompt.length<6000)
 for(const term of ['assignment','contextFacts','choice','owners','condition','required','各自输出event'])assert.ok(prompt.includes(term),term)
 assert.ok(!prompt.includes('二选一只输出一项'))
 assert.ok(!prompt.includes('入群必须单独'))
})

test('one unified request negotiates its own prompt and compiler without extra upstream calls',async()=>{
 const source='同学请于11月20日17:00前提交登记表。'
 let calls=0,prompt=''
 const worker=createWorker({logger:()=>{},fetcher:async(_url,init)=>{
  calls++;prompt=JSON.parse(init.body).messages[0].content
  return Response.json({model:'fixture-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify({topic:'登记',kind:'action',items:[{key:'a',kind:'task',title:'提交登记表',action:'提交',object:'登记表',evidence:[source],times:[{role:'deadline',raw:'11月20日17:00前'}],assignment:{scope:'audience',actor:'同学',evidence:source}}],materials:[]})}}],usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130}})
 }})
 const origin='https://student-affairs-manager.example'
 const response=await worker.fetch(new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json','X-Student-Affairs-Recognition':'semantic-notice-3.8'},body:JSON.stringify({content:source,sourceType:'text',referenceTime:'2026-11-07T10:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',ALLOWED_ORIGINS:origin,DEEPSEEK_GENERATION_MODE:'semantic-notice-3.0',RECOGNITION_LOCAL_ISOLATION_VERSION:'1.0.0',DEEPSEEK_MODEL:'deepseek-v4-flash',DEEPSEEK_EXTRACTION_MAX_TOKENS:'16384',EXTRACTION_RATE_LIMITER:{limit:async()=>({success:true})}})
 const body=await response.json()
 assert.equal(response.status,200);assert.equal(calls,1)
 assert.equal(body.execution.generationMode,'semantic-notice-3.8')
 assert.equal(body.execution.promptVersion,SEMANTIC_NOTICE_VERSION)
 assert.equal(body.execution.twoStep.compilerVersion,'semantic-notice-compiler-1.0.21')
 assert.equal(prompt,semanticNoticeSystemPrompt())
 assert.equal(body.result.standaloneTasks.length,1)
})

test('shared materials stay attached to explicit choice branches with separate deadlines',()=>{
 const source='证明任选一种：11月20日17:00前上传电子材料；11月21日12:00前递交纸质材料。两种方式均须提交签名表。'
 const base={kind:'task',action:'提交',object:'材料',materials:['form'],choice:{key:'choice',evidence:'证明任选一种'},requirements:[]}
 const raw={topic:'证明',kind:'action',items:[
  {...base,key:'online',title:'提交电子材料',deliveryForm:'电子',evidence:['11月20日17:00前上传电子材料'],times:[{role:'deadline',raw:'11月20日17:00前'}]},
  {...base,key:'paper',title:'递交纸质材料',deliveryForm:'纸质',evidence:['11月21日12:00前递交纸质材料'],times:[{role:'deadline',raw:'11月21日12:00前'}]},
 ],materials:[{key:'form',name:'签名表',required:true,owners:['online','paper'],evidence:['两种方式均须提交签名表']}]}
 const {result}=compileSemanticNotice(raw,{source,referenceTime:'2026-11-07T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:SEMANTIC_NOTICE_VERSION})
 assert.equal(result.standaloneTasks.length,2)
 assert.equal(result.conflicts.find(c=>c.id.startsWith('sem-choice-'))?.entityTempIds.length,2)
 assert.ok(result.standaloneTasks.every(t=>t.materialTempIds.length>0))
 assert.deepEqual(result.timePoints.map(p=>p.normalizedValue).sort(),['2026-11-20T17:00','2026-11-21T12:00'])
})

test('an unspecified material obligation remains explicitly unresolved only in the new contract',()=>{
 const source='准备登记表，用于后续办理。'
 const raw={topic:'登记',kind:'action',items:[{key:'a',kind:'task',title:'准备登记表',action:'准备',object:'登记表',evidence:[source],materials:['m']}],materials:[{key:'m',name:'登记表',owners:['a'],evidence:[source]}]}
 const options={source,referenceTime:'2026-11-07T10:00:00+08:00',timezone:'Asia/Shanghai'}
 const fresh=compileSemanticNotice(raw,{...options,promptVersion:SEMANTIC_NOTICE_VERSION})
 assert.equal(fresh.result.materials[0].required,false)
 assert.ok(fresh.result.materials[0].requirements.includes('是否必交待确认'))
 assert.ok(fresh.audit.losses.some(x=>x.reason==='MATERIAL_REQUIRED_UNRESOLVED'))
 assert.equal(compileSemanticNotice(raw,{...options,promptVersion:'recognition-semantic-notice-3.7.0'}).result.materials[0].required,true)
})
