import { ArrowUpRight, CalendarDays, Clock3, MapPin } from 'lucide-react'
import { timePointDisplayValue } from '../recognition/recognitionModePresentation'
import { DEFAULT_WORKSPACE_TIMEZONE, parseBusinessDateTime } from '../lib/timeSemantics'
import type { Event } from '../types'
import './SuggestionCard.css'

/** Display only: date-only facts must never acquire a midnight or an invented end. */
export function eventMoment(value: string | null): string {
  if (!value) return '未说明'
  if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/u.test(value)) return timePointDisplayValue(value, value)
  const date = parseBusinessDateTime(value)
  if (!date) return '待核对'
  return new Intl.DateTimeFormat('zh-CN', { timeZone: DEFAULT_WORKSPACE_TIMEZONE, year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}

export function EventCard({ event, onOpen }: { event: Event; onOpen: (event: Event) => void }) {
  return <article className="task-card dashboard-event-card">
    <div className="task-card-topline"><span className="category-label"><CalendarDays size={15} />日程</span><button className="task-detail-button" type="button" onClick={() => onOpen(event)} aria-label={`查看 ${event.title} 详情`}>查看详情<ArrowUpRight size={16} /></button></div>
    <h3 className="task-card-title">{event.title}</h3>
    <div className="suggestion-card-time"><span><Clock3 size={16} />活动时间</span><strong>{event.startAt ? eventMoment(event.startAt) : '开始时间未说明'}</strong><small>{event.endAt ? `结束：${eventMoment(event.endAt)}` : '结束时间未说明'}</small></div>
    <p className="dashboard-event-location"><MapPin size={16} />{event.location || '地点未说明'}</p>
    {event.needsConfirmation && <p className="review-item-warning">时间仍需核对，请查看原文。</p>}
  </article>
}
