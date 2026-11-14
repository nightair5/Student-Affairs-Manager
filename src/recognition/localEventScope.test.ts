import {expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'

const referenceTime=new Date('2026-11-14T09:00:00+08:00')
function recognize(source:string){
 const base=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime,timezone:'Asia/Shanghai',projects:[],tasks:[]})
 return convertDirectResult(improveDirectFallback(base,source,{scopeAware:true,timezone:'Asia/Shanghai'}),source,undefined,{scopeAware:true}).result
}

it('retains each named session in a closed shared-date, shared-venue list',()=>{
 const source='周四在报告厅举办两场活动：10:00—11:00安全培训，15:00—16:00实习说明。'
 const result=recognize(source)
 expect(result.events.map(event=>[event.title,result.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue,result.timePoints.find(point=>point.tempId===event.endTimePointTempId)?.normalizedValue,event.location])).toEqual([
  ['安全培训','2026-11-19T10:00','2026-11-19T11:00','报告厅'],
  ['实习说明','2026-11-19T15:00','2026-11-19T16:00','报告厅'],
 ])
 expect(result.standaloneTasks.some(task=>task.title.includes('安全培训')||task.title.includes('实习说明'))).toBe(false)
})

it('does not inherit a shared venue through a mismatched or unclosed list',()=>{
 for(const source of [
  '周四在报告厅举办三场活动：10:00—11:00安全培训，15:00—16:00实习说明。',
  '周四在报告厅举办两场活动：10:00—11:00安全培训，周五15:00—16:00实习说明。',
  '周四在报告厅举办两场活动：10:00—11:00安全培训，15:00—16:00提交申请。',
  '周四在报告厅举办两场活动：10:00—11:00安全培训，15:00—16:00实习说明，地点或时间另行通知。',
 ])expect(recognize(source).events.some(event=>event.tempId.startsWith('direct-session:'))).toBe(false)
})

it('keeps the shared event weekday when a later form has a different weekday',()=>{
 const source='【写作活动】周二在图书馆举办两场：09:00—10:00资料检索，15:00—16:00论文写作。参加论文写作的同学请周一18:00前填写报名表；资料检索无需报名。'
 const result=recognize(source),form=result.standaloneTasks.find(task=>task.actionObject.includes('报名表'))!
 expect(result.events.map(event=>[event.title,result.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue,result.timePoints.find(point=>point.tempId===event.endTimePointTempId)?.normalizedValue])).toEqual([
  ['资料检索','2026-11-17T09:00','2026-11-17T10:00'],['论文写作','2026-11-17T15:00','2026-11-17T16:00'],
 ])
 expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(form.tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-16T18:00')
 expect(result.events.find(event=>event.title==='论文写作')?.relatedTaskTempIds).toContain(form.tempId)
 expect(result.events.find(event=>event.title==='资料检索')?.relatedTaskTempIds??[]).not.toContain(form.tempId)
})

it('recovers separately dated activities in one sentence even when a later sentence requests a form',()=>{
 const source='周二14:00在东楼听就业分享，周二16:00在西楼参加面试训练。请周一18:00前提交训练报名表，分享无需报名。'
 const result=recognize(source)
 expect(result.events.map(event=>[event.title,result.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue,event.location])).toEqual([
  ['就业分享','2026-11-17T14:00','东楼'],['面试训练','2026-11-17T16:00','西楼'],
 ])
 const form=result.standaloneTasks.find(task=>task.actionObject.includes('训练报名表'))!
 expect(form).toBeTruthy()
 expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(form.tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-16T18:00')
 expect(result.events.find(event=>event.title==='就业分享')?.relatedTaskTempIds??[]).not.toContain(form.tempId)
})

it('retains each date, clock and venue when locations are labelled after event names',()=>{
 const result=recognize('周一14:00—15:00有学术写作讲座，地点东楼201；同日16:00—17:30举行研究方法工作坊，地点西楼305。')
 expect(result.events.map(event=>[event.title,result.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue,result.timePoints.find(point=>point.tempId===event.endTimePointTempId)?.normalizedValue,event.location])).toEqual([
  ['学术写作讲座','2026-11-16T14:00','2026-11-16T15:00','东楼201'],['研究方法工作坊','2026-11-16T16:00','2026-11-16T17:30','西楼305'],
 ])
 expect(result.standaloneTasks).toHaveLength(0)
})

it('retains the shared weekday for two event clauses before a separately stated registration',()=>{
 const result=recognize('周三上午10:00在一号楼举办信息会，下午15:00在二号楼举办作品交流；请于周二18:00前为信息会报名。')
 expect(result.events.map(event=>[event.title,result.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue,event.location])).toEqual([
  ['信息会','2026-11-18T10:00','一号楼'],['作品交流','2026-11-18T15:00','二号楼'],
 ])
 const registration=result.standaloneTasks.find(task=>task.actionVerb==='报名'&&task.actionObject==='信息会')!
 expect(registration).toBeTruthy()
 expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(registration.tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-17T18:00')
 expect(result.events.find(event=>event.title==='信息会')?.relatedTaskTempIds).toContain(registration.tempId)
 expect(result.events.find(event=>event.title==='作品交流')?.relatedTaskTempIds??[]).not.toContain(registration.tempId)
})

it('handles source lists where the named event or a shared venue precedes its own time',()=>{
 const first=recognize('【活动须知】阅读分享周一14:00在一号楼，沟通体验周一16:00在二号楼。')
 expect(first.events.map(event=>[event.title,first.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue,event.location])).toEqual([
  ['阅读分享','2026-11-16T14:00','一号楼'],['沟通体验','2026-11-16T16:00','二号楼'],
 ])
 const second=recognize('【周五学习日】公共教室一楼报告厅上午09:30—10:30有资料讲解，下午15:00—16:00有方法交流，欢迎参加。')
 expect(second.events.map(event=>[event.title,second.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue,second.timePoints.find(point=>point.tempId===event.endTimePointTempId)?.normalizedValue,event.location])).toEqual([
  ['资料讲解','2026-11-20T09:30','2026-11-20T10:30','公共教室一楼报告厅'],['方法交流','2026-11-20T15:00','2026-11-20T16:00','公共教室一楼报告厅'],
 ])
})

it('binds a bare registration to only the named event and its own deadline',()=>{
 const source='【活动须知】阅读分享周一14:00在一号楼，沟通体验周一16:00在二号楼。只有参加沟通体验的同学需在周日20:00前报名，阅读分享不报名。'
 const result=recognize(source),form=result.standaloneTasks.find(task=>task.actionVerb==='报名'&&task.actionObject==='沟通体验')
 expect(form).toBeTruthy()
 expect(result.events).toHaveLength(2)
 expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(form!.tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-15T20:00')
 expect(result.events.find(event=>event.title==='沟通体验')?.relatedTaskTempIds).toContain(form!.tempId)
 expect(result.events.find(event=>event.title==='阅读分享')?.relatedTaskTempIds??[]).not.toContain(form!.tempId)
 expect(result.standaloneTasks.some(task=>task.actionVerb==='报名'&&task.actionObject==='阅读分享')).toBe(false)
})

it('links an explicitly scoped form to its named event without linking a different event',()=>{
 const source='周三14:00在西楼参加写作分享，周五15:30在东楼观看海报展示。参加海报展示的人请周二12:00前提交报名表。'
 const result=recognize(source),form=result.standaloneTasks.find(task=>task.actionObject.includes('报名表'))!
 expect(result.events).toHaveLength(2);expect(form).toBeTruthy()
 expect(result.events.find(event=>event.title==='海报展示')?.relatedTaskTempIds).toContain(form.tempId)
 expect(result.events.find(event=>event.title==='写作分享')?.relatedTaskTempIds??[]).not.toContain(form.tempId)
})

it('retains a known clock and approximate duration when the event date is pending',()=>{
 const result=recognize('线上经验交流会晚上9点15分开始，约15分钟；日期另行通知。欢迎参加。')
 expect(result.events).toHaveLength(1);expect(result.events[0].title).toBe('线上经验交流会')
 expect(result.events[0].description).toContain('时间说明：晚上9点15分（日期待定）')
 expect(result.events[0].description).toContain('原文时长：约15分钟')
 expect(result.events[0].startTimePointTempId).toBeNull();expect(result.events[0].endTimePointTempId).toBeNull()
 expect(result.standaloneTasks).toHaveLength(0)
 const alternate=recognize('线上分享晚上八点半开始，约持续20分钟，举办日期另行通知。')
 expect(alternate.events[0].description).toContain('原文时长：约持续20分钟')
})

it('does not turn alternative or cancelled undated events into a confirmed clock',()=>{
 for(const source of [
  '线上经验交流会晚上9点15分开始，日期另行通知。本次取消。欢迎参加。',
  '线上经验交流会晚上9点15分或者晚上10点开始，日期另行通知。欢迎参加。',
 ])expect(recognize(source).events.some(event=>event.tempId.startsWith('local-undated-event:'))).toBe(false)
})

it('keeps a named replacement event rather than moving the cancelled event onto its date',()=>{
 const source='原定周二15:00的摄影讲座取消，改为周四14:00在西楼进行摄影分享，已经登记的人无需重新报名。'
 const result=recognize(source)
 expect(result.events.map(event=>event.title)).toEqual(['摄影分享'])
 expect(result.events[0].location).toBe('西楼')
 expect(result.timePoints.find(point=>point.tempId===result.events[0].startTimePointTempId)?.normalizedValue).toBe('2026-11-19T14:00')
 expect(result.standaloneTasks.some(task=>task.actionVerb==='报名')).toBe(false)
 const moved=recognize('原定周一15:00在东楼的宣讲改为周三16:00在西楼举行；已经报名的同学无需重新报名。')
 expect(moved.events.map(event=>event.title)).toEqual(['宣讲'])
 expect(moved.events[0].location).toBe('西楼')
 expect(moved.timePoints.find(point=>point.tempId===moved.events[0].startTimePointTempId)?.normalizedValue).toBe('2026-11-18T16:00')
 expect(moved.standaloneTasks.some(task=>task.actionVerb==='报名')).toBe(false)
})

it('recognizes a subject-first reschedule without making the registered audience register again',()=>{
 const source='校园创作分享原定周二14:00在南楼201举办，现调整至周四15:00—16:30在北楼302举办。原有报名仍然有效，无需再次提交报名表。请已报名同学携带纸和笔。'
 const result=recognize(source)
 expect(result.events.map(event=>event.title)).toEqual(['校园创作分享'])
 expect(result.events[0].location).toBe('北楼302')
 expect(result.timePoints.find(point=>point.tempId===result.events[0].startTimePointTempId)?.normalizedValue).toBe('2026-11-19T15:00')
 expect(result.timePoints.find(point=>point.tempId===result.events[0].endTimePointTempId)?.normalizedValue).toBe('2026-11-19T16:30')
 expect(result.standaloneTasks.some(task=>task.actionVerb==='报名'||task.actionVerb==='提交')).toBe(false)
 expect(result.events[0].description).toContain('请已报名同学携带纸和笔')
})
