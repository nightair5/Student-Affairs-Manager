import {expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'
const referenceTime=new Date('2026-11-14T09:00:00+08:00')
const recognize=(source:string)=>improveDirectFallback(buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime,timezone:'Asia/Shanghai',projects:[],tasks:[]}),source,{scopeAware:true})

it('retains a selected-person follow-up with alternative weekdays without a confirmed event',()=>{
 const source='已报名的同学请周六晚上交申请表给组长。主办方根据材料筛选部分同学，于下周二或下周三参加面谈。'
 const result=recognize(source),descriptions=result.standaloneTasks.map(task=>task.description).join('\n')
 expect(descriptions).toContain('筛选部分同学')
 expect(descriptions).toContain('2026-11-17')
 expect(descriptions).toContain('2026-11-18')
 expect(descriptions).toContain('尚未确定')
 expect(result.events).toHaveLength(0)
})

it('uses an explicitly corrected location of the same unique event',()=>{
 const source='周二10:00在东楼101举行摄影讲座，现更正地点为西楼202，时间不变。'
 const result=recognize(source)
 expect(result.events).toHaveLength(1)
 expect(result.events[0].location).toBe('西楼202')
 expect(result.timePoints.find(point=>point.tempId===result.events[0].startTimePointTempId)?.normalizedValue).toBe('2026-11-17T10:00')
 expect(result.events[0].evidenceIds.some(id=>result.evidence.find(ref=>ref.id===id)?.quote.includes('更正地点'))).toBe(true)
})

it('retains both explicit choice branches with their own weekday deadlines and shared requirements',()=>{
 const source='【课程资料提交】本次资料可以选择电子版或纸质版，任选一种即可。电子版须在周二18:00前上传PDF至课程平台；纸质版须在周四12:00前交到教学楼办公室。无论选择哪种方式，均需在首页签名，并附一页承诺书。'
 const result=recognize(source)
 expect(result.conflicts.some(item=>item.id.startsWith('sem-choice-')&&item.entityTempIds.length===2)).toBe(true)
 expect(result.standaloneTasks).toHaveLength(2)
 expect(result.standaloneTasks.every(task=>task.actionObject==='资料')).toBe(true)
 expect(result.timePoints.filter(point=>point.type==='task_deadline').map(point=>point.normalizedValue)).toEqual(['2026-11-17T18:00','2026-11-19T12:00'])
 expect(result.standaloneTasks.every(task=>task.description.includes('首页签名')&&task.description.includes('承诺书'))).toBe(true)
 expect(result.materials.find(material=>material.submissionChannel==='课程平台')?.formatRequirements).toContain('PDF')
 const shared=result.materials.find(material=>material.name==='承诺书')
 expect(shared?.quantity).toBe(1)
 expect(shared?.requirements?.join(' ')).toContain('一页')
 expect(shared?.relatedTaskTempIds).toHaveLength(2)
})

it('keeps both independently cited applicant deliveries and treats an organizer review as context',()=>{
 const source='申请者请在周日18:00前填写报名表，并在周二20:00前把一页个人说明发送到 team@example.org。学院将在周三完成资料审核，审核结果由工作人员通知。'
 const result=recognize(source),direct=convertDirectResult(result,source,undefined,{scopeAware:true})
 const tasks=[...result.standaloneTasks,...result.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])]
 expect(direct.items.filter(item=>item.kind==='task')).toHaveLength(2)
 expect(tasks.some(task=>task.actionObject==='一页个人说明'&&task.actionVerb==='发送')).toBe(true)
 expect(result.timePoints.some(point=>point.type==='task_deadline'&&point.normalizedValue==='2026-11-17T20:00'&&point.relatedTaskTempIds.some(id=>tasks.some(task=>task.tempId===id&&task.actionObject==='一页个人说明')))).toBe(true)
 expect(result.materials.some(material=>material.name==='个人说明'&&material.quantity===1&&material.requirements?.includes('一页'))).toBe(true)
 expect(tasks.some(task=>task.title.includes('审核'))).toBe(false)
 expect(tasks.some(task=>task.description.includes('后续办理')&&task.description.includes('审核'))).toBe(true)
})

it('preserves the explicit time and place of a conditional invitation without confirming attendance',()=>{
 const source='入选者须于下周四14:00到北楼201参加说明会。'
 const result=recognize(source),event=result.events[0]
 expect(event).toBeTruthy()
 expect(event.location).toBe('北楼201')
 expect(result.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue).toBe('2026-11-19T14:00')
 expect(event.selected).toBe(false)
})

it('keeps distinct requested groups, counts and responsibilities as source information',()=>{
 const source='【阅读节志愿者招募】联络组需若干人，负责联系来宾；技术组放映2人、声光2人，负责投影和音响；现场组签到4人、引导3人，负责登记和指引。请在周六18:00前填写志愿者报名表。'
 const result=recognize(source),text=result.standaloneTasks.map(task=>task.description).join('\n')
 expect(text).toContain('联络组')
 expect(text).toContain('技术组')
 expect(text).toContain('放映2人')
 expect(text).toContain('现场组')
 expect(text).toContain('引导3人')
})

it('does not assign another actor’s review deadline to the personal submission',()=>{
 for(const source of ['周二17:00前学院审核申请表，学生请提交材料。','学院周二17:00前审核后请学生提交材料。']){
  const result=recognize(source),task=[...result.standaloneTasks,...result.milestones.flatMap(stage=>stage.tasks)].find(value=>value.actionObject.includes('材料'))
  if(task)expect(result.timePoints.filter(point=>point.relatedTaskTempIds.includes(task.tempId)&&point.type.endsWith('_deadline')).every(point=>!point.normalizedValue)).toBe(true)
 }
})

it('groups explicitly jointly required steps under their specific source goal without adding a dependency',()=>{
 const source='【社区服务体验项目】申请者请周日18:00前填写报名表，并在周二20:00前把一页个人说明发送到 team@example.org；两项均需完成，原文没有规定先后。'
 const result=recognize(source),tasks=[...result.standaloneTasks,...result.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])]
 expect(tasks).toHaveLength(2)
 expect(result.goalGroups?.some(group=>group.taskTempIds.length===2)).toBe(true)
 expect(tasks.every(task=>task.dependencyTempIds.length===0)).toBe(true)
})

it('keeps recruitment as one conditional event with ordered registration and group actions',()=>{
 const source='【城市阅读节志愿者招募】活动时间为周日，地点社区文化中心。请周六18:00前填写报名表，提交后加入通知群。报名不代表已被录取。'
 const result=recognize(source),tasks=[...result.standaloneTasks,...result.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])]
 const registration=tasks.find(task=>task.actionVerb==='填写'),join=tasks.find(task=>task.actionVerb==='加入'),event=result.events[0]
 expect(registration).toBeTruthy();expect(join).toBeTruthy()
 expect(join?.dependencyTempIds).toContain(registration?.tempId)
 expect(event?.selected).toBe(false);expect(event?.description).toContain('报名不代表已被录取')
 expect(event?.relatedTaskTempIds).toEqual(expect.arrayContaining([registration?.tempId,join?.tempId]))
 expect(result.timePoints.find(point=>point.tempId===event?.startTimePointTempId)?.normalizedValue).toBe('2026-11-15')
 expect(event?.location).toBe('社区文化中心')
})

it('preserves the separate times of compact weekday event clauses',()=>{
 const result=recognize('本周日上午9:00在南楼举行展览导览，15:00在北楼举行创作讲座，欢迎参加。')
 expect(result.events.map(event=>[event.title,result.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue,event.location])).toEqual([
  ['展览导览','2026-11-15T09:00','南楼'],['创作讲座','2026-11-15T15:00','北楼'],
 ])
})

it('does not borrow the first weekday for a separately dated event',()=>{
 const result=recognize('周一19:00在A101开团队说明会，周二19:00在B202开材料说明会。')
 expect(result.events.map(event=>[event.title,result.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue,event.location])).toEqual([
  ['团队说明会','2026-11-16T19:00','A101'],['材料说明会','2026-11-17T19:00','B202'],
 ])
})

it('recognizes a weekday agenda from independently named numbered rows and table rows',()=>{
 const sources=[
  '【下周三活动】\n① 09:00—10:00写作分享，文汇楼201。\n② 14:00—15:30配音体验，文汇楼302。',
  '周三公开活动：\n名称 | 时间 | 地点\n写作分享 | 09:00—10:00 | 文汇楼201\n配音体验 | 14:00—15:30 | 文汇楼302',
 ]
 for(const source of sources){
  const result=recognize(source)
  expect(result.events.map(event=>[event.title,result.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue,event.location])).toEqual([
   ['写作分享','2026-11-18T09:00','文汇楼201'],['配音体验','2026-11-18T14:00','文汇楼302'],
  ])
 }
})

it('does not infer a shared weekday across a separate substantive instruction',()=>{
 const result=recognize('周一9:00在南楼举行导览，周二前提交报名表，15:00在北楼举行讲座。')
 const later=result.events.find(event=>event.title.includes('讲座'))
 const day=result.timePoints.find(point=>point.tempId===later?.startTimePointTempId)?.normalizedValue
 expect(day?.startsWith('2026-11-16')).not.toBe(true)
})

it('uses a weekday before a directly addressed action without assigning a third party action',()=>{
 const own=recognize('周二请提交课程选题表。')
 expect(own.timePoints.some(point=>point.relatedTaskTempIds.length>0&&point.normalizedValue==='2026-11-17')).toBe(true)
 const other=recognize('周二请学院审核申请表，学生随后提交材料。')
 const submission=other.standaloneTasks.find(task=>task.actionObject.includes('材料'))
 if(submission)expect(other.timePoints.filter(point=>point.relatedTaskTempIds.includes(submission.tempId)).every(point=>point.normalizedValue!=='2026-11-17')).toBe(true)
})

it('retains a direct handoff and the selected-person alternative dates',()=>{
 const source='请周日晚上交课程展示提纲给老师。主办方根据材料筛选部分同学，于下周三或下周四参加面谈。'
 const result=recognize(source),task=result.standaloneTasks.find(value=>value.actionVerb==='交')
 expect(task?.actionObject).toBe('课程展示提纲')
 expect(task?.description).toContain('2026-11-18')
 expect(task?.description).toContain('2026-11-19')
 expect(result.timePoints.some(point=>point.relatedTaskTempIds.includes(task!.tempId)&&point.normalizedValue==='2026-11-15')).toBe(true)
 expect(result.events).toHaveLength(0)
})

it('reparses an event date from its own citation without borrowing the signup deadline',()=>{
 const source='希望参加的同学请周日17:00前填写文化活动报名表。周二14:00在艺术楼203举行文化交流。'
 const result=recognize(source),event=result.events.find(value=>value.title==='文化交流')
 expect(event).toBeTruthy()
 expect(result.timePoints.find(point=>point.tempId===event?.startTimePointTempId)?.normalizedValue).toBe('2026-11-17T14:00')
 expect(event?.location).toBe('艺术楼203')
})

it('keeps a separately addressed action independent and preserves its own deadline',()=>{
 const source='周三请提交课程大纲。另外，周四前归还实验室钥匙。两件事彼此无关。'
 const result=recognize(source),direct=convertDirectResult(result,source,undefined,{scopeAware:true}).result
 expect(direct.standaloneTasks.map(task=>task.title)).toEqual(['提交课程大纲','归还实验室钥匙'])
 const other=direct.standaloneTasks[1]
 expect(direct.timePoints.find(point=>point.relatedTaskTempIds.includes(other.tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-19')
 expect(direct.goalGroups?.length??0).toBe(0)
 const negative=recognize('周三请提交课程大纲。另外，周四前无需归还实验室钥匙。')
 expect(negative.standaloneTasks.some(task=>task.actionObject.includes('钥匙'))).toBe(false)
 const dates=recognize('周一请提交值班申请表。此外，周五前归还借用证件。两件事项互不相关。')
 const first=dates.standaloneTasks.find(task=>task.actionObject.includes('值班申请表'))
 expect(dates.timePoints.filter(point=>point.relatedTaskTempIds.includes(first!.tempId)&&point.type.endsWith('_deadline')).every(point=>!point.normalizedValue)).toBe(true)
})

it('marks a selected-person event as conditional and retains its own weekday',()=>{
 const source='周日18:00前上传作品。组委会周二审核作品，入选者周四14:00参加展示答辩，地点创意楼302。'
 const direct=convertDirectResult(recognize(source),source,undefined,{scopeAware:true})
 const event=direct.result.events.find(value=>value.title.includes('展示答辩'))
 expect(event).toBeTruthy()
 expect(direct.result.timePoints.find(point=>point.tempId===event?.startTimePointTempId)?.normalizedValue).toBe('2026-11-19T14:00')
 expect(direct.items.find(item=>item.tempId===event?.tempId)?.tags).toContain('如符合条件')
 expect(direct.result.timePoints.some(point=>point.type==='task_deadline'&&point.normalizedValue==='2026-11-15T18:00')).toBe(true)
})

it('retains both ends of an event range only from that event’s own cited clause',()=>{
 const source='下周三19:00—20:30在南楼101开展读书分享会。'
 const direct=convertDirectResult(recognize(source),source,undefined,{scopeAware:true}).result,event=direct.events[0]
 expect(direct.timePoints.find(point=>point.tempId===event.startTimePointTempId)?.normalizedValue).toBe('2026-11-18T19:00')
 expect(direct.timePoints.find(point=>point.tempId===event.endTimePointTempId)?.normalizedValue).toBe('2026-11-18T20:30')
})
