import { confirmationRevisionV2, confirmationStateV2, reviewEditsV2 } from '../../domain/v2/confirmationV2'
import { workspaceV8ToLegacyView } from '../../domain/v2/legacyView'
import type { WorkspaceV8 } from '../../domain/v2/types'

export function reviewAdapter(workspace: WorkspaceV8, draftId: string, choices: Readonly<Record<string, boolean>> = {}) {
  const view = workspaceV8ToLegacyView(workspace)
  const draft = view.drafts.find(item => item.id === draftId)
  if (!draft?.recognitionResult) throw new Error('MAINLINE_DRAFT_NOT_READY')
  const edits = reviewEditsV2(workspace, draftId)
  const states = Object.fromEntries(draft.items.map(item => [item.id, confirmationStateV2(workspace, draftId, item.suggestion.id)]))
  return { revision: confirmationRevisionV2(workspace), states, draft: { ...draft, items: draft.items.map(item => ({
    ...item,
    selected: item.status === '待确认' && !states[item.id].blockedReason
      && (Object.hasOwn(choices, item.id) ? choices[item.id] : states[item.id].defaultSelected),
    suggestion: { ...item.suggestion, ...edits.overrides[item.suggestion.id], deadline: states[item.id].value },
  })) } }
}

export function selectedIntent(workspace: WorkspaceV8, draftId: string, itemIds: readonly string[], choices: Readonly<Record<string, boolean>> = {}) {
  const review = reviewAdapter(workspace, draftId, choices)
  if (!itemIds.length || Object.keys(itemIds).length !== itemIds.length || new Set(itemIds).size !== itemIds.length) throw new Error('MAINLINE_SELECTION_INVALID')
  const taskTempIds = itemIds.map(id => {
    const item = review.draft.items.find(candidate => candidate.id === id)
    if (!item || item.status !== '待确认' || review.states[id].blockedReason) throw new Error('MAINLINE_ITEM_NOT_CONFIRMABLE')
    return item.suggestion.id
  })
  return { draftId, revision: review.revision, taskTempIds }
}
