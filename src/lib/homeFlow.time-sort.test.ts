import { describe, expect, it } from 'vitest'
import { demoTasks } from '../data/demo'
import type { Task } from '../types'
import { homeFlow } from './homeFlow'

const now=new Date('2026-10-28T10:00:00+08:00')
const task=(id:string,patch:Partial<Task>):Task=>({
  ...demoTasks[0],id,title:id,status:'待开始',deadline:'',materials:[],dependencies:[],
  dependencyIds:[],riskFlags:[],sourceIds:[],history:[],createdAt:'2026-10-01T00:00:00Z',
  estimatedMinutes:30,priority:'中',...patch,
})

describe('upcoming tasks with the same calendar date',()=>{
  it('orders definite clock times chronologically even when later work has higher priority',()=>{
    const later=task('noon',{deadline:'2026-11-03T12:00',priority:'高'})
    const midnight=task('midnight',{deadline:'2026-11-03T00:00',priority:'低'})
    const nextDay=task('following-day',{deadline:'2026-11-04T00:00',priority:'高'})
    expect(homeFlow([later,nextDay,midnight],[],now).next.map(item=>item.id)).toEqual(['midnight','noon','following-day'])
    expect(midnight.deadline).toBe('2026-11-03T00:00')
  })
  it('keeps date-only tasks in their priority slot and never invents a midnight',()=>{
    const noClock=task('date-only',{deadline:'2026-11-03',priority:'高'})
    const morning=task('morning',{deadline:'2026-11-03T09:00',priority:'低'})
    const evening=task('evening',{deadline:'2026-11-03T18:00',priority:'中'})
    const original=[evening,noClock,morning]
    const before=JSON.stringify(original)
    const ids=homeFlow(original,[],now).next.map(item=>item.id)
    expect(ids.indexOf('date-only')).toBe(0)
    expect(ids.indexOf('morning')).toBeLessThan(ids.indexOf('evening'))
    expect(JSON.stringify(original)).toBe(before)
  })
  it('uses the earliest relevant personal plan without replacing the source deadline',()=>{
    const planned=task('planned',{plannedStart:'2026-11-03T08:00',deadline:'2026-11-05T12:00'})
    const due=task('due',{deadline:'2026-11-03T10:00',priority:'高'})
    expect(homeFlow([due,planned],[],now).next.map(item=>item.id)).toEqual(['planned','due'])
    expect(planned.deadline).toBe('2026-11-05T12:00')
  })
  it('retains priority and deterministic order for equal precise times',()=>{
    const low=task('low',{deadline:'2026-11-03T12:00',priority:'低'})
    const high=task('high',{deadline:'2026-11-03T12:00',priority:'高'})
    expect(homeFlow([low,high],[],now).next.map(item=>item.id)).toEqual(['high','low'])
  })
})
