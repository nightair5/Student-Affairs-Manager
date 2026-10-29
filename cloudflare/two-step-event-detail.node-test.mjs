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

