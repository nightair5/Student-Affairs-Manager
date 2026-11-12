import {describe,expect,it} from 'vitest'
import {extractSourceNoticeContext} from './noticeExcerpts'

describe('notice excerpts stay source-labelled and scoped',()=>{
 it('keeps group headings, counts, duties, conditions and pending benefits verbatim',()=>{
  const source='【校园服务日】\n📅 活动时间：12月3日\n📍 活动地点：东楼\n\n🔗 接待组（若干人）：\n联系来宾，确认行程。\n\n🖥️ 技术组：\n放映（2人）｜负责投影。\n声光（2人）｜负责灯光。\n\n🎟️ 现场组：\n引导（4人）｜安排入场。\n\n🎤 舞台组·主持助理（1人）：\n准备主持稿。\n\n🎁 福利：\n服务时长待定。\n\n报名方式：填写登记表。'
  const context=extractSourceNoticeContext(source,'task')
  const roles=context.sections.filter(section=>section.kind==='roles')
  expect(roles).toHaveLength(4)
  expect(roles.map(role=>role.text).join('\n')).toContain('放映（2人）｜负责投影')
  expect(roles.map(role=>role.text).join('\n')).toContain('舞台组·主持助理（1人）')
  expect(context.sections.some(section=>section.kind==='notice'&&section.text.includes('时长待定'))).toBe(true)
  expect(context.sections.some(section=>section.kind==='notice'&&section.text.includes('填写登记表'))).toBe(true)
  for(const section of context.sections)expect(source).toContain(section.text)
 })
 it('keeps a useful original activity paragraph and the original range separately',()=>{
  const source='【校园开放日】\n【活动时间】12月4日14:00-16:00\n【活动地点】东楼\n\n本次活动将介绍公共服务、研究方向与职业机会，并邀请多家机构参与交流，现场还设有咨询展区。'
  const context=extractSourceNoticeContext(source,'event','参加须知：欢迎参加',true)
  expect(context.sections.some(section=>section.kind==='overview'&&section.text.includes('职业机会'))).toBe(true)
  expect(context.sections.some(section=>section.kind==='time'&&section.text.includes('14:00-16:00'))).toBe(true)
  expect(extractSourceNoticeContext(source,'event','',false).sections.some(section=>section.kind==='time')).toBe(false)
  expect(extractSourceNoticeContext(source+'\n会议改期，另行通知。','event','',true).sections.some(section=>section.kind==='time')).toBe(false)
 })
 it('does not silently take linked web content as part of the pasted event',()=>{
  const source='【校园活动】\n活动时间：12月4日14:00-16:00\n\n【网页正文 1：来源】\n这是另一页中的描述，不能自动认为属于本次活动。'
  const context=extractSourceNoticeContext(source,'event')
  expect(context.sections.some(section=>section.text.includes('另一页'))).toBe(false)
  expect(context.omitted).toBe(true)
  expect(context.sourceText).toBe(source)
 })
 it('does not repeat a source passage already present in the saved description',()=>{
  const source='岗位分工：\n讲解组（3人）：介绍展品。\n秩序组（2人）：引导参观。'
  expect(extractSourceNoticeContext(source,'task',source).sections).toHaveLength(0)
 })
})
