import {
  validateActionCandidateClassification,
  type ActionCandidateClassificationIssue,
  type ActionCandidateClassificationResponse,
  type ActionCandidateVerdict,
} from './actionCandidateClassificationContract'
import {
  validateLocalActionCandidateCatalogV2,
  type LocalActionCandidate,
  type LocalActionCandidateCatalog,
} from './localActionCandidateIndexV2'
import type { ImmutableScopeIndex } from './scopeReferenceContract'
import type { ReducedDirectiveAnchor, ReducedModelAnchors } from './taskFormationPolicyV2'

export const ACTION_CANDIDATE_COMPOSER_V2_VERSION = 'action-candidate-composer-1.2.0' as const

export type CandidateLedgerStatus =
  | 'accepted_local'
  | 'accepted_model'
  | 'ignored_local'
  | 'ignored_model'
  | 'quarantined'

export interface CandidateLedgerEntry {
  candidateId: string
  anchorId: string | null
  status: CandidateLedgerStatus
  modelVerdict: ActionCandidateVerdict | null
  objectCandidateId: string | null
  reasons: string[]
}

export interface ActionCandidateComposition {
  composerVersion: typeof ACTION_CANDIDATE_COMPOSER_V2_VERSION
  status: 'complete' | 'partial'
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  catalogFingerprint: string
  responseContractComplete: boolean
  semanticCoverageComplete: boolean
  reduced: ReducedModelAnchors
  ledger: CandidateLedgerEntry[]
  candidateIssues: ActionCandidateClassificationIssue[]
  diagnostics: {
    catalogCandidates: number
    acceptedLocal: number
    acceptedModel: number
    ignoredLocal: number
    ignoredModel: number
    quarantined: number
    unresolvedActionScopeIds: string[]
    unknownResponseCandidateIds: string[]
  }
}

export type ActionCandidateCompositionResult =
  | { ok: true; value: ActionCandidateComposition }
  | { ok: false; issues: ActionCandidateClassificationIssue[] }

function issueCodes(candidateId: string, issues: ActionCandidateClassificationIssue[]): string[] {
  return issues.filter((issue) => issue.candidateId === candidateId).map((issue) => issue.code)
}

function selectedObject(candidate: LocalActionCandidate, objectCandidateId: string | null) {
  return objectCandidateId ? candidate.objectCandidates.find((object) => object.id === objectCandidateId) ?? null : null
}

function directive(candidate: LocalActionCandidate, objectCandidateId: string, index: ImmutableScopeIndex): ReducedDirectiveAnchor | null {
  const object = selectedObject(candidate, objectCandidateId)
  if (!object) return null
  const scopeOrder = new Map(index.scopes.map((scope) => [scope.id, scope.order]))
  return {
    anchorId: candidate.id,
    propositionScopeIds: [...new Set([...candidate.propositionScopeIds, object.scopeId])]
      .sort((left, right) => (scopeOrder.get(left) ?? 0) - (scopeOrder.get(right) ?? 0)),
    actionTypeHint: candidate.action.actionType,
    actionSurfaceHint: { scopeId: candidate.action.scopeId, surface: candidate.action.surface },
    objectSurfaceHint: { scopeId: object.scopeId, surface: object.surface },
    timeRefs: [],
    materialRefs: [],
    eventRef: null,
    locationRef: null,
  }
}

export async function composeActionCandidatesV2(
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  response: unknown,
  expectedProducerRunId?: string,
): Promise<ActionCandidateCompositionResult> {
  const catalogIssues = await validateLocalActionCandidateCatalogV2(catalog, index)
  if (catalogIssues.length > 0) {
    return {
      ok: false,
      issues: catalogIssues.map((issue) => ({ ...issue })),
    }
  }
  const validation = validateActionCandidateClassification(response, catalog, expectedProducerRunId)
  if (!validation.rootUsable) return { ok: false, issues: validation.globalIssues }
  const typedResponse = response as ActionCandidateClassificationResponse
  const ledger: CandidateLedgerEntry[] = []
  const directives: ReducedDirectiveAnchor[] = []

  for (const candidate of catalog.candidates) {
    const classification = validation.validClassifications.get(candidate.id)
    const localIssueCodes = issueCodes(candidate.id, validation.candidateIssues)
    if (candidate.localDisposition === 'local_non_task') {
      ledger.push({
        candidateId: candidate.id,
        anchorId: null,
        status: 'ignored_local',
        modelVerdict: classification?.verdict ?? null,
        objectCandidateId: null,
        reasons: [...candidate.dispositionReasons, ...localIssueCodes],
      })
      continue
    }

    if (candidate.localDisposition === 'local_proposition') {
      const objectCandidateId = candidate.defaultObjectCandidateId
        ?? (classification?.verdict === 'proposition' ? classification.objectCandidateId : null)
      const anchor = objectCandidateId ? directive(candidate, objectCandidateId, index) : null
      if (anchor) {
        directives.push(anchor)
        ledger.push({
          candidateId: candidate.id,
          anchorId: anchor.anchorId,
          status: 'accepted_local',
          modelVerdict: classification?.verdict ?? null,
          objectCandidateId,
          reasons: [
            ...candidate.dispositionReasons,
            ...localIssueCodes,
            classification?.verdict === 'proposition' ? 'MODEL_OBJECT_USED_ONLY_WITHIN_LOCAL_CLOSED_SET' : 'LOCAL_PROPOSITION_CANNOT_BE_DELETED_BY_MODEL',
          ],
        })
      } else {
        ledger.push({
          candidateId: candidate.id,
          anchorId: null,
          status: 'quarantined',
          modelVerdict: classification?.verdict ?? null,
          objectCandidateId: null,
          reasons: [...candidate.dispositionReasons, ...localIssueCodes, 'LOCAL_PROPOSITION_OBJECT_UNRESOLVED'],
        })
      }
      continue
    }

    if (!classification || localIssueCodes.length > 0) {
      ledger.push({
        candidateId: candidate.id,
        anchorId: null,
        status: 'quarantined',
        modelVerdict: classification?.verdict ?? null,
        objectCandidateId: null,
        reasons: [...candidate.dispositionReasons, ...localIssueCodes, 'MODEL_CLASSIFICATION_UNUSABLE'],
      })
      continue
    }
    if (classification.verdict === 'mention_only') {
      ledger.push({
        candidateId: candidate.id,
        anchorId: null,
        status: 'ignored_model',
        modelVerdict: classification.verdict,
        objectCandidateId: null,
        reasons: [...candidate.dispositionReasons, 'MODEL_CLASSIFIED_MENTION_ONLY'],
      })
      continue
    }
    if (classification.verdict === 'uncertain') {
      ledger.push({
        candidateId: candidate.id,
        anchorId: null,
        status: 'quarantined',
        modelVerdict: classification.verdict,
        objectCandidateId: null,
        reasons: [...candidate.dispositionReasons, 'MODEL_CLASSIFIED_UNCERTAIN'],
      })
      continue
    }
    const anchor = classification.objectCandidateId ? directive(candidate, classification.objectCandidateId, index) : null
    if (!anchor) {
      ledger.push({
        candidateId: candidate.id,
        anchorId: null,
        status: 'quarantined',
        modelVerdict: classification.verdict,
        objectCandidateId: null,
        reasons: [...candidate.dispositionReasons, 'MODEL_OBJECT_NOT_COMPOSABLE'],
      })
      continue
    }
    directives.push(anchor)
    ledger.push({
      candidateId: candidate.id,
      anchorId: anchor.anchorId,
      status: 'accepted_model',
      modelVerdict: classification.verdict,
      objectCandidateId: classification.objectCandidateId,
      reasons: [...candidate.dispositionReasons, 'MODEL_CLASSIFIED_PROPOSITION_WITH_OWNED_OBJECT'],
    })
  }

  const usedScopeIds = new Set(directives.flatMap((item) => item.propositionScopeIds))
  const reduced: ReducedModelAnchors = {
    schemaVersion: 'reduced-model-anchors-1.0.0',
    sourceId: catalog.sourceId,
    sourceVersionId: catalog.sourceVersionId,
    sourceFingerprint: catalog.sourceFingerprint,
    producerRunId: typedResponse.producerRunId,
    directives,
    observations: [],
    ignoredScopeIds: index.scopes.filter((scope) => !usedScopeIds.has(scope.id)).map((scope) => scope.id),
    discardedModelAuthority: ['requiresAction', 'semantics', 'inferenceLevel', 'effect', 'revisionRefs', 'selected'],
  }
  const quarantined = ledger.filter((entry) => entry.status === 'quarantined').length
  const semanticCoverageComplete = validation.completeness === 'complete'
    && quarantined === 0
    && catalog.unresolvedActionScopeIds.length === 0
  const value: ActionCandidateComposition = {
    composerVersion: ACTION_CANDIDATE_COMPOSER_V2_VERSION,
    status: semanticCoverageComplete ? 'complete' : 'partial',
    sourceId: catalog.sourceId,
    sourceVersionId: catalog.sourceVersionId,
    sourceFingerprint: catalog.sourceFingerprint,
    catalogFingerprint: catalog.catalogFingerprint,
    responseContractComplete: validation.completeness === 'complete',
    semanticCoverageComplete,
    reduced,
    ledger,
    candidateIssues: validation.candidateIssues,
    diagnostics: {
      catalogCandidates: catalog.candidates.length,
      acceptedLocal: ledger.filter((entry) => entry.status === 'accepted_local').length,
      acceptedModel: ledger.filter((entry) => entry.status === 'accepted_model').length,
      ignoredLocal: ledger.filter((entry) => entry.status === 'ignored_local').length,
      ignoredModel: ledger.filter((entry) => entry.status === 'ignored_model').length,
      quarantined,
      unresolvedActionScopeIds: [...catalog.unresolvedActionScopeIds],
      unknownResponseCandidateIds: validation.candidateIssues
        .filter((issue) => issue.code === 'UNKNOWN_CANDIDATE_ID' && issue.candidateId)
        .map((issue) => issue.candidateId as string),
    },
  }
  return { ok: true, value }
}

export function deriveRequiresActionWithCoverageV2(
  localRequiresAction: boolean,
  composition: Pick<ActionCandidateComposition, 'semanticCoverageComplete'>,
): boolean | null {
  if (localRequiresAction) return true
  return composition.semanticCoverageComplete ? false : null
}
