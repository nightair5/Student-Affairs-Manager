import {describe,it,expect} from 'vitest'
import sources from './fixtures/direct-must-pass/notifications.json'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback,recoverMissingDirectActions} from './directFallback'
import {convertDirectResult} from './directResult'

const run=(text:string,referenceTime='2026-10-01T00:00:00+08:00')=>{
 const input=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(referenceTime),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 return {input,improved:improveDirectFallback(input,text),out:convertDirectResult(improveDirectFallback(input,text),text)}
}
describe('local fallback actions and cutoff safety',()=>{
 for(const s of sources.filter(s=>s.id.startsWith('MUST-')))it('keeps an application action and explicit cutoff: '+s.id,()=>{
  const {out}=run(s.text,s.referenceTime)
  expect(out.result.standaloneTasks.some(t=>!/查看/u.test(t.actionVerb)&&/申请|提交|申报|填写/u.test(t.actionVerb))).toBe(true)
  expect(out.result.timePoints.some(p=>p.type==='task_deadline'&&p.normalizedValue)).toBe(true)
 })
 it('preserves independent, correctly grounded local tasks and IDs',()=>{
  const {input,improved}=run('请于10月8日17:00前提交课程论文。请于10月9日18:00前提交实验报告。')
  expect(improved).toEqual(input)
 })
 it('never treats a cancelled submission as a current action',()=>{
  const {out}=run('原定10月8日提交课程论文的要求已取消，无需提交。')
  expect(out.result.standaloneTasks.every(t=>t.actionVerb==='查看')).toBe(true)
 })
 it('keeps the right endpoint and midnight precision',()=>{
  const {out}=run('符合条件的同学于10月1日至10月9日24:00前提交奖学金申请表。')
  expect(out.result.timePoints.find(p=>p.type==='task_deadline')?.normalizedValue).toBe('2026-10-10T00:00')
 })
 it('fills a lost AI action without changing its independently retained event',()=>{
  const text='符合条件的同学请于10月30日17:00前提交奖学金申请表。11月2日14:00至15:00在A101举行说明会。',{input}=run(text),base=convertDirectResult({...input,standaloneTasks:[],milestones:[]},text),after=recoverMissingDirectActions(base,input,text)
  expect(after.result.standaloneTasks.some(t=>t.actionVerb==='提交')).toBe(true)
  expect(after.result.events).toEqual(base.result.events)
  expect(after.result.timePoints.some(p=>p.type==='task_deadline'&&p.normalizedValue==='2026-10-30T17:00')).toBe(true)
  expect(new Set(after.result.evidence.map(e=>e.id)).size).toBe(after.result.evidence.length)
 })
 it('does not rewrite an already retained actionable AI answer',()=>{
  const text='请于10月30日17:00前提交课程论文。',{input,out}=run(text)
  expect(recoverMissingDirectActions(out,input,text)).toBe(out)
 })
})
