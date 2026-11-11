import {afterEach,expect,it,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {demoTasks} from '../data/demo'
import type {Task} from '../types'
import {MatterTaskList} from './MatterTaskList'
import {FlowTimeline} from './FlowTimeline'
import {CalendarPage} from '../pages/CalendarPage'

afterEach(()=>vi.useRealTimers())

it('renders a saved matter as one expandable entry without merging its actions',()=>{
 const goal={id:'g',title:'办理课程材料',taskIds:['a','b']}
 const base={...demoTasks[0],status:'待开始' as const,sourceIds:['source'],sourceGoal:goal,materials:[],dependencies:[],history:[]}
 const a:Task={...base,id:'a',title:'填写登记',deadline:'2026-11-13T17:00'}
 const b:Task={...base,id:'b',title:'发送证明',deadline:'2026-11-14T12:00'}
 const other:Task={...base,id:'c',title:'缴纳电费',sourceGoal:undefined}
 const html=renderToStaticMarkup(<MatterTaskList tasks={[a,b,other]} allTasks={[a,b,other]} onOpen={()=>{}} onComplete={()=>{}}/>)
 expect(html.match(/data-goal-id=/gu)).toHaveLength(1)
 for(const value of ['办理课程材料','填写登记','发送证明','缴纳电费','11月13日','11月14日'])expect(html).toContain(value)
})

it('labels conditional actions inside the matter rather than counting them as certain obligations',()=>{
 const goal={id:'g',title:'办理学分认定',taskIds:['a','b']}
 const base={...demoTasks[0],status:'待开始' as const,sourceIds:['source'],sourceGoal:goal,materials:[],dependencies:[],history:[],plannedStart:undefined,directDate:undefined}
 const a:Task={...base,id:'a',title:'填写登记',deadline:'2026-11-13T17:00',directTags:[]}
 const b:Task={...base,id:'b',title:'发送证明',deadline:'2026-11-14T12:00',directTags:['如符合条件','待确认']}
 const html=renderToStaticMarkup(<FlowTimeline tasks={[a,b]} allTasks={[a,b]} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}}/>)
 expect(html.match(/data-goal-id=/gu)).toHaveLength(1)
 for(const value of ['待办理 1 项','适用时办理 1 项','填写登记','发送证明','11月13日','11月14日'])expect(html).toContain(value)
})

it('offers existing same-source records explicit user organization without guessing membership',()=>{
 const base={...demoTasks[0],status:'待开始' as const,sourceIds:['source'],materials:[],dependencies:[],history:[],plannedStart:undefined,directDate:undefined,deadline:'2026-11-13'}
 const a:Task={...base,id:'a',title:'填写登记'},b:Task={...base,id:'b',title:'发送证明'}
 const other:Task={...base,id:'c',title:'其他来源',sourceIds:['other-source']}
 const html=renderToStaticMarkup(<FlowTimeline tasks={[a,b,other]} allTasks={[a,b,other]} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={['a']} onOpenTask={()=>{}} onComplete={()=>{}} onSetMatterGroup={async()=>{}}/>)
 expect(html).toContain('重新组织此通知');expect(html).toContain('组织为一件事');expect(html).toContain('选择相关待办')
 // The unrelated item is still visible in the timeline, but never a selectable same-source candidate.
 expect(html.match(/type="checkbox"/gu)).toHaveLength(2)
})

it('shows the same matter on each of its real calendar dates',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-11T02:00:00Z'))
 const goal={id:'g',title:'办理课程材料',taskIds:['a','b']}
 const base={...demoTasks[0],status:'待开始' as const,sourceIds:['source'],sourceGoal:goal,materials:[],dependencies:[],history:[],plannedStart:undefined,directDate:undefined}
 const a:Task={...base,id:'a',title:'填写登记',deadline:'2026-11-13T17:00'},b:Task={...base,id:'b',title:'发送证明',deadline:'2026-11-14T12:00'}
 const html=renderToStaticMarkup(<CalendarPage directMode tasks={[a,b]} events={[]} courseBlocks={[]} onOpenTask={()=>{}} onCompleteTask={()=>{}} onAddCourseBlock={()=>{}} onRemoveCourseBlock={()=>{}}/>)
 expect(html.match(/data-goal-id="g"/gu)).toHaveLength(2)
 for(const value of ['办理课程材料','填写登记','发送证明','2026-11-13','2026-11-14'])expect(html).toContain(value)
})
