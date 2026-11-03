import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'
import {SEMANTIC_NOTICE_VERSION,semanticNoticeSystemPrompt} from './semantic-notice-contract-v3-1-0.mjs'
import {SEMANTIC_NOTICE_VERSION as SHARED_VERSION,semanticNoticeSystemPrompt as sharedPrompt} from './semantic-notice-contract-v3-2-0.mjs'

const referenceTime='2026-11-02T04:00:00.000Z', timezone='Asia/Shanghai'
function compile(source,raw){
  const out=compileSemanticNotice({topic:'匿名通知',kind:'action',items:[],materials:[],...raw},{source,referenceTime,timezone,promptVersion:SEMANTIC_NOTICE_VERSION})
  assert.ok(out.result)
  assert.deepEqual(validateRecognitionResult(out.result,{sourceContent:source}),{valid:true,failureCategory:null,issues:[]})
  return out
}

test('new shared-material examples use literal source evidence and time text',()=>{
  assert.equal(SEMANTIC_NOTICE_VERSION,'recognition-semantic-notice-3.1.0')
  const examples=[...semanticNoticeSystemPrompt().matchAll(/示例原文：([^\n]+)\n示例JSON：([^\n]+)/gu)]
  assert.ok(examples.length>=9)
  for(const [,source,json] of examples){
    const example=JSON.parse(json)
    for(const item of [...example.items,...example.materials]){
      for(const quote of item.evidence??[])assert.ok(source.includes(quote),`quote absent from source: ${quote}`)
      for(const time of item.times??[])assert.ok(source.includes(time.raw),`time absent from source: ${time.raw}`)
    }
  }
})

test('shared-requirement example binds only literal source quotations to owners',()=>{
  assert.equal(SHARED_VERSION,'recognition-semantic-notice-3.2.0')
  const examples=[...sharedPrompt().matchAll(/示例原文：([^\n]+)\n示例JSON：([^\n]+)/gu)]
  const [,source,json]=examples.at(-1)
  const example=JSON.parse(json)
  for(const requirement of example.sharedRequirements){
    for(const quote of requirement.evidence)assert.ok(source.includes(quote))
    for(const owner of requirement.owners)assert.ok(example.items.some(item=>item.key===owner))
  }
})

test('source-backed document requirements follow their declared delivery owners',()=>{
  const source='作品须为本人原创，不得使用网络图片。电子版提交至平台，纸质版提交至服务台。请填写反馈表。'
  const {result}=compile(source,{items:[
    {key:'digital',kind:'task',title:'提交电子版作品',action:'提交',object:'作品',deliveryForm:'电子版',evidence:['电子版提交至平台']},
    {key:'paper',kind:'task',title:'提交纸质版作品',action:'提交',object:'作品',deliveryForm:'纸质版',evidence:['纸质版提交至服务台']},
    {key:'feedback',kind:'task',title:'填写反馈表',action:'填写',object:'反馈表',evidence:['请填写反馈表']},
  ],sharedRequirements:[
    {owners:['digital','paper'],evidence:['作品须为本人原创']},
    {owners:['digital','paper'],evidence:['不得使用网络图片']},
  ]})
  for(const task of result.standaloneTasks.slice(0,2)){
    assert.ok(task.completionCriteria.includes('作品须为本人原创'))
    assert.ok(task.completionCriteria.includes('不得使用网络图片'))
    assert.match(task.description,/作品须为本人原创/u)
  }
  assert.equal(result.standaloneTasks[2].completionCriteria.length,0)
  for(const e of result.evidence)assert.equal(source.slice(e.textStart,e.textEnd),e.quote)
})

test('a repeated qualifier is resolved within its own positive citation, not the negated occurrence',()=>{
 const source='入选者在12月20日12:00前提交证明；未入选者无需提交证明。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交证明',action:'提交',object:'证明',condition:'入选者',evidence:['入选者在12月20日12:00前提交证明','未入选者无需提交证明'],times:[{role:'deadline',raw:'12月20日12:00前'}]}]})
 assert.match(result.standaloneTasks[0].description,/适用条件待确认：入选者/u)
 assert.equal(result.standaloneTasks[0].selected,false)
 assert.equal(result.timePoints[0].normalizedValue,'2026-12-20T12:00')
})

test('a personal need and voluntary attendance are not reported as confirmed eligibility',()=>{
 const need='需要教材的同学请填写领取登记表，不需要者无需填写。'
 const first=compile(need,{items:[{key:'a',kind:'task',title:'填写领取登记表',action:'填写',object:'领取登记表',condition:'需要教材的同学',evidence:['需要教材的同学请填写领取登记表']}]})
 assert.match(first.result.standaloneTasks[0].description,/按需办理：需要教材的同学/u)
 assert.doesNotMatch(first.result.standaloneTasks[0].description,/适用条件待确认/u)
 const voluntary='如想参加交流，请填写意向表。'
 const second=compile(voluntary,{items:[{key:'a',kind:'task',title:'填写意向表',action:'填写',object:'意向表',condition:'如想参加交流',evidence:['如想参加交流，请填写意向表']}]})
 assert.match(second.result.standaloneTasks[0].description,/参加说明：如想参加交流/u)
 assert.doesNotMatch(second.result.standaloneTasks[0].description,/适用条件待确认/u)
})

test('a conditional agent in a source-backed material clause is not made universally mandatory',()=>{
 const source='请提交申请材料，如由他人代交，还需委托书。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请材料',action:'提交',object:'申请材料',evidence:['请提交申请材料'],materials:['m']}],materials:[{key:'m',name:'委托书',owners:['a'],evidence:['如由他人代交，还需委托书'],requirements:['如由他人代交，还需委托书']}]})
 assert.equal(result.materials[0].required,false)
 assert.ok(result.materials[0].requirements.includes('如由他人代交，还需委托书'))
})

test('a voluntary task keeps its own form required when the user chooses that task',()=>{
 const source='如想参加交流，请填写线上意向表。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'填写线上意向表',action:'填写',object:'线上意向表',condition:'如想参加交流',evidence:['如想参加交流，请填写线上意向表'],materials:['m']}],materials:[{key:'m',name:'线上意向表',owners:['a'],evidence:['如想参加交流，请填写线上意向表']}]})
 assert.equal(result.materials[0].required,true)
 assert.match(result.standaloneTasks[0].description,/参加说明：如想参加交流/u)
})

test('a named agent-at-submission condition remains local to its material',()=>{
 const source='需办理证明者请提交申请单；本人办理携带证件，委托他人办理时另须委托书。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请单',action:'提交',object:'申请单',evidence:['需办理证明者请提交申请单'],materials:['m']}],materials:[{key:'m',name:'委托书',owners:['a'],evidence:['委托他人办理时另须委托书']}]})
 assert.equal(result.materials[0].required,false)
 assert.ok(result.materials[0].requirements.includes('委托他人办理时另须委托书'))
 assert.match(result.standaloneTasks[0].description,/按需办理：需办理证明者/u)
})

test('delivery variants of one document share an explicitly cited choice group',()=>{
 const source='报告请选择一种提交方式：11月23日17:00前将扫描件传至平台，或11月25日12:00前将纸质件送至服务台；无需两种都交。'
 const requirement='任选一项：将扫描件传至平台，或将纸质件送至服务台'
 const {result}=compile(source,{items:[
  {key:'scan',kind:'task',title:'提交报告扫描件',action:'提交',object:'报告扫描件',evidence:['11月23日17:00前将扫描件传至平台'],requirements:[requirement],times:[{role:'deadline',raw:'11月23日17:00前'}]},
  {key:'paper',kind:'task',title:'提交报告纸质件',action:'提交',object:'报告纸质件',evidence:['11月25日12:00前将纸质件送至服务台'],requirements:[requirement],times:[{role:'deadline',raw:'11月25日12:00前'}]},
 ]})
 const choice=result.conflicts.find(item=>item.id.startsWith('sem-choice-'))
 assert.ok(choice)
 assert.equal(choice.entityTempIds.length,2)
 assert.deepEqual(result.timePoints.map(point=>point.normalizedValue),['2026-11-23T17:00','2026-11-25T12:00'])
})

test('repeated agenda clocks attach only to the uniquely cited session and date heading',()=>{
 const source='11月10日\n第一场\n14:00-15:00\n第二场\n15:30-16:30\n11月11日\n第三场\n14:00-15:00\n第四场\n15:30-16:30'
 const specs=[['第一场','11月10日','14:00-15:00'],['第二场','11月10日','15:30-16:30'],['第三场','11月11日','14:00-15:00'],['第四场','11月11日','15:30-16:30']]
 const {result}=compile(source,{kind:'event',items:specs.map(([title,day,time],index)=>({key:`e${index}`,kind:'event',title,evidence:[title,day],times:[{role:'start',raw:time},{role:'end',raw:time}]}))})
 const dates=result.events.map(event=>[result.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.normalizedValue,result.timePoints.find(p=>p.tempId===event.endTimePointTempId)?.normalizedValue])
 assert.deepEqual(dates,[['2026-11-10T14:00','2026-11-10T15:00'],['2026-11-10T15:30','2026-11-10T16:30'],['2026-11-11T14:00','2026-11-11T15:00'],['2026-11-11T15:30','2026-11-11T16:30']])
})

test('an agenda clock is not dated from a heading that its event never cited',()=>{
 const source='11月10日\n第一场\n14:00-15:00\n11月11日\n第二场\n14:00-15:00'
 const {result}=compile(source,{kind:'event',items:[
  {key:'a',kind:'event',title:'第一场',evidence:['第一场'],times:[{role:'start',raw:'14:00-15:00'}]},
  {key:'b',kind:'event',title:'第二场',evidence:['第二场'],times:[{role:'start',raw:'14:00-15:00'}]},
 ]})
 assert.ok(result.events.every(event=>event.startTimePointTempId===null))
})

test('a date explicitly awaiting notice cannot inherit the nearby agenda heading',()=>{
 const source='11月10日\n第一场\n14:00-15:00，具体日期另行通知。\n11月11日\n第二场\n14:00-15:00'
 const {result}=compile(source,{kind:'event',items:[
  {key:'a',kind:'event',title:'第一场',evidence:['第一场','11月10日'],times:[{role:'start',raw:'14:00-15:00'}]},
  {key:'b',kind:'event',title:'第二场',evidence:['第二场','11月11日'],times:[{role:'start',raw:'14:00-15:00'}]},
 ]})
 assert.equal(result.events[0].startTimePointTempId,null)
 assert.equal(result.timePoints.find(point=>point.tempId===result.events[1].startTimePointTempId)?.normalizedValue,'2026-11-11T14:00')
})

test('a date heading for a registration deadline is not inherited by a later event',()=>{
 const source='11月10日\n报名截止\n第一场\n14:00-15:00\n11月11日\n第二场\n14:00-15:00'
 const {result}=compile(source,{kind:'event',items:[
  {key:'a',kind:'event',title:'第一场',evidence:['第一场','11月10日'],times:[{role:'start',raw:'14:00-15:00'}]},
  {key:'b',kind:'event',title:'第二场',evidence:['第二场','11月11日'],times:[{role:'start',raw:'14:00-15:00'}]},
 ]})
 assert.equal(result.events[0].startTimePointTempId,null)
 assert.equal(result.timePoints.find(point=>point.tempId===result.events[1].startTimePointTempId)?.normalizedValue,'2026-11-11T14:00')
})

test('a unique cited system can retain a separately stated operating window and its own deadline',()=>{
 const source='咨询系统于2026年11月24日9:00开放，11月28日17:00关闭。请需参加咨询的同学在11月26日12:00前提交登记表至该系统。'
 const {result}=compile(source,{summary:'咨询系统于2026年11月24日9:00开放，11月28日17:00关闭；需参加咨询的同学在11月26日12:00前提交登记表。',items:[
  {key:'a',kind:'task',title:'提交咨询登记表',action:'提交',object:'登记表',channel:'咨询系统',evidence:['请需参加咨询的同学在11月26日12:00前提交登记表至该系统'],times:[{role:'deadline',raw:'11月26日12:00前'}]},
 ]})
 assert.ok(result.timePoints.some(point=>point.type==='task_deadline'&&point.normalizedValue==='2026-11-26T12:00'))
 assert.ok(result.timePoints.some(point=>point.tempId.startsWith('sem-window-start-')&&point.normalizedValue==='2026-11-24T09:00'))
 assert.ok(result.timePoints.some(point=>point.tempId.startsWith('sem-window-end-')&&point.normalizedValue==='2026-11-28T17:00'))
})

test('a cited from-now registration period remains a window, with a truthful one-of-two requirement',()=>{
 const source='报名时间即日起至2026年9月11日17:00。以下两种方式任选其一：扫描二维码填写表单，或通过指定报名链接提交信息。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'报名参加活动',action:'报名',object:'活动',evidence:[source],times:[{role:'deadline',raw:'2026年9月11日17:00'}],requirements:['任选一项：扫描二维码填写表单，或通过指定报名链接提交信息']}]})
 const task=result.standaloneTasks[0]
 assert.ok(task.completionCriteria.some(value=>value.includes('任选一项')))
 assert.match(task.description,/即日起至2026年9月11日17:00/u)
 assert.ok(result.timePoints.every(point=>point.type!=='task_deadline'))
 assert.ok(result.timePoints.some(point=>point.type==='event_end'&&point.normalizedValue==='2026-09-11T17:00'))
})

test('an unrelated choice elsewhere does not ground a fabricated choice among mandatory materials',()=>{
 const source='请提交申请表和作品。咨询方式任选其一：扫码或拨打电话。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请表和作品',action:'提交',object:'申请表和作品',evidence:['请提交申请表和作品'],requirements:['任选一项：提交申请表或作品'],times:[]}]})
 assert.doesNotMatch(result.standaloneTasks[0].description,/任选一项/u)
})

test('an unrelated window cannot be reassigned to a task deadline by label similarity',()=>{
 const source='报名时间即日起至2026年9月11日17:00。请上传作品。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'上传作品',action:'上传',object:'作品',evidence:[source],times:[{role:'deadline',raw:'2026年9月11日17:00'}]}]})
 assert.ok(result.timePoints.every(point=>!point.normalizedValue))
})

test('a shared channel window is not guessed onto either of multiple competing owners',()=>{
 const source='咨询系统于2026年11月24日9:00开放，11月28日17:00关闭。请提交登记表至该系统；请上传证明至该系统。'
 const {result}=compile(source,{summary:'咨询系统于2026年11月24日9:00开放，11月28日17:00关闭。',items:[
  {key:'a',kind:'task',title:'提交登记表',action:'提交',object:'登记表',channel:'咨询系统',evidence:['请提交登记表至该系统']},
  {key:'b',kind:'task',title:'上传证明',action:'上传',object:'证明',channel:'咨询系统',evidence:['请上传证明至该系统']},
 ]})
 assert.ok(!result.timePoints.some(point=>point.tempId.startsWith('sem-window-')))
})

test('a named time survey can retain source-backed candidate times without creating an appointment',()=>{
 const source='座谈可能安排在2026年11月26日9:00或11月27日15:30，最终日期尚未确定。请填写座谈时段调查问卷。'
 const {result}=compile(source,{summary:'座谈可能安排在2026年11月26日9:00或11月27日15:30，最终日期尚未确定；请填写座谈时段调查问卷。',items:[
  {key:'a',kind:'task',title:'填写座谈时段调查问卷',action:'填写',object:'座谈时段调查问卷',evidence:['请填写座谈时段调查问卷']},
 ]})
 assert.match(result.standaloneTasks[0].description,/11月26日9:00.*11月27日15:30/u)
 assert.equal(result.events.length,0)
 assert.equal(result.timePoints.length,0)
})

test('a source-backed QR or reading-original entry survives a positional paraphrase',()=>{
 const source='请扫描以下二维码或者点击文末“阅读原文”提交报名信息。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交报名信息',action:'提交',object:'报名信息',channel:'扫描二维码或点击文末“阅读原文”',evidence:['请扫描以下二维码或者点击文末“阅读原文”提交报名信息']}]})
 assert.match(result.standaloneTasks[0].description,/扫描二维码或点击文末/u)
 assert.doesNotMatch(result.standaloneTasks[0].description,/https?:\/\//u)
})

test('a prohibited QR action is not reconstructed as a submission channel',()=>{
 const source='请勿扫描以下二维码或者点击文末“阅读原文”，直接到现场报名。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'现场报名',action:'报名',object:'活动',channel:'扫描二维码或点击文末“阅读原文”',evidence:['直接到现场报名']}]})
 assert.doesNotMatch(result.standaloneTasks[0].description,/提交渠道：扫描/u)
})

test('shared delivery variants respect the material contract and report partial capacity',()=>{
 const labels=Array.from({length:60},(_,i)=>`素材${String(i+1).padStart(3,'0')}`)
 const source=['纸质版交到服务台','电子版提交至系统',...Array.from({length:4},(_,i)=>`办理事项${i+1}`),...labels.map(name=>`${name}须签字`)].join('。')+'。'
 const items=[
  {key:'paper',kind:'task',title:'提交纸质版材料',action:'提交',object:'材料',deliveryForm:'纸质版',evidence:['纸质版交到服务台']},
  {key:'digital',kind:'task',title:'提交电子版材料',action:'提交',object:'材料',deliveryForm:'电子版',evidence:['电子版提交至系统']},
  ...Array.from({length:4},(_,i)=>({key:`other${i+1}`,kind:'task',title:`办理事项${i+1}`,action:'办理',object:`事项${i+1}`,evidence:[`办理事项${i+1}`]})),
 ]
 const materials=labels.map((name,i)=>({key:`m${i+1}`,name,owners:i<20?['paper','digital']:[`other${Math.floor((i-20)/10)+1}`],evidence:[`${name}须签字`]}))
 const {result,audit}=compile(source,{items,materials})
 assert.equal(result.materials.length,60)
 assert.ok(audit.losses.some(loss=>loss.reason==='SHARED_DELIVERY_CAPACITY'))
 assert.ok(result.quality.needsHumanReview)
 assert.ok(result.standaloneTasks.every(task=>task.materialTempIds.length<=20))
})

test('an illustrative requirement is not treated as an if-condition',()=>{
 const source='请提交申请材料。请备齐例如报名表的材料，报名表须本人签名。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请材料',action:'提交',object:'申请材料',evidence:['请提交申请材料'],materials:['m']}],materials:[{key:'m',name:'报名表',owners:['a'],evidence:['报名表须本人签名'],requirements:['报名表须本人签名']}]})
 assert.equal(result.materials[0].required,true)
})

test('a source-cited optional attachment remains optional while required materials stay required',()=>{
 const source='请提交报名表和推荐信；科研成果证明材料如有可附。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交报名材料',action:'提交',object:'报名材料',evidence:['请提交报名表和推荐信'],materials:['form','proof']}],materials:[
  {key:'form',name:'报名表',owners:['a'],evidence:['请提交报名表和推荐信']},
  {key:'proof',name:'科研成果证明材料',owners:['a'],evidence:['科研成果证明材料如有可附'],requirements:['如有可附']},
 ]})
 assert.equal(result.materials.find(m=>m.name==='报名表').required,true)
 assert.equal(result.materials.find(m=>m.name==='科研成果证明材料').required,false)
 assert.deepEqual(result.materials.find(m=>m.name==='科研成果证明材料').requirements,['科研成果证明材料如有可附'])
})

test('a necessary attachment is not made optional by another material’s optional qualifier',()=>{
 const source='请提交报名表；科研成果证明材料如有可附。报名表必须签名。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交报名表',action:'提交',object:'报名表',evidence:['请提交报名表'],materials:['form']}],materials:[{key:'form',name:'报名表',owners:['a'],evidence:['报名表必须签名'],requirements:['必须签名']}]})
 assert.equal(result.materials[0].required,true)
})

test('missing shared evidence or opposite delivery scope does not remove the task',()=>{
  const source='电子版须为PDF。电子版提交至平台，纸质版提交至服务台。'
  const {result,audit}=compile(source,{items:[
    {key:'paper',kind:'task',title:'提交纸质版作品',action:'提交',object:'作品',deliveryForm:'纸质版',evidence:['纸质版提交至服务台']},
  ],sharedRequirements:[
    {owners:['paper'],evidence:['电子版须为PDF']},
    {owners:['paper'],evidence:['必须缴纳费用']},
  ]})
  assert.equal(result.standaloneTasks.length,1)
  assert.equal(result.standaloneTasks[0].completionCriteria.length,0)
  assert.ok(audit.losses.some(x=>x.reason==='SHARED_REQUIREMENT_OTHER_DELIVERY_SCOPE'))
  assert.ok(audit.losses.some(x=>x.reason==='SHARED_REQUIREMENT_UNGROUNDED'))
  assert.equal(result.quality.needsHumanReview,true)
})

test('a shared restriction on electronic content also applies to paper delivery',()=>{
  const source='作品可为纸质手写或电子设备手写笔记，不包括纯电子笔记。电子版提交至平台，纸质版提交至服务台。'
  const {result}=compile(source,{items:[
    {key:'digital',kind:'task',title:'提交电子版作品',action:'提交',object:'作品',deliveryForm:'电子版',evidence:['电子版提交至平台']},
    {key:'paper',kind:'task',title:'提交纸质版作品',action:'提交',object:'作品',deliveryForm:'纸质版',evidence:['纸质版提交至服务台']},
  ],sharedRequirements:[{owners:['digital','paper'],evidence:['不包括纯电子笔记']}]})
  for(const task of result.standaloneTasks)assert.ok(task.completionCriteria.includes('不包括纯电子笔记'))
})

test('delivery-specific email requirements do not leak into a print delivery through shared materials',()=>{
 const source='报名表须本人签名。电子版需要Word和PDF两种格式；电子邮件需要同时附上；两个文件均用指定名称命名。打印版也需要提交，地点另行通知。'
 const {result}=compile(source,{items:[
  {key:'e',kind:'task',title:'提交电子版报名表',action:'提交',object:'报名表',deliveryForm:'电子版',materials:['m'],evidence:['电子版需要Word和PDF两种格式']},
  {key:'p',kind:'task',title:'提交打印版报名表',action:'提交',object:'报名表',deliveryForm:'打印版',materials:['m'],evidence:['打印版也需要提交，地点另行通知']},
 ],materials:[{key:'m',name:'报名表',owners:['e','p'],formats:['Word','PDF'],requirements:['电子邮件需要同时附上Word与PDF两个文件','两个文件均用指定名称命名','报名表须本人签名'],evidence:['报名表须本人签名','电子版需要Word和PDF两种格式']}]})
 const paper=result.standaloneTasks.find(task=>task.title.includes('打印版'))
 assert.doesNotMatch(paper.description,/电子邮件|两个文件均用指定名称命名/u)
 assert.match(paper.description,/报名表须本人签名/u)
})

test('an unrelated choice directive does not merge separate obligations',()=>{
 const source='展示主题可以任选一种。请提交报名表；请上传报告。'
 const {result}=compile(source,{items:[
  {key:'a',kind:'task',title:'提交报名表',action:'提交',object:'报名表',evidence:['请提交报名表'],requirements:['任选一种']},
  {key:'b',kind:'task',title:'上传报告',action:'上传',object:'报告',evidence:['请上传报告'],requirements:['任选一种']},
 ],materials:[]})
 assert.equal(result.standaloneTasks.length,2)
 assert.ok(!result.conflicts.some(conflict=>conflict.id.startsWith('sem-choice-')))
})

test('an earlier choice of presentation does not override a later requirement to submit both forms',()=>{
 const source='申请表可任选一种封面，电子版提交资料平台，纸质版提交服务台，两种都必须提交。'
 const {result}=compile(source,{items:[
  {key:'a',kind:'task',title:'提交电子版申请表',action:'提交',object:'申请表',deliveryForm:'电子版',evidence:['电子版提交资料平台'],requirements:['任选一种']},
  {key:'b',kind:'task',title:'提交纸质版申请表',action:'提交',object:'申请表',deliveryForm:'纸质版',evidence:['纸质版提交服务台'],requirements:['任选一种']},
 ],materials:[]})
 assert.ok(!result.conflicts.some(conflict=>conflict.id.startsWith('sem-choice-')))
})

test('an earlier unrelated choice cannot override both deliveries required in a later sentence',()=>{
 const source='申请表封面可以任选一种。电子版提交资料平台；纸质版提交服务台。两种都必须提交。'
 const {result}=compile(source,{items:[
  {key:'a',kind:'task',title:'提交电子版申请表',action:'提交',object:'申请表',deliveryForm:'电子版',evidence:['电子版提交资料平台'],requirements:['任选一种']},
  {key:'b',kind:'task',title:'提交纸质版申请表',action:'提交',object:'申请表',deliveryForm:'纸质版',evidence:['纸质版提交服务台'],requirements:['任选一种']},
 ]})
 assert.ok(!result.conflicts.some(conflict=>conflict.id.startsWith('sem-choice-')))
})

test('not requiring both source-backed delivery branches still creates an exclusive relation',()=>{
 const source='报销凭证任选一种方式提交：电子扫描件12月12日18:00前发至财务邮箱；纸质复印件12月14日12:00前交至服务台，不要求两种都交。'
 const {result}=compile(source,{items:[
  {key:'a',kind:'task',title:'提交电子扫描件',action:'提交',object:'报销凭证',deliveryForm:'电子扫描件',evidence:['电子扫描件12月12日18:00前发至财务邮箱'],requirements:['任选一项：电子扫描件或纸质复印件，不要求两种都交'],times:[{role:'deadline',raw:'12月12日18:00前'}]},
  {key:'b',kind:'task',title:'提交纸质复印件',action:'提交',object:'报销凭证',deliveryForm:'纸质复印件',evidence:['纸质复印件12月14日12:00前交至服务台'],requirements:['任选一项：电子扫描件或纸质复印件，不要求两种都交'],times:[{role:'deadline',raw:'12月14日12:00前'}]},
 ]})
 assert.equal(result.conflicts.filter(c=>c.id.startsWith('sem-choice-')).length,1)
 assert.deepEqual(result.timePoints.map(p=>p.normalizedValue),['2026-12-12T18:00','2026-12-14T12:00'])
})

test('a uniquely cited selected audience remains an eligibility condition',()=>{
 const source='请获选者于12月10日17:00前向活动办提交登记表。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交登记表',action:'提交',object:'登记表',evidence:[source],times:[{role:'deadline',raw:'12月10日17:00前'}]}]})
 assert.match(result.standaloneTasks[0].description,/适用条件待确认：获选者/u)
})

test('a negative audience does not create a positive eligibility condition',()=>{
 const source='未获选者无需提交登记表；获选者请提交登记表。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交登记表',action:'提交',object:'登记表',evidence:['获选者请提交登记表'],times:[]}]})
 assert.match(result.standaloneTasks[0].description,/适用条件待确认：获选者/u)
})

test('overlong shared evidence is explicitly partial instead of silently complete',()=>{
  const longRequirement='作品要求：'+('说明'.repeat(270))
  const source='请提交作品。'+longRequirement+'。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交作品',action:'提交',object:'作品',evidence:['请提交作品']}],sharedRequirements:[{owners:['a'],evidence:[longRequirement]}]})
  assert.equal(result.standaloneTasks.length,1)
  assert.ok(audit.losses.some(x=>x.reason==='SHARED_REQUIREMENT_EVIDENCE_TRUNCATED'))
  assert.equal(result.quality.needsHumanReview,true)
})

for(const [label,separator,locationLabel] of [['fullwidth colon','：','地点：'],['spaced colon','： ','地点：'],['bracket label','： ','【地点】']]){
  test(`same-day events retain their own times and rooms: ${label}`,()=>{
    const source=`校园交流日分为分享会和体验展${separator}11月8日9:00—10:00举办分享会，10:30—12:00举办体验展；${locationLabel}大学生活动中心报告厅（分享）、展厅（体验）。`
    const evidence=[source.slice(0,source.indexOf('；')),source.slice(source.indexOf('；')+1,-1)]
    const {result}=compile(source,{kind:'event',items:[
      {key:'a',kind:'event',title:'校园交流日分享会',evidence,times:[{role:'start',raw:'11月8日9:00—10:00'},{role:'end',raw:'11月8日9:00—10:00'}],location:'大学生活动中心报告厅'},
      {key:'b',kind:'event',title:'校园交流日体验展',evidence,times:[{role:'start',raw:'10:30—12:00'},{role:'end',raw:'10:30—12:00'}],location:'大学生活动中心展厅'},
    ]})
    const second=result.events[1]
    assert.equal(result.timePoints.find(p=>p.tempId===second.startTimePointTempId)?.normalizedValue,'2026-11-08T10:30')
    assert.equal(result.timePoints.find(p=>p.tempId===second.endTimePointTempId)?.normalizedValue,'2026-11-08T12:00')
    assert.match(second.location??'',/大学生活动中心.*展厅/u)
    for(const e of result.evidence)assert.equal(source.slice(e.textStart,e.textEnd),e.quote)
  })
}

test('a bracketed agenda heading anchors both sessions without inventing a new date',()=>{
 const source='【日程】12月18日安排：9:00—10:00在甲楼举行读书会；10:30—12:00在乙楼举行工作坊。'
 const {result}=compile(source,{kind:'event',items:[
  {key:'a',kind:'event',title:'读书会',evidence:['9:00—10:00在甲楼举行读书会'],times:[{role:'start',raw:'9:00—10:00'},{role:'end',raw:'9:00—10:00'}]},
  {key:'b',kind:'event',title:'工作坊',evidence:['10:30—12:00在乙楼举行工作坊'],times:[{role:'start',raw:'10:30—12:00'},{role:'end',raw:'10:30—12:00'}]},
 ]})
 assert.deepEqual(result.timePoints.map(p=>p.normalizedValue),['2026-12-18T09:00','2026-12-18T10:00','2026-12-18T10:30','2026-12-18T12:00'])
})

test('a duration mislabelled as an end does not become an all-day end date',()=>{
 const source='12月9日16:00在实验楼开说明会，活动持续15分钟。'
 const {result,audit}=compile(source,{kind:'event',items:[{key:'a',kind:'event',title:'说明会',evidence:[source],times:[{role:'start',raw:'12月9日16:00'},{role:'end',raw:'活动持续15分钟'}]}]})
 assert.equal(result.events[0].endTimePointTempId,null)
 assert.match(result.events[0].description,/原文时长：15分钟/u)
 assert.equal(result.timePoints.length,1)
 assert.ok(audit.facts.some(f=>f.role==='duration'))
})

test('a stated event length is retained as duration, not interpreted as an end date',()=>{
  const source='分享会12月6日15:00在知行楼101开始，时长25分钟。'
  const {result}=compile(source,{items:[{key:'event',kind:'event',title:'分享会',evidence:[source],location:'知行楼101',times:[{role:'start',raw:'12月6日15:00'},{role:'end',raw:'时长25分钟'}]}]})
  assert.equal(result.events[0].endTimePointTempId,null)
  assert.match(result.events[0].description,/原文时长：25分钟/u)
})

test('a system opening and closing interval stays information with a window, not a calendar event',()=>{
 const source='器材系统12月3日9:00开放，12月16日17:00关闭。请于12月10日12:00前提交登记表。'
 const {result,audit}=compile(source,{items:[
  {key:'register',kind:'task',title:'提交登记表',action:'提交',object:'登记表',evidence:['请于12月10日12:00前提交登记表'],times:[{role:'deadline',raw:'12月10日12:00前'}]},
  {key:'availability',kind:'event',title:'器材系统开放',evidence:['器材系统12月3日9:00开放，12月16日17:00关闭'],times:[{role:'start',raw:'12月3日9:00'},{role:'end',raw:'12月16日17:00'}]},
 ]})
 assert.equal(result.events.length,0)
 const info=result.standaloneTasks.find(item=>item.title.includes('器材系统'))
 assert.ok(info)
 assert.deepEqual(result.timePoints.filter(point=>point.relatedTaskTempIds.includes(info.tempId)).map(point=>[point.type,point.normalizedValue]),[['event_start','2026-12-03T09:00'],['event_end','2026-12-16T17:00']])
 assert.equal(result.timePoints.find(point=>point.type==='task_deadline')?.normalizedValue,'2026-12-10T12:00')
 assert.ok(audit.facts.some(fact=>fact.role==='system_window_information'))
})

test('a real system open-day event is not converted into service availability',()=>{
 const source='系统开放日12月3日9:00开始，12月3日11:00结束，欢迎参加体验活动。'
 const {result}=compile(source,{kind:'event',items:[{key:'event',kind:'event',title:'系统开放日',evidence:[source],times:[{role:'start',raw:'12月3日9:00'},{role:'end',raw:'12月3日11:00'}]}]})
 assert.equal(result.events.length,1)
})

test('date-only survey alternatives remain descriptive, never definite dates',()=>{
 const source='咨询可能安排在12月26日或12月28日，日期尚未确定。请填写时间意向表，表单地址稍后通知。'
 const {result}=compile(source,{summary:'咨询可能安排在12月26日或12月28日，日期尚未确定；需填写时间意向表。',items:[{key:'survey',kind:'task',title:'填写咨询时间意向表',action:'填写',object:'时间意向表',evidence:['请填写时间意向表，表单地址稍后通知'],times:[]}]})
 assert.match(result.standaloneTasks[0].description,/12月26日或12月28日/u)
 assert.equal(result.timePoints.length,0)
})

test('a uniquely named intent survey keeps date-only alternatives even without 时间 in its title',()=>{
 const source='咨询暂考虑12月21日或12月23日，具体日期待定；请填写咨询意向问卷，入口下周公布。'
 const {result}=compile(source,{summary:'咨询暂考虑12月21日或12月23日，具体日期待定；需填写咨询意向问卷。',items:[{key:'survey',kind:'task',title:'填写咨询意向问卷',action:'填写',object:'咨询意向问卷',evidence:['请填写咨询意向问卷，入口下周公布'],times:[]}]})
 assert.match(result.standaloneTasks[0].description,/12月21日或12月23日/u)
 assert.equal(result.timePoints.length,0)
})

test('an approval before acting is a prerequisite, not an eligibility claim',()=>{
 const source='老师批复后请向班长说明调研结果。'
 const {result}=compile(source,{items:[{key:'report',kind:'task',title:'向班长说明调研结果',action:'说明',object:'调研结果',condition:'老师批复后',evidence:[source],times:[]}]})
 assert.match(result.standaloneTasks[0].description,/前置事项：老师批复后/u)
 assert.doesNotMatch(result.standaloneTasks[0].description,/适用条件待确认/u)
})

test('a cited approval condition without the trailing 后 still means a prerequisite when the source includes 后',()=>{
 const source='导师审核通过后请向负责人登记报销信息。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'登记报销信息',action:'登记',object:'报销信息',condition:'导师审核通过',evidence:[source],times:[]}]})
 assert.match(result.standaloneTasks[0].description,/前置事项：导师审核通过后/u)
 assert.doesNotMatch(result.standaloneTasks[0].description,/适用条件待确认/u)
})

test('a stated duration displayed as a notice is not repeated',()=>{
 const source='讲座12月20日15:00开始，时长35分钟。'
 const {result}=compile(source,{kind:'event',items:[{key:'e',kind:'event',title:'讲座',evidence:[source],times:[{role:'start',raw:'12月20日15:00'}],notices:['时长35分钟']}]})
 assert.equal((result.events[0].description.match(/35分钟/gu)??[]).length,1)
})

test('an alternative window is never saved as its first definite date',()=>{
  const source='可选择11月18日或19日前来咨询。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'咨询办理安排',action:'咨询',object:'办理安排',evidence:[source],times:[{role:'window',raw:'11月18日或19日'}]}]})
  assert.equal(result.standaloneTasks.length,1)
  assert.ok(result.timePoints.every(p=>p.normalizedValue===null))
  assert.match(result.standaloneTasks[0].description,/11月18日或19日/u)
  assert.ok(audit.losses.some(x=>/ALTERNATIVE/u.test(x.reason)))
})

test('two possible interview slots are not saved as an application window',()=>{
 const source='访谈可能在12月8日9:00或12月9日14:00进行，最终时间未定；请填写时段调查表。'
 const {result}=compile(source,{items:[{key:'a',kind:'task',title:'填写时段调查表',action:'填写',object:'时段调查表',evidence:['请填写时段调查表'],times:[{role:'window',raw:'12月8日9:00'},{role:'window',raw:'12月9日14:00'}]}]})
 assert.ok(result.timePoints.every(p=>p.normalizedValue===null))
 assert.match(result.standaloneTasks[0].description,/12月8日9:00/u)
 assert.match(result.standaloneTasks[0].description,/12月9日14:00/u)
 assert.doesNotMatch(result.standaloneTasks[0].description,/办理时段/u)
})

test('a next-day activity never inherits the preceding activity date',()=>{
  const source='11月8日9:00举办分享会，次日10:30举办体验展。'
  const {result,audit}=compile(source,{kind:'event',items:[
    {key:'a',kind:'event',title:'分享会',evidence:['11月8日9:00举办分享会'],times:[{role:'start',raw:'11月8日9:00'}]},
    {key:'b',kind:'event',title:'体验展',evidence:['次日10:30举办体验展'],times:[{role:'start',raw:'10:30'}]},
  ]})
  const point=result.timePoints.find(p=>p.tempId===result.events[1].startTimePointTempId)
  assert.notEqual(point?.normalizedValue,'2026-11-08T10:30')
  assert.ok(audit.losses.some(x=>x.id==='b'&&x.reason==='TIME_DAY_OWNER_UNCERTAIN'))
})

test('a role-labelled room cannot be assigned to the other activity',()=>{
  const source='活动地点：大学生活动中心报告厅（分享）、展厅（体验）。分享会与体验展均开放参加。'
  const {result,audit}=compile(source,{kind:'event',items:[{key:'b',kind:'event',title:'体验展',location:'大学生活动中心报告厅',evidence:['活动地点：大学生活动中心报告厅（分享）、展厅（体验）']}]})
  assert.equal(result.events[0].location,null)
  assert.ok(audit.losses.some(x=>x.reason==='LOCATION_NOT_SOURCE_GROUNDED'))
})

test('a paraphrased citation retains the uniquely supported source clause as uncertain',()=>{
  const source='请于11月8日18:00前把课程报告交到办公室。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'递交课程报告',action:'递交',object:'课程报告',description:'支付100元之后递交',evidence:['请于11月8日18:00前将课程报告递交至办公室'],times:[{role:'deadline',raw:'11月8日18:00前'}]}]})
  assert.equal(result.standaloneTasks.length,1)
  assert.equal(result.standaloneTasks[0].userConfirmationRequired,true)
  assert.ok(!result.standaloneTasks[0].description.includes('支付100元'))
  assert.ok(result.evidence.some(e=>e.quote.includes('把课程报告交到办公室')))
  assert.equal(result.timePoints[0]?.normalizedValue,'2026-11-08T18:00')
  assert.equal(result.quality.needsHumanReview,true)
  assert.ok(audit.losses.some(x=>x.layer==='ALIGNMENT'))
})

test('distinct requirements beyond the wire array limit stay visible or explicitly partial',()=>{
  const requirements=Array.from({length:13},(_,i)=>`第${i+1}项原文明示要求`)
  const source='请提交材料。'+requirements.join('；')+'。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交材料',action:'提交',object:'材料',evidence:['请提交材料'],requirements}]})
  const task=result.standaloneTasks[0],visible=[...task.completionCriteria,task.description].join('\n')
  for(const requirement of requirements)assert.ok(visible.includes(requirement),requirement)
  assert.ok(audit.losses.some(x=>/REQUIREMENT.*OVERFLOW/u.test(x.reason)))
  assert.equal(result.quality.needsHumanReview,true)
})

test('material requirements do not erase a task processing window',()=>{
  const source='请于11月13日9:00—10:00到服务台领取申请表。申请表须为PDF。'
  const {result}=compile(source,{items:[{key:'a',kind:'task',title:'领取申请表',action:'领取',object:'申请表',evidence:['请于11月13日9:00—10:00到服务台领取申请表'],times:[{role:'window',raw:'11月13日9:00—10:00'}],materials:['m']}],materials:[{key:'m',name:'申请表',owners:['a'],evidence:['申请表须为PDF'],requirements:['申请表须为PDF']}]})
  assert.match(result.standaloneTasks[0].description,/办理时段：11月13日9:00—10:00/u)
  assert.match(result.standaloneTasks[0].description,/申请表须为PDF/u)
  assert.deepEqual(result.timePoints.map(p=>p.normalizedValue),['2026-11-13T09:00','2026-11-13T10:00'])
})

test('an event start copied into the end role does not invent an end',()=>{
  const source='学术分享会12月9日10:00在知行楼201开始。'
  const {result,audit}=compile(source,{items:[{key:'event',kind:'event',title:'学术分享会',evidence:[source],location:'知行楼201',times:[{role:'start',raw:'12月9日10:00'},{role:'end',raw:'12月9日10:00'}]}]})
  assert.ok(result.events[0].startTimePointTempId)
  assert.equal(result.events[0].endTimePointTempId,null)
  assert.ok(audit.losses.some(loss=>loss.reason==='EVENT_END_COPIED_FROM_START'))
})

test('arrival wording after a start is not a time range',()=>{
  const source='学术分享会12月9日10:00到场，地点知行楼201。'
  const {result}=compile(source,{items:[{key:'event',kind:'event',title:'学术分享会',evidence:[source],times:[{role:'start',raw:'12月9日10:00到场'},{role:'end',raw:'12月9日10:00到场'}]}]})
  assert.equal(result.events[0].endTimePointTempId,null)
})

test('a need-based organization is not presented as a universal obligation or eligibility check',()=>{
  const source='需要申请活动场地的社团请于12月7日16:00前上传申请表。'
  const {result}=compile(source,{items:[{key:'task',kind:'task',title:'上传场地申请表',action:'上传',object:'申请表',evidence:[source],times:[{role:'deadline',raw:'12月7日16:00前'}]}]})
  assert.match(result.standaloneTasks[0].description,/按需办理：需要申请活动场地的社团/u)
  assert.doesNotMatch(result.standaloneTasks[0].description,/适用条件待确认/u)
})

test('a required form field is not mistaken for an audience with a personal need',()=>{
  const source='请填写报名表，报名表需要写明可参加的时段。'
  const {result}=compile(source,{items:[{key:'task',kind:'task',title:'填写报名表',action:'填写',object:'报名表',evidence:['请填写报名表','报名表需要写明可参加的时段'],requirements:['报名表需要写明可参加的时段']}]})
  assert.doesNotMatch(result.standaloneTasks[0].description,/按需办理|适用条件待确认/u)
  assert.match(result.standaloneTasks[0].description,/需要写明可参加的时段/u)
})

test('a need and a separate not-needed clause remain a need-based action',()=>{
  const source='需要纸质教材的同学请填写登记表，不需要教材的同学无需填写。'
  const {result}=compile(source,{items:[{key:'task',kind:'task',title:'填写登记表',action:'填写',object:'登记表',evidence:['需要纸质教材的同学请填写登记表','不需要教材的同学无需填写'],condition:'需要纸质教材的同学；不需要教材的同学无需填写'}]})
  assert.match(result.standaloneTasks[0].description,/按需办理：需要纸质教材的同学/u)
  assert.doesNotMatch(result.standaloneTasks[0].description,/适用条件待确认/u)
})

test('a source-backed explicit need is retained as need rather than eligibility',()=>{
  const source='如需借用展示板，请于12月12日12:00前填写申请。'
  const {result}=compile(source,{items:[{key:'task',kind:'task',title:'填写申请',action:'填写',object:'申请',condition:'如需借用展示板',evidence:[source],times:[{role:'deadline',raw:'12月12日12:00前'}]}]})
  assert.match(result.standaloneTasks[0].description,/按需办理：如需借用展示板/u)
  assert.doesNotMatch(result.standaloneTasks[0].description,/适用条件待确认/u)
})

test('a successor does not inherit an uncited predecessor deadline',()=>{
  const source='请于12月8日17:00前核验设备，完成后登记设备编号。'
  const {result,audit}=compile(source,{items:[
    {key:'check',kind:'task',title:'核验设备',action:'核验',object:'设备',evidence:['请于12月8日17:00前核验设备'],times:[{role:'deadline',raw:'12月8日17:00前'}]},
    {key:'record',kind:'task',title:'登记设备编号',action:'登记',object:'设备编号',evidence:['完成后登记设备编号'],dependsOn:['check'],times:[{role:'deadline',raw:'12月8日17:00前'}]},
  ]})
  const [first,second]=result.standaloneTasks
  assert.equal(result.timePoints.some(point=>point.relatedTaskTempIds.includes(first.tempId)&&point.normalizedValue==='2026-12-08T17:00'),true)
  assert.equal(result.timePoints.some(point=>point.relatedTaskTempIds.includes(second.tempId)&&point.normalizedValue),false)
  assert.ok(audit.losses.some(loss=>loss.reason==='PREDECESSOR_DEADLINE_NOT_SHARED'))
})

test('a dependent action keeps an independently cited shared deadline',()=>{
  const source='两项工作均须于12月8日17:00前完成：先核验设备，再登记设备编号。'
  const {result}=compile(source,{items:[
    {key:'check',kind:'task',title:'核验设备',action:'核验',object:'设备',evidence:['两项工作均须于12月8日17:00前完成','先核验设备'],times:[{role:'deadline',raw:'12月8日17:00前'}]},
    {key:'record',kind:'task',title:'登记设备编号',action:'登记',object:'设备编号',evidence:['两项工作均须于12月8日17:00前完成','再登记设备编号'],dependsOn:['check'],times:[{role:'deadline',raw:'12月8日17:00前'}]},
  ]})
  assert.equal(result.standaloneTasks.every(task=>result.timePoints.some(point=>point.relatedTaskTempIds.includes(task.tempId)&&point.normalizedValue==='2026-12-08T17:00')),true)
})

test('a conditional attachment to the same submission keeps its source-backed deadline',()=>{
  const source='请于12月8日17:00前把申请表上传办理平台。涉及用电设备时还需附安全说明PDF。'
  const {result}=compile(source,{items:[
    {key:'form',kind:'task',title:'上传申请表',action:'上传',object:'申请表',channel:'办理平台',evidence:['请于12月8日17:00前把申请表上传办理平台'],times:[{role:'deadline',raw:'12月8日17:00前'}]},
    {key:'note',kind:'task',title:'提交安全说明',action:'提交',object:'安全说明',channel:'办理平台',condition:'涉及用电设备',evidence:['涉及用电设备时还需附安全说明PDF'],dependsOn:['form'],times:[{role:'deadline',raw:'12月8日17:00前'}]},
  ]})
  assert.equal(result.standaloneTasks.every(task=>result.timePoints.some(point=>point.relatedTaskTempIds.includes(task.tempId)&&point.normalizedValue==='2026-12-08T17:00')),true)
})

test('an attachment using another channel cannot inherit the prior deadline without evidence',()=>{
  const source='请于12月8日17:00前把申请表上传办理平台。另需附安全说明PDF交给服务台。'
  const {result}=compile(source,{items:[
    {key:'form',kind:'task',title:'上传申请表',action:'上传',object:'申请表',channel:'办理平台',evidence:['请于12月8日17:00前把申请表上传办理平台'],times:[{role:'deadline',raw:'12月8日17:00前'}]},
    {key:'note',kind:'task',title:'提交安全说明',action:'提交',object:'安全说明',channel:'服务台',evidence:['另需附安全说明PDF交给服务台'],dependsOn:['form'],times:[{role:'deadline',raw:'12月8日17:00前'}]},
  ]})
  assert.equal(result.timePoints.some(point=>point.relatedTaskTempIds.includes(result.standaloneTasks[1].tempId)&&point.normalizedValue),false)
})

test('an explicitly next-day end uses the same event start date, including the new year',()=>{
  const source='夜间观测12月31日23:20开始，次日0:10结束。'
  const {result}=compile(source,{items:[{key:'event',kind:'event',title:'夜间观测',evidence:[source],times:[{role:'start',raw:'12月31日23:20'},{role:'end',raw:'次日0:10结束'}]}]})
  const event=result.events[0]
  assert.equal(result.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue,'2026-12-31T23:20')
  assert.equal(result.timePoints.find(point=>point.tempId===event.endTimePointTempId)?.normalizedValue,'2027-01-01T00:10')
})

test('next-day wording without the same event start citation is not assigned a date',()=>{
  const source='夜间观测12月31日23:20开始。另一项安排次日0:10结束。'
  const {result}=compile(source,{items:[{key:'event',kind:'event',title:'夜间观测',evidence:['夜间观测12月31日23:20开始'],times:[{role:'start',raw:'12月31日23:20'},{role:'end',raw:'次日0:10结束'}]}]})
  assert.equal(result.events[0].endTimePointTempId,null)
})

test('a whole-notice quote does not join next-day times across distinct sentences',()=>{
  const source='夜间观测12月31日23:20开始。另一项安排次日0:10结束。'
  const {result}=compile(source,{items:[{key:'event',kind:'event',title:'夜间观测',evidence:[source],times:[{role:'start',raw:'12月31日23:20'},{role:'end',raw:'次日0:10结束'}]}]})
  assert.equal(result.events[0].endTimePointTempId,null)
})

test('separate material requirements stay scoped instead of becoming unqualified task rules',()=>{
  const source='请提交研究报告和核验清单。研究报告最多两页；核验清单须本人签名。'
  const {result}=compile(source,{items:[{key:'task',kind:'task',title:'提交研究报告和核验清单',action:'提交',object:'研究报告和核验清单',evidence:['请提交研究报告和核验清单'],materials:['report','checklist']}],materials:[
    {key:'report',name:'研究报告',owners:['task'],evidence:['研究报告最多两页'],requirements:['研究报告最多两页']},
    {key:'checklist',name:'核验清单',owners:['task'],evidence:['核验清单须本人签名'],requirements:['核验清单须本人签名']},
  ]})
  assert.deepEqual(result.materials.find(material=>material.name==='研究报告')?.requirements,['研究报告最多两页'])
  assert.deepEqual(result.materials.find(material=>material.name==='核验清单')?.requirements,['核验清单须本人签名'])
  assert.doesNotMatch(result.standaloneTasks[0].description,/要求：研究报告最多两页|要求：核验清单须本人签名/u)
})

test('a source-backed action before its channel closes retains the closing deadline',()=>{
  const source='登记页面于12月23日24:00关闭，请在关闭前填写登记表。'
  const {result}=compile(source,{items:[{key:'task',kind:'task',title:'填写登记表',action:'填写',object:'登记表',channel:'登记页面',evidence:['请在关闭前填写登记表'],times:[{role:'deadline',raw:'12月23日24:00'}]}]})
  assert.equal(result.timePoints.find(point=>point.type==='task_deadline')?.normalizedValue,'2026-12-24T00:00')
})

test('an unrelated closing time is not turned into a task deadline',()=>{
  const source='资料页面于12月23日24:00关闭，请填写登记表。'
  const {result}=compile(source,{items:[{key:'task',kind:'task',title:'填写登记表',action:'填写',object:'登记表',channel:'登记页面',evidence:['请填写登记表'],times:[{role:'deadline',raw:'12月23日24:00'}]}]})
  assert.equal(result.timePoints.some(point=>point.type==='task_deadline'&&point.normalizedValue),false)
})

test('a window opening is not mistaken for the cited channel closing',()=>{
  const source='登记页面于12月1日9:00开放至12月18日17:00关闭，请在关闭前填写登记表。'
  const task={key:'task',kind:'task',title:'填写登记表',action:'填写',object:'登记表',channel:'登记页面',evidence:['请在关闭前填写登记表']}
  const {result}=compile(source,{items:[{...task,times:[{role:'deadline',raw:'12月1日9:00'}]}]})
  assert.equal(result.timePoints.some(point=>point.type==='task_deadline'&&point.normalizedValue),false)
})

test('an explicitly referenced closing endpoint is retained even with an earlier opening',()=>{
  const source='登记页面于12月1日9:00开放至12月18日17:00关闭，请在关闭前填写登记表。'
  const task={key:'task',kind:'task',title:'填写登记表',action:'填写',object:'登记表',channel:'登记页面',evidence:['请在关闭前填写登记表']}
  const {result}=compile(source,{items:[{...task,times:[{role:'deadline',raw:'12月18日17:00'}]}]})
  assert.equal(result.timePoints.find(point=>point.type==='task_deadline')?.normalizedValue,'2026-12-18T17:00')
})

test('a genuine time range may be cited for both start and end roles',()=>{
  const source='学术分享会12月9日10:00—11:30在知行楼201举行。'
  const {result}=compile(source,{items:[{key:'event',kind:'event',title:'学术分享会',evidence:[source],location:'知行楼201',times:[{role:'start',raw:'12月9日10:00—11:30'},{role:'end',raw:'12月9日10:00—11:30'}]}]})
  const event=result.events[0]
  assert.equal(result.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue,'2026-12-09T10:00')
  assert.equal(result.timePoints.find(point=>point.tempId===event.endTimePointTempId)?.normalizedValue,'2026-12-09T11:30')
})

test('an unsupported numeric requirement cannot become a definite task fact',()=>{
  const source='请提交课程报告。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交课程报告',action:'提交',object:'课程报告',evidence:['请提交课程报告'],requirements:['必须缴纳500元报名费']}]})
  const task=result.standaloneTasks[0]
  assert.equal(task.completionCriteria.some(r=>r.includes('500元')),false)
  assert.doesNotMatch(task.description,/必须缴纳500元/u)
  assert.ok(audit.losses.some(x=>x.layer==='REQUIREMENT'))
  assert.equal(result.quality.needsHumanReview,true)
})

test('Chinese and Arabic quantities can refer to the same supported requirement',()=>{
  const source='请提交报名表，报告最多两页。'
  const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交报名表',action:'提交',object:'报名表',evidence:['请提交报名表'],requirements:['报告最多2页']}]})
  assert.ok(result.standaloneTasks[0].completionCriteria.includes('报告最多2页'))
})

test('equivalent choice units preserve the alternative channels',()=>{
  const source='请于11月22日17:00前提交申请表：纸质版交到A102，或者电子版上传课程平台，任选一种。'
  const requirement='任选一项：纸质版交到A102，或电子版上传课程平台'
  const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:[source],requirements:[requirement]}]})
  assert.ok(result.standaloneTasks[0].completionCriteria.includes(requirement))
})

test('different numbers of required choices are not treated as equivalent',()=>{
  const source='请提交申请表，以下材料任选两种。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:[source],requirements:['任选一项材料']} ]})
  assert.equal(result.standaloneTasks[0].completionCriteria.length,0)
  assert.ok(audit.losses.some(x=>x.reason==='REQUIREMENT_NUMBER_NOT_IN_SOURCE'))
})

test('a number contained inside a different number does not ground a requirement',()=>{
  const source='请提交课程报告，活动共有1500人参加。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交课程报告',action:'提交',object:'课程报告',evidence:['请提交课程报告'],requirements:['必须缴纳500元报名费']}]})
  assert.equal(result.standaloneTasks[0].completionCriteria.length,0)
  assert.ok(audit.losses.some(x=>x.reason==='REQUIREMENT_NUMBER_NOT_IN_SOURCE'))
})

test('a count of attendees does not ground an invented amount of money',()=>{
  const source='请提交课程报告，活动共有500人参加。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交课程报告',action:'提交',object:'课程报告',evidence:['请提交课程报告'],requirements:['必须缴纳500元报名费']}]})
  assert.equal(result.standaloneTasks[0].completionCriteria.length,0)
  assert.ok(audit.losses.some(x=>x.reason==='REQUIREMENT_NUMBER_UNIT_NOT_IN_SOURCE'))
})

test('a source prohibition does not ground the opposite affirmative requirement',()=>{
  const source='请提交申请表，不得提交原件。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['请提交申请表'],requirements:['必须提交原件']}]})
  assert.equal(result.standaloneTasks[0].completionCriteria.length,0)
  assert.ok(audit.losses.some(x=>x.reason==='REQUIREMENT_POLARITY_CONFLICT'))
})
