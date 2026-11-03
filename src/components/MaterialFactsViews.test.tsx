import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {demoTasks} from '../data/demo'
import type {Task} from '../types'
import {FlowTimeline} from './FlowTimeline'
import {CompactTaskDetailPanel} from './CompactTaskDetailPanel'
import {getMaterialProgress} from '../lib/taskLogic'

describe('the same saved materials and channels across task views',()=>{
 it('shows quantity, owner-specific naming, location and channel in both views',()=>{
  const task:Task={...demoTasks[0],id:'facts',title:'提交材料',status:'待开始',deadline:'2026-11-05T17:00',dependencies:[],sourceIds:[],history:[],description:'提交渠道：课程平台\n地点：教学楼A室',materials:[
   {id:'m1',name:'报名表',done:false,quantity:2,formatRequirements:['Word'],namingRequirements:['项目号命名'],submissionChannel:'课程平台'},
   {id:'m2',name:'计划书',done:false,requirements:['不超过5页'],namingRequirements:['姓名命名'],submissionChannel:'资料邮箱'},
  ]}
  const timeline=renderToStaticMarkup(<FlowTimeline tasks={[task]} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  const detail=renderToStaticMarkup(<CompactTaskDetailPanel task={task} sources={[]} onClose={()=>{}} onComplete={()=>{}} onUpdate={()=>{}} onAdvanced={()=>{}} notificationPermission="default" onRequestNotificationPermission={async()=> 'default'} />)
  for(const value of ['数量：2','项目号命名','姓名命名','教学楼A室','课程平台','资料邮箱']){
   expect(timeline).toContain(value);expect(detail).toContain(value)
  }
 })
 it('shows conditional material without counting it as universally required',()=>{
  const task:Task={...demoTasks[0],id:'conditional',title:'领取资料',status:'待开始',dependencies:[],sourceIds:[],history:[],materials:[
   {id:'m1',name:'身份证',done:false,required:true},
   {id:'m2',name:'授权书',done:false,required:false,requirements:['若他人代领，须携带授权书']},
  ]}
  const timeline=renderToStaticMarkup(<FlowTimeline tasks={[task]} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  const detail=renderToStaticMarkup(<CompactTaskDetailPanel task={task} sources={[]} onClose={()=>{}} onComplete={()=>{}} onUpdate={()=>{}} onAdvanced={()=>{}} notificationPermission="default" onRequestNotificationPermission={async()=> 'default'} />)
  expect(getMaterialProgress(task)).toEqual({done:0,total:1})
  for(const html of [timeline,detail]){expect(html).toContain('按条件或需要准备');expect(html).toContain('若他人代领，须携带授权书')}
 })
})
