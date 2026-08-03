import {
  Archive,
  CalendarDays,
  CheckSquare2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Home,
  MessagesSquare,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PageId } from '../types'

export interface NavigationItem {
  id: PageId
  label: string
  shortLabel?: string
  icon: LucideIcon
}

export const coreNavigation: NavigationItem[] = [
  { id: 'today', label: '今日', icon: Home },
  { id: 'inbox', label: '待确认', icon: ClipboardCheck },
  { id: 'tasks', label: '任务中心', shortLabel: '任务', icon: CheckSquare2 },
  { id: 'calendar', label: '日历', icon: CalendarDays },
]

export const libraryNavigation: NavigationItem[] = [
  { id: 'library', label: '文件库', icon: FileText },
  { id: 'archive', label: '项目档案', icon: Archive },
  { id: 'knowledge', label: '知识问答', icon: MessagesSquare },
  { id: 'reports', label: '周报月报', icon: ClipboardList },
]
