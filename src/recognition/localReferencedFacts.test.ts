import {expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {assembleProductFirstSuggestion} from './materialChannelGrounding'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'
import {localSameDayTime,localDeliveryReferences} from './localReferencedFacts'

const referenceTime='2026-11-14T09:00:00+08:00',timezone='Asia/Shanghai'
function recognize(source:string){
 const base=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
 const assembled=assembleProductFirstSuggestion(base,{sourceText:source,referenceTime,timezone}).result
 return convertDirectResult(improveDirectFallback(assembled,source,{scopeAware:true,timezone}),source,undefined,{scopeAware:true}).result
}

it('retains a cross-midnight event as one event with both endpoints and its own venue',()=>{
 const r=recognize('周六23:30至次日00:30在天台进行观星活动，参与者需携带学生证。')
 expect(r.events).toHaveLength(1);expect(r.standaloneTasks).toHaveLength(0)
 const event=r.events[0]
 expect([event.title,event.location]).toEqual(['观星活动','天台'])
 expect(r.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.normalizedValue).toBe('2026-11-14T23:30')
 expect(r.timePoints.find(p=>p.tempId===event.endTimePointTempId)?.normalizedValue).toBe('2026-11-15T00:30')
 expect(event.description).toContain('学生证')
})

it('uses only the cancelled event day for an explicit same-day continuing event',()=>{
 const r=recognize('原定周一10:00的校园导览取消；同日15:00在图书馆的书展照常举行。')
 expect(r.standaloneTasks).toHaveLength(0);expect(r.events).toHaveLength(1)
 expect([r.events[0].title,r.events[0].location]).toEqual(['书展','图书馆'])
 expect(r.timePoints.find(p=>p.tempId===r.events[0].startTimePointTempId)?.normalizedValue).toBe('2026-11-16T15:00')
 expect(r.events[0].endTimePointTempId).toBeNull()
})

it('keeps date references unresolved across a new section or conflicting anchors',()=>{
 for(const text of [
  // A new heading closes scope; line wrapping alone now retains an explicit same-day reference.
  '周一10:00校园导览。\n【另一个项目】\n同日15:00在图书馆的书展照常举行。',
  '周一或周二安排导览；同日15:00在图书馆的书展照常举行。',
  '原定周一的导览改为周二；同日15:00在图书馆的书展照常举行。',
 ])expect(localSameDayTime(text,'书展','15:00',referenceTime,timezone)).toBeNull()
})

it('retains an explicit same-day reference when a paragraph break only wraps the notice',()=>{
 const text='周一10:00校园导览。\n同日15:00在图书馆的书展照常举行。'
 expect(localSameDayTime(text,'书展','15:00',referenceTime,timezone)?.parsed.normalizedValue).toBe('2026-11-16T15:00')
})

it('retains the still-required form, elided material, channel and deadline without reviving the cancelled form',()=>{
 const r=recognize('纸质申请材料取消提交，电子版仍须周四20:00前发至 office@example.edu。')
 expect(r.standaloneTasks).toHaveLength(1);expect(r.events).toHaveLength(0)
 const task=r.standaloneTasks[0],material=r.materials.find(m=>task.materialTempIds.includes(m.tempId))!
 expect([task.actionVerb,task.actionObject]).toEqual(['发送','申请材料'])
 expect(material.name).toBe('申请材料');expect(material.formatRequirements).toContain('电子版')
 expect(material.submissionChannel).toBe('office@example.edu')
 expect(r.timePoints.find(p=>p.relatedTaskTempIds.includes(task.tempId))?.normalizedValue).toBe('2026-11-19T20:00')
})

it('keeps two independent form references without collapsing their materials or deadlines',()=>{
 const r=recognize('纸质研究报告无需提交，电子版仍须周五18:30前上传至课程平台。电子申请表取消提交，纸质版仍须周日12:00前交至办公室。')
 const report=r.standaloneTasks.find(t=>t.actionObject==='研究报告')!,form=r.standaloneTasks.find(t=>t.actionObject==='申请表')!
 expect(report).toBeTruthy();expect(form).toBeTruthy()
 expect(r.timePoints.find(p=>p.relatedTaskTempIds.includes(report.tempId))?.normalizedValue).toBe('2026-11-20T18:30')
 expect(r.timePoints.find(p=>p.relatedTaskTempIds.includes(form.tempId))?.normalizedValue).toBe('2026-11-15T12:00')
 expect(report.dependencyTempIds).toEqual([]);expect(form.dependencyTempIds).toEqual([])
})

it('does not invent material references for unknown, conditional or unrelated counterpart deliveries',()=>{
 for(const text of [
  '纸质申请材料取消提交。电子版仍须周四20:00前发至 office@example.edu。',
  '纸质申请材料无需提交，电子版也无需周四20:00前发至 office@example.edu。',
  '纸质申请材料取消提交，如获准电子版仍须周四20:00前发至 office@example.edu。',
  '旧申请表和简历取消提交，电子版仍须周四20:00前发至 office@example.edu。',
 ])expect(localDeliveryReferences(text)).toEqual([])
})

it('retains organizer dates and roles as context rather than personal events or obligations',()=>{
 const r=recognize('请于周日18:00前上传作品至课程平台。评审委员会将于周二14:00在会议室开展作品评审，评审结果周五公布。')
 expect(r.events).toHaveLength(0);expect(r.standaloneTasks).toHaveLength(1)
 expect(r.standaloneTasks[0].actionObject).toBe('作品')
 expect(r.standaloneTasks[0].description).toContain('评审委员会将于周二14:00在会议室开展作品评审，评审结果周五公布')
 expect(r.timePoints.find(p=>p.relatedTaskTempIds.includes(r.standaloneTasks[0].tempId))?.normalizedValue).toBe('2026-11-15T18:00')
})

it('keeps personal reviewer invitations and conditional candidate attendance',()=>{
 const invitation=recognize('周三14:00在会堂举行作品评审会，邀请学生评委到场参加。')
 expect(invitation.events.some(e=>e.title==='作品评审会')).toBe(true)
 const organizedInvitation=recognize('评审委员会将于周二14:00在会议室开展作品评审，邀请学生评委到场参加。')
 expect(organizedInvitation.events.some(e=>e.title==='作品评审')).toBe(true)
 const conditional=recognize('请周日18:00前交研究摘要。组织方筛选部分报名者，下周二或下周四参加面谈，具体时段另行通知。')
 expect(conditional.events).toHaveLength(0)
 const action=conditional.standaloneTasks.find(t=>t.actionObject==='面谈')!
 expect(action.title).toContain('如符合条件');expect(action.timePointTempIds).toEqual([])
 expect(action.description).toContain('2026-11-17');expect(action.description).toContain('2026-11-19')
})

it('keeps a direct reader-subject submission cutoff separate from a later conditional defense',()=>{
 const r=recognize('报名者周日18:00前提交摘要。筛选后入围同学下周二或下周三参加答辩，具体时段另行通知。')
 const submission=r.standaloneTasks.find(t=>t.actionObject==='摘要')!,defense=r.standaloneTasks.find(t=>t.actionObject==='答辩')!
 expect(r.timePoints.find(p=>p.relatedTaskTempIds.includes(submission.tempId)&&p.type.endsWith('_deadline'))?.normalizedValue).toBe('2026-11-15T18:00')
 expect(defense.title).toContain('如符合条件');expect(defense.timePointTempIds).toEqual([])
 expect(r.events).toHaveLength(0)
})
