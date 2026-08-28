import { CalendarDays, FileSearch, MapPin, X } from 'lucide-react'
import { useId, useRef } from 'react'
import { useDialogFocusTrap } from '../lib/useDialogFocusTrap'
import type { Event, Project } from '../types'

interface EventDetailPanelProps {
  event: Event
  project?: Project
  evidenceQuotes: string[]
  sourceTitles: string[]
  onClose: () => void
}

function dateTime(value: string | null | undefined): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return '时间待确认'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

export function EventDetailPanel({ event, project, evidenceQuotes, sourceTitles, onClose }: EventDetailPanelProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  useDialogFocusTrap(panelRef, onClose)

  return <div className="modal-backdrop detail-backdrop" role="presentation">
    <aside ref={panelRef} className="detail-panel event-detail-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="detail-header">
        <div><span className="eyebrow">日历事件</span><h2 id={titleId}>{event.title}</h2><p>{project?.title ?? '未归入项目'}</p></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭事件详情"><X size={20} /></button>
      </header>
      <div className="detail-body">
        <dl className="source-detail-facts">
          <div><dt>开始</dt><dd>{dateTime(event.startAt)}</dd></div>
          <div><dt>结束</dt><dd>{dateTime(event.endAt)}</dd></div>
          <div><dt>地点</dt><dd>{event.location || '未提供'}</dd></div>
          <div><dt>时间状态</dt><dd>{event.needsConfirmation ? '待人工确认' : '已记录'}</dd></div>
        </dl>
        <section className="source-original" aria-label="事件说明">
          <div className="source-section-heading"><CalendarDays size={17} /><h3>事件说明</h3></div>
          <p>{event.description || '原文没有提供更多说明。'}</p>
        </section>
        <section className="source-original" aria-label="来源依据">
          <div className="source-section-heading"><FileSearch size={17} /><h3>来源依据</h3></div>
          {evidenceQuotes.length > 0
            ? <ul>{evidenceQuotes.map((quote) => <li key={quote}>{quote}</li>)}</ul>
            : <p>当前兼容视图没有可展示的逐字引文；系统不会补写依据。</p>}
          <small>{sourceTitles.length ? `关联来源：${sourceTitles.join('、')}` : '未找到可回看的关联来源标题。'}</small>
        </section>
        {event.location && <p className="source-url"><MapPin size={14} /><span>{event.location}</span></p>}
      </div>
      <footer className="detail-footer"><button className="text-button" type="button" onClick={onClose}>关闭</button></footer>
    </aside>
  </div>
}
