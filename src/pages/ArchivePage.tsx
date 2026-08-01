import { Archive, CheckCircle2, Flag, Plus, Trophy } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { WorkspaceControls } from '../components/WorkspaceControls'
import type { Project, Task, WorkspaceData } from '../types'

interface ArchivePageProps {
  tasks: Task[]
  projects: Project[]
  workspace: WorkspaceData
  onImport: (serialized: string) => void
  onClear: () => void
  onAddMilestone: (projectId: string, title: string, dueAt: string) => void
  onToggleMilestone: (projectId: string, milestoneId: string) => void
}

interface ProjectCardProps {
  project: Project
  tasks: Task[]
  onAddMilestone: ArchivePageProps['onAddMilestone']
  onToggleMilestone: ArchivePageProps['onToggleMilestone']
}

function ProjectCard({ project, tasks, onAddMilestone, onToggleMilestone }: ProjectCardProps) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const projectTasks = tasks.filter((task) => task.projectId === project.id)
  const completed = projectTasks.filter((task) => task.status === '已完成').length
  const progress = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0
  const milestones = project.milestones.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt))

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
    <p>{project.sourceIds.length} 份来源 · {project.taskIds.length} 项确认任务</p>
    <div className="project-progress"><span><i style={{ width: `${progress}%` }} /></span><small>{progress}%</small></div>
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
    <footer><span>{projectTasks.length} 项关联任务</span><span>{milestones.filter((item) => item.status === '已完成').length}/{milestones.length} 个节点完成</span></footer>
  </article>
}

export function ArchivePage({ tasks, projects, workspace, onImport, onClear, onAddMilestone, onToggleMilestone }: ArchivePageProps) {
  return <main className="page">
    <header className="page-header"><div><span className="eyebrow">长期成果沉淀</span><h1>项目档案</h1><p>确认的任务、材料和来源均可追溯到对应项目；里程碑由你确认和维护。</p></div><div className="header-stat"><Trophy size={20} /><span><strong>{projects.length}</strong> 个已创建项目</span></div></header>
    {projects.length ? <div className="archive-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} tasks={tasks} onAddMilestone={onAddMilestone} onToggleMilestone={onToggleMilestone} />)}</div> : <div className="empty-state"><Archive size={34} /><h2>还没有项目档案</h2><p>确认一份通知中的任意事项后，会自动建立可追溯项目。</p></div>}
    <WorkspaceControls workspace={workspace} onImport={onImport} onClear={onClear} />
  </main>
}
