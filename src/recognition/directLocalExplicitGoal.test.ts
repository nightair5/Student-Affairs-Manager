import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'

const run=(source:string)=>{
 const input=buildLocalRecognition({sourceType:'text',sourceTitle:'手动粘贴消息',content:source,referenceTime:new Date('2027-02-01T09:00:00+08:00'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 return convertDirectResult(improveDirectFallback(input,source),source).result
}

describe('explicitly shared goal in local fallback',()=>{
 it('groups distinct source-backed tasks while preserving both deadlines',()=>{
  const r=run('请于3月2日12:00前提交访谈提纲；3月5日18:00前提交调查报告。两项属于同一次课程调查。')
  expect(r.standaloneTasks).toHaveLength(2)
  expect(r.goalGroups).toHaveLength(1)
  expect(new Set(r.goalGroups![0].taskTempIds)).toEqual(new Set(r.standaloneTasks.map(t=>t.tempId)))
  expect(r.standaloneTasks.map(t=>r.timePoints.find(p=>t.timePointTempIds.includes(p.tempId))?.normalizedValue).sort()).toEqual(['2027-03-02T12:00','2027-03-05T18:00'])
 })
 it('does not group items when the source explicitly says they are unrelated',()=>{
  const r=run('请于3月2日12:00前提交访谈提纲；3月5日18:00前提交调查报告。两项不属于同一次课程调查。')
  expect(r.goalGroups??[]).toHaveLength(0)
 })
 it('does not group unrelated items solely because they share a date',()=>{
  const r=run('3月2日12:00前提交访谈提纲；同日18:00前上传门禁申请。两件事彼此无关。')
  expect(r.goalGroups??[]).toHaveLength(0)
 })
 it('does not attach a shared-goal claim across an intervening unrelated clause',()=>{
  const r=run('请于3月2日12:00前提交访谈提纲；3月5日18:00前提交调查报告。另有借用器材应归还。两项属于同一次课程调查。')
  expect(r.goalGroups??[]).toHaveLength(0)
 })
})
