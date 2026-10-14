import type { ImmutableScopeIndex, ScopeReferenceDirective, SurfaceReference } from './scopeReferenceContract'
import type { ReducedDirectiveAnchor, ReducedModelAnchors } from './taskFormationPolicyV2'

export const MODEL_ANCHOR_SELECTION_SCHEMA_VERSION = 'model-anchor-selection-1.0.0' as const

type ActionType = ScopeReferenceDirective['actionType']

export interface ModelAnchorDirectiveSelection {
  id: string
  propositionScopeIds: string[]
  action: SurfaceReference
  object: SurfaceReference
}

export interface ModelAnchorSelection {
  schemaVersion: typeof MODEL_ANCHOR_SELECTION_SCHEMA_VERSION
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  producerRunId: string
  directives: ModelAnchorDirectiveSelection[]
  ignoredScopeIds: string[]
}

export interface ModelAnchorSelectionIssue { code: string; path: string }

const surfaceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['scopeId', 'surface'],
  properties: { scopeId: { type: 'string', minLength: 1 }, surface: { type: 'string', minLength: 1, maxLength: 300 } },
} as const

export const MODEL_ANCHOR_SELECTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'sourceId', 'sourceVersionId', 'sourceFingerprint', 'producerRunId', 'directives', 'ignoredScopeIds'],
  properties: {
    schemaVersion: { const: MODEL_ANCHOR_SELECTION_SCHEMA_VERSION },
    sourceId: { type: 'string', minLength: 1 },
    sourceVersionId: { type: 'string', minLength: 1 },
    sourceFingerprint: { type: 'string', minLength: 64, maxLength: 64 },
    producerRunId: { type: 'string', minLength: 1, maxLength: 160 },
    directives: {
      type: 'array', maxItems: 24,
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'propositionScopeIds', 'action', 'object'],
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 100 },
          propositionScopeIds: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', minLength: 1 } },
          action: surfaceSchema,
          object: surfaceSchema,
        },
      },
    },
    ignoredScopeIds: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
  },
} as const

const ACTION_TYPES: ReadonlyArray<[RegExp, ActionType]> = [
  [/(?:发送|发给|寄送)/u, 'send'], [/(?:上传)/u, 'upload'], [/(?:提交|递交|邮寄)/u, 'submit'],
  [/(?:联系)/u, 'contact'], [/(?:报名|注册)/u, 'register'], [/(?:付款|缴费|支付)/u, 'pay'],
  [/(?:参加|出席)/u, 'attend'], [/(?:携带)/u, 'carry'], [/(?:打印)/u, 'print'], [/(?:签名|签字)/u, 'sign'],
  [/(?:核对|检查|查看|审查)/u, 'review'], [/(?:填写|重写|输入)/u, 'fill'], [/(?:整理|准备)/u, 'prepare'],
  [/(?:保存)/u, 'save'], [/(?:收集)/u, 'collect'], [/(?:完成|确认)/u, 'complete'],
]

function keys(value: object): string { return Object.keys(value).sort().join('|') }
function exactKeys(value: unknown, expected: string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && keys(value as object) === [...expected].sort().join('|'))
}
function localActionType(action: string, object: string): ActionType {
  return ACTION_TYPES.find(([pattern]) => pattern.test(action))?.[1]
    ?? ACTION_TYPES.find(([pattern]) => pattern.test(object))?.[1]
    ?? 'other'
}

export function validateModelAnchorSelection(value: unknown, index: ImmutableScopeIndex, expectedProducerRunId?: string): { valid: boolean; issues: ModelAnchorSelectionIssue[] } {
  const issues: ModelAnchorSelectionIssue[] = []
  if (!exactKeys(value, ['schemaVersion', 'sourceId', 'sourceVersionId', 'sourceFingerprint', 'producerRunId', 'directives', 'ignoredScopeIds'])) {
    return { valid: false, issues: [{ code: 'ROOT_KEYS_INVALID', path: 'selection' }] }
  }
  const selection = value as unknown as ModelAnchorSelection
  if (selection.schemaVersion !== MODEL_ANCHOR_SELECTION_SCHEMA_VERSION) issues.push({ code: 'SCHEMA_VERSION_INVALID', path: 'schemaVersion' })
  if (selection.sourceId !== index.sourceId || selection.sourceVersionId !== index.sourceVersionId || selection.sourceFingerprint !== index.sourceFingerprint) issues.push({ code: 'SOURCE_BINDING_MISMATCH', path: 'sourceId' })
  if (!selection.producerRunId || expectedProducerRunId && selection.producerRunId !== expectedProducerRunId) issues.push({ code: 'PRODUCER_RUN_ID_MISMATCH', path: 'producerRunId' })
  if (!Array.isArray(selection.directives) || !Array.isArray(selection.ignoredScopeIds)) return { valid: false, issues: [...issues, { code: 'ARRAYS_INVALID', path: 'selection' }] }
  const scopeById = new Map(index.scopes.map((scope) => [scope.id, scope]))
  const directiveScopeIds = new Set<string>()
  const directiveIds = new Set<string>()
  const signatures = new Set<string>()
  selection.directives.forEach((directive, position) => {
    const path = `directives[${position}]`
    if (!exactKeys(directive, ['id', 'propositionScopeIds', 'action', 'object'])) { issues.push({ code: 'DIRECTIVE_KEYS_INVALID', path }); return }
    if (!directive.id || directiveIds.has(directive.id)) issues.push({ code: 'DIRECTIVE_ID_INVALID', path: `${path}.id` })
    directiveIds.add(directive.id)
    if (!Array.isArray(directive.propositionScopeIds) || directive.propositionScopeIds.length === 0 || new Set(directive.propositionScopeIds).size !== directive.propositionScopeIds.length || directive.propositionScopeIds.some((id) => !scopeById.has(id))) issues.push({ code: 'PROPOSITION_SCOPES_INVALID', path: `${path}.propositionScopeIds` })
    directive.propositionScopeIds.forEach((id) => directiveScopeIds.add(id))
    for (const [field, reference] of [['action', directive.action], ['object', directive.object]] as const) {
      if (!exactKeys(reference, ['scopeId', 'surface']) || !directive.propositionScopeIds.includes(reference.scopeId) || !reference.surface || !scopeById.get(reference.scopeId)?.text.includes(reference.surface)) issues.push({ code: `${field.toUpperCase()}_REFERENCE_INVALID`, path: `${path}.${field}` })
    }
    const signature = `${directive.action?.scopeId}\u0000${directive.action?.surface}\u0000${directive.object?.scopeId}\u0000${directive.object?.surface}`
    if (signatures.has(signature)) issues.push({ code: 'DUPLICATE_DIRECTIVE', path })
    signatures.add(signature)
  })
  const ignored = new Set(selection.ignoredScopeIds)
  if (ignored.size !== selection.ignoredScopeIds.length || selection.ignoredScopeIds.some((id) => !scopeById.has(id))) issues.push({ code: 'IGNORED_SCOPES_INVALID', path: 'ignoredScopeIds' })
  if ([...ignored].some((id) => directiveScopeIds.has(id))) issues.push({ code: 'SCOPE_ROLE_OVERLAP', path: 'ignoredScopeIds' })
  if (index.scopes.some((scope) => !ignored.has(scope.id) && !directiveScopeIds.has(scope.id))) issues.push({ code: 'SOURCE_SCOPE_UNACCOUNTED', path: 'selection' })
  return { valid: issues.length === 0, issues }
}

export function composeReducedAnchorsFromSelection(selection: ModelAnchorSelection, index: ImmutableScopeIndex, expectedProducerRunId?: string): ReducedModelAnchors {
  const validation = validateModelAnchorSelection(selection, index, expectedProducerRunId)
  if (!validation.valid) throw new Error(`MODEL_ANCHOR_SELECTION_INVALID:${validation.issues.map((issue) => issue.code).join(',')}`)
  const directives: ReducedDirectiveAnchor[] = selection.directives.map((directive) => ({
    anchorId: directive.id,
    propositionScopeIds: [...directive.propositionScopeIds],
    actionTypeHint: localActionType(directive.action.surface, directive.object.surface),
    actionSurfaceHint: { ...directive.action },
    objectSurfaceHint: { ...directive.object },
    timeRefs: [], materialRefs: [], eventRef: null, locationRef: null,
  }))
  return {
    schemaVersion: 'reduced-model-anchors-1.0.0', sourceId: selection.sourceId, sourceVersionId: selection.sourceVersionId,
    sourceFingerprint: selection.sourceFingerprint, producerRunId: selection.producerRunId, directives, observations: [],
    ignoredScopeIds: [...selection.ignoredScopeIds],
    discardedModelAuthority: ['requiresAction', 'semantics', 'inferenceLevel', 'effect', 'revisionRefs', 'selected'],
  }
}
