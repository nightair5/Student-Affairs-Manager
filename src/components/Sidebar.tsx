import {
  Archive,
  CalendarDays,
  CheckSquare2,
  ClipboardCheck,
  FileText,
  Home,
  Plus,
  Sparkles,
  Server,
} from 'lucide-react'
import type { PageId } from '../types'

interface SidebarProps {
  currentPage: PageId
  onNavigate: (page: PageId) => void
  onOpenIntake: () => void
}

const navigation = [
  { id: 'today' as const, label: '今日', icon: Home },
  { id: 'inbox' as const, label: '待确认', icon: ClipboardCheck },
  { id: 'tasks' as const, label: '任务中心', icon: CheckSquare2 },
  { id: 'calendar' as const, label: '日历', icon: CalendarDays },
  { id: 'library' as const, label: '文件库', icon: FileText },
  { id: 'archive' as const, label: '项目档案', icon: Archive },
  { id: 'services' as const, label: '服务接入', icon: Server },
]

export function Sidebar({
  currentPage,
  onNavigate,
  onOpenIntake,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <button
        className="brand"
        type="button"
        onClick={() => onNavigate('today')}
        aria-label="返回今日首页"
      >
        <span className="brand-mark" aria-hidden="true">
          <Sparkles size={20} strokeWidth={1.8} />
        </span>
        <span>
          <strong>事务管家</strong>
          <small>STUDENT DESK</small>
        </span>
      </button>

      <button className="intake-button" type="button" onClick={onOpenIntake}>
        <Plus size={18} />
        录入新事项
        <kbd>N</kbd>
      </button>

      <nav className="primary-nav" aria-label="主要导航">
        <span className="nav-caption">工作台</span>
        {navigation.map((item) => {
          const Icon = item.icon
          const active = item.id === currentPage
          return (
            <button
              key={item.id}
              className={active ? 'nav-item active' : 'nav-item'}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={18} strokeWidth={1.8} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="sidebar-note">
        <span className="status-dot" />
        <div>
          <strong>已在此设备自动保存</strong>
          <p>同一浏览器与站点地址下可恢复；识别结果确认后才入库。</p>
        </div>
      </div>

      <div className="profile">
        <span className="profile-avatar">林</span>
        <span>
          <strong>林同学</strong>
          <small>本地工作区</small>
        </span>
      </div>
    </aside>
  )
}
