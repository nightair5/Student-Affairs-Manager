import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from './pipeline'
import { eventEvidenceDraftId, eventSourceDraftId, eventSourceSupplement } from './eventSourceSupplement'
import { createGoldenWorkspaceV8 } from '../domain/v2/fixtures'
import { CapturePersistenceService } from '../domain/v2/capture'
import { commitDirectDraft, undoDirectBatch } from '../domain/v2/directIntake'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import type { JsonValue } from '../domain/v2/types'

const now='2026-10-29T08:00:00.000Z'
const text='【校园知识讲座】\n时间：11月10日 14:00\n地点：教学楼101\n参与活动可获得一次学习证明。'
const supplement='参与活动可获得一次学习证明'
async function setup(){
  const workspace=createGoldenWorkspaceV8(),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
  await repo.save(workspace)
  const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:'event-supplement-test',sourceType:'text',title:'匿名讲座',rawText:text,provider:'manual',modelName:'fixture',promptVersion:'test',pipelineVersion:'test',now})
  const result=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名讲座',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
  result.promptVersion='recognition-two-step-2.4.0'
  result.events[0].description='校园知识讲座'
  result.evidence[0].quote='校园知识讲座';result.evidence[0].quotedText='校园知识讲座';result.evidence[0].sourceId=handle.sourceId
  result.evidence.push({id:'unassigned',sourceId:handle.sourceId,quote:supplement,field:'description'})
  result.ignoredContent.push({text:supplement,reason:'other'})
  await capture.recognize(handle,async()=>result)
  const receipt=await commitDirectDraft(repo,handle.draftId,now)
  const eventId=receipt.batch!.items.find(item=>item.kind==='event')!.id
  return {store,repo,handle,receipt,eventId}
}

describe('event source-level supplement',()=>{
  it('survives an independent repository read and disappears after batch undo',async()=>{
    const {store,repo,receipt,eventId}=await setup()
    const fresh=(await new CanonicalWorkspaceRepository(store).load())!
    expect(eventSourceSupplement(fresh,eventId)).toContain(supplement)
    expect(fresh.events.find(event=>event.id===eventId)?.description).not.toContain(supplement)
    await undoDirectBatch(repo,receipt.batch!.id)
    expect(eventSourceSupplement((await repo.load())!,eventId)).toEqual([])
  })
  it('does not cross source boundaries when local evidence IDs are reused',async()=>{
    const {repo,eventId}=await setup(),workspace=(await repo.load())!,original=workspace.extractionDrafts[0]
    const copied=structuredClone(original),batch=copied.legacyData!.directBatch as Record<string,JsonValue>
    batch.draftId='other-draft';batch.sourceId='other-source';batch.items=[{kind:'event',id:'other-event',tempId:'g2-1',tags:[]}] as JsonValue
    copied.id='other-draft';workspace.extractionDrafts.push(copied)
    expect(eventSourceDraftId(workspace,eventId)).toBe(original.id)
    expect(eventSourceSupplement(workspace,eventId)).toContain(supplement)
    workspace.extractionDrafts[0].result!.evidence.find(e=>e.id==='unassigned')!.sourceId='other-source'
    expect(eventSourceSupplement(workspace,eventId)).toEqual([])
  })
  it('does not reverse a negation or omit a condition from a source sentence',async()=>{
    const {repo,eventId}=await setup(),workspace=(await repo.load())!
    for(const sentence of ['本活动不需要报名。','符合资格的同学需要报名。']){
      const changed=structuredClone(workspace)
      changed.sourceVersions[0].rawText=text.replace(supplement,sentence.slice(0,-1))
      const result=changed.extractionDrafts[0].result!
      result.ignoredContent=[{text:'需要报名',reason:'other'}]
      const evidence=result.evidence.find(e=>e.id==='unassigned')!
      evidence.quote='需要报名';evidence.quotedText='需要报名'
      expect(eventSourceSupplement(changed,eventId)).toEqual([sentence.slice(0,-1)])
    }
  })
  it('expands a unique source quote to the complete original instruction',async()=>{
    const {repo,eventId}=await setup(),workspace=(await repo.load())!
    workspace.sourceVersions[0].rawText=text.replace(supplement,`注意：${supplement}`)
    expect(eventSourceSupplement(workspace,eventId)).toEqual([`注意：${supplement}`])
    workspace.sourceVersions[0].rawText+=`\n${supplement}`
    expect(eventSourceSupplement(workspace,eventId)).toEqual([])
  })
  it('labels source notes as unassigned even when one source created multiple events',async()=>{
    const {repo,eventId}=await setup(),workspace=(await repo.load())!
    const another=structuredClone(workspace.events[0]);another.id='another-event';workspace.events.push(another)
    const batch=workspace.extractionDrafts[0].legacyData!.directBatch as Record<string,JsonValue>
    ;(batch.items as JsonValue[]).push({kind:'event',id:'another-event',tempId:'other',tags:[]})
    expect(eventSourceSupplement(workspace,eventId)).toContain(supplement)
    expect(eventSourceSupplement(workspace,'another-event')).toContain(supplement)
    expect(workspace.events.every(event=>!event.description?.includes(supplement))).toBe(true)
  })
  it('does not project stale, mismatched or ambiguous ownership',async()=>{
    const {repo,eventId}=await setup(),workspace=(await repo.load())!
    const changed=structuredClone(workspace);changed.sources[0].currentVersionId='new-version'
    expect(eventSourceSupplement(changed,eventId)).toEqual([])
    const duplicate=structuredClone(workspace.extractionDrafts[0]);duplicate.id='ambiguous-draft'
    ;(duplicate.legacyData!.directBatch as Record<string,JsonValue>).draftId='ambiguous-draft'
    workspace.extractionDrafts.push(duplicate)
    expect(eventSourceSupplement(workspace,eventId)).toEqual([])
    expect(eventSourceSupplement(workspace,'missing')).toEqual([])
  })
  it('preserves a unique legacy source but does not guess when legacy evidence IDs collide',async()=>{
    const {repo,eventId}=await setup(),workspace=(await repo.load())!
    const event=workspace.events.find(item=>item.id===eventId)!
    delete event.legacyData!.directMode
    delete event.legacyData!.sourceId
    delete workspace.extractionDrafts[0].legacyData!.directBatch
    expect(eventEvidenceDraftId(workspace,eventId,['evidence-1'])).toBe(workspace.extractionDrafts[0].id)
    const noSource=structuredClone(workspace);noSource.historyRecords=[]
    expect(eventEvidenceDraftId(noSource,eventId,['evidence-1'])).toBeNull()
    const other=structuredClone(workspace.extractionDrafts[0]);other.id='other-draft'
    workspace.extractionDrafts.push(other)
    expect(eventEvidenceDraftId(workspace,eventId,['evidence-1'])).toBeNull()
  })
})
