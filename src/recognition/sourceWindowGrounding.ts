import type { RecognitionResult, TimePointSuggestionV2 } from './types'
import { interpretTimeD26 } from '../lib/timeSemanticsD26'

export const SOURCE_WINDOW_GROUNDING_VERSION = 'source-window-endpoints-1.0.0'
export interface SourceWindowDeclaration {
  id: string
  role: 'window_start' | 'window_end'
  owners: Array<{ kind: 'task' | 'material'; entityId: string }>
}
export function sourceWindowsFromSidecar(sidecar: unknown): SourceWindowDeclaration[] {
  if (!sidecar || typeof sidecar !== 'object' || !('singleAuthorityAudit' in sidecar)) return []
  const audit = sidecar.singleAuthorityAudit
  if (!audit || typeof audit !== 'object' || !('sourceWindows' in audit)) return []
  const rows = audit.sourceWindows
  if (!Array.isArray(rows)) throw Error('SOURCE_WINDOW_DECLARATIONS_INVALID')
  return rows.map((row: unknown) => {
    if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string' || !('role' in row)
      || !['window_start', 'window_end'].includes(String(row.role)) || !('owners' in row) || !Array.isArray(row.owners)) throw Error('SOURCE_WINDOW_DECLARATIONS_INVALID')
    const owners = row.owners.map((owner: unknown) => {
      if (!owner || typeof owner !== 'object' || !('kind' in owner) || !['task', 'material'].includes(String(owner.kind))
        || !('entityId' in owner) || typeof owner.entityId !== 'string') throw Error('SOURCE_WINDOW_DECLARATIONS_INVALID')
      return { kind: owner.kind as 'task' | 'material', entityId: owner.entityId }
    })
    return { id: row.id, role: row.role as SourceWindowDeclaration['role'], owners }
  })
}
type Fields = Pick<TimePointSuggestionV2, 'normalizedValue' | 'precision' | 'isAllDay' | 'needsConfirmation' | 'timezone'>
export interface SourceWindowAudit {
  version: typeof SOURCE_WINDOW_GROUNDING_VERSION
  inferredFacts: 0
  decisions: Array<{ id: string; role: SourceWindowDeclaration['role']; owners: SourceWindowDeclaration['owners']; rawText: string;
    before: Fields; after: Fields; status: 'CITED_DATE_RANGE_ENDPOINT' | 'UNRESOLVED_RANGE'; quotes: string[]; literalRange: string | null }>
}
const fields = (p: Fields): Fields => ({ normalizedValue: p.normalizedValue, precision: p.precision, isAllDay: p.isAllDay, needsConfirmation: p.needsConfirmation, timezone: p.timezone })
const rangePattern = () => /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日?\s*[—–－\-~～至]\s*(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})日/gu
function date(year: string, month: string, day: string, referenceTime: string, timezone: string) {
  const p = interpretTimeD26(`${year ? year + '年' : ''}${month}月${day}日`, { type: 'event_start', referenceTime, timezone }).point
  if (p.needsConfirmation || p.precision !== 'date_only' || !p.normalizedValue) return null
  const [y, m, d] = p.normalizedValue.split('-').map(Number), check = new Date(Date.UTC(y, m - 1, d))
  return m === +month && d === +day && (!year || y === +year) && check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? p.normalizedValue : null
}

/** Resolve only model-declared source windows, with a reciprocal owner and
 * the same cited source span. No new time, owner, deadline or plan is created. */
export function groundSourceWindows(input: RecognitionResult, declarations: SourceWindowDeclaration[], context: { sourceText: string; referenceTime: string; timezone: string }) {
  const result = structuredClone(input), audit: SourceWindowAudit = { version: SOURCE_WINDOW_GROUNDING_VERSION, inferredFacts: 0, decisions: [] }
  const tasks = [...result.standaloneTasks, ...result.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
  const quote = (ids: string[]) => result.evidence.filter(e => ids.includes(e.id) && e.quote && context.sourceText.includes(e.quote)).map(e => ({ id: e.id, text: e.quote! }))
  for (const declaration of declarations) {
    const p = result.timePoints.find(t => t.tempId === declaration.id)
    if (!p) continue
    const allQuotes = quote(p.evidenceIds), owners = declaration.owners.map(o => o.kind === 'task' ? tasks.find(t => t.tempId === o.entityId) : result.materials.find(m => m.tempId === o.entityId))
    const ownerValid = owners.length > 0 && owners.every(o => o && (!('timePointTempIds' in o) || o.timePointTempIds.includes(p.tempId)))
      && p.type === (declaration.role === 'window_start' ? 'event_start' : 'event_end')
      && declaration.owners.every(o => (o.kind === 'task' ? p.relatedTaskTempIds : p.relatedMaterialTempIds).includes(o.entityId))
    const quotes = allQuotes.filter(q => owners.every(o => o?.evidenceIds.includes(q.id)))
    const found = quotes.flatMap(q => [...q.text.matchAll(rangePattern())].map(m => ({ q, m })))
    // Literal individual endpoints, clocks and unannounced values keep the
    // ordinary parser. This layer only handles cited calendar-date ranges.
    if (ownerValid && !found.length && ![...p.rawText.matchAll(rangePattern())].length) continue
    const before = fields(p), ranges = found.map(({ m }) => {
      const start = date(m[1] ?? '', m[2], m[3], context.referenceTime, context.timezone)
      const end = start && date(m[4] ?? start.slice(0, 4), m[5] ?? m[2], m[6], context.referenceTime, context.timezone)
      return { literal: m[0], start, end }
    })
    const unique = [...new Map(ranges.map(r => [r.start + ':' + r.end, r])).values()]
    const r = unique.length === 1 ? unique[0] : null, expected = declaration.role === 'window_start' ? r?.start : r?.end
    const rawRanges = [...p.rawText.matchAll(rangePattern())]
    const rawPoint = interpretTimeD26(p.rawText, { type: p.type, referenceTime: context.referenceTime, timezone: context.timezone }).point
    const rawMatches = r && (rawRanges.length === 1 && p.rawText.trim() === rawRanges[0][0] && ranges.some(v => v.literal === p.rawText.trim())
      || rawRanges.length === 0 && rawPoint.precision === 'date_only' && !rawPoint.needsConfirmation && rawPoint.normalizedValue === expected)
    // A clock-bearing date range must never be reduced to all-day dates.
    const clockFree = found.every(({ q, m }) => !/\d\s*[:：]\s*\d|\d\s*点|上午|下午|中午|晚上/u.test(q.text.slice(q.text.indexOf(m[0]), q.text.indexOf(m[0]) + m[0].length + 8)))
    const valid = ownerValid && r?.start && r.end && r.end >= r.start && rawMatches && clockFree
    Object.assign(p, valid ? { normalizedValue: expected!, precision: 'date_only', isAllDay: true, needsConfirmation: false, timezone: context.timezone }
      : { normalizedValue: null, precision: 'vague', isAllDay: false, needsConfirmation: true })
    audit.decisions.push({ id: p.tempId, role: declaration.role, owners: declaration.owners, rawText: p.rawText, before, after: fields(p),
      status: valid ? 'CITED_DATE_RANGE_ENDPOINT' : 'UNRESOLVED_RANGE', quotes: quotes.map(q => q.text), literalRange: r?.literal ?? null })
    if (!valid) {
      result.quality.needsHumanReview = true
      result.conflicts.push({ id: 'source-window:' + p.tempId, type: 'other', message: '办理窗口的日期或对象依据不一致，请核对；未推测日期或截止。', entityTempIds: [p.tempId, ...declaration.owners.map(o => o.entityId)], evidenceIds: p.evidenceIds, requiresDecision: true })
    }
  }
  return { result, audit }
}
