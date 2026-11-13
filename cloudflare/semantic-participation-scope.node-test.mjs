import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice,SEMANTIC_PARTICIPATION_COMPILER_VERSION} from './semantic-notice-compiler-v3.mjs'
import {createWorker} from './worker.mjs'
import {loadPublicConfig} from '../server/public-server.mjs'

const options={referenceTime:'2026-11-14T09:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.31'}
function compile(condition,enabled=true){
 const clause=`${condition}请于11月21日17:00前提交报名表至服务平台`
 const raw={topic:'活动报名',kind:'action',items:[{key:'task',kind:'task',title:'提交报名表',action:'提交',object:'报名表',condition,evidence:[clause],times:[{role:'deadline',raw:'11月21日17:00前'}],channel:'服务平台'}],materials:[]}
 return compileSemanticNotice(raw,{...options,source:clause,participationScopeVersion:enabled?'1.0.0':''})
}
test('voluntary expressions remain invitations rather than eligibility',()=>{
 for(const condition of ['有意愿参加的同学','有意向参加的同学','感兴趣的同学','自愿参加的同学']){
  const {result,audit}=compile(condition),task=result.standaloneTasks[0]
  assert.equal(audit.compilerVersion,SEMANTIC_PARTICIPATION_COMPILER_VERSION)
  assert.match(task.description,/参加说明/u)
  assert.doesNotMatch(task.description,/适用条件待确认/u)
  assert.equal(task.selected,true)
  assert.equal(result.timePoints.find(p=>p.relatedTaskTempIds.includes(task.tempId))?.normalizedValue,'2026-11-21T17:00')
 }
})
test('an actual qualification combined with interest remains a condition',()=>{
 const {result}=compile('仅限本院学生且有意愿参加的同学')
 assert.match(result.standaloneTasks[0].description,/适用条件待确认.*仅限本院学生/u)
 assert.equal(result.standaloneTasks[0].selected,false)
})
test('old compiler stays selectable without silently changing recorded behaviour',()=>{
 const {result,audit}=compile('有意愿参加的同学',false)
 assert.equal(audit.compilerVersion,'semantic-notice-compiler-1.0.31')
 assert.match(result.standaloneTasks[0].description,/适用条件待确认/u)
})
test('source-backed list content survives and a fabricated entry is not promoted',()=>{
 const source='【文化活动】11月25日14:00在文体楼举行文化活动。联络组2人对接来宾，技术组3人负责投影。'
 const raw={topic:'文化活动',kind:'event',items:[{key:'event',kind:'event',title:'文化活动',evidence:['11月25日14:00在文体楼举行文化活动'],times:[{role:'start',raw:'11月25日14:00'}],location:'文体楼',content:['联络组2人对接来宾','技术组3人负责投影','医疗组10人负责救护']}],materials:[]}
 const {result,audit}=compileSemanticNotice(raw,{...options,source,participationScopeVersion:'1.0.0'})
 assert.match(result.events[0].description,/联络组2人对接来宾/u)
 assert.match(result.events[0].description,/技术组3人负责投影/u)
 assert.doesNotMatch(result.events[0].description,/医疗组/u)
 assert.ok(audit.losses.some(x=>x.reason==='CONTENT_NOT_SOURCE_GROUNDED'))
})
test('the SWAS worker uses the scoped compiler when the public server enables it',async()=>{
 const source='有意愿参加的同学请于11月21日17:00前提交报名表至服务平台。'
 const facts={topic:'活动报名',kind:'action',items:[{key:'task',kind:'task',title:'提交报名表',action:'提交',object:'报名表',condition:'有意愿参加的同学',evidence:[source.slice(0,-1)],times:[{role:'deadline',raw:'11月21日17:00前'}]}],materials:[]}
 const config=loadPublicConfig({DEEPSEEK_API_KEY:'test-only-placeholder-key-for-tests',SAM_ALLOWED_HOSTS:'student-affairs.site'})
 assert.equal(config.workerEnv.SEMANTIC_PARTICIPATION_SCOPE_VERSION,'1.0.0')
 let calls=0
 const worker=createWorker({fetcher:async()=>{calls++;return Response.json({model:'mock-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify(facts)}}],usage:{prompt_tokens:50,completion_tokens:20,total_tokens:70}})}})
 const request=new Request('https://student-affairs.site/api/deepseek/extract',{method:'POST',headers:{'content-type':'application/json','origin':'https://student-affairs.site','X-Student-Affairs-Recognition':'semantic-notice-3.11'},body:JSON.stringify({sourceType:'text',content:source,referenceTime:options.referenceTime,timezone:options.timezone})})
 const response=await worker.fetch(request,config.workerEnv)
 assert.equal(response.status,200)
 const body=await response.json()
 assert.equal(calls,1)
 assert.equal(body.execution.twoStep.compilerVersion,SEMANTIC_PARTICIPATION_COMPILER_VERSION)
 assert.match(body.result.standaloneTasks[0].description,/参加说明/u)
 assert.doesNotMatch(body.result.standaloneTasks[0].description,/适用条件待确认/u)
})
