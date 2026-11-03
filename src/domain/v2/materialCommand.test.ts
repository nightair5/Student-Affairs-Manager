import {describe,expect,it} from 'vitest'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {commitMaterialCommand} from './materialCommand'
import {directReplacementDiff} from './directReplacementSafety'

async function setup(){const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.save(createGoldenWorkspaceV8());return {repo,reader:new CanonicalWorkspaceRepository(store)}}
describe('material edits',()=>{
 it('persists individual facts once and preserves them across export and import',async()=>{
  const {repo,reader}=await setup(),original=(await repo.load())!,material=original.materials[2]
  const changes={quantity:4,formatRequirements:['扫描 PDF'],namingRequirements:['课程-姓名'],requirements:['每页签名'],submissionChannel:'课程平台'}
  const expected={quantity:material.quantity,formatRequirements:material.formatRequirements,namingRequirements:material.namingRequirements,requirements:material.requirements,submissionChannel:material.submissionChannel}
  const command={operationId:'edit-material',taskId:material.relatedTaskIds[0],materialId:material.id,expected,expectedOwnerIds:material.relatedTaskIds,changes,changedAt:'2026-11-03T03:00:00Z'}
  await commitMaterialCommand(repo,command);await commitMaterialCommand(repo,command)
  const saved=(await reader.load())!,actual=saved.materials.find(item=>item.id===material.id)!
  expect(actual).toMatchObject(changes)
  expect(saved.historyRecords.filter(item=>item.id.startsWith('material-command:edit-material:'))).toHaveLength(5)
  expect(repo.importJson(repo.exportJson(saved)).materials.find(item=>item.id===material.id)).toEqual(actual)
 })
 it('rejects stale edits, wrong owners, and failed transactions without changing data',async()=>{
  const {repo}=await setup(),before=(await repo.load())!,material=before.materials[0]
  const command={operationId:'rename',taskId:material.relatedTaskIds[0],materialId:material.id,expected:{name:material.name},expectedOwnerIds:material.relatedTaskIds,changes:{name:'新名称'},changedAt:'2026-11-03T03:00:00Z'}
  await expect(commitMaterialCommand({transaction:async()=>{throw Error('INJECTED_FAILURE')}},command)).rejects.toThrow('INJECTED_FAILURE')
  expect(await repo.load()).toEqual(before)
  await expect(commitMaterialCommand(repo,{...command,taskId:'unrelated'})).rejects.toThrow('MATERIAL_COMMAND_NOT_FOUND')
  await commitMaterialCommand(repo,command)
  await expect(commitMaterialCommand(repo,{...command,operationId:'stale',changes:{name:'其他名称'}})).rejects.toThrow('MATERIAL_COMMAND_FIELD_CONFLICT')
  expect((await repo.load())!.materials.find(item=>item.id===material.id)?.name).toBe('新名称')
 })
 it('does not let a retry silently turn conditional material into a requirement',async()=>{
  const {repo}=await setup(),before=(await repo.load())!,material=before.materials.find(item=>item.relatedTaskIds.length)!
  const owner=material.relatedTaskIds[0];material.required=false
  const after=structuredClone(before);after.materials.find(item=>item.id===material.id)!.required=true
  const result=directReplacementDiff(before,after,new Set([owner]),new Set([owner]))
  expect(result.preserved).toBe(false)
  expect(result.issues.some(issue=>issue.field==='material')).toBe(true)
 })
})
