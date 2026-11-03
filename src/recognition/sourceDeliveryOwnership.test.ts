import {describe,expect,it} from 'vitest'
import {compileSemanticNotice} from '../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from './schema'
import {createGoldenWorkspaceV8} from '../domain/v2/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {commitDirectDraft} from '../domain/v2/directIntake'
import {workspaceV8ToLegacyView} from '../domain/v2/legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from '../domain/v2/serialization'

describe('delivery-scoped material facts',()=>{
 it('keeps shared material content but separates email, formats and naming from the print copy',async()=>{
  const source='报名表须本人签名。电子版需要Word和PDF两种格式，文件名为“班级+姓名”；电子版12月8日17:00前发送至office@example.edu。打印版也需要提交，地点和截止另行通知。'
  const facts={topic:'报名材料',kind:'action',items:[
   {key:'e',kind:'task',title:'提交电子版报名表',action:'提交',object:'报名表',deliveryForm:'电子版',channel:'office@example.edu',evidence:['电子版需要Word和PDF两种格式，文件名为“班级+姓名”','电子版12月8日17:00前发送至office@example.edu'],times:[{role:'deadline',raw:'12月8日17:00前'}],materials:['form']},
   {key:'p',kind:'task',title:'提交打印版报名表',action:'提交',object:'报名表',deliveryForm:'打印版',evidence:['打印版也需要提交，地点和截止另行通知'],requirements:['地点和截止另行通知'],materials:['form']},
  ],materials:[{key:'form',name:'报名表',owners:['e','p'],formats:['Word','PDF'],naming:['班级+姓名'],channel:'office@example.edu',requirements:['报名表须本人签名','电子版需要Word和PDF两种格式'],evidence:['报名表须本人签名','电子版需要Word和PDF两种格式，文件名为“班级+姓名”']} ]}
  const result=parseRecognitionResult(compileSemanticNotice(facts,{source,referenceTime:'2026-11-03T02:00:00Z',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.2.0'}).result)
  const w=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(w)
  const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:'delivery-owners',sourceType:'text',title:'报名材料',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.2.0',pipelineVersion:'test',now:'2026-11-03T02:00:00Z'})
  await capture.recognize(h,async()=>result);await commitDirectDraft(repo,h.draftId,'2026-11-03T02:00:00Z')
  const saved=importWorkspaceV8(exportWorkspaceV8((await repo.load())!)),view=workspaceV8ToLegacyView(saved)
  const electronic=view.tasks.find(task=>task.title.includes('电子版'))!,paper=view.tasks.find(task=>task.title.includes('打印版'))!
  expect(electronic.deadline).toBe('2026-12-08T17:00')
  expect(paper.deadline).toBeFalsy()
  expect(electronic.materials[0].submissionChannel).toBe('office@example.edu')
  expect(electronic.materials[0].formatRequirements).toEqual(['Word','PDF'])
  expect(electronic.materials[0].namingRequirements).toEqual(['班级+姓名'])
  expect(paper.materials[0].submissionChannel).toBeUndefined()
  expect(paper.materials[0].formatRequirements).toBeUndefined()
  expect(paper.materials[0].namingRequirements).toBeUndefined()
  expect(paper.description).not.toContain('电子版需要Word')
  expect(paper.materials[0].requirements).toContain('报名表须本人签名')
 })
})
