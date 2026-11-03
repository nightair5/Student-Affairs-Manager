import {describe,expect,it} from 'vitest'
import {demoTasks} from '../data/demo'
import type {Task} from '../types'
import {homeFlow} from './homeFlow'
import {sourceWindowActive} from './sourceWindowActive'
import {sourceWindowFirstStart} from '../domain/v2/sourceWindowDisplay'

const task:Task={...demoTasks[0],id:'window',status:'待开始',deadline:'',plannedStart:undefined,directDate:undefined,sourceWindowLabel:'11月4日9:00至11月6日17:00',sourceWindowStart:'2026-11-04T01:00:00.000Z',sourceWindowEnd:'2026-11-06T09:00:00.000Z',materials:[],dependencies:[],dependencyIds:[],riskFlags:[],sourceIds:[],history:[]}

describe('operating window visibility',()=>{
 it('shows an open window today without manufacturing a task deadline',()=>{
  const now=new Date('2026-11-04T12:00:00+08:00'),before=JSON.stringify(task)
  expect(sourceWindowActive(task,now)).toBe(true)
  expect(homeFlow([task],[],now).today.map(item=>item.id)).toEqual(['window'])
  expect(task.deadline).toBe('')
  expect(JSON.stringify(task)).toBe(before)
 })
 it('does not mark a window active before opening or after closing',()=>{
  expect(sourceWindowActive(task,new Date('2026-11-04T08:59:00+08:00'))).toBe(false)
  expect(sourceWindowActive(task,new Date('2026-11-06T17:01:00+08:00'))).toBe(false)
  expect(sourceWindowActive({...task,sourceWindowStart:undefined},new Date('2026-11-04T12:00:00+08:00'))).toBe(false)
 })
 it('never infers one continuous opening across multiple declared windows',()=>{
  const d={version:'source-window-declarations-1.0.0',ownerTaskId:'window',sourceVersionId:'v',windows:[{state:'RESOLVED_DISCRETE',rawText:'a',pointIds:['a','b']},{state:'RESOLVED_DISCRETE',rawText:'c',pointIds:['c','d']}]}
  expect(sourceWindowFirstStart('window',d,[],[])).toBeUndefined()
 })
})
