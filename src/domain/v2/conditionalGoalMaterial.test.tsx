import {it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {compileSemanticNotice} from '../../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult,validateRecognitionResult} from '../../recognition/schema'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {assertDirectBatchReplaceable,commitDirectDraft,deleteDirectItem,undoDirectBatchPreservingEdits} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {commitTaskCommand} from './taskCommand'
import {UnassignedSourceMaterials} from '../../components/UnassignedSourceMaterials'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {taskPublicDescription} from '../../lib/taskContentPresentation'
import {commitMaterialCommand} from './materialCommand'
import {goalMaterialScope} from './materialScope'
import {MaterialEditor} from '../../components/MaterialEditor'

const now='2026-11-13T09:00:00+08:00'
const source='【课程证明办理】\n一、办理流程\n1.请办理课程证明。\n2.办理后请提交证明复印件。\n二、其他事项\n委托他人办理请出具授权书和代办人身份证原件。'
const raw={topic:'课程证明办理',kind:'action',items:[
 {key:'a',kind:'task',title:'办理课程证明',action:'办理',object:'课程证明',evidence:['请办理课程证明']},
 {key:'b',kind:'task',title:'提交证明复印件',action:'提交',object:'证明复印件',evidence:['办理后请提交证明复印件'],dependsOn:['a']},
 ],materials:[
 {key:'m1',name:'授权书',required:false,owners:[],evidence:['委托他人办理请出具授权书和代办人身份证原件']},
 {key:'m2',name:'代办人身份证原件',required:false,owners:[],evidence:['委托他人办理请出具授权书和代办人身份证原件']},
 ]}
const options={source,referenceTime:now,promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.31',roleResolutionVersion:'1.0.0'}

it('persists a cited conditional material at workflow scope, not as an unconditional task requirement',async()=>{
 const result=parseRecognitionResult(compileSemanticNotice(structuredClone(raw),options).result)
 expect(result.materials).toHaveLength(2)
 expect(result.materials.every(m=>m.goalScope?.requirement==='required'&&m.goalScope.condition==='委托他人办理')).toBe(true)
 expect(result.materials.every(m=>m.relatedTaskTempIds.length===0)).toBe(true)
 const w=createGoldenWorkspaceV8()
 for(const k of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[k]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(w)
 const add=async(operationId:string)=>{const h=await capture.beginCapture({operationId,sourceType:'text',title:'课程证明办理',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:result.promptVersion,pipelineVersion:'fixture',now});await capture.recognize(h,async()=>structuredClone(result));return commitDirectDraft(repo,h.draftId,now)}
 await add('conditional-first')
 const saved=(await new CanonicalWorkspaceRepository(store).load())!
 expect(saved.materials).toHaveLength(2)
 expect(saved.materials.every(m=>m.relatedTaskIds.length===0&&m.legacyData?.assignment==='goal')).toBe(true)
 const task=workspaceV8ToLegacyView(saved).tasks[0]
 const html=renderToStaticMarkup(<UnassignedSourceMaterials task={task}/>)
 expect(html).toContain('本办理事项的条件材料')
 expect(html).toContain('委托他人办理时必需')
 expect(html).not.toContain('>可选<')
 expect(importWorkspaceV8(exportWorkspaceV8(saved)).materials).toEqual(saved.materials)
 const first=saved.tasks[0]
 await commitTaskCommand(repo,{operationId:'conditional-complete',taskId:first.id,expected:{status:first.status},changes:{status:'completed'},changedAt:now})
 const second=await add('conditional-second')
 await undoDirectBatchPreservingEdits(repo,second.batch!.id)
 const after=(await new CanonicalWorkspaceRepository(store).load())!
 expect(after.tasks.find(t=>t.id===first.id)?.status).toBe('completed')
 expect(after.materials).toEqual(saved.materials)
})

it('edits conditional goal materials with revision checks and protects the edited batch',async()=>{
 const result=parseRecognitionResult(compileSemanticNotice(structuredClone(raw),options).result)
 const w=createGoldenWorkspaceV8()
 for(const k of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[k]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(w)
 const h=await capture.beginCapture({operationId:'edit-condition',sourceType:'text',title:'课程证明办理',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:result.promptVersion,pipelineVersion:'fixture',now})
 await capture.recognize(h,async()=>result)
 const receipt=await commitDirectDraft(repo,h.draftId,now)
 const before=(await repo.load())!,material=before.materials[0],scope=goalMaterialScope(material)!,task=before.tasks.find(item=>scope.taskIds.includes(item.id))!
 expect(renderToStaticMarkup(<MaterialEditor material={material} onDraft={()=>undefined} onSave={async()=>undefined}/>)).toContain(`编辑${material.name}的要求`)
 const command={operationId:'edit-goal-material',materialId:material.id,taskId:task.id,expectedOwnerIds:scope.taskIds,expected:{name:material.name,goalCondition:scope.condition,goalRequirement:scope.requirement},changes:{name:'签字授权书',goalCondition:'代办时',goalRequirement:'optional' as const},changedAt:'2026-11-13T09:01:00+08:00'}
 await commitMaterialCommand(repo,command)
 expect((await commitMaterialCommand(repo,command)).changed).toBe(false)
 const saved=(await new CanonicalWorkspaceRepository(store).load())!,edited=saved.materials.find(item=>item.id===material.id)!
 expect(edited.name).toBe('签字授权书')
 expect(goalMaterialScope(edited)).toMatchObject({condition:'代办时',requirement:'optional'})
 expect(edited.required).toBe(false)
 expect(saved.historyRecords.filter(item=>item.id.startsWith('material-command:edit-goal-material:')&&item.actor==='user')).toHaveLength(3)
 expect(importWorkspaceV8(exportWorkspaceV8(saved)).materials).toEqual(saved.materials)
 expect(renderToStaticMarkup(<UnassignedSourceMaterials task={workspaceV8ToLegacyView(saved).tasks.find(item=>item.id===task.id)!}/>)).toContain('代办时可选')
 await expect(commitMaterialCommand(repo,{...command,operationId:'stale-condition',changes:{goalCondition:'本人办理'},expected:{goalCondition:scope.condition}})).rejects.toThrow('MATERIAL_COMMAND_FIELD_CONFLICT')
 expect(()=>assertDirectBatchReplaceable(saved,receipt.batch!.id)).toThrow('材料')
 await expect(undoDirectBatchPreservingEdits(repo,receipt.batch!.id)).rejects.toThrow('已修改')
 expect((await repo.load())!.materials.find(item=>item.id===material.id)?.name).toBe('签字授权书')
})

it('keeps goal materials when deleting another member and preserves the final orphaned material',async()=>{
 const result=parseRecognitionResult(compileSemanticNotice(structuredClone(raw),options).result)
 const w=createGoldenWorkspaceV8()
 for(const k of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[k]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(w)
 const h=await capture.beginCapture({operationId:'delete-goal-member',sourceType:'text',title:'课程证明办理',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:result.promptVersion,pipelineVersion:'fixture',now})
 await capture.recognize(h,async()=>result);await commitDirectDraft(repo,h.draftId,now)
 const before=(await repo.load())!,scope=goalMaterialScope(before.materials[0])!
 expect(scope.taskIds).toHaveLength(2)
 await deleteDirectItem(repo,scope.taskIds[0])
 const remaining=(await repo.load())!
 expect(remaining.materials).toHaveLength(2)
 expect(goalMaterialScope(remaining.materials[0])?.taskIds).toEqual([scope.taskIds[1]])
 await deleteDirectItem(repo,scope.taskIds[1])
 const orphaned=(await repo.load())!
 expect(orphaned.materials).toHaveLength(2)
 expect(orphaned.materials.every(item=>item.legacyData?.assignment==='unresolved'&&item.requirements.includes('委托他人办理时必需'))).toBe(true)
 expect(importWorkspaceV8(exportWorkspaceV8(orphaned)).materials).toEqual(orphaned.materials)
})

it('does not attach an unrelated conditional material to separate workflows',()=>{
 const s='请办理课程证明。另请提交住宿申请。委托他人办理请出具授权书。'
 const two={topic:'本周事项',kind:'action',items:[
  {key:'a',kind:'task',title:'办理课程证明',action:'办理',object:'课程证明',evidence:['请办理课程证明']},
  {key:'b',kind:'task',title:'提交住宿申请',action:'提交',object:'住宿申请',evidence:['另请提交住宿申请']},
 ],materials:[{key:'m',name:'授权书',required:false,owners:[],evidence:['委托他人办理请出具授权书']}]}
 const result=parseRecognitionResult(compileSemanticNotice(two,{...options,source:s}).result)
 expect(result.materials[0].goalScope).toBeUndefined()
 expect(result.materials[0].requirements).toContain('适用事项待关联')
 expect(validateRecognitionResult(result,{sourceContent:s}).valid).toBe(true)
})

it('leaves an intervening different process unassociated in the local fallback',()=>{
 const text='请提交社团报名表。费用由另一服务窗口负责。若委托他人办理，必须提供委托书和代办人身份证。'
 const result=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名事项',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 expect(result.materials.filter(material=>material.goalScope)).toHaveLength(0)
 expect(result.quality.reviewReasons.join('\n')).toContain('条件材料归属尚未完整')
})

it('rejects a material condition that is not supported by its cited source',()=>{
 const result=parseRecognitionResult(compileSemanticNotice(structuredClone(raw),options).result)
 result.materials[0].goalScope!.condition='所有学生'
 expect(validateRecognitionResult(result,{sourceContent:source}).issues.some(issue=>issue.code==='MATERIAL_CONDITION_NOT_IN_EVIDENCE')).toBe(true)
})

it('saves an explicit local conditional material list with the workflow through direct intake',async()=>{
 const text='证件办理：请提交申请表。委托他人办理时必须提供代办人身份证、委托书和申请人身份证复印件。'
 const local=buildLocalRecognition({sourceType:'text',sourceTitle:'证件办理',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 expect(validateRecognitionResult(local,{sourceContent:text}).valid).toBe(true)
 expect(local.materials.filter(m=>m.goalScope).map(m=>m.name)).toEqual(['代办人身份证','委托书','申请人身份证复印件'])
 const w=createGoldenWorkspaceV8()
 for(const k of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[k]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(w)
 const h=await capture.beginCapture({operationId:'local-condition',sourceType:'text',title:'证件办理',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:local.promptVersion,pipelineVersion:'local-fixture',now})
 await capture.recognize(h,async()=>local)
 await commitDirectDraft(repo,h.draftId,now)
 const saved=(await new CanonicalWorkspaceRepository(store).load())!
 const conditional=saved.materials.filter(m=>m.legacyData?.assignment==='goal')
 expect(conditional.map(m=>m.name)).toEqual(['代办人身份证','委托书','申请人身份证复印件'])
 expect(conditional.every(m=>m.required===false)).toBe(true)
 expect(importWorkspaceV8(exportWorkspaceV8(saved)).materials).toEqual(saved.materials)
 const markup=renderToStaticMarkup(<UnassignedSourceMaterials task={workspaceV8ToLegacyView(saved).tasks[0]}/> )
 expect(markup).toContain('委托他人办理时必需')
})

it('does not turn an alternative or optional material into a conditional requirement',()=>{
 for(const text of ['办理证明：请提交申请表。委托他人办理时须提供身份证或委托书。','办理证明：请提交申请表。委托他人办理时可提供身份证和委托书。']){
  const local=buildLocalRecognition({sourceType:'text',sourceTitle:'办理证明',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
  expect(local.materials.filter(m=>m.goalScope?.requirement==='required')).toHaveLength(0)
 }
})

it('distinguishes and saves optional personal material from materials required for delegation',async()=>{
 const text='请于12月5日前提交登记表。本人办理可选择提供纸质照片；若由他人代办，必须提供授权书和代办人证件。'
 const result=buildLocalRecognition({sourceType:'text',sourceTitle:'办理事项',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 expect(validateRecognitionResult(result,{sourceContent:text}).valid).toBe(true)
 const photo=result.materials.find(material=>material.name==='照片')
 expect(photo).toMatchObject({required:false,goalScope:{condition:'本人办理',requirement:'optional'}})
 expect(photo?.formatRequirements).toContain('纸质')
 expect(result.materials.filter(material=>material.goalScope?.requirement==='required').map(material=>material.name)).toEqual(['授权书','代办人证件'])
 const w=createGoldenWorkspaceV8()
 for(const k of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[k]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(w)
 const h=await capture.beginCapture({operationId:'optional-condition',sourceType:'text',title:'办理事项',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:result.promptVersion,pipelineVersion:'local-fixture',now})
 await capture.recognize(h,async()=>result);await commitDirectDraft(repo,h.draftId,now)
 const saved=(await new CanonicalWorkspaceRepository(store).load())!
 const task=workspaceV8ToLegacyView(saved).tasks[0]
 expect(task.deadline).toBe('2026-12-05')
 const markup=renderToStaticMarkup(<UnassignedSourceMaterials task={task}/> )
 expect(markup).toContain('本人办理时可选')
 expect(markup).toContain('由他人代办时必需')
 expect(importWorkspaceV8(exportWorkspaceV8(saved)).materials).toEqual(saved.materials)
})

it('persists an organiser review as visible source-backed context, not a personal event',async()=>{
 const text='课程作品安排。组织者对作品进行审核，并将作品进行展出。\n（一）作品提交阶段\n请于11月20日前提交作品。\n（二）作品审核阶段\n审核时间：11月21日至11月23日。\n（三）作品展出阶段\n展出时间：11月25日至11月27日。'
 const model={topic:'课程作品安排',kind:'mixed',items:[
  {key:'submit',kind:'task',title:'提交作品',action:'提交',object:'作品',evidence:['请于11月20日前提交作品'],times:[{role:'deadline',raw:'11月20日前'}]},
  {key:'review',kind:'event',title:'作品审核阶段',evidence:['审核时间：11月21日至11月23日'],times:[{role:'start',raw:'11月21日'},{role:'end',raw:'11月23日'}]},
 ],materials:[]}
 const result=parseRecognitionResult(compileSemanticNotice(model,{...options,source:text}).result)
 expect(validateRecognitionResult(result,{sourceContent:text}).valid).toBe(true)
 const w=createGoldenWorkspaceV8()
 for(const k of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[k]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(w)
 const h=await capture.beginCapture({operationId:'organizer-scope',sourceType:'text',title:'课程作品安排',rawText:text,provider:'deepseek',modelName:'fixture',promptVersion:result.promptVersion,pipelineVersion:'fixture',now})
 await capture.recognize(h,async()=>result)
 await commitDirectDraft(repo,h.draftId,now)
 const saved=(await new CanonicalWorkspaceRepository(store).load())!
 expect(saved.events).toHaveLength(0)
 expect(taskPublicDescription(workspaceV8ToLegacyView(saved).tasks[0])).toContain('11月21日')
 expect(importWorkspaceV8(exportWorkspaceV8(saved)).tasks).toEqual(saved.tasks)
})
