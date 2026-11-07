import {afterEach,describe,expect,it,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {demoTasks} from '../data/demo'
import type {Event,Task} from '../types'
import {FlowTimeline} from './FlowTimeline'
import {FlowTaskList} from './FlowItemList'
import {sortTimeline,timelineDate,timelineGroupLabel} from '../lib/flowTimelineDates'

describe('timeline date semantics',()=>{
 afterEach(()=>vi.useRealTimers())
 it('groups same-day events in one timeline entry but keeps each event and action independent',()=>{
  const first:Event={id:'day-a',title:'上午分享',description:'参加须知：提前入场',startAt:'2026-11-26T09:00',endAt:'2026-11-26T10:00',location:'北楼301',evidenceIds:[],needsConfirmation:false,createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z'}
  const second:Event={...first,id:'day-b',title:'下午咨询',startAt:'2026-11-26T14:00',endAt:'2026-11-26T15:30',location:'北楼302'}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[]} events={[second,first]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onOpenEvent={()=>{}} onComplete={()=>{}} onSetEventCompletion={async()=>{}} />)
  expect(html.match(/data-event-day=/gu)).toHaveLength(1)
  for(const value of ['当天 2 项日程','上午分享','下午咨询','北楼301','北楼302','09:00','14:00','data-grouped-event-id="day-a"','data-grouped-event-id="day-b"'])expect(html).toContain(value)
  expect(html.match(/class="primary-button"/gu)).toHaveLength(2)
  expect(html.indexOf('上午分享')).toBeLessThan(html.indexOf('下午咨询'))
  expect(first.id).toBe('day-a');expect(second.id).toBe('day-b')
 })
 it('keeps distinct days and unknown dates separate',()=>{
  const base:Event={id:'one',title:'讲座',description:'',startAt:'2026-11-26T09:00',endAt:null,location:'',evidenceIds:[],needsConfirmation:false,createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z'}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[]} events={[base,{...base,id:'two',startAt:'2026-11-27T09:00'},{...base,id:'unknown',startAt:null}]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  expect(html).not.toContain('data-event-day=')
  expect(html.match(/data-event-id=/gu)).toHaveLength(3)
 })
 it('offers personal completion for an independent event and preserves an undated source clock',()=>{
  const event:Event={id:'e-clock',title:'线上大会',description:'原文时长：15分钟左右\n时间说明：晚上9点15分（日期待定）',startAt:null,endAt:null,evidenceIds:[],needsConfirmation:true,createdAt:'',updatedAt:''}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[]} events={[event]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onOpenEvent={()=>{}} onComplete={()=>{}} onSetEventCompletion={async()=>{}} />)
  expect(html).toContain('晚上9点15分（日期待定）')
  expect(html).toContain('15分钟左右')
  expect(html).toContain('完成线上大会')
  expect(html).not.toContain('00:00')
 })
 it('highlights a nearby event with its original time and location',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-04T16:30:00Z'))
  const event:Event={id:'near',title:'课程讲座',description:'',startAt:'2026-11-06T15:00',endAt:'2026-11-06T16:30',location:'教学楼302',evidenceIds:[],needsConfirmation:false,createdAt:'',updatedAt:''}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[]} events={[event]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  for(const value of ['data-near-event="true"','3天内','15:00','16:30','教学楼302','时间','地点'])expect(html).toContain(value)
  const distant={...event,startAt:'2026-11-08T15:00',endAt:'2026-11-08T16:30'}
  expect(renderToStaticMarkup(<FlowTimeline tasks={[]} events={[distant]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)).not.toContain('data-near-event="true"')
 })
 it('marks the linked event date without mislabelling a separate task deadline',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-04T16:30:00Z'))
  const task:Task={...demoTasks[0],id:'linked',title:'准备材料',status:'待开始',deadline:'2026-11-10T17:00',plannedStart:undefined,directDate:undefined,materials:[],dependencies:[],sourceIds:[],history:[],description:''}
  const event:Event={id:'meeting',title:'说明会',description:'',startAt:'2026-11-06T15:00',endAt:null,location:'教学楼302',evidenceIds:[],needsConfirmation:false,createdAt:'',updatedAt:''}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[task]} events={[]} deferred={[]} linked={{linked:event}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  expect(html).toContain('日程：11月6日')
  expect(html).toContain('11月10日')
  expect(html).toContain('截止')
  expect(html).toContain('日程时间')
  expect(html).toContain('教学楼302')
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
 it('shows three alternatives as one choice while retaining every branch deadline',()=>{
  const ids=['upload','paper','onsite'],choice={id:'three',optionTaskIds:ids}
  const tasks=ids.map((id,index):Task=>({...demoTasks[0],id,title:['上传证明','递交纸质表','现场核验'][index],status:'待开始',deadline:`2026-11-${16+index}T17:00`,materials:[],dependencies:[],sourceIds:[],history:[],description:'',sourceChoice:choice}))
  const html=renderToStaticMarkup(<FlowTimeline tasks={tasks} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} onSelectChoice={async()=>{}} />)
  for(const value of ['以下方式任选一项完成','11月16日','11月17日','11月18日','现场核验'])expect(html).toContain(value)
  expect((html.match(/class="flow-choice-option"/g)??[]).length).toBe(3)
  expect((html.match(/class="flow-timeline-choice/g)??[]).length).toBe(1)
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
 it('presents a registration and its prerequisite-linked delivery together while keeping both channels and deadlines',()=>{
  const base={...demoTasks[0],status:'待开始' as const,materials:[],dependencies:[],sourceIds:['source'],history:[],plannedStart:undefined,directDate:undefined}
  const first:Task={...base,id:'register',title:'报名分享会',deadline:'2026-11-07T17:00',dependencyIds:[],description:'提交渠道：https://example.edu/register'}
  const second:Task={...base,id:'resume',title:'提交个人简历',deadline:'2026-11-08T12:00',dependencyIds:['register'],description:'提交渠道：https://example.edu/resume'}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[first]} allTasks={[first,second]} events={[]} deferred={[{task:second,reason:'有 1 项前置事项未完成'}]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  expect(html.match(/data-task-id=/gu)).toHaveLength(1)
  for(const value of ['2 个步骤','第 1 步','第 2 步','报名分享会','提交个人简历','11月7日','11月8日','href="https://example.edu/register"','href="https://example.edu/resume"','等待前一步完成'])expect(html).toContain(value)
  expect(first.deadline).toBe('2026-11-07T17:00')
  expect(second.dependencyIds).toEqual(['register'])
 })
 it('retains the completed first step while the second step can be completed',()=>{
  const base={...demoTasks[0],materials:[],dependencies:[],sourceIds:['source'],history:[],description:'',deadline:'',plannedStart:undefined,directDate:undefined}
  const first:Task={...base,id:'one',title:'报名',status:'已完成',dependencyIds:[]}
  const second:Task={...base,id:'two',title:'提交材料',status:'待开始',dependencyIds:['one']}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[second]} allTasks={[first,second]} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  expect(html).toContain('已完成 1/2')
  expect(html).toContain('第 1 步')
  expect(html).toContain('第 2 步')
  expect(html).toContain('完成当前步骤：提交材料')
 })
 it('shows an event once with independently dated preparation actions and their links',()=>{
  const base={...demoTasks[0],status:'待开始' as const,materials:[],dependencies:[],sourceIds:['source'],history:[],plannedStart:undefined,directDate:undefined}
  const register:Task={...base,id:'register',title:'填写报名表',deadline:'2026-11-15T12:00',description:'提交渠道：https://example.edu/register'}
  const resume:Task={...base,id:'resume',title:'提交个人简历',deadline:'2026-11-17T17:00',description:'提交渠道：https://example.edu/resume'}
  const event:Event={id:'meeting',title:'求职分享会',description:'参加须知：提前入场',startAt:'2026-11-18T14:30',endAt:null,location:'明德楼309',evidenceIds:[],needsConfirmation:false,createdAt:'',updatedAt:''}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[register,resume]} allTasks={[register,resume]} events={[event]} eventActions={{meeting:[register,resume]}} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} onSetEventCompletion={async()=>{}} />)
  expect(html.match(/data-event-id="meeting"/gu)).toHaveLength(1)
  expect(html).not.toContain('data-task-id="register"');expect(html).not.toContain('data-task-id="resume"')
  for(const value of ['需要准备 · 2 项','data-related-task-id="register"','data-related-task-id="resume"','11月15日','11月17日','11月18日','明德楼309','href="https://example.edu/register"','href="https://example.edu/resume"','参加须知'])expect(html).toContain(value)
 })
 it('retains completed preparation and offers its restoration while other steps remain',()=>{
  const base={...demoTasks[0],materials:[],dependencies:[],sourceIds:['source'],history:[],plannedStart:undefined,directDate:undefined,deadline:'',description:''}
  const first:Task={...base,id:'first',title:'报名',status:'已完成'}
  const second:Task={...base,id:'second',title:'准备简历',status:'待开始'}
  const event:Event={id:'event',title:'分享会',description:'',startAt:'2026-11-18T14:30',endAt:null,evidenceIds:[],needsConfirmation:false,createdAt:'',updatedAt:''}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[second]} allTasks={[first,second]} events={[event]} eventActions={{event:[first,second]}} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} onRestoreTask={()=>{}} />)
  expect(html).toContain('需要准备 · 1 项');expect(html).toContain('恢复未完成：报名');expect(html).toContain('完成准备简历')
 })
 it('shows source-backed goal members together without merging unrelated same-day tasks',()=>{
  const goal={id:'same-source-goal',title:'提交思想汇报',taskIds:['a','b']}
  const base={...demoTasks[0],status:'待开始' as const,materials:[],dependencies:[],sourceIds:['source'],history:[],plannedStart:undefined,directDate:undefined,deadline:'2026-11-09',description:''}
  const a:Task={...base,id:'a',title:'2023级提交第一篇',sourceGoal:goal}
  const b:Task={...base,id:'b',title:'2024级提交第二篇',sourceGoal:goal}
  const unrelated:Task={...base,id:'unrelated',title:'缴纳水电费'}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[a,b,unrelated]} allTasks={[a,b,unrelated]} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  expect(html.match(/data-goal-id=/gu)).toHaveLength(1);expect(html).toContain('提交思想汇报')
  expect(html).toContain('data-task-id="unrelated"');expect(html).not.toContain('data-task-id="a"');expect(html).not.toContain('data-task-id="b"')
  expect(html).toContain('2023级提交第一篇');expect(html).toContain('2024级提交第二篇')
 })
 it('keeps choice branches within the event as one optional preparation',()=>{
  const choice={id:'choice',optionTaskIds:['mail','paper']},base={...demoTasks[0],status:'待开始' as const,materials:[],dependencies:[],sourceIds:['source'],history:[],description:'',sourceChoice:choice}
  const mail:Task={...base,id:'mail',title:'提交电子申请',deadline:'2026-11-09T17:00'},paper:Task={...base,id:'paper',title:'提交纸质申请',deadline:'2026-11-10T12:00'}
  const event:Event={id:'event',title:'活动',description:'',startAt:'2026-11-18T14:30',endAt:null,evidenceIds:[],needsConfirmation:false,createdAt:'',updatedAt:''}
  const html=renderToStaticMarkup(<FlowTimeline tasks={[mail,paper]} allTasks={[mail,paper]} events={[event]} eventActions={{event:[mail,paper]}} deferred={[]} linked={{}} eventTimeHints={{}} channels={{mail:['邮箱'],paper:['服务台']}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} onSelectChoice={async()=>{}} />)
  for(const value of ['需要准备 · 1 项','以下方式任选一项完成','11月9日','11月10日','邮箱','服务台'])expect(html).toContain(value)
 })
 it('offers explicit linking and unlinking without removing task details',()=>{
  const task:Task={...demoTasks[0],id:'existing',title:'填写报名表',status:'待开始',materials:[],dependencies:[],sourceIds:['source'],history:[],description:'',deadline:'2026-11-10T17:00'}
  const event:Event={id:'event',title:'分享会',description:'',startAt:'2026-11-18T14:30',endAt:null,evidenceIds:[],needsConfirmation:false,createdAt:'',updatedAt:''}
  const props={tasks:[task],allTasks:[task],events:[event],deferred:[],linked:{},eventTimeHints:{},channels:{},highlightIds:['event'],onOpenTask:()=>{},onComplete:()=>{},onSetEventTaskLink:async()=>{}}
  const available=renderToStaticMarkup(<FlowTimeline {...props} eventActionCandidates={{event:[task]}} />)
  expect(available).toContain('关联同一通知的待办');expect(available).toContain('关联：填写报名表')
  const linked=renderToStaticMarkup(<FlowTimeline {...props} eventActions={{event:[task]}} />)
  expect(linked).toContain('取消关联');expect(linked).toContain('11月10日');expect(linked).toContain('完成填写报名表')
 })

})
