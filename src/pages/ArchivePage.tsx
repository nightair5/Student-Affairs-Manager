import { Archive, ArrowUpRight, Trophy } from 'lucide-react'
import { WorkspaceControls } from '../components/WorkspaceControls'
import type { Project, Task, WorkspaceData } from '../types'

interface ArchivePageProps {
  tasks: Task[]
  projects: Project[]
  workspace: WorkspaceData
  onImport: (serialized: string) => void
  onClear: () => void
}

export function ArchivePage({ tasks, projects, workspace, onImport, onClear }: ArchivePageProps) {
  return <main className="page">
    <header className="page-header"><div><span className="eyebrow">长期成果沉淀</span><h1>项目档案</h1><p>确认的任务、材料和来源均可追溯到对应项目；演示数据与未确认草稿不会冒充为成果。</p></div><div className="header-stat"><Trophy size={20} /><span><strong>{projects.length}</strong> 个已创建项目</span></div></header>
    {projects.length ? <div className="archive-grid">{projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id)
      const completed = projectTasks.filter((task) => task.status === '已完成').length
      const progress = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0
      return <article className="project-card" data-accent="green" key={project.id}><div className="project-card-top"><span className="project-icon"><Archive size={19} /></span><button className="icon-button" type="button" aria-label={`查看 ${project.title}`}><ArrowUpRight size={18} /></button></div><span className="category-label">{project.category}</span><h2>{project.title}</h2><p>{project.sourceIds.length} 份来源 · {project.taskIds.length} 项确认任务</p><div className="project-progress"><span><i style={{ width: `${progress}%` }} /></span><small>{progress}%</small></div><footer><span>{projectTasks.length} 项关联任务</span><span>来源可回看</span></footer></article>
    })}</div> : <div className="empty-state"><Archive size={34} /><h2>还没有项目档案</h2><p>确认一份通知中的任意事项后，会自动建立可追溯项目。</p></div>}
    <WorkspaceControls workspace={workspace} onImport={onImport} onClear={onClear} />
  </main>
}
