import type { WorkspaceV8 } from './types'
export const EVENT_DISPOSITION_VERSION = 'ordinary-event-disposition-1'
export type EventDisposition = 'keep' | 'defer' | 'reject'
export const eventDispositionField = (id: string) => `event-disposition:${id}`
/** User history is authoritative. Unchecking alone never implies rejection. */
export function eventDisposition(workspace: WorkspaceV8 | null, draftId: string, eventId: string): EventDisposition {
  const draft = workspace?.extractionDrafts.find(d => d.id === draftId)
  if (draft?.rejectedEntityTempIds.includes(eventId)) return 'reject'
  const last = workspace?.historyRecords.filter(h => h.entityType === 'extraction_draft' && h.entityId === draftId && h.actor === 'user' && h.fieldName === eventDispositionField(eventId)).at(-1)
  if (last?.after === 'reject' || last?.after === 'defer' || last?.after === 'keep') return last.after
  return draft?.result?.events.find(e => e.tempId === eventId)?.selected === false ? 'defer' : 'keep'
}
