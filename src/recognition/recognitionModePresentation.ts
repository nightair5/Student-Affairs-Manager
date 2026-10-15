import type { WorkspaceV8 } from '../domain/v2/types'

/** Persisted capture/run provenance decides mode; model-name substrings do not. */
export function recognitionModeDescription(workspace: WorkspaceV8 | null, draftId: string): string {
  const draft = workspace?.extractionDrafts.find(d => d.id === draftId)
  const run = workspace?.recognitionRuns.find(r => r.id === draft?.recognitionRunId)
  const version = workspace?.sourceVersions.find(v => v.id === run?.sourceVersionId)
  const source = workspace?.sources.find(s => s.id === version?.sourceId)
  const metadata = source?.legacyData?.recognitionProvenance
  const recorded = run?.legacyData?.recordedResponse
  const record = (v: unknown): Record<string, unknown> | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
  const provenance = record(metadata), response = record(recorded)
  const role = provenance?.responseRole ?? response?.role
  if (role === 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT') return '匿名工程夹具 · 无模型请求'
  if (role === 'RECORDED_MODEL_ENGINEERING_REPLAY') return '已录制模型建议 · 无新模型请求'
  if (role !== undefined) return '已保存的识别建议 · 运行模式需核对'
  if (run?.provider === 'deepseek') return 'AI识别建议'
  if (run?.provider === 'local-rules') return '本地规则建议'
  if (run?.provider === 'manual') return '手动录入建议'
  return '已保存的识别建议'
}

export function timePointDisplayLabel(type: string): string {
  const names: Record<string, string> = {
    registration_deadline: '报名截止', submission_deadline: '提交截止', task_deadline: '任务截止',
    event_start: '开始时间', event_end: '结束时间', announcement_time: '公布时间',
    planned_start: '个人计划开始', reminder_time: '提醒时间',
  }
  return names[type] ?? '时间说明'
}

/** Display the stored local value without timezone conversion or guessed clock. */
export function timePointDisplayValue(normalizedValue:string|null,rawText:string):string {
  const match=normalizedValue?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/u)
  return match?`${match[1]}年${Number(match[2])}月${Number(match[3])}日${match[4]?` ${match[4]}:${match[5]}`:''}`:rawText
}

/** A model-proposed option remains an option; only its exact ISO literal is rendered. */
export function recognitionOptionDisplay(value:string):string {
  return value.replace(/\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?\b/gu,literal=>timePointDisplayValue(literal,literal))
}
