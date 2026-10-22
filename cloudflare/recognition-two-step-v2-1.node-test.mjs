import test from'node:test';import assert from'node:assert/strict'
import {compileTwoStep} from './recognition-two-step-compiler-v2-1.mjs'
import {alignSourceQuote} from './two-step-source-alignment.mjs'
import {twoStepSystemPrompt,validateExampleAlignment,twoStepExamples} from './recognition-two-step-contract-v2-1.mjs'
import {chunkTwoStepSource,mergeAlignedExtractions,runTwoStep21Generation} from './two-step-generation-v2-1.mjs'
import {parseTwoStepTime} from './two-step-time.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'
const ref='2028-04-01T08:00:00+08:00',timezone='Asia/Shanghai',source='请在4月6日16:30前提交实验记录至课程站。'
const raw=()=>({items:[{id:'a',kind:'任务',name:'提交实验记录',quote:'提交实验记录'}],facts:[{type:'截止',quote:'4月6日16:30前',item:'a'}],noAction:false})
const compile=(r=raw(),text=source)=>compileTwoStep(r,{source:text,referenceTime:ref,timezone})
test('six independent examples are literal, ordered, self-checked and below3000 chars',()=>{assert(twoStepSystemPrompt().length<=3000);assert(validateExampleAlignment());const e=structuredClone(twoStepExamples);e[0][1].facts[0].quote='NOT IN SOURCE';assert.throws(()=>validateExampleAlignment(e),/EXAMPLE_QUOTE/);e[0]=structuredClone(twoStepExamples[0]);e[0][1].facts.reverse();assert.throws(()=>validateExampleAlignment(e),/ORDERED/)})
test('display names use grounded components in the same sentence, not one exact substring',()=>{const r=raw();r.items[0].quote='提交';const x=compile(r);assert.equal(x.result.standaloneTasks.length,1);assert(x.result.evidence.some(e=>e.quote===source));r.items[0].name='提交学费';assert.equal(compile(r).result.standaloneTasks.length,0)})
test('source-quoted short event name survives a paraphrased display prefix without invented words',()=>{const s='（二）星空之夜\n4月8日19:00在南厅举行。',r={items:[{id:'a',kind:'活动',name:'校园文化周星空之夜',quote:'星空之夜'}],facts:[{type:'开始',quote:'4月8日19:00',item:'a'},{type:'地点',quote:'南厅',item:'a'}],noAction:true};const x=compile(r,s);assert.equal(x.result.events[0].title,'星空之夜');assert.equal(x.result.events[0].location,'南厅')})
test('unique fuzzy match uses actual source span; repeated, short, digit or polarity changes fail',()=>{const s='请同学们于4月6日将实验课程观察日志提交到课程平台。',q='请同学于4月6日将实验课程观察日志提交到课程平台';const a=alignSourceQuote(q,s);assert(a);assert.equal(a.literal,s.slice(a.start,a.end));assert(a.rule.includes('LCS'));assert.equal(alignSourceQuote(q,s+s),null);assert.equal(alignSourceQuote(q.replace('6日','7日'),s),null);assert.equal(alignSourceQuote('提交申请单','提交申请表'),null);assert.equal(alignSourceQuote('请同学们于4月6日不得将实验课程观察日志提交到课程平台',s),null)})
test('one bad fact cannot clear a grounded item and other owned facts',()=>{const r=raw();r.facts.push({type:'地点',quote:'不存在地点',item:'a'});const x=compile(r);assert.equal(x.result.standaloneTasks.length,1);assert.equal(x.result.timePoints.length,1);assert(x.result.ambiguities.some(a=>a.message.includes('不存在地点')))})
test('null owner uses a unique numbered section and never crosses multiple candidates',()=>{const r=raw();r.facts[0].item=null;const s='一、实验记录\n请提交实验记录。\n办理截止4月6日16:30前。\n二、海报\n请提交海报。';const x=compile(r,s);assert.equal(x.result.timePoints.length,1);const a=raw();a.items.push({id:'b',kind:'任务',name:'提交海报',quote:'提交海报'});a.facts[0].item=null;assert.equal(compile(a,source.replace('。','并提交海报。')).result.timePoints.length,0)})
test('an explicit wrong owner is isolated instead of silently relinked',()=>{const r=raw();r.items.push({id:'b',kind:'任务',name:'提交海报',quote:'提交海报'});r.facts=[{type:'截止',quote:'4月9日17:00前',item:'a'}];assert.equal(compile(r,source+'请在4月9日17:00前提交海报。').result.timePoints.length,0)})
test('format requirements remain visible but do not turn an unconditional task off',()=>{const r=raw();r.facts.push({type:'条件',quote:'标题用学号，PDF格式',item:'a'});const x=compile(r,source+'标题用学号，PDF格式。');assert.equal(x.result.standaloneTasks[0].selected,true);assert(x.result.standaloneTasks[0].completionCriteria.includes('标题用学号，PDF格式'));r.facts[1]={type:'条件',quote:'入选者',item:'a'};assert.equal(compile(r,'入选者'+source).result.standaloneTasks[0].selected,false)})
test('information with a real action and cutoff is a reviewable task; service information is not',()=>{const r=raw();r.items[0].kind='信息';let x=compile(r);assert.equal(x.result.standaloneTasks.length,1);assert.equal(x.result.standaloneTasks[0].selected,false);r.items[0]={id:'a',kind:'信息',name:'系统服务截止',quote:'系统服务截止'};x=compile(r,'系统服务截止4月6日16:30前。');assert.equal(x.result.standaloneTasks.length,0)})
test('late applications not accepted is not cancellation of the valid earlier obligation',()=>{const x=compile(raw(),source.replace('。','，逾期不再受理。'));assert.equal(x.result.standaloneTasks.length,1);for(const s of ['禁止提交实验记录。','提交实验记录的要求取消。'])assert.equal(compile({...raw(),facts:[]},s).result.standaloneTasks.length,0)})
test('handling windows and choices never become a submission cutoff',()=>{for(const s of ['领取资料窗口4月14日09:00—11:00。','任选4月14日或4月15日领取资料。']){const r={items:[{id:'a',kind:'任务',name:'领取资料',quote:'领取资料'}],facts:[{type:'截止',quote:'4月14日',item:'a'}],noAction:false};assert.equal(compile(r,s).result.timePoints[0].normalizedValue,null)}})
test('vague end cannot inherit a definite start date',()=>{const r={items:[{id:'a',kind:'活动',name:'闭馆',quote:'闭馆'}],facts:[{type:'开始',quote:'4月8日闭馆',item:'a'},{type:'结束',quote:'预计施工至下半年',item:'a'}],noAction:true};const x=compile(r,'4月8日闭馆，预计施工至下半年。');assert.equal(x.result.timePoints.find(p=>p.type==='event_end').normalizedValue,null)})
// Two literal inputs below from Microsoft Recognizers-Text Chinese DateTimeModel.json.
// MIT License, Copyright (c) Microsoft Corporation. All rights reserved.
// https://github.com/microsoft/Recognizers-Text/blob/master/Specs/DateTime/Chinese/DateTimeModel.json
// https://github.com/microsoft/Recognizers-Text/blob/master/LICENSE
for(const[q,expect]of [['今天晚上八点之前','2028-04-01T20:00'],['下午三点之前',null],['下周五17:00前','2028-04-07T17:00'],['本月底前','2028-04-30'],['即日起至2028年4月6日18:00','2028-04-06T18:00'],['2028年12月31日22:00至2029年1月1日02:00','2028-12-31T22:00']])test('source time expression: '+q,()=>{const p=parseTwoStepTime(q,{type:'task_deadline',referenceTime:ref,timezone});assert.equal(p.normalizedValue,expect)})
test('chunked text covers every source character exactly once and remaps repeated IDs',()=>{const source='一、甲\n'+'请提交实验记录。'.repeat(220)+'\n二、乙\n请提交海报。',chunks=chunkTwoStepSource(source);assert.equal(chunks.map(c=>c.text).join(''),source);assert(chunks.length>1);let last=0;for(const c of chunks){assert.equal(c.start,last);last=c.end;assert.equal(source.slice(c.start,c.end),c.text)}const r=raw();const merged=mergeAlignedExtractions([{value:r,chunk:{start:0,end:source.length,text:source}}],source);assert(merged.raw.items.length)})
test('multi-pass union retains grounded facts and marks conflicting owned times, with exact usage',async()=>{let calls=0;const s=source+'另有4月7日16:30前的日期。';const x=await runTwoStep21Generation({fetcher:async()=>{const r=raw();if(++calls===2)r.facts[0].quote='4月7日16:30前';return Response.json({model:'deepseek-flash',choices:[{message:{content:JSON.stringify(r)},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}})},apiKey:'TEST_ONLY',profile:{model:'deepseek-v4-flash',thinking:false,temperature:.1,maxTokens:16384,timeoutMs:1000},userText:s,source:s,referenceTime:ref,timezone,mode:'two-step-2.1x2'});assert(x.ok);assert.equal(calls,2);assert.equal(x.execution.tokenUsage.total,30);assert.equal(x.result.standaloneTasks[0].selected,false);assert(x.execution.twoStep.losses.some(l=>l.reason==='CONFLICTING_KEY_TIME'));assert(validateRecognitionResult(x.result,{sourceContent:s}).valid)})
test('one failed pass keeps other facts and never invents usage',async()=>{let calls=0;const x=await runTwoStep21Generation({fetcher:async()=>++calls===1?Response.json({error:'offline'},{status:503}):Response.json({choices:[{message:{content:JSON.stringify(raw())},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:5}}),apiKey:'TEST_ONLY',profile:{model:'deepseek-v4-flash',thinking:false,temperature:.1,maxTokens:16384,timeoutMs:1000},userText:source,source,referenceTime:ref,timezone,mode:'two-step-2.1x2'});assert(x.ok);assert.equal(calls,2);assert.equal(x.execution.tokenUsage,null);assert(x.result.quality.needsHumanReview)})

test('unsupported event object cannot be repaired by replacing it with a different event',()=>{const x=compile({items:[{id:'a',kind:'活动',name:'北苑停水',quote:'南苑停电'}],facts:[],noAction:true},'南苑停电。');assert.equal(x.result.events.length,0)})

test('same-sentence context cannot lend an object from a different action',()=>{const r=raw();r.items[0]={id:'a',kind:'任务',name:'提交学费',quote:'提交申请表'};r.facts=[];assert.equal(compile(r,'请提交申请表并缴纳学费。').result.standaloneTasks.length,0);r.items[0]={id:'a',kind:'任务',name:'报名学费',quote:'缴纳学费'};assert.equal(compile(r,'请缴纳学费。').result.standaloneTasks.length,0)})

test('postposed action and one-character explicit object are valid task names',()=>{for(const[name,quote]of [['资料学习','资料学习'],['领卡','领卡'],['证书领取','证书领取']]){const r={items:[{id:'a',kind:'任务',name,quote}],facts:[],noAction:false},x=compile(r,'请完成'+quote+'。');assert.equal(x.result.standaloneTasks.length,1,name);assert(x.result.standaloneTasks[0].actionVerb)}})
test('mandatory attendance prohibition is not cancellation; independent prohibited action remains blocked',()=>{const r={items:[{id:'a',kind:'活动',name:'入学指导',quote:'入学指导'}],facts:[],noAction:true};assert.equal(compile(r,'入学指导，原则上不得缺席。').result.events.length,1);assert.equal(compile(r,'入学指导取消。').result.events.length,0);const q=raw();q.facts=[];assert.equal(compile(q,'请提交实验记录，禁止提交其他材料。').result.standaloneTasks.length,1)})
test('rejected information container cannot lend outage dates to an unrelated storage preparation task',()=>{const r={items:[{id:'a',kind:'任务',name:'准备储水',quote:'准备储水'},{id:'b',kind:'信息',name:'停水安排',quote:'停水'}],facts:[{type:'开始',quote:'4月8日14:00',item:'b'}],noAction:false},x=compile(r,'请准备储水。停水从4月8日14:00开始。');assert.equal(x.result.timePoints.length,0)})

test('longer actions win over their one-character prefix',()=>{const r={items:[{id:'a',kind:'任务',name:'领取证书',quote:'领取证书'}],facts:[],noAction:false};assert.equal(compile(r,'请领取证书。').result.standaloneTasks[0].actionVerb,'领取')})

test('administrative actors remain conditional while submitting to an office does not change the student role',()=>{for(const q of ['学院做好领取登记','工作人员完成证书清点']){const name=q.includes('登记')?'做好领取登记':'完成证书清点',x=compile({items:[{id:'a',kind:'任务',name,quote:q}],facts:[],noAction:false},q+'。');assert.equal(x.result.standaloneTasks[0].selected,false);assert(x.result.standaloneTasks[0].description.includes('适用条件'));}const r=raw();r.items[0].quote='提交实验记录至学院办公室';assert.equal(compile(r,'请在4月6日16:30前提交实验记录至学院办公室。').result.standaloneTasks[0].selected,true)})
test('possession and voluntary application are choices, not current mandatory tasks',()=>{for(const[name,q]of [['清理个人物品','将存放在三楼的个人物品清理带离'],['提交创意说明','可提交创意说明']]){const x=compile({items:[{id:'a',kind:'任务',name,quote:q}],facts:[],noAction:false},q+'。');assert.equal(x.result.standaloneTasks[0].selected,false)}assert.equal(compile().result.standaloneTasks[0].selected,true)})

test('chunked generation respects parent time budget, preserves successful facts, and does not invent skipped calls or usage',async()=>{let calls=0;const long=source+'补充背景说明。'.repeat(600),x=await runTwoStep21Generation({fetcher:async(_url,init)=>{if(++calls===1)return Response.json({choices:[{message:{content:JSON.stringify(raw())},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}});return new Promise((_ok,no)=>{const socket=setTimeout(()=>no(Error('MOCK_NETWORK_DID_NOT_ABORT')),2000),abort=()=>{clearTimeout(socket);no(init.signal.reason)};if(init.signal.aborted)abort();else init.signal.addEventListener('abort',abort,{once:true})})},apiKey:'TEST_ONLY',profile:{model:'deepseek-v4-flash',thinking:false,temperature:.1,maxTokens:16384,timeoutMs:1000},userText:long,source:long,referenceTime:ref,timezone,mode:'two-step-2.1',budgetMs:200});assert(x.ok);assert.equal(x.execution.twoStep.callCount,calls);assert(x.execution.twoStep.omittedCalls>0);assert(x.execution.twoStep.elapsedMs<1000);assert.equal(x.execution.tokenUsage,null);assert(x.result.quality.needsHumanReview);assert(x.result.standaloneTasks.length>0)})

test('explicit source participant scope remains unknown even when model quotes only an event title',()=>{const r={items:[{id:'a',kind:'活动',name:'研究讲堂',quote:'研究讲堂'},{id:'b',kind:'任务',name:'提交实验记录',quote:'提交实验记录'}],facts:[],noAction:false},s='研究讲堂在南厅举行。请全体教职工准时参加！请同学提交实验记录。',x=compile(r,s);assert.equal(x.result.events[0].selected,false);assert.equal(x.result.standaloneTasks[0].selected,true);assert(x.result.events[0].evidenceIds.some(id=>x.result.evidence.find(e=>e.id===id).quote==='请全体教职工准时参加'));assert(x.result.events[0].description.includes('适用条件'))})
test('voluntary attendance does not qualify an unrelated service outage; project preparation requires membership',()=>{const r={items:[{id:'a',kind:'活动',name:'社团之夜',quote:'社团之夜'},{id:'b',kind:'活动',name:'停水施工',quote:'停水施工'},{id:'c',kind:'任务',name:'准备演示文稿',quote:'每个项目准备演示文稿'}],facts:[],noAction:false},x=compile(r,'社团之夜。欢迎广大师生踊跃参与！停水施工。每个项目准备演示文稿。');assert.equal(x.result.events[0].selected,false);assert.equal(x.result.events[1].selected,true);assert.equal(x.result.standaloneTasks[0].selected,false)})

// The referenced finite mock socket above keeps Node22/Linux alive until the real abort;
// AbortSignal.timeout itself is unreferenced. No production deadline assertion is removed.

test('grounded ownership warning has a literal source link; missing citation does not get a guessed link',()=>{const r=raw();r.items.push({id:'b',kind:'信息',name:'预计退款到账说明',quote:'预计退款到账'});r.facts.push({type:'条件',quote:'预计退款到账',item:'b'},{type:'地点',quote:'原文中不存在的位置',item:'a'});const s=source+'预计退款到账。',x=compile(r,s),linked=x.result.ambiguities.find(a=>a.message.includes('归属')&&a.message.includes('预计退款到账')),missing=x.result.ambiguities.find(a=>a.message.includes('不存在的位置'));assert(linked.evidenceIds.length);const e=x.result.evidence.find(e=>linked.evidenceIds.includes(e.id));assert.equal(s.slice(e.textStart,e.textEnd),e.quote);assert.equal(missing.evidenceIds.length,0)})

test('an explicit source action in an information item is reviewable without a cutoff or channel, but metadata and R3 preparation do not become independent tasks',()=>{for(const[name,q,expected]of [['领取登记表','请到教学站领取登记表',1],['提交说明','平台提交说明已经发布',0],['准备电脑','入选后准备电脑',0]]){const x=compile({items:[{id:'a',kind:'信息',name,quote:q}],facts:[],noAction:false},q+'。');assert.equal(x.result.standaloneTasks.length,expected);if(expected)assert.equal(x.result.standaloneTasks[0].selected,false)}const x=compile({items:[{id:'a',kind:'信息',name:'领取登记表',quote:'无需领取登记表'}],facts:[],noAction:false},'无需领取登记表。');assert.equal(x.result.standaloneTasks.length,0)})
test('format and naming extracted as material facts populate requirement attributes without changing applicability',()=>{const r=raw();r.facts.push({type:'材料',quote:'文件名用学号，PDF格式',item:'a'});const x=compile(r,source+'文件名用学号，PDF格式。');assert.equal(x.result.standaloneTasks[0].selected,true);assert.deepEqual(x.result.materials[0].formatRequirements,['文件名用学号，PDF格式']);assert.deepEqual(x.result.materials[0].namingRequirements,['文件名用学号，PDF格式'])})

test('historical record retention is not a new registration or submission obligation',()=>{for(const[name,q]of [['报名记录保留','已经报名的同学不需要重新报名，报名记录保留'],['提交申请表','已提交申请表']]){const x=compile({items:[{id:'a',kind:'信息',name,quote:q}],facts:[],noAction:true},q+'。');assert.equal(x.result.standaloneTasks.length,0)}const x=compile({items:[{id:'a',kind:'信息',name:'提交报告',quote:'已报名同学请提交报告'}],facts:[],noAction:false},'已报名同学请提交报告。');assert.equal(x.result.standaloneTasks.length,1);assert.equal(x.result.standaloneTasks[0].selected,false)})
test('not needed blocks that action, while a separate required action is preserved',()=>{const r=raw();r.facts=[];assert.equal(compile(r,'不需要提交实验记录。').result.standaloneTasks.length,0);assert.equal(compile(r,'不需要重新准备，请提交实验记录。').result.standaloneTasks.length,1)})


test('recipient membership qualifies a same-sentence service action without inventing an account state',()=>{
 const r={items:[{id:'a',kind:'任务',name:'领取电子校园卡',quote:'输入个人信息领取电子校园卡'}],facts:[],noAction:false}
 const x=compile(r,'学校师生在微信输入个人信息领取电子校园卡。')
 assert.equal(x.result.standaloneTasks[0].selected,false)
 assert(x.result.standaloneTasks[0].evidenceIds.every(id=>{const e=x.result.evidence.find(e=>e.id===id);return e.quote==='学校师生'||e.quote==='输入个人信息领取电子校园卡'}))
 assert.equal(compile(r,'请同学输入个人信息领取电子校园卡。').result.standaloneTasks[0].selected,true)
})
test('literal intention continues through delivery steps but stops at a different recipient or section',()=>{
 const r={items:[{id:'a',kind:'任务',name:'提交申请表',quote:'提交申请表'}],facts:[{type:'材料',quote:'申请表',item:'a'}],noAction:false}
 const x=compile(r,'请有意向申报的团队登录系统报名。填写信息，并提交申请表。')
 assert.equal(x.result.standaloneTasks[0].selected,false);assert.equal(x.result.materials[0].selected,false)
 assert.equal(x.result.standaloneTasks.length,1);assert.deepEqual(x.result.standaloneTasks[0].dependencyTempIds,[])
 for(const s of ['请有意向申报的团队登录系统报名。请所有同学提交申请表。','请有意向申报的团队登录系统报名。\n二、课程要求\n请提交申请表。'])assert.equal(compile(r,s).result.standaloneTasks[0].selected,true)
})
test('registration keeps a participation choice while a specific mandatory command and ordinary delivery stay usable',()=>{
 const r={items:[{id:'a',kind:'任务',name:'报名研究讲座',quote:'报名研究讲座'}],facts:[],noAction:false}
 assert.equal(compile(r,'登录活动平台报名研究讲座。').result.standaloneTasks[0].selected,false)
 assert.equal(compile(r,'必须于周五报名研究讲座。').result.standaloneTasks[0].selected,true)
 assert.equal(compile().result.standaloneTasks[0].selected,true)
})


test('public lecture and exam dates retain facts without assigning personal attendance; service closures and explicit mandatory attendance differ',()=>{
 for(const name of ['秋季等级考试','能源专题讲座','春季培训会议']){const r={items:[{id:'a',kind:'活动',name,quote:name}],facts:[{type:'开始',quote:'4月8日14:00',item:'a'},{type:'地点',quote:'南厅',item:'a'}],noAction:true},x=compile(r,name+'在4月8日14:00于南厅举行。');assert.equal(x.result.events.length,1);assert.equal(x.result.events[0].selected,false);assert.equal(x.result.events[0].location,'南厅');assert.equal(x.result.timePoints[0].normalizedValue,'2028-04-08T14:00')}
 for(const [name,s]of [['考场封闭','考场封闭，自4月8日14:00开始。'],['停电检修','停电检修，自4月8日14:00开始。'],['能源专题讲座','所有同学必须参加能源专题讲座，4月8日14:00在南厅举行。']]){const x=compile({items:[{id:'a',kind:'活动',name,quote:name}],facts:[],noAction:true},s);assert.equal(x.result.events[0].selected,true)}
 const x=compile({items:[{id:'a',kind:'活动',name:'年度考试',quote:'年度考试'},{id:'b',kind:'任务',name:'提交实验记录',quote:'提交实验记录'}],facts:[],noAction:false},'年度考试定于4月8日举行。请同学提交实验记录。');assert.equal(x.result.standaloneTasks[0].selected,true);assert.equal(x.result.events[0].selected,false)
})


test('mandatory attendance cannot leak to another opportunity in the same sentence',()=>{
 const r={items:[{id:'a',kind:'活动',name:'能源讲座',quote:'能源讲座'},{id:'b',kind:'活动',name:'等级考试',quote:'等级考试'}],facts:[],noAction:true},x=compile(r,'同学们必须参加能源讲座，等级考试可另行报名。');assert.equal(x.result.events[0].selected,true);assert.equal(x.result.events[1].selected,false)
})


test('an abbreviated two-day date range keeps the explicit second day and date-only precision',()=>{
 const opts={referenceTime:'2026-09-16T00:00:00+08:00',timezone:'Asia/Shanghai',type:'event_start'}
 for(const s of ['9月19-20日','9月19—20日','9 月19 – 20日','9月19日至20日']){const a=parseTwoStepTime(s,opts);assert.equal(a.normalizedValue,'2026-09-19');assert.equal(a.rangeEndNormalizedValue,'2026-09-20');assert.equal(a.precision,'date_only')}
 const s='9月19日14:00-16:00',a=parseTwoStepTime(s,opts);assert.equal(a.normalizedValue,'2026-09-19T14:00');assert.equal(a.rangeEndNormalizedValue,'2026-09-19T16:00');assert.equal(a.precision,'exact')
})
