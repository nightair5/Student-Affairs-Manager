import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from '../../App'
import { CalendarPage } from '../../pages/CalendarPage'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import { createSemanticRuntime } from './runtime'
import { semanticRevision } from './semanticState'
import { applyDomainCommitPlan, type DomainCommitPlan } from '../../domain/v2/domainCommit'
import { workspaceSnapshotHash } from '../../domain/v2/migration'
import { CapturePersistenceService } from '../../domain/v2/capture'
import { memoryRepository } from '../mainline01/chain'
import { emptyWorkspace, NOW } from '../mainline01/fixtures'
import { assessLegacyHandoff } from '../mainline04/legacyHandoff'
import { engineeringReply, notices } from './engineeringReplay'

describe('MAINLINE05 existing interface characterization (not missing-module failures)', () => {
  it('valid true-condition response is complete in new semantics but not equivalent to old V2', async () => {
    const reply = await engineeringReply('condition-true', { sourceId: 'engineering', sourceVersionId: 'v1' })
    const result = await assessLegacyHandoff(reply.rawResponse, reply.legacyResponse, reply.context)
    expect(result.review.items[0].defaultSelected).toBe(true)
    expect(result.rows[0].reasons).toContain('CONDITION_NOT_EXPRESSIBLE')
    expect(result.eligibleTaskTempIds).toEqual([])
  })
  it('old apply needs draft.result; a source-first semantic draft must use an explicit new entry', async () => {
    const repo = memoryRepository(); await repo.save(emptyWorkspace())
    const service = new CapturePersistenceService(repo)
    const handle = await service.beginCapture({ operationId: 'm05-characterization', sourceType: 'text', title: '人工工程',
      rawText: notices['no-date'], provider: 'manual', modelName: 'human_engineering', promptVersion: 'engineering-mainline-01',
      pipelineVersion: 'mainline05', now: NOW })
    const workspace = (await repo.load())!, draft = workspace.extractionDrafts[0]
    expect(draft.result).toBeNull(); expect(workspace.tasks).toEqual([])
    const plan: DomainCommitPlan = { ...handle, operationId: 'confirm-characterization', draftRevisionHash: workspaceSnapshotHash({
      recognitionRunId: draft.recognitionRunId, result: null, acceptedEntityTempIds: [], rejectedEntityTempIds: [] }),
      acceptedEntityTempIds: [], rejectedEntityTempIds: [], create: { tasks: [], projects: [], milestones: [], workPackages: [],
        materials: [], timePoints: [], events: [], evidenceRefs: [], historyRecords: [] } }
    expect(() => applyDomainCommitPlan(workspace, plan, NOW)).toThrow(TypeError)
    expect((await repo.load())!.tasks).toEqual([])
  })
  it('real App accepts only verified semantic runtime and never reads legacy storage during rendering',async()=>{
    const name='rco-mainline-01-02-i1-mainline05-ssr-'+crypto.randomUUID(),initial=emptyWorkspace();initial.workspace.id=name
    const store=Object.assign(new MemoryWorkspaceRecordStore(),{name})
    const runtime=await createSemanticRuntime({name,store,initial,recognize:(_,h)=>engineeringReply('no-date',h)})
    const legacy=vi.fn(()=>{throw Error('LEGACY_FORBIDDEN')});vi.stubGlobal('localStorage',{getItem:legacy,setItem:legacy})
    try{
      const html=renderToStaticMarkup(<App runtime={runtime}/>);
      expect(html).toContain('人工工程响应');expect(html).toContain('生成工程建议');expect(legacy).not.toHaveBeenCalled()
      expect((await runtime.load()).tasks).toEqual([])
      expect(()=>renderToStaticMarkup(<App runtime={{} as never}/>)).toThrow('MAINLINE_RUNTIME_INVALID')
    }finally{vi.unstubAllGlobals()}
  })
  it('real calendar keeps undated tasks findable and date-only edits free of artificial clocks in two host timezones',async()=>{
    const name='rco-mainline-01-02-i1-mainline05-calendar-'+crypto.randomUUID(),initial=emptyWorkspace();initial.workspace.id=name
    const runtime=await createSemanticRuntime({name,store:Object.assign(new MemoryWorkspaceRecordStore(),{name}),initial,recognize:(_,h)=>engineeringReply('no-date',h)})
    const d=await runtime.capture({sourceType:'text',content:notices['no-date']}),w=await runtime.load()
    const undated=await runtime.confirm({draftId:d,revision:semanticRevision(w),taskTempIds:['save']})
    const d2=await runtime.capture({sourceType:'text',content:notices['no-date']}),w2=await runtime.load()
    const edited=await runtime.edit({draftId:d2,revision:semanticRevision(w2),taskTempId:'save',field:'deadline',value:'2026-09-18',operationId:'calendar-date'})
    const saved=await runtime.confirm({draftId:d2,revision:semanticRevision(edited),taskTempIds:['save']})
    const originalTz=process.env.TZ
    vi.useFakeTimers();vi.setSystemTime(new Date(NOW))
    try{for(const tz of ['Asia/Shanghai','America/Los_Angeles']){
      process.env.TZ=tz
      const view=runtime.view(saved)
      const html=renderToStaticMarkup(<CalendarPage tasks={view.tasks} events={view.events} courseBlocks={[]}
        dateViews={runtime.dates(saved)} isolatedTimezone="Asia/Shanghai" onOpenTask={()=>{}} onAddCourseBlock={()=>{}} onRemoveCourseBlock={()=>{}}/>)
      expect(html).toContain('无截止日期任务');expect(html).toContain('仅日期');expect(html).not.toContain('18:00')
      expect(undated.timePoints).toEqual([])
    }}finally{if(originalTz===undefined)delete process.env.TZ;else process.env.TZ=originalTz;vi.useRealTimers()}
  })
})
