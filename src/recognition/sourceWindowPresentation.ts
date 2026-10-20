import type { RecognitionResult } from './types'
import { taskTimeAuthorityFromSidecar } from './taskTimeAuthorityContract'
import { sourceWindowsFromSidecar } from './sourceWindowGrounding'
import { timePointDisplayLabel } from './recognitionModePresentation'
import {existingHandlingWindows} from './handlingWindowSupport'

export const SOURCE_WINDOW_PRESENTATION_VERSION = 'source-window-summary-1.0.0'
export interface SourceWindowSummary {
  id: string; ownerTitle: string; ownerTaskIds: string[]; summary: string; rawText: string; pointIds: string[]
}
const day = (value: string) => {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u)
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : value
}
const compact = (value: string) => value.replace(/\s/gu, '')
function covered(raw: string, quotes: string[], source: string) {
  const s = compact(source), r = compact(raw), at = s.indexOf(r)
  if (!r || at < 0 || s.indexOf(r, at + 1) >= 0 || !quotes.length) return false
  const spans = [...new Set(quotes)].map(q => {
    const text = compact(q), start = s.indexOf(text)
    return text && start >= 0 && s.indexOf(text, start + 1) < 0 ? { start, end: start + text.length } : null
  })
  if (spans.some(p => !p || p.end <= at || p.start >= at + r.length)) return false
  let end = at
  for (const span of spans.filter(p => p !== null).sort((a, b) => a.start - b.start)) {
    if (span.start <= end && span.end > end) end = span.end
  }
  return end >= at + r.length
}

/** A compact view of already validated canonical endpoints. This creates no
 * date, interval, owner, deadline or plan; invalid pairs keep the raw fallback. */
export function summarizeSourceWindows(result: RecognitionResult, sidecar: unknown, source: { id: string; text: string }): SourceWindowSummary[] {
  const tasks = [...result.standaloneTasks, ...result.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
  const summaries: SourceWindowSummary[] = [], used = new Set<string>()
  const audit = taskTimeAuthorityFromSidecar(sidecar)
  for (const window of audit?.windows ?? []) {
    const task = tasks.find(t => t.tempId === window.ownerTaskId), declaration = window.declaration
    if (!task || typeof declaration?.rawText !== 'string' || window.state === 'UNRESOLVED' || !window.intervals.length
      || window.state === 'RESOLVED_DATE_RANGE' && window.intervals.length !== 1
      || window.pointIds.length !== window.intervals.length * 2 || new Set(window.pointIds).size !== window.pointIds.length) continue
    const valid = window.intervals.every(interval => {
      if (![interval.start, interval.end].every(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/u.test(v)) || interval.end < interval.start) return false
      if (window.state === 'RESOLVED_DISCRETE' && (interval.precision !== 'exact' || !interval.start.includes('T') || !interval.end.includes('T'))
        || window.state === 'RESOLVED_DATE_RANGE' && (interval.precision !== 'date_only' || interval.start.includes('T') || interval.end.includes('T'))) return false
      return [[interval.startPointId, interval.start, 'event_start'], [interval.endPointId, interval.end, 'event_end']].every(([id, value, type]) => {
        const point = result.timePoints.find(p => p.tempId === id)
        if (!point || !window.pointIds.includes(id) || !task.timePointTempIds.includes(id)
          || point.type !== type || point.normalizedValue !== value || point.needsConfirmation || point.precision !== interval.precision
          || point.isAllDay !== (interval.precision === 'date_only')
          || point.relatedTaskTempIds.length !== 1 || point.relatedTaskTempIds[0] !== task.tempId
          || point.relatedMaterialTempIds.length || result.events.some(e => [e.startTimePointTempId, e.endTimePointTempId].includes(id))
          || point.rawText !== declaration.rawText
          || result.conflicts.some(c => c.entityTempIds.includes(id) || c.entityTempIds.includes(task.tempId))) return false
        const evidence = point.evidenceIds.map(id => result.evidence.find(e => e.id === id))
        return evidence.every(e => e?.sourceId === source.id && typeof e.quote === 'string')
          && covered(point.rawText, evidence.map(e => e!.quote!), source.text)
      })
    })
    if (!valid) continue
    let summary: string
    if (window.state === 'RESOLVED_DATE_RANGE') {
      const i = window.intervals[0]
      summary = `${day(i.start)}—${day(i.end)}（原文未说明每日时段）`
    } else {
      const dates = new Map<string, string[]>()
      for (const i of window.intervals) {
        const date = i.start.slice(0, 10), endDay = i.end.slice(0, 10)
        const range = i.start.slice(11) + '—' + (endDay === date ? '' : '次日') + i.end.slice(11)
        dates.set(date, [...(dates.get(date) ?? []), range])
      }
      const groups = new Map<string, string[]>()
      for (const [date, times] of dates) {
        const signature = [...new Set(times)].sort().join('、')
        groups.set(signature, [...(groups.get(signature) ?? []), date])
      }
      summary = [...groups].map(([times, dates]) => dates.sort().map(day).join('、') + (dates.length > 1 ? '，每天' : '，') + times).join('；')
    }
    summaries.push({ id: window.windowId, ownerTitle: task.title, ownerTaskIds: [task.tempId], summary, rawText: declaration.rawText, pointIds: [...window.pointIds] })
    window.pointIds.forEach(id => used.add(id))
  }
  const fallback = new Map<string, SourceWindowSummary>()
  for (const declaration of sourceWindowsFromSidecar(sidecar)) {
    if (used.has(declaration.id)) continue
    const point = result.timePoints.find(p => p.tempId === declaration.id)
    if (!point) continue
    const ownerTitle = point.relatedTaskTempIds.map(id => tasks.find(t => t.tempId === id)?.title ?? '关联待核对事项').join('、')
    const key = point.relatedTaskTempIds.join('|') + ':' + point.rawText
    const entry = fallback.get(key) ?? { id: declaration.id, ownerTitle, ownerTaskIds: [...point.relatedTaskTempIds],
      summary: '办理窗口原文已保留；具体区间需核对', rawText: point.rawText, pointIds: [] }
    entry.pointIds.push(point.tempId); fallback.set(key, entry)
  }
  return [...summaries, ...fallback.values()]
}

export function taskSourceTimeSummary(result: RecognitionResult, sidecar: unknown, source: {id: string; text: string}, taskId: string): string {
  const windows = summarizeSourceWindows(result, sidecar, source).filter(w => w.ownerTaskIds.includes(taskId))
  const used = new Set(windows.flatMap(w => w.pointIds))
  const anchor=result.timePoints.find(p=>p.relatedTaskTempIds.includes(taskId)&&p.type==='event_start'&&p.normalizedValue&&!p.needsConfirmation)
  const existingRows=anchor?.normalizedValue?existingHandlingWindows(result,source.text,anchor.normalizedValue.slice(0,10)+'T12:00:00+08:00',anchor.timezone??'Asia/Shanghai').rows.filter(row=>row.taskId===taskId):[]
  for(const existing of existingRows)if(!existing.pointIds.some(id=>used.has(id))){
    existing.pointIds.forEach(id=>used.add(id))
    windows.push({id:existing.pointIds[0],ownerTitle:'',ownerTaskIds:[taskId],rawText:existing.rawText,pointIds:[...existing.pointIds],summary:day(existing.start.slice(0,10))+'—'+day(existing.end.slice(0,10))+(existing.kind==='DATE_ONLY_PERIOD'?'（具体时刻未说明）':`，${existing.dayStart}—${existing.dayEnd}${existing.kind==='DAILY_CLOCKS'?'（每日）':'（开放日期待核对）'}`)})
  }
  const times = result.timePoints.filter(p => p.relatedTaskTempIds.includes(taskId) && !used.has(p.tempId))
    .map(p => timePointDisplayLabel(p.type) + '：' + (p.normalizedValue && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/u.test(p.normalizedValue) && !p.needsConfirmation
      ? day(p.normalizedValue.slice(0,10)) + (p.normalizedValue.includes('T') ? ' ' + p.normalizedValue.slice(11) : '')
      : p.rawText + (p.needsConfirmation ? '（时间待定）' : '')))
  return [...new Set([...times, ...windows.map(w => '办理窗口：' + (w.summary.includes('需核对') ? w.rawText + '（具体区间需核对）' : w.summary))])].join('；') || '原答未提供时间'
}
