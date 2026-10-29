import {describe,expect,it} from 'vitest'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {commitDirectDraft,undoDirectBatch} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {flowTaskDate} from '../../lib/flowPresentation'

const text=`【研究成果征集】
申报人须提交
1️⃣申请表（附件一）
2️⃣成果摘要：精选4页
3️⃣成果合辑：至少10页
以上材料均须提交电子版和纸质版，纸质版材料注明“学院+姓名”；
电子版文件夹以“学院+姓名”命名。
具体格式：申请表（Word版）、成果摘要和成果合辑（扫描件PDF版）。
电子版：2026年11月7日23:59前
电子版提交至邮箱contest@example.edu
纸质版截止时间在群聊中另行通知
纸质版后续在群聊中通知提交方式，请参赛同学加入群聊。`
const now='2026-10-29T02:00:00.000Z'

describe('shared submission direct persistence',()=>{
  it('saves and reloads each form, material, channel and deadline once, and undoes only the second batch',async()=>{
    const w=createGoldenWorkspaceV8()
    for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
    const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(w)
    const capture=new CapturePersistenceService(repo)
    const add=async(operationId:string)=>{
      const handle=await capture.beginCapture({operationId,sourceType:'text',title:'匿名资料',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'test',pipelineVersion:'test',now})
      await capture.recognize(handle,async()=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名资料',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]}))
      const receipt=await commitDirectDraft(repo,handle.draftId,now)
      expect((await commitDirectDraft(repo,handle.draftId,now)).duplicate).toBe(true)
      return receipt
    }
    const first=await add('shared-first'),saved=(await repo.load())!
    expect(saved.tasks).toHaveLength(3);expect(saved.materials).toHaveLength(6);expect(saved.events).toHaveLength(0)
    const e=saved.tasks.find(t=>t.title.includes('电子版'))!,p=saved.tasks.find(t=>t.title.includes('纸质版'))!
    expect(saved.timePoints.find(t=>t.relatedTaskIds.includes(e.id))?.normalizedValue).toBe('2026-11-07T23:59')
    expect(saved.timePoints.find(t=>t.relatedTaskIds.includes(p.id))).toMatchObject({normalizedValue:null,needsConfirmation:true})
    expect(saved.materials.filter(m=>m.relatedTaskIds.includes(e.id)).every(m=>m.submissionChannel?.includes('contest@example.edu'))).toBe(true)
    expect(saved.materials.filter(m=>m.relatedTaskIds.includes(p.id)).every(m=>m.submissionChannel===null)).toBe(true)
    const projected=workspaceV8ToLegacyView(saved),paper=projected.tasks.find(t=>t.id===p.id)!
    expect(flowTaskDate(paper)).toBe('截止时间另行通知')
    expect(projected.tasks.find(t=>t.id===e.id)!.materials[0].formatRequirements?.join(' ')).toContain('Word')
    const second=await add('shared-second'),twice=(await repo.load())!
    expect(twice.tasks).toHaveLength(6);expect(twice.materials).toHaveLength(12)
    await undoDirectBatch(repo,second.batch!.id,now);const after=(await repo.load())!
    expect(after.tasks).toEqual(saved.tasks);expect(after.materials).toEqual(saved.materials);expect(after.timePoints).toEqual(saved.timePoints)
    expect(first.batch?.id).not.toBe(second.batch?.id)
  })
})
