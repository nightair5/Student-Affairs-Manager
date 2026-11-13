import {describe,expect,it} from 'vitest'
import {buildLocalRecognition,postProcessRecognition} from './pipeline'
import {validateRecognitionResult} from './schema'
import {extractSourceNoticeContext} from '../lib/noticeExcerpts'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'

const recognize=(content:string)=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content,referenceTime:new Date('2026-11-13T08:00:00+08:00'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
const tasks=(r:ReturnType<typeof recognize>)=>[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]

describe('local semantic sections',()=>{
 it('keeps a headed role list as source context rather than independent duties',()=>{
  const source='招募志愿者\n一、招募条件\n1.在校学生。\n2.工作细致认真。\n3.熟悉设备操作。\n二、岗位要求\n技术组：\n1.具有文字能力。\n2.能使用办公软件。\n三、报名安排\n请于11月15日12:00前填写报名表。'
  const result=recognize(source)
  expect(validateRecognitionResult(result,{sourceContent:source}).valid).toBe(true)
  expect(tasks(result).some(t=>/填写.*报名表/u.test(t.title))).toBe(true)
  expect(tasks(result).some(t=>/细致认真|熟悉设备|文字能力|办公软件/u.test(t.title))).toBe(false)
  const visible=extractSourceNoticeContext(source,'task')
  expect(visible.sections.map(s=>s.text).join('\n')).toContain('工作细致认真')
  expect(visible.sections.map(s=>s.text).join('\n')).toContain('技术组')
 })
 it('does not treat a numbered list of actionable deliveries as a qualifications list',()=>{
  const source='一、提交安排\n1.请于11月15日前提交报名表。\n2.请于11月16日前上传照片。'
  const result=recognize(source)
  expect(tasks(result).some(t=>/提交.*报名表/u.test(t.title))).toBe(true)
  expect(tasks(result).some(t=>/上传.*照片/u.test(t.title))).toBe(true)
  expect(validateRecognitionResult(result,{sourceContent:source}).valid).toBe(true)
 })
 it('does not change action semantics when a notice has more than twenty candidates',()=>{
  const source=Array.from({length:25},(_,i)=>`${i+1}.请于11月${String(i+1).padStart(2,'0')}日前提交第${i+1}份材料。`).join('\n')+'\n附表仅供参考，请知悉。'
  const result=recognize(source)
  expect(result.sourceSummary.requiresAction).toBe(true)
  expect(tasks(result).length).toBeGreaterThan(0)
  expect(validateRecognitionResult(result,{sourceContent:source}).valid).toBe(true)
  expect(result.quality.needsHumanReview).toBe(true)
 })
 it('keeps independent evidence and material owners when a long list is bounded',()=>{
  const source=Array.from({length:25},(_,i)=>`${i+1}.请于11月${String(i+1).padStart(2,'0')}日前提交申请表。`).join('\n')
  const result=recognize(source)
  expect(validateRecognitionResult(result,{sourceContent:source}).valid).toBe(true)
  expect(tasks(result)).toHaveLength(20)
  expect(result.materials).toHaveLength(20)
  expect(result.materials.every(material=>material.relatedTaskTempIds.length===1&&material.evidenceIds.length<=20)).toBe(true)
  expect(result.quality.reviewReasons.join('\n')).toContain('尚未完整整理')
 })
 it('does not merge similarly named materials when their quantities or conditions differ',()=>{
  const source='请提交申请表。'
  const result=recognize(source)
  const original=result.materials[0]
  expect(original).toBeDefined()
  result.materials=[{...original,tempId:'first',name:'申请表',quantity:1},{...original,tempId:'second',name:'申请表',quantity:2}]
  expect(postProcessRecognition(result,source).materials.map(material=>material.quantity)).toEqual([1,2])
 })
 it('keeps a supplementary signing requirement without transferring a neighbouring PPT format',()=>{
  const source='请于8月10日18:00前完成报名并提交报名表；8月15日12:00前上传作品文件和作品链接；8月20日下午3点参加答辩，答辩前准备5分钟PPT。报名表需要盖章。'
  const materials=recognize(source).materials.filter(material=>material.name==='报名表')
  expect(materials).toHaveLength(1)
  expect(materials[0].formatRequirements).not.toContain('PPT')
  expect(materials[0].requirements).toContain('报名表需要盖章')
 })
 it('marks shared material requirements partial when their owners are not all mapped',()=>{
  const source='请于12月10日前提交申请表，申请表和课程报告均须签名。'
  const result=recognize(source)
  expect(result.quality.reviewReasons.join('\n')).toContain('共同材料与要求')
  expect(result.quality.needsHumanReview).toBe(true)
 })
 it('retains a clearly attributed later review as context of the one preceding submission',()=>{
  const source='课程作品通知：请在11月20日前提交作品，作品应为本人原创。11月21日至23日由教师评审，结果另行公布。'
  const result=recognize(source),items=tasks(result)
  expect(validateRecognitionResult(result,{sourceContent:source}).valid).toBe(true)
  expect(items).toHaveLength(1)
  expect(items[0].title).toContain('提交作品')
  expect(items[0].description).toContain('由教师评审')
  expect(items[0].evidenceIds.length).toBeGreaterThan(1)
  expect(result.events).toHaveLength(0)
  const direct=convertDirectResult(improveDirectFallback(result,source),source).result
  expect(tasks(direct)).toHaveLength(1)
  expect(tasks(direct)[0].description).toContain('由教师评审')
  expect(direct.events).toHaveLength(0)
 })
 it('does not hide a conditional invitation for the user to participate',()=>{
  const source='请在11月20日前提交作品。入围同学请于11月25日14:00参加现场答辩。'
  const result=recognize(source)
  expect(tasks(result).some(task=>task.title.includes('提交作品'))).toBe(true)
  expect(result.events.some(event=>event.title.includes('答辩'))).toBe(true)
 })
 it('marks a source-explicit eligibility condition without turning the organiser review into an event',()=>{
  const source='取得资格后，请于12月2日9:00参加评审委员会的学生答辩；其余作品由主办方在12月3日评审。'
  const direct=convertDirectResult(improveDirectFallback(recognize(source),source),source)
  const event=direct.result.events.find(item=>item.title.includes('答辩'))
  expect(event).toBeDefined()
  expect(direct.items.find(item=>item.tempId===event!.tempId)?.tags).toContain('如符合条件')
  expect(direct.result.events.some(item=>item.title.includes('主办方'))).toBe(false)
  const context=extractSourceNoticeContext(source,'event',event!.description)
  expect(context.sections.some(section=>section.kind==='process'&&section.text.includes('主办方在12月3日评审'))).toBe(true)
 })
 it('keeps the recipient handoff as context through direct conversion',()=>{
  const source='申请补助：请于11月16日前交申请表给组长，组长11月18日统一上报学院。'
  const direct=convertDirectResult(improveDirectFallback(recognize(source),source),source).result
  expect(validateRecognitionResult(direct,{sourceContent:source}).valid).toBe(true)
  const all=tasks(direct)
  expect(all).toHaveLength(1)
  expect(all[0].description).toContain('组长11月18日统一上报学院')
  expect(direct.timePoints.some(point=>point.normalizedValue==='2026-11-16'&&point.type==='task_deadline')).toBe(true)
  expect(direct.timePoints.some(point=>point.normalizedValue?.startsWith('2026-11-18'))).toBe(false)
 })
 it('keeps an earlier-mentioned dated review with the cited applicant, not on the personal calendar',()=>{
  const source='学院12月1日至3日审核申请，随后通知申请人。请申请人于11月28日前递交证明。'
  const direct=convertDirectResult(improveDirectFallback(recognize(source),source),source).result
  expect(tasks(direct)).toHaveLength(1)
  expect(tasks(direct)[0].title).toContain('递交证明')
  expect(tasks(direct)[0].description).toContain('学院12月1日至3日审核申请')
  expect(direct.events).toHaveLength(0)
  expect(direct.timePoints.some(point=>point.normalizedValue==='2026-11-28'&&point.type==='task_deadline')).toBe(true)
  expect(validateRecognitionResult(direct,{sourceContent:source}).valid).toBe(true)
 })
})
