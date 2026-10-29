import {describe,expect,it} from 'vitest'
import {retainLocalEventDetails} from './localEventDetails'
import type {RecognitionResult} from './types'

const result=()=>({events:[{tempId:'event',description:'校园讲座',evidenceIds:[]}],evidence:[]}) as unknown as RecognitionResult
describe('local event details',()=>{
 it('keeps named speaker, role, content and participation notes with source offsets',()=>{
  const source='校园讲座\n活动内容简介：\n活动围绕数字传播展开，讲解实务方法。\n主讲嘉宾：林老师\n校园报副主任，高级记者\n参与活动算一次集活或劳动学时。\n参与人数：37人\n有意向同学请扫描二维码入群。'
  const r=retainLocalEventDetails(result(),source),description=r.events[0].description
  expect(description).toContain('主讲人：林老师')
  expect(description).toContain('主讲人：校园报副主任，高级记者')
  expect(description).toContain('活动内容：活动围绕数字传播展开，讲解实务方法。')
  expect(description).toContain('参加须知：参与人数：37人')
  expect(description).toContain('参加须知：有意向同学请扫描二维码入群。')
  for(const e of r.evidence)expect(source.slice(e.textStart!,e.textEnd!)).toBe(e.quote)
 })
 it('does not borrow a speaker across separate events',()=>{
  const r=result();r.events.push({...r.events[0],tempId:'other'})
  expect(retainLocalEventDetails(r,'活动一。主讲人：林老师。活动二。主讲人：周老师。').events[0].description).toBe('校园讲座')
 })
 it('ends a biography at a new section and keeps later content and attendance notes',()=>{
  const source='【社区数据讲座】\n主讲人：赵老师\n个人简介：\n赵老师曾在2019年参加社区调查。曾开展多年研究。\n活动内容简介：现场讲解数据的记录方法。\n注意事项：请携带笔记本。提前十分钟入场。\n\n参与活动算一次集活。'
  const record=retainLocalEventDetails(result(),source),description=record.events[0].description
  expect(description).toContain('嘉宾简介：赵老师曾在2019年参加社区调查。')
  expect(description).toContain('活动内容：现场讲解数据的记录方法。')
  expect(description).toContain('参加须知：请携带笔记本。')
  expect(description).toContain('参加须知：提前十分钟入场。')
  expect(description).toContain('参加须知：参与活动算一次集活。')
  expect(description).not.toContain('嘉宾简介：活动内容')
  expect(description).not.toContain('嘉宾简介：注意事项')
  expect(record.events).toHaveLength(1)
  expect(record).not.toHaveProperty('standaloneTasks')
  expect(record).not.toHaveProperty('timePoints')
 })
 it('ends a biography at a new paragraph even without a heading',()=>{
  const source='个人简介：林老师曾获2020年教学奖。\n\n参加活动可获一次劳动学时。'
  const description=retainLocalEventDetails(result(),source).events[0].description
  expect(description).toContain('嘉宾简介：林老师曾获2020年教学奖。')
  expect(description).toContain('参加须知：参加活动可获一次劳动学时。')
 })
 it('does not duplicate a markdown title as event content',()=>{
  const source='【校园环境讲座】\n### 校园环境讲座 | 绿色能源与未来\n主讲人：林老师\n讲座将介绍能源转型方法。'
  const r=result();r.events[0].title='校园环境讲座'
  const description=retainLocalEventDetails(r,source).events[0].description
  expect(description).not.toContain('活动内容：###')
  expect(description).toContain('主讲人：林老师')
  expect(description).toContain('活动内容：讲座将介绍能源转型方法。')
 })
 it('separates academic host, speaker biography and registration notices from the synopsis',()=>{
  const source='讲座主题：校园艺术发展\n主讲人：高老师（研究员）\n学术主持：陈老师（教授）\n内容简介：介绍艺术史及其背景。\n主讲人简介：高老师，研究员。曾从事艺术研究。\n本次活动采取线上报名方式，名额有限，先到先得。\n校外人员需自行解决入校和入馆事宜。\n报名链接：网站地址'
  const description=retainLocalEventDetails(result(),source).events[0].description
  expect(description).toContain('主持人：陈老师（教授）')
  expect(description).toContain('活动内容：介绍艺术史及其背景。')
  expect(description).toContain('嘉宾简介：高老师，研究员。')
  expect(description).toContain('参加须知：本次活动采取线上报名方式，名额有限，先到先得。')
  expect(description).toContain('参加须知：校外人员需自行解决入校和入馆事宜。')
  expect(description).toContain('参加须知：报名链接：网站地址')
  expect(description).not.toContain('活动内容：学术主持')
  expect(description).not.toContain('活动内容：本次活动采取线上报名')
 })
})
