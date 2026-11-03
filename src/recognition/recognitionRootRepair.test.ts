import {describe,it,expect} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'
import {cleanDirectTopic} from './directRetention'
import {taskPublicDescription,taskPublicSummary} from '../lib/taskContentPresentation'

const source='【关于提交课程成果证明的通知】\n各位同学好！\n1️⃣\u00a0提交范围：已完成课程的学习小组。\n2️⃣\u00a0材料要求：请填写《课程成果证明》，名单严格按贡献排序；文件名修改为“课程号+小组名+成果证明”。\n3️⃣ 邮件标注要求：邮件正文注明顺序已经讨论且无异议。\n4️⃣提交方式：请在11月7日23：59分前将Word版及PDF版课程成果证明一同提交至课程邮箱\u00a0proof@example.edu'
const recognize=(text:string)=>{const r=buildLocalRecognition({content:text,sourceTitle:'手动粘贴消息',sourceType:'text',referenceTime:new Date('2026-11-01T04:00:00Z'),timezone:'Asia/Shanghai',projects:[]});return convertDirectResult(improveDirectFallback(r,text),text).result}
describe('root repair direct boundary',()=>{
 it('keeps delivery, exact deadline, channel and requirements in local fallback',()=>{
  const r=recognize(source),t=r.standaloneTasks.find(t=>t.actionObject==='课程成果证明')!
  expect(t).toBeDefined();expect(r.events).toHaveLength(0)
  expect(r.standaloneTasks.some(t=>['查看：好','提交工作','）'].includes(t.title))).toBe(false)
  expect(r.timePoints.some(p=>p.relatedTaskTempIds.includes(t.tempId)&&p.normalizedValue==='2026-11-07T23:59')).toBe(true)
  expect(r.materials.find(m=>m.relatedTaskTempIds.includes(t.tempId))?.formatRequirements).toEqual(['Word','PDF'])
  expect(t.description).toContain('严格按贡献排序');expect(t.description).toContain('顺序已经讨论且无异议')
 })
 it('does not depend on NBSP or emoji numbering for the required facts',()=>{
  for(const text of [source,source.replaceAll('\u00a0',' '),source.replace(/([1-4])[\uFE0F\u20E3]+/gu,'$1.'),source.replace(/[1-4][\uFE0F\u20E3]+\s*/gu,'')]){
   const r=recognize(text);expect(r.timePoints.some(p=>p.normalizedValue==='2026-11-07T23:59')).toBe(true);expect(r.materials.some(m=>m.name==='课程成果证明')).toBe(true)
  }
 })
 it('preserves a bracketed subject rather than reducing a greeting to a topic',()=>{
  expect(cleanDirectTopic('【关于开具课程成果证明的通知】')).toBe('开具课程成果证明')
  const r=recognize('【图书馆阅览区调整通知】\n各位同学好！新阅览区已开放，本通知仅供知悉，无需操作。')
  expect(r.standaloneTasks[0].title).toContain('图书馆阅览区调整');expect(r.standaloneTasks[0].title).not.toBe('查看：好')
 })
 it('shared product notes keep useful source text and remove only technical boilerplate',()=>{
  expect(taskPublicDescription({history:[],description:'按直达规则保留的阅读待办\n完整通知主题：开放时间调整\n材料要求：Word和PDF均须提交'})).toBe('开放时间调整\n材料要求：Word和PDF均须提交')
  expect(taskPublicDescription({history:[{field:'备注'} as never],description:'我自己的备注'})).toBe('我自己的备注')
 })
 it('only removes exact material and channel repetitions from the read-only summary',()=>{
  const task={history:[],description:'提交渠道：课程平台\n要求：不超过4页\n要求：包含研究方法\n办理时段：11月12日至14日',materials:[{requirements:['不超过4页'],formatRequirements:['PDF']}] } as unknown as Parameters<typeof taskPublicSummary>[0]
  const display=taskPublicSummary(task,{channels:['课程平台'],dateLabel:'办理时段：11月12日至14日'})
  expect(display.description).toBe('要求：包含研究方法')
  const edited={...task,history:[{field:'备注'} as never]}
  expect(taskPublicSummary(edited,{channels:['课程平台']}).description).toContain('提交渠道：课程平台')
 })
 it('keeps the positions of repeated clauses rather than guessing their first occurrence',()=>{
  const text='11月7日17:00前提交报告。\n11月7日17:00前提交报告。'
  const r=buildLocalRecognition({content:text,sourceType:'text',sourceTitle:'匿名通知',referenceTime:new Date('2026-11-01T04:00:00Z'),timezone:'Asia/Shanghai',projects:[]})
  const evidence=r.evidence.filter(e=>e.quote?.includes('提交报告'))
  expect(evidence.length).toBeGreaterThan(1);expect(new Set(evidence.map(e=>e.textStart)).size).toBe(evidence.length)
  for(const e of evidence)expect(text.slice(e.textStart,e.textEnd)).toBe(e.quote)
 })
})
