import type { ActionCandidateComposition } from './actionCandidateComposerV2'
import { indexLocalActionCandidatesV2, type LocalActionCandidateCatalog } from './localActionCandidateIndexV2'
import type { ImmutableScopeIndex } from './scopeReferenceContract'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { jsonStructurallyEqual } from './jsonStructuralEqual'

// Capture before the first await so caller mutations cannot replace checked input.
export async function captureVerifiedCandidateInputs(
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  composition: ActionCandidateComposition,
): Promise<{ index: ImmutableScopeIndex; catalog: LocalActionCandidateCatalog; composition: ActionCandidateComposition }> {
  if (![index, catalog, composition].every((value) => jsonStructurallyEqual(value, value))) {
    throw new Error('RCO5010_INPUT_NOT_DENSE_JSON')
  }
  const captured = structuredClone({ index, catalog, composition })
  const rebuiltIndex = await indexImmutableScopesV11(captured.index.sourceId, captured.index.sourceVersionId, captured.index.sourceContent)
  if (!jsonStructurallyEqual(captured.index, rebuiltIndex)) throw new Error('RCO5010_SCOPE_NOT_DERIVED_FROM_SOURCE')
  const rebuiltCatalog = await indexLocalActionCandidatesV2(rebuiltIndex)
  if (!jsonStructurallyEqual(captured.catalog, rebuiltCatalog)) throw new Error('RCO5010_CATALOG_NOT_DERIVED_FROM_SOURCE')
  return { index: rebuiltIndex, catalog: rebuiltCatalog, composition: captured.composition }
}
