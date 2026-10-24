import {describe,it,expect} from 'vitest'
import {localMeetingBlock,localNamedMeeting} from './localMeetingBlock'
import {buildLocalRecognition} from './pipeline'
import {assembleProductFirstSuggestion} from './materialChannelGrounding'
import {bindOrdinaryProviderSupport} from './ordinaryProviderSupport'
const referenceTime='2026-10-24T10:00:00+08:00',timezone='Asia/Shanghai'
const local=(text:string)=>buildLocalRecognition({content:text,sourceType:'text',sourceTitle:'匿名会议',referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
describe('labelled meeting blocks preserve source-owned endpoints',()=>{
 it('does not require a project decision just because a pasted simple notice has no source title',()=>{
  const text='请于10月30日17:00前将课程论文提交至学习通。'
  const r=buildLocalRecognition({content:text,sourceType:'text',sourceTitle:'',referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
  expect(r.projectMatch.decision).toBe('standalone_task');expect(r.projectSuggestion).toBeNull();expect(r.standaloneTasks).toHaveLength(1)
  const project=buildLocalRecognition({content:'项目第一阶段请提交设计稿，第二阶段完成作品。',sourceType:'text',sourceTitle:'',referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
  expect(project.projectMatch.decision).not.toBe('standalone_task')
 })
 it('uses a unique literal meeting name instead of a bare attendance verb, without merging meetings',()=>{
  expect(localNamedMeeting('晚上9点15分，我们开15分钟左右的年级线上大会，请所有同学线上参加。')).toBe('年级线上大会')
  expect(localNamedMeeting('举行课程说明会，随后召开项目讨论会。')).toBeNull()
  expect(localNamedMeeting('取消召开课程说明会。')).toBeNull()
  expect(localNamedMeeting('请参加会议。')).toBeNull()
 })
 it('keeps the title, both literal clock endpoints and location through the ordinary first screen',()=>{
  const text='邀请你参加会议\n会议主题：课程答疑\n会议时间：2026/11/06 19:10-20:20\n会议地点：A101',r=local(text),context={sourceId:'s',sourceVersionId:'sv',sourceText:text,referenceTime,timezone}
  const bound=bindOrdinaryProviderSupport(r,context,JSON.stringify({result:r}))
  const first=assembleProductFirstSuggestion(bound.result,context).result
  expect(first.events).toHaveLength(1);expect(first.events[0].title).toBe('课程答疑');expect(first.events[0].location).toBe('A101')
  expect(first.timePoints.find(p=>p.tempId===first.events[0].startTimePointTempId)?.normalizedValue).toBe('2026-11-06T19:10')
  expect(first.timePoints.find(p=>p.tempId===first.events[0].endTimePointTempId)?.normalizedValue).toBe('2026-11-06T20:20')
  expect(first.events[0].selected).toBe(false)
 })
 it('never assigns one meeting name to another meeting time',()=>{
  const text='会议主题：课程答疑\n会议时间：2026/11/06 19:10-20:20\n\n会议主题：项目讨论\n会议时间：2026/11/07 10:00-11:00'
  expect(localMeetingBlock(text,'会议时间：2026/11/07 10:00-11:00')?.title).toBe('项目讨论')
  expect(localMeetingBlock(text,'会议时间：2026/11/08 10:00-11:00')).toBeNull()
 })
 it('does not bridge unrelated paragraphs or canceled/tentative metadata',()=>{
  expect(localMeetingBlock('会议主题：课程答疑\n另一活动说明\n会议时间：2026/11/06 19:10-20:20','会议时间：2026/11/06 19:10-20:20')).toBeNull()
  expect(localMeetingBlock('会议主题：取消课程答疑\n会议时间：2026/11/06 19:10-20:20','会议时间：2026/11/06 19:10-20:20')).toBeNull()
  for(const prefix of ['本次会议取消。','仅限已录取的同学。','若已报名，请参加。','原定会议延期。'])expect(localMeetingBlock(prefix+'\n会议主题：课程答疑\n会议时间：2026/11/06 19:10-20:20','会议时间：2026/11/06 19:10-20:20')).toBeNull()
 })
 it('keeps one-day precision and does not manufacture a meeting place',()=>{
  const r=local('会议主题：课程交流会\n会议时间：2026/11/06')
  expect(r.events[0].location).toBeNull();expect(r.timePoints[0].precision).toBe('date_only');expect(r.timePoints[0].normalizedValue).toBe('2026-11-06')
 })
})
