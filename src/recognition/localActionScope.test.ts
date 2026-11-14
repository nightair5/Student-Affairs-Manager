import {expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'
import {assembleProductFirstSuggestion} from './materialChannelGrounding'

const now=new Date('2026-11-14T09:00:00+08:00')
function recognize(source:string){
 const base=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:now,timezone:'Asia/Shanghai',projects:[],tasks:[]})
 return convertDirectResult(improveDirectFallback(base,source,{scopeAware:true,timezone:'Asia/Shanghai'}),source,undefined,{scopeAware:true}).result
}

it('retains the actual form object instead of manufacturing registration from a descriptive participant phrase',()=>{
 const source='【实践活动】为帮助同学了解内容，现安排两场面向报名同学的活动。周一上午09:00—10:30在东楼301举行选题讲座。周一下午14:00—16:00在西楼102举行成果工作坊。希望参加工作坊的同学请周日20:00前填写在线报名表；讲座无需报名。两场均可自愿参加。'
 const result=recognize(source)
 const actions=result.standaloneTasks.filter(task=>task.actionVerb!=='查看')
 expect(actions.map(task=>[task.actionVerb,task.actionObject])).toEqual([['填写','在线报名表']])
 expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(actions[0].tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-15T20:00')
 expect(result.events.map(event=>event.title)).toEqual(['选题讲座','成果工作坊'])
 expect(result.events.find(event=>event.title==='成果工作坊')?.relatedTaskTempIds).toContain(actions[0].tempId)
 expect(result.events.find(event=>event.title==='选题讲座')?.relatedTaskTempIds??[]).not.toContain(actions[0].tempId)
})

it('retains a source-backed action when a guessed topic would reverse its verb and object',()=>{
 const result=recognize('报名者周日提交申请。入围者将在下周一或下周二参加面试，具体时段另行通知。')
 expect(result.standaloneTasks.some(task=>task.actionVerb==='提交'&&task.actionObject==='申请')).toBe(true)
 expect(result.standaloneTasks.some(task=>task.title.includes('申请报名者'))).toBe(false)
 const submission=result.standaloneTasks.find(task=>task.actionVerb==='提交'&&task.actionObject==='申请')!
 expect(result.timePoints.some(point=>point.relatedTaskTempIds.includes(submission.tempId)&&point.normalizedValue==='2026-11-15'&&point.type==='event_start')).toBe(true)
 expect(result.timePoints.some(point=>point.relatedTaskTempIds.includes(submission.tempId)&&point.type.endsWith('_deadline')&&point.normalizedValue)).toBe(false)
 const interview=result.standaloneTasks.find(task=>task.actionVerb==='参加'&&task.actionObject==='面试')
 expect(interview?.title).toContain('如符合条件')
 expect(interview?.description).toContain('2026-11-16');expect(interview?.description).toContain('2026-11-17')
 expect(interview?.timePointTempIds).toEqual([]);expect(result.events).toHaveLength(0)
})

it('retains the personal handoff and a separately completable selection-dependent interview',()=>{
 const result=recognize('请周日18:00前交研究摘要。组织方筛选部分报名者，下周二或下周四参加面谈，具体时段另行通知。')
 const handoff=result.standaloneTasks.find(task=>task.actionObject==='研究摘要')
 const interview=result.standaloneTasks.find(task=>task.actionObject==='面谈')
 expect(handoff?.actionVerb).toBe('交')
 expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(handoff!.tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-15T18:00')
 expect(interview?.title).toContain('如符合条件')
 expect(interview?.description).toContain('2026-11-17');expect(interview?.description).toContain('2026-11-19')
 expect(interview?.timePointTempIds).toEqual([]);expect(result.events).toHaveLength(0)
})

it('keeps a timed handoff and a separately conditional interview when only some people are notified',()=>{
 const result=recognize('本周六17:00之前发课程论文给老师。老师评阅后会通知部分同学在下周一或周三进行答辩，地点另行通知。')
 const submission=result.standaloneTasks.find(task=>task.actionObject==='课程论文')
 const defense=result.standaloneTasks.find(task=>task.actionObject==='答辩')
 expect(submission?.actionVerb).toBe('发送')
 expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(submission!.tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-14T17:00')
 expect(defense?.title).toContain('如符合条件')
 expect(defense?.description).toContain('2026-11-16');expect(defense?.description).toContain('2026-11-18')
 expect(defense?.timePointTempIds).toEqual([]);expect(result.events).toHaveLength(0)
})

it('keeps a positive delivery even when a different act is prohibited',()=>{
 const result=recognize('请于周三17:00前提交申请表，禁止伪造签名。')
 expect(result.standaloneTasks.some(task=>task.actionVerb==='提交'&&task.actionObject.includes('申请表'))).toBe(true)
 expect(result.standaloneTasks.some(task=>task.actionVerb==='伪造')).toBe(false)
})

it('preserves a parallel action without giving it a sibling deadline or dependency',()=>{
 const result=recognize('请在周日18:00前提交讲稿；周二报名培训，同时还要领取通行证。')
 const submission=result.standaloneTasks.find(task=>task.actionObject==='讲稿')!
 const registration=result.standaloneTasks.find(task=>task.actionObject==='培训')!
 const pass=result.standaloneTasks.find(task=>task.actionObject==='通行证')!
 expect([submission,registration,pass].every(Boolean)).toBe(true)
 expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(submission.tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-15T18:00')
 expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(registration.tempId)&&point.type==='event_start')?.normalizedValue).toBe('2026-11-17')
 expect(pass.timePointTempIds).toEqual([]);expect(pass.dependencyTempIds).toEqual([])
 const negative=recognize('周二报名培训，同时不要领取通行证。')
 expect(negative.standaloneTasks.some(task=>task.actionVerb==='领取'&&task.actionObject==='通行证')).toBe(false)
})

it('does not attach a labelled form across an intervening independent notice heading',()=>{
 const source='【校园志愿者招募】\n活动时间：11月20日\n活动地点：文化中心\n【另一项目招募】\n报名方式：填写报名问卷。'
 const result=recognize(source),event=result.events.find(item=>item.title.includes('校园志愿者'))
 const form=result.standaloneTasks.find(item=>item.actionObject.includes('报名问卷'))
 expect(event).toBeTruthy();expect(form).toBeTruthy()
 expect(event?.relatedTaskTempIds??[]).not.toContain(form?.tempId)
})

it('keeps the handed-over object and recipient without borrowing another actor’s email',()=>{
 const source='学生周一17:00前把照片交给组长；组长周二12:00前汇总后发至 office@example.edu。'
 const result=recognize(source),student=result.standaloneTasks.find(task=>task.actionObject==='照片')
 expect(student).toBeTruthy()
 expect(result.standaloneTasks.some(task=>task.actionObject==='给组长')).toBe(false)
 expect(result.materials.find(material=>material.relatedTaskTempIds.includes(student!.tempId))?.submissionChannel).toBe('组长')
 expect(result.materials.find(material=>material.relatedTaskTempIds.includes(student!.tempId))?.submissionChannel).not.toContain('office@example.edu')
 expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(student!.tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-16T17:00')
})

it('keeps a recipient’s coordinated follow-up conditional and dates it separately',()=>{
 for(const [source,object,role,firstDay,laterDay] of [
  ['请周二交报名资料给班长，班长周四前汇总并报送学院。','报名资料','班长周四前汇总并报送学院','2026-11-17','2026-11-19'],
  ['请周三交课程表给辅导员，辅导员周五前核对并报送教务处。','课程表','辅导员周五前核对并报送教务处','2026-11-18','2026-11-20'],
 ]){
  const base=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:now,timezone:'Asia/Shanghai',projects:[],tasks:[]})
  const assembled=assembleProductFirstSuggestion(base,{sourceText:source,referenceTime:'2026-11-14T09:00:00+08:00',timezone:'Asia/Shanghai'}).result
  const result=convertDirectResult(improveDirectFallback(assembled,source,{scopeAware:true,timezone:'Asia/Shanghai'}),source,undefined,{scopeAware:true}).result
  const submission=result.standaloneTasks.find(task=>task.actionObject.includes(object))!
  const followup=result.standaloneTasks.find(task=>task.actionVerb==='报送')!
  expect(submission).toBeTruthy();expect(followup).toBeTruthy()
  expect(followup.title).toContain('如符合条件');expect(followup.description).toContain(role)
  expect(result.timePoints.some(point=>point.relatedTaskTempIds.includes(submission.tempId)&&point.normalizedValue===firstDay)).toBe(true)
  expect(result.timePoints.some(point=>point.relatedTaskTempIds.includes(submission.tempId)&&point.normalizedValue===laterDay)).toBe(false)
  expect(result.timePoints.some(point=>point.relatedTaskTempIds.includes(followup.tempId)&&point.normalizedValue===laterDay)).toBe(true)
 }
})

it('keeps a separately instructed return with its own date and no inferred shared goal',()=>{
 const source='周二17:00前提交项目计划；另请在周四中午12:00前归还实验室借书。这两件事互不相关。'
 const result=recognize(source)
 const submission=result.standaloneTasks.find(task=>task.actionVerb==='提交')!
 const returned=result.standaloneTasks.find(task=>task.actionVerb==='归还')!
 expect(submission).toBeTruthy();expect(returned?.actionObject).toBe('实验室借书')
 expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(submission.tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-17T17:00')
 expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(returned.tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-19T12:00')
 expect(result.goalGroups??[]).toHaveLength(0)
 const alternate=recognize('周一17:00前提交读书报告；此外，在周三中午12:00前归还借用的录音笔。两项互不相关。')
 const alternateReturn=alternate.standaloneTasks.find(task=>task.actionVerb==='归还')!
 expect(alternateReturn?.actionObject).toBe('借用的录音笔')
 expect(alternate.timePoints.find(point=>point.relatedTaskTempIds.includes(alternateReturn.tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-18T12:00')
})

it('preserves affirmative registration while rejecting a separately cited negated registration',()=>{
 const source='请未登记的同学填写报名表；已经登记的人无需重新报名。'
 const result=recognize(source)
 expect(result.standaloneTasks.some(task=>task.actionVerb==='填写'&&task.actionObject.includes('报名表'))).toBe(true)
 expect(result.standaloneTasks.some(task=>task.actionVerb==='报名'&&task.actionObject.includes('无需'))).toBe(false)
})
