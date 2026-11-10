import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'
import {isRecognitionResult} from './schema'
import {completeDirectLocalFacts} from './directLocalFacts'
import {localBackgroundNotUserAction} from './localActionPolarity'

const referenceTime=new Date('2027-03-01T09:00:00+08:00')
const run=(source:string)=>{
 const raw=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime,timezone:'Asia/Shanghai',projects:[],tasks:[]})
 return convertDirectResult(improveDirectFallback(raw,source),source).result
}
const point=(r:ReturnType<typeof run>,id:string|null)=>r.timePoints.find(p=>p.tempId===id)?.normalizedValue??null

describe('local notice action and temporal scope',()=>{
 it('does not turn an explicitly unnecessary action into a task',()=>{
  for(const source of ['资料现场展示，不要求学生在活动前提交作品或缴费。','原小测取消，另行安排；无需重新报名。','不需要额外提交照片原文件。']){
   const r=run(source)
   expect(r.standaloneTasks.some(t=>t.actionVerb!=='查看'&&/提交作品|提交照片原文件|^报名$/u.test(t.title)),source+' '+r.standaloneTasks.map(t=>t.title).join('|')).toBe(false)
  }
 })
 it('keeps a positive action when a different action is prohibited',()=>{
  const r=run('请于6月20日15:00前提交申请表，禁止伪造签名。')
  const t=r.standaloneTasks.find(t=>t.actionVerb==='提交'&&t.actionObject.includes('申请表'))!
  expect(t).toBeTruthy();expect(r.timePoints.some(p=>p.relatedTaskTempIds.includes(t.tempId)&&p.normalizedValue==='2027-06-20T15:00')).toBe(true)
 })
 it('keeps an affirmative delivery after a contrast with an unnecessary different item',()=>{
  const r=run('无需提交照片原件，但请在8月20日17:00前上传照片电子版。')
  expect(r.standaloneTasks.some(t=>t.actionVerb==='上传'&&t.actionObject.includes('照片电子版'))).toBe(true)
  expect(r.timePoints.some(p=>p.type==='task_deadline'&&p.normalizedValue==='2027-08-20T17:00')).toBe(true)
  expect(r.standaloneTasks.some(t=>t.actionVerb==='提交'&&t.actionObject.includes('照片原件'))).toBe(false)
 })
 it('does not turn a lecture topic or a negative organiser statement into student tasks',()=>{
  const r=run('【青年影像讲座】\n2027年7月23日14:00—15:30在艺术楼报告厅举行影像讲座。讲座围绕影像叙事、采访准备和作品整理展开。建议提前十分钟入场。活动资料现场展示，不要求学生在活动前提交作品或缴费。')
  expect(r.events.some(e=>e.title.includes('影像讲座')&&point(r,e.startTimePointTempId)==='2027-07-23T14:00')).toBe(true)
  expect(r.standaloneTasks.some(t=>/准备和作品整理展开|提交作品|缴费/u.test(t.title))).toBe(false)
  expect(localBackgroundNotUserAction('活动将讲解采访准备，请提前准备个人简历。','准备','个人简历')).toBe(false)
 })
 it('keeps a deadline as an action deadline rather than a second event',()=>{
  const r=run('2027年5月11日14:00—15:30在文科楼501举行非遗讲座。参加者请在5月10日18:00前填写讲座报名表。')
  expect(r.events).toHaveLength(1);expect(r.events[0].title).toContain('讲座')
  expect(r.standaloneTasks.some(t=>t.actionVerb==='填写'&&t.actionObject.includes('报名表'))).toBe(true)
  expect(r.timePoints.some(p=>p.type==='task_deadline'&&p.normalizedValue==='2027-05-10T18:00')).toBe(true)
 })
 it('does not use an application deadline as an event start',()=>{
  const r=run('仅限二年级学生参加实验室开放日，请符合条件者于6月16日18:00前填写申请表。')
  expect(r.events.every(e=>point(r,e.startTimePointTempId)!=='2027-06-16T18:00')).toBe(true)
  expect(r.standaloneTasks.some(t=>t.actionVerb==='填写'&&r.timePoints.some(p=>p.relatedTaskTempIds.includes(t.tempId)&&p.normalizedValue==='2027-06-16T18:00'))).toBe(true)
 })
 it('keeps separately stated material formats with their own file',()=>{
  const r=run('6月8日23:00前上传课程报告PDF和实验记录Word，两个文件一起提交至课程平台。')
  expect(r.materials.map(m=>[m.name,m.formatRequirements])).toEqual(expect.arrayContaining([['课程报告',['PDF']],['实验记录',['Word']]]))
  expect(r.materials.every(m=>m.submissionChannel==='课程平台')).toBe(true)
 })
 it('does not assign a later file format to a different earlier form',()=>{
  const source='【设计展示】请于7月25日17:00前填写展示报名表，填写时提供作品名称。完成报名后，请于7月27日12:00前提交作品介绍PDF，文件不超过两页。两项属于同一次展示。'
  const r=run(source),first=r.standaloneTasks.find(t=>t.actionObject.includes('报名表'))!,second=r.standaloneTasks.find(t=>t.actionObject.includes('作品介绍'))!
  expect(first).toBeTruthy();expect(second).toBeTruthy()
  expect(r.goalGroups?.[0].taskTempIds).toHaveLength(2)
  expect(r.materials.filter(m=>m.relatedTaskTempIds.includes(first.tempId)).every(m=>!m.formatRequirements.includes('PDF'))).toBe(true)
  expect(r.materials.some(m=>m.name.includes('作品介绍')&&m.formatRequirements.includes('PDF')&&m.relatedTaskTempIds.includes(second.tempId))).toBe(true)
  expect(r.materials.find(m=>m.name.includes('作品介绍'))?.requirements).toContain('文件不超过两页')
 })
 it('preserves two different submission branches as one source-backed choice',()=>{
  const r=run('【阅读材料提交】\n请学生提交阅读心得，可任选纸质版或电子版之一，不需要两种都交。\n选择纸质版者，请于7月14日16:00前交到文科楼105服务台，打印内容不超过五页，首页注明姓名。\n选择电子版者，请于7月15日20:00前上传课程平台，格式为PDF，文件名为“学号+阅读心得”。')
  const choice=r.conflicts.find(c=>c.id.startsWith('sem-choice-local:'))!
  expect(choice?.entityTempIds).toHaveLength(2)
  expect(r.standaloneTasks).toHaveLength(2)
  expect(r.standaloneTasks.map(t=>r.timePoints.find(p=>p.relatedTaskTempIds.includes(t.tempId))?.normalizedValue).sort()).toEqual(['2027-07-14T16:00','2027-07-15T20:00'])
  expect(r.materials.map(m=>[m.submissionChannel,m.formatRequirements])).toEqual(expect.arrayContaining([['文科楼105服务台',['纸质版']],['课程平台',['电子版','PDF']]]))
 })
 it('does not collapse explicitly mandatory forms into an optional choice',()=>{
  const source='请学生提交阅读心得，可任选纸质版或电子版之一。选择纸质版者，请于7月14日16:00前交到文科楼105服务台。选择电子版者，请于7月15日20:00前上传课程平台。两种都须提交。'
  const r=run(source)
  expect(r.conflicts.some(c=>c.id.startsWith('sem-choice-local:'))).toBe(false)
 })
 it('retains an unrelated submission alongside a source-backed choice',()=>{
  const source='请学生提交阅读心得，可任选纸质版或电子版之一。\n选择纸质版者，请于7月14日16:00前交到文科楼105服务台。\n选择电子版者，请于7月15日20:00前上传课程平台，格式为PDF。\n请于7月13日12:00前提交实验报告。'
  const r=run(source)
  expect(r.conflicts.some(c=>c.id.startsWith('sem-choice-local:'))).toBe(true)
  expect(r.standaloneTasks.some(t=>t.actionObject.includes('实验报告'))).toBe(true)
 })
 it('keeps the replacement event after an explicitly rescheduled cancellation',()=>{
  const r=run('原7月3日9:00的小测取消，7月4日10:00在教学楼302重新进行；无需重新报名。')
  const event=r.events.find(e=>e.title==='小测')!
  expect(event).toBeTruthy();expect(point(r,event.startTimePointTempId)).toBe('2027-07-04T10:00');expect(event.location).toBe('教学楼302');expect(event.description).toContain('无需重新报名')
  expect(r.timePoints.some(p=>p.normalizedValue==='2027-07-03T09:00')).toBe(false)
  expect(r.standaloneTasks.some(t=>t.actionVerb==='报名')).toBe(false)
 })
 it('does not revive an event when cancellation is followed by a different event',()=>{
  const r=run('原7月3日9:00的讲座取消，7月4日10:00在教学楼302另有展览。')
  expect(r.events.filter(e=>e.title.includes('讲座')).every(e=>point(r,e.startTimePointTempId)!=='2027-07-04T10:00')).toBe(true)
 })
 it('does not make a past biographical event into a new schedule',()=>{
  const r=run('专家介绍：该老师曾于2021年5月4日14:00在图书馆101举办阅读讲座。')
  expect(r.events.some(e=>e.title.includes('阅读讲座'))).toBe(false)
 })
 it('retains a pickup window as a window and the separate upload deadline',()=>{
  const r=run('2027年6月11日9:00至6月13日17:00可领取证明，请于6月14日12:00前将证明扫描件上传系统。')
  expect(r.timePoints.some(p=>p.type.endsWith('_deadline')&&p.normalizedValue==='2027-06-11T09:00')).toBe(false)
  const pickup=r.standaloneTasks.find(t=>t.actionVerb==='领取')!
  expect(pickup).toBeTruthy()
  expect(r.timePoints.filter(p=>p.relatedTaskTempIds.includes(pickup.tempId)).map(p=>[p.type,p.normalizedValue])).toEqual(expect.arrayContaining([['event_start','2027-06-11T09:00'],['event_end','2027-06-13T17:00']]))
  expect(r.timePoints.some(p=>p.type.endsWith('_deadline')&&p.normalizedValue==='2027-06-14T12:00')).toBe(true)
 })
 it('does not require an item to be possessed before collecting that same item',()=>{
  const r=run('2027年8月12日9:00至8月14日17:00可领取证书，请于8月15日12:00前将证书扫描件上传系统。')
  const pickup=r.standaloneTasks.find(t=>t.actionVerb==='领取')!
  expect(pickup).toBeTruthy()
  expect(r.materials.some(m=>m.name==='证书'&&m.relatedTaskTempIds.includes(pickup.tempId))).toBe(false)
  expect(pickup.completionCriteria.some(c=>c.includes('所需材料已准备：证书'))).toBe(false)
 })
 it('does not invalidate the result when a long event quote contains a short explicit range',()=>{
  const first='2027年5月11日14:00—15:30在文科楼501举行非遗讲座。'
  const suffix='活动介绍展示方法并安排交流，请按现场秩序参与。'.repeat(8)
  const registration='参加者请在5月10日18:00前填写讲座报名表。'
  const source=first+suffix+registration
  const raw=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:first+registration,referenceTime,timezone:'Asia/Shanghai',projects:[],tasks:[]})
  const event=raw.events.find(e=>e.title.includes('非遗讲座'))!
  expect(event).toBeTruthy()
  const quote=first+suffix,ref=raw.evidence.find(e=>event.evidenceIds.includes(e.id))!
  ref.quote=quote;ref.quotedText=quote;ref.textStart=0;ref.textEnd=quote.length
  const r=completeDirectLocalFacts(raw,source)
  expect(isRecognitionResult(r)).toBe(true)
  expect(r.timePoints.every(p=>p.rawText.length<=160)).toBe(true)
  const retained=r.events.find(e=>e.title.includes('非遗讲座'))!
  expect(retained).toBeTruthy();expect(point(r,retained.startTimePointTempId)).toBe('2027-05-11T14:00');expect(point(r,retained.endTimePointTempId)).toBe('2027-05-11T15:30')
 })
})

describe('source-backed separate events and explicit shared goal',()=>{
 it('keeps two same-day events with different event verbs and venues',()=>{
  const r=run('2027年5月6日9:00—10:00在青楼101举行摄影基础讲座；当天14:00—15:30在青楼201开展摄影实操。')
  expect(r.events).toHaveLength(2)
  expect(r.events.map(e=>[point(r,e.startTimePointTempId),point(r,e.endTimePointTempId),e.location])).toEqual(expect.arrayContaining([['2027-05-06T09:00','2027-05-06T10:00','青楼101'],['2027-05-06T14:00','2027-05-06T15:30','青楼201']]))
 })
 it('keeps each session description with the event it actually describes',()=>{
  const r=run('2027年7月6日9:00—10:30在东门花园开展植物观察，讲解常见树木与叶片。\n同日14:00—15:30在南楼402开展声音工作坊，内容包括现场收音与记录。')
  expect(r.events).toHaveLength(2)
  const first=r.events.find(e=>e.title==='植物观察')!,second=r.events.find(e=>e.title==='声音工作坊')!
  expect(first.description).toContain('常见树木与叶片');expect(first.description).not.toContain('现场收音')
  expect(second.description).toContain('现场收音与记录');expect(second.description).not.toContain('常见树木')
 })
 it('keeps numbered same-day sessions separate and carries each time and venue',()=>{
  const r=run('2027年5月8日手工体验日：\n①9:00—10:00，木工工坊，工艺楼101。\n②11:00—12:00，编织工坊，工艺楼102。\n③15:00—16:00，陶艺体验，工艺楼103。')
  expect(r.events).toHaveLength(3)
  expect(r.events.map(e=>[point(r,e.startTimePointTempId),point(r,e.endTimePointTempId),e.location])).toEqual(expect.arrayContaining([
   ['2027-05-08T09:00','2027-05-08T10:00','工艺楼101'],['2027-05-08T11:00','2027-05-08T12:00','工艺楼102'],['2027-05-08T15:00','2027-05-08T16:00','工艺楼103']]))
  expect(r.standaloneTasks).toHaveLength(0)
 })
 it('does not give an unrelated undated session the earlier event date',()=>{
  const r=run('2027年5月6日9:00—10:00在青楼101举行摄影讲座。另一个活动日期未定。14:00—15:30在青楼201开展绘画讲座。')
  expect(r.events.filter(e=>e.title.includes('绘画')).every(e=>point(r,e.startTimePointTempId)!=='2027-05-06T14:00')).toBe(true)
 })
 it('groups three explicitly related tasks without losing their own deadlines',()=>{
  const r=run('2027年6月3日12:00前报名创新展示；6月4日18:00前提交作品摘要；6月5日18:00前上传海报。这三项属于同一次创新展示。')
  expect(r.goalGroups).toHaveLength(1);expect(r.goalGroups![0].taskTempIds).toHaveLength(3)
  expect(r.standaloneTasks.map(t=>r.timePoints.find(p=>p.relatedTaskTempIds.includes(t.tempId))?.normalizedValue).sort()).toEqual(['2027-06-03T12:00','2027-06-04T18:00','2027-06-05T18:00'])
 })
 it('groups adjacent actions only when the source explicitly names their common goal',()=>{
  const r=run('助学项目申请：5月21日17:00前填写申请表，5月22日12:00前提交家庭情况说明；以上两项均属于同一个申请。')
  expect(r.goalGroups?.[0].taskTempIds).toHaveLength(2)
  expect(r.goalGroups?.[0].title).toBe('助学项目申请')
  expect(r.standaloneTasks.map(t=>r.timePoints.find(p=>p.relatedTaskTempIds.includes(t.tempId))?.normalizedValue).sort()).toEqual(['2027-05-21T17:00','2027-05-22T12:00'])
 })
 it('does not group same-day unrelated tasks',()=>{
  const r=run('6月2日17:00前交社团服装；同一天20:00前提交统计课作业，两项彼此无关。')
  expect(r.goalGroups??[]).toHaveLength(0)
 })
})
