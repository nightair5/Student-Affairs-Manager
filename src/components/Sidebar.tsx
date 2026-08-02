import {
  Archive,
  CalendarDays,
  CheckSquare2,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Home,
  Plus,
  MessagesSquare,
  Sparkles,
  Server,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PageId } from '../types'

interface SidebarProps {
  currentPage: PageId
  pendingReviewCount: number
  onNavigate: (page: PageId) => void
  onOpenIntake: () => void
  onOpenGuide: () => void
}

interface NavigationItem {
  id: PageId
  label: string
  icon: LucideIcon
}

const coreNavigation: NavigationItem[] = [
  { id: 'today', label: '今日', icon: Home },
  { id: 'inbox', label: '待确认', icon: ClipboardCheck },
  { id: 'tasks', label: '任务中心', icon: CheckSquare2 },
  { id: 'calendar', label: '日历', icon: CalendarDays },
]

const libraryNavigation: NavigationItem[] = [
  { id: 'library', label: '文件库', icon: FileText },
  { id: 'archive', label: '项目档案', icon: Archive },
  { id: 'knowledge', label: '知识问答', icon: MessagesSquare },
]

export function Sidebar({
  currentPage,
  pendingReviewCount,
  onNavigate,
  onOpenIntake,
  onOpenGuide,
}: SidebarProps) {
  const renderNavigation = (items: NavigationItem[]) => items.map((item) => {
    const Icon = item.icon
    const active = item.id === currentPage
    return <button key={item.id} className={active ? 'nav-item active' : 'nav-item'} type="button" onClick={() => onNavigate(item.id)} aria-current={active ? 'page' : undefined}>
      <Icon size={18} strokeWidth={1.8} />{item.label}
      {item.id === 'inbox' && pendingReviewCount > 0 && <span className="nav-badge">{pendingReviewCount}</span>}
    </button>
  })
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
        <span className="nav-caption">每天使用</span>
        {renderNavigation(coreNavigation)}
        <span className="nav-caption secondary-caption">资料与工具</span>
        {renderNavigation(libraryNavigation)}
      </nav>

      <div className="sidebar-utility">
        <button type="button" onClick={onOpenGuide}><HelpCircle size={16} />新手教程</button>
        <button type="button" className={currentPage === 'services' ? 'active' : ''} onClick={() => onNavigate('services')}><Server size={16} />服务与设置</button>
      </div>

      <div className="sidebar-note">
        <span className="status-dot" />
        <div>
          <strong>已在此设备自动保存</strong>
          <p>同一浏览器与站点地址下可恢复；识别结果确认后才入库。</p>
        </div>
      </div>

    </aside>
  )
}
