import type { RecognitionResult } from './types'
import type { WorkspaceV8 } from '../domain/v2/types'

export const SOURCE_INFORMATION_PREVIEW_VERSION = 'source-information-preview-1.0.0'
export interface SourceInformationPreview {
  version: typeof SOURCE_INFORMATION_PREVIEW_VERSION
  sourceId: string
  sourceVersionId: string
  inferredFacts: 0
  items: Array<{ text: string; evidenceIds: string[] }>
  suppressed: Array<{ text: string; reason: 'UNSUPPORTED_SOURCE' | 'ENTITY_EVIDENCE_ALREADY_DISPLAYED' | 'DUPLICATE' }>
}

/** Display existing source-level information verbatim. This does not infer an
 * entity, owner, relation, obligation, or the semantic correctness of the wire. */
export function projectSourceInformation(result: RecognitionResult, source: { sourceId: string; sourceVersionId: string; text: string }): SourceInformationPreview {
  const taskEvidence = [...result.standaloneTasks, ...result.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])].flatMap(t => t.evidenceIds)
  const used = new Set([...taskEvidence, ...result.events.flatMap(e => e.evidenceIds), ...result.materials.flatMap(m => m.evidenceIds), ...result.timePoints.flatMap(p => p.evidenceIds)])
  const preview: SourceInformationPreview = { version: SOURCE_INFORMATION_PREVIEW_VERSION, sourceId: source.sourceId, sourceVersionId: source.sourceVersionId, inferredFacts: 0, items: [], suppressed: [] }
  for (const info of result.ignoredContent) {
    if (info.reason !== 'other') continue
    const text = info.text.trim(), evidence = result.evidence.filter(e => e.sourceId === source.sourceId && e.quote && source.text.includes(e.quote) && e.quote.includes(text))
    const reason = !text || !source.text.includes(text) || !evidence.length ? 'UNSUPPORTED_SOURCE' :
      evidence.some(e => used.has(e.id)) ? 'ENTITY_EVIDENCE_ALREADY_DISPLAYED' :
      preview.items.some(item => item.text === text) ? 'DUPLICATE' : null
    if (reason) preview.suppressed.push({ text, reason })
    else preview.items.push({ text, evidenceIds: evidence.map(e => e.id) })
  }
  return preview
}

/** A stale draft must not present an old source version as current information. */
export function currentDraftSourceInformation(workspace: WorkspaceV8, draftId: string): { status: 'CURRENT'; preview: SourceInformationPreview } | { status: 'SOURCE_VERSION_UNAVAILABLE' } {
  const draft = workspace.extractionDrafts.find(d => d.id === draftId)
  const run = workspace.recognitionRuns.find(r => r.id === draft?.recognitionRunId)
  const version = workspace.sourceVersions.find(v => v.id === run?.sourceVersionId)
  const source = workspace.sources.find(s => s.id === version?.sourceId)
  if (!draft?.result || !version || !source || source.currentVersionId !== version.id || version.rawText === null) return { status: 'SOURCE_VERSION_UNAVAILABLE' }
  return { status: 'CURRENT', preview: projectSourceInformation(draft.result, { sourceId: source.id, sourceVersionId: version.id, text: version.rawText }) }
}
