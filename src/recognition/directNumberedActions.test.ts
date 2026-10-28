import {describe,it,expect} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback,recoverMissingDirectActions} from './directFallback'
import {convertDirectResult} from './directResult'
import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import {completeNumberedActions} from './directNumberedActions'
const source='【关于2026年校园作品比赛的通知】\n请同学们留意各项时间。\n1. 系统报名｜截止：11 月 2 日 晚24：00\n请完成线上系统报名。\n2. 院级初赛报名材料提交｜截止：11 月 3 日 中午 12:00\n完成报名后，请将报名材料提交给班长。\n3. 初赛汇报PPT 提交｜\n在初赛开始前可以继续调整PPT。'
const local=(text:string)=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date('2026-10-28T08:00:00+08:00'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
const tasks=(r:ReturnType<typeof convertDirectResult>)=>r.result.standaloneTasks.map(t=>({title:t.title,time:r.result.timePoints.find(p=>p.relatedTaskTempIds.includes(t.tempId)&&p.normalizedValue)?.normalizedValue??null})).sort((a,b)=>a.title.localeCompare(b.title))
describe('explicit numbered notice actions',()=>{
 it('retains each separately named action and its own deadline',()=>{
  const out=convertDirectResult(improveDirectFallback(local(source),source),source),got=tasks(out)
  expect(got).toHaveLength(3)
  expect(got).toEqual(expect.arrayContaining([{title:'2026年校园作品比赛系统报名',time:'2026-11-03T00:00'},{title:'提交院级初赛报名材料',time:'2026-11-03T12:00'},{title:'提交初赛汇报PPT',time:null}]))
 })
 it('retains project milestone and work package structure when completing actions',()=>{
  const r=convertDirectResult(improveDirectFallback(local(source),source),source).result,task=r.standaloneTasks.find(t=>t.title.endsWith('系统报名'))!
  r.standaloneTasks=r.standaloneTasks.filter(t=>t!==task)
  r.milestones=[{tempId:'milestone',title:'比赛阶段',objective:'准备工作',order:1,evidenceIds:[],tasks:[],workPackages:[{tempId:'package',title:'报名流程',objective:'完成报名',order:1,evidenceIds:[],tasks:[{...task,parentTempId:'package'}]}]}]
  const actual=completeNumberedActions(r,source)
  expect(actual.milestones).toHaveLength(1);expect(actual.milestones[0].title).toBe('比赛阶段');expect(actual.milestones[0].workPackages[0].title).toBe('报名流程');expect(actual.milestones[0].workPackages[0].tasks[0].parentTempId).toBe('package')
  expect(actual.standaloneTasks.some(t=>t.tempId===task.tempId)).toBe(false)
 })
 it('keeps each deadline tied to its own original heading quote',()=>{
  const r=convertDirectResult(improveDirectFallback(local(source),source),source).result
  for(const task of r.standaloneTasks){for(const point of r.timePoints.filter(p=>p.relatedTaskTempIds.includes(task.tempId)&&p.normalizedValue)){
   expect(source).toContain(point.rawText);const quote=r.evidence.find(e=>point.evidenceIds.includes(e.id));const original=quote?.quotedText||quote?.quote||'';expect(original).toBeTruthy();expect(source).toContain(original)
   if(task.title.endsWith('系统报名'))expect(point.rawText).toContain('11 月 2 日')
   if(task.title==='提交院级初赛报名材料')expect(point.rawText).toContain('11 月 3 日')
  }}
 })
 it('repairs AI partial omission and a deadline attached from another section',()=>{
  const r=convertDirectResult(improveDirectFallback(local(source),source),source),registration=r.result.standaloneTasks.find(t=>t.title.endsWith('系统报名'))!,material=r.result.standaloneTasks.find(t=>t.title==='提交院级初赛报名材料')!,deadline=r.result.timePoints.find(p=>p.relatedTaskTempIds.includes(material.tempId)&&p.normalizedValue)!
  const broken=structuredClone(r.result),b=broken.standaloneTasks.find(t=>t.tempId===registration.tempId)!
  broken.standaloneTasks=[b];broken.timePoints=[{...deadline,relatedTaskTempIds:[b.tempId]}];b.timePointTempIds=[deadline.tempId]
  const after=recoverMissingDirectActions(convertDirectResult(broken,source),local(source),source)
  expect(tasks(after)).toEqual(expect.arrayContaining([{title:'2026年校园作品比赛系统报名',time:'2026-11-03T00:00'},{title:'提交院级初赛报名材料',time:'2026-11-03T12:00'},{title:'提交初赛汇报PPT',time:null}]))
 })
 it('binds one explicitly named material delivery channel only to its own section',()=>{
  const r=convertDirectResult(improveDirectFallback(local(source),source),source).result
  const material=r.standaloneTasks.find(t=>t.title==='提交院级初赛报名材料')!,registration=r.standaloneTasks.find(t=>t.title.endsWith('系统报名'))!
  expect(r.materials.some(m=>m.name==='报名材料'&&m.submissionChannel==='班长'&&m.relatedTaskTempIds.includes(material.tempId))).toBe(true)
  expect(r.materials.some(m=>m.relatedTaskTempIds.includes(registration.tempId))).toBe(false)
  const ambiguous=source.replace('提交给班长。','提交给班长。另请将报名材料提交至学生办公室。'),result=convertDirectResult(improveDirectFallback(local(ambiguous),ambiguous),ambiguous).result
  expect(result.materials.filter(m=>m.submissionChannel==='班长')).toHaveLength(0)
 })
 it('uses only one explicit event name from the title, without guessing multiple events',()=>{
  const r=convertDirectResult(improveDirectFallback(local(source),source),source).result,registration=r.standaloneTasks.find(t=>t.title.endsWith('系统报名'))!
  expect(registration.title).toBe('2026年校园作品比赛系统报名')
  expect(r.evidence.some(e=>registration.evidenceIds.includes(e.id)&&(e.quotedText||e.quote)?.includes('校园作品比赛'))).toBe(true)
  const multiple=source.replace('校园作品比赛','校园作品比赛和职业规划大赛'),result=convertDirectResult(improveDirectFallback(local(multiple),multiple),multiple).result
  expect(result.standaloneTasks.find(t=>t.title.endsWith('系统报名'))?.title).toBe('系统报名')
 })
 it('does not invent deadlines or tasks from informational numbered headings',()=>{
  const text='通知：\n1. 图书馆开放时间调整\n周末正常开放。\n2. 校园道路维护\n车辆绕行。',result=convertDirectResult(improveDirectFallback(local(text),text),text)
  expect(result.result.standaloneTasks.every(t=>t.actionVerb==='查看')).toBe(true)
  expect(result.result.timePoints.filter(p=>p.normalizedValue&&p.type.endsWith('_deadline'))).toHaveLength(0)
 })
 it('does not revive an explicitly cancelled numbered action',()=>{
  const text='通知：\n1. 系统报名｜截止：11月2日17:00\n系统报名已取消，请勿报名。\n2. 材料提交｜截止：11月3日12:00\n请提交材料。\n3. 答辩申请｜截止：11月4日12:00\n请申请答辩。',out=convertDirectResult(improveDirectFallback(local(text),text),text)
  expect(out.result.standaloneTasks.some(t=>t.title.endsWith('系统报名'))).toBe(false)
 })
 it('handles civil-day midnight including the standalone evening word',()=>{
  const options={type:'task_deadline' as const,referenceTime:'2026-10-28T08:00:00+08:00',timezone:'Asia/Shanghai'}
  expect(parseDirectSourceTime('截止：11 月 2 日 晚24：00',options).normalizedValue).toBe('2026-11-03T00:00')
  expect(parseDirectSourceTime('截止：11月2日24:30',options).normalizedValue).toBeNull()
 })
})
