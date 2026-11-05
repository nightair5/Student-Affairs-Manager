import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {SEMANTIC_NOTICE_VERSION,semanticNoticeSystemPrompt} from './semantic-notice-contract-v3-3-0.mjs'

const source='同学请于11月12日17:00前将申请表交给组长。组长于11月13日12:00前汇总发送申请表至office@example.org。'
const raw={topic:'申请表',kind:'action',items:[
 {key:'student',kind:'task',title:'向组长提交申请表',action:'提交',object:'申请表',evidence:['同学请于11月12日17:00前将申请表交给组长'],times:[{role:'deadline',raw:'11月12日17:00前'}],assignment:{scope:'audience',actor:'同学',evidence:'同学请于11月12日17:00前将申请表交给组长'}},
 {key:'leader',kind:'task',title:'组长汇总发送申请表',action:'发送',object:'申请表',evidence:['组长于11月13日12:00前汇总发送申请表至office@example.org'],times:[{role:'deadline',raw:'11月13日12:00前'}],channel:'office@example.org',dependsOn:['student'],assignment:{scope:'other',actor:'组长',evidence:'组长于11月13日12:00前汇总发送申请表至office@example.org',relatedTo:'student'}},
],materials:[]}
const compile=(input=raw,text=source,version=SEMANTIC_NOTICE_VERSION)=>compileSemanticNotice(input,{source:text,referenceTime:'2026-11-05T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:version})

test('source-supported downstream work remains context, with its own time and channel',()=>{
 const {result,audit}=compile()
 assert.equal(result.standaloneTasks.length,1)
 const task=result.standaloneTasks[0]
 assert.match(task.title,/申请表/u)
 assert.match(task.description,/提交渠道：组长/u)
 assert.match(task.description,/后续由组长办理/u)
 assert.match(task.description,/11月13日12:00/u)
 assert.match(task.description,/office@example.org/u)
 assert.equal(result.timePoints.filter(p=>p.relatedTaskTempIds.includes(task.tempId)&&p.type==='task_deadline')[0].normalizedValue,'2026-11-12T17:00')
 assert.ok(audit.facts.some(f=>f.role==='later_handler'))
})
test('missing relation, unsupported evidence and old contract never silently collapse tasks',()=>{
 for(const variant of [
  {...raw,items:[raw.items[0],{...raw.items[1],dependsOn:[]}]},
  {...raw,items:[raw.items[0],{...raw.items[1],assignment:{...raw.items[1].assignment,evidence:'无来源的组长信息'}}]},
 ])assert.equal(compile(variant).result.standaloneTasks.length,2)
 assert.equal(compile(raw,source,'recognition-semantic-notice-3.2.0').result.standaloneTasks.length,2)
})
test('a potentially user-held role remains a visible conditional action',()=>{
 const text='请各班班长于11月8日17:00前填写登记表。'
 const facts={topic:'登记',kind:'action',items:[{key:'monitor',kind:'task',title:'填写登记表',action:'填写',object:'登记表',evidence:['请各班班长于11月8日17:00前填写登记表'],times:[{role:'deadline',raw:'11月8日17:00前'}],assignment:{scope:'conditional',actor:'班长',evidence:'请各班班长于11月8日17:00前填写登记表'}}],materials:[]}
 const task=compile(facts,text).result.standaloneTasks[0]
 assert.ok(task);assert.equal(task.selected,false);assert.equal(task.userConfirmationRequired,true)
 assert.match(task.description,/班长/u)
})
test('an unknown actor is preserved and marked uncertain rather than silently treated as the user',()=>{
 const candidate=structuredClone(raw)
 candidate.items[0].assignment={scope:'unknown',actor:'',evidence:''}
 const {result,audit}=compile(candidate)
 const task=result.standaloneTasks.find(item=>/提交申请表/u.test(item.title))
 assert.ok(task);assert.equal(task.selected,false);assert.equal(task.userConfirmationRequired,true)
 assert.ok(audit.losses.some(loss=>loss.reason==='ACTOR_UNCERTAIN'))
})
test('a uniquely cited service handoff stays with the recipient task, while an ambiguous handoff remains visible',()=>{
 const text='需要设备借用的同学可在线预约并携学生证办理。服务点在11月10日、11月17日的9:00至11:00受理；管理员将在每次受理后统一登记台账。'
 const student='需要设备借用的同学可在线预约并携学生证办理',schedule='服务点在11月10日、11月17日的9:00至11:00受理',later='管理员将在每次受理后统一登记台账'
 const facts={topic:'设备借用',kind:'action',items:[
  {key:'borrow',kind:'task',title:'办理设备借用',action:'办理',object:'设备借用',evidence:[student,schedule],times:[{role:'window',raw:'11月10日、11月17日的9:00至11:00'}],assignment:{scope:'audience',actor:'同学',evidence:student}},
  {key:'ledger',kind:'task',title:'登记设备借用台账',action:'登记',object:'台账',evidence:[later],dependsOn:['borrow'],assignment:{scope:'other',actor:'管理员',evidence:later,relatedTo:'borrow'}},
 ],materials:[]}
 const merged=compile(facts,text).result.standaloneTasks
 assert.equal(merged.length,1);assert.match(merged[0].description,/后续由管理员办理/u);assert.match(merged[0].description,/11月10日、11月17日/u)
 const duplicate={...facts,items:[facts.items[0],{...facts.items[0],key:'another'},facts.items[1]]}
 const ambiguous=compile(duplicate,text).result.standaloneTasks
 assert.ok(ambiguous.some(task=>/登记/u.test(task.title)&&task.userConfirmationRequired))
})
test('contract preserves earlier prompt and asks for roles without a site-specific rule',()=>{
 assert.equal(SEMANTIC_NOTICE_VERSION,'recognition-semantic-notice-3.3.0')
 assert.match(semanticNoticeSystemPrompt(),/assignment/u)
})

test('a separately cited actor can own a continuation, but an invented actor cannot',()=>{
 const text='同学请将申请表交给组长。组长汇总申请表。纸质件送至服务大厅。'
 const first='同学请将申请表交给组长',continued='纸质件送至服务大厅'
 const facts={topic:'申请表',kind:'action',items:[
  {key:'student',kind:'task',title:'向组长提交申请表',action:'提交',object:'申请表',evidence:[first],assignment:{scope:'audience',actor:'同学',evidence:first}},
  {key:'leader',kind:'task',title:'提交纸质件',action:'提交',object:'纸质件',evidence:[continued],dependsOn:['student'],assignment:{scope:'other',actor:'组长',evidence:continued,actorEvidence:'组长汇总申请表',relatedTo:'student'}},
 ],materials:[]}
 const merged=compile(facts,text,'recognition-semantic-notice-3.4.0').result.standaloneTasks
 assert.equal(merged.length,1);assert.match(merged[0].description,/后续由组长办理/u);assert.match(merged[0].description,/服务大厅/u)
 const invented=structuredClone(facts);invented.items[1].assignment.actor='服务大厅办理者';invented.items[1].assignment.actorEvidence=continued
 const unmerged=compile(invented,text,'recognition-semantic-notice-3.4.0').result.standaloneTasks
 assert.equal(unmerged.length,2);assert.ok(unmerged.find(task=>/纸质件/u.test(task.title)).userConfirmationRequired)
 invented.items[1].assignment.scope='audience'
 const unknown=compile(invented,text,'recognition-semantic-notice-3.4.0').result.standaloneTasks.find(task=>/纸质件/u.test(task.title))
 assert.equal(unknown.selected,false);assert.match(unknown.description,/执行人未能从通知中确定/u)
})

test('source-cited service dates and handler instructions remain contextual rather than personal deadlines',()=>{
 const text='研究生请在每月办理日前将确认单交给实验室助理。服务台在4月6日和5月6日的9:00至11:00受理。实验室助理核对后汇总发送给办公室。'
 const action='研究生请在每月办理日前将确认单交给实验室助理',dates='服务台在4月6日和5月6日的9:00至11:00受理',later='实验室助理核对后汇总发送给办公室'
 const facts={topic:'确认单',kind:'action',items:[{key:'submit',kind:'task',title:'向助理提交确认单',action:'提交',object:'确认单',evidence:[action],times:[{role:'deadline',raw:'每月办理日前'}],assignment:{scope:'audience',actor:'研究生',evidence:action},contextFacts:[{kind:'receiving_schedule',quote:dates},{kind:'later_handler',quote:later},{kind:'receiving_schedule',quote:'虚构的其他日期'}]}],materials:[]}
 const {result,audit}=compile(facts,text,'recognition-semantic-notice-3.5.0'),task=result.standaloneTasks[0]
 assert.equal(result.standaloneTasks.length,1);assert.match(task.description,/4月6日和5月6日/u);assert.match(task.description,/后续办理说明：实验室助理/u)
 assert.ok(!result.timePoints.some(point=>point.normalizedValue?.includes('04-06')))
 assert.ok(audit.losses.some(loss=>loss.reason==='CONTEXT_NOT_SOURCE_GROUNDED'));assert.ok(result.quality.needsHumanReview)
})

test('a source-backed same-paragraph actor may own a continued clause without guessing across paragraphs',()=>{
 const first='同学请将申请表交给组长',current='纸质件送至服务大厅'
 const text=first+'。组长汇总申请表；'+current+'。'
 const facts={topic:'申请表',kind:'action',items:[
  {key:'student',kind:'task',title:'向组长提交申请表',action:'提交',object:'申请表',evidence:[first],assignment:{scope:'audience',actor:'同学',evidence:first}},
  {key:'leader',kind:'task',title:'提交纸质件',action:'提交',object:'纸质件',evidence:[current],dependsOn:['student'],assignment:{scope:'other',actor:'组长',evidence:current,relatedTo:'student'}},
 ],materials:[]}
 assert.equal(compile(facts,text,'recognition-semantic-notice-3.5.0').result.standaloneTasks.length,1)
 const separate=first+'。组长汇总申请表。\n'+current+'。'
 assert.equal(compile(facts,separate,'recognition-semantic-notice-3.5.0').result.standaloneTasks.length,2)
})

test('a duplicated conditional handoff already cited as another person’s context is not another personal task',()=>{
 const action='同学请将材料交给组长',later='组长汇总材料后提交办公室'
 const text=action+'。'+later+'。'
 const facts={topic:'材料',kind:'action',items:[
  {key:'student',kind:'task',title:'向组长提交材料',action:'提交',object:'材料',evidence:[action],assignment:{scope:'audience',actor:'同学',evidence:action},contextFacts:[{kind:'later_handler',quote:later}]},
  {key:'leader',kind:'task',title:'汇总材料提交办公室',action:'提交',object:'材料',evidence:[later],dependsOn:['student'],assignment:{scope:'conditional',actor:'组长',evidence:later}},
 ],materials:[]}
 const {result}=compile(facts,text,'recognition-semantic-notice-3.5.0')
 assert.equal(result.standaloneTasks.length,1);assert.match(result.standaloneTasks[0].description,/组长汇总材料后提交办公室/u)
 const withoutContext=structuredClone(facts);withoutContext.items[0].contextFacts=[]
 assert.equal(compile(withoutContext,text,'recognition-semantic-notice-3.5.0').result.standaloneTasks.length,2)
})
