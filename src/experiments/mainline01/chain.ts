import { CapturePersistenceService } from '../../domain/v2/capture'
import { buildDomainCommitPlan, commitDomainPlan, selectionFromDraftItems } from '../../domain/v2/domainCommit'
import { workspaceV8ToLegacyView } from '../../domain/v2/legacyView'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import type { WorkspaceV8 } from '../../domain/v2/types'
import type { DraftItem } from '../../types'
import { artificialResponse, emptyWorkspace, LABEL, notices, NOW, type CaseName } from './fixtures'

export function memoryRepository() { return new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore()) }
export async function captureFixture(repository: CanonicalWorkspaceRepository, name: CaseName) {
  if (!await repository.load()) await repository.save(emptyWorkspace())
  const capture = new CapturePersistenceService(repository)
  const handle = await capture.beginCapture({ operationId: `mainline-01:${name}`, sourceType: 'text',
    title: `${LABEL} / ${name}`, rawText: notices[name], provider: 'manual', modelName: LABEL,
    promptVersion: 'engineering-mainline-01', pipelineVersion: 'mainline-01-isolated', now: NOW })
  await capture.recognize(handle, async () => artificialResponse(name, handle.sourceId))
  return handle
}

export function reviewView(workspace: WorkspaceV8, draftId: string) {
  const view = workspaceV8ToLegacyView(workspace)
  const draft = view.drafts.find((item) => item.id === draftId)
  if (!draft) throw new Error('TEST_DRAFT_REQUIRED')
  return { draft, source: view.sources.find((item) => item.id === draft.sourceId) ?? null }
}

// Test-only orchestration. Does NOT substitute for App.tsx's public confirmation guards.
// Passing explicit items denotes a simulated/user confirmation, never capture-time auto-commit.
export async function confirmItems(repository: CanonicalWorkspaceRepository, draftId: string, items: DraftItem[]) {
  const workspace = await repository.load()
  if (!workspace) throw new Error('TEST_WORKSPACE_REQUIRED')
  const result = workspace.extractionDrafts.find((item) => item.id === draftId)?.result
  if (!result) throw new Error('TEST_RESPONSE_REQUIRED')
  const plan = buildDomainCommitPlan(workspace, draftId, selectionFromDraftItems(result, items), NOW)
  return { plan, saved: await commitDomainPlan(repository, plan, NOW) }
}
