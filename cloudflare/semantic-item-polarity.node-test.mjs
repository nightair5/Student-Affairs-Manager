import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'

const compile=(source,items)=>compileSemanticNotice({topic:'匿名通知',kind:'mixed',items,materials:[]},{source,referenceTime:'2026-11-03T02:00:00Z',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.2.0'})
const task=(source,overrides={})=>({key:'task',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:[source],times:[{role:'deadline',raw:'11月8日17:00前'}],...overrides})

test('a prohibition on a different action preserves the submission and its deadline',()=>{
 const source='请于11月8日17:00前提交申请表，禁止伪造签名。'
 const {result,audit}=compile(source,[task(source,{requirements:['禁止伪造签名']})])
 assert.equal(result.standaloneTasks[0].title,'提交申请表')
 assert.equal(result.timePoints[0].normalizedValue,'2026-11-08T17:00')
 assert.deepEqual(result.standaloneTasks[0].completionCriteria,['禁止伪造签名'])
 assert.ok(!audit.losses.some(loss=>loss.reason==='CANCELLED_ITEM'))
})

test('an explicit prohibition of the same object is not revived as an affirmative action',()=>{
 for(const prefix of ['不得','请勿','禁止','不再']){
  const source=`${prefix}提交申请表。`
  const {result,audit}=compile(source,[task(source,{times:[]})])
  assert.equal(result.standaloneTasks.length,0,source)
  assert.ok(audit.losses.some(loss=>loss.reason==='CANCELLED_ITEM'),source)
 }
})

test('a short citation cannot hide a preceding prohibition',()=>{
 const source='请不要提交申请表。'
 const {result,audit}=compile(source,[task('提交申请表',{times:[]})])
 assert.equal(result.standaloneTasks.length,0)
 assert.ok(audit.losses.some(loss=>loss.reason==='CANCELLED_ITEM'))
})

test('a qualification cancellation does not cancel an otherwise active event',()=>{
 const source='欢迎参加职业讲座。抄袭者取消参赛资格。'
 const {result}=compile(source,[{key:'event',kind:'event',title:'职业讲座',evidence:['欢迎参加职业讲座。抄袭者取消参赛资格']}])
 assert.equal(result.events.length,1)
})

test('a cancelled event is dropped but its explicitly revised occurrence remains',()=>{
 const source='原定11月5日14:00的写作讲座取消，改为11月6日15:00举行。'
 const items=[{key:'old',kind:'event',status:'cancelled',title:'写作讲座',evidence:['原定11月5日14:00的写作讲座取消'],times:[{role:'start',raw:'11月5日14:00'}]},
  {key:'new',kind:'event',status:'active',title:'写作讲座',evidence:[source],times:[{role:'start',raw:'11月6日15:00'}]}]
 const {result}=compile(source,items)
 assert.equal(result.events.length,1)
 assert.deepEqual(result.timePoints.map(time=>time.normalizedValue),['2026-11-06T15:00'])
})

test('the cancelled original does not cancel a source-backed occurrence rescheduled elsewhere',()=>{
 const source='原定12月8日14:00在A101的研讨取消，改在12月10日15:00于B202举行。'
 const items=[{key:'old',kind:'event',status:'cancelled',title:'研讨（原安排）',evidence:['原定12月8日14:00在A101的研讨取消'],times:[{role:'start',raw:'12月8日14:00'}]},
  {key:'new',kind:'event',status:'active',title:'研讨（改期后）',evidence:['改在12月10日15:00于B202举行'],times:[{role:'start',raw:'12月10日15:00'}],location:'B202'}]
 const {result}=compile(source,items)
 assert.deepEqual(result.events.map(event=>event.title),['研讨（改期后）'])
 assert.deepEqual(result.timePoints.map(point=>point.normalizedValue),['2026-12-10T15:00'])
})

test('a later explicit cancellation of the revised event is not negated by an earlier revision',()=>{
 const source='原定12月8日14:00的研讨取消，改在12月10日15:00举行；后来研讨也取消。'
 const items=[{key:'new',kind:'event',status:'cancelled',title:'研讨（改期后）',evidence:['改在12月10日15:00举行','后来研讨也取消'],times:[{role:'start',raw:'12月10日15:00'}]}]
 const {result}=compile(source,items)
 assert.equal(result.events.length,0)
})

test('a dated revised display suffix cannot hide a subsequent cancellation',()=>{
 const source='原定12月8日14:00的参观活动取消，改在12月10日15:00举行；后来参观活动再次取消。'
 const items=[{key:'new',kind:'event',status:'cancelled',title:'参观活动（改至12月10日15:00）',evidence:['改在12月10日15:00举行','后来参观活动再次取消'],times:[{role:'start',raw:'12月10日15:00'}]}]
 assert.equal(compile(source,items).result.events.length,0)
})

test('a source-supported cancelled event remains cancelled when the displayed title omits 的',()=>{
 const source='周日的体验活动因场地维修取消，不再另约。'
 const {result}=compile(source,[{key:'event',kind:'event',status:'cancelled',title:'周日体验活动',evidence:[source]}])
 assert.equal(result.events.length,0)
})

test('a cited explicit all-cancelled conclusion covers the original and revision of one event',()=>{
 const source='艺术体验课原定12月7日15:00，后改至12月8日14:00；现通知：体验课因场地调整全部取消，不再另约。'
 const items=[{key:'old',kind:'event',status:'cancelled',title:'艺术体验课（原定12月7日15:00）',evidence:['艺术体验课原定12月7日15:00'],times:[{role:'start',raw:'12月7日15:00'}]},
  {key:'new',kind:'event',status:'cancelled',title:'艺术体验课（改至12月8日14:00）',evidence:['后改至12月8日14:00','体验课因场地调整全部取消，不再另约'],times:[{role:'start',raw:'12月8日14:00'}]}]
 const {result}=compileSemanticNotice({topic:'体验课调整',kind:'information',items,materials:[]},{source,referenceTime:'2026-11-03T02:00:00Z',timezone:'Asia/Shanghai'})
 assert.equal(result.events.length,0)
})

test('an all-cancelled clause for a different event does not suppress the named event',()=>{
 const source='艺术体验课原定12月7日15:00；现通知：音乐体验课因场地调整全部取消，不再另约。'
 const items=[{key:'art',kind:'event',status:'cancelled',title:'艺术体验课（原定12月7日15:00）',evidence:['艺术体验课原定12月7日15:00','音乐体验课因场地调整全部取消，不再另约'],times:[{role:'start',raw:'12月7日15:00'}]}]
 const {result}=compileSemanticNotice({topic:'安排调整',kind:'information',items,materials:[]},{source,referenceTime:'2026-11-03T02:00:00Z',timezone:'Asia/Shanghai'})
 assert.equal(result.events.length,1)
 assert.equal(result.events[0].sourceStatus,'uncertain')
})

test('a cancelled event stays cancelled when its name and cancellation surround time and location',()=>{
 const source='分享会11月8日14:00在A201举办已取消。'
 const {result}=compile(source,[{key:'event',kind:'event',title:'分享会',evidence:['分享会11月8日14:00在A201举办已取消'],times:[{role:'start',raw:'11月8日14:00'}],location:'A201'}])
 assert.equal(result.events.length,0)
})

test('a dated prefix or cancelled suffix in a display title does not resurrect its cited old event',()=>{
 const sources=[
  {source:'原定12月7日10:00在A楼举办的开放讲座取消，改到12月9日14:00在B楼举办。',title:'原定12月7日开放讲座',oldTime:'12月7日10:00',newTime:'12月9日14:00'},
  {source:'原定12月7日10:00在A楼举办的开放讲座取消，改到12月9日14:00在B楼举办。',title:'开放讲座（已取消）',oldTime:'12月7日10:00',newTime:'12月9日14:00'},
 ]
 for(const {source,title,oldTime,newTime} of sources){
  const items=[{key:'old',kind:'event',title,status:'cancelled',evidence:[source.split('，')[0]],times:[{role:'start',raw:oldTime}]},
   {key:'new',kind:'event',title:'开放讲座（改期后）',status:'active',evidence:[source.split('，')[1]],times:[{role:'start',raw:newTime}]}]
  const {result}=compile(source,items)
  assert.deepEqual(result.events.map(item=>item.title),['开放讲座（改期后）'])
  assert.deepEqual(result.timePoints.map(point=>point.normalizedValue),['2026-12-09T14:00'])
 }
})

test('a model cancellation without source support remains locally uncertain',()=>{
 const source='请于11月8日17:00前提交申请表。'
 const {result,audit}=compile(source,[task(source,{status:'cancelled'})])
 assert.equal(result.standaloneTasks.length,1)
 assert.equal(result.standaloneTasks[0].selected,false)
 assert.ok(audit.losses.some(loss=>loss.reason==='CANCELLATION_SCOPE_UNCERTAIN'))
})

test('a prohibition of one format does not cancel a different delivery',()=>{
 const source='请提交电子版申请表，不得提交纸质版申请表。'
 const {result}=compile(source,[task('请提交电子版申请表',{title:'提交电子版申请表',object:'电子版申请表',times:[]}),task('不得提交纸质版申请表',{key:'paper',title:'提交纸质版申请表',object:'纸质版申请表',times:[]})])
 assert.deepEqual(result.standaloneTasks.map(item=>item.title),['提交电子版申请表'])
})

test('a forbidden paper branch does not cancel a separate electronic branch with the same object',()=>{
 const source='请提交电子版申请表，不得提交纸质版申请表。'
 const {result}=compile(source,[task(source,{title:'提交电子版申请表',object:'申请表',deliveryForm:'电子版',times:[]})])
 assert.equal(result.standaloneTasks.length,1)
})

test('a display suffix on an old event does not revive it after rescheduling',()=>{
 const source='原定11月10日15:00在A101举行的就业分享会取消，改到11月12日14:00在B202举行。'
 const items=[{key:'old',kind:'event',status:'cancelled',title:'就业分享会（原安排）',evidence:['原定11月10日15:00在A101举行的就业分享会取消'],times:[{role:'start',raw:'11月10日15:00'}]},
  {key:'new',kind:'event',status:'active',title:'就业分享会（改期后）',evidence:['改到11月12日14:00在B202举行'],times:[{role:'start',raw:'11月12日14:00'}]}]
 const {result}=compile(source,items)
 assert.deepEqual(result.events.map(item=>item.title),['就业分享会（改期后）'])
 assert.deepEqual(result.timePoints.map(point=>point.normalizedValue),['2026-11-12T14:00'])
})

test('a cancelled original event stays cancelled when the display suffix contains its original date',()=>{
 const source='原定11月6日14:00的阅读讲座取消，改为11月9日15:00在文苑楼举行。'
 const items=[{key:'old',kind:'event',status:'cancelled',title:'阅读讲座（原定11月6日14:00）',evidence:['原定11月6日14:00的阅读讲座取消'],times:[{role:'start',raw:'11月6日14:00'}]},
  {key:'new',kind:'event',status:'active',title:'阅读讲座（改期至11月9日15:00）',evidence:['改为11月9日15:00在文苑楼举行'],times:[{role:'start',raw:'11月9日15:00'}],location:'文苑楼'}]
 const {result}=compile(source,items)
 assert.deepEqual(result.events.map(item=>item.title),['阅读讲座（改期至11月9日15:00）'])
 assert.deepEqual(result.timePoints.map(point=>point.normalizedValue),['2026-11-09T15:00'])
})

test('cancelling one explicitly cited delivery form does not revive it or cancel another',()=>{
 const source='原要求11月12日交纸质调查表，现取消纸质提交。电子问卷仍需在11月14日18:00前填写并在线提交。'
 const items=[task('原要求11月12日交纸质调查表',{key:'paper',title:'提交纸质调查表',action:'提交',object:'调查表',deliveryForm:'纸质版',status:'cancelled',evidence:['原要求11月12日交纸质调查表','现取消纸质提交'],times:[]}),
  task('电子问卷仍需在11月14日18:00前填写并在线提交',{key:'online',title:'填写并在线提交电子问卷',action:'填写并在线提交',object:'电子问卷',deliveryForm:'电子版',times:[{role:'deadline',raw:'11月14日18:00前'}]})]
 const {result}=compile(source,items)
 assert.deepEqual(result.standaloneTasks.map(item=>item.title),['填写并在线提交电子问卷'])
})

test('an explicitly same-day second activity keeps its own time range and place',()=>{
 const source='第一场读书会在12月11日9:00—10:00于明德楼201举行；第二场工作坊在当天10:30—12:00于明德楼202举行。'
 const items=[{key:'first',kind:'event',title:'读书会',evidence:['第一场读书会在12月11日9:00—10:00于明德楼201举行'],location:'明德楼201',times:[{role:'start',raw:'12月11日9:00—10:00'},{role:'end',raw:'12月11日9:00—10:00'}]},
  {key:'second',kind:'event',title:'工作坊',evidence:['第二场工作坊在当天10:30—12:00于明德楼202举行'],location:'明德楼202',times:[{role:'start',raw:'当天10:30—12:00'},{role:'end',raw:'当天10:30—12:00'}]}]
 const {result}=compile(source,items)
 assert.deepEqual(result.events.map(event=>event.location),['明德楼201','明德楼202'])
 assert.deepEqual(result.timePoints.map(point=>point.normalizedValue),['2026-12-11T09:00','2026-12-11T10:00','2026-12-11T10:30','2026-12-11T12:00'])
})

test('an overlong event explanation is explicitly marked partial instead of silently complete',()=>{
 const content='公开活动说明'.repeat(220),source='关于公开活动的唯一说明。'+content
 const {result,audit}=compile(source,[{key:'event',kind:'event',title:'公开活动',evidence:['关于公开活动的唯一说明'],content}])
 assert.equal(result.events.length,1)
 assert.ok(audit.losses.some(loss=>loss.reason==='ITEM_FIELD_TRUNCATED'))
 assert.equal(result.quality.needsHumanReview,true)
 assert.ok(result.quality.reviewReasons.some(reason=>reason.includes('部分内容')))
})
