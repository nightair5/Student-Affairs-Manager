import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'
const run=(source:string)=>{
 const raw=buildLocalRecognition({sourceType:'text',sourceTitle:'手动粘贴消息',content:source,referenceTime:new Date('2026-11-08T09:00:00+08:00'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 return convertDirectResult(improveDirectFallback(raw,source),source).result
}
const deadlines=(r:ReturnType<typeof run>,id:string)=>r.timePoints.filter(p=>p.relatedTaskTempIds.includes(id)&&p.type.endsWith('_deadline')&&p.selected!==false).map(p=>p.normalizedValue)
describe('local source deadline ownership',()=>{
 it('does not attach a later material submission deadline to a registration window',()=>{
  const r=run('课程报名系统12月17日9:00开放，12月19日18:00关闭。申请材料须另外在12月18日17:00前上传。')
  const registration=r.standaloneTasks.find(t=>t.title.includes('课程'))!
  expect(registration).toBeTruthy()
  expect(deadlines(r,registration.tempId)).not.toContain('2026-12-18T17:00')
 })
 it('does not infer shared ownership merely from a topic word',()=>{
  const r=run('课程报名系统12月17日9:00开放，12月19日18:00关闭。课程申请材料须另外在12月18日17:00前上传。')
  const registration=r.standaloneTasks.find(t=>t.title.includes('课程'))!
  expect(registration).toBeTruthy()
  expect(deadlines(r,registration.tempId)).not.toContain('2026-12-18T17:00')
 })
 it('retains a deadline explicitly belonging to the same form in a later sentence',()=>{
  const r=run('请提交报名表。报名表须于11月23日20:00前提交。')
  const form=r.standaloneTasks.find(t=>t.title.includes('报名表'))!
  expect(form).toBeTruthy()
  expect(deadlines(r,form.tempId)).toContain('2026-11-23T20:00')
 })
 it('retains an explicitly shared deadline for the same submission workflow',()=>{
  const r=run('志愿服务报名：先填写报名表，再将本人健康承诺书上传到同一报名页面。两步均须于11月23日20:00前完成。')
  expect(r.standaloneTasks.some(t=>deadlines(r,t.tempId).includes('2026-11-23T20:00'))).toBe(true)
 })
})
