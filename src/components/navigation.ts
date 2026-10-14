import {
  CalendarDays,
  CheckSquare2,
  ClipboardList,
  FileText,
  FolderKanban,
  Home,
  Inbox,
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
  { id: 'inbox', label: '收件箱', icon: Inbox },
  { id: 'archive', label: '项目', icon: FolderKanban },
  { id: 'calendar', label: '日历', icon: CalendarDays },
]

export const libraryNavigation: NavigationItem[] = [
  { id: 'library', label: '资料库', icon: FileText },
  { id: 'tasks', label: '所有任务', icon: CheckSquare2 },
  { id: 'knowledge', label: '知识问答', icon: MessagesSquare },
  { id: 'reports', label: '周报月报', icon: ClipboardList },
]
