import type { TaskDateViews } from '../experiments/mainline02/taskDateView'
import { safeIntakeError } from '../lib/workspaceRecoveryUi'
import { ArrowRight, ClipboardPaste, Inbox, Link2, Plus, Upload } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { TaskCard } from '../components/TaskCard'
import { EventCard } from '../components/EventCard'
import { localDateKey } from '../lib/calendar'
import { getBlockedAndWaitingTasks, getFocusTasks } from '../lib/taskLogic'
import type { Event, Project, Task } from '../types'
import {homeFlow} from '../lib/homeFlow'
import {FlowEventList,FlowTaskList} from '../components/FlowItemList'

interface DashboardPageProps {
  directMode?: boolean
  directNotice?:ReactNode
  historicalNotice?: {count:number;busy:boolean;onAdd:()=>Promise<void>;onIgnore:()=>Promise<void>}
  recentAdditions?: ReactNode
  planning?: ReactNode
  engineeringInput?: boolean
  engineeringInputLabel?: string
  realInput?: { networkDescription: string }
  dateViews?: TaskDateViews
  readOnly?: boolean
  tasks: Task[]
  events?: Event[]
  onOpenEvent?: (event: Event) => void
  onShowCalendar?: () => void
  projects: Project[]
  pendingReviewCount: number
  onQuickCapture: (content: string) => Promise<void>
  onOpenIntake: () => void
  onOpenTask: (task: Task) => void
  onCompleteTask: (taskId: string) => void
  onScheduleTask?: (taskId: string, date: string) => Promise<void>
  recentItemIds?: readonly string[]
  onStartTask: (taskId: string) => void
  onSnoozeTask: (taskId: string) => void
  onTogglePinTask: (taskId: string) => void
  onShowTasks: () => void
  onShowInbox: () => void
  smartExtractionStatus: 'checking' | 'connected' | 'unavailable'
}

function todayLabel(): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'long',
  }).format(new Date())
}

export function DashboardPage({
  directMode, recentAdditions, historicalNotice, directNotice,
  planning,
  engineeringInput,
  engineeringInputLabel,
  dateViews, readOnly, realInput,
  tasks,
  events = [], onOpenEvent, onShowCalendar,
  projects,
  pendingReviewCount,
  onQuickCapture,
  onOpenIntake,
  onOpenTask,
  onCompleteTask,
  onScheduleTask, recentItemIds,
  onStartTask,
  onSnoozeTask,
  onTogglePinTask,
  onShowTasks,
  onShowInbox,
  smartExtractionStatus,
}: DashboardPageProps) {
  const [quickText, setQuickText] = useState('')
  const [quickError, setQuickError] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const focusTasks = getFocusTasks(tasks, new Date(), 3, dateViews)
  const deferredTasks = getBlockedAndWaitingTasks(tasks, new Date(), dateViews)
  const activeCount = tasks.filter((task) => task.status !== '已完成').length
  const today = localDateKey(new Date())
  // Only presentation order changes. The calendar retains every saved event.
  const deferredEvents=events.filter(event=>event.directTags?.length)
  const upcomingEvents = events.filter(event => !event.directTags?.length).filter(event => {
    const end = event.endAt || event.startAt
    return !end || !Number.isFinite(Date.parse(end)) || localDateKey(end) >= today
  }).sort((a, b) => (a.startAt || '9999').localeCompare(b.startAt || '9999')).slice(0, 3)

  const submitQuickCapture = async (event: FormEvent) => {
    event.preventDefault()
    if (isParsing || !quickText.trim()) return
    const submittedText = quickText
    const content = realInput ? submittedText : submittedText.trim()
    setQuickError('')
    setIsParsing(true)
    try {
      await onQuickCapture(content)
      // Clear only the successfully submitted original; failed captures retain it.
      setQuickText(current => current === submittedText ? '' : current)
    } catch (error) {
      setQuickError(safeIntakeError(error, '原文尚未保存，输入已保留；请保留此页或复制文字后重试。'))
    } finally {
      setIsParsing(false)
    }
  }

  const captureForm = (
      <form className="quick-capture" onSubmit={submitQuickCapture}>
        <div className="quick-capture-heading">
          <span className="quick-capture-icon"><ClipboardPaste size={20} /></span>
          <div><strong>收到新通知？直接粘贴</strong><small>{realInput ? '先核对输入文字，再决定本次发送范围。' : directMode ? '点一次整理，待办和日程直接加入，可随时撤销。' : '日期、事项和材料会先拆成待确认建议。'}</small></div>
          {(!directMode||engineeringInput||realInput||dateViews)&&<span className={`ai-assist-status ${smartExtractionStatus}`}>
            {engineeringInput ? engineeringInputLabel??'匿名工程输入 · 模型派发关闭' : realInput ? '真实输入隔离实验 · 发送前核对' : dateViews ? '人工工程响应 · 不调用模型' : smartExtractionStatus === 'connected' ? 'DeepSeek 已配置 · 调用时验证' : smartExtractionStatus === 'checking' ? '正在检查智能服务' : 'DeepSeek 未配置 · 本地规则可用'}
          </span>}
        </div>
        <textarea value={quickText} readOnly={isParsing} onChange={(event) => { setQuickText(event.target.value); setQuickError('') }} rows={3} placeholder="粘贴老师消息、群通知或网页正文……" aria-label="快速粘贴通知" aria-describedby={quickError ? 'quick-capture-error' : undefined} />
        {isParsing && <p role="status">{directMode?'正在整理并添加，完成后会显示事项。':'正在保存和整理这份原文；完成后可继续放入下一份。'}</p>}
        {quickError && <p id="quick-capture-error" role="alert">{quickError}</p>}
        <div className="quick-capture-actions">
          <button className="text-button" type="button" onClick={onOpenIntake} disabled={isParsing}><Upload size={15} />{realInput ? '打开文字、图片或文件录入' : dateViews ? '打开统一文字录入' : '上传文件或链接'}</button>
          <button className="primary-button" type="submit" disabled={!quickText.trim() || isParsing}>
            {isParsing ? (realInput ? '正在打开输入核对…' : dateViews ? '正在保存工程草稿…' : '正在整理…') : <><Plus size={16} />{realInput ? '先核对输入文字' : dateViews ? '生成工程建议' : directMode ? '整理' : '智能拆分任务'}</>}
          </button>
        </div>
        <small className="cloud-send-disclosure">{engineeringInput ? '本入口只接受当前列出的输入，回放已有建议，不新增模型请求；编辑、确认和保存使用普通产品路径。' : realInput ? `此按钮只打开输入核对，不立即发送。${realInput.networkDescription} 建议须经用户确认，仅保存到隔离测试库。` : dateViews ? '只接受旧匿名工程通知，在独立本机测试库保存；不发送文字、不调用模型，也不回退本地识别。请核对后确认。' : directMode ? '只发送这次通知；保存在当前浏览器，可修改或撤销。' : '点击整理只发送当前粘贴文字，不附带已有项目或任务；已配置服务调用时验证，结果仅为待确认建议。服务未配置时不发送，使用本地规则。'}</small>
      </form>
  )

  if(directMode){
    const flow=homeFlow(tasks,events),active=flow.dated.length+flow.undated.length
    return <main className="page dashboard-page flow-dashboard">
      <header className="flow-page-heading"><span className="date-line">{todayLabel()}</span><h1>今天与接下来</h1></header>
      {captureForm}
      {historicalNotice&&historicalNotice.count>0&&<div className="flow-history-notice"><span>发现 {historicalNotice.count} 条以前的通知</span><button type="button" className="text-button" disabled={historicalNotice.busy} onClick={()=>void historicalNotice.onAdd()}>{historicalNotice.busy?'正在添加…':'全部加入'}</button><button type="button" className="text-button" disabled={historicalNotice.busy} onClick={()=>void historicalNotice.onIgnore()}>忽略</button></div>}
      {directNotice}
      {flow.today.length>0&&<section className="flow-today-section" aria-labelledby="flow-today-title"><div className="section-heading"><h2 id="flow-today-title">今天 <small>{flow.today.length}</small></h2></div><FlowTaskList tasks={flow.today} onOpen={onOpenTask} onComplete={onCompleteTask} onSchedule={onScheduleTask} highlightIds={recentItemIds}/></section>}
      {(flow.next.length>0||flow.events.length>0)&&<section className="today-next-section" aria-labelledby="today-next-title"><div className="section-heading"><h2 id="today-next-title">接下来 <small>{flow.next.length+flow.events.length}</small></h2><button className="text-button" type="button" onClick={onShowCalendar}>日历<ArrowRight size={16}/></button></div>
        {flow.next.length>0&&<FlowTaskList tasks={flow.next} onOpen={onOpenTask} onComplete={onCompleteTask} onSchedule={onScheduleTask} highlightIds={recentItemIds}/>}
        {onOpenEvent&&flow.events.length>0&&<FlowEventList events={flow.events} onOpen={onOpenEvent}/>}
      </section>}
      {flow.undated.length>0&&<section className="flow-undated-section" aria-labelledby="undated-title"><div className="section-heading"><h2 id="undated-title">未安排 <small>{flow.undated.length}</small></h2></div><FlowTaskList tasks={flow.undated} onOpen={onOpenTask} onComplete={onCompleteTask} onSchedule={onScheduleTask} highlightIds={recentItemIds}/></section>}
      {flow.deferred.length>0&&<section className="deferred-execution-section" aria-labelledby="deferred-title"><div className="section-heading"><h2 id="deferred-title">稍后再做</h2></div><div className="deferred-task-list">{flow.deferred.map(({task,reason})=><button key={task.id} className="deferred-task" type="button" onClick={()=>onOpenTask(task)}><span className="deferred-task-copy"><strong>{task.title}</strong><small>{reason}</small></span><ArrowRight size={16}/></button>)}</div></section>}
      {!active&&!flow.deferred.length&&!flow.events.length&&<section className="home-empty-state"><strong>{tasks.length?'事情都处理好了':'放入第一条通知，待办和日程就会出现在这里'}</strong><p>粘贴原消息，点一次整理即可。</p></section>}
      {recentAdditions}
    </main>
  }

  return (
    <main className="page dashboard-page">
      <header className="simple-dashboard-header">
        <div>
          <span className="date-line">{todayLabel()}</span>
          <h1>{focusTasks.length ? <>今天先做这 <em>{focusTasks.length}</em> 件事</> : upcomingEvents.length ? '接下来有哪些安排' : '先把新通知变成清楚的下一步'}</h1>
          <p>任务和日程都在这里，按自己的节奏逐件完成。</p>
        </div>
      </header>

      {!tasks.length && !events.length && captureForm}

      {pendingReviewCount > 0 && <button className="pending-review-banner" type="button" onClick={onShowInbox}>
        <Inbox size={18} />
        <span><strong>{directMode?`还有 ${pendingReviewCount} 项历史内容可添加`:`还有 ${pendingReviewCount} 项建议等你确认`}</strong><small>关闭页面也不会丢失，可以稍后处理。</small></span>
        <ArrowRight size={17} />
      </button>}

      <section className="focus-section" aria-labelledby="focus-title">
        <div className="section-heading">
          <div><span className="section-index">TODAY</span><h2 id="focus-title">现在先做这些</h2></div>
          <button className="text-button" type="button" onClick={onShowTasks}>全部 {activeCount} 项<ArrowRight size={16} /></button>
        </div>
        {focusTasks.length
          ? <div className="focus-grid">{focusTasks.map((task, index) => { const project = projects.find((candidate) => candidate.id === task.projectId); return <TaskCard dateView={dateViews?.[task.id]} readOnly={readOnly} key={task.id} task={task} allTasks={tasks} projectTitle={project?.title} stageTitle={project?.milestones.find((milestone) => milestone.id === task.milestoneId)?.title} featured={index === 0} onOpen={onOpenTask} onComplete={onCompleteTask} onStart={onStartTask} onSnooze={onSnoozeTask} onTogglePin={onTogglePinTask} /> })}</div>
          : <div className="home-empty-state"><strong>{deferredTasks.length ? '暂时没有可开始的任务' : tasks.length ? '任务都完成了' : '今天还没有任务'}</strong><p>{deferredTasks.length ? '需要等待或稍后处理的事项在下方，可以随时查看。' : tasks.length ? '有新通知时再添加，也可以查看接下来的日程。' : directMode?'粘贴一段通知，点整理就会出现在这里。':'粘贴一段通知，确认后就会出现在这里。'}</p></div>}
      </section>

      {upcomingEvents.length > 0 && onOpenEvent && <section className="upcoming-events-section" aria-labelledby="upcoming-events-title"><div className="section-heading"><div><span className="section-index">日程</span><h2 id="upcoming-events-title">接下来的活动</h2></div><button className="text-button" type="button" onClick={onShowCalendar}>查看日历<ArrowRight size={16} /></button></div><div className="upcoming-events-grid">{upcomingEvents.map(event => <EventCard key={event.id} event={event} onOpen={onOpenEvent} />)}</div></section>}

      {deferredTasks.length > 0 && <section className="deferred-execution-section" aria-labelledby="deferred-title">
        <div className="section-heading compact">
          <div><h2 id="deferred-title">稍后再做</h2><p>等待前一步完成，或到了你选好的时间再开始。</p></div>
          <span className="deferred-count">{deferredTasks.length} 项</span>
        </div>
        <div className="deferred-task-list">
          {deferredTasks.map(({ task, state, reason }) => <button key={task.id} type="button" className="deferred-task" onClick={() => onOpenTask(task)}>
            <span className={`deferred-state ${state}`}><Link2 size={14} />{state === 'blocked' ? '受阻' : '稍后'}</span>
            <span className="deferred-task-copy"><strong>{task.title}</strong><small>{reason}</small></span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>)}
        </div>
      </section>}
      {(tasks.length > 0 || events.length > 0) && <details className="dashboard-add-notice"><summary><Plus size={18} /><span>添加新的通知</span></summary>{captureForm}</details>}
      {deferredEvents.length>0&&<section className="dashboard-section"><div className="section-heading"><h2>待定日程</h2></div><div className="deferred-task-list">{deferredEvents.map(event=><button key={event.id} type="button" className="deferred-task" onClick={()=>onOpenEvent?.(event)}><span className="deferred-state">待确认</span><span className="deferred-task-copy"><strong>{event.title}</strong><small>{event.directTags?.join(' · ')}</small></span><ArrowRight size={16} aria-hidden="true"/></button>)}</div></section>}
      {recentAdditions}
      {tasks.length > 0 && planning}
    </main>
  )
}
