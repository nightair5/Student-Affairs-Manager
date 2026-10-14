import type {
  ImmutableScope,
  ImmutableScopeIndex,
  MaterialReference,
  ScopeReferenceCandidate,
  ScopeReferenceDirective,
  ScopeReferenceObservation,
  ScopeReferenceSemantics,
  SurfaceReference,
  TimeReference,
} from './scopeReferenceContract'

export const TASK_FORMATION_POLICY_VERSION = 'task-formation-policy-2.0.0' as const
export const TASK_FORMATION_SCHEMA_VERSION = 'local-task-formation-1.0.0' as const

type ActionType = ScopeReferenceDirective['actionType']
type Effect = ScopeReferenceDirective['effect']

export interface ReducedDirectiveAnchor {
  anchorId: string
  propositionScopeIds: string[]
  actionTypeHint: ActionType
  actionSurfaceHint: SurfaceReference
  objectSurfaceHint: SurfaceReference
  timeRefs: TimeReference[]
  materialRefs: MaterialReference[]
  eventRef: SurfaceReference | null
  locationRef: SurfaceReference | null
}

export interface ReducedObservationAnchor {
  anchorId: string
  kindHint: ScopeReferenceObservation['kind']
  propositionScopeIds: string[]
  subjectSurfaceHint: SurfaceReference
  timeRefs: TimeReference[]
  locationRef: SurfaceReference | null
}

export interface ReducedModelAnchors {
  schemaVersion: 'reduced-model-anchors-1.0.0'
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  producerRunId: string
  directives: ReducedDirectiveAnchor[]
  observations: ReducedObservationAnchor[]
  ignoredScopeIds: string[]
  discardedModelAuthority: readonly ['requiresAction', 'semantics', 'inferenceLevel', 'effect', 'revisionRefs', 'selected']
}

export interface LocalTaskSuggestion {
  id: string
  propositionScopeIds: string[]
  action: SurfaceReference
  object: SurfaceReference
  steps: SurfaceReference[]
  actionType: ActionType
  effect: Effect
  semantics: ScopeReferenceSemantics
  inferenceLevel: 'explicit'
  timeRefs: TimeReference[]
  materialRefs: MaterialReference[]
  eventRef: SurfaceReference | null
  locationRef: SurfaceReference | null
  revisionRefs: Array<{ type: 'supersedes'; targetTaskId: string; scopeIds: string[] }>
  selected: boolean
  needsConfirmation: boolean
  policyReasons: string[]
}

export interface LocalObservation {
  id: string
  kind: ScopeReferenceObservation['kind']
  propositionScopeIds: string[]
  subject: SurfaceReference
  semantics: ScopeReferenceSemantics
  inferenceLevel: 'explicit'
  timeRefs: TimeReference[]
  locationRef: SurfaceReference | null
  selected: false
  needsConfirmation: true
  policyReasons: string[]
}

export interface LocalTaskFormationResult {
  schemaVersion: typeof TASK_FORMATION_SCHEMA_VERSION
  policyVersion: typeof TASK_FORMATION_POLICY_VERSION
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  producerRunId: string
  requiresAction: boolean
  tasks: LocalTaskSuggestion[]
  observations: LocalObservation[]
  ignoredScopeIds: string[]
  generatedLocally: {
    taskBoundaries: true
    semantics: true
    requiresAction: true
    selected: true
    explanationOwnership: true
  }
  modelAuthorityFieldsUsed: []
  diagnostics: {
    inputDirectiveAnchors: number
    outputTasks: number
    mergedActionAnchors: number
    promotedHistoricalDirectives: number
    attachedExplanationScopes: number
  }
}

export interface LocalTaskFormationIssue {
  code: string
  path: string
}

const ACTION_RULES: ReadonlyArray<{ surface: string; type: ActionType; effect: Effect }> = [
  { surface: '发给', type: 'send', effect: 'external_transfer' },
  { surface: '发送', type: 'send', effect: 'external_transfer' },
  { surface: '上传', type: 'upload', effect: 'external_transfer' },
  { surface: '提交', type: 'submit', effect: 'external_transfer' },
  { surface: '联系', type: 'contact', effect: 'external_interaction' },
  { surface: '付款', type: 'pay', effect: 'external_interaction' },
  { surface: '缴费', type: 'pay', effect: 'external_interaction' },
  { surface: '报名', type: 'register', effect: 'external_interaction' },
  { surface: '注册', type: 'register', effect: 'external_interaction' },
  { surface: '参加', type: 'attend', effect: 'physical_action' },
  { surface: '携带', type: 'carry', effect: 'physical_action' },
  { surface: '打印', type: 'print', effect: 'physical_action' },
  { surface: '签名', type: 'sign', effect: 'physical_action' },
  { surface: '核验', type: 'review', effect: 'physical_action' },
  { surface: '核对', type: 'review', effect: 'local_change' },
  { surface: '检查', type: 'review', effect: 'local_change' },
  { surface: '重写', type: 'fill', effect: 'local_change' },
  { surface: '填写', type: 'fill', effect: 'local_change' },
  { surface: '输入', type: 'fill', effect: 'external_interaction' },
  { surface: '整理', type: 'prepare', effect: 'local_change' },
  { surface: '准备', type: 'prepare', effect: 'local_change' },
  { surface: '保存', type: 'save', effect: 'local_change' },
  { surface: '查看', type: 'review', effect: 'local_change' },
]

const NEGATIVE_RE = /(?:不要|不得|禁止|无需|不用|不再|暂勿|暂缓|先不要|不要求|不强制)/u
const CONDITIONAL_RE = /^(?:若|如果|如|当.+?时)/u
const OPTIONAL_RE = /(?:可以|可自行|自愿|按需|需要.+?的同学)/u
const COMPLETED_RE = /(?:已经|已完成|已办结|已结清)/u
const HISTORICAL_RE = /(?:旧通知|原通知|原安排|旧安排)/u
const QUOTED_RE = /(?:示例|演示|仅供参考|这只是征询|不是正式安排|尚未发布|有人询问|是否需要)/u

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function scopeMap(index: ImmutableScopeIndex): Map<string, ImmutableScope> {
  return new Map(index.scopes.map((scope) => [scope.id, scope]))
}

function cloneSurface(value: SurfaceReference | null): SurfaceReference | null {
  return value ? { scopeId: value.scopeId, surface: value.surface } : null
}

function cloneTimes(values: TimeReference[]): TimeReference[] {
  return values.map((value) => ({ scopeId: value.scopeId, surface: value.surface, type: value.type }))
}

function cloneMaterials(values: MaterialReference[]): MaterialReference[] {
  return values.map((value) => ({ scopeId: value.scopeId, surface: value.surface, required: value.required }))
}

export function reduceModelCandidate(candidate: ScopeReferenceCandidate): ReducedModelAnchors {
  return {
    schemaVersion: 'reduced-model-anchors-1.0.0',
    sourceId: candidate.sourceId,
    sourceVersionId: candidate.sourceVersionId,
    sourceFingerprint: candidate.sourceFingerprint,
    producerRunId: candidate.producerRunId,
    directives: candidate.directives.map((directive) => ({
      anchorId: directive.id,
      propositionScopeIds: [...directive.propositionScopeIds],
      actionTypeHint: directive.actionType,
      actionSurfaceHint: { ...directive.action },
      objectSurfaceHint: { ...directive.object },
      timeRefs: cloneTimes(directive.timeRefs),
      materialRefs: cloneMaterials(directive.materialRefs),
      eventRef: cloneSurface(directive.eventRef),
      locationRef: cloneSurface(directive.locationRef),
    })),
    observations: candidate.observations.map((observation) => ({
      anchorId: observation.id,
      kindHint: observation.kind,
      propositionScopeIds: [...observation.propositionScopeIds],
      subjectSurfaceHint: { ...observation.subject },
      timeRefs: cloneTimes(observation.timeRefs),
      locationRef: cloneSurface(observation.locationRef),
    })),
    ignoredScopeIds: [...candidate.ignoredScopeIds],
    discardedModelAuthority: ['requiresAction', 'semantics', 'inferenceLevel', 'effect', 'revisionRefs', 'selected'],
  }
}

function textFor(scopeIds: string[], scopes: Map<string, ImmutableScope>): string {
  return scopeIds.map((id) => scopes.get(id)?.text ?? '').join('')
}

function firstAction(scopeIds: string[], scopes: Map<string, ImmutableScope>, anchors: ReducedDirectiveAnchor[]) {
  if (anchors.length === 1) {
    const hint = anchors[0].actionSurfaceHint
    const scope = scopes.get(hint.scopeId)
    const hintedRule = ACTION_RULES.find((rule) => hint.surface.includes(rule.surface))
    if (scope && hintedRule && scope.text.includes(hintedRule.surface)) {
      return { scopeId: scope.id, offset: scope.text.indexOf(hintedRule.surface), order: scope.order, ...hintedRule }
    }
  }
  const candidates: Array<{ scopeId: string; offset: number; order: number; surface: string; type: ActionType; effect: Effect }> = []
  for (const scopeId of scopeIds) {
    const scope = scopes.get(scopeId)
    if (!scope) continue
    for (const rule of ACTION_RULES) {
      const offset = scope.text.indexOf(rule.surface)
      if (offset >= 0) candidates.push({ scopeId, offset, order: scope.order, ...rule })
    }
  }
  candidates.sort((left, right) => left.order - right.order || left.offset - right.offset || right.surface.length - left.surface.length)
  if (candidates[0]) return candidates[0]
  const hint = anchors[0]
  return {
    scopeId: hint.actionSurfaceHint.scopeId,
    offset: 0,
    order: scopes.get(hint.actionSurfaceHint.scopeId)?.order ?? 0,
    surface: hint.actionSurfaceHint.surface,
    type: hint.actionTypeHint,
    effect: effectFor(hint.actionTypeHint),
  }
}

function effectFor(type: ActionType): Effect {
  if (['submit', 'upload', 'send'].includes(type)) return 'external_transfer'
  if (['contact', 'register', 'pay'].includes(type)) return 'external_interaction'
  if (['attend', 'carry', 'print', 'sign'].includes(type)) return 'physical_action'
  if (['review', 'complete', 'fill', 'prepare', 'save', 'collect'].includes(type)) return 'local_change'
  return 'unknown'
}

function normalizeObject(primary: ReturnType<typeof firstAction>, anchors: ReducedDirectiveAnchor[], scopes: Map<string, ImmutableScope>): SurfaceReference {
  const matching = anchors.find((anchor) => anchor.actionSurfaceHint.surface.includes(primary.surface))
    ?? anchors.find((anchor) => anchor.actionTypeHint === primary.type)
    ?? anchors[0]
  const scope = scopes.get(matching.objectSurfaceHint.scopeId)
  let surface = matching.objectSurfaceHint.surface.trim()
  if (!scope?.text.includes(surface) || /^(?:再次|立即|照做|操作)$/u.test(surface)) surface = primary.surface
  surface = surface.replace(/^(?:请|立即|自行|把|将|先|再)*(?:核对|检查|审查|重写|填写|输入|整理|准备|打印|签名|携带|保存|提交|上传|发送|发给|联系|付款|缴费|报名|注册|参加|查看)/u, '') || primary.surface
  if (surface.includes('中的')) surface = surface.slice(surface.lastIndexOf('中的') + 2)
  else if (surface.includes('的') && !surface.endsWith('的')) surface = surface.slice(surface.lastIndexOf('的') + 1)
  return { scopeId: scope?.text.includes(surface) ? scope.id : primary.scopeId, surface: scope?.text.includes(surface) ? surface : primary.surface }
}

function validReference<T extends SurfaceReference>(reference: T, scopes: Map<string, ImmutableScope>): boolean {
  return Boolean(scopes.get(reference.scopeId)?.text.includes(reference.surface))
}

function safeReferences<T extends SurfaceReference>(values: T[], scopes: Map<string, ImmutableScope>): T[] {
  return values.filter((value, position) => validReference(value, scopes)
    && values.findIndex((candidate) => candidate.scopeId === value.scopeId && candidate.surface === value.surface) === position)
}

function semanticsFor(text: string, effect: Effect): { semantics: ScopeReferenceSemantics; reasons: string[] } {
  const negative = NEGATIVE_RE.test(text)
  const conditional = CONDITIONAL_RE.test(text) || /若|如果/u.test(text)
  const completed = COMPLETED_RE.test(text)
  const historical = HISTORICAL_RE.test(text)
  const optional = OPTIONAL_RE.test(text)
  const reasons: string[] = []
  if (conditional) reasons.push('CONDITION_UNTRIGGERED')
  if (negative) reasons.push(/暂勿|暂缓|先不要/u.test(text) ? 'NEGATIVE_TEMPORARY_HOLD' : 'NEGATIVE_PROHIBITION')
  if (historical) reasons.push('HISTORICAL_REQUIREMENT')
  if (optional) reasons.push('OPTIONAL_ACTION')
  if (effect === 'external_transfer' || effect === 'external_interaction') reasons.push('EXTERNAL_EFFECT')
  return {
    semantics: {
      actor: optional ? 'addressed_group' : 'addressee',
      speechAct: conditional ? 'hypothetical' : 'directive',
      polarity: conditional ? 'uncertain' : negative ? 'negative' : 'affirmative',
      tense: completed ? 'past' : 'future',
      status: completed ? 'completed' : conditional ? 'unknown' : negative || historical ? 'cancelled' : 'pending',
      validity: conditional ? 'uncertain' : historical ? 'superseded' : 'active',
      modality: optional ? 'optional' : 'required',
    },
    reasons,
  }
}

function maySelect(semantics: ScopeReferenceSemantics, effect: Effect, actionType: ActionType): boolean {
  return semantics.actor === 'addressee'
    && semantics.speechAct === 'directive'
    && semantics.polarity === 'affirmative'
    && semantics.tense === 'future'
    && semantics.status === 'pending'
    && semantics.validity === 'active'
    && semantics.modality === 'required'
    && (effect === 'local_change' || effect === 'physical_action')
    && ['review', 'fill', 'prepare', 'carry', 'save', 'print'].includes(actionType)
}

function groupedDirectiveAnchors(anchors: ReducedDirectiveAnchor[], scopes: Map<string, ImmutableScope>): ReducedDirectiveAnchor[][] {
  const byScopeSet = new Map<string, ReducedDirectiveAnchor[]>()
  for (const anchor of anchors) {
    const key = unique(anchor.propositionScopeIds).sort().join('|')
    const group = byScopeSet.get(key) ?? []
    group.push(anchor)
    byScopeSet.set(key, group)
  }
  const controlledGroups = [...byScopeSet.values()].flatMap((group) => {
    if (group.length <= 1) return [group]
    const actions = group.map((anchor) => firstAction(anchor.propositionScopeIds, scopes, [anchor]))
    const types = new Set(actions.map((action) => action.type))
    const sameActionAndObject = new Set(group.map((anchor) => `${anchor.actionTypeHint}\u0000${anchor.objectSurfaceHint.surface}`)).size === 1
    const localSaveChain = types.has('save') && actions.filter((action) => action.type !== 'save').length === 1
      && actions.every((action) => action.effect === 'local_change')
    const physicalVerificationChain = types.size === 2 && types.has('carry') && types.has('review')
    if (sameActionAndObject || localSaveChain || physicalVerificationChain) return [group]
    return group.map((anchor) => [anchor])
  })
  const groups = controlledGroups.sort((left, right) => {
    const leftOrder = Math.min(...left.flatMap((item) => item.propositionScopeIds.map((id) => scopes.get(id)?.order ?? Number.MAX_SAFE_INTEGER)))
    const rightOrder = Math.min(...right.flatMap((item) => item.propositionScopeIds.map((id) => scopes.get(id)?.order ?? Number.MAX_SAFE_INTEGER)))
    return leftOrder - rightOrder
  })
  return groups
}

function historicalAnchors(anchors: ReducedObservationAnchor[], scopes: Map<string, ImmutableScope>): ReducedDirectiveAnchor[] {
  return anchors.flatMap((anchor) => {
    const text = textFor(anchor.propositionScopeIds, scopes)
    if (!HISTORICAL_RE.test(text) || !ACTION_RULES.some((rule) => text.includes(rule.surface))) return []
    const action = firstAction(anchor.propositionScopeIds, scopes, [{
      anchorId: anchor.anchorId,
      propositionScopeIds: anchor.propositionScopeIds,
      actionTypeHint: 'other',
      actionSurfaceHint: anchor.subjectSurfaceHint,
      objectSurfaceHint: anchor.subjectSurfaceHint,
      timeRefs: anchor.timeRefs,
      materialRefs: [],
      eventRef: null,
      locationRef: anchor.locationRef,
    }])
    const actionOffset = scopes.get(action.scopeId)?.text.indexOf(action.surface) ?? -1
    const scopeText = scopes.get(action.scopeId)?.text ?? ''
    const tail = actionOffset >= 0 ? scopeText.slice(actionOffset + action.surface.length) : action.surface
    const objectSurface = tail.match(/^([^，。；\s]+)/u)?.[1] ?? action.surface
    return [{
      anchorId: `promoted-${anchor.anchorId}`,
      propositionScopeIds: [...anchor.propositionScopeIds],
      actionTypeHint: action.type,
      actionSurfaceHint: { scopeId: action.scopeId, surface: action.surface },
      objectSurfaceHint: { scopeId: action.scopeId, surface: objectSurface },
      timeRefs: cloneTimes(anchor.timeRefs),
      materialRefs: [],
      eventRef: null,
      locationRef: cloneSurface(anchor.locationRef),
    }]
  })
}

function isExplanatoryContinuation(text: string): boolean {
  return /^(?:这|该|上述|两项|本次|不是|不要求|不强制|最终)/u.test(text)
}

function localObservations(anchors: ReducedObservationAnchor[], scopes: Map<string, ImmutableScope>, promotedIds: Set<string>): LocalObservation[] {
  const filtered = anchors.filter((anchor) => !promotedIds.has(anchor.anchorId))
  const groups: ReducedObservationAnchor[][] = []
  for (const anchor of filtered) {
    const currentText = textFor(anchor.propositionScopeIds, scopes)
    const previous = groups.at(-1)
    const previousText = previous ? textFor(previous.flatMap((item) => item.propositionScopeIds), scopes) : ''
    const previousIsEvent = /(?:说明会|活动|会议).*(?:举行|开始)/u.test(previousText)
    const previousIsQuotedOrQuestion = /(?:示例栏|界面演示|有人询问|是否需要|[“”])/u.test(previousText)
    if (previous && isExplanatoryContinuation(currentText) && !previousIsEvent && !previousIsQuotedOrQuestion) previous.push(anchor)
    else groups.push([anchor])
  }
  return groups.map((group, position) => {
    const scopeIds = unique(group.flatMap((anchor) => anchor.propositionScopeIds))
    const text = textFor(scopeIds, scopes)
    const quoted = QUOTED_RE.test(text) || /[“”]/u.test(text) && /示例/u.test(text)
    const interrogative = /询问|是否/u.test(text)
    const negative = /不是|不要求/u.test(text)
    const completed = COMPLETED_RE.test(text)
    const kind = /(?:说明会|活动|会议).*(?:举行|开始)/u.test(text) ? 'event' : 'information'
    const subjectCandidate = group.map((anchor) => anchor.subjectSurfaceHint)
      .find((subject) => validReference(subject, scopes) && !/^(?:该|这|上述|两项)/u.test(subject.surface))
      ?? group.map((anchor) => anchor.subjectSurfaceHint).find((subject) => validReference(subject, scopes))
    const fallbackScope = scopes.get(scopeIds[0])
    const rawSubject = subjectCandidate ?? { scopeId: fallbackScope?.id ?? '', surface: fallbackScope?.text ?? '' }
    const normalizedSubject = rawSubject.surface.replace(/^(?:不是|不要求|不强制|最终通知尚未发布)/u, '') || rawSubject.surface
    const subject = scopes.get(rawSubject.scopeId)?.text.includes(normalizedSubject)
      ? { scopeId: rawSubject.scopeId, surface: normalizedSubject }
      : rawSubject
    return {
      id: `observation-${position + 1}`,
      kind,
      propositionScopeIds: scopeIds,
      subject,
      semantics: {
        actor: interrogative ? 'third_party' : kind === 'event' ? 'unknown' : 'issuer',
        speechAct: quoted ? 'quoted' : interrogative ? 'interrogative' : 'assertive',
        polarity: interrogative ? 'uncertain' : negative ? 'negative' : 'affirmative',
        tense: completed ? 'past' : /(?:将|定于|周日|尚未)/u.test(text) ? 'future' : 'present',
        status: completed ? 'completed' : negative ? 'cancelled' : /另行通知|尚未/u.test(text) ? 'unknown' : 'pending',
        validity: quoted || interrogative ? 'uncertain' : 'active',
        modality: 'informational',
      },
      inferenceLevel: 'explicit',
      timeRefs: safeReferences(group.flatMap((anchor) => cloneTimes(anchor.timeRefs)), scopes),
      locationRef: group.map((anchor) => cloneSurface(anchor.locationRef)).find((reference): reference is SurfaceReference => Boolean(reference && validReference(reference, scopes))) ?? null,
      selected: false,
      needsConfirmation: true,
      policyReasons: quoted ? ['NON_ACTIONABLE_QUOTED_OR_INFORMATIONAL'] : ['NON_ACTIONABLE_INFORMATION'],
    }
  })
}

function attachSharedMaterials(tasks: LocalTaskSuggestion[], observations: LocalObservation[], scopes: Map<string, ImmutableScope>): number {
  let attached = 0
  for (const observation of observations) {
    const text = textFor(observation.propositionScopeIds, scopes)
    const material = text.match(/(?:同一份|共同使用|均使用)([^，。；]+)/u)?.[1]
    if (!/(?:两项|上述|各项)/u.test(text) || !material) continue
    const scopeId = observation.propositionScopeIds.find((id) => scopes.get(id)?.text.includes(material))
    if (!scopeId) continue
    for (const task of tasks.filter((item) => item.semantics.validity === 'active' && item.semantics.polarity === 'affirmative')) {
      task.materialRefs = uniqueReferences([...task.materialRefs, { scopeId, surface: material, required: true }])
      task.propositionScopeIds = unique([...task.propositionScopeIds, scopeId])
      task.policyReasons.push('SHARED_MATERIAL_ATTACHED')
    }
    observation.policyReasons.push('ATTACHED_TO_TASKS')
    attached += 1
  }
  return attached
}

function uniqueReferences<T extends SurfaceReference>(values: T[]): T[] {
  return values.filter((value, position) => values.findIndex((candidate) => candidate.scopeId === value.scopeId && candidate.surface === value.surface) === position)
}

export function formLocalTaskSuggestions(index: ImmutableScopeIndex, reduced: ReducedModelAnchors): LocalTaskFormationResult {
  if (index.sourceId !== reduced.sourceId || index.sourceVersionId !== reduced.sourceVersionId || index.sourceFingerprint !== reduced.sourceFingerprint) {
    throw new Error('TASK_FORMATION_SOURCE_BINDING_MISMATCH')
  }
  const scopes = scopeMap(index)
  const promoted = historicalAnchors(reduced.observations, scopes)
  const promotedIds = new Set(promoted.map((anchor) => anchor.anchorId.replace(/^promoted-/u, '')))
  const allDirectiveAnchors = [...reduced.directives, ...promoted]
  const groups = groupedDirectiveAnchors(allDirectiveAnchors, scopes)
  let mergedActionAnchors = 0
  const tasks: LocalTaskSuggestion[] = groups.map((group, position) => {
    const propositionScopeIds = unique(group.flatMap((anchor) => anchor.propositionScopeIds))
      .filter((id) => scopes.has(id))
      .sort((left, right) => (scopes.get(left)?.order ?? 0) - (scopes.get(right)?.order ?? 0))
    const text = textFor(propositionScopeIds, scopes)
    const primary = firstAction(propositionScopeIds, scopes, group)
    const effect = primary.effect
    const { semantics, reasons } = semanticsFor(text, effect)
    const steps = group
      .map((anchor) => anchor.actionSurfaceHint)
      .filter((reference) => validReference(reference, scopes) && !(reference.scopeId === primary.scopeId && reference.surface.includes(primary.surface)))
    mergedActionAnchors += Math.max(0, group.length - 1)
    const selected = maySelect(semantics, effect, primary.type)
    if (selected) reasons.push('LOCAL_SAFE_DEFAULT_ALLOWED')
    else reasons.push('LOCAL_SAFE_DEFAULT_BLOCKED')
    return {
      id: `task-${position + 1}`,
      propositionScopeIds,
      action: { scopeId: primary.scopeId, surface: primary.surface },
      object: normalizeObject(primary, group, scopes),
      steps: uniqueReferences(steps),
      actionType: primary.type,
      effect,
      semantics,
      inferenceLevel: 'explicit',
      timeRefs: uniqueReferences(safeReferences(group.flatMap((anchor) => cloneTimes(anchor.timeRefs)), scopes)),
      materialRefs: uniqueReferences(safeReferences(group.flatMap((anchor) => cloneMaterials(anchor.materialRefs)), scopes)),
      eventRef: group.map((anchor) => cloneSurface(anchor.eventRef)).find((reference): reference is SurfaceReference => Boolean(reference && validReference(reference, scopes))) ?? null,
      locationRef: group.map((anchor) => cloneSurface(anchor.locationRef)).find((reference): reference is SurfaceReference => Boolean(reference && validReference(reference, scopes))) ?? null,
      revisionRefs: [],
      selected,
      needsConfirmation: !selected,
      policyReasons: reasons,
    }
  })

  const historicalTasks = tasks.filter((task) => task.semantics.validity === 'superseded')
  for (const historical of historicalTasks) {
    const next = tasks.find((task) => task !== historical && task.semantics.validity === 'active'
      && Math.min(...task.propositionScopeIds.map((id) => scopes.get(id)?.order ?? Number.MAX_SAFE_INTEGER))
        > Math.max(...historical.propositionScopeIds.map((id) => scopes.get(id)?.order ?? -1)))
    const cancellationScope = index.scopes.find((scope) => /(?:该安排|旧安排).*(?:取消|作废)/u.test(scope.text))
    if (next && cancellationScope) {
      next.propositionScopeIds = unique([cancellationScope.id, ...next.propositionScopeIds])
      next.revisionRefs.push({ type: 'supersedes', targetTaskId: historical.id, scopeIds: [cancellationScope.id, ...next.propositionScopeIds] })
      next.policyReasons.push('REVISION_TARGET_LINKED')
    }
  }

  const revisionScopeIds = new Set(tasks.flatMap((task) => task.revisionRefs.flatMap((reference) => reference.scopeIds)))
  const observations = localObservations(reduced.observations, scopes, promotedIds)
    .filter((observation) => !observation.propositionScopeIds.every((scopeId) => revisionScopeIds.has(scopeId)))
  const attachedExplanationScopes = attachSharedMaterials(tasks, observations, scopes)
  return {
    schemaVersion: TASK_FORMATION_SCHEMA_VERSION,
    policyVersion: TASK_FORMATION_POLICY_VERSION,
    sourceId: reduced.sourceId,
    sourceVersionId: reduced.sourceVersionId,
    sourceFingerprint: reduced.sourceFingerprint,
    producerRunId: reduced.producerRunId,
    requiresAction: tasks.some((task) => task.selected),
    tasks,
    observations,
    ignoredScopeIds: reduced.ignoredScopeIds.filter((id) => scopes.has(id)),
    generatedLocally: { taskBoundaries: true, semantics: true, requiresAction: true, selected: true, explanationOwnership: true },
    modelAuthorityFieldsUsed: [],
    diagnostics: {
      inputDirectiveAnchors: reduced.directives.length,
      outputTasks: tasks.length,
      mergedActionAnchors,
      promotedHistoricalDirectives: promoted.length,
      attachedExplanationScopes,
    },
  }
}

export function validateLocalTaskFormation(result: LocalTaskFormationResult, index: ImmutableScopeIndex): LocalTaskFormationIssue[] {
  const issues: LocalTaskFormationIssue[] = []
  const scopes = scopeMap(index)
  if (result.schemaVersion !== TASK_FORMATION_SCHEMA_VERSION) issues.push({ code: 'SCHEMA_VERSION_INVALID', path: 'schemaVersion' })
  if (result.policyVersion !== TASK_FORMATION_POLICY_VERSION) issues.push({ code: 'POLICY_VERSION_INVALID', path: 'policyVersion' })
  if (result.sourceId !== index.sourceId || result.sourceVersionId !== index.sourceVersionId || result.sourceFingerprint !== index.sourceFingerprint) {
    issues.push({ code: 'SOURCE_BINDING_MISMATCH', path: 'sourceId' })
  }
  if (result.modelAuthorityFieldsUsed.length > 0) issues.push({ code: 'MODEL_AUTHORITY_USED', path: 'modelAuthorityFieldsUsed' })
  if (result.requiresAction !== result.tasks.some((task) => task.selected)) issues.push({ code: 'REQUIRES_ACTION_NOT_DERIVED', path: 'requiresAction' })
  const checkReference = (reference: SurfaceReference, path: string) => {
    if (!validReference(reference, scopes)) issues.push({ code: 'SURFACE_NOT_IN_SCOPE', path })
  }
  result.tasks.forEach((task, indexPosition) => {
    const path = `tasks[${indexPosition}]`
    if (task.propositionScopeIds.length === 0 || task.propositionScopeIds.some((id) => !scopes.has(id))) issues.push({ code: 'PROPOSITION_SCOPE_INVALID', path: `${path}.propositionScopeIds` })
    checkReference(task.action, `${path}.action`)
    checkReference(task.object, `${path}.object`)
    task.steps.forEach((reference, position) => checkReference(reference, `${path}.steps[${position}]`))
    task.timeRefs.forEach((reference, position) => checkReference(reference, `${path}.timeRefs[${position}]`))
    task.materialRefs.forEach((reference, position) => checkReference(reference, `${path}.materialRefs[${position}]`))
    if (task.eventRef) checkReference(task.eventRef, `${path}.eventRef`)
    if (task.locationRef) checkReference(task.locationRef, `${path}.locationRef`)
    if (task.selected !== maySelect(task.semantics, task.effect, task.actionType)) issues.push({ code: 'SELECTED_NOT_POLICY_DERIVED', path: `${path}.selected` })
    if (task.selected && (task.effect === 'external_transfer' || task.effect === 'external_interaction')) issues.push({ code: 'FORBIDDEN_EXTERNAL_DEFAULT', path: `${path}.selected` })
  })
  result.observations.forEach((observation, indexPosition) => {
    const path = `observations[${indexPosition}]`
    if (observation.selected !== false) issues.push({ code: 'OBSERVATION_SELECTED', path: `${path}.selected` })
    checkReference(observation.subject, `${path}.subject`)
  })
  return issues
}
