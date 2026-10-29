import { directBatch } from '../domain/v2/directIntake'
import type { WorkspaceV8 } from '../domain/v2/types'
import { currentDraftSourceInformation } from './sourceInformationPreview'

/** Source-level notes are not asserted to belong to an event.  Resolve them
 * through the formal event's one active batch rather than recognition-local
 * evidence IDs, which can be reused by different notices. */
function eventSource(workspace: WorkspaceV8 | null, eventId: string) {
  if (!workspace) return null
  const event = workspace.events.find(item => item.id === eventId)
  if (!event) return null
  const owners = workspace.extractionDrafts.flatMap(draft => {
    const batch = directBatch(draft)
    return batch?.status === 'active' && batch.draftId === draft.id &&
      batch.items.some(item => item.kind === 'event' && item.id === eventId) ? [{ draft, batch }] : []
  })
  if (owners.length !== 1) return null
  const { draft, batch } = owners[0]
  const run = workspace.recognitionRuns.find(item => item.id === draft.recognitionRunId)
  const version = workspace.sourceVersions.find(item => item.id === run?.sourceVersionId)
  const source = workspace.sources.find(item => item.id === version?.sourceId)
  if (!run || !version || !source || batch.sourceId !== source.id || source.currentVersionId !== version.id ||
      (typeof event.legacyData?.sourceId === 'string' && event.legacyData.sourceId !== source.id)) return null
  return {event,draft,source,version}
}

export function eventSourceDraftId(workspace: WorkspaceV8 | null,eventId: string): string | null {
  return eventSource(workspace,eventId)?.draft.id ?? null
}

/** Legacy events have no direct batch. Retain their source only where the
 * available canonical source hint and evidence identify exactly one draft. */
export function eventEvidenceDraftId(workspace: WorkspaceV8 | null,eventId: string,evidenceIds: string[]): string | null {
  const direct=eventSourceDraftId(workspace,eventId)
  if (direct || !workspace) return direct
  const event=workspace.events.find(item=>item.id===eventId)
  if (!event || event.legacyData?.directMode || !evidenceIds.length) return null
  const sourceHint=typeof event.legacyData?.sourceId==='string'?event.legacyData.sourceId:null
  const versions=[...new Set(workspace.historyRecords.filter(record=>record.entityType==='event'&&record.entityId===eventId&&record.action==='created'&&record.sourceVersionId).map(record=>record.sourceVersionId!))]
  if(versions.length>1)return null
  const historySource=versions.length===1?workspace.sourceVersions.find(version=>version.id===versions[0])?.sourceId:null
  if(versions.length===1&&!historySource || sourceHint&&historySource&&sourceHint!==historySource)return null
  const sourceId=sourceHint??historySource
  if(!sourceId)return null
  const candidates=workspace.extractionDrafts.filter(draft=>{
    if (!draft.result?.evidence.some(evidence=>evidenceIds.includes(evidence.id))) return false
    const run=workspace.recognitionRuns.find(item=>item.id===draft.recognitionRunId)
    const version=workspace.sourceVersions.find(item=>item.id===run?.sourceVersionId)
    return version?.sourceId===sourceId&&(!versions.length||version.id===versions[0])
  })
  return candidates.length===1?candidates[0].id:null
}

// Expand a uniquely located quote to the original complete source sentence.
// Never display a clipped fragment which could omit a negation or condition.
function completeStatement(quote: string,source: string): string | null {
  const text=quote.trim(), index=source.indexOf(text)
  if (!text || index < 0 || index !== source.lastIndexOf(text)) return null
  const delimiters=/[。！？!?；;\n]/u
  if(delimiters.test(text.replace(/[。！？!?；;]+$/u,'')))return null
  let start=index,end=index+text.length
  while(start>0&&!delimiters.test(source[start-1]))start--
  if(!delimiters.test(source[end-1]))while(end<source.length&&!delimiters.test(source[end]))end++
  const statement=source.slice(start,end).trim()
  return statement.length<=500?statement:null
}

export function eventSourceSupplement(workspace: WorkspaceV8 | null, eventId: string): string[] {
  const owner=eventSource(workspace,eventId)
  if (!owner || !workspace || !owner.version.rawText || !owner.draft.result) return []
  const {event,draft,version}=owner
  const information = currentDraftSourceInformation(workspace, draft.id)
  if (information.status !== 'CURRENT') return []
  const output:string[]=[]
  for(const item of information.preview.items){
    const statements=[...new Set(item.evidenceIds.flatMap(id=>{
      const evidence=draft.result!.evidence.find(ref=>ref.id===id)
      if(evidence?.sourceId!==owner.source.id||!evidence.quote?.includes(item.text))return []
      const full=completeStatement(evidence.quote,version.rawText!)
      return full?[full]:[]
    }))]
    if(statements.length===1&&!event.description?.includes(statements[0])&&!output.includes(statements[0]))output.push(statements[0])
  }
  return output
}
