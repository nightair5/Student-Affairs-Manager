import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {demoTasks} from '../data/demo'
import type {Event,Task} from '../types'
import {FlowTimeline} from './FlowTimeline'
import {sortTimeline,timelineDate,timelineGroupLabel} from '../lib/flowTimelineDates'

describe('timeline date semantics',()=>{
 it('keeps date-only plans and deadlines grouped on their actual day without a clock time',()=>{
  expect(timelineDate(['2026-11-04T09:00','2026-11-03'])).toBe('2026-11-03')
  expect(timelineGroupLabel('2026-11-03')).toContain('11月3日')
  expect(timelineGroupLabel('2026-11-03')).not.toContain('00:00')
 })
 it('orders mixed time-zone representations by the actual instant and leaves date-only slots in place',()=>{
  const items=[{id:'later',date:'2026-11-03T03:00:00Z'},{id:'day',date:'2026-11-03'},{id:'earlier',date:'2026-11-03T09:30:00+08:00'}]
  expect(sortTimeline(items).map(item=>item.id)).toEqual(['earlier','day','later'])
  expect(items[0].id).toBe('later')
 })
 it('preserves original task deadline and renders a linked event relative-time hint',()=>{
  const task:Task={...demoTasks[0],id:'t',title:'参加说明会',status:'待开始',deadline:'2026-11-05',plannedStart:'2026-11-03',directDate:undefined,materials:[],dependencies:[],sourceIds:[],history:[],description:''}
  const event:Event={id:'e',title:'说明会',description:'',startAt:null,endAt:null,evidenceIds:[],needsConfirmation:true,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[task]} events={[]} deferred={[]} linked={{t:event}} eventTimeHints={{e:'本周课后'}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  expect(html).toContain('11月3日')
  expect(html).toContain('11月5日 截止')
  expect(html).toContain('本周课后')
  expect(task.deadline).toBe('2026-11-05')
 })
 it('shows linked event facts, material quantity and a plan after the original deadline',()=>{
  const task:Task={...demoTasks[0],id:'t2',title:'参加讲座',status:'待开始',deadline:'2026-11-03T12:00',plannedStart:'2026-11-04T09:00',materials:[{id:'m',name:'报名表',done:false,quantity:2,formatRequirements:['PDF']}],dependencies:[],sourceIds:[],history:[],description:'准备材料'}
  const event:Event={id:'e2',title:'讲座',description:'主讲人：王老师\n活动内容：介绍课程安排\n参加须知：提前入场',startAt:'2026-11-03T09:00',endAt:'2026-11-03T10:00',location:'A101',evidenceIds:[],needsConfirmation:false,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[task]} events={[]} deferred={[]} linked={{t2:event}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onOpenEvent={()=>{}} onComplete={()=>{}} />)
  for(const value of ['计划晚于截止','数量：','王老师','介绍课程安排','提前入场','时长 1 小时','data-event-id="e2"','查看讲座日程'])expect(html).toContain(value)
 })

})
