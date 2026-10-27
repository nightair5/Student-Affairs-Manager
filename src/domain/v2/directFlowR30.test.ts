import {describe,it,expect} from 'vitest'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {commitDirectDraft,undoDirectBatch} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {pairFlowEvents,homeFlow} from '../../lib/homeFlow'
import {directReplacementPreserves} from './directReplacementSafety'
import {setTaskSchedule} from './taskSchedule'
import {taskCalendarDate} from '../../lib/calendar'
import {flowTaskDate} from '../../lib/flowPresentation'
const now='2026-10-27T10:00:00.000Z'
async function add(text:string){
 const w=createGoldenWorkspaceV8();for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
 const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(w)
 const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:'r30',sourceType:'text',title:'匿名工程夹具',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'local',pipelineVersion:'test',now})
 await capture.recognize(h,async()=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名工程夹具',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]}))
 const receipt=await commitDirectDraft(repo,h.draftId,now)
 return {repo,receipt,w:(await repo.load())!}
}
describe('direct multi-delivery and event lifecycle',()=>{
 it('stores a separate window, round-trips it and keeps it after personal scheduling',async()=>{
  const {repo,receipt,w}=await add('请于2026年10月29日17:00前在线提交实践报告。纸质报告请于2026年10月28日9:00至11:00在学院办公室递交。')
  const view=workspaceV8ToLegacyView(w),paper=view.tasks.find(t=>t.title==='递交纸质报告')!
  expect(paper).toBeTruthy();expect(paper.deadline).toBe('');expect(paper.sourceWindowLabel).toBe('2026年10月28日9:00至11:00');expect(taskCalendarDate(paper)).toContain('2026-10-28')
  const original=w.timePoints.filter(p=>p.relatedTaskIds.includes(paper.id))
  await setTaskSchedule(repo,paper.id,'2026-10-28','2026-10-27T10:01:00Z')
  const after=(await repo.load())!;expect(after.timePoints.filter(p=>p.type!=='planned_start'&&p.relatedTaskIds.includes(paper.id))).toEqual(original)
  expect(workspaceV8ToLegacyView(after).tasks.find(t=>t.id===paper.id)?.deadline).toBe('')
  expect(flowTaskDate(workspaceV8ToLegacyView(after).tasks.find(t=>t.id===paper.id)!)).toContain('办理时段：2026年10月28日9:00至11:00')
  await undoDirectBatch(repo,receipt.batch!.id);expect((await repo.load())!.tasks).toHaveLength(0);expect((await repo.load())!.timePoints).toHaveLength(0)
 })
 it('shows an explicit attendance relation once with the correct date and retains both entities',async()=>{
  const {w}=await add('请同学们于2026年10月28日14:00至16:00在图书馆302会议室参加新闻实践讲座。')
  const view=workspaceV8ToLegacyView(w),paired=pairFlowEvents(view.tasks,view.events,w),flow=homeFlow(view.tasks,paired.unpaired,new Date(now),paired.linked)
  expect(view.tasks).toHaveLength(1);expect(view.events).toHaveLength(1);expect(Object.values(paired.linked)).toEqual(view.events);expect(paired.unpaired).toHaveLength(0)
  expect(flow.next).toEqual(view.tasks);expect(flow.undated).toHaveLength(0)
  expect(view.tasks[0].deadline).toBe('');expect(view.events[0].startAt).toContain('2026-10-28')
  const other=structuredClone(w);other.events[0].legacyData!.sourceId='different-source';expect(Object.keys(pairFlowEvents(view.tasks,view.events,other).linked)).toHaveLength(0)
 })
 it('rejects missing or moved owner facts and channels before a retry can replace anything',async()=>{
  const {w}=await add('请于2026年10月28日17:00前将课程论文提交至学习通，PDF格式。请于2026年10月30日18:00前填写实践报名表。')
  const ids=new Set(w.tasks.map(t=>t.id));expect(directReplacementPreserves(w,structuredClone(w),ids,ids)).toBe(true)
  const missing=structuredClone(w);missing.tasks.pop();expect(directReplacementPreserves(w,missing,ids,ids)).toBe(false)
  const wrongOwner=structuredClone(w);wrongOwner.timePoints=wrongOwner.timePoints.map(p=>({...p,relatedTaskIds:[w.tasks[0].id]}));expect(directReplacementPreserves(w,wrongOwner,ids,ids)).toBe(false)
  const wrongChannel=structuredClone(w);wrongChannel.materials=wrongChannel.materials.map(m=>({...m,submissionChannel:'另一个平台'}));expect(directReplacementPreserves(w,wrongChannel,ids,ids)).toBe(false)
 })
 it('allows a material requirement label without losing the deliverable or its requirements',async()=>{
  const {w}=await add('请于2026年10月28日17:00前将课程论文（PDF格式，以学号+姓名命名）提交至学习通。')
  const ids=new Set(w.tasks.map(t=>t.id)),next=structuredClone(w)
  expect(next.materials).toHaveLength(1)
  const requirements=[...next.materials[0].requirements,...next.materials[0].formatRequirements,...next.materials[0].namingRequirements].join('，')
  next.materials[0].name=requirements;next.materials[0].formatRequirements=[requirements];next.materials[0].namingRequirements=[];next.materials[0].requirements=[]
  expect(directReplacementPreserves(w,next,ids,ids)).toBe(true)
  const missingNaming=structuredClone(next);missingNaming.materials[0].name='PDF格式';missingNaming.materials[0].formatRequirements=['PDF格式']
  expect(directReplacementPreserves(w,missingNaming,ids,ids)).toBe(false)
  const prohibited=structuredClone(next);prohibited.materials[0].name='禁止'+requirements;prohibited.materials[0].formatRequirements=['禁止'+requirements]
  expect(directReplacementPreserves(w,prohibited,ids,ids)).toBe(false)
  const wrongObject=structuredClone(next);wrongObject.tasks[0].legacyData!.actionObject='其他材料';wrongObject.tasks[0].title='提交其他材料'
  expect(directReplacementPreserves(w,wrongObject,ids,ids)).toBe(false)
 })
})
