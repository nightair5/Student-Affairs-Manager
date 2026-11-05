import {afterEach,describe,expect,it,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {demoTasks} from '../data/demo'
import type {Event,Task} from '../types'
import {CalendarPage} from '../pages/CalendarPage'
import {FlowTimeline} from './FlowTimeline'

const noop=()=>{}
const task:Task={...demoTasks[0],id:'planned',title:'提交申请表',status:'待开始',plannedStart:'2026-11-06',directDate:undefined,deadline:'2026-11-07T17:00:00+08:00',materials:[],dependencies:[],dependencyIds:[],sourceIds:['source'],history:[],description:''}
const event:Event={id:'overnight',title:'夜间观察',startAt:'2026-11-05T23:30:00+08:00',endAt:'2026-11-06T00:30:00+08:00',location:'教学楼302',description:'',evidenceIds:[],needsConfirmation:false,createdAt:'',updatedAt:''}

describe('calendar and workflow presentation',()=>{
  afterEach(()=>vi.useRealTimers())
  it('shows both date roles in upcoming and the overnight event as ongoing',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-06T00:15:00+08:00'))
    const html=renderToStaticMarkup(<CalendarPage directMode tasks={[task]} events={[event]} courseBlocks={[]} onOpenTask={noop} onOpenEvent={noop} onCompleteTask={noop} onAddCourseBlock={noop} onRemoveCourseBlock={noop}/>)
    for(const value of ['个人计划','原文截止','11月7日','17:00','夜间观察','进行中','教学楼302'])expect(html).toContain(value)
    expect(html.match(/data-task-id="planned"/gu)).toHaveLength(2)
  })
  it('keeps a stable group while the next unfinished step supplies its title and deadline',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-06T00:15:00+08:00'))
    const first:Task={...task,id:'form',title:'填写报名表',status:'已完成',plannedStart:undefined,deadline:'2026-11-05T17:00'}
    const second:Task={...task,id:'resume',title:'提交个人简历',plannedStart:undefined,dependencyIds:['form']}
    const html=renderToStaticMarkup(<FlowTimeline tasks={[second]} allTasks={[first,second]} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={noop} onComplete={noop}/>)
    const row=html.match(/<button[^>]*class="flow-timeline-choice[\s\S]*?<\/button>/u)?.[0]??''
    for(const value of ['下一步 · 提交个人简历','11月7日','17:00','已完成 1/2'])expect(row).toContain(value)
    expect(html).toContain('data-workflow-step-id="form"')
    expect(html).toContain('data-workflow-step-id="resume"')
  })
  it('groups an ongoing overnight event under the current day and shows its actual interval',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-06T00:15:00+08:00'))
    const html=renderToStaticMarkup(<FlowTimeline tasks={[]} events={[event]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={noop} onComplete={noop}/>)
    for(const value of ['11月6日','23:30','00:30','教学楼302','进行中'])expect(html).toContain(value)
  })
})
