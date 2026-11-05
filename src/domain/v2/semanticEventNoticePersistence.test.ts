import {describe,expect,it} from 'vitest'
import {compileSemanticNotice} from '../../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from '../../recognition/schema'
import {eventDescriptionSections} from '../../lib/eventPresentation'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatch} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'

const now='2026-11-05T12:00:00+08:00'
const source='学术交流会将于2026年11月20日14:00在文科楼201举行。有意向的同学可扫描原通知二维码加入交流社群。'
const eventQuote='学术交流会将于2026年11月20日14:00在文科楼201举行'
const notice='有意向的同学可扫描原通知二维码加入交流社群'
const facts={topic:'学术交流会',kind:'mixed',items:[
 {key:'event',kind:'event',title:'学术交流会',evidence:[eventQuote],times:[{role:'start',raw:'2026年11月20日14:00'}],location:'文科楼201'},
 {key:'join',kind:'task',title:'加入交流社群',action:'加入',object:'交流社群',evidence:[notice],eventRelation:{kind:'incidental',eventKey:'event',evidence:notice}},
],materials:[]}

describe('event notice through the canonical save path',()=>{
 it('retains the notice and event facts across reload and backup, and undo removes only the second batch',async()=>{
  const result=parseRecognitionResult(compileSemanticNotice(facts,{source,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.6.0'}).result)
  const workspace=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.save(workspace)
  const capture=new CapturePersistenceService(repo)
  async function add(operationId:string){
   const handle=await capture.beginCapture({operationId,sourceType:'text',title:'学术交流会',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.6.0',pipelineVersion:'test',now})
   await capture.recognize(handle,async()=>result)
   return commitDirectDraft(repo,handle.draftId,now)
  }
  await add('notice-first');const first=(await new CanonicalWorkspaceRepository(store).load())!
  const view=workspaceV8ToLegacyView(first)
  expect(view.events).toHaveLength(1)
  expect(view.tasks.some(task=>task.title.includes('交流社群'))).toBe(false)
  expect(view.events[0].startAt).toBe('2026-11-20T14:00')
  expect(view.events[0].location).toContain('文科楼201')
  expect(eventDescriptionSections(view.events[0].description).some(section=>section.label==='参加须知'&&section.content.includes(notice))).toBe(true)
  const restored=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(first)))
  expect(restored.events[0].description).toBe(view.events[0].description)
  const second=await add('notice-second')
  expect(workspaceV8ToLegacyView((await repo.load())!).events).toHaveLength(2)
  await undoDirectBatch(repo,second.batch!.id)
  const after=(await new CanonicalWorkspaceRepository(store).load())!
  expect(after.events).toEqual(first.events)
  expect(workspaceV8ToLegacyView(after).events[0].description).toBe(view.events[0].description)
 })
})
