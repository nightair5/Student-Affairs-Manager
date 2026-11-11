import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {semanticNoticeSystemPrompt} from './semantic-notice-contract-v3-12-0.mjs'
import {createWorker} from './worker.mjs'

const heading='实践学分认定'
const actions=['请于2026年11月13日17:00前填写登记表。','外院实践队成员于2026年11月13日17:00前发送认定材料。','需补认定往年学分者于2026年11月13日17:00前发送证明。']
const source=`【${heading}】\n${actions.join('\n')}`
const raw=()=>({topic:heading,kind:'action',items:[
 {key:'form',kind:'task',title:'填写登记表',action:'填写',object:'登记表',condition:'所有申报者',evidence:[actions[0]],times:[{role:'deadline',raw:'2026年11月13日17:00前'}]},
 {key:'external',kind:'task',title:'发送认定材料',action:'发送',object:'认定材料',condition:'外院实践队成员',evidence:[actions[1]],times:[{role:'deadline',raw:'2026年11月13日17:00前'}]},
 {key:'past',kind:'task',title:'发送证明',action:'发送',object:'证明',condition:'需补认定往年学分者',evidence:[actions[2]],times:[{role:'deadline',raw:'2026年11月13日17:00前'}]},
],materials:[],goals:[{key:'g',title:heading,anchor:heading,evidence:heading,taskKeys:['form','external','past']}]})
const opts=(s=source)=>({source:s,referenceTime:'2026-11-11T09:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.12.0',goalContextVersion:'1.0.30'})

test('new prompt distinguishes goal membership, independent actions and unknown membership',()=>{
 const prompt=semanticNoticeSystemPrompt()
 for(const text of ['不同动词','matterScope','independent','unknown','不同事项同日截止不能归组'])assert.ok(prompt.includes(text),text)
})
test('a cited specific heading groups different actions without repeating it in titles',()=>{
 const {result,audit}=compileSemanticNotice(raw(),opts())
 assert.equal(audit.compilerVersion,'semantic-notice-compiler-1.0.30')
 assert.equal(result.standaloneTasks.length,3)
 assert.equal(result.goalGroups?.length,1)
 assert.equal(result.goalGroups[0].taskTempIds.length,3)
 assert.deepEqual(result.timePoints.filter(p=>p.type==='task_deadline').map(p=>p.normalizedValue),Array(3).fill('2026-11-13T17:00'))
})
test('the same raw remains ungrouped under the frozen old compiler',()=>{
 const {result}=compileSemanticNotice(raw(),{...opts(),promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.29'})
 assert.equal(result.goalGroups,undefined)
 const compatible=compileSemanticNotice(raw(),{...opts(),promptVersion:'recognition-semantic-notice-3.11.0'})
 assert.equal(compatible.audit.compilerVersion,'semantic-notice-compiler-1.0.29')
 assert.deepEqual(compatible.result,result)
})
test('a cited second heading does not inherit the first matter',()=>{
 const other='请于2026年11月13日17:00前缴纳宿舍水费。'
 const changed=`【${heading}】\n${actions.slice(0,2).join('\n')}\n【宿舍生活】\n${other}`
 const input=raw();input.items[2]={key:'past',kind:'task',title:'缴纳水费',action:'缴纳',object:'水费',evidence:[other],times:[{role:'deadline',raw:'2026年11月13日17:00前'}]}
 const {result,audit}=compileSemanticNotice(input,opts(changed))
 assert.equal(result.standaloneTasks.length,3)
 assert.deepEqual(result.goalGroups?.[0].taskTempIds,result.standaloneTasks.slice(0,2).map(t=>t.tempId))
 assert.ok(audit.losses.some(loss=>loss.reason==='GOAL_MEMBER_UNRESOLVED'))
})
test('a date or generic heading cannot establish a common goal',()=>{
 const s='【今日事项】\n请于11月13日前缴纳电费。\n请于11月13日前提交课程作业。'
 const input={topic:'今日事项',kind:'action',items:[
  {key:'a',kind:'task',title:'缴纳电费',action:'缴纳',object:'电费',evidence:['请于11月13日前缴纳电费']},
  {key:'b',kind:'task',title:'提交作业',action:'提交',object:'课程作业',evidence:['请于11月13日前提交课程作业']},
 ],materials:[],goals:[{key:'g',title:'今日事项',anchor:'今日事项',evidence:'今日事项',taskKeys:['a','b']}]}
 const {result}=compileSemanticNotice(input,opts(s))
 assert.equal(result.goalGroups,undefined)
 assert.equal(result.standaloneTasks.length,2)
})
test('missing membership is visible as partial; explicit independent actions are not guessed together',()=>{
 const input=raw();delete input.goals
 const unknown=compileSemanticNotice(structuredClone(input),opts())
 assert.ok(unknown.audit.losses.some(loss=>loss.reason==='MATTER_ASSIGNMENT_UNRESOLVED'))
 assert.equal(unknown.result.quality.needsHumanReview,true)
 for(const item of input.items)item.matterScope='independent'
 const separate=compileSemanticNotice(input,opts())
 assert.equal(separate.result.goalGroups,undefined)
 assert.ok(!separate.audit.losses.some(loss=>loss.reason==='MATTER_ASSIGNMENT_UNRESOLVED'))
})
test('the opt-in contract preserves a cited A-or-B choice without treating a prohibition as a choice',()=>{
 const first='电子版于11月16日17:00前上传平台',second='纸质版于11月17日12:00前交到服务台'
 const make=instruction=>{
  const source=`【课程作品递交】\n${instruction}。\n${first}。\n${second}。`
  const items=[['a','上传','电子版作品',first,'11月16日17:00前'],['b','递交','纸质版作品',second,'11月17日12:00前']].map(([key,action,object,quote,time])=>({key,kind:'task',title:action+object,action,object,evidence:[quote],times:[{role:'deadline',raw:time}],choice:{key:'delivery',evidence:instruction}}))
  return {source,raw:{topic:'课程作品递交',kind:'action',items,materials:[],goals:[{key:'g',title:'课程作品递交',anchor:'课程作品递交',evidence:'课程作品递交',taskKeys:['a','b']}]}}
 }
 const valid=make('作品任选电子版或纸质版提交')
 const next=compileSemanticNotice(valid.raw,opts(valid.source))
 assert.equal(next.result.conflicts.filter(c=>c.id.startsWith('sem-choice-')).length,1)
 assert.equal(next.result.goalGroups?.length,1)
 assert.deepEqual(next.result.timePoints.filter(p=>p.type==='task_deadline').map(p=>p.normalizedValue),['2026-11-16T17:00','2026-11-17T12:00'])
 const old=compileSemanticNotice(valid.raw,{...opts(valid.source),promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.29'})
 assert.equal(old.result.conflicts.filter(c=>c.id.startsWith('sem-choice-')).length,0)
 const forbidden=make('作品不可任选电子版或纸质版提交')
 const denied=compileSemanticNotice(forbidden.raw,opts(forbidden.source))
 assert.equal(denied.result.conflicts.filter(c=>c.id.startsWith('sem-choice-')).length,0)
 assert.equal(denied.result.standaloneTasks.length,2)
 assert.ok(denied.audit.losses.some(loss=>loss.reason==='CHOICE_RELATION_UNCONFIRMED'))
 assert.equal(denied.result.quality.needsHumanReview,true)
 const contradiction=compileSemanticNotice(valid.raw,opts(valid.source+'\n两种都必须提交。'))
 assert.equal(contradiction.result.conflicts.filter(c=>c.id.startsWith('sem-choice-')).length,0)
 assert.ok(contradiction.audit.losses.some(loss=>loss.reason==='CHOICE_RELATION_UNCONFIRMED'))
})
test('candidate contract is explicitly negotiated while old clients retain their contract',async()=>{
 const origin='https://student-affairs-manager.example',worker=createWorker({logger:()=>{},fetcher:async()=>Response.json({model:'fixture-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw())}}],usage:{prompt_tokens:20,completion_tokens:20}})})
 const request=version=>new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json','X-Student-Affairs-Recognition':version},body:JSON.stringify({content:source,sourceType:'text',referenceTime:'2026-11-11T09:00:00+08:00',timezone:'Asia/Shanghai'})})
 const env={DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',ALLOWED_ORIGINS:origin,DEEPSEEK_GENERATION_MODE:'semantic-notice-3.0',SEMANTIC_GOAL_CONTEXT_VERSION:'1.0.30',RECOGNITION_LOCAL_ISOLATION_VERSION:'1.0.0',DEEPSEEK_MODEL:'deepseek-v4-flash',DEEPSEEK_EXTRACTION_MAX_TOKENS:'16384',EXTRACTION_RATE_LIMITER:{limit:async()=>({success:true})}}
 const next=await worker.fetch(request('semantic-notice-3.12'),env),candidate=await next.json()
 assert.equal(next.status,200);assert.equal(candidate.execution.generationMode,'semantic-notice-3.12');assert.equal(candidate.execution.twoStep.compilerVersion,'semantic-notice-compiler-1.0.30');assert.equal(candidate.result.goalGroups?.length,1)
 const old=await worker.fetch(request('semantic-notice-3.11'),env),base=await old.json()
 assert.equal(old.status,200);assert.equal(base.execution.generationMode,'semantic-notice-3.11');assert.equal(base.execution.twoStep.compilerVersion,'semantic-notice-compiler-1.0.29');assert.equal(base.result.goalGroups,undefined)
})
