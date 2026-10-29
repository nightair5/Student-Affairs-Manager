import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {FlowTaskList} from './FlowItemList'
import {CompactTaskDetailPanel} from './CompactTaskDetailPanel'
import {demoTasks} from '../data/demo'
import {updateTaskWithHistory} from '../lib/taskUpdates'
import type {Task} from '../types'

describe('ordinary task material and estimate presentation',()=>{
  it('shows the named materials and relevant format/page facts without changing them',()=>{
    const task:Task={...demoTasks[0],id:'submission',status:'待开始',deadline:'',sourceDeadlineLabel:'纸质版截止另行通知',estimatedMinutesKnown:false,materials:[
      {id:'form',name:'申请表',done:false,formatRequirements:['Word版']},
      {id:'sample',name:'成果摘要',done:false,formatRequirements:['精选4页','扫描件PDF版']},
      {id:'collection',name:'成果合辑',done:false,formatRequirements:['10页及以上','扫描件PDF版']},
    ]}
    const before=JSON.stringify(task),html=renderToStaticMarkup(<FlowTaskList tasks={[task]} onOpen={()=>{}} onComplete={()=>{}} />)
    expect(html).toContain('截止时间另行通知')
    expect(html).toContain('申请表 Word')
    expect(html).toContain('成果摘要 4页 PDF')
    expect(html).toContain('成果合辑 10页及以上 PDF')
    expect(JSON.stringify(task)).toBe(before)
    const planned=renderToStaticMarkup(<FlowTaskList tasks={[{...task,plannedStart:'2026-11-03'}]} onOpen={()=>{}} onComplete={()=>{}} />)
    expect(planned).toContain('计划 · 截止时间另行通知')
  })
  it('records an explicit estimate even when it equals the view fallback',()=>{
    const task:Task={...demoTasks[0],estimatedMinutes:60,estimatedMinutesKnown:false}
    const edited=updateTaskWithHistory(task,{estimatedMinutes:60,estimatedMinutesKnown:true},'2026-10-29T01:00:00Z')
    expect(edited.estimatedMinutesKnown).toBe(true)
    expect(edited.history.at(-1)?.field).toBe('预计耗时状态')
  })
  it('shows an explicitly stated alternative submission method in ordinary details',()=>{
    const description='提交报告可任选电子邮件发送至课程邮箱，或者将纸质版交给助教，不要求两种方式都提交。'
    const task:Task={...demoTasks[0],sourceIds:['source'],description,materials:[{id:'report',name:'报告',done:false}]}
    const html=renderToStaticMarkup(<CompactTaskDetailPanel task={task} sources={[{id:'source',type:'text',title:'通知',contentPreview:description,rawText:description,createdAt:'2026-10-29T00:00:00Z',extractionStatus:'已识别'}]} onClose={()=>{}} onComplete={()=>{}} onUpdate={()=>{}} notificationPermission="default" onRequestNotificationPermission={async()=> 'default'} onAdvanced={()=>{}} />)
    expect(html).toContain('任选电子邮件')
    expect(html).toContain('或者将纸质版交给助教')
  })
  it('shows an unanchored relative requirement without supplying a date',()=>{
    const task:Task={...demoTasks[0],title:'提交阶段汇报',deadline:'',plannedStart:'',directDate:'',description:'在正式开始前，都可以继续修改汇报。',materials:[]}
    const html=renderToStaticMarkup(<FlowTaskList tasks={[task]} onOpen={()=>{}} onComplete={()=>{}} />)
    expect(html).toContain('未设日期')
    expect(html).toContain('在正式开始前，都可以继续修改汇报。')
  })
})
