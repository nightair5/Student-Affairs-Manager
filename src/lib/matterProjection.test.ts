import {describe,expect,it} from 'vitest'
import {demoTasks} from '../data/demo'
import type {Task} from '../types'
import {groupMatterAgenda,matterDaySummaryTasks,projectMatterGroups} from './matterProjection'
import type {CalendarTimelineItem} from './calendar'

const goal={id:'batch-a:goal',title:'办理课程材料',taskIds:['a','b']}
const base={...demoTasks[0],status:'待开始' as const,sourceGoal:goal,sourceIds:['source-a'],riskFlags:[],materials:[],dependencies:[],history:[]}
const a:Task={...base,id:'a',title:'填写登记',deadline:'2026-11-13T17:00'}
const b:Task={...base,id:'b',title:'提交证明',deadline:'2026-11-14T12:00'}
const other:Task={...base,id:'c',title:'缴纳宿舍电费',sourceGoal:undefined,deadline:'2026-11-13T17:00'}
const item=(task:Task,at:string,role:'deadline'|'plan'='deadline'):CalendarTimelineItem=>({kind:'task',id:task.id,title:task.title,task,at,timeRole:role})

describe('saved matter projection',()=>{
 it('groups only explicit members and leaves same-day unrelated work independent',()=>{
  const groups=projectMatterGroups([a,b,other])
  expect(groups.size).toBe(1);expect(groups.get(goal.id)?.members.map(task=>task.id)).toEqual(['a','b'])
  expect(projectMatterGroups([a,{...b,sourceGoal:undefined},other]).size).toBe(0)
 })
 it('keeps calendar days and each time role as separate entries',()=>{
  const items=[item(a,'2026-11-12T09:00','plan'),item(a,'2026-11-13T17:00'),item(other,'2026-11-13T17:00'),item(b,'2026-11-14T12:00')]
  const grouped=groupMatterAgenda(items,[a,b,other])
  expect(grouped).toHaveLength(4)
  expect(grouped.filter(value=>value.kind==='matter').map(value=>value.kind==='matter'?[value.day,value.items[0].timeRole]:null)).toEqual([['2026-11-12','plan'],['2026-11-13','deadline'],['2026-11-14','deadline']])
  expect(grouped.some(value=>value.kind==='task'&&value.id==='c')).toBe(true)
 })
 it('uses the pending member for a same-day summary after another is complete',()=>{
  const complete:Task={...a,status:'已完成'},later:Task={...b,deadline:'2026-11-13T18:00'}
  const summary=matterDaySummaryTasks([complete,later,other],[complete,later,other])
  expect(summary).toHaveLength(2)
  expect(summary[0]).toMatchObject({id:'b',title:goal.title,status:'待开始'})
 })
})
