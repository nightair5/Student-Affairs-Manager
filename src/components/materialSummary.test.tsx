import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {FlowTaskList} from './FlowItemList'
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
})
