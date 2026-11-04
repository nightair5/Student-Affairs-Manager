import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {sourceEvidenceCondition} from './semantic-source-context.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'

const options={referenceTime:'2026-11-02T12:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.2.0'}
function compile(source,raw){
 const out=compileSemanticNotice({topic:'匿名通知',kind:'action',items:[],materials:[],...raw},{...options,source})
 assert.ok(out.result)
 assert.deepEqual(validateRecognitionResult(out.result,{sourceContent:source}),{valid:true,failureCategory:null,issues:[]})
 return out
}
const time=(r,event,role)=>r.timePoints.find(p=>p.tempId===event[role==='start'?'startTimePointTempId':'endTimePointTempId'])?.normalizedValue??null

test('a clock with no source day remains readable without creating a date or end',()=>{
 const source='晚上9点15分，我们开15分钟左右的年级线上大会。'
 const {result}=compile(source,{kind:'event',items:[{key:'a',kind:'event',title:'年级线上大会',evidence:[source],times:[{role:'start',raw:'晚上9点15分'}]}]})
 assert.equal(result.events[0].startTimePointTempId,null)
 assert.equal(result.events[0].endTimePointTempId,null)
 assert.match(result.events[0].description,/时间说明：晚上9点15分（日期待定）/u)
 assert.match(result.events[0].description,/原文时长：15分钟左右/u)
})

test('a paraphrased duration-only notice does not repeat the original duration',()=>{
 const source='今天晚上9点15分召开线上大会，会议时长约15分钟。'
 const {result}=compile(source,{kind:'event',items:[{key:'a',kind:'event',title:'线上大会',evidence:[source],times:[{role:'start',raw:'今天晚上9点15分'}],notices:['会议时长约15分钟']}]})
 assert.match(result.events[0].description,/原文时长/u)
 assert.doesNotMatch(result.events[0].description,/参加须知：会议时长/u)
})
test('an approximate duration after the event name is kept without making an end',()=>{
 const source='晚上9点15分召开会议，约15分钟。'
 const {result}=compile(source,{kind:'event',items:[{key:'a',kind:'event',title:'会议',evidence:[source],times:[{role:'start',raw:'晚上9点15分'}]}]})
 assert.match(result.events[0].description,/原文时长：约15分钟/u)
 assert.equal(result.events[0].endTimePointTempId,null)
})

test('a delay until the event starts is not the duration',()=>{
 const source='准备参加会议，约15分钟后开始。'
 const {result}=compile(source,{kind:'event',items:[{key:'a',kind:'event',title:'会议',evidence:[source]}]})
 assert.doesNotMatch(result.events[0].description,/原文时长/u)
})

test('an explicitly unknown event end never inherits the start date',()=>{
 const source='11月13日19:00在报告厅召开答辩说明会，结束时间另行通知。'
 const {result}=compile(source,{kind:'event',items:[{key:'a',kind:'event',title:'答辩说明会',evidence:['11月13日19:00在报告厅召开答辩说明会','结束时间另行通知'],times:[{role:'start',raw:'11月13日19:00'},{role:'end',raw:'结束时间另行通知'}],location:'报告厅',notices:['结束时间另行通知']}]})
 assert.equal(time(result,result.events[0],'start'),'2026-11-13T19:00')
 assert.equal(result.events[0].endTimePointTempId,null)
 assert.match(result.events[0].description,/结束时间另行通知/u)
})

test('an unknown end wording never becomes an all-day end',()=>{
 const source='11月13日19:00举办答辩说明会，结束时间尚未确定。'
 const {result}=compile(source,{kind:'event',items:[{key:'a',kind:'event',title:'答辩说明会',evidence:['11月13日19:00举办答辩说明会','结束时间尚未确定'],times:[{role:'start',raw:'11月13日19:00'},{role:'end',raw:'结束时间尚未确定'}]}]})
 assert.equal(result.events[0].endTimePointTempId,null)
})

test('a source-stated duration is retained even if its event date is unknown',()=>{
 const source='本周课程结束后请留15分钟参加实习说明会，日期及下课时刻待通知。'
 const {result}=compile(source,{kind:'event',items:[{key:'a',kind:'event',title:'实习说明会',evidence:['本周课程结束后请留15分钟参加实习说明会'],times:[{role:'start',raw:'本周课程结束后'},{role:'end',raw:'本周课程结束后请留15分钟'}],notices:['日期及下课时刻待通知']}]})
 assert.equal(result.events[0].startTimePointTempId,null)
 assert.equal(result.events[0].endTimePointTempId,null)
 assert.match(result.events[0].description,/原文预留：15分钟/u)
})

test('an arrival buffer must not become the event duration',()=>{
 const source='11月13日19:00举办说明会，请提前15分钟入场。'
 const {result}=compile(source,{kind:'event',items:[{key:'a',kind:'event',title:'说明会',evidence:['11月13日19:00举办说明会','请提前15分钟入场'],times:[{role:'start',raw:'11月13日19:00'}],notices:['请提前15分钟入场']}]})
 assert.doesNotMatch(result.events[0].description,/原文时长/u)
})

test('two events share an explicitly stated day across a semicolon',()=>{
 const source='就业交流日11月25日9:00—10:00在求实楼101举行宣讲会；10:30—12:00在求实楼102举行招聘说明会。'
 const {result}=compile(source,{kind:'event',items:[
  {key:'a',kind:'event',title:'宣讲会',evidence:['11月25日9:00—10:00在求实楼101举行宣讲会'],times:[{role:'start',raw:'11月25日9:00—10:00'},{role:'end',raw:'11月25日9:00—10:00'}],location:'求实楼101'},
  {key:'b',kind:'event',title:'招聘说明会',evidence:['10:30—12:00在求实楼102举行招聘说明会'],times:[{role:'start',raw:'10:30—12:00'},{role:'end',raw:'10:30—12:00'}],location:'求实楼102'},
 ]})
 assert.equal(time(result,result.events[1],'start'),'2026-11-25T10:30')
 assert.equal(time(result,result.events[1],'end'),'2026-11-25T12:00')
 assert.equal(result.events[1].location,'求实楼102')
})

test('a model-owned shared date combines with its own same-day clock',()=>{
 const source='交流活动包含两个环节，均为11月28日。分享会9:30—10:30在思源中心一楼报告厅举行；招聘交流10:30—12:00在同楼展厅举行。'
 const {result}=compile(source,{kind:'event',items:[
  {key:'a',kind:'event',title:'分享会',evidence:['分享会9:30—10:30在思源中心一楼报告厅举行'],times:[{role:'start',raw:'11月28日'},{role:'start',raw:'9:30—10:30'},{role:'end',raw:'9:30—10:30'}],location:'思源中心一楼报告厅'},
  {key:'b',kind:'event',title:'招聘交流',evidence:['招聘交流10:30—12:00在同楼展厅举行'],times:[{role:'start',raw:'11月28日'},{role:'start',raw:'10:30—12:00'},{role:'end',raw:'10:30—12:00'}],location:'思源中心展厅'},
 ]})
 assert.equal(time(result,result.events[0],'start'),'2026-11-28T09:30')
 assert.equal(time(result,result.events[1],'start'),'2026-11-28T10:30')
 assert.equal(time(result,result.events[1],'end'),'2026-11-28T12:00')
 assert.match(result.events[1].location??'',/思源中心.*展厅/u)
})

test('a next-day or unsupported location never borrows a different event fact',()=>{
 const source='11月25日9:00在求实楼101举办分享；次日10:30在同楼展厅举办招聘。'
 const {result}=compile(source,{kind:'event',items:[{key:'b',kind:'event',title:'招聘',evidence:['次日10:30在同楼展厅举办招聘'],times:[{role:'start',raw:'10:30'}],location:'其他中心展厅'}]})
 assert.notEqual(time(result,result.events[0],'start'),'2026-11-25T10:30')
 assert.equal(result.events[0].location,null)
})

test('an event with an explicitly unknown day cannot inherit a previous session date',()=>{
 const source='11月25日9:00举办分享会；招聘会10:30在求实楼举行，招聘会日期将在群里另行通知。'
 const {result}=compile(source,{kind:'event',items:[{key:'b',kind:'event',title:'招聘会',evidence:['招聘会10:30在求实楼举行','招聘会日期将在群里另行通知'],times:[{role:'start',raw:'10:30'}],location:'求实楼'}]})
 assert.equal(time(result,result.events[0],'start'),null)
})

test('an unrelated clock does not borrow a different event date without a shared-day cue',()=>{
 const source='11月25日9:00举办课程培训；读书会10:30在求实楼举行。'
 const {result}=compile(source,{kind:'event',items:[{key:'b',kind:'event',title:'读书会',evidence:['读书会10:30在求实楼举行'],times:[{role:'start',raw:'10:30'}],location:'求实楼'}]})
 assert.equal(time(result,result.events[0],'start'),null)
})

test('a same-building reference cannot borrow an older different building',()=>{
 const source='第一场在甲中心举行；第二场在乙中心举办；招聘交流在同楼展厅举行。'
 const {result}=compile(source,{kind:'event',items:[{key:'b',kind:'event',title:'招聘交流',evidence:['招聘交流在同楼展厅举行'],location:'甲中心展厅'}]})
 assert.equal(result.events[0].location,null)
})

test('a compound condition retains its source-backed qualification',()=>{
 const source='本项目面向已完成基础培训的同学。是否符合条件由学院核查，感兴趣者可自主申请。请于11月22日17:00前将申请表发送至院系邮箱。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交项目申请表',action:'提交',object:'申请表',evidence:['请于11月22日17:00前将申请表发送至院系邮箱'],condition:'面向已完成基础培训的同学；是否符合条件由学院核查；感兴趣者可自主申请',times:[{role:'deadline',raw:'11月22日17:00前'}],channel:'院系邮箱'}]})
 assert.match(result.standaloneTasks[0].description,/已完成基础培训/u)
 assert.equal(result.standaloneTasks[0].userConfirmationRequired,true)
 assert.equal(result.standaloneTasks[0].selected,false)
})

test('a contradicted or invented condition is not promoted to a source fact',()=>{
 const source='本项目面向已完成基础培训的同学。请提交申请表。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['请提交申请表'],condition:'面向未完成基础培训的同学'}]})
 assert.doesNotMatch(result.standaloneTasks[0].description,/未完成基础培训/u)
})

test('a paraphrased qualification keeps its item-cited original wording',()=>{
 const source='仅修过实验室安全课的同学可填写申请表，请于11月22日17:00前提交。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['仅修过实验室安全课的同学可填写申请表'],condition:'已经上过实验室安全课程的学生',times:[{role:'deadline',raw:'11月22日17:00前'}]}]})
 assert.match(result.standaloneTasks[0].description,/仅修过实验室安全课的同学/u)
 assert.doesNotMatch(result.standaloneTasks[0].description,/已经上过实验室安全课程/u)
 assert.equal(result.standaloneTasks[0].userConfirmationRequired,true)
})

test('a personal choice before a cited fee stays conditional even alongside a different condition',()=>{
 const source='申请纸质证明的，需另缴纳制作费用。居住地有变更的，须提供住所证明。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'缴纳制作费用',action:'缴纳',object:'制作费用',evidence:['申请纸质证明的，需另缴纳制作费用','居住地有变更的，须提供住所证明']}]})
 assert.match(result.standaloneTasks[0].description,/按需办理：申请纸质证明的/u)
 assert.doesNotMatch(result.standaloneTasks[0].description,/按需办理：居住地有变更的/u)
 assert.equal(result.standaloneTasks[0].userConfirmationRequired,true)
})

test('a compound model action still attaches the unique condition in a long citation',()=>{
 const source='申请电子证明的，需另缴纳工本费。居住地有变更的，须提供住所证明。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'申请电子证明并缴费',action:'申请并缴纳',object:'电子证明',evidence:[source]}]})
 assert.match(result.standaloneTasks[0].description,/按需办理：申请电子证明的/u)
 assert.doesNotMatch(result.standaloneTasks[0].description,/按需办理：居住地有变更的/u)
})

test('an action paraphrase retains the condition of its uniquely cited object',()=>{
 const source='申请电子证明的，需另缴纳办理费用。居住地有变更的，须提供住所证明。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'支付办理费用',action:'支付',object:'办理费用',evidence:[source]}]})
 assert.match(result.standaloneTasks[0].description,/按需办理：申请电子证明的/u)
 assert.doesNotMatch(result.standaloneTasks[0].description,/按需办理：居住地有变更的/u)
})

test('two conditions for the same object are not assigned arbitrarily',()=>{
 const source='申请电子证明的，需缴纳办理费用。申请纸质证明的，需缴纳办理费用。'
 assert.equal(sourceEvidenceCondition(source,[source],{action:'支付',object:'办理费用'}),null)
})

test('a source window with open and close clauses retains both endpoints',()=>{
 const source='线上系统于11月12日9:00开放，11月14日17:00关闭；请在此期间完成课程报名。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'完成课程报名',action:'完成',object:'课程报名',evidence:['请在此期间完成课程报名'],times:[{role:'window',raw:'11月12日9:00开放，11月14日17:00关闭'}]}]})
 assert.deepEqual(result.timePoints.map(p=>[p.type,p.normalizedValue]),[['event_start','2026-11-12T09:00'],['event_end','2026-11-14T17:00']])
 assert.ok(result.timePoints.every(p=>p.type!=='task_deadline'))
})

test('separately extracted edges of the same named window stay a window',()=>{
 const source='证件领取窗口12月2日9:00开放，12月4日16:30关闭；请需要证件的同学到服务中心领取。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'到服务中心领取证件',action:'领取',object:'证件',evidence:['请需要证件的同学到服务中心领取'],times:[{role:'start',raw:'12月2日9:00开放'},{role:'end',raw:'12月4日16:30关闭'}]}]})
 assert.deepEqual(result.timePoints.map(p=>[p.type,p.normalizedValue]),[['event_start','2026-12-02T09:00'],['event_end','2026-12-04T16:30']])
 assert.ok(result.timePoints.every(p=>p.tempId.startsWith('sem-window-')&&p.type!=='task_deadline'))
})

test('separate named services never have their start and end combined',()=>{
 const source='证件领取窗口12月2日9:00开放。另一项服务12月4日16:30关闭；请到服务中心领取证件。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'领取证件',action:'领取',object:'证件',evidence:['请到服务中心领取证件'],times:[{role:'start',raw:'12月2日9:00开放'},{role:'end',raw:'12月4日16:30关闭'}]}]})
 assert.ok(result.timePoints.every(p=>!p.tempId.startsWith('sem-window-')))
})

test('a material-specific requirement stays attached to its own material',()=>{
 const source='请提交申请表和计划书。申请表须签名，计划书不超过5页。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请表和计划书',action:'提交',object:'申请表和计划书',evidence:['请提交申请表和计划书'],materials:['m1','m2']}],materials:[
  {key:'m1',name:'申请表',owners:['a'],evidence:['申请表须签名'],requirements:['须签名']},
  {key:'m2',name:'计划书',owners:['a'],evidence:['计划书不超过5页'],requirements:['不超过5页']},
 ]})
 assert.deepEqual(result.materials[0].requirements,['须签名'])
 assert.deepEqual(result.materials[1].requirements,['不超过5页'])
})

test('an announcement of where a link will appear is not a submission channel',()=>{
 const source='请填写参加问卷。问卷入口以班级通知为准，原文未提供链接。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'填写参加问卷',action:'填写',object:'参加问卷',evidence:['请填写参加问卷','问卷入口以班级通知为准'],channel:'班级通知',requirements:['问卷入口以班级通知为准']}]})
 assert.doesNotMatch(result.standaloneTasks[0].description,/提交渠道：班级通知/u)
 assert.match(result.standaloneTasks[0].description,/问卷入口以班级通知为准/u)
})

test('two source-linked alternatives form one choice without becoming a universal cutoff',()=>{
 const source='办理窗口12月1日9:00开放，12月3日17:00关闭。请到服务中心领取证明，领取时携带学生证。也可在系统提交邮寄申请，填写收件地址。本人领取与邮寄申请任选一种，不要求两种都做。'
 const choice='本人领取与邮寄申请任选一种，不要求两种都做'
 const {result}=compile(source,{items:[
  {key:'pickup',kind:'task',title:'到服务中心领取证明',action:'领取',object:'证明',evidence:['请到服务中心领取证明',choice],times:[{role:'window',raw:'12月1日9:00开放，12月3日17:00关闭'}],requirements:['领取时携带学生证']},
  {key:'mail',kind:'task',title:'提交邮寄申请',action:'提交',object:'邮寄申请',evidence:['也可在系统提交邮寄申请',choice],requirements:['填写收件地址']},
 ]})
 assert.equal(result.standaloneTasks.length,1)
 assert.match(result.standaloneTasks[0].title,/任选一项/u)
 assert.match(result.standaloneTasks[0].description,/携带学生证/u)
 assert.match(result.standaloneTasks[0].description,/填写收件地址/u)
 assert.ok(result.standaloneTasks[0].completionCriteria.includes('方式一：领取时携带学生证'))
 assert.ok(result.standaloneTasks[0].completionCriteria.includes('方式二：填写收件地址'))
 assert.equal(result.timePoints.length,2)
 assert.ok(result.timePoints.every(point=>point.tempId.startsWith('sem-choice-window-')&&point.type!=='task_deadline'))
})

test('a choice cannot fold separate tasks when an option owns its own deadline',()=>{
 const source='请提交纸质材料，11月5日17:00前完成。请上传电子材料，11月6日17:00前完成。纸质材料与电子材料任选一种。'
 const choice='纸质材料与电子材料任选一种'
 const {result}=compile(source,{items:[
  {key:'paper',kind:'task',title:'提交纸质材料',action:'提交',object:'纸质材料',evidence:['请提交纸质材料',choice],times:[{role:'deadline',raw:'11月5日17:00前'}]},
  {key:'digital',kind:'task',title:'上传电子材料',action:'上传',object:'电子材料',evidence:['请上传电子材料',choice],times:[{role:'deadline',raw:'11月6日17:00前'}]},
 ]})
 assert.equal(result.standaloneTasks.length,2)
 assert.deepEqual(result.timePoints.map(x=>x.normalizedValue),['2026-11-05T17:00','2026-11-06T17:00'])
})

test('document eligibility is attached only to model-linked owners with a grounded shared requirement',()=>{
 const source='本次征集面向完成基础课程的同学，有意向者可参加。作品须为本人完成的课程项目。请提交电子材料。请提交纸质材料。请填写意见表。'
 const raw={summary:'面向完成基础课程的同学征集作品。',items:[
  {key:'a',kind:'task',title:'提交电子材料',action:'提交',object:'电子材料',evidence:['请提交电子材料']},
  {key:'b',kind:'task',title:'提交纸质材料',action:'提交',object:'纸质材料',evidence:['请提交纸质材料']},
  {key:'c',kind:'task',title:'填写意见表',action:'填写',object:'意见表',evidence:['请填写意见表']},
 ],sharedRequirements:[{owners:['a','b'],evidence:['作品须为本人完成的课程项目']}]}
 const {result}=compile(source,raw)
 assert.match(result.standaloneTasks[0].description,/面向完成基础课程的同学/u)
 assert.match(result.standaloneTasks[1].description,/面向完成基础课程的同学/u)
 assert.equal(result.standaloneTasks[0].userConfirmationRequired,true)
 assert.doesNotMatch(result.standaloneTasks[2].description,/面向完成基础课程的同学/u)
})

test('a lecture-only eligibility does not restrict unrelated shared-material submissions',()=>{
 const source='本次讲座面向完成基础课程的同学，材料投稿面向全体学生。作品须为本人完成的课程项目。请提交电子材料。请提交纸质材料。'
 const raw={kind:'mixed',summary:'面向完成基础课程的同学举办讲座，材料投稿面向全体学生。',items:[
  {key:'a',kind:'task',title:'提交电子材料',action:'提交',object:'电子材料',evidence:['请提交电子材料']},
  {key:'b',kind:'task',title:'提交纸质材料',action:'提交',object:'纸质材料',evidence:['请提交纸质材料']},
  {key:'talk',kind:'event',title:'讲座',evidence:['本次讲座面向完成基础课程的同学']},
 ],sharedRequirements:[{owners:['a','b'],evidence:['作品须为本人完成的课程项目']}]}
 const {result}=compile(source,raw)
 assert.ok(result.standaloneTasks.every(task=>!task.description.includes('面向完成基础课程的同学')))
})

test('candidate times remain explicit descriptive alternatives, not confirmed calendar entries',()=>{
 const source='目前有两个备选时段：12月11日9:00和12月12日14:00。请填写调查表，说明两个时段是否方便。正式时间另行通知。'
 const {result}=compile(source,{summary:'备选为12月11日9:00和12月12日14:00，正式时间另行通知。',items:[{key:'a',kind:'task',title:'填写调查表',action:'填写',object:'调查表',evidence:['请填写调查表，说明两个时段是否方便'],requirements:['说明两个时段是否方便']}]})
 assert.match(result.standaloneTasks[0].description,/12月11日9:00.*12月12日14:00/u)
 assert.equal(result.events.length,0)
 assert.equal(result.timePoints.length,0)
})

test('two times described as selectable remain alternatives in the owner task',()=>{
 const source='访谈可选12月12日9:00或12月13日14:00，具体场次尚未决定。请填写调查表，说明两个时段是否方便。'
 const {result}=compile(source,{summary:'访谈可选12月12日9:00或12月13日14:00，具体场次尚未决定。',items:[{key:'a',kind:'task',title:'填写调查表',action:'填写',object:'调查表',evidence:['请填写调查表，说明两个时段是否方便'],requirements:['说明两个时段是否方便']}]})
 assert.match(result.standaloneTasks[0].description,/12月12日9:00.*12月13日14:00/u)
 assert.equal(result.events.length,0);assert.equal(result.timePoints.length,0)
})

test('candidate times are not assigned when more than one task could own them',()=>{
 const source='备选时段为12月11日9:00和12月12日14:00。填写甲调查表，说明两个时段是否方便。填写乙调查表，说明两个时段是否方便。'
 const {result}=compile(source,{summary:'备选12月11日9:00和12月12日14:00。',items:[
  {key:'a',kind:'task',title:'填写甲调查表',action:'填写',object:'甲调查表',evidence:['填写甲调查表，说明两个时段是否方便'],requirements:['说明两个时段是否方便']},
  {key:'b',kind:'task',title:'填写乙调查表',action:'填写',object:'乙调查表',evidence:['填写乙调查表，说明两个时段是否方便'],requirements:['说明两个时段是否方便']},
 ]})
 assert.ok(result.standaloneTasks.every(task=>!task.description.includes('12月11日9:00')))
})

test('a generic form title gets the subject supported by its own cited action',()=>{
 const source='完成培训的同学可以申请实践岗位。请填写申请表交给班长。'
 const {result}=compile(source,{topic:'实践岗位申请',summary:'完成培训者可以申请实践岗位，填写申请表。',items:[{key:'a',kind:'task',title:'填写申请表',action:'填写',object:'申请表',evidence:['完成培训的同学可以申请实践岗位','请填写申请表交给班长']}]})
 assert.match(result.standaloneTasks[0].title,/实践岗位/u)
})

test('an unrelated document topic is not guessed as the subject of a form',()=>{
 const source='【校园活动安排】\n另请填写后勤意见表。'
 const {result}=compile(source,{topic:'校园活动安排',summary:'征集后勤意见。',items:[{key:'a',kind:'task',title:'填写后勤意见表',action:'填写',object:'后勤意见表',evidence:['另请填写后勤意见表']}]})
 assert.equal(result.standaloneTasks[0].title,'填写后勤意见表')
})
