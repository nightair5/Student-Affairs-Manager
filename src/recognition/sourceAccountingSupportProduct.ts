import { plainJson } from '../experiments/mainline04/semanticContract'
import type { WireContext } from '../experiments/realInput01/modelWire'
import { decodeSourceContractRecording, type SourceContractV4 } from './sourceContractV4'
import { applyRecordedDirectiveDisposition } from './directiveDispositionProduct'

export const SOURCE_SUPPORT_PRODUCT_VERSION = 'source-support-accounting-projection-1.0.0'
const normalize = (s: string) => s.replace(/[\s，。；,:：;！!]/gu, '')
/** Preserve explicit facts; project supplementary context citations into the
 * frozen information view only when their existing owner and source agree. */
export function projectSourceSupportAccounting(rawHttpText: string, context: WireContext) {
  const envelope = plainJson(JSON.parse(rawHttpText)) as { output: Array<{ content: Array<{ text: string }> }> }
  const original = plainJson(JSON.parse(envelope.output[0].content[0].text)) as SourceContractV4
  if (original.schemaVersion !== 'explicit-source-contract-4.0.0' || !Array.isArray(original.scopeAccounting)) throw Error('PRODUCT_SUPPORT_WIRE_REQUIRED')
  const projected = structuredClone(original)
  const changes: Array<{ scopeId: string; entityId: string; reason: 'MATERIAL_SPECIFICATION' | 'COMPLETION_STANDARD' | 'QUALIFICATION_CONTEXT' }> = []
  const groundedTask = (id: string) => original.tasks.find(t => t.id === id && context.index.scopes.some(s => s.id === t.action.scopeId && s.text.includes(t.action.surface)) && context.index.scopes.some(s => s.id === t.object.scopeId && s.text.includes(t.object.surface)) && original.scopeAccounting.some(row => row.kind === 'action' && row.primaryEntityIds.includes(id) && t.propositionScopeIds.includes(row.scopeId)))
  for (const row of projected.scopeAccounting) {
    if (row.kind !== 'information' || !row.secondaryEntityIds.length) continue
    const scope = context.index.scopes.find(s => s.id === row.scopeId)
    if (!scope || row.primaryEntityIds.length || new Set(row.secondaryEntityIds).size !== row.secondaryEntityIds.length) throw Error('PRODUCT_SUPPORT_INFORMATION_REFERENCE')
    for (const id of row.secondaryEntityIds) {
      const material = original.materials.find(m => m.tempId === id)
      if (material && material.scopeIds.includes(scope.id) && material.relatedTaskTempIds.length && material.relatedTaskTempIds.every(tid => groundedTask(tid)?.propositionScopeIds.includes(scope.id)) && [...material.formatRequirements, ...material.namingRequirements].some(value => normalize(value) && normalize(scope.text).includes(normalize(value)))) {
        changes.push({ scopeId: scope.id, entityId: id, reason: 'MATERIAL_SPECIFICATION' }); continue
      }
      const task = groundedTask(id)
      if (task?.propositionScopeIds.includes(scope.id)) {
        if (task.detail.completionCriteria.some(value => normalize(value) === normalize(scope.text))) {
          changes.push({ scopeId: scope.id, entityId: id, reason: 'COMPLETION_STANDARD' }); continue
        }
        const qualificationObject = scope.text.match(/^([\p{L}\p{N}]{2,20})(?:领用|领取|使用|申请|报名)资格(?:还|尚|已|未)/u)?.[1]
        if (task.condition.value === 'unknown' && task.condition.factScopeIds.includes(scope.id) && qualificationObject && task.object.surface.includes(qualificationObject) && /(?:还未|尚未|未)公布/u.test(scope.text) && !/不再|已经|已公布/u.test(scope.text)) {
          changes.push({ scopeId: scope.id, entityId: id, reason: 'QUALIFICATION_CONTEXT' }); continue
        }
      }
      throw Error('PRODUCT_SUPPORT_UNSUPPORTED_CONTEXT_REFERENCE')
    }
    row.secondaryEntityIds = []
  }
  envelope.output[0].content[0].text = JSON.stringify(projected)
  return { projectedHttpText: JSON.stringify(envelope), audit: { version: SOURCE_SUPPORT_PRODUCT_VERSION, role: 'POST_COMPARISON_PROGRAM_CONVERSION' as const, inferredFacts: 0, originalWire: original, changes, projectedAccounting: projected.scopeAccounting } }
}

export function decodeProductSourceRecording(raw: string, candidate: Parameters<typeof decodeSourceContractRecording>[1], context: WireContext) {
  const support = candidate === 'Candidate19' || candidate === 'EngineeringFixture' ? projectSourceSupportAccounting(raw, context) : null
  const decoded = decodeSourceContractRecording(support?.projectedHttpText ?? raw, candidate, context)
  const product = applyRecordedDirectiveDisposition(decoded, context)
  return { ...product, sidecar: { ...product.sidecar, supportAccountingAudit: support?.audit ?? null }, supportAccountingAudit: support?.audit ?? null }
}
