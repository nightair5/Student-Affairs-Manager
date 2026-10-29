import test from 'node:test'
import assert from 'node:assert/strict'
import {twoStepExamples,twoStepSystemPrompt,validateExampleAlignment} from './recognition-two-step-contract-v2-3.mjs'
import {compileTwoStep} from './recognition-two-step-compiler-v2-1-12.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'
import {createWorker} from './worker.mjs'

const opt=source=>({source,referenceTime:'2028-04-01T12:00:00+08:00',timezone:'Asia/Shanghai',version:'recognition-two-step-2.3.0'})
test('candidate has independently aligned examples and valid existing public result',()=>{
 assert(validateExampleAlignment());assert(twoStepSystemPrompt().length<=3000)
 const [source,raw]=twoStepExamples[0],compiled=compileTwoStep(raw,opt(source)),e=compiled.result.events[0]
 assert.match(e.description,/主讲人：周老师，研究员/u)
 assert.match(e.description,/活动内容：讲解资料检索方法/u)
 assert.match(e.description,/参加须知：请提前入场/u)
 assert.equal(compiled.result.timePoints.length,2)
 assert(validateRecognitionResult(compiled.result,{sourceContent:source}).valid)
 for(const evidence of compiled.result.evidence.filter(x=>x.id.startsWith('g2-detail')))assert.equal(source.slice(evidence.textStart,evidence.textEnd),evidence.quote)
})
test('event details stay with their declared activity; missing detail does not delete an event or change dates',()=>{
 const source='上午举办读书讲座。主讲人：高老师。下午举办科技讲座。主讲人：林老师。',raw={items:[{id:'a',kind:'活动',name:'读书讲座',quote:'读书讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'主讲人',item:'a',quote:'主讲人：高老师'},{type:'主讲人',item:'b',quote:'主讲人：林老师'},{type:'活动内容',item:'b',quote:'未提供的内容'}],noAction:true},c=compileTwoStep(raw,opt(source))
 assert.match(c.result.events[0].description,/高老师/u);assert.doesNotMatch(c.result.events[0].description,/林老师/u)
 assert.match(c.result.events[1].description,/林老师/u);assert.equal(c.result.events.length,2)
 assert(c.audit.losses.some(x=>x.reason==='EVENT_DETAIL_UNALIGNED'))
})
test('a model fact assigned to a different named event in the same sentence is isolated',()=>{
 const source='读书讲座主讲人是高老师。科技讲座主讲人是林老师。',raw={items:[{id:'a',kind:'活动',name:'读书讲座',quote:'读书讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'主讲人',item:'a',quote:'主讲人是林老师'}],noAction:true},c=compileTwoStep(raw,opt(source))
 assert.doesNotMatch(c.result.events[0].description,/林老师/u)
 assert(c.audit.losses.some(x=>x.reason==='EVENT_DETAIL_CONTRADICTS_SOURCE_SCOPE'))
})
test('numbered sections isolate a speaker assigned to an activity in a different section',()=>{
 const source='一、阅读讲座。\n主讲人：高老师。\n\n二、科技讲座。\n主讲人：林老师。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'主讲人',item:'a',quote:'主讲人：高老师'},{type:'主讲人',item:'a',quote:'主讲人：林老师'}],noAction:true},c=compileTwoStep(raw,opt(source))
 assert.match(c.result.events[0].description,/高老师/u)
 assert.doesNotMatch(c.result.events[0].description,/林老师/u)
 assert.doesNotMatch(c.result.events[1].description,/林老师/u)
 assert(c.audit.losses.some(x=>x.reason==='EVENT_DETAIL_CONTRADICTS_SOURCE_SCOPE'&&x.scope==='PARAGRAPH'))
})
test('speaker below a numbered heading stays with its own activity',()=>{
 const source='一、阅读讲座。\n主讲人：高老师。\n\n二、科技讲座。\n主讲人：林老师。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'主讲人',item:'a',quote:'主讲人：高老师'},{type:'主讲人',item:'b',quote:'主讲人：林老师'}],noAction:true},c=compileTwoStep(raw,opt(source))
 assert.match(c.result.events[0].description,/高老师/u);assert.doesNotMatch(c.result.events[0].description,/林老师/u)
 assert.match(c.result.events[1].description,/林老师/u);assert.doesNotMatch(c.result.events[1].description,/高老师/u)
})
test('a separate paragraph within a numbered section cannot attach its speaker to another section',()=>{
 const source='一、阅读讲座。\n\n主讲人：高老师。\n\n二、科技讲座。\n\n主讲人：林老师。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'主讲人',item:'a',quote:'主讲人：林老师'}],noAction:true},c=compileTwoStep(raw,opt(source))
 assert.doesNotMatch(c.result.events[0].description,/林老师/u)
 assert(c.audit.losses.some(x=>x.reason==='EVENT_DETAIL_CONTRADICTS_SOURCE_SCOPE'&&x.scope==='NUMBERED_SECTION'))
 raw.facts[0].item='b'
 const correct=compileTwoStep(raw,opt(source))
 assert.match(correct.result.events[1].description,/林老师/u)
})
test('repeated detail quotes use only source-verified hint offsets and retain original fact indexes',()=>{
 const source='一、阅读讲座。请提前入场。\n\n二、科技讲座。请提前入场。',quote='请提前入场',a=source.indexOf(quote),b=source.lastIndexOf(quote)
 const raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'参加须知',item:'a',quote},{type:'地点',item:'a',quote:'不存在地点'},{type:'参加须知',item:'b',quote}],noAction:true}
 const hint=(index,start)=>({index,span:{start,end:start+quote.length,literal:quote,rule:'EXACT_UNIQUE_SOURCE_SPAN'}})
 const c=compileTwoStep(raw,{...opt(source),alignmentHints:{items:[],facts:[hint(0,a),hint(2,b)]}})
 assert.match(c.result.events[0].description,/参加须知：请提前入场/u);assert.match(c.result.events[1].description,/参加须知：请提前入场/u)
 assert.deepEqual(c.result.evidence.filter(e=>e.id.startsWith('g2-detail')).map(e=>e.textStart),[a,b])
 const invalid=compileTwoStep(raw,{...opt(source),alignmentHints:{items:[],facts:[hint(0,a+1),hint(2,b)]}})
 assert.doesNotMatch(invalid.result.events[0].description,/参加须知：请提前入场/u)
 assert(invalid.audit.losses.some(e=>e.reason==='EVENT_DETAIL_UNALIGNED'))
 const wrong=compileTwoStep(raw,{...opt(source),alignmentHints:{items:[],facts:[hint(0,b),hint(2,b)]}})
 assert.doesNotMatch(wrong.result.events[0].description,/参加须知：请提前入场/u)
 assert(wrong.audit.losses.some(e=>e.reason==='EVENT_DETAIL_CONTRADICTS_SOURCE_SCOPE'))
})
test('eligibility in another numbered activity does not suppress voluntary attendance',()=>{
 const source='一、阅读讲座。\n欢迎感兴趣的同学参加。\n\n二、科技讲座。\n仅限入选学生参加。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'参加须知',item:'a',quote:'欢迎感兴趣的同学参加'},{type:'条件',item:'b',quote:'仅限入选学生参加'}],noAction:true},c=compileTwoStep(raw,opt(source))
 assert.equal(c.result.events[0].selected,true)
 assert.equal(c.result.events[1].selected,false)
 assert.match(c.result.events[0].description,/欢迎感兴趣/u)
 assert.match(c.result.events[1].description,/适用条件待确认/u)
})
test('source-backed eligibility survives an additional voluntary invitation',()=>{
 for(const condition of ['已报名的同学','持学生证的同学','有意向的本院学生','仅对通过审核的学生开放，欢迎有意向者参加']){
  const source=`阅读讲座。${condition}欢迎感兴趣的同学参加。`,raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'}],facts:[{type:'条件',item:'a',quote:condition},{type:'参加须知',item:'a',quote:'欢迎感兴趣的同学参加'}],noAction:true},c=compileTwoStep(raw,opt(source))
  assert.equal(c.result.events[0].selected,false,condition)
  assert(c.result.evidence.some(e=>e.field==='requirement'&&e.quote===condition&&c.result.events[0].evidenceIds.includes(e.id)))
 }
})
test('same sentence activities do not exchange a speaker or guess an unassigned name',()=>{
 const source='阅读讲座由高老师主讲，科技讲座由林老师主讲。',base={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[],noAction:true}
 for(const quote of ['科技讲座由林老师主讲','林老师']){
  const r=compileTwoStep({...base,facts:[{type:'主讲人',item:'a',quote}]},opt(source))
  assert.doesNotMatch(r.result.events[0].description,/林老师/u)
  assert(r.audit.losses.some(e=>e.reason==='EVENT_DETAIL_CONTRADICTS_SOURCE_SCOPE'))
 }
 const good=compileTwoStep({...base,facts:[{type:'主讲人',item:'b',quote:'科技讲座由林老师主讲'}]},opt(source))
 assert.match(good.result.events[1].description,/林老师/u)
 const first=compileTwoStep({...base,facts:[{type:'主讲人',item:'a',quote:'高老师'},{type:'主讲人',item:'b',quote:'林老师'}]},opt(source))
 assert.match(first.result.events[0].description,/高老师/u);assert.match(first.result.events[1].description,/林老师/u)
})
test('vital details are retained before long biography within the existing description limit',()=>{
 const bio1='甲'.repeat(390),bio2='乙'.repeat(390),note='请提前入场并携带资料',source='学术讲座。'+bio1+'。'+bio2+'。'+note+'。',raw={items:[{id:'a',kind:'活动',name:'学术讲座',quote:'学术讲座'}],facts:[{type:'嘉宾简介',item:'a',quote:bio1},{type:'嘉宾简介',item:'a',quote:bio2},{type:'参加须知',item:'a',quote:note}],noAction:true},c=compileTwoStep(raw,opt(source))
 assert.match(c.result.events[0].description,/参加须知：请提前入场并携带资料/u)
 assert(c.result.events[0].description.length<=800)
 assert(c.audit.losses.some(e=>e.reason==='EVENT_DETAIL_EXCEEDS_DESCRIPTION_LIMIT'))
})
test('a source event title restores a paraphrased model title with its time, not an unsupported generic phrase',()=>{
 const source='职业发展指导讲座于11月2日举办。',raw={items:[{id:'a',kind:'活动',name:'职业规划辅导讲座',quote:'职业发展指导讲座'}],facts:[{type:'开始',item:'a',quote:'11月2日'}],noAction:true},c=compileTwoStep(raw,opt(source))
 assert.equal(c.result.events[0].title,'职业发展指导讲座')
 assert.equal(c.result.timePoints[0].normalizedValue,'2028-11-02')
 assert(c.audit.items.some(a=>a.rule==='EVENT_TITLE_FROM_EXPLICIT_LITERAL_QUOTE'))
 const bad={...raw,items:[{...raw.items[0],quote:'11月2日举办'}]}
 assert.equal(compileTwoStep(bad,opt(source)).result.events.length,0)
 const cancelled='职业发展指导讲座取消，11月2日不再举办。'
 assert.equal(compileTwoStep(raw,opt(cancelled)).result.events.length,0)
 const cancelledLater='职业发展指导讲座原定11月2日举行。很遗憾，该活动已经取消。'
 assert.equal(compileTwoStep(raw,opt(cancelledLater)).result.events.length,0)
 const otherCancelled='职业发展指导讲座于11月2日举办。科技分享会已取消。'
 assert.equal(compileTwoStep(raw,opt(otherCancelled)).result.events[0].title,'职业发展指导讲座')
})
test('an already-created event and its attendance task are removed when that activity is cancelled, not an unrelated task',()=>{
 const source='一、阅读讲座于11月2日举办。请参加该活动。该活动已经取消。请提交作业。\n二、科技讲座于11月3日举办。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'},{id:'b',kind:'任务',name:'参加该活动',quote:'参加该活动'},{id:'c',kind:'任务',name:'提交作业',quote:'提交作业'},{id:'d',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'开始',item:'a',quote:'11月2日'},{type:'开始',item:'d',quote:'11月3日'}],noAction:false},c=compileTwoStep(raw,opt(source))
 assert(!c.result.events.some(e=>e.title==='阅读讲座'));assert(c.result.events.some(e=>e.title==='科技讲座'))
 assert(!c.result.standaloneTasks.some(t=>t.actionObject==='该活动'));assert(c.result.standaloneTasks.some(t=>t.actionObject==='作业'))
 assert(!c.result.timePoints.some(t=>t.normalizedValue==='2028-11-02'));assert(c.result.timePoints.some(t=>t.normalizedValue==='2028-11-03'))
 assert(c.audit.losses.some(e=>e.reason==='SOURCE_EVENT_REVISION_ISOLATED'))
})
test('an explicit revised date replaces the old event date while preserving the event',()=>{
 const source='阅读讲座原定11月2日举行。该活动改为11月3日举行。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'}],facts:[{type:'开始',item:'a',quote:'11月2日'}],noAction:true},c=compileTwoStep(raw,opt(source)),event=c.result.events[0]
 assert(event);assert.equal(c.result.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.normalizedValue,'2028-11-03')
 assert(!c.result.timePoints.some(p=>p.normalizedValue==='2028-11-02'))
 assert(c.audit.losses.some(e=>e.reason==='SOURCE_EVENT_REVISED_TIME_RESTORED'))
})
test('a changed activity with no new date remains visible with an unknown time',()=>{
 const source='阅读讲座原定11月2日举行。该活动延期，具体时间另行通知。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'}],facts:[{type:'开始',item:'a',quote:'11月2日'}],noAction:true},c=compileTwoStep(raw,opt(source)),event=c.result.events[0]
 assert(event);assert.equal(event.startTimePointTempId,null);assert.equal(event.selected,false)
 assert(!c.result.timePoints.some(p=>p.normalizedValue==='2028-11-02'))
 assert(c.audit.losses.some(e=>e.reason==='SOURCE_EVENT_REVISED_TIME_UNKNOWN'))
})
test('negated cancellation and cancellation of a registration restriction preserve the activity',()=>{
 for(const sentence of ['该活动不取消','该活动并未取消','该活动取消报名限制','阅读讲座不会取消']){
  const source=`阅读讲座将于11月2日举办。${sentence}。`,raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座将于11月2日举办'}],facts:[{type:'开始',item:'a',quote:'11月2日'}],noAction:true},c=compileTwoStep(raw,opt(source))
  assert.equal(c.result.events.length,1,sentence);assert.equal(c.result.timePoints[0].normalizedValue,'2028-11-02')
 }
 const same='阅读讲座不取消，11月2日举办。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'}],facts:[{type:'开始',item:'a',quote:'11月2日'}],noAction:true}
 assert.equal(compileTwoStep(raw,opt(same)).result.events.length,1)
})
test('changing the format to online preserves the original event date',()=>{
 const source='阅读讲座将于11月2日举办。该活动改为线上举行。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'}],facts:[{type:'开始',item:'a',quote:'11月2日'}],noAction:true},c=compileTwoStep(raw,opt(source)),event=c.result.events[0]
 assert(event);assert.equal(c.result.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.normalizedValue,'2028-11-02')
})
test('candidate selected by env while 2.1 generation request is unchanged',async()=>{
 const [source,raw]=twoStepExamples[0],origin='https://test.example',sent=[]
 const worker=createWorker({logger:()=>{},fetcher:async(_,init)=>{sent.push(JSON.parse(init.body));return Response.json({model:'deepseek-flash',choices:[{message:{content:JSON.stringify(raw)},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}})}})
 const req=()=>new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({content:source,sourceType:'text',referenceTime:opt(source).referenceTime,timezone:'Asia/Shanghai'})})
 const env={ALLOWED_ORIGINS:origin,DEEPSEEK_API_KEY:'server-only-test-key',DEEPSEEK_EXTRACTION_MAX_TOKENS:'16384',TWO_STEP_COMPILER_VERSION:'2.1.11'}
 const r=await worker.fetch(req(),{...env,DEEPSEEK_GENERATION_MODE:'two-step-2.3'}),json=await r.json()
 assert.equal(r.status,200,JSON.stringify(json));assert.equal(json.result.promptVersion,'recognition-two-step-2.3.0')
 assert.match(json.result.events[0].description,/主讲人：周老师/u)
 assert.equal(sent[0].messages[0].content,twoStepSystemPrompt())
})

test('candidate preserves a location name beginning with 至 and only removes explicit prepositions',()=>{
 for(const [quote,expected] of [['至善楼309','至善楼309'],['地点：至善楼309','至善楼309'],['在至善楼309举行','至善楼309'],['到北楼报告厅举办','北楼报告厅']]){
  const source=`阅读讲座。${quote}。`,raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'}],facts:[{type:'地点',item:'a',quote}],noAction:true},result=compileTwoStep(raw,opt(source))
  assert.equal(result.result.events[0]?.location,expected,quote)
 }
})
test('locations stay with their activity and merge without deleting first characters',()=>{
 const source='一、阅读讲座。地点：至善楼309。地址：南校区。\n二、科技讲座。地点：北楼报告厅。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'地点',item:'a',quote:'至善楼309'},{type:'地点',item:'a',quote:'南校区'},{type:'地点',item:'b',quote:'北楼报告厅'}],noAction:true},c=compileTwoStep(raw,opt(source))
 assert.equal(c.result.events[0].location,'至善楼309 · 南校区')
 assert.equal(c.result.events[1].location,'北楼报告厅')
})
test('a source-aligned location preposition can be removed when the following verb proves its role',()=>{
 const source='阅读讲座在会议室举行。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'}],facts:[{type:'地点',item:'a',quote:'在会议室'}],noAction:true}
 assert.equal(compileTwoStep(raw,opt(source)).result.events[0].location,'会议室')
})
test('a location from another numbered activity cannot be borrowed even if the model assigns it there',()=>{
 const source='一、阅读讲座。\n地点：南楼会议室。\n二、科技讲座。\n地点：北楼报告厅。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'地点',item:'a',quote:'北楼报告厅'},{type:'地点',item:'b',quote:'南楼会议室'}],noAction:true},c=compileTwoStep(raw,opt(source))
 assert.equal(c.result.events[0].location,null);assert.equal(c.result.events[1].location,null)
 assert.equal(c.audit.losses.filter(x=>x.reason==='LOCATION_CONTRADICTS_SOURCE_SCOPE').length,2)
})
test('two activities in the same sentence do not exchange ambiguous locations',()=>{
 const source='读书讲座和科技讲座分别在南楼和北楼举行。',raw={items:[{id:'a',kind:'活动',name:'读书讲座',quote:'读书讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'地点',item:'a',quote:'北楼'},{type:'地点',item:'b',quote:'南楼'}],noAction:true},c=compileTwoStep(raw,opt(source))
 assert.equal(c.result.events[0].location,null);assert.equal(c.result.events[1].location,null)
})
test('numbered activities cannot borrow another section time, including explicit dates and bare weekdays',()=>{
 for(const [first,second,referenceTime] of [['2026年10月29日09:00','2026年10月30日14:00','2026-10-29T08:00:00+08:00'],['周四 09:00','周五 14:00','2026-10-29T08:00:00+08:00']]){
  const source=`一、读书讲座。时间：${first}。地点：南楼。\n二、科技讲座。时间：${second}。地点：北楼。`,items=[{id:'a',kind:'活动',name:'读书讲座',quote:'读书讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts=[{type:'开始',item:'a',quote:second},{type:'开始',item:'b',quote:first},{type:'地点',item:'a',quote:'南楼'},{type:'地点',item:'b',quote:'北楼'}]
  const c=compileTwoStep({items,facts,noAction:true},{...opt(source),referenceTime})
  assert.equal(c.result.events[0].location,'南楼');assert.equal(c.result.events[1].location,'北楼')
  for(const event of c.result.events)assert.equal(c.result.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.normalizedValue??null,null)
  assert.equal(c.audit.losses.filter(x=>x.reason==='EVENT_TIME_CONTRADICTS_OR_AMBIGUOUS_IN_SOURCE_SCOPE').length,2)
  const correct=compileTwoStep({items,facts:[{type:'开始',item:'a',quote:first},{type:'开始',item:'b',quote:second}],noAction:true},{...opt(source),referenceTime})
  assert(correct.result.events.every(event=>correct.result.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.normalizedValue))
 }
})
test('two activities in the same sentence do not receive an ambiguous weekday time',()=>{
 const source='读书讲座和科技讲座分别于周四 09:00和周五 14:00举办。',raw={items:[{id:'a',kind:'活动',name:'读书讲座',quote:'读书讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'开始',item:'a',quote:'周五 14:00'},{type:'开始',item:'b',quote:'周四 09:00'}],noAction:true},c=compileTwoStep(raw,{...opt(source),referenceTime:'2026-10-29T08:00:00+08:00'})
 for(const event of c.result.events)assert.equal(c.result.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.normalizedValue??null,null)
})
test('slash dates remain unresolved while preserving original evidence',()=>{
 const quote='2025/10/27 14:00—16:00',source='阅读讲座。时间：'+quote+'。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'}],facts:[{type:'开始',item:'a',quote}],noAction:true},c=compileTwoStep(raw,{...opt(source),referenceTime:'2025-10-01T12:00:00+08:00'}),event=c.result.events[0]
 assert.equal(c.result.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.normalizedValue,null)
 assert.equal(event.endTimePointTempId,null)
 assert.equal(c.result.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.rawText,quote)
 assert(c.result.evidence.some(e=>e.quote===quote&&source.slice(e.textStart,e.textEnd)===quote))
 for(const bad of ['2025/02/30 14:00','10/27 14:00','2025/13/27 14:00']){
  const s='阅读讲座。时间：'+bad+'。',r=compileTwoStep({...raw,facts:[{type:'开始',item:'a',quote:bad}]},{...opt(s),referenceTime:'2025-10-01T12:00:00+08:00'})
  assert.equal(r.result.timePoints[0].normalizedValue,null,bad)
 }
})
test('two activities on separate lines retain their own unambiguous dates',()=>{
 const source='读书讲座 10月30日09:00\n科技讲座 11月1日14:00',raw={items:[{id:'a',kind:'活动',name:'读书讲座',quote:'读书讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'开始',item:'a',quote:'10月30日09:00'},{type:'开始',item:'b',quote:'11月1日14:00'}],noAction:true},c=compileTwoStep(raw,{...opt(source),referenceTime:'2026-10-29T08:00:00+08:00'})
 assert.equal(c.result.timePoints.find(p=>p.tempId===c.result.events[0].startTimePointTempId)?.normalizedValue,'2026-10-30T09:00')
 assert.equal(c.result.timePoints.find(p=>p.tempId===c.result.events[1].startTimePointTempId)?.normalizedValue,'2026-11-01T14:00')
 const swapped=compileTwoStep({...raw,facts:[{type:'开始',item:'a',quote:'11月1日14:00'},{type:'开始',item:'b',quote:'10月30日09:00'}]},{...opt(source),referenceTime:'2026-10-29T08:00:00+08:00'})
 for(const e of swapped.result.events)assert.equal(swapped.result.timePoints.find(p=>p.tempId===e.startTimePointTempId)?.normalizedValue??null,null)
})
test('speaker history, recurring meetings, and signup deadlines do not become a weekday activity start',()=>{
 for(const [source,quote] of [
  ['读书讲座。主讲嘉宾此前于2024/10/27 14:00获得教学奖。具体讲座时间另行通知。','2024/10/27 14:00'],
  ['读书讲座。讲师每周四中午12:40参加例会。具体讲座时间另行通知。','周四中午12:40'],
  ['读书讲座。报名截止2026/10/27 14:00。讲座时间另行通知。','2026/10/27 14:00'],
  ['读书讲座。报名截止时间：周四 12:40。讲座时间另行通知。','周四 12:40'],
 ]){
  const raw={items:[{id:'a',kind:'活动',name:'读书讲座',quote:'读书讲座'}],facts:[{type:'开始',item:'a',quote}],noAction:true},c=compileTwoStep(raw,{...opt(source),referenceTime:'2026-10-29T08:00:00+08:00'}),e=c.result.events[0]
  assert.equal(c.result.timePoints.find(p=>p.tempId===e.startTimePointTempId)?.normalizedValue??null,null,source)
 }
})
test('candidate resolves a bare weekday only in the fixed reference week, retaining uncertainty',()=>{
 const source='阅读讲座。时间：周四 中午 12:40。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'}],facts:[{type:'开始',item:'a',quote:'周四 中午 12:40'}],noAction:true}
 const fixed={...opt(source),referenceTime:'2026-10-29T13:55:17+08:00'},c=compileTwoStep(raw,fixed),event=c.result.events[0],p=c.result.timePoints.find(x=>x.tempId===event.startTimePointTempId)
 assert.equal(p.normalizedValue,'2026-10-29T12:40');assert.equal(p.needsConfirmation,true);assert.equal(event.endTimePointTempId,null)
 assert.match(event.description,/星期日期按通知接收时间推算/u)
 assert.equal(compileTwoStep(raw,fixed).result.timePoints.find(x=>x.tempId===event.startTimePointTempId).normalizedValue,p.normalizedValue)
 for(const referenceTime of ['2026-10-30T09:00:00+08:00','invalid'])assert.equal(compileTwoStep(raw,{...fixed,referenceTime}).result.timePoints[0].normalizedValue,null)
 const noClock=source.replace(' 中午 12:40',''),withoutClock={...raw,facts:[{type:'开始',item:'a',quote:'周四'}]}
 assert.equal(compileTwoStep(withoutClock,{...fixed,source:noClock}).result.timePoints[0].normalizedValue,null)
})
test('worker returns the candidate weekday and original location without manufacturing an end',async()=>{
 const source='阅读讲座。时间：周四 中午 12:40。地点：至善楼309。',raw={items:[{id:'a',kind:'活动',name:'阅读讲座',quote:'阅读讲座'}],facts:[{type:'开始',item:'a',quote:'周四 中午 12:40'},{type:'地点',item:'a',quote:'至善楼309'}],noAction:true},origin='https://test.example'
 const worker=createWorker({logger:()=>{},fetcher:async()=>Response.json({model:'deepseek-flash',choices:[{message:{content:JSON.stringify(raw)},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}})})
 const req=new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({content:source,sourceType:'text',referenceTime:'2026-10-29T13:55:17+08:00',timezone:'Asia/Shanghai'})})
 const response=await worker.fetch(req,{ALLOWED_ORIGINS:origin,DEEPSEEK_API_KEY:'server-only-test-key',DEEPSEEK_GENERATION_MODE:'two-step-2.3',TWO_STEP_COMPILER_VERSION:'2.1.12'}),json=await response.json(),event=json.result?.events[0]
 assert.equal(response.status,200,JSON.stringify(json));assert.equal(event.location,'至善楼309');assert.equal(event.endTimePointTempId,null)
 assert.equal(json.result.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.normalizedValue,'2026-10-29T12:40')
})


test('repeated event title is aligned only when a unique heading supplies the source context',()=>{
 const source='【校园讲座预告】\n### 校园讲座预告 | 学术主题\n活动时间：2028年4月2日14:00。',raw={items:[{id:'a',kind:'活动',name:'校园讲座',quote:'校园讲座预告'}],facts:[{type:'开始',item:'a',quote:'2028年4月2日14:00'}],noAction:false}
 const c=compileTwoStep(raw,opt(source));assert.equal(c.result.events.length,1);assert.equal(c.result.evidence.find(e=>e.field==='event').textStart,source.indexOf('校园讲座预告',source.indexOf('###')))
 const ambiguous=source+'\n### 校园讲座预告 | 另一主题';assert.equal(compileTwoStep(raw,opt(ambiguous)).result.events.length,0)
})
test('separate event sections recover repeated locations and retain each distinct time',()=>{
 const source='主办方：校园文化中心。\n第一场：读书讲座\n时间：2028年4月2日09:00\n地点：公共教室\n主持人：甲老师\n第二场：科技讲座\n时间：2028年4月2日14:00\n地点：公共教室\n主持人：乙老师',raw={items:[{id:'a',kind:'活动',name:'读书讲座',quote:'读书讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'开始',item:'a',quote:'2028年4月2日09:00'},{type:'地点',item:'a',quote:'公共教室'},{type:'主持人',item:'a',quote:'主持人：甲老师'},{type:'开始',item:'b',quote:'2028年4月2日14:00'},{type:'地点',item:'b',quote:'公共教室'},{type:'主持人',item:'b',quote:'主持人：乙老师'}],noAction:false}
 const c=compileTwoStep(raw,opt(source)),[a,b]=c.result.events;assert.equal(a.location,'公共教室');assert.equal(b.location,'公共教室');assert.match(a.description,/甲老师/u);assert.match(b.description,/乙老师/u);assert.match(c.result.timePoints.find(p=>p.tempId===a.startTimePointTempId).normalizedValue,/09:00/u);assert.match(c.result.timePoints.find(p=>p.tempId===b.startTimePointTempId).normalizedValue,/14:00/u)
})

test('questions and invitations do not create eligibility restrictions',()=>{
 const source='职业发展讲座。时间：周四中午12:40。欢迎有意向的同学参加，如果有疑问可以咨询老师。',raw={items:[{id:'a',kind:'活动',name:'职业发展讲座',quote:'职业发展讲座'}],facts:[{type:'开始',item:'a',quote:'周四中午12:40'},{type:'参加须知',item:'a',quote:'如果有疑问可以咨询老师'}],noAction:false},c=compileTwoStep(raw,opt(source))
 assert.doesNotMatch(c.result.events[0].description,/适用条件待确认/u);assert.match(c.result.events[0].description,/如果有疑问可以咨询老师/u)
})

test('incidental event mentions do not claim later unnamed numbered sessions',()=>{
 const source='本周将举行读书讲座。\n另外举办科技讲座。\n第一场活动，时间：2026年10月30日09:00，地点：南楼。\n第二场活动，时间：2026年10月31日14:00，地点：北楼。',raw={items:[{id:'a',kind:'活动',name:'读书讲座',quote:'读书讲座'},{id:'b',kind:'活动',name:'科技讲座',quote:'科技讲座'}],facts:[{type:'开始',item:'b',quote:'2026年10月30日09:00'},{type:'地点',item:'b',quote:'南楼'}],noAction:false}
 const c=compileTwoStep(raw,opt(source)),event=c.result.events.find(e=>e.title==='科技讲座'),start=c.result.timePoints.find(p=>p.tempId===event.startTimePointTempId)
 assert.equal(event.location,null);assert.equal(start?.normalizedValue,null);assert(c.audit.losses.some(x=>x.reason==='EVENT_TIME_CONTRADICTS_OR_AMBIGUOUS_IN_SOURCE_SCOPE'))
})
