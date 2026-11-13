import {describe,expect,it} from 'vitest'
import {compileSemanticNotice} from '../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from './schema'
import {convertDirectResult} from './directResult'
import {createGoldenWorkspaceV8} from '../domain/v2/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {commitDirectDraft} from '../domain/v2/directIntake'
import {workspaceV8ToLegacyView} from '../domain/v2/legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from '../domain/v2/serialization'

const now='2026-11-13T08:00:00+08:00',timezone='Asia/Shanghai'
const text='【资料办理】请将实习证明以电子版或纸质版任选一种方式提交：电子版于12月18日17:00前上传至资料平台；纸质版于12月19日12:00前交至资料窗口。'
const common='请将实习证明以电子版或纸质版任选一种方式提交'
const choice='以电子版或纸质版任选一种方式提交'
const facts={topic:'资料办理',kind:'action',items:[
 {key:'digital',kind:'task',title:'上传电子版实习证明',action:'上传',object:'实习证明',deliveryForm:'电子版',channel:'资料平台',evidence:[common,'电子版于12月18日17:00前上传至资料平台'],times:[{role:'deadline',raw:'12月18日17:00前'}],choice:{key:'submission',evidence:choice}},
 {key:'paper',kind:'task',title:'提交纸质版实习证明',action:'提交',object:'实习证明',deliveryForm:'纸质版',channel:'资料窗口',evidence:[common,'纸质版于12月19日12:00前交至资料窗口'],times:[{role:'deadline',raw:'12月19日12:00前'}],choice:{key:'submission',evidence:choice}},
],materials:[]}

const recognition=()=>parseRecognitionResult(compileSemanticNotice(facts,{source:text,referenceTime:now,timezone,promptVersion:'recognition-semantic-notice-3.11.0'}).result)

describe('source-backed materials in an already established choice',()=>{
 it('retains each branch material and channel through the real save and backup path',async()=>{
  const original=recognition()
  expect(original.materials).toHaveLength(0)
  expect(original.conflicts.some(c=>c.id.startsWith('sem-choice-'))).toBe(true)
  const workspace=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
  await repo.save(workspace)
  const h=await capture.beginCapture({operationId:'document-choice',sourceType:'text',title:'匿名通知',rawText:text,provider:'deepseek',modelName:'synthetic-fixture',promptVersion:original.promptVersion,pipelineVersion:'test',now})
  original.evidence.forEach(e=>{e.sourceId=h.sourceId})
  await capture.recognize(h,async()=>original)
  await commitDirectDraft(repo,h.draftId,now)
  const saved=await new CanonicalWorkspaceRepository(store).load()
  expect(saved).not.toBeNull()
  const view=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(saved!)))
  expect(view.tasks).toHaveLength(2)
  expect(view.tasks[0].sourceChoice?.id).toBe(view.tasks[1].sourceChoice?.id)
  expect(view.tasks.map(t=>t.deadline).sort()).toEqual(['2026-12-18T17:00','2026-12-19T12:00'])
  expect(view.tasks.map(t=>({name:t.materials[0]?.name,channel:t.materials[0]?.submissionChannel}))).toEqual([
   {name:'实习证明',channel:'资料平台'},{name:'实习证明',channel:'资料窗口'},
  ])
  expect(original.materials).toHaveLength(0)
 })
 it('does not invent materials for unrelated tasks, ungrounded choices, or existing materials',()=>{
  const missingChoice=recognition();missingChoice.conflicts=[]
  expect(convertDirectResult(missingChoice,text).result.materials).toHaveLength(0)
  const unsupported=recognition();unsupported.evidence.find(e=>e.quotedText===common)!.quotedText='伪造的共同依据'
  unsupported.evidence.find(e=>e.quote===common)!.quote='伪造的共同依据'
  expect(convertDirectResult(unsupported,text).result.materials).toHaveLength(0)
  const uncertain=recognition();uncertain.standaloneTasks[0].sourceStatus='uncertain'
  expect(convertDirectResult(uncertain,text).result.materials).toHaveLength(0)
  const wrongChannel=recognition();wrongChannel.standaloneTasks[0].description=wrongChannel.standaloneTasks[0].description.replace('资料平台','别的平台')
  expect(convertDirectResult(wrongChannel,text).result.materials.find(m=>m.relatedTaskTempIds.includes(wrongChannel.standaloneTasks[0].tempId))?.submissionChannel).toBeNull()
  const existing=recognition()
  existing.materials.push({tempId:'existing',name:'实习证明',required:true,formatRequirements:['电子版'],namingRequirements:[],requirements:[],quantity:null,submissionChannel:'资料平台',relatedTaskTempIds:[existing.standaloneTasks[0].tempId],evidenceIds:existing.standaloneTasks[0].evidenceIds,confidence:0.8,selected:true})
  existing.standaloneTasks[0].materialTempIds=['existing']
  const materials=convertDirectResult(existing,text).result.materials
  expect(materials).toHaveLength(2)
  expect(materials.filter(m=>m.relatedTaskTempIds.includes(existing.standaloneTasks[0].tempId))).toHaveLength(1)
 })
})
