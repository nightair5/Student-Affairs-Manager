import {
  ClipboardCheck,
  HelpCircle,
  Menu,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { PageId } from '../types'
import { coreNavigation, libraryNavigation } from './navigation'
import type { NavigationItem } from './navigation'
import { useDialogFocusTrap } from '../lib/useDialogFocusTrap'

const mobileNavigationDescription: Partial<Record<PageId, string>> = {
  library: '查看来源与原文依据',
  tasks: '低频查看全部确认任务',
  knowledge: '在授权范围内检索本机资料',
  reports: '复盘、导出与手机提醒',
}

interface SidebarProps {
  currentPage: PageId
  inboxView: 'all' | 'needs_review'
  pendingReviewCount: number
  onNavigate: (page: PageId) => void
  onOpenPendingReview: () => void
  onOpenIntake: () => void
  onOpenGuide: () => void
}

export function Sidebar({
  currentPage,
  inboxView,
  pendingReviewCount,
  onNavigate,
  onOpenPendingReview,
  onOpenIntake,
  onOpenGuide,
}: SidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuTitleId = useId()
  const mobileCloseRef = useRef<HTMLButtonElement>(null)
  const mobileSheetRef = useRef<HTMLElement>(null)
  useDialogFocusTrap(mobileSheetRef, () => setMobileMenuOpen(false), mobileCloseRef, mobileMenuOpen)

  const navigate = (page: PageId) => {
    onNavigate(page)
    setMobileMenuOpen(false)
  }

  useEffect(() => {
    if (!mobileMenuOpen) return
    document.body.classList.add('mobile-menu-visible')
    return () => {
      document.body.classList.remove('mobile-menu-visible')
    }
  }, [mobileMenuOpen])

  const renderDesktopNavigation = (items: NavigationItem[]) => items.map((item) => {
    const Icon = item.icon
    const active = item.id === currentPage && (item.id !== 'inbox' || inboxView === 'all')
    return <button key={item.id} className={active ? 'nav-item active' : 'nav-item'} type="button" onClick={() => navigate(item.id)} aria-current={active ? 'page' : undefined}>
      <Icon size={18} strokeWidth={1.8} />{item.label}
    </button>
  })

  const openGuide = () => {
    setMobileMenuOpen(false)
    onOpenGuide()
  }

  return <>
    <aside className="sidebar desktop-sidebar">
      <button className="brand" type="button" onClick={() => navigate('today')} aria-label="返回今日首页">
        <span className="brand-mark" aria-hidden="true"><Sparkles size={20} strokeWidth={1.8} /></span>
        <span><strong>事务管家</strong><small>STUDENT DESK</small></span>
      </button>

      <button className="intake-button" type="button" onClick={onOpenIntake}>
        <Plus size={18} />新事务<kbd>N</kbd>
      </button>

      <nav className="primary-nav" aria-label="主要导航">
        <span className="nav-caption">执行闭环</span>
        {renderDesktopNavigation(coreNavigation.slice(0, 2))}
        <button className={currentPage === 'inbox' && inboxView === 'needs_review' ? 'nav-item pending-review-shortcut active' : 'nav-item pending-review-shortcut'} type="button" onClick={() => { onOpenPendingReview(); setMobileMenuOpen(false) }} aria-current={currentPage === 'inbox' && inboxView === 'needs_review' ? 'page' : undefined} aria-label={`打开待确认队列，共 ${pendingReviewCount} 项`}>
          <ClipboardCheck size={18} strokeWidth={1.8} />待确认
          <span className={pendingReviewCount ? 'nav-badge' : 'nav-badge empty'}>{pendingReviewCount}</span>
        </button>
        {renderDesktopNavigation(coreNavigation.slice(2))}
        {renderDesktopNavigation(libraryNavigation.slice(0, 1))}
        <span className="nav-caption secondary-caption">低频工具</span>
        {renderDesktopNavigation(libraryNavigation.slice(1))}
      </nav>

      <div className="sidebar-utility">
        <button type="button" onClick={() => navigate('tasks')}><Search size={16} />搜索事项</button>
        <button type="button" onClick={onOpenGuide}><HelpCircle size={16} />新手教程</button>
        <button type="button" className={currentPage === 'services' ? 'active' : ''} onClick={() => navigate('services')}><Server size={16} />设置与服务</button>
        <button type="button" className={currentPage === 'privacy' ? 'active' : ''} onClick={() => navigate('privacy')}><ShieldCheck size={16} />隐私与数据</button>
      </div>

      <div className="sidebar-note">
        <span className="status-dot" />
        <div><strong>已在此设备自动保存</strong><p>同一浏览器与站点地址下可恢复；识别结果确认后才入库。</p></div>
      </div>
    </aside>

    <header className="mobile-topbar">
      <button className="mobile-brand" type="button" onClick={() => navigate('today')} aria-label="返回今日首页">
        <span aria-hidden="true"><Sparkles size={18} /></span>
        <strong>事务管家</strong>
      </button>
      <button className="mobile-intake-button" type="button" onClick={onOpenIntake}>
        <Plus size={18} />新事务
      </button>
    </header>

    <nav className="mobile-bottom-nav" aria-label="手机端主要导航">
      {coreNavigation.map((item) => {
        const Icon = item.icon
        const active = item.id === currentPage && (item.id !== 'inbox' || inboxView === 'all')
        return <button key={item.id} type="button" className={active ? 'active' : ''} onClick={() => navigate(item.id)} aria-current={active ? 'page' : undefined}>
          <span className="mobile-nav-icon"><Icon size={21} strokeWidth={active ? 2.2 : 1.8} />{item.id === 'inbox' && pendingReviewCount > 0 && <em>{pendingReviewCount > 99 ? '99+' : pendingReviewCount}</em>}</span>
          <small>{item.shortLabel ?? item.label}</small>
        </button>
      })}
      <button type="button" className={mobileMenuOpen || [...libraryNavigation.map((item) => item.id), 'services', 'privacy'].includes(currentPage) || (currentPage === 'inbox' && inboxView === 'needs_review') ? 'active' : ''} onClick={() => setMobileMenuOpen(true)} aria-expanded={mobileMenuOpen}>
        <span className="mobile-nav-icon"><Menu size={21} /></span><small>更多</small>
      </button>
    </nav>

    {mobileMenuOpen && <div className="mobile-menu-backdrop" role="presentation" onClick={() => setMobileMenuOpen(false)}>
      <section ref={mobileSheetRef} className="mobile-menu-sheet" role="dialog" aria-modal="true" aria-labelledby={menuTitleId} onClick={(event) => event.stopPropagation()}>
        <header>
          <div><span>更多功能</span><h2 id={menuTitleId}>资料与设置</h2></div>
          <button ref={mobileCloseRef} type="button" onClick={() => setMobileMenuOpen(false)} aria-label="关闭更多功能"><X size={21} /></button>
        </header>
        <div className="mobile-menu-grid">
          <button type="button" className={currentPage === 'inbox' && inboxView === 'needs_review' ? 'mobile-review-shortcut active' : 'mobile-review-shortcut'} onClick={() => { onOpenPendingReview(); setMobileMenuOpen(false) }}>
            <span><ClipboardCheck size={21} /></span><strong>待确认</strong><small>{pendingReviewCount ? `${pendingReviewCount} 项建议等待核对` : '当前没有待确认建议'}</small>
          </button>
          {libraryNavigation.map((item) => {
            const Icon = item.icon
            return <button key={item.id} type="button" className={item.id === currentPage ? 'active' : ''} onClick={() => navigate(item.id)}>
              <span><Icon size={21} /></span><strong>{item.label}</strong><small>{mobileNavigationDescription[item.id]}</small>
            </button>
          })}
          <button type="button" className={currentPage === 'services' ? 'active' : ''} onClick={() => navigate('services')}>
            <span><Server size={21} /></span><strong>服务与设置</strong><small>接入状态与安全边界</small>
          </button>
          <button type="button" className={currentPage === 'privacy' ? 'active' : ''} onClick={() => navigate('privacy')}>
            <span><ShieldCheck size={21} /></span><strong>隐私与数据</strong><small>本机存储、云端发送与备份</small>
          </button>
        </div>
        <button className="mobile-guide-button" type="button" onClick={openGuide}><HelpCircle size={18} />打开新手教程</button>
        <p className="mobile-storage-note"><span className="status-dot" />数据默认保存在当前手机浏览器；请定期导出 JSON 备份。</p>
      </section>
    </div>}
  </>
}
