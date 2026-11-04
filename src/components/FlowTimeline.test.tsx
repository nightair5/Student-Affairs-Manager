import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {demoTasks} from '../data/demo'
import type {Event,Task} from '../types'
import {FlowTimeline} from './FlowTimeline'
import {FlowTaskList} from './FlowItemList'
import {sortTimeline,timelineDate,timelineGroupLabel} from '../lib/flowTimelineDates'

describe('timeline date semantics',()=>{
 it('offers personal completion for an independent event and preserves an undated source clock',()=>{
  const event:Event={id:'e-clock',title:'线上大会',description:'原文时长：15分钟左右\n时间说明：晚上9点15分（日期待定）',startAt:null,endAt:null,evidenceIds:[],needsConfirmation:true,createdAt:'',updatedAt:''}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[]} events={[event]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onOpenEvent={()=>{}} onComplete={()=>{}} onSetEventCompletion={async()=>{}} />)
  expect(html).toContain('晚上9点15分（日期待定）')
  expect(html).toContain('15分钟左右')
  expect(html).toContain('完成线上大会')
  expect(html).not.toContain('00:00')
 })
 it('keeps completed events available for restoration without displaying them as active',()=>{
  const event:Event={id:'done',title:'已办日程',description:'',startAt:null,endAt:null,evidenceIds:[],needsConfirmation:false,createdAt:'',updatedAt:'',personalCompleted:true}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[]} events={[]} completedEvents={[event]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onOpenEvent={()=>{}} onComplete={()=>{}} onSetEventCompletion={async()=>{}} />)
  expect(html).toContain('已完成日程')
  expect(html).toContain('恢复未完成')
  expect(html).not.toContain('data-event-id="done"')
 })
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
 it('shows a distinct processing window together with the source cutoff and personal plan',()=>{
  const task:Task={...demoTasks[0],id:'w',title:'提交申请表',status:'待开始',deadline:'2026-11-12T17:00',plannedStart:'2026-11-10',sourceWindowLabel:'11月3日至11月17日',materials:[],dependencies:[],sourceIds:[],history:[],description:''}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[task]} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  expect(html).toContain('11月12日')
  expect(html).toContain('11月3日至11月17日')
  expect(html).toContain('计划')
 })
 it('shows separate choice branches and the currently selected option',()=>{
  const choice={id:'g',optionTaskIds:['electronic','paper'],selectedTaskId:'paper'}
  const base={...demoTasks[0],status:'待开始' as const,materials:[],dependencies:[],sourceIds:[],history:[],description:'',sourceChoice:choice}
  const electronic:Task={...base,id:'electronic',title:'提交电子申请',deadline:'2026-11-08T17:00'}
  const paper:Task={...base,id:'paper',title:'提交纸质申请',deadline:'2026-11-09T12:00'}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[electronic,paper]} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{electronic:['邮箱'],paper:['服务台']}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} onSelectChoice={async()=>{}} />)
  for(const value of ['以下方式任选一项完成','11月8日','11月9日','邮箱','服务台','已选择此方式','先选择此方式'])expect(html).toContain(value)
 })
 it('shows linked event facts, material quantity and a plan after the original deadline',()=>{
  const task:Task={...demoTasks[0],id:'t2',title:'参加讲座',status:'待开始',deadline:'2026-11-03T12:00',plannedStart:'2026-11-04T09:00',materials:[{id:'m',name:'报名表',done:false,quantity:2,formatRequirements:['PDF']}],dependencies:[],sourceIds:[],history:[],description:'准备材料'}
  const event:Event={id:'e2',title:'讲座',description:'主讲人：王老师\n活动内容：介绍课程安排\n参加须知：提前入场',startAt:'2026-11-03T09:00',endAt:'2026-11-03T10:00',location:'A101',evidenceIds:[],needsConfirmation:false,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[task]} events={[]} deferred={[]} linked={{t2:event}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onOpenEvent={()=>{}} onComplete={()=>{}} />)
  for(const value of ['计划晚于截止','数量：','王老师','介绍课程安排','提前入场','时长 1 小时','data-event-id="e2"','查看讲座日程'])expect(html).toContain(value)
 })
 it('shows the saved task location in the timeline, detail and task list without duplicating its note',()=>{
  const task:Task={...demoTasks[0],id:'location',title:'领取器材',status:'待开始',deadline:'',materials:[],dependencies:[],sourceIds:[],history:[],description:'地点：实践中心A室\n要求：携带学生证'}
  const timeline=renderToStaticMarkup(<FlowTimeline tasks={[task]} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  expect(timeline.match(/实践中心A室/gu)).toHaveLength(2)
  expect(timeline).toContain('携带学生证')
  expect(renderToStaticMarkup(<FlowTaskList tasks={[task]} onOpen={()=>{}} onComplete={()=>{}} />)).toContain('地点：实践中心A室')
 })

})
