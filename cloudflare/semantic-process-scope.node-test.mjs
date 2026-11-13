import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {createWorker} from './worker.mjs'

const options={referenceTime:'2026-11-01T09:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.31'}
const source='课程作品安排。组织者对作品进行审核，并将作品进行展出。\n（一）作品提交阶段\n请于11月20日前提交作品。\n（二）作品审核阶段\n审核时间：11月21日至11月23日。\n（三）作品展出阶段\n展出时间：11月25日至11月27日。'
const raw=()=>({topic:'课程作品安排',kind:'mixed',items:[
 {key:'submit',kind:'task',title:'提交作品',action:'提交',object:'作品',evidence:['请于11月20日前提交作品'],times:[{role:'deadline',raw:'11月20日前'}]},
 {key:'review',kind:'event',title:'作品审核阶段',evidence:['审核时间：11月21日至11月23日'],times:[{role:'start',raw:'11月21日'},{role:'end',raw:'11月23日'}]},
 {key:'display',kind:'event',title:'作品展出阶段',evidence:['展出时间：11月25日至11月27日'],times:[{role:'start',raw:'11月25日'},{role:'end',raw:'11月27日'}]},
 ],materials:[]})

test('opt-in compiler preserves non-attendance process phases on the unique matter without appointments',()=>{
 const baseline=compileSemanticNotice(raw(),{...options,source})
 assert.equal(baseline.result.events.length,2)
 const {result,audit}=compileSemanticNotice(raw(),{...options,source,roleResolutionVersion:'1.0.0'})
 assert.equal(result.events.length,0)
 assert.equal(result.standaloneTasks.length,1)
 assert.match(result.standaloneTasks[0].description,/后续流程.*作品审核阶段.*11月21日/u)
 assert.match(result.standaloneTasks[0].description,/作品展出阶段.*11月25日/u)
 assert.equal(result.timePoints.filter(point=>point.type==='task_deadline').length,1)
 assert.equal(audit.facts.filter(fact=>fact.role==='source_process_context').length,2)
})

test('explicit student attendance prevents moving a phase into organiser context',()=>{
 const changed=source.replace('审核时间：11月21日至11月23日。','审核时间：11月21日至11月23日，请入围同学参加现场答辩。')
 const {result}=compileSemanticNotice(raw(),{...options,source:changed,roleResolutionVersion:'1.0.0'})
 assert.ok(result.events.some(event=>event.title==='作品审核阶段'))
})

test('a phase heading without an independently supported organiser action stays visible',()=>{
 const noActor=source.replace('组织者对作品进行审核，并将作品进行展出。','')
 const {result}=compileSemanticNotice(raw(),{...options,source:noActor,roleResolutionVersion:'1.0.0'})
 assert.equal(result.events.length,2)
})

test('ambiguous ownership and same-day independent activities are not merged',()=>{
 const input=raw();input.items.push({key:'other',kind:'task',title:'提交调查表',action:'提交',object:'调查表',evidence:['请提交调查表']})
 const changed=source+'\n请提交调查表。'
 const {result}=compileSemanticNotice(input,{...options,source:changed,roleResolutionVersion:'1.0.0'})
 assert.equal(result.events.length,2)
 const sessions={topic:'两场交流',kind:'event',items:[
  {key:'one',kind:'event',title:'第一场交流会',evidence:['11月20日9:00参加第一场交流会'],times:[{role:'start',raw:'11月20日9:00'}]},
  {key:'two',kind:'event',title:'第二场交流会',evidence:['11月20日14:00参加第二场交流会'],times:[{role:'start',raw:'11月20日14:00'}]},
 ],materials:[]}
 const real=compileSemanticNotice(sessions,{...options,source:'11月20日9:00参加第一场交流会。11月20日14:00参加第二场交流会。',roleResolutionVersion:'1.0.0'})
 assert.equal(real.result.events.length,2)
})

test('a cited recipient handoff can keep a later handler stage as context',()=>{
 const body='请把申请表提交给项目组。项目组于11月21日统一审核申请表。'
 const input={topic:'申请表办理',kind:'mixed',items:[
  {key:'submit',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['请把申请表提交给项目组']},
  {key:'review',kind:'event',title:'项目组审核申请表',evidence:['项目组于11月21日统一审核申请表'],times:[{role:'start',raw:'11月21日'}],assignment:{scope:'other',actor:'项目组',evidence:'项目组于11月21日统一审核申请表',relatedTo:'submit'}},
 ],materials:[]}
 const {result}=compileSemanticNotice(input,{...options,source:body,roleResolutionVersion:'1.0.0'})
 assert.equal(result.events.length,0)
 assert.match(result.standaloneTasks[0].description,/后续流程.*项目组于11月21日统一审核/u)
 const unbound=structuredClone(input);unbound.items[1].assignment.relatedTo='unknown'
 assert.equal(compileSemanticNotice(unbound,{...options,source:body,roleResolutionVersion:'1.0.0'}).result.events.length,1)
})

test('opt-in HTTP adapter returns a validated conditional workflow material',async()=>{
 const body='【课程证明办理】\n一、办理流程\n请办理课程证明。\n二、其他事项\n委托他人办理请出具授权书。'
 const facts={topic:'课程证明办理',kind:'action',items:[{key:'a',kind:'task',title:'办理课程证明',action:'办理',object:'课程证明',evidence:['请办理课程证明']}],materials:[{key:'m',name:'授权书',required:false,owners:[],evidence:['委托他人办理请出具授权书']}]}
 const origin='https://synthetic.example'
 const worker=createWorker({fetcher:async()=>Response.json({model:'fixture',choices:[{finish_reason:'stop',message:{content:JSON.stringify(facts)}}],usage:{prompt_tokens:50,completion_tokens:20}})})
 const env={DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',ALLOWED_ORIGINS:origin,DEEPSEEK_GENERATION_MODE:'semantic-notice-3.0',SEMANTIC_GOAL_CONTEXT_VERSION:'1.0.31',SEMANTIC_ROLE_RESOLUTION_VERSION:'1.0.0',RECOGNITION_LOCAL_ISOLATION_VERSION:'1.0.0',DEEPSEEK_MODEL:'deepseek-v4-flash',DEEPSEEK_EXTRACTION_MAX_TOKENS:'16384',EXTRACTION_RATE_LIMITER:{limit:async()=>({success:true})}}
 const response=await worker.fetch(new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json','X-Student-Affairs-Recognition':'semantic-notice-3.11'},body:JSON.stringify({sourceType:'text',content:body,referenceTime:options.referenceTime,timezone:options.timezone})}),env)
 const output=await response.json()
 assert.equal(response.status,200,JSON.stringify(output))
 assert.equal(output.execution.twoStep.compilerVersion,'semantic-notice-compiler-1.0.32')
 assert.equal(output.result.materials[0].goalScope.requirement,'required')
 assert.equal(output.result.materials[0].goalScope.condition,'委托他人办理')
})
