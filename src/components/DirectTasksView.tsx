import {useState} from 'react'
import {Search} from 'lucide-react'
import type {Task,Event} from '../types'
import type {WorkspaceV8} from '../domain/v2/types'
import {pairFlowEvents,workspaceEventTimeHints,workspaceTaskChannels} from '../lib/homeFlow'
import {FlowTaskList} from './FlowItemList'

export function DirectTasksView({tasks,events=[],workspace,onOpen,onComplete,onSchedule,onOpenEvent}:{tasks:Task[];events?:Event[];workspace?:WorkspaceV8|null;onOpen:(task:Task)=>void;onComplete:(id:string)=>void;onSchedule?:(id:string,date:string)=>Promise<void>;onOpenEvent?:(event:Event)=>void}){
 const [filter,setFilter]=useState('未完成'),[query,setQuery]=useState('')
 const shown=tasks.filter(t=>(filter==='全部'||(filter==='已完成')===(t.status==='已完成'))&&`${t.title} ${t.description}`.toLowerCase().includes(query.trim().toLowerCase()))
 const paired=pairFlowEvents(tasks,events,workspace)
 return <main className="page flow-tasks-page"><header className="flow-page-heading"><h1>所有任务</h1><p>{tasks.filter(t=>t.status!=='已完成').length} 项未完成</p></header>
  <div className="toolbar"><label className="search-field"><Search size={17}/><span className="sr-only">搜索任务</span><input placeholder="搜索任务" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="filter-group" aria-label="任务状态">{['未完成','已完成','全部'].map(item=><button type="button" key={item} className={filter===item?'active':''} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{item}</button>)}</div></div>
  {shown.length?<FlowTaskList tasks={shown} onOpen={onOpen} onComplete={onComplete} onSchedule={onSchedule} channels={workspaceTaskChannels(workspace)} linkedEvents={paired.linked} eventTimeHints={workspaceEventTimeHints(workspace)} onOpenEvent={onOpenEvent}/>:<div className="home-empty-state"><strong>{query?'没有找到相关任务':filter==='已完成'?'还没有已完成的任务':'这里暂时没有任务'}</strong></div>}
 </main>
}
