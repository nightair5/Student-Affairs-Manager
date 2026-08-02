import {
  HelpCircle,
  Menu,
  Plus,
  Server,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { PageId } from '../types'
import { coreNavigation, libraryNavigation } from './navigation'
import type { NavigationItem } from './navigation'

interface SidebarProps {
  currentPage: PageId
  pendingReviewCount: number
  onNavigate: (page: PageId) => void
  onOpenIntake: () => void
  onOpenGuide: () => void
}

export function Sidebar({
  currentPage,
  pendingReviewCount,
  onNavigate,
  onOpenIntake,
  onOpenGuide,
}: SidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuTitleId = useId()
  const mobileCloseRef = useRef<HTMLButtonElement>(null)

  const navigate = (page: PageId) => {
    onNavigate(page)
    setMobileMenuOpen(false)
  }

  useEffect(() => {
    if (!mobileMenuOpen) return
    mobileCloseRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    document.body.classList.add('mobile-menu-visible')
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.classList.remove('mobile-menu-visible')
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileMenuOpen])

  const renderDesktopNavigation = (items: NavigationItem[]) => items.map((item) => {
    const Icon = item.icon
    const active = item.id === currentPage
    return <button key={item.id} className={active ? 'nav-item active' : 'nav-item'} type="button" onClick={() => navigate(item.id)} aria-current={active ? 'page' : undefined}>
      <Icon size={18} strokeWidth={1.8} />{item.label}
      {item.id === 'inbox' && pendingReviewCount > 0 && <span className="nav-badge">{pendingReviewCount}</span>}
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
        <Plus size={18} />录入新事项<kbd>N</kbd>
      </button>

      <nav className="primary-nav" aria-label="主要导航">
        <span className="nav-caption">每天使用</span>
        {renderDesktopNavigation(coreNavigation)}
        <span className="nav-caption secondary-caption">资料与工具</span>
        {renderDesktopNavigation(libraryNavigation)}
      </nav>

      <div className="sidebar-utility">
        <button type="button" onClick={onOpenGuide}><HelpCircle size={16} />新手教程</button>
        <button type="button" className={currentPage === 'services' ? 'active' : ''} onClick={() => navigate('services')}><Server size={16} />服务与设置</button>
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
        <Plus size={18} />录入
      </button>
    </header>

    <nav className="mobile-bottom-nav" aria-label="手机端主要导航">
      {coreNavigation.map((item) => {
        const Icon = item.icon
        const active = item.id === currentPage
        return <button key={item.id} type="button" className={active ? 'active' : ''} onClick={() => navigate(item.id)} aria-current={active ? 'page' : undefined}>
          <span className="mobile-nav-icon"><Icon size={21} strokeWidth={active ? 2.2 : 1.8} />{item.id === 'inbox' && pendingReviewCount > 0 && <em>{pendingReviewCount > 99 ? '99+' : pendingReviewCount}</em>}</span>
          <small>{item.shortLabel ?? item.label}</small>
        </button>
      })}
      <button type="button" className={mobileMenuOpen || [...libraryNavigation.map((item) => item.id), 'services'].includes(currentPage) ? 'active' : ''} onClick={() => setMobileMenuOpen(true)} aria-expanded={mobileMenuOpen}>
        <span className="mobile-nav-icon"><Menu size={21} /></span><small>更多</small>
      </button>
    </nav>

    {mobileMenuOpen && <div className="mobile-menu-backdrop" role="presentation" onClick={() => setMobileMenuOpen(false)}>
      <section className="mobile-menu-sheet" role="dialog" aria-modal="true" aria-labelledby={menuTitleId} onClick={(event) => event.stopPropagation()}>
        <header>
          <div><span>更多功能</span><h2 id={menuTitleId}>资料与设置</h2></div>
          <button ref={mobileCloseRef} type="button" onClick={() => setMobileMenuOpen(false)} aria-label="关闭更多功能"><X size={21} /></button>
        </header>
        <div className="mobile-menu-grid">
          {libraryNavigation.map((item) => {
            const Icon = item.icon
            return <button key={item.id} type="button" className={item.id === currentPage ? 'active' : ''} onClick={() => navigate(item.id)}>
              <span><Icon size={21} /></span><strong>{item.label}</strong><small>{item.id === 'library' ? '查看来源依据' : item.id === 'archive' ? '项目、备份与成果' : '本地资料问答'}</small>
            </button>
          })}
          <button type="button" className={currentPage === 'services' ? 'active' : ''} onClick={() => navigate('services')}>
            <span><Server size={21} /></span><strong>服务与设置</strong><small>接入状态与安全边界</small>
          </button>
        </div>
        <button className="mobile-guide-button" type="button" onClick={openGuide}><HelpCircle size={18} />打开新手教程</button>
        <p className="mobile-storage-note"><span className="status-dot" />数据默认保存在当前手机浏览器；请定期导出 JSON 备份。</p>
      </section>
    </div>}
  </>
}
