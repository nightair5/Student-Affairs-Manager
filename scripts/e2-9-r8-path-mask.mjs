import { createHash, createHmac } from 'node:crypto'
import { assertReviewerPacketSafe, buildReviewerPacket, canonicalJson, projectReviewerBusinessResult } from './e2-9-r6-path-mask.mjs'

export const R8_REVIEW_PROTOCOL_VERSION = 'e2-9-r8-zero-model-review-1.0.0'
export const R8_LABELS_DRAFT_VERSION = 'e2.9-r8-path-masked-labels-draft-1.0.0'
export const R8_GATE_VERSION = 'e2.9-r8-path-masked-gate-1.0.0'

const LABEL_KEYS = Object.freeze([
  'caseAnonymousId', 'preferredSide', 'xMajor', 'yMajor', 'xPlanningError', 'yPlanningError',
  'xFactLoss', 'yFactLoss', 'xOverSplit', 'yOverSplit', 'reason',
])
const R8_CORRELATOR_KEY_PATTERN = /(?:^|_)(?:id|ids|quality|confidence|selected|extractionmethod|userconfirmationrequired|statussuggestion|prioritysuggestion|estimatedminutes)$/iu
const R8_CORRELATOR_VALUE_PATTERN = /(?:task-from-|obligation:|source-action-evidence-|pending-source|e2-r8)/iu

export const R8_REVIEW_GATE_POLICY = Object.freeze({
  pairCount: 16,
  minimumDeterminatePairs: 14,
  minimumCandidateWinMargin: 3,
  maximumBaselinePreferred: 3,
  requireCandidateMajorNotWorse: true,
  requireCandidatePlanningErrorLower: true,
  requireCandidateFactLossLower: true,
  requireCandidateOverSplitNotWorse: true,
})

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
}

function hmac(secret, fields) {
  if (typeof secret !== 'string' || secret.length < 64) throw new Error('R8_REVEAL_SECRET_INVALID')
  return createHmac('sha256', secret).update(fields.join('\0'), 'utf8').digest('hex')
}

export function projectR8NeutralBusinessResult(result) {
  const projected = projectReviewerBusinessResult(result)
  const values = (value) => Array.isArray(value) ? value : []
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const strings = (value) => values(value).filter((item) => typeof item === 'string')
  const evidenceById = new Map(values(projected.evidence).map((item) => [item.id, item.quotedText || item.quote || '']))
  const materialById = new Map(values(projected.materials).map((item) => [item.tempId, item.name || '']))
  const timeById = new Map(values(projected.timePoints).map((item) => [item.tempId, item.rawText || '']))
  const evidenceQuotes = (item) => strings(item.evidenceIds).map((id) => evidenceById.get(id)).filter(Boolean)
  const canonicalDate = (item) => {
    if (item.normalizedValue === null || item.normalizedValue === undefined) return null
    if (item.precision === 'date_only' && typeof item.normalizedValue === 'string') return item.normalizedValue.slice(0, 10)
    return item.normalizedValue
  }
  const taskView = (value) => {
    const item = object(value)
    return {
      actionObject: item.actionObject || '',
      actionVerb: item.actionVerb || '',
      completionCriteria: strings(item.completionCriteria),
      evidenceQuotes: evidenceQuotes(item),
      inferenceLevel: item.inferenceLevel || 'unspecified',
      materials: strings(item.materialTempIds).map((id) => materialById.get(id)).filter(Boolean),
      times: strings(item.timePointTempIds).map((id) => timeById.get(id)).filter(Boolean),
      title: item.title || '',
    }
  }
  const workPackageView = (value) => {
    const item = object(value)
    return { objective: item.objective || '', tasks: values(item.tasks).map(taskView), title: item.title || '' }
  }
  const milestoneView = (value) => {
    const item = object(value)
    return {
      objective: item.objective || '',
      tasks: values(item.tasks).map(taskView),
      title: item.title || '',
      workPackages: values(item.workPackages).map(workPackageView),
    }
  }
  const sourceSummary = object(projected.sourceSummary)
  const projectMatch = object(projected.projectMatch)
  return {
    ambiguities: values(projected.ambiguities).map((item) => ({
      evidenceQuotes: evidenceQuotes(item), message: item.message || '', options: strings(item.options),
    })),
    events: values(projected.events).map((item) => ({
      description: item.description || '', evidenceQuotes: evidenceQuotes(item),
      endTime: timeById.get(item.endTimePointTempId) || null, inferenceLevel: item.inferenceLevel || 'unspecified',
      location: item.location || null, startTime: timeById.get(item.startTimePointTempId) || null, title: item.title || '',
    })),
    ignoredContent: values(projected.ignoredContent).map((item) => ({ reason: item.reason || 'other', text: item.text || '' })),
    materials: values(projected.materials).map((item) => ({
      evidenceQuotes: evidenceQuotes(item), formatRequirements: strings(item.formatRequirements), name: item.name || '',
      namingRequirements: strings(item.namingRequirements), quantity: item.quantity ?? null,
      required: item.required !== false, submissionChannel: item.submissionChannel || null,
    })),
    milestones: values(projected.milestones).map(milestoneView),
    projectMatch: {
      decision: projectMatch.decision || 'uncertain',
      matchedProjectTitle: projectMatch.matchedProjectTitle || null,
      suggestedProjectTitle: projectMatch.suggestedProjectTitle || null,
    },
    sourceSummary: {
      actionReason: sourceSummary.actionReason || '', notificationType: sourceSummary.notificationType || 'uncertain',
      requiresAction: sourceSummary.requiresAction === true, summary: sourceSummary.summary || '', title: sourceSummary.title || '',
    },
    standaloneTasks: values(projected.standaloneTasks).map(taskView),
    timePoints: values(projected.timePoints).map((item) => ({
      evidenceQuotes: evidenceQuotes(item), isAllDay: item.precision === 'date_only' || item.isAllDay === true, needsConfirmation: item.needsConfirmation === true,
      normalizedValue: canonicalDate(item), precision: item.precision || 'vague', rawText: item.rawText || '', type: item.type || '',
    })),
  }
}

export function scanR8ReviewerCorrelators(packet) {
  const findings = []
  const visit = (value, currentPath = '$') => {
    if (typeof value === 'string') {
      if (R8_CORRELATOR_VALUE_PATTERN.test(value)) findings.push({ path: currentPath, category: 'PATH_SIGNATURE_VALUE' })
      return
    }
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${currentPath}[${index}]`))
    if (!value || typeof value !== 'object') return
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      const normalized = nestedKey.toLowerCase().replace(/[^a-z0-9]/gu, '')
      const nestedPath = `${currentPath}.${nestedKey}`
      if (R8_CORRELATOR_KEY_PATTERN.test(nestedKey) || normalized === 'quality' || normalized.endsWith('id') || normalized.endsWith('ids')) {
        findings.push({ path: nestedPath, category: 'PATH_SIGNATURE_KEY' })
      }
      visit(nestedValue, nestedPath)
    }
  }
  for (const [index, pair] of packet.pairs.entries()) {
    visit(pair.X, `$.pairs[${index}].X`)
    visit(pair.Y, `$.pairs[${index}].Y`)
  }
  return findings
}

export function deriveR8SideAssignment({ revealSecret, runId, observationId }) {
  const byte = Number.parseInt(hmac(revealSecret, ['R8_SIDE_ASSIGNMENT', runId, observationId]).slice(0, 2), 16)
  return byte % 2 === 0 ? { X: 'baseline', Y: 'candidate' } : { X: 'candidate', Y: 'baseline' }
}

export function buildR8SeparatedPair({ revealSecret, runId, anonymousId, observationId, caseId, source, baseline, candidate }) {
  const assignment = deriveR8SideAssignment({ revealSecret, runId, observationId })
  const values = {
    baseline: projectR8NeutralBusinessResult(baseline),
    candidate: projectR8NeutralBusinessResult(candidate),
  }
  const reviewerPair = {
    caseAnonymousId: anonymousId,
    source: {
      sourceType: source.sourceType,
      sourceTitle: source.sourceTitle,
      text: source.content,
      referenceTime: source.referenceTime,
      timezone: source.timezone,
    },
    X: values[assignment.X],
    Y: values[assignment.Y],
  }
  const privateBinding = {
    caseAnonymousId: anonymousId,
    observationId,
    caseId,
    X: assignment.X,
    Y: assignment.Y,
    sideXHash: sha256(canonicalJson(reviewerPair.X)),
    sideYHash: sha256(canonicalJson(reviewerPair.Y)),
    commitment: hmac(revealSecret, ['R8_COMMITMENT', runId, anonymousId, observationId, caseId, assignment.X, assignment.Y]),
  }
  return { reviewerPair, privateBinding }
}

export function buildR8ReviewerPacket(reviewerPairs) {
  if (!Array.isArray(reviewerPairs) || reviewerPairs.length !== R8_REVIEW_GATE_POLICY.pairCount) {
    throw new Error('R8_REVIEW_PAIR_COUNT_INVALID')
  }
  const packet = buildReviewerPacket({
    rubric: {
      instruction: '只根据原文和匿名 X/Y 业务结果判断哪个更符合用户实际需要；不得猜测路径、模型或历史评分。',
      preferredSide: ['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'],
      majorDefinition: '若用户必须新增、删除、合并或重写关键任务，纠正关键时间角色、条件、材料或事件边界，才算重大修改。',
      planningErrorDefinition: '原文事实基本可见，但 Task、Event、Material、TimePoint、Condition、Ambiguity 或层级关系组织错误。',
      factLossDefinition: '原文明示且用户需要看到的事实在结果中完全缺失；纯信息通知可无 Task，但明确 Event 与 TimePoint 不应因此消失。',
      overSplitDefinition: '把背景、地址、联系方式、材料名称或一个不可分的动作拆成用户不需要的额外 Task；Event 与“必须参加该 Event”的 Task 同时存在不自动算过度拆分。',
      timeRule: 'relative/vague 时间不得伪造确定值；保守待确认不因缺少伪精确而判差。',
      evidenceRule: '理由必须引用原文具体事实，只评价业务结果，不使用任何运行元数据。',
    },
    reviewerPairs,
  })
  assertReviewerPacketSafe(packet)
  const correlators = scanR8ReviewerCorrelators(packet)
  if (correlators.length) throw new Error(`R8_REVIEWER_PACKET_CORRELATOR:${JSON.stringify(correlators.slice(0, 5))}`)
  return packet
}

export function validateR8PacketAudit(audit, packetSha256, packet) {
  const keys = ['canIdentifyEitherPath', 'deterministicCorrelators', 'directIdentityDisclosures', 'packetSha256', 'reason', 'reviewProcessId', 'reviewedAt', 'reviewerKind', 'verdict']
  if (!exactKeys(audit, keys) || audit.verdict !== 'PASS' || audit.packetSha256 !== packetSha256
    || audit.canIdentifyEitherPath !== false || audit.reviewerKind !== 'independent_fresh_read_only'
    || !Array.isArray(audit.directIdentityDisclosures) || audit.directIdentityDisclosures.length !== 0
    || !Array.isArray(audit.deterministicCorrelators) || audit.deterministicCorrelators.length !== 0
    || typeof audit.reviewProcessId !== 'string' || audit.reviewProcessId.length < 8
    || !Number.isFinite(Date.parse(audit.reviewedAt)) || typeof audit.reason !== 'string' || audit.reason.length < 16) {
    throw new Error('R8_PATH_MASK_AUDIT_FAILED')
  }
  if (scanR8ReviewerCorrelators(packet).length) throw new Error('R8_PATH_MASK_AUTOMATIC_CORRELATOR_SCAN_FAILED')
  return audit
}

export function validateR8LabelsDraft(draft, packet, packetCreatedAt) {
  const keys = ['schemaVersion', 'reviewerKind', 'reviewProcessId', 'packetSha256', 'completedAt', 'labels']
  if (!exactKeys(draft, keys) || draft.schemaVersion !== R8_LABELS_DRAFT_VERSION
    || draft.reviewerKind !== 'independent_fresh_read_only'
    || typeof draft.reviewProcessId !== 'string' || draft.reviewProcessId.length < 8
    || draft.packetSha256 !== sha256(canonicalJson(packet))
    || !Number.isFinite(Date.parse(draft.completedAt)) || Date.parse(draft.completedAt) <= Date.parse(packetCreatedAt)
    || !Array.isArray(draft.labels) || draft.labels.length !== packet.pairs.length) {
    throw new Error('R8_LABELS_DRAFT_INVALID')
  }
  const expectedIds = packet.pairs.map((pair) => pair.caseAnonymousId).sort()
  const actualIds = draft.labels.map((label) => label.caseAnonymousId).sort()
  if (new Set(actualIds).size !== expectedIds.length || JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error('R8_LABEL_COVERAGE_INVALID')
  }
  for (const label of draft.labels) {
    if (!exactKeys(label, LABEL_KEYS)
      || !['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'].includes(label.preferredSide)
      || !['xMajor', 'yMajor', 'xPlanningError', 'yPlanningError', 'xFactLoss', 'yFactLoss', 'xOverSplit', 'yOverSplit']
        .every((field) => typeof label[field] === 'boolean')
      || typeof label.reason !== 'string' || label.reason.length < 16) {
      throw new Error('R8_LABEL_VALUE_INVALID')
    }
  }
  return draft
}

export function revealR8Mappings({ revealSecret, runId, packet, privateBindings }) {
  if (!Array.isArray(privateBindings) || privateBindings.length !== packet.pairs.length) throw new Error('R8_PRIVATE_BINDING_INVALID')
  return privateBindings.map((binding, index) => {
    const pair = packet.pairs[index]
    const assignment = deriveR8SideAssignment({ revealSecret, runId, observationId: binding.observationId })
    const commitment = hmac(revealSecret, ['R8_COMMITMENT', runId, binding.caseAnonymousId, binding.observationId, binding.caseId, assignment.X, assignment.Y])
    if (pair.caseAnonymousId !== binding.caseAnonymousId || assignment.X !== binding.X || assignment.Y !== binding.Y
      || binding.sideXHash !== sha256(canonicalJson(pair.X)) || binding.sideYHash !== sha256(canonicalJson(pair.Y))
      || binding.commitment !== commitment) throw new Error('R8_PRIVATE_BINDING_MISMATCH')
    return { caseAnonymousId: binding.caseAnonymousId, observationId: binding.observationId, caseId: binding.caseId, X: assignment.X, Y: assignment.Y }
  })
}

export function summarizeR8Labels(labels, mappings) {
  const counts = {
    candidatePreferred: 0, baselinePreferred: 0, tie: 0, insufficient: 0,
    candidateMajor: 0, baselineMajor: 0, candidatePlanningError: 0, baselinePlanningError: 0,
    candidateFactLoss: 0, baselineFactLoss: 0, candidateOverSplit: 0, baselineOverSplit: 0,
  }
  for (const label of labels) {
    const mapping = mappings.find((item) => item.caseAnonymousId === label.caseAnonymousId)
    if (!mapping) throw new Error('R8_MAPPING_MISSING')
    if (label.preferredSide === 'TIE') counts.tie += 1
    else if (label.preferredSide === 'INSUFFICIENT_INFORMATION') counts.insufficient += 1
    else counts[`${mapping[label.preferredSide]}Preferred`] += 1
    for (const [side, prefix] of [['X', 'x'], ['Y', 'y']]) {
      const path = mapping[side]
      if (label[`${prefix}Major`]) counts[`${path}Major`] += 1
      if (label[`${prefix}PlanningError`]) counts[`${path}PlanningError`] += 1
      if (label[`${prefix}FactLoss`]) counts[`${path}FactLoss`] += 1
      if (label[`${prefix}OverSplit`]) counts[`${path}OverSplit`] += 1
    }
  }
  return counts
}

export function evaluateR8ReviewGate(counts, pairCount) {
  const determinatePairs = pairCount - counts.insufficient
  const checks = {
    sixteenPairs: pairCount === R8_REVIEW_GATE_POLICY.pairCount,
    minimumDeterminatePairs: determinatePairs >= R8_REVIEW_GATE_POLICY.minimumDeterminatePairs,
    candidateWinMarginAtLeast3: counts.candidatePreferred - counts.baselinePreferred >= R8_REVIEW_GATE_POLICY.minimumCandidateWinMargin,
    baselinePreferredAtMost3: counts.baselinePreferred <= R8_REVIEW_GATE_POLICY.maximumBaselinePreferred,
    candidateMajorNotWorse: counts.candidateMajor <= counts.baselineMajor,
    candidatePlanningErrorLower: counts.candidatePlanningError < counts.baselinePlanningError,
    candidateFactLossLower: counts.candidateFactLoss < counts.baselineFactLoss,
    candidateOverSplitNotWorse: counts.candidateOverSplit <= counts.baselineOverSplit,
  }
  return { checks, pass: Object.values(checks).every(Boolean) }
}
