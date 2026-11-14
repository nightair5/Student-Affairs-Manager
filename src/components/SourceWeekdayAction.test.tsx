import {expect,it,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {demoTasks} from '../data/demo'
import {FlowTimeline} from './FlowTimeline'
import type {Task} from '../types'

it('renders a source action date and its period without claiming a deadline',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-14T06:44:00Z'))
 const task:Task={...demoTasks[0],id:'source-action',title:'提交材料',status:'待开始',deadline:'',plannedStart:undefined,directDate:undefined,sourceActionAt:'2026-11-14',sourceActionRaw:'周六晚上',sourceActionWeekdayInferred:true,materials:[],dependencies:[],sourceIds:[],history:[],description:''}
 const html=renderToStaticMarkup(<FlowTimeline tasks={[task]} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
 expect(html).toContain('原文办理：11月14日晚上')
 expect(html).toContain('按整理日期推算')
 expect(html).not.toContain('11月14日 截止')
 expect(html).not.toContain('未设日期')
 vi.useRealTimers()
})
