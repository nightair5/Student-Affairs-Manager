import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'

const direct=(source:string)=>{
 const input=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date('2026-11-14T01:00:00Z'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 return convertDirectResult(improveDirectFallback(input,source,{scopeAware:true}),source,undefined,{scopeAware:true}).result
}
describe('explicit local choices with the deliverable in each branch',()=>{
 it('retains both formats, their own deadlines and channels as one choice',()=>{
  const r=direct('【证明领取】请任选一种方式办理：电子版证明于11月26日17:00前上传至服务平台；纸质版证明于11月27日12:00前交到服务窗口。两种方式不必同时完成。')
  const choice=r.conflicts.find(c=>c.id.startsWith('sem-choice-'))
  expect(choice?.entityTempIds).toHaveLength(2)
  const branches=choice!.entityTempIds.map(id=>r.standaloneTasks.find(t=>t.tempId===id)!)
  expect(branches.map(t=>t.actionObject)).toEqual(['证明','证明'])
  expect(branches.map(t=>r.timePoints.find(p=>p.relatedTaskTempIds.includes(t.tempId))?.normalizedValue)).toEqual(['2026-11-26T17:00','2026-11-27T12:00'])
  expect(branches.map(t=>r.materials.find(m=>m.relatedTaskTempIds.includes(t.tempId))?.submissionChannel)).toEqual(['服务平台','服务窗口'])
 })
 it('does not merge different objects or override an explicit requirement to submit both',()=>{
  for(const text of [
   '请选择办理方式：电子版申请表于11月26日17:00前上传至服务平台；纸质版证明于11月27日12:00前交到服务窗口。',
   '电子版证明于11月26日17:00前上传至服务平台；纸质版证明于11月27日12:00前交到服务窗口。两种都必须提交。',
  ])expect(direct(text).conflicts.some(c=>c.id.startsWith('sem-choice-'))).toBe(false)
 })
})
