import {beforeAll,describe,expect,it} from 'vitest'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
// @ts-expect-error Existing anonymous, offline record builder stays outside frontend bundle.
import {d23Materials} from '../../../scripts/serve-d23-study.mjs'
import {D23Study,d23DomainTransport,d23Measurement,type StudyPlan} from './d23Study'
import {createD13Runtime} from './runtime'
import {createD13Measurement,committedFieldDiff,D24_CORRECTION_VERSION} from './measurement'
import {indexImmutableScopesV11} from '../../recognition/scopeIndexV11'
import {sha256Text} from '../realInput01/inputReceipt'
import {rebindD13ScopeIds} from './replay'
import {reportD24} from './d24Report'
import type {D13ReplayRecord} from './replay'
import {effectiveStateFacts,effectiveReview,informationReviewProblem,pendingDateEligible,hasPendingDateConsent,life,stateOfRuntime,semanticRevision} from '../mainline05/semanticState'
import {acceptSemanticPendingDate,correctSemanticFact,reviewSemanticMaterialAndTask,reviewSemanticFact} from '../mainline05/semanticConfirmation'
import {sourceCoverageGaps} from '../realInput01/sourceCoverage'
import {semanticReview} from '../mainline05/semanticView'
import type {FactChange} from '../realInput01/factCorrections'
import {reviewTimeEvidence} from '../realInput01/reviewTimeEvidence'
let plan:StudyPlan,records:D13ReplayRecord[]
beforeAll(async()=>{({plan,records}=await d23Materials())},30000)
async function opened(slotId:string){
  const identity=slotId.slice(0,2),store=Object.assign(new MemoryWorkspaceRecordStore(),{name:`rco-mainline-01-02-i1-real-input-d23-study-engineering-d24test-${identity}`})
  let time=1000
  const study=new D23Study(store,plan,'ENGINEERING_REPLAY',null,()=>time)
  await study.acceptOwner('ENGINEERING_SIMULATION_D24_OWNER');await study.freeze(Object.fromEntries(plan.materials.map(m=>[m.id,'ENGINEERING_SIMULATION:流程验证，非独立真值'])));await study.consent(identity,'ENGINEERING_SIMULATION_D24_CONSENT')
  for(const slot of plan.slots.filter(s=>s.participantId===identity&&s.ordinal<Number(slotId.slice(-1)))){await study.start(slot.slotId,plan.materials.find(m=>m.id===slot.materialId)!.sourceText);await study.transition('exit')}
  const slot=plan.slots.find(s=>s.slotId===slotId)!,material=plan.materials.find(m=>m.id===slot.materialId)!,record=records.find(r=>r.id===(slot.condition==='assisted'?material.assistedId:material.manualId))!
  await study.start(slotId,material.sourceText)
  const app=await createD13Runtime({transport:d23DomainTransport(store,study),choices:[record],read:async()=>record,sourceSession:true,correctionVersion:D24_CORRECTION_VERSION,measurement:d23Measurement(createD13Measurement(store,()=>time),study),onOpen:async(r,id)=>{await study.attach(r.id,id)}})
  const draftId=await app.open(record.id)
  return {app,study,draftId,record,tick:(n:number)=>{time+=n}}
}
async function correct(r:Awaited<ReturnType<typeof opened>>,change:FactChange){const w=await r.app.repository.load();return correctSemanticFact(r.app.repository,{draftId:r.draftId,revision:semanticRevision(w),operationId:crypto.randomUUID(),change})}
describe('D24 actual source disposal and safe unknown-time consent',()=>{
  it('manual source time entry uses the shared parser for four classes and rejects malformed times',()=>{
    const base={tempId:'user-time',type:'task_deadline' as const,rawText:'',normalizedValue:null,timezone:'Asia/Shanghai',isAllDay:false,precision:'vague' as const,needsConfirmation:true,relatedTaskTempIds:['user-task'],relatedMaterialTempIds:[],scopeIds:['source-scope'],confidence:1}
    for(const [rawText,normalizedValue,precision,isAllDay] of [
      ['2026年10月19日16:30前','2026-10-19T16:30','exact',false],
      ['10月20日前','2026-10-20','date_only',true],
      ['月底前后',null,'vague',false],['尚未公布',null,'vague',false],
    ] as const){
      const next=reviewTimeEvidence({...base,rawText},'2026-10-01T00:00:00.000Z','Asia/Shanghai')
      expect(next).toMatchObject({rawText,normalizedValue,precision,isAllDay,relatedTaskTempIds:['user-task'],scopeIds:['source-scope']})
      if(normalizedValue===null)expect(next.needsConfirmation).toBe(true)
    }
    expect(()=>reviewTimeEvidence({...base,rawText:'2026年10月19日25:99'},'2026-10-01T00:00:00.000Z','Asia/Shanghai')).toThrow('TIME_EVIDENCE_REQUIRES_REVIEW')
  })
  it('blank manual entry can add the actual source deadline before material review without changing the empty first response',async()=>{
    const r=await opened('p2-1'),example=await opened('p1-1'),sample=stateOfRuntime(await example.app.repository.load(),example.draftId),manual=stateOfRuntime(await r.app.repository.load(),r.draftId)
    const task=structuredClone(effectiveStateFacts(sample).facts.tasks[0]),first=structuredClone(manual.first)
    const mapped=new Map(sample.context.index.scopes.map(scope=>[scope.id,manual.context.index.scopes.find(s=>s.text===scope.text)!.id]))
    task.id='user-d24-manual';task.detail.materialTempIds=[];task.detail.timePointTempIds=[]
    task.propositionScopeIds=task.propositionScopeIds.map(id=>mapped.get(id)!);task.action.scopeId=mapped.get(task.action.scopeId)!;task.object.scopeId=mapped.get(task.object.scopeId)!
    task.coverage.material='not_stated';task.coverage.time='not_stated'
    await correct(r,{kind:'add_task',value:task,scopeIds:task.propositionScopeIds,note:'工程手动从空白补录原文任务'})
    const scope=manual.context.index.scopes.find(s=>s.text.includes('2026年10月19日16:30'))!,time=reviewTimeEvidence({tempId:'user-manual-time',type:'task_deadline',rawText:'2026年10月19日16:30前',normalizedValue:null,timezone:'Asia/Shanghai',isAllDay:false,precision:'vague',needsConfirmation:true,relatedTaskTempIds:[task.id],relatedMaterialTempIds:[],scopeIds:[scope.id],confidence:1},manual.context.referenceTime,manual.context.timezone)
    await correct(r,{kind:'time',taskId:task.id,value:time,scopeIds:[scope.id],note:'用户逐字补录，程序仅做确定性转换'})
    let w=await r.app.repository.load();const after=stateOfRuntime(w,r.draftId)
    expect(after.first).toEqual(first);expect(effectiveReview(after).issues.some(i=>i.code==='TIME_NEEDS_REVIEW')).toBe(false)
    w=await reviewSemanticFact(r.app.repository,{draftId:r.draftId,taskId:task.id,revision:semanticRevision(w),operationId:crypto.randomUUID()})
    await r.app.runtime.confirm({draftId:r.draftId,revision:semanticRevision(w),taskTempIds:[task.id]})
    const saved=await r.app.independentReadback();expect(saved.tasks).toHaveLength(1);expect(saved.timePoints[0]).toMatchObject({normalizedValue:'2026-10-19T16:30',rawText:'2026年10月19日16:30前',precision:'exact'})
  })
  it('S09 exposes only the missing provenance fragment; explicit event plus classification archives 0 tasks and real event/time',async()=>{
    const r=await opened('p1-4'),w=await r.app.repository.load(),s=stateOfRuntime(w,r.draftId),original=JSON.stringify(s),facts=effectiveStateFacts(s).facts
    const gaps=sourceCoverageGaps(facts,s.context.index);expect(gaps.map(g=>g.text)).toEqual(['[D16新编匿名Development]'])
    const scope=s.context.index.scopes.find(s=>s.text.includes('周三晚'))!,eventId='user-d24-event',timeId='user-d24-time'
    await correct(r,{kind:'add_independent_event',scopeIds:[scope.id],note:'人工补录原文遗漏的停机事件',value:{event:{tempId:eventId,title:'校车预约平台',description:'停机',location:null,startTimePointTempId:timeId,endTimePointTempId:null,relatedTaskTempIds:[],scopeIds:[scope.id],confidence:0,inferenceLevel:'explicit'},time:{tempId:timeId,type:'event_start',rawText:'周三晚',normalizedValue:null,timezone:'Asia/Shanghai',isAllDay:false,precision:'vague',needsConfirmation:true,relatedTaskTempIds:[],relatedMaterialTempIds:[],scopeIds:[scope.id],confidence:0}}})
    expect(informationReviewProblem(stateOfRuntime(await r.app.repository.load(),r.draftId))).toContain('UNACCOUNTED')
    await correct(r,{kind:'information_scope',value:'provenance',scopeIds:[gaps[0].id],note:'人工核对样本出处标签，不是通知事实'})
    const next=await r.app.repository.load(),after=stateOfRuntime(next,r.draftId);expect(informationReviewProblem(after)).toBeUndefined()
    expect(after.first).toEqual(JSON.parse(original).first);expect(after.rawResponse).toEqual(JSON.parse(original).rawResponse)
    await r.app.runtime.semantic!.dispose({draftId:r.draftId,revision:semanticRevision(next),taskTempIds:[],kind:'review_info',operationId:crypto.randomUUID()})
    const saved=await r.app.independentReadback();expect(saved.tasks).toHaveLength(0);expect(saved.projects).toHaveLength(0);expect(saved.events).toHaveLength(1);expect(saved.timePoints).toHaveLength(1)
    expect(saved.timePoints[0]).toMatchObject({normalizedValue:null,rawText:'周三晚',precision:'vague',needsConfirmation:true});expect(saved.evidenceRefs.length).toBeGreaterThan(0)
  })
  it('classification cannot bypass a current task, fabricate provenance, cross sources, or resolve all scopes in bulk',async()=>{
    const r=await opened('p4-1'),w=await r.app.repository.load(),s=stateOfRuntime(w,r.draftId),facts=effectiveStateFacts(s).facts
    await expect(correct(r,{kind:'information_scope',value:'information',scopeIds:[facts.tasks[0].propositionScopeIds[0]],note:'不能把现有行动改称信息'})).rejects.toThrow('INFORMATION_SCOPE')
    await expect(correct(r,{kind:'information_scope',value:'provenance',scopeIds:[s.context.index.scopes.at(-1)!.id],note:'业务文本不是出处'})).rejects.toThrow('PROVENANCE_SCOPE')
    await expect(correct(r,{kind:'information_scope',value:'information',scopeIds:['other-source'],note:'不能跨来源'})).rejects.toThrow('REVIEW_EVIDENCE_REQUIRED')
    await expect(correct(r,{kind:'information_scope',value:'information',scopeIds:s.context.index.scopes.map(s=>s.id),note:'禁止一键全部覆盖'})).rejects.toThrow('INFORMATION_SCOPE')
  })
  it('new information measurement is opt-in; its real edit is linked to the saved correction and independent readback',async()=>{
    const r=await opened('p3-2'),before=await r.app.repository.load(),s=stateOfRuntime(before,r.draftId),gap=sourceCoverageGaps(effectiveStateFacts(s).facts,s.context.index).find(row=>row.text.includes('稍后公布'))!
    const editId=await r.app.metrics.changed(r.draftId,'relation:source:information')
    await correct(r,{kind:'information_scope',value:'information',scopeIds:[gap.id],note:'原文宣布日期未公布，人工保留未知说明'})
    const after=await r.app.independentReadback(),old=committedFieldDiff(before,after,r.draftId),current=committedFieldDiff(before,after,r.draftId,D24_CORRECTION_VERSION)
    expect(old.fields.some(p=>p.startsWith('unresolvedScopeIds'))).toBe(false);expect(current.fields).toContain('unresolvedScopeIds')
    const traces=await r.app.metrics.events(r.draftId),commit=traces.find(t=>t.kind==='commit'&&t.includedEditIds?.includes(editId))!
    expect(commit).toMatchObject({semanticMappingVersion:D24_CORRECTION_VERSION,semanticFields:['source:information']})
    expect(traces.some(t=>t.kind==='readback'&&t.commitId===commit.commitId)).toBe(true)
  })
  it('unpublished-only wording can remain unknown, while malformed clocks and foreign-object evidence cannot gain uncertainty consent',async()=>{
    const original=records.find(r=>r.kind==='RECORDED_MODEL'&&r.label.includes('S07'))!
    for(const [rawText,eligible] of [['尚未公布',true],['月底前后25:99',false]] as const){
      const text=original.context.index.sourceContent.replaceAll('月底前后',rawText),index=await indexImmutableScopesV11('D24-anonymous-time','D24-anonymous-time-v1',text),envelope=JSON.parse(original.rawHttpText)
      const wire=JSON.parse(envelope.output.at(-1).content[0].text);wire.timePoints[0].rawText=rawText;wire.tasks[0].detail.description=wire.tasks[0].detail.description.replaceAll('月底前后',rawText)
      envelope.output.at(-1).content[0].text=JSON.stringify(rebindD13ScopeIds(wire,new Map(original.context.index.scopes.map((scope,i)=>[scope.id,index.scopes[i].id]))))
      const raw=JSON.stringify(envelope),record:D13ReplayRecord={...original,id:'d13-fixture-d24-time',kind:'ENGINEERING_FIXTURE',context:{...original.context,index},rawHttpText:raw,responseSha256:await sha256Text(raw),requestSha256:await sha256Text('D24_ANONYMOUS_NO_MODEL')}
      const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:'rco-mainline-01-02-i1-real-input-d23-study-engineering-d24fixture-p1'}),app=await createD13Runtime({transport,choices:[record],read:async()=>record,sourceSession:true,correctionVersion:D24_CORRECTION_VERSION}),draftId=await app.open(record.id)
      let w=await app.repository.load(),state=stateOfRuntime(w,draftId);const gap=sourceCoverageGaps(effectiveStateFacts(state).facts,state.context.index).find(row=>row.text.includes('稍后公布'))!
      await correctSemanticFact(app.repository,{draftId,revision:semanticRevision(w),operationId:crypto.randomUUID(),change:{kind:'information_scope',value:'information',scopeIds:[gap.id],note:'原文明确未知日期，工程匿名反例'}})
      w=await app.repository.load();state=stateOfRuntime(w,draftId);const task=effectiveStateFacts(state).facts.tasks[0]
      expect(pendingDateEligible(state,task.id)).toBe(eligible)
      if(eligible){await acceptSemanticPendingDate(app.repository,{draftId,taskId:task.id,revision:semanticRevision(w),operationId:crypto.randomUUID()});expect(effectiveStateFacts(stateOfRuntime(await app.repository.load(),draftId)).facts.timePoints[0].normalizedValue).toBeNull()}
      else await expect(acceptSemanticPendingDate(app.repository,{draftId,taskId:task.id,revision:semanticRevision(w),operationId:crypto.randomUUID()})).rejects.toThrow('PENDING_DATE_NOT_ELIGIBLE')
    }
    const r=await opened('p4-1'),w=await r.app.repository.load(),state=stateOfRuntime(w,r.draftId),facts=effectiveStateFacts(state).facts,point=facts.timePoints[0]
    await expect(correct(r,{kind:'time',taskId:facts.tasks[0].id,value:{...point,normalizedValue:null,precision:'vague',needsConfirmation:true},scopeIds:[facts.tasks[1].propositionScopeIds[0]],note:'另一动作对象的时间不得移植'})).rejects.toThrow()
    expect(pendingDateEligible(stateOfRuntime(await r.app.repository.load(),r.draftId),facts.tasks[0].id)).toBe(false)
  })
  it('S02 date-only facts already match the parser; atomic material/task review needs no invented clock',async()=>{
    const r=await opened('p4-1');let w=await r.app.repository.load();const s=stateOfRuntime(w,r.draftId),facts=effectiveStateFacts(s).facts
    expect(facts.timePoints.map(t=>t.normalizedValue)).toEqual(['2026-10-20','2026-10-22']);expect(effectiveReview(s).issues.filter(i=>i.code==='TIME_NEEDS_REVIEW')).toHaveLength(0)
    const task=facts.tasks[1],material=facts.materials[0]
    w=await reviewSemanticMaterialAndTask(r.app.repository,{draftId:r.draftId,taskId:task.id,materialId:material.tempId,revision:semanticRevision(w),operationId:crypto.randomUUID(),value:{required:true,status:'unverified'}})
    expect(life(stateOfRuntime(w,r.draftId)).reviewed?.[task.id]).toBeTruthy();expect(w.tasks).toHaveLength(0)
    w=await reviewSemanticFact(r.app.repository,{draftId:r.draftId,taskId:facts.tasks[0].id,revision:semanticRevision(w),operationId:crypto.randomUUID()})
    await r.app.runtime.confirm({draftId:r.draftId,revision:semanticRevision(w),taskTempIds:facts.tasks.map(t=>t.id)})
    const saved=await r.app.independentReadback();expect(saved.timePoints.map(t=>t.normalizedValue).sort()).toEqual(['2026-10-20','2026-10-22'])
  })
  it('S07 explicit unresolved unknown notice can be judged, consented and saved; raw remains unknown',async()=>{
    const r=await opened('p3-2');let w=await r.app.repository.load(),s=stateOfRuntime(w,r.draftId);const facts=effectiveStateFacts(s).facts
    const summary=Object.values(semanticReview(w,r.draftId).states)[0].dateLabel;expect(summary).toContain('截止时间待定');expect(summary).toContain('月底前后');expect(summary).not.toContain('仅说明开始')
    const gap=sourceCoverageGaps(facts,s.context.index).find(s=>s.text.includes('稍后公布'))!
    await correct(r,{kind:'information_scope',value:'information',scopeIds:[gap.id],note:'原文说明确切日期尚未公布，不是额外任务'})
    w=await r.app.repository.load();s=stateOfRuntime(w,r.draftId);const task=facts.tasks[0];expect(pendingDateEligible(s,task.id)).toBe(true)
    w=await acceptSemanticPendingDate(r.app.repository,{draftId:r.draftId,taskId:task.id,revision:semanticRevision(w),operationId:crypto.randomUUID()})
    expect(hasPendingDateConsent(stateOfRuntime(w,r.draftId),task.id)).toBe(true)
    w=await reviewSemanticMaterialAndTask(r.app.repository,{draftId:r.draftId,taskId:task.id,materialId:facts.materials[0].tempId,revision:semanticRevision(w),operationId:crypto.randomUUID(),value:{required:true,status:'unverified'}})
    await r.app.runtime.confirm({draftId:r.draftId,revision:semanticRevision(w),taskTempIds:[task.id]})
    const saved=await r.app.independentReadback();expect(saved.tasks).toHaveLength(1);expect(saved.timePoints[0]).toMatchObject({normalizedValue:null,rawText:'月底前后',precision:'vague',needsConfirmation:true})
  })
  it('an injected atomic combined review failure persists neither half and permits manual retry',async()=>{
    const r=await opened('p1-1'),w=await r.app.repository.load(),facts=effectiveStateFacts(stateOfRuntime(w,r.draftId)).facts,intent={draftId:r.draftId,taskId:facts.tasks[0].id,materialId:facts.materials[0].tempId,revision:semanticRevision(w),operationId:crypto.randomUUID(),value:{required:true,status:'unverified' as const}}
    r.app.observed.failNext();await expect(reviewSemanticMaterialAndTask(r.app.repository,intent)).rejects.toThrow('INJECTED_ATOMIC_FAILURE')
    expect(stateOfRuntime(await r.app.repository.load(),r.draftId).operations).toEqual(stateOfRuntime(w,r.draftId).operations)
    await reviewSemanticMaterialAndTask(r.app.repository,intent);expect(life(stateOfRuntime(await r.app.repository.load(),r.draftId)).reviewed?.[intent.taskId]).toBeTruthy()
  })
})
describe('D24 planned denominators and measurement separation',()=>{
  it('unopened exits and untouched sources remain in 16 slots / 8 independent sources; manual first quality is not applicable',async()=>{
    const r=await opened('p1-4');await r.study.transition('exit');const legacy=await r.study.report(),report=reportD24(plan,[legacy])
    expect(report.planned).toBe(16);expect(report.started).toBe(4);expect(report.slots.filter(s=>!s.observation)).toHaveLength(12)
    expect(report.firstCoverage).toMatchObject({plannedIndependentSources:8,plannedExposures:8,startedExposures:2,openedExposures:1,unknown:8})
    expect(report.byCondition[0].lowEdit).toBe('NOT_APPLICABLE');expect(report.realHumanMetrics).toBe('NOT_OBSERVABLE');expect(report.legacyD23.rows).toEqual(legacy.rows)
    expect(report.byCondition[1].auxiliaryUnopened).toBe(7)
  })
  it('unclosed reading is missing, not zero success; duplicate slots, roles and drifting stimuli are rejected',async()=>{
    const r=await opened('p1-1');r.tick(10000);const report=await r.study.report(),newReport=reportD24(plan,[report]);expect(newReport.rows[0].timing.completeActiveEditMs).toBeNull();expect(newReport.rows[0].timing.observed.activeEditMs).toBe(0);expect(newReport.byCondition[1].time.missingN).toBe(1)
    expect(()=>reportD24(plan,[report,report])).toThrow('DUPLICATE_TRIAL')
    const drift=structuredClone(report);drift.rows[0].trial.stimulusSha256='x';expect(()=>reportD24(plan,[drift])).toThrow('SLOT_OR_STIMULUS_DRIFT')
    expect(()=>reportD24(plan,[report,{...report,role:'HUMAN_EXPLORATORY'}])).toThrow('ROLE_OR_PLAN_DRIFT')
  })
})
