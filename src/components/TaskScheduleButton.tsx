import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { CalendarDays } from 'lucide-react'
import type { Task } from '../types'
import { localDateKey } from '../lib/calendar'
import { flowDate, flowEditValue, planAfterDeadline } from '../lib/flowPresentation'

export function TaskScheduleButton({ task, onSchedule }: { task: Task; onSchedule: (id: string, date: string) => Promise<void> }) {
  const [open, setOpen] = useState(false), [date, setDate] = useState(''), [time, setTime] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), id = useId()
  useEffect(()=>{if(open){const timer=requestAnimationFrame(()=>{root.current?.querySelector<HTMLElement>('.task-schedule-popover')?.scrollIntoView({block:'nearest',behavior:'instant'})});return()=>cancelAnimationFrame(timer)}},[open])
  useEffect(() => { if (!open) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus() } }; const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target) && !busy) setOpen(false) }; document.addEventListener('keydown', close, true); document.addEventListener('pointerdown', outside); return () => { document.removeEventListener('keydown', close, true); document.removeEventListener('pointerdown', outside) } }, [open, busy])
  const save = async (value: string) => { if (busy) return; setBusy(true); setError(''); try { await onSchedule(task.id, value); setOpen(false); trigger.current?.focus() } catch { setError('日期未能保存，原有安排保留。请重试。') } finally { setBusy(false) } }
  const shortcut = (offset: number) => { const day = new Date(); day.setDate(day.getDate() + offset); void save(localDateKey(day)) }
  const submit = (event: FormEvent) => { event.preventDefault(); if (date) void save(date + (time ? 'T' + time : '')) }
  return <div className="task-schedule-control" ref={root}>
    <button type="button" className="task-schedule-trigger" ref={trigger} aria-label={`安排日期：${task.title}`} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { const value = flowEditValue(task.plannedStart ?? task.directDate); setDate(value.slice(0, 10)); setTime(value.slice(11, 16)); setError(''); setOpen(!open) }}><CalendarDays size={15} /><span>{task.plannedStart || task.directDate ? '改期' : '安排日期'}</span></button>
    {open && <div className="task-schedule-popover" id={id} role="dialog" aria-label="安排处理日期">
      <strong>打算哪天做？</strong><div className="task-schedule-shortcuts"><button type="button" disabled={busy} onClick={() => shortcut(0)}>今天</button><button type="button" disabled={busy} onClick={() => shortcut(1)}>明天</button></div>
      <form onSubmit={submit}><label>选择日期<input type="date" value={date} required disabled={busy} onChange={event => setDate(event.target.value)} /></label><label>时间（可不填）<input type="time" value={time} disabled={busy} onChange={event => setTime(event.target.value)} /></label><button type="submit" className="primary-button" disabled={busy || !date}>{busy ? '保存中…' : '安排'}</button></form>
      {task.deadline && <small>截止：{flowDate(task.deadline)}，保持不变</small>}
      {date && planAfterDeadline(date + (time ? 'T' + time : ''), task.deadline) && <small className="flow-deadline-warning">计划晚于截止，可调整后再保存。</small>}
      {(task.plannedStart || task.directDate) && <button className="text-button" type="button" disabled={busy} onClick={() => void save('')}>清除个人安排</button>}
      {error && <p role="alert">{error}</p>}
    </div>}
  </div>
}
