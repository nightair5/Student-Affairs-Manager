import type { RecognitionResult } from './types'
import { verifyWorkflowChannelEvidence, type WorkflowMaterialSupport } from './workflowChannelSupport'

export const ORDINARY_PROVIDER_SUPPORT_VERSION = 'ordinary-provider-declared-support-1.0.0'

export interface OrdinaryProviderInput {
  sourceId: string
  sourceVersionId: string
  sourceText: string
  referenceTime: string
  timezone: string
  /** Exact text included in this proxy request; omitted only in direct local tests. */
  processedSourceText?: string
}

/** RecognitionResult 2.0 has evidence references, not immutable wire scopes.
 * Keep those two citation spaces distinct while sharing the role verifier. */
export interface OrdinaryWorkflowMaterialSupport extends WorkflowMaterialSupport {
  citationKind: 'RECOGNITION_RESULT_EVIDENCE'
  channelEvidenceIds: string[]
  taskEvidenceIds: string[]
}

export interface OrdinaryProviderSidecar {
  ordinaryProviderSupport: {
    version: typeof ORDINARY_PROVIDER_SUPPORT_VERSION
    responseBoundary: 'SERVER_NORMALIZED_RECOGNITION_RESULT_NOT_UPSTREAM_RAW'
    upstreamRaw: 'NOT_OBSERVABLE_THROUGH_THIS_PROXY'
    inferredFacts: 0
    sourceId: string
    sourceVersionId: string
    referenceTime: string
    timezone: string
    processedCharacterCount: number
    originalProxyResponse: string
    originalProxyRecognitionResult: RecognitionResult
    sourceBinding: Array<{ evidenceId: string; originalSourceId: string; sourceId: string }>
    decisions: Array<{ materialId: string; ownerTaskId: string | null; status: 'VERIFIED_DECLARED_WORKFLOW' | 'NOT_PROVEN'; reason: string }>
    workflowMaterialSupport: OrdinaryWorkflowMaterialSupport[]
    unsupportedContractFields: ['participation', 'personalCondition', 'declaredExecutionChannel']
  }
}

const compact = (value: string) => value.replace(/\s/gu, '')

/** Bind only the official proxy's documented placeholder to this capture.
 * A genuine foreign source is not a placeholder and cannot be reassigned. */
export function bindOrdinaryProviderSupport(original: RecognitionResult, input: OrdinaryProviderInput, originalProxyResponse: string) {
  if (!input.sourceId || !input.sourceVersionId) throw Error('ORDINARY_PROVIDER_CAPTURE_REQUIRED')
  if (original.evidence.some(e => e.sourceId !== 'pending-source' && e.sourceId !== input.sourceId)) {
    throw Error('ORDINARY_PROVIDER_FOREIGN_SOURCE')
  }
  const result = structuredClone(original)
  const sourceBinding = result.evidence.map(e => ({ evidenceId: e.id, originalSourceId: e.sourceId, sourceId: input.sourceId }))
  result.evidence.forEach(e => { e.sourceId = input.sourceId })
  const tasks = [...result.standaloneTasks, ...result.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
  const decisions: OrdinaryProviderSidecar['ordinaryProviderSupport']['decisions'] = []
  const workflowMaterialSupport: OrdinaryWorkflowMaterialSupport[] = []
  const evidence = (ids: string[]) => {
    if (!ids.length || new Set(ids).size !== ids.length) return null
    const refs = ids.map(id => result.evidence.find(e => e.id === id))
    if (refs.some(e => !e || e.sourceId !== input.sourceId || !e.quote?.trim()
      || !(input.processedSourceText ?? input.sourceText).includes(e.quote))) return null
    return refs.flatMap(e => e ? [{ id: e.id, quote: e.quote! }] : [])
  }
  for (const material of result.materials) {
    if (material.submissionChannel === null) continue
    const owners = tasks.filter(t => material.relatedTaskTempIds.includes(t.tempId) && t.materialTempIds.includes(material.tempId))
    const exactOwners = material.relatedTaskTempIds.length === 1 && owners.length === 1
      && material.relatedTaskTempIds[0] === owners[0].tempId
    const owner = exactOwners ? owners[0] : null
    const materialRefs = evidence(material.evidenceIds), taskRefs = owner && evidence(owner.evidenceIds)
    const channelRefs = [...(materialRefs ?? []), ...(taskRefs ?? [])]
      .filter((e, i, all) => all.findIndex(v => v.id === e.id) === i)
    const closedObject = !!owner && compact(owner.actionObject).includes(compact(material.name))
      && !!materialRefs?.some(e => compact(e.quote).includes(compact(material.name)))
    // Both surfaces are already explicit fields. This concatenation supplies
    // only a quoted surface for verification; it creates no new task or value.
    const actionSurface = owner ? `${owner.actionVerb}${owner.actionObject}` : ''
    const proof = owner && materialRefs && taskRefs && closedObject && /^(?:上传|提交)$/u.test(owner.actionVerb)
      ? verifyWorkflowChannelEvidence({ sourceText: input.sourceText, channel: material.submissionChannel,
        channelQuotes: channelRefs.map(e => e.quote), taskQuotes: taskRefs.map(e => e.quote),
        actionSurface, objectSurface: owner.actionObject }) : null
    decisions.push({ materialId: material.tempId, ownerTaskId: owner?.tempId ?? null,
      status: proof ? 'VERIFIED_DECLARED_WORKFLOW' : 'NOT_PROVEN',
      reason: !owner ? 'SINGLE_RECIPROCAL_OWNER_REQUIRED' : !proof ? 'LITERAL_CURRENT_OBJECT_WORKFLOW_NOT_PROVEN' : 'EXISTING_VALUE_AND_OWNER_ONLY' })
    if (proof && owner && taskRefs) workflowMaterialSupport.push({ ...proof, materialId: material.tempId,
      ownerTaskIds: [owner.tempId], channel: material.submissionChannel,
      channelScopeIds: [], taskScopeIds: [], citationKind: 'RECOGNITION_RESULT_EVIDENCE',
      channelEvidenceIds: channelRefs.map(e => e.id), taskEvidenceIds: taskRefs.map(e => e.id),
      channelQuotes: channelRefs.map(e => e.quote), taskQuotes: taskRefs.map(e => e.quote),
      actionSurface, objectSurface: owner.actionObject, sourceId: input.sourceId, sourceVersionId: input.sourceVersionId })
  }
  const sidecar: OrdinaryProviderSidecar = { ordinaryProviderSupport: {
    version: ORDINARY_PROVIDER_SUPPORT_VERSION, responseBoundary: 'SERVER_NORMALIZED_RECOGNITION_RESULT_NOT_UPSTREAM_RAW',
    upstreamRaw: 'NOT_OBSERVABLE_THROUGH_THIS_PROXY', inferredFacts: 0,
    sourceId: input.sourceId, sourceVersionId: input.sourceVersionId, referenceTime: input.referenceTime, timezone: input.timezone,
    processedCharacterCount: (input.processedSourceText ?? input.sourceText).length,
    originalProxyResponse, originalProxyRecognitionResult: structuredClone(original), sourceBinding,
    decisions, workflowMaterialSupport,
    unsupportedContractFields: ['participation', 'personalCondition', 'declaredExecutionChannel'],
  } }
  return { result, sidecar }
}

export function ordinaryWorkflowMaterialSupportFromSidecar(value: unknown): OrdinaryWorkflowMaterialSupport[] {
  if (!value || typeof value !== 'object' || !('ordinaryProviderSupport' in value)) return []
  const audit = value.ordinaryProviderSupport
  if (!audit || typeof audit !== 'object' || !('version' in audit) || audit.version !== ORDINARY_PROVIDER_SUPPORT_VERSION
    || !('workflowMaterialSupport' in audit) || !Array.isArray(audit.workflowMaterialSupport)) return []
  return audit.workflowMaterialSupport.filter((p): p is OrdinaryWorkflowMaterialSupport => !!p && typeof p === 'object'
    && p.citationKind === 'RECOGNITION_RESULT_EVIDENCE'
    && ['materialId', 'channel', 'sourceId', 'sourceVersionId', 'actionSurface', 'objectSurface', 'workflowText'].every(k => typeof p[k] === 'string')
    && ['ownerTaskIds', 'channelScopeIds', 'taskScopeIds', 'channelQuotes', 'taskQuotes', 'channelEvidenceIds', 'taskEvidenceIds'].every(k => Array.isArray(p[k]) && p[k].every((v: unknown) => typeof v === 'string')))
}

/** The inference clock is the submitted request's clock, not response receipt
 * time. Recorded environments can still supply their original frozen clock. */
export function ordinaryProviderContextFromSidecar(value: unknown): { referenceTime: string; timezone: string } | undefined {
  if (!value || typeof value !== 'object' || !('ordinaryProviderSupport' in value)) return undefined
  const audit = value.ordinaryProviderSupport
  if (!audit || typeof audit !== 'object' || !('version' in audit) || audit.version !== ORDINARY_PROVIDER_SUPPORT_VERSION
    || !('referenceTime' in audit) || typeof audit.referenceTime !== 'string'
    || !('timezone' in audit) || typeof audit.timezone !== 'string') return undefined
  return { referenceTime: audit.referenceTime, timezone: audit.timezone }
}
