import { Archive, CheckCircle2, Clock3, Flag, History, PackageCheck, Plus, Trophy } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { WorkspaceControls } from '../components/WorkspaceControls'
import { getFocusTasks, summarizeCanonicalProjectMaterials } from '../lib/taskLogic'
import type { Event, MaterialItemEntity, Project, Task, WorkPackage } from '../types'

interface ArchivePageProps {
  tasks: Task[]
  projects: Project[]
  workPackages: WorkPackage[]
  events: Event[]
  materials?: MaterialItemEntity[]
  onExport: () => Promise<string>
  onImport: (serialized: string) => Promise<void>
  onClear: () => void
  onAddMilestone: (projectId: string, title: string, dueAt: string) => void
  onToggleMilestone: (projectId: string, milestoneId: string) => void
  onOpenTask?: (task: Task) => void
}

interface ProjectCardProps {
  project: Project
  tasks: Task[]
  workPackages: WorkPackage[]
  events: Event[]
  materials?: MaterialItemEntity[]
  onAddMilestone: ArchivePageProps['onAddMilestone']
  onToggleMilestone: ArchivePageProps['onToggleMilestone']
  onOpenTask?: ArchivePageProps['onOpenTask']
}

function ProjectCard({ project, tasks, workPackages, events, materials, onAddMilestone, onToggleMilestone, onOpenTask }: ProjectCardProps) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const projectTasks = tasks.filter((task) => task.projectId === project.id)
  const completed = projectTasks.filter((task) => task.status === '已完成').length
  const progress = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0
  const milestones = project.milestones.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const currentMilestone = milestones.find((milestone) => milestone.status !== '已完成') ?? milestones.at(-1)
  const nextTask = getFocusTasks(projectTasks, new Date(), 1)[0]
  const nextDeadline = projectTasks.filter((task) => task.status !== '已完成').map((task) => task.deadline).sort()[0]
  const projectPackages = workPackages.filter((workPackage) => workPackage.projectId === project.id)
  const projectEvents = events.filter((event) => event.projectId === project.id)
  const canonicalMaterialSummary = materials
    ? summarizeCanonicalProjectMaterials(materials, project.id)
    : null
  const projectedMaterials = [...new Map(projectTasks
    .flatMap((task) => task.materials)
    .map((material) => [material.id, material])).values()]
  const materialCount = canonicalMaterialSummary?.total ?? projectedMaterials.length
  const missingMaterialCount = canonicalMaterialSummary?.missing
    ?? projectedMaterials.filter((material) => !material.done && (!material.status || material.status === 'missing' || material.status === 'preparing')).length
  const latestUpdatedAt = [
    project.updatedAt,
    ...projectTasks.map((task) => task.updatedAt),
    ...projectPackages.map((workPackage) => workPackage.updatedAt),
    ...projectEvents.map((event) => event.updatedAt),
    ...(canonicalMaterialSummary?.latestUpdatedAt ? [canonicalMaterialSummary.latestUpdatedAt] : []),
  ].filter((value) => Number.isFinite(new Date(value).getTime()))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .at(-1) ?? project.updatedAt

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !dueAt) return
    onAddMilestone(project.id, title, dueAt)
    setTitle('')
    setDueAt('')
    setAdding(false)
  }

  return <article className="project-card" data-accent="green">
    <div className="project-card-top">
      <span className="project-icon"><Archive size={19} /></span>
      <button className="detail-edit-button" type="button" onClick={() => setAdding((value) => !value)}><Plus size={15} />添加节点</button>
    </div>
    <span className="category-label">{project.category}</span>
    <h2>{project.title}</h2>
    <p>{project.objective || `${project.sourceIds.length} 份来源 · ${project.taskIds.length} 项确认任务`}</p>
    <div className="project-command-summary">
      <span><small>当前阶段</small><strong>{currentMilestone?.title ?? '待整理'}</strong></span>
      <span><small>最近截止</small><strong>{nextDeadline ? new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(nextDeadline)) : '暂无'}</strong></span>
      <span><small>主要风险</small><strong>{missingMaterialCount ? `缺 ${missingMaterialCount} 项材料` : '暂无明显风险'}</strong></span>
    </div>
    <div className="project-progress"><span><i style={{ width: `${progress}%` }} /></span><small>{progress}%</small></div>
    <div className="project-execution-strip" aria-label={`${project.title} 执行摘要`}>
      {nextTask && onOpenTask
        ? <button type="button" onClick={() => onOpenTask(nextTask)}><Clock3 size={16} /><span><small>下一步</small><strong>{nextTask.nextAction || nextTask.title}</strong></span></button>
        : nextTask
          ? <div><Clock3 size={16} /><span><small>下一步</small><strong>{nextTask.nextAction || nextTask.title}</strong></span></div>
        : <div><Clock3 size={16} /><span><small>下一步</small><strong>当前没有可执行任务</strong></span></div>}
      <div><PackageCheck size={16} /><span><small>材料</small><strong>{materialCount ? `${materialCount - missingMaterialCount}/${materialCount} 已就绪` : '暂无材料'}</strong></span></div>
      <div><History size={16} /><span><small>最近更新</small><strong>{new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(latestUpdatedAt))}</strong></span></div>
    </div>
    {adding && <form className="milestone-form" onSubmit={submit}>
      <label className="field"><span>节点名称</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：完成报名材料初审" required /></label>
      <label className="field"><span>节点时间</span><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required /></label>
      <button className="secondary-button" type="submit"><Plus size={15} />保存节点</button>
    </form>}
    <div className="milestone-list" aria-label={`${project.title} 的里程碑`}>
      {milestones.length ? milestones.slice(0, 5).map((milestone) => <button key={milestone.id} type="button" className={milestone.status === '已完成' ? 'milestone-item done' : 'milestone-item'} onClick={() => onToggleMilestone(project.id, milestone.id)}>
        {milestone.status === '已完成' ? <CheckCircle2 size={15} /> : <Flag size={15} />}
        <span><strong>{milestone.title}</strong><small>{new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(milestone.dueAt))}</small></span>
      </button>) : <p className="muted-copy">暂无里程碑；确认任务或手动添加后会显示在这里。</p>}
    </div>
    <details className="project-detail-tree">
      <summary>查看阶段、任务与材料</summary>
      {nextTask && <div className="project-next-action"><Clock3 size={16} /><span><small>下一步行动</small><strong>{nextTask.nextAction || nextTask.title}</strong></span></div>}
      {milestones.map((milestone) => {
        const stageTasks = projectTasks.filter((task) => task.milestoneId === milestone.id)
        const stagePackages = projectPackages.filter((workPackage) => workPackage.milestoneId === milestone.id)
        return <section className={milestone.id === currentMilestone?.id ? 'project-stage current' : 'project-stage'} key={milestone.id}>
          <header><span><strong>{milestone.title}</strong><small>{milestone.objective || '阶段目标待补充'}</small></span><em>{stageTasks.filter((task) => task.status === '已完成').length}/{stageTasks.length}</em></header>
          {stagePackages.map((workPackage) => <div className="project-work-package" key={workPackage.id}><strong>{workPackage.title}</strong>{stageTasks.filter((task) => task.workPackageId === workPackage.id).map((task) => <div className="project-tree-task" key={task.id}><span>{task.status === '已完成' ? '已完成' : '待办'}</span><p><strong>{task.title}</strong><small>{task.nextAction}</small></p></div>)}</div>)}
          {stageTasks.filter((task) => !task.workPackageId).map((task) => <div className="project-tree-task" key={task.id}><span>{task.status === '已完成' ? '已完成' : '待办'}</span><p><strong>{task.title}</strong><small>{task.nextAction}</small></p></div>)}
          {!stageTasks.length && <p className="muted-copy">该阶段当前只有时间或事件节点。</p>}
        </section>
      })}
      {projectEvents.length > 0 && <section className="project-events"><strong>事件安排</strong>{projectEvents.map((event) => <p key={event.id}>{event.title} · {event.startAt ? new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(event.startAt)) : '时间待确认'}</p>)}</section>}
      <div className="project-material-summary"><PackageCheck size={17} /><span>材料 {materialCount} 项 · {missingMaterialCount ? `${missingMaterialCount} 项未准备好` : '已准备齐全或暂无材料'}</span></div>
      <p className="project-history-summary">{project.sourceIds.length} 份来源 · 最后更新 {new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(project.updatedAt))}</p>
    </details>
    <footer><span>{projectTasks.length} 项关联任务</span><span>{milestones.filter((item) => item.status === '已完成').length}/{milestones.length} 个节点完成</span></footer>
  </article>
}

export function ArchivePage({ tasks, projects, workPackages, events, materials, onExport, onImport, onClear, onAddMilestone, onToggleMilestone, onOpenTask }: ArchivePageProps) {
  return <main className="page">
    <header className="page-header"><div><span className="eyebrow">项目执行与依据</span><h1>项目</h1><p>先看下一步、材料与最近更新；展开后再查看阶段、任务、事件和来源脉络。</p></div><div className="header-stat"><Trophy size={20} /><span><strong>{projects.length}</strong> 个已创建项目</span></div></header>
    {projects.length ? <div className="archive-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} tasks={tasks} workPackages={workPackages} events={events} materials={materials} onAddMilestone={onAddMilestone} onToggleMilestone={onToggleMilestone} onOpenTask={onOpenTask} />)}</div> : <div className="empty-state"><Archive size={34} /><h2>还没有项目</h2><p>确认一份通知中的任意事项后，会自动建立可追溯项目。</p></div>}
    <WorkspaceControls onExport={onExport} onImport={onImport} onClear={onClear} />
  </main>
}
