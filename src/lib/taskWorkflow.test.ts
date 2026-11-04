import {describe,expect,it} from 'vitest'
import {demoTasks} from '../data/demo'
import type {Task} from '../types'
import {linearTaskWorkflows} from './taskWorkflow'

const task=(id:string,overrides:Partial<Task>={}):Task=>({
  ...demoTasks[0],id,title:id,status:'待开始',deadline:'',sourceIds:['source-a'],
  dependencies:[],dependencyIds:[],materials:[],history:[],description:'',...overrides,
})
const group=(tasks:Task[],visible=tasks.filter(item=>item.status!=='已完成').map(item=>item.id))=>
  linearTaskWorkflows(tasks,new Set(visible),new Set(),new Date('2026-11-01T00:00:00Z'))

describe('same-source ordered task presentation',()=>{
  it('groups an explicit linear dependency without changing either saved task',()=>{
    const first=task('报名',{deadline:'2026-11-07T17:00',description:'提交渠道：https://example.edu/register'})
    const second=task('简历',{deadline:'2026-11-08T12:00',dependencyIds:['报名'],description:'提交渠道：https://example.edu/resume'})
    const before=JSON.stringify([first,second])
    expect(group([first,second]).map(items=>items.map(item=>item.id))).toEqual([['报名','简历']])
    expect(JSON.stringify([first,second])).toBe(before)
  })
  it('keeps the completed first step in the chain while the next step is visible',()=>{
    const first=task('报名',{status:'已完成'}),second=task('简历',{dependencyIds:['报名']})
    expect(group([first,second]).map(items=>items.map(item=>item.status))).toEqual([['已完成','待开始']])
  })
  it('does not combine unrelated sources or unrelated actions',()=>{
    expect(group([task('a'),task('b')])).toEqual([])
    expect(group([task('a'),task('b',{sourceIds:['source-b'],dependencyIds:['a']})])).toEqual([])
  })
  it('leaves branching, choices, missing prerequisites, snoozed and linked tasks independent',()=>{
    const first=task('a'),second=task('b',{dependencyIds:['a']})
    expect(group([first,second,task('c',{dependencyIds:['a']})])).toEqual([])
    expect(group([first,{...second,sourceChoice:{id:'choice',optionTaskIds:['b','c']}}])).toEqual([])
    expect(group([task('a',{dependencyIds:['missing']}),second])).toEqual([])
    expect(group([first,{...second,snoozedUntil:'2026-11-02T00:00:00Z'}])).toEqual([])
    expect(linearTaskWorkflows([first,second],new Set(['a','b']),new Set(['a']))).toEqual([])
    expect(group([task('a',{dependencyIds:['b']}),second])).toEqual([])
  })
})
