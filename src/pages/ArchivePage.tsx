import { Archive, ArrowUpRight, Trophy } from 'lucide-react'
import type { Task } from '../types'

interface ArchivePageProps {
  tasks: Task[]
}

export function ArchivePage({ tasks }: ArchivePageProps) {
  const projects = [
    {
      title: '创新传播赛',
      type: '比赛项目',
      summary: '报名与选题阶段',
      progress: 42,
      accent: 'green',
      tasks: tasks.filter((task) => task.category === '比赛').length,
    },
    {
      title: '2026 推免准备',
      type: '个人发展',
      summary: '材料核对阶段',
      progress: 18,
      accent: 'blue',
      tasks: tasks.filter((task) => task.category === '保研').length,
    },
    {
      title: '传播学课程',
      type: '课程档案',
      summary: '本学期持续归档',
      progress: 66,
      accent: 'sand',
      tasks: tasks.filter((task) => task.category === '课程').length,
    },
  ]

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">长期成果沉淀</span>
          <h1>项目档案</h1>
          <p>任务完成后不消失，材料与成果会继续留在对应项目中。</p>
        </div>
        <div className="header-stat">
          <Trophy size={20} />
          <span>
            <strong>3</strong>
            个进行中项目
          </span>
        </div>
      </header>

      <div className="archive-grid">
        {projects.map((project) => (
          <article
            className="project-card"
            data-accent={project.accent}
            key={project.title}
          >
            <div className="project-card-top">
              <span className="project-icon">
                <Archive size={19} />
              </span>
              <button
                className="icon-button"
                type="button"
                aria-label={`打开 ${project.title}`}
              >
                <ArrowUpRight size={18} />
              </button>
            </div>
            <span className="category-label">{project.type}</span>
            <h2>{project.title}</h2>
            <p>{project.summary}</p>
            <div className="project-progress">
              <span>
                <i style={{ width: `${project.progress}%` }} />
              </span>
              <small>{project.progress}%</small>
            </div>
            <footer>
              <span>{project.tasks} 项关联任务</span>
              <span>材料持续归档</span>
            </footer>
          </article>
        ))}
      </div>
    </main>
  )
}
