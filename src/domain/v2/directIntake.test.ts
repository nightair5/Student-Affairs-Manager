import {describe,it,expect} from 'vitest'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {convertDirectResult} from '../../recognition/directResult'
import {isRecognitionResult} from '../../recognition/schema'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,directDuplicate,undoDirectBatch,recentDirectBatches,deleteDirectItem,editDirectItem} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {getFocusTasks} from '../../lib/taskLogic'
import {validateWorkspaceV8} from './validators/workspaceValidator'
import {buildPersonalPlan,defaultPlanOptions} from './personalPlanD27'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
const now='2026-10-25T06:00:00.000Z'
const local=(content:string)=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
async function setup(text='请于10月30日17:00前提交课程论文。'){
  const w=createGoldenWorkspaceV8(),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
  await repo.save(w);const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:'test-direct',sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'unchanged',pipelineVersion:'direct-test',now})
  await capture.recognize(handle,async()=>local(text));return {repo,store,handle,text}
}
describe('owner-authorized direct mode',()=>{
  it('accepts a deadline followed by material requirements and keeps unknown times valid for canonical storage',async()=>{for(const text of ['请于10月30日17:00前将课程论文（PDF格式，以学号+姓名命名）提交至学习通。','办理时段为10月30日9:00—11:00，请领取教材。']){const {repo,handle}=await setup(text);await commitDirectDraft(repo,handle.draftId,now);expect(validateWorkspaceV8((await repo.load())!).valid).toBe(true)}})
  it('keeps the original answer unchanged and creates a grounded ordinary task',()=>{const text='请于10月30日17:00前提交课程论文。',r=local(text),before=structuredClone(r),c=convertDirectResult(r,text);expect(r).toEqual(before);expect(c.result.standaloneTasks[0].title).toContain('课程论文');expect(c.result.timePoints.some(p=>p.normalizedValue==='2026-10-30T17:00')).toBe(true);expect(isRecognitionResult(c.result)).toBe(true)})
  it.each(['校历已更新，仅供参考。','11月2日公布考试成绩，无需办理。','原定11月2日的讲座取消，请知悉。'])('creates an explicit read action without reviving cancelled obligations: %s',text=>{const c=convertDirectResult(local(text),text);expect(c.result.standaloneTasks).toHaveLength(1);expect(c.result.standaloneTasks[0].title).toMatch(/^查看：/u);expect(c.result.timePoints.filter(p=>p.relatedTaskTempIds.includes('direct-read-notice')).every(p=>p.type==='planned_start')).toBe(true);expect(c.result.events).toHaveLength(0);expect(isRecognitionResult(c.result)).toBe(true)})
  it('retains unknown eligibility as labelled work without declaring it mandatory',()=>{const text='符合条件的同学请于10月30日17:00前提交奖学金申请表。',c=convertDirectResult(local(text),text);expect(c.result.standaloneTasks[0].title).toMatch(/^如符合条件/u);expect(c.items[0].tags).toContain('待确认');expect(c.result.timePoints.some(p=>p.normalizedValue==='2026-10-30T17:00')).toBe(true)})
  it('retains a separately cited condition instead of losing it at a paragraph boundary',()=>{const text='已缴费并放弃修读的同学可申请退费。\n请于10月30日17:00前提交退费申请表。',r=local(text),task=[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(wp=>wp.tasks)])].find(t=>t.actionObject.includes('退费申请表'))!;expect(task).toBeTruthy();task.description+='\n适用条件待确认：已缴费并放弃修读';r.evidence.push({id:'condition',sourceId:'source',quote:'已缴费并放弃修读',field:'requirement'});task.evidenceIds.push('condition');const c=convertDirectResult(r,text),item=c.result.standaloneTasks.find(t=>t.tempId===task.tempId)!;expect(item.title).toMatch(/^如符合条件/u);expect(c.items.find(i=>i.tempId===item.tempId)!.tags).toContain('待确认')})
  it('never fills an absent date and keeps labelled work visible on home',async()=>{const {repo,handle}=await setup('请提交课程论文，时间另行通知。');await commitDirectDraft(repo,handle.draftId,now);const w=(await repo.load())!,view=workspaceV8ToLegacyView(w);expect(w.timePoints.every(p=>!p.normalizedValue)).toBe(true);expect(view.tasks[0].directTags).toContain('时间待定');expect(getFocusTasks(view.tasks)).toHaveLength(1)})
  it('drops a fabricated object while retaining a read action',()=>{const text='请提交课程论文。',r=local(text);r.standaloneTasks[0].actionObject='不存在的保密证书';r.standaloneTasks[0].title='提交不存在的保密证书';const c=convertDirectResult(r,text);expect(c.result.standaloneTasks.every(t=>!t.title.includes('保密证书'))).toBe(true);expect(c.omitted[0].reason).toContain('GROUNDED')})
  it('does not admit a made-up material merely because a different quote is valid',()=>{const text='请于10月30日提交课程论文（PDF）。',r=local(text);r.materials[0].name='银行流水';const c=convertDirectResult(r,text);expect(c.result.materials.some(m=>m.name==='银行流水')).toBe(false);expect(c.result.standaloneTasks).toHaveLength(1)})
  it('keeps an unresolved deadline as unknown while still adding its grounded task',()=>{const text='请于10月30日17:00前提交课程论文。',r=local(text);r.conflicts.push({id:'deadline-conflict',type:'deadline',message:'截止仍有冲突',entityTempIds:[r.standaloneTasks[0].tempId],evidenceIds:[],requiresDecision:true});const c=convertDirectResult(r,text);expect(c.result.standaloneTasks).toHaveLength(1);expect(c.result.timePoints.every(p=>p.normalizedValue===null)).toBe(true);expect(c.items[0].tags).toContain('待确认')})
  it('does not accept a real quote as proof of an invented deadline value',()=>{const text='请于10月30日17:00前提交课程论文。',r=local(text);r.timePoints.forEach(p=>{p.normalizedValue='2027-01-01T17:00'});const c=convertDirectResult(r,text);expect(c.result.timePoints.every(p=>p.normalizedValue===null)).toBe(true)})
  it('keeps a positively stated conditional application without reviving a global ban',()=>{for(const [text,allowed]of [['符合条件的同学可申请奖学金，不符合条件者不得申请奖学金。',true],['不得申请奖学金，请知悉。',false],['未经批准者不得申请奖学金。',false]] as const){const r=local('请于10月30日提交课程论文。');r.standaloneTasks[0]={...r.standaloneTasks[0],title:'申请奖学金',actionVerb:'申请',actionObject:'奖学金',evidenceIds:['restriction'],materialTempIds:[],timePointTempIds:[]};r.materials=[];r.timePoints=[];r.evidence=[{id:'restriction',sourceId:'source',quote:text,field:'description'}];const c=convertDirectResult(r,text);expect(c.result.standaloneTasks.some(t=>t.actionVerb==='申请')).toBe(allowed);if(allowed)expect(c.items[0].tags).toContain('如符合条件')}})
  it('bounds reading evidence and dates without truncating the preserved source',()=>{const text='11月2日公布考试成绩，无需办理。'+'通知说明仅供参考。'.repeat(80),r=local(text),c=convertDirectResult(r,text);expect(isRecognitionResult(c.result)).toBe(true);expect(c.result.evidence.every(e=>(e.quote??e.quotedText??'').length<=500)).toBe(true);expect(c.result.timePoints.every(p=>p.rawText.length<=160)).toBe(true)})
  it('uses a corrected date without reviving the original date',()=>{const text='课程论文提交时间原定10月30日17:00，现改为11月2日17:00前提交课程论文。',r=local(text);r.timePoints.forEach(p=>{p.rawText='11月2日17:00';p.normalizedValue='2026-11-02T17:00';p.needsConfirmation=false});const c=convertDirectResult(r,text);expect(c.result.standaloneTasks.some(t=>t.actionObject.includes('论文'))).toBe(true);expect(c.result.timePoints.filter(p=>p.normalizedValue).every(p=>p.normalizedValue==='2026-11-02T17:00')).toBe(true)})
  it('does not convert alternatives or a handling-window start to a deadline',()=>{for(const text of ['可在10月30日或11月2日办理报名。','办理时段为10月30日9:00—11:00，请领取教材。']){const r=local(text);r.timePoints.forEach(p=>{p.type='task_deadline';p.needsConfirmation=false});const c=convertDirectResult(r,text);expect(c.result.timePoints.filter(p=>/_deadline$/u.test(p.type)).every(p=>p.normalizedValue===null)).toBe(true)}})
  it('adds atomically, independently reloads, and is idempotent across repeated clicks',async()=>{const {repo,handle,text}=await setup();const before=(await repo.load())!,r=await commitDirectDraft(repo,handle.draftId,now),after=(await repo.load())!;expect(r.batch?.items).toHaveLength(1);expect(after.tasks).toHaveLength(1);expect(directDuplicate(after,text)).toBe(handle.sourceId);expect(validateWorkspaceV8(after).valid).toBe(true);await commitDirectDraft(repo,handle.draftId,now);expect((await repo.load())?.tasks).toEqual(after.tasks);expect(before.tasks).toHaveLength(0)})
  it('adds the same notice again as a new operation without changing the earlier completed task',async()=>{
    const {repo,handle,text}=await setup(),first=await commitDirectDraft(repo,handle.draftId,now)
    await repo.transaction(w=>({...w,tasks:w.tasks.map(t=>({...t,status:'completed' as const}))}))
    const before=(await repo.load())!,capture=new CapturePersistenceService(repo)
    const second=await capture.beginCapture({operationId:'repeat-notice',sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'unchanged',pipelineVersion:'direct-test',now})
    expect(second.sourceId).not.toBe(handle.sourceId)
    await capture.recognize(second,async()=>local(text))
    const added=await commitDirectDraft(repo,second.draftId,now),after=(await repo.load())!
    expect(added.duplicate).toBe(false);expect(added.batch?.id).not.toBe(first.batch?.id)
    expect(after.tasks).toHaveLength(2);expect(after.tasks.find(t=>t.id===before.tasks[0].id)).toEqual(before.tasks[0])
    expect(after.tasks.find(t=>t.id!==before.tasks[0].id)?.status).toBe('todo')
    expect(after.sources.find(s=>s.id===second.sourceId)?.legacyData).toMatchObject({duplicateReviewStatus:'保留为独立来源',duplicateOfSourceIds:[handle.sourceId]})
    expect(validateWorkspaceV8(after).valid).toBe(true)
    // Retrying the same operation does not create yet another copy.
    const retry=await capture.beginCapture({operationId:'repeat-notice',sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'unchanged',pipelineVersion:'direct-test',now})
    expect(retry.duplicate).toBe(true);expect((await commitDirectDraft(repo,retry.draftId,now)).duplicate).toBe(true)
    expect((await repo.load())!.tasks).toEqual(after.tasks)
    await undoDirectBatch(repo,added.batch!.id)
    expect((await repo.load())!.tasks).toEqual(before.tasks)
  })
  it('allows two active additions of the same notice and can undo either batch independently',async()=>{
    const {repo,handle,text}=await setup(),first=await commitDirectDraft(repo,handle.draftId,now)
    const capture=new CapturePersistenceService(repo),second=await capture.beginCapture({operationId:'repeat-active',sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'unchanged',pipelineVersion:'direct-test',now})
    await capture.recognize(second,async()=>local(text));const added=await commitDirectDraft(repo,second.draftId,now)
    const before=(await repo.load())!,other=before.tasks.find(t=>t.id.includes(second.draftId))!
    expect(before.tasks).toHaveLength(2);expect(added.duplicate).toBe(false)
    await undoDirectBatch(repo,first.batch!.id)
    expect((await repo.load())!.tasks).toEqual([other]);expect(validateWorkspaceV8((await repo.load())!).valid).toBe(true)
  })
  it('allows a fresh addition after undo without asking the user to review the old source',async()=>{
    const {repo,handle,text}=await setup(),first=await commitDirectDraft(repo,handle.draftId,now)
    await undoDirectBatch(repo,first.batch!.id)
    const capture=new CapturePersistenceService(repo),again=await capture.beginCapture({operationId:'repeat-after-undo',sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'unchanged',pipelineVersion:'direct-test',now})
    await capture.recognize(again,async()=>local(text));await commitDirectDraft(repo,again.draftId,now)
    const w=(await repo.load())!;expect(w.tasks).toHaveLength(1);expect(w.sources.find(s=>s.id===again.sourceId)?.legacyData?.duplicateReviewStatus).toBe('保留为独立来源')
    expect(w.sources.find(s=>s.id===handle.sourceId)?.status).toBe('archived');expect(validateWorkspaceV8(w).valid).toBe(true)
  })
  it('does not re-add an older version or suppress a new pending revision',async()=>{const {repo,handle,text}=await setup();await commitDirectDraft(repo,handle.draftId,now);const revised='请于11月9日17:00前提交课程论文修订稿。';await new CapturePersistenceService(repo).beginRevision(handle.sourceId,{operationId:'direct-revision',rawText:revised,provider:'local-rules',modelName:'local-rules',promptVersion:'unchanged',pipelineVersion:'direct-test',now});const w=(await repo.load())!;expect(directDuplicate(w,text)).toBe(handle.sourceId);expect(directDuplicate(w,revised)).toBeNull()})
  it('undo restores old facts, retains source/audit, and is idempotent',async()=>{const {repo,handle,text}=await setup(),before=(await repo.load())!,r=await commitDirectDraft(repo,handle.draftId,now);await undoDirectBatch(repo,r.batch!.id);const after=(await repo.load())!;for(const key of ['tasks','events','materials','timePoints','evidenceRefs','projects','historyRecords'] as const)expect(after[key]).toEqual(before[key]);expect(after.sources[0].status).toBe('archived');expect(directDuplicate(after,text)).toBeNull();await undoDirectBatch(repo,r.batch!.id);expect((await repo.load())?.tasks).toHaveLength(0)})
  it('re-adding an undone notice clears its withdrawn badge but preserves the undo audit',async()=>{const {repo,handle}=await setup(),r=await commitDirectDraft(repo,handle.draftId,now);await undoDirectBatch(repo,r.batch!.id);await commitDirectDraft(repo,handle.draftId,'2026-10-25T06:01:00.000Z');const w=(await repo.load())!;expect(w.tasks).toHaveLength(1);expect(w.sources[0].legacyData?.directUndoneAt).toBeNull();expect(w.sources[0].legacyData?.directUndoHistory).toBeInstanceOf(Array)})
  it('does not leave half a commit on transaction failure and can retry without another model call',async()=>{const {repo,handle}=await setup(),before=(await repo.load())!,tx=repo.transaction.bind(repo);repo.transaction=async()=>{throw Error('INJECTED_FAILURE')};await expect(commitDirectDraft(repo,handle.draftId,now)).rejects.toThrow();expect(await repo.load()).toEqual(before);repo.transaction=tx;await commitDirectDraft(repo,handle.draftId,now);expect((await repo.load())?.tasks).toHaveLength(1)})
  it('persists unknown conditions as visible work without claiming eligibility',async()=>{const {repo,handle}=await setup('符合条件的同学请于10月30日17:00前提交奖学金申请表。');await commitDirectDraft(repo,handle.draftId,now);const w=(await repo.load())!;expect(w.tasks[0].title).toMatch(/^如符合条件/u);expect(w.tasks[0].needsReview).toBe(true);expect(getFocusTasks(workspaceV8ToLegacyView(w).tasks)).toHaveLength(1)})
  it('keeps eligibility labels visible on a saved event even when its time is exact',async()=>{const {repo,handle}=await setup('仅限已报名的同学于11月4日14:00在A101参加条件答疑会。');await commitDirectDraft(repo,handle.draftId,now);const w=(await repo.load())!,view=workspaceV8ToLegacyView(w);expect(view.events).toHaveLength(1);expect(view.events[0].directTags).toContain('如符合条件');expect(view.events[0].needsConfirmation).toBe(true)})
  it('does not put labelled direct work into automatic personal arrangements and round-trips undo metadata',async()=>{const {repo,handle}=await setup('符合条件的同学请于10月30日17:00前提交奖学金申请表。'),r=await commitDirectDraft(repo,handle.draftId,now),w=(await repo.load())!;const p=buildPersonalPlan(w,defaultPlanOptions(new Date(now)));expect(p.segments).toHaveLength(0);const imported=importWorkspaceV8(exportWorkspaceV8(w));await repo.save(imported);await undoDirectBatch(repo,r.batch!.id);expect((await repo.load())!.tasks).toHaveLength(0)})
  it('can add an unconfirmed historical source with a missing result without resurrecting its old answer',async()=>{const {repo,handle}=await setup();await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>({...d,result:null,status:'failed'}))}));await commitDirectDraft(repo,handle.draftId,now);const w=(await repo.load())!;expect(w.tasks).toHaveLength(1);expect(w.extractionDrafts[0].legacyData?.directConversion).toMatchObject({inputProvider:'local-rules-from-preserved-source'})})
  it('edits and deletes only its own new entities, then undoes the whole batch',async()=>{const {repo,handle}=await setup(),r=await commitDirectDraft(repo,handle.draftId,now),id=r.batch!.items[0].id;await editDirectItem(repo,id,{title:'提交课程论文修订稿',date:'2026-11-03'});let w=(await repo.load())!;expect(w.tasks[0].title).toContain('修订稿');expect(w.timePoints[0].precision).toBe('date_only');await deleteDirectItem(repo,id);w=(await repo.load())!;expect(w.tasks).toHaveLength(0);await undoDirectBatch(repo,r.batch!.id);expect((await repo.load())?.historyRecords).toHaveLength(0)})
  it('deleting a new prerequisite only detaches another item from the same addition, with review and audit',async()=>{
    const text='请提交课程论文。请提交实验报告。',{repo,handle}=await setup(text)
    await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>{
      const r=structuredClone(d.result)!,first={...r.standaloneTasks[0],title:'提交课程论文',actionVerb:'提交',actionObject:'课程论文',materialTempIds:[],timePointTempIds:[]}
      // Explicit two-object fixture; this tests deletion, not local parser splitting.
      r.milestones=[];r.materials=[];r.timePoints=[]
      r.standaloneTasks=[first,{...first,tempId:'second',title:'提交实验报告',actionObject:'实验报告',dependencyTempIds:[first.tempId]}]
      return {...d,result:r}
    })}))
    const added=await commitDirectDraft(repo,handle.draftId,now);await deleteDirectItem(repo,added.batch!.items[0].id)
    const w=(await repo.load())!;expect(w.tasks).toHaveLength(1);expect(w.tasks[0].dependencyIds).toEqual([]);expect(w.tasks[0].needsReview).toBe(true);expect(w.extractionDrafts[0].legacyData?.directDeletedItems).toBeTruthy();expect(validateWorkspaceV8(w).valid).toBe(true)
  })
  it('editing a reading date keeps its planned-date role rather than inventing a deadline',async()=>{const {repo,handle}=await setup('11月2日公布考试成绩，无需办理。'),r=await commitDirectDraft(repo,handle.draftId,now);await editDirectItem(repo,r.batch!.items[0].id,{title:'查看考试成绩',date:'2026-11-03'});expect((await repo.load())!.timePoints.map(p=>p.type)).toEqual(['planned_start'])})
  it('editing one of two task dates does not change the other task sharing the original time',async()=>{
    const {repo,handle}=await setup('请于10月30日17:00前提交课程论文和实验报告。')
    await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>{const r=structuredClone(d.result)!,t={...r.standaloneTasks[0],title:'提交课程论文',actionVerb:'提交',actionObject:'课程论文',materialTempIds:[]};r.materials=[];r.milestones=[];r.standaloneTasks=[t,{...t,tempId:'second',title:'提交实验报告',actionObject:'实验报告'}];r.timePoints=r.timePoints.map(p=>({...p,relatedTaskTempIds:[t.tempId,'second']}));return {...d,result:r}})}))
    const added=await commitDirectDraft(repo,handle.draftId,now),first=added.batch!.items[0].id,second=added.batch!.items[1].id
    await editDirectItem(repo,first,{title:'提交课程论文',date:'2026-11-03'})
    const w=(await repo.load())!;expect(w.timePoints.find(p=>p.relatedTaskIds.includes(second))?.normalizedValue).toBe('2026-10-30T17:00');expect(w.timePoints.find(p=>p.relatedTaskIds.includes(first))?.normalizedValue).toBe('2026-11-03');expect(validateWorkspaceV8(w).valid).toBe(true)
  })
  it('keeps another addition intact when an earlier batch is undone',async()=>{const {repo,handle}=await setup(),r=await commitDirectDraft(repo,handle.draftId,now),capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:'second',sourceType:'text',title:'第二份',rawText:'请于11月5日提交报告。',provider:'local-rules',modelName:'local-rules',promptVersion:'old',pipelineVersion:'test',now});await capture.recognize(h,async()=>local('请于11月5日提交报告。'));await commitDirectDraft(repo,h.draftId,now);const other=(await repo.load())!.tasks.find(t=>t.id.includes(h.draftId))!;await undoDirectBatch(repo,r.batch!.id);expect((await repo.load())?.tasks).toEqual([other]);expect(recentDirectBatches((await repo.load())!)).toHaveLength(2)})
})
