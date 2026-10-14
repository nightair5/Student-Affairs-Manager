import type { WireContext } from '../experiments/realInput01/modelWire'
import { decodeFactRoleRecording, projectFactRole, type FactRoleFacts } from './factRoleContract'
import { ROLE_AUTHORITY_VERSION } from './sourceContractV7'
import { projectParticipationSupport } from './participationSupportProjection'
import { projectWorkflowChannelSupport, WORKFLOW_CHANNEL_SUPPORT_VERSION, type WorkflowMaterialSupport } from './workflowChannelSupport'
import { groundMaterialChannels } from './materialChannelGrounding'

export const CURRENT_FACT_ROLE_PRODUCT_VERSION = 'declared-support-current-product-1.0.0'

/** Only a current decoder's typed proof is offered to the ordinary assembler.
 * The material grounder independently rechecks its source, owner and wording. */
export function workflowMaterialSupportFromSidecar(value: unknown): WorkflowMaterialSupport[] {
  if (!value || typeof value !== 'object' || !('currentDeclaredSupport' in value)) return []
  const current = value.currentDeclaredSupport
  if (!current || typeof current !== 'object' || !('version' in current)
    || current.version !== CURRENT_FACT_ROLE_PRODUCT_VERSION || !('channels' in current)) return []
  const channels = current.channels
  if (!channels || typeof channels !== 'object' || !('version' in channels)
    || channels.version !== WORKFLOW_CHANNEL_SUPPORT_VERSION || !('materialSupport' in channels)
    || !Array.isArray(channels.materialSupport)) return []
  return channels.materialSupport.filter((p): p is WorkflowMaterialSupport => !!p && typeof p === 'object'
    && ['materialId', 'channel', 'sourceId', 'sourceVersionId', 'actionSurface', 'objectSurface', 'workflowText'].every(k => typeof (p as Record<string, unknown>)[k] === 'string')
    && ['ownerTaskIds', 'channelScopeIds', 'taskScopeIds', 'channelQuotes', 'taskQuotes'].every(k => Array.isArray((p as Record<string, unknown>)[k])
      && ((p as Record<string, unknown>)[k] as unknown[]).every(v => typeof v === 'string')))
}

/** Current product compatibility is deliberately separate from the frozen
 * decoder. Only inverse evidence indices are derived; original facts, raw
 * response, generation contract and historical assertions remain observable. */
export function decodeCurrentFactRoleRecording(raw: string, context: WireContext, role: 'EngineeringFixture' | 'SingleAuthority' = 'EngineeringFixture') {
  if (new TextEncoder().encode(raw).byteLength > 524288) throw Error('CURRENT_FACT_ROLE_SIZE')
  const envelope = JSON.parse(raw)
  const texts = Array.isArray(envelope.output) ? envelope.output
    .filter((m: { type?: string }) => m.type === 'message')
    .flatMap((m: { content?: Array<{ type: string; text: string }> }) => m.content?.filter(c => c.type === 'output_text') ?? []) : []
  if (texts.length !== 1 || typeof texts[0].text !== 'string') throw Error('CURRENT_FACT_ROLE_RESPONSE')
  const original = JSON.parse(texts[0].text) as FactRoleFacts
  const factProjection = projectFactRole(original, context)
  const { requirements, ...base } = factProjection.projected
  void requirements
  const participation = projectParticipationSupport({ ...base, schemaVersion: ROLE_AUTHORITY_VERSION }, context)
  const channels = projectWorkflowChannelSupport(participation.projected, context)
  const compatible = { ...original, tasks: original.tasks.map(task => {
    const indexed = channels.projected.tasks.find(t => t.id === task.id)
    if (!indexed) throw Error('CURRENT_FACT_ROLE_TASK_OWNER')
    return { ...task, propositionScopeIds: indexed.propositionScopeIds }
  }) }
  texts[0].text = JSON.stringify(compatible)
  // The original strict Schema and full downstream graph checks still run.
  const decoded = decodeFactRoleRecording(JSON.stringify(envelope), context, role)
  // The historical nested assembler ran before this version's workflow proof
  // existed. Reconsider only a channel present verbatim in the original wire,
  // then independently revalidate it through the ordinary material grounder.
  const candidate = structuredClone(decoded.result)
  for (const proof of channels.audit.materialSupport) {
    const originalMaterial = original.materials.find(m => m.tempId === proof.materialId)
    const material = candidate.materials.find(m => m.tempId === proof.materialId)
    if (originalMaterial?.submissionChannel === proof.channel && material?.submissionChannel === null
      && originalMaterial.name === material.name
      && JSON.stringify(originalMaterial.relatedTaskTempIds) === JSON.stringify(material.relatedTaskTempIds)) material.submissionChannel = originalMaterial.submissionChannel
  }
  const grounded = groundMaterialChannels(candidate, context.index.sourceContent, channels.audit.materialSupport)
  const restoredIds = new Set(grounded.audit.decisions.filter(d => d.status === 'EXPLICIT_WORKFLOW_CHANNEL').map(d => d.materialId))
  const originalConflictIds = new Set(original.conflicts.map(c => c.id))
  const removed = grounded.result.conflicts.filter(c => !originalConflictIds.has(c.id) && [...restoredIds].some(id => {
    const m = grounded.result.materials.find(m => m.tempId === id)!
    const expectedMessage = `${m.name}的提交渠道“${m.submissionChannel}”缺少同对象的明确依据；请核对关联事项。`
    return c.id === 'material-channel:' + id && c.type === 'other' && c.requiresDecision && c.message === expectedMessage
      && JSON.stringify(c.entityTempIds) === JSON.stringify([id, ...m.relatedTaskTempIds])
  }))
  grounded.result.conflicts = grounded.result.conflicts.filter(c => !removed.includes(c))
  grounded.result.quality.reviewReasons = grounded.result.quality.reviewReasons.filter(r => !removed.some(c => c.message === r)
    || grounded.result.conflicts.some(c => c.message === r))
  return { ...decoded, result: grounded.result, sidecar: { ...decoded.sidecar, originalResponse: raw,
    factRoleAudit: { ...decoded.sidecar.factRoleAudit, original },
    currentDeclaredSupport: { version: CURRENT_FACT_ROLE_PRODUCT_VERSION,
      role: 'POST_PROGRAM_EXISTING_FACTS_NOT_NEW_MODEL_OUTPUT', inferredFacts: 0,
      original, compiledSupportIndices: compatible.tasks.map(t => ({ taskId: t.id, propositionScopeIds: t.propositionScopeIds })),
      participation: participation.audit, channels: channels.audit,
      materialChannels: { originalProgramValues: decoded.result.materials.map(m => ({ materialId: m.tempId, channel: m.submissionChannel })),
        currentProgramValues: grounded.result.materials.map(m => ({ materialId: m.tempId, channel: m.submissionChannel })),
        validation: grounded.audit, removedChannelOnlyConflicts: removed } },
  } }
}
