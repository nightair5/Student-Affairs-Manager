import {describe,expect,it} from 'vitest'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {selectSourceChoice} from './sourceChoice'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'

async function setup(){
 const w=createGoldenWorkspaceV8(),first=w.tasks[0],source=w.sourceVersions[0],second={...first,id:'choice-other',dependencyIds:[],legacyData:{...first.legacyData,sourceId:source.sourceId,sourceChoiceOwnerId:first.id}}
 source.rawText='两种方式任选一种。'
 w.tasks=[{...first,dependencyIds:[],legacyData:{...first.legacyData,sourceId:source.sourceId,sourceChoiceGroup:{version:'source-choice-group-1.0.0',id:'choice-test',sourceVersionId:source.id,quotation:'任选一种',optionTaskIds:[first.id,second.id]}}},...w.tasks.slice(1),second]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
 await repo.save(w)
 return {repo,store,first:first.id,second:second.id}
}

describe('source-backed submission choice',()=>{
 it('round-trips a three-branch choice while selecting only one personal option',async()=>{
  const {repo,store,first,second}=await setup()
  await repo.transaction(w=>{
   const owner=w.tasks.find(t=>t.id===first)!,other=w.tasks.find(t=>t.id===second)!,group=owner.legacyData!.sourceChoiceGroup as Record<string,unknown>
   return {...w,tasks:[...w.tasks.map(t=>t.id===first?{...t,legacyData:{...t.legacyData,sourceChoiceGroup:{...group,optionTaskIds:[first,second,'choice-third']}}}:t),{...other,id:'choice-third'}]}
  })
  await selectSourceChoice(repo,'choice-third',null)
  const saved=(await new CanonicalWorkspaceRepository(store).load())!
  const view=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(saved)))
  expect(view.tasks.find(t=>t.id===first)?.sourceChoice?.optionTaskIds).toEqual([first,second,'choice-third'])
  expect(view.tasks.find(t=>t.id===second)?.sourceChoice?.selectedTaskId).toBe('choice-third')
 })
 it('persists and changes the selected option without changing either source deadline',async()=>{
  const {repo,store,first,second}=await setup(),before=(await repo.load())!
  await selectSourceChoice(repo,first,null,'2026-11-03T12:00:00Z')
  await selectSourceChoice(repo,second,first,'2026-11-03T12:01:00Z')
  const independentlyRead=(await new CanonicalWorkspaceRepository(store).load())!
  expect(workspaceV8ToLegacyView(independentlyRead).tasks.find(task=>task.id===first)?.sourceChoice?.selectedTaskId).toBe(second)
  expect(independentlyRead.timePoints).toEqual(before.timePoints)
  expect(workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(independentlyRead))).tasks.find(task=>task.id===second)?.sourceChoice?.selectedTaskId).toBe(second)
 })
 it('rejects a stale change without overwriting the newer selection',async()=>{
  const {repo,first,second}=await setup()
  await selectSourceChoice(repo,first,null,'2026-11-03T12:00:00Z')
  await expect(selectSourceChoice(repo,second,null,'2026-11-03T12:01:00Z')).rejects.toThrow('其他页面修改')
  expect(workspaceV8ToLegacyView((await repo.load())!).tasks.find(task=>task.id===first)?.sourceChoice?.selectedTaskId).toBe(first)
 })
 it('treats a repeated selection as idempotent and keeps data intact on write failure',async()=>{
  const {repo,first}=await setup()
  await selectSourceChoice(repo,first,null,'2026-11-03T12:00:00Z')
  const saved=(await repo.load())!
  await selectSourceChoice(repo,first,null,'2026-11-03T12:01:00Z')
  expect(await repo.load()).toEqual(saved)
  await expect(selectSourceChoice({transaction:async()=>{throw Error('storage failed')}},first,first)).rejects.toThrow('storage failed')
  expect(await repo.load()).toEqual(saved)
 })
 it('keeps distinct history for rapid changes even when their timestamps coincide',async()=>{
  const {repo,first,second}=await setup(),now='2026-11-03T12:00:00Z'
  await selectSourceChoice(repo,first,null,now)
  await selectSourceChoice(repo,second,first,now)
  await selectSourceChoice(repo,first,second,now)
  await selectSourceChoice(repo,second,first,now)
  const saved=(await repo.load())!,history=saved.historyRecords.filter(record=>record.id.startsWith('history:source-choice:'))
  expect(history).toHaveLength(4)
  expect(new Set(history.map(record=>record.id)).size).toBe(4)
  expect(workspaceV8ToLegacyView(saved).tasks.find(task=>task.id===first)?.sourceChoice?.selectedTaskId).toBe(second)
 })
})
