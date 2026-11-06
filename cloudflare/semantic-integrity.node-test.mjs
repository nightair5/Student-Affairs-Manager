import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {locateOwnedSourceQuote} from './source-text-index.mjs'
import {createWorker} from './worker.mjs'

const compile=(source,items)=>compileSemanticNotice({topic:'匿名安排',kind:'mixed',items,materials:[]},{source,referenceTime:'2026-11-06T09:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.6.0'})
const task=(evidence,times,extra={})=>({key:'t',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:[evidence],times,...extra})

test('a shared agenda date survives sentence boundaries without inventing eligibility',()=>{
 const source='11月20日举办两项活动。上午9:00—10:30是剧本讨论，地点文艺楼402；下午14:00—15:15是剪辑交流，地点同楼展厅。两场均面向感兴趣的同学。'
 const items=[['a','剧本讨论','上午9:00—10:30是剧本讨论，地点文艺楼402','上午9:00—10:30'],['b','剪辑交流','下午14:00—15:15是剪辑交流，地点同楼展厅','下午14:00—15:15']].map(([key,title,quote,raw])=>({key,kind:'event',title,evidence:[quote,'两场均面向感兴趣的同学'],times:[{role:'start',raw},{role:'end',raw}]}))
 const {result}=compile(source,items)
 assert.deepEqual(result.timePoints.map(time=>time.normalizedValue),['2026-11-20T09:00','2026-11-20T10:30','2026-11-20T14:00','2026-11-20T15:15'])
 assert.ok(result.events.every(event=>!event.description.includes('适用条件')))
})
test('a deadline or different-day heading cannot anchor an event clock',()=>{
 for(const heading of ['报名截止11月20日。','11月20日举办两项活动。次日另有交流：','11月20日举办两项活动。\n\n另一活动：']){
  const quote='14:00—15:00为影像交流，具体日期另行通知'
  const {result}=compile(heading+quote,[{key:'e',kind:'event',title:'影像交流',evidence:[quote],times:[{role:'start',raw:'14:00—15:00'}]}])
  assert.ok(result.timePoints.every(time=>!time.normalizedValue))
 }
})

test('a line-wrapped cutoff keeps its role and clock',()=>{
 for(const gap of ['\n','\r\n','\n\u00a0']){
  const source='请于'+gap+'11月18日17:00'+gap+'之前提交申请表。'
  const {result}=compile(source,[task(source,[{role:'deadline',raw:'11月18日17:00'}])])
  assert.equal(result.timePoints[0].normalizedValue,'2026-11-18T17:00')
 }
})
test('weekday decorations and wrapping do not erase a date-only cutoff',()=>{
 const source='请于2026年\n11月10日（星期二）\n前提交申请表。'
 const {result}=compile(source,[task(source,[{role:'deadline',raw:'2026年11月10日（星期二）前'}])])
 assert.equal(result.timePoints[0].normalizedValue,'2026-11-10')
})
test('a submission interval expressly closed to late applications ends at its endpoint',()=>{
 const source='申请资料提交时间：即日起至2026年11月18日18:00，逾期不受理。'
 const {result}=compile(source,[task(source,[{role:'deadline',raw:'即日起至2026年11月18日18:00'}])])
 assert.equal(result.timePoints[0].normalizedValue,'2026-11-18T18:00')
})
test('an ISO-like timestamp with a repeated footer uses its explicit date and clock',()=>{
 const source='报告题目：结构研讨。开始时间：2026-11-18 10:00:00。页脚：2026-11-18 10:00:00。'
 const {result}=compile(source,[{key:'e',kind:'event',title:'结构研讨',evidence:['报告题目：结构研讨','开始时间：2026-11-18 10:00:00'],times:[{role:'start',raw:'2026-11-18 10:00:00'}]}])
 assert.equal(result.timePoints[0].normalizedValue,'2026-11-18T10:00')
})
test('an incidental paraphrase moves intact into the event, without a second item',()=>{
 const source='创作交流会于11月18日14:00举行。有兴趣者可扫描原通知二维码入群，查看交流安排。'
 const notice='有兴趣者可扫描原通知二维码入群，查看交流安排'
 const {result}=compile(source,[{key:'e',kind:'event',title:'创作交流会',evidence:['创作交流会于11月18日14:00举行'],times:[{role:'start',raw:'11月18日14:00'}]},
  {key:'join',kind:'task',title:'加入创作交流群',action:'加入',object:'交流群',description:'自愿扫码入群了解交流安排',requirements:['入群后查看交流安排'],evidence:[notice],eventRelation:{kind:'incidental',eventKey:'e',evidence:notice}}])
 assert.equal(result.standaloneTasks.length,0)
 assert.match(result.events[0].description,/查看交流安排/u)
})
test('a different line deadline does not authorize a publication date',()=>{
 const source='发布日期：11月6日\n截止：11月18日17:00前提交申请表。'
 const {result}=compile(source,[task(source,[{role:'deadline',raw:'11月6日'}])])
 assert.equal(result.timePoints[0].normalizedValue,null)
})
test('repeated time citations resolve inside each owned submission',()=>{
 const source='申请表请在11月18日17:00前上传。签名页请在11月18日17:00前交服务台。'
 const {result}=compile(source,[task('申请表请在11月18日17:00前上传',[{role:'deadline',raw:'11月18日17:00前'}]),
  task('签名页请在11月18日17:00前交服务台',[{role:'deadline',raw:'11月18日17:00前'}],{key:'signature',title:'提交签名页',object:'签名页'})])
 assert.deepEqual(result.timePoints.map(point=>point.normalizedValue),['2026-11-18T17:00','2026-11-18T17:00'])
 const refs=result.timePoints.map(point=>result.evidence.find(ref=>ref.id===point.evidenceIds[0]).textStart)
 assert.ok(refs[0]<refs[1])
 assert.equal(locateOwnedSourceQuote('11月18日17:00前',source,[]),null)
})
test('a calendar window keeps final daily closing time, not morning opening',()=>{
 const source='提交申请表的窗口：2026年11月8日（中午12:00开始）—11月10日，每天早上9:00-晚上23:00。'
 const {result}=compile(source,[task(source,[{role:'window',raw:'2026年11月8日（中午12:00开始）—11月10日，每天早上9:00-晚上23:00'}])])
 assert.deepEqual(result.timePoints.map(point=>point.normalizedValue),['2026-11-08T12:00','2026-11-10T23:00'])
 assert.ok(result.timePoints.every(point=>point.type!=='task_deadline'))
})
test('a quoted abbreviated title and a scoped cancellation still cancel the event',()=>{
 const source='原定11月8日14:00举行的“某研究中心报告人：媒介实践”学术报告会因故取消。'
 const {result}=compile(source,[{key:'e',kind:'event',title:'“媒介实践”学术报告会',status:'cancelled',evidence:[source],times:[{role:'start',raw:'11月8日14:00'}]}])
 assert.equal(result.events.length,0)
})
test('a deictic cancellation binds to the named event across commas',()=>{
 const source='校友讲坛第三期讲座——《城市观察》，主讲嘉宾为某研究者，原定11月8日19:30举行，因场地维修现讲座取消。'
 const {result}=compile(source,[{key:'e',kind:'event',title:'校友讲坛第三期讲座《城市观察》',status:'cancelled',evidence:[source],times:[{role:'start',raw:'11月8日19:30'}]}])
 assert.equal(result.events.length,0)
})
test('superseded time without a literal cancellation does not leave an undated old event',()=>{
 const source='原定于11月8日18:00举行的主题分享会调整至11月10日18:00举行。'
 const event={kind:'event',evidence:[source]}
 const {result}=compile(source,[{...event,key:'old',title:'主题分享会（原定安排）',status:'cancelled',times:[{role:'start',raw:'11月8日18:00'}]},
 {...event,key:'new',title:'主题分享会',times:[{role:'start',raw:'11月10日18:00'}]}])
 assert.deepEqual(result.events.map(item=>item.title),['主题分享会'])
 assert.equal(result.timePoints[0].normalizedValue,'2026-11-10T18:00')
})
test('negation of the other selected branch does not cancel the paper choice',()=>{
 const source='可选择网上签约，或到服务台领取纸质协议。注意：网上签约无需领取纸质协议，网签与纸质协议二选一。'
 const {result}=compile(source,[task(source,[],{action:'领取',object:'纸质协议',title:'领取纸质协议',deliveryForm:'纸质版'})])
 assert.equal(result.standaloneTasks.length,1)
})

test('a universal prohibition still applies when another sentence offers a choice',()=>{
 const source='可选择网上咨询，或电话咨询，二选一。本通知禁止提交申请表。'
 const {result}=compile(source,[task(source,[])])
 assert.equal(result.standaloneTasks.length,0)
})
test('a model-declared choice cannot override an instruction to submit both',()=>{
 for(const instruction of ['两份材料都要交，不可任选其一','两份材料均为必交，不允许只二选一']){
  const a='11月19日17:00前提交申请表',b='11月19日17:00前提交签名页',source=a+'。'+b+'。'+instruction+'。'
  const {result}=compileSemanticNotice({topic:'材料提交',kind:'mixed',materials:[],items:[task(a,[],{evidence:[a,instruction],requirements:[instruction],choice:{key:'x',evidence:instruction}}),task(b,[],{key:'b',title:'提交签名页',object:'签名页',evidence:[b,instruction],requirements:[instruction],choice:{key:'x',evidence:instruction}})]},{source,referenceTime:'2026-11-06T09:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.7.0'})
  assert.equal(result.standaloneTasks.length,2)
  assert.equal(result.conflicts.filter(c=>c.id.startsWith('sem-choice-')).length,0)
 }
})
test('a window with morning and afternoon hours closes at the last daily endpoint',()=>{
 const raw='2026年12月30日至2027年1月2日，每天8:30—11:30、13:30—16:30'
 const {result}=compile('提交申请表的办理窗口：'+raw+'。',[task('提交申请表的办理窗口：'+raw,[{role:'window',raw}])])
 assert.deepEqual(result.timePoints.map(point=>point.normalizedValue),['2026-12-30T08:30','2027-01-02T16:30'])
})
test('an unparsed daily schedule retains date bounds instead of a false closing clock',()=>{
 const raw='2026年11月8日至11月10日，每天时段由预约短信告知'
 const {result}=compile('提交申请表的办理窗口：'+raw+'。',[task('提交申请表的办理窗口：'+raw,[{role:'window',raw}])])
 assert.deepEqual(result.timePoints.map(point=>point.normalizedValue),['2026-11-08','2026-11-10'])
})

test('declared alternatives retain different actions, deadlines and three branches',()=>{
 const source='领取结果任选一种。方式一：11月18日17:00前申请电子证明。方式二：11月19日12:00前预约邮寄纸质证明。方式三：11月20日16:00前现场领取证明。'
 const parts=[['申请','电子证明','11月18日17:00'],['预约','邮寄纸质证明','11月19日12:00'],['领取','证明','11月20日16:00']]
 const quotes=['方式一：11月18日17:00前申请电子证明','方式二：11月19日12:00前预约邮寄纸质证明','方式三：11月20日16:00前现场领取证明']
 const items=parts.map(([action,object,time],i)=>({key:'t'+i,kind:'task',title:action+object,action,object,evidence:[quotes[i]],times:[{role:'deadline',raw:time}],choice:{key:'result',evidence:'领取结果任选一种'}}))
 const {result}=compileSemanticNotice({topic:'领取结果',kind:'action',items,materials:[]},{source,referenceTime:'2026-11-06T09:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.7.0'})
 assert.equal(result.standaloneTasks.length,3)
 assert.deepEqual(result.timePoints.map(point=>point.normalizedValue),['2026-11-18T17:00','2026-11-19T12:00','2026-11-20T16:00'])
 assert.equal(result.conflicts.find(conflict=>conflict.id.startsWith('sem-choice-'))?.entityTempIds.length,3)
})

test('the candidate request negotiates its own version and uses one upstream call',async()=>{
 let calls=0,prompt=''
 const source='请于11月18日17:00前提交申请表，禁止伪造签名。'
 const worker=createWorker({logger:()=>{},fetcher:async(_url,init)=>{
  calls++;prompt=JSON.parse(init.body).messages[0].content
  return Response.json({model:'fixture-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify({topic:'申请',kind:'action',items:[task(source,[{role:'deadline',raw:'11月18日17:00'}])],materials:[]})}}],usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130}})
 }})
 const origin='https://student-affairs-manager.example'
 const response=await worker.fetch(new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json','X-Student-Affairs-Recognition':'semantic-notice-3.7'},body:JSON.stringify({content:source,sourceType:'text',referenceTime:'2026-11-06T09:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',ALLOWED_ORIGINS:origin,DEEPSEEK_GENERATION_MODE:'semantic-notice-3.0',RECOGNITION_LOCAL_ISOLATION_VERSION:'1.0.0',DEEPSEEK_MODEL:'deepseek-v4-flash',DEEPSEEK_EXTRACTION_MAX_TOKENS:'16384',EXTRACTION_RATE_LIMITER:{limit:async()=>({success:true})}})
 const body=await response.json()
 assert.equal(response.status,200)
 assert.equal(calls,1)
 assert.equal(body.execution.generationMode,'semantic-notice-3.7')
 assert.equal(body.execution.twoStep.compilerVersion,'semantic-notice-compiler-1.0.21')
 assert.match(prompt,/关系完整性复查/u)
 assert.equal(body.result.standaloneTasks.length,1)
})
