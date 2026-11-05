import {describe,expect,it} from 'vitest'
import {demoTasks} from '../data/demo'
import type {Event,Task} from '../types'
import {buildUpcomingCalendarItems,eventCalendarDays,eventTimingState,groupEventsByDate,groupTasksByDate,taskCalendarEntryForDay} from './calendar'
import {homeFlow} from './homeFlow'
import {isEventInNextThreeDays} from './upcomingEvent'

const task:Task={...demoTasks[0],id:'planned',title:'提交申请表',status:'待开始',plannedStart:'2026-11-06',directDate:undefined,deadline:'2026-11-07T17:00:00+08:00',materials:[],dependencies:[],sourceIds:[],history:[],description:''}
const overnight:Event={id:'overnight',title:'夜间观察',startAt:'2026-11-05T23:30:00+08:00',endAt:'2026-11-06T00:30:00+08:00',location:'教学楼302',description:'',evidenceIds:[],needsConfirmation:false,createdAt:'',updatedAt:''}

describe('calendar roles and event intervals',()=>{
  it('retains one task on each of its plan and source deadline days',()=>{
    const grouped=groupTasksByDate([task])
    expect(grouped.get('2026-11-06')).toEqual([task])
    expect(grouped.get('2026-11-07')).toEqual([task])
    expect(taskCalendarEntryForDay(task,'2026-11-06')?.role).toBe('plan')
    expect(taskCalendarEntryForDay(task,'2026-11-07')?.role).toBe('deadline')
    const upcoming=buildUpcomingCalendarItems([task],[],new Date('2026-11-07T10:00:00+08:00'))
    expect(upcoming).toMatchObject([{id:'planned',at:'2026-11-07T17:00:00+08:00',timeRole:'deadline'}])
  })
  it('counts same-day plan and deadline once and keeps the later deadline after the plan',()=>{
    const same={...task,plannedStart:'2026-11-07T10:00',deadline:'2026-11-07T17:00'}
    expect(groupTasksByDate([same]).get('2026-11-07')).toHaveLength(1)
    expect(taskCalendarEntryForDay(same,'2026-11-07')?.role).toBe('both')
    expect(buildUpcomingCalendarItems([same],[],new Date('2026-11-07T12:00+08:00'))).toMatchObject([{at:'2026-11-07T17:00',timeRole:'deadline'}])
  })
  it('retains the deadline when a plan is later or removed and hides completed tasks from upcoming',()=>{
    const later={...task,plannedStart:'2026-11-08'}
    expect([...groupTasksByDate([later]).keys()].sort()).toEqual(['2026-11-07','2026-11-08'])
    expect([...groupTasksByDate([{...task,plannedStart:undefined}]).keys()]).toEqual(['2026-11-07'])
    expect(buildUpcomingCalendarItems([{...task,status:'已完成'}],[],new Date('2026-11-06T10:00+08:00'))).toEqual([])
  })
  it('places an ongoing overnight event in both days without inventing another event',()=>{
    const now=new Date('2026-11-06T00:15:00+08:00')
    expect(eventCalendarDays(overnight)).toEqual(['2026-11-05','2026-11-06'])
    expect(groupEventsByDate([overnight]).get('2026-11-06')).toEqual([overnight])
    expect(eventTimingState(overnight,now)).toBe('ongoing')
    expect(isEventInNextThreeDays(overnight,now)).toBe(true)
    expect(homeFlow([],[overnight],now).todayEvents).toEqual([overnight])
    expect(buildUpcomingCalendarItems([],[overnight],now).map(item=>item.id)).toEqual(['overnight'])
  })
  it('treats an exact midnight end as exclusive and never marks an ended event as ongoing',()=>{
    const ending={...overnight,endAt:'2026-11-06T00:00:00+08:00'}
    expect(eventCalendarDays(ending)).toEqual(['2026-11-05'])
    expect(eventTimingState(ending,new Date('2026-11-06T00:00:00+08:00'))).toBe('ended')
    expect(isEventInNextThreeDays(ending,new Date('2026-11-06T00:00:00+08:00'))).toBe(false)
    expect(homeFlow([],[ending],new Date('2026-11-06T00:00:00+08:00')).todayEvents).toEqual([])
  })
  it('keeps date-only events visible throughout the day without creating a clock time',()=>{
    const event={...overnight,startAt:'2026-11-06',endAt:null}
    const now=new Date('2026-11-06T15:30:00+08:00')
    expect(buildUpcomingCalendarItems([],[event],now)).toMatchObject([{at:'2026-11-06'}])
    expect(eventCalendarDays(event)).toEqual(['2026-11-06'])
    expect(isEventInNextThreeDays(event,now)).toBe(true)
  })
  it('treats a date-only end as a day, without inventing a midnight end or precise ongoing status',()=>{
    const event={...overnight,endAt:'2026-11-06'}
    const now=new Date('2026-11-06T15:30:00+08:00')
    expect(eventCalendarDays(event)).toEqual(['2026-11-05','2026-11-06'])
    expect(buildUpcomingCalendarItems([],[event],now).map(item=>item.id)).toEqual(['overnight'])
    expect(eventTimingState(event,now)).toBe('upcoming')
  })
  it('uses the workspace timezone for offset-bearing instants',()=>{
    const event={...overnight,startAt:'2026-11-06T01:00:00Z',endAt:'2026-11-06T02:00:00Z'}
    expect(eventCalendarDays(event,'America/Los_Angeles')).toEqual(['2026-11-05'])
    expect(eventCalendarDays(event,'Asia/Shanghai')).toEqual(['2026-11-06'])
  })
  it('counts upcoming natural days in the workspace timezone across daylight-saving changes',()=>{
    const now=new Date('2026-03-08T07:30:00Z') // March 7 in Los Angeles
    const outside={...overnight,id:'outside',startAt:'2026-03-15T12:00:00-07:00',endAt:'2026-03-15T13:00:00-07:00'}
    const inside={...overnight,id:'inside',startAt:'2026-03-14T12:00:00-07:00',endAt:'2026-03-14T13:00:00-07:00'}
    expect(homeFlow([],[outside,inside],now,{},'America/Los_Angeles').events.map(event=>event.id)).toEqual(['inside'])
  })
})
