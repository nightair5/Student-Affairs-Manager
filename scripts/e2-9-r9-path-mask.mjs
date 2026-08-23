import { createHash, createHmac } from 'node:crypto'
import { assertReviewerPacketSafe, buildReviewerPacket, canonicalJson } from './e2-9-r6-path-mask.mjs'
import { projectR8NeutralBusinessResult, scanR8ReviewerCorrelators } from './e2-9-r8-path-mask.mjs'

export const R9_REVIEW_PROTOCOL_VERSION = 'e2-9-r9-zero-model-review-1.0.0'
export const R9_LABELS_DRAFT_VERSION = 'e2.9-r9-path-masked-labels-draft-1.0.0'
export const R9_GATE_VERSION = 'e2.9-r9-path-masked-gate-1.0.0'
export const R9_GATE_PREREG_CANONICAL_SHA256 = '2a78229a4b33e51635aa01f1a1d1c68f09751ada8e91917445539e79894723ae'
export const R9_GATE_POLICY_CANONICAL_SHA256 = 'cb7de1d8b08a7548b69b8a84062509e407851d526fdb3e25a80859153b0ef73d'

const LABEL_KEYS = Object.freeze([
  'caseAnonymousId', 'preferredSide', 'xMajor', 'yMajor', 'xPlanningError', 'yPlanningError',
  'xFactLoss', 'yFactLoss', 'xOverSplit', 'yOverSplit', 'xEvidenceGap', 'yEvidenceGap',
  'xSevereError', 'ySevereError', 'reason',
])
const BOOLEAN_LABEL_KEYS = Object.freeze(LABEL_KEYS.filter((key) => /^(?:x|y)(?:Major|PlanningError|FactLoss|OverSplit|EvidenceGap|SevereError)$/u.test(key)))
const CORRELATOR_VALUE_PATTERN = /(?:task-from-|obligation:|source-action-evidence-|pending-source|e2-r[89]|baseline|candidate)/iu

export const R9_REVIEW_GATE_POLICY = Object.freeze({
  pairCount: 16,
  minimumDeterminatePairs: 14,
  minimumCandidateWinMargin: 3,
  maximumBaselinePreferred: 3,
  candidateMajorNotWorse: true,
  candidatePlanningErrorLower: true,
  candidateFactLossNotWorse: true,
  zeroFactLossTiePasses: true,
  candidateOverSplitNotWorse: true,
  candidateEvidenceCoverageNotWorse: true,
  candidateSevereErrorNotWorse: true,
  labelsFrozenBeforeReveal: true,
  expectedAnswersExcluded: true,
  productionRecognitionGenerationCalls: 0,
})

export const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex')

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
}
function hmac(secret, fields) {
  if (typeof secret !== 'string' || secret.length < 64) throw new Error('R9_REVEAL_SECRET_INVALID')
  return createHmac('sha256', secret).update(fields.join('\0'), 'utf8').digest('hex')
}

export function scanR9ReviewerCorrelators(packet) {
  const findings = [...scanR8ReviewerCorrelators(packet)]
  const visit = (value, currentPath = '$') => {
    if (typeof value === 'string') {
      if (CORRELATOR_VALUE_PATTERN.test(value)) findings.push({ path: currentPath, category: 'R9_PATH_SIGNATURE_VALUE' })
      return
    }
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${currentPath}[${index}]`))
    if (!value || typeof value !== 'object') return
    Object.entries(value).forEach(([key, nested]) => visit(nested, `${currentPath}.${key}`))
  }
  packet.pairs.forEach((pair, index) => {
    visit(pair.X, `$.pairs[${index}].X`)
    visit(pair.Y, `$.pairs[${index}].Y`)
  })
  return findings
}

export function deriveR9SideAssignment({ revealSecret, runId, observationId }) {
  const byte = Number.parseInt(hmac(revealSecret, ['R9_SIDE_ASSIGNMENT', runId, observationId]).slice(0, 2), 16)
  return byte % 2 === 0 ? { X: 'baseline', Y: 'candidate' } : { X: 'candidate', Y: 'baseline' }
}

export function buildR9SeparatedPair({ revealSecret, runId, anonymousId, observationId, caseId, source, baseline, candidate }) {
  const assignment = deriveR9SideAssignment({ revealSecret, runId, observationId })
  const values = { baseline: projectR8NeutralBusinessResult(baseline), candidate: projectR8NeutralBusinessResult(candidate) }
  const reviewerPair = {
    caseAnonymousId: anonymousId,
    source: {
      sourceType: source.sourceType, sourceTitle: source.sourceTitle, text: source.content,
      referenceTime: source.referenceTime, timezone: source.timezone,
    },
    X: values[assignment.X], Y: values[assignment.Y],
  }
  return {
    reviewerPair,
    privateBinding: {
      caseAnonymousId: anonymousId, observationId, caseId, X: assignment.X, Y: assignment.Y,
      sideXHash: sha256(canonicalJson(reviewerPair.X)), sideYHash: sha256(canonicalJson(reviewerPair.Y)),
      commitment: hmac(revealSecret, ['R9_COMMITMENT', runId, anonymousId, observationId, caseId, assignment.X, assignment.Y]),
    },
  }
}

export function buildR9ReviewerPacket(reviewerPairs) {
  if (!Array.isArray(reviewerPairs) || reviewerPairs.length !== R9_REVIEW_GATE_POLICY.pairCount) throw new Error('R9_REVIEW_PAIR_COUNT_INVALID')
  const packet = buildReviewerPacket({
    rubric: {
      instruction: '只根据原文和匿名 X/Y 业务结果判断哪个更符合用户实际需要；不得猜测路径、模型或历史评分。',
      preferredSide: ['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'],
      majorDefinition: '用户必须新增、删除、合并或重写关键任务，或纠正关键时间、条件、材料、事件边界，才算重大修改。',
      planningErrorDefinition: '原文事实基本可见，但 Task、Event、Material、TimePoint、Condition、Ambiguity 或层级组织错误。',
      factLossDefinition: '原文明示且用户需要看到的事实完全缺失；纯信息可无 Task，但明确 Event/TimePoint 不应消失。',
      overSplitDefinition: '一个不可分动作或同一 obligation 被生成用户不需要的额外 Task；Event 与必须参加的 Task 并存不自动算过度拆分。',
      evidenceGapDefinition: '关键 Task/Event/Material/TimePoint 缺少可回到原文的直接证据，或证据与实体明显不匹配。',
      severeErrorDefinition: '无证据危险事实、关键义务整体丢失、不可信指令被执行，或可导致用户严重误事的时间/对象错误。',
      timeRule: '相对/模糊时间不得伪造确定值；保守待确认不因缺少伪精确而判差。',
      evidenceRule: '理由必须引用原文具体事实，只评价业务结果，不使用运行元数据。',
    },
    reviewerPairs,
  })
  assertReviewerPacketSafe(packet)
  const correlators = scanR9ReviewerCorrelators(packet)
  if (correlators.length) throw new Error(`R9_REVIEWER_PACKET_CORRELATOR:${JSON.stringify(correlators.slice(0, 5))}`)
  return packet
}

export function validateR9PacketAudit(audit, packetSha256, packet) {
  const keys = ['canIdentifyEitherPath', 'deterministicCorrelators', 'directIdentityDisclosures', 'packetSha256', 'reason', 'reviewProcessId', 'reviewedAt', 'reviewerKind', 'verdict']
  if (!exactKeys(audit, keys) || audit.verdict !== 'PASS' || audit.packetSha256 !== packetSha256
    || audit.canIdentifyEitherPath !== false || audit.reviewerKind !== 'independent_fresh_read_only'
    || !Array.isArray(audit.directIdentityDisclosures) || audit.directIdentityDisclosures.length !== 0
    || !Array.isArray(audit.deterministicCorrelators) || audit.deterministicCorrelators.length !== 0
    || typeof audit.reviewProcessId !== 'string' || audit.reviewProcessId.length < 8
    || !Number.isFinite(Date.parse(audit.reviewedAt)) || typeof audit.reason !== 'string' || audit.reason.length < 16) throw new Error('R9_PATH_MASK_AUDIT_FAILED')
  if (scanR9ReviewerCorrelators(packet).length) throw new Error('R9_PATH_MASK_AUTOMATIC_CORRELATOR_SCAN_FAILED')
  return audit
}

export function validateR9LabelsDraft(draft, packet, packetCreatedAt) {
  const keys = ['schemaVersion', 'reviewerKind', 'reviewProcessId', 'packetSha256', 'completedAt', 'labels']
  if (!exactKeys(draft, keys) || draft.schemaVersion !== R9_LABELS_DRAFT_VERSION
    || draft.reviewerKind !== 'independent_fresh_read_only'
    || typeof draft.reviewProcessId !== 'string' || draft.reviewProcessId.length < 8
    || draft.packetSha256 !== sha256(canonicalJson(packet))
    || !Number.isFinite(Date.parse(draft.completedAt)) || Date.parse(draft.completedAt) <= Date.parse(packetCreatedAt)
    || !Array.isArray(draft.labels) || draft.labels.length !== packet.pairs.length) throw new Error('R9_LABELS_DRAFT_INVALID')
  const expectedIds = packet.pairs.map((pair) => pair.caseAnonymousId).sort()
  const actualIds = draft.labels.map((label) => label.caseAnonymousId).sort()
  if (new Set(actualIds).size !== expectedIds.length || JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) throw new Error('R9_LABEL_COVERAGE_INVALID')
  for (const label of draft.labels) {
    if (!exactKeys(label, LABEL_KEYS)
      || !['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'].includes(label.preferredSide)
      || !BOOLEAN_LABEL_KEYS.every((field) => typeof label[field] === 'boolean')
      || typeof label.reason !== 'string' || label.reason.length < 16) throw new Error('R9_LABEL_VALUE_INVALID')
  }
  return draft
}

export function revealR9Mappings({ revealSecret, runId, packet, privateBindings }) {
  if (!Array.isArray(privateBindings) || privateBindings.length !== packet.pairs.length) throw new Error('R9_PRIVATE_BINDING_INVALID')
  return privateBindings.map((binding, index) => {
    const pair = packet.pairs[index]
    const assignment = deriveR9SideAssignment({ revealSecret, runId, observationId: binding.observationId })
    const commitment = hmac(revealSecret, ['R9_COMMITMENT', runId, binding.caseAnonymousId, binding.observationId, binding.caseId, assignment.X, assignment.Y])
    if (pair.caseAnonymousId !== binding.caseAnonymousId || assignment.X !== binding.X || assignment.Y !== binding.Y
      || binding.sideXHash !== sha256(canonicalJson(pair.X)) || binding.sideYHash !== sha256(canonicalJson(pair.Y))
      || binding.commitment !== commitment) throw new Error('R9_PRIVATE_BINDING_MISMATCH')
    return { caseAnonymousId: binding.caseAnonymousId, observationId: binding.observationId, caseId: binding.caseId, X: assignment.X, Y: assignment.Y }
  })
}

export function summarizeR9Labels(labels, mappings) {
  const counts = {
    candidatePreferred: 0, baselinePreferred: 0, tie: 0, insufficient: 0,
    candidateMajor: 0, baselineMajor: 0, candidatePlanningError: 0, baselinePlanningError: 0,
    candidateFactLoss: 0, baselineFactLoss: 0, candidateOverSplit: 0, baselineOverSplit: 0,
    candidateEvidenceGap: 0, baselineEvidenceGap: 0, candidateSevereError: 0, baselineSevereError: 0,
  }
  for (const label of labels) {
    const mapping = mappings.find((item) => item.caseAnonymousId === label.caseAnonymousId)
    if (!mapping) throw new Error('R9_MAPPING_MISSING')
    if (label.preferredSide === 'TIE') counts.tie += 1
    else if (label.preferredSide === 'INSUFFICIENT_INFORMATION') counts.insufficient += 1
    else counts[`${mapping[label.preferredSide]}Preferred`] += 1
    for (const [side, prefix] of [['X', 'x'], ['Y', 'y']]) {
      const target = mapping[side]
      for (const suffix of ['Major', 'PlanningError', 'FactLoss', 'OverSplit', 'EvidenceGap', 'SevereError']) {
        if (label[`${prefix}${suffix}`]) counts[`${target}${suffix}`] += 1
      }
    }
  }
  return counts
}

export function evaluateR9ReviewGate(counts, pairCount) {
  const determinatePairs = pairCount - counts.insufficient
  const checks = {
    sixteenPairs: pairCount === R9_REVIEW_GATE_POLICY.pairCount,
    minimumDeterminatePairs: determinatePairs >= R9_REVIEW_GATE_POLICY.minimumDeterminatePairs,
    candidateWinMarginAtLeast3: counts.candidatePreferred - counts.baselinePreferred >= R9_REVIEW_GATE_POLICY.minimumCandidateWinMargin,
    baselinePreferredAtMost3: counts.baselinePreferred <= R9_REVIEW_GATE_POLICY.maximumBaselinePreferred,
    candidateMajorNotWorse: counts.candidateMajor <= counts.baselineMajor,
    candidatePlanningErrorLower: counts.candidatePlanningError < counts.baselinePlanningError,
    candidateFactLossNotWorse: counts.candidateFactLoss <= counts.baselineFactLoss,
    zeroFactLossTiePasses: counts.candidateFactLoss !== 0 || counts.baselineFactLoss !== 0 || (counts.candidateFactLoss === 0 && counts.baselineFactLoss === 0),
    candidateOverSplitNotWorse: counts.candidateOverSplit <= counts.baselineOverSplit,
    candidateEvidenceCoverageNotWorse: counts.candidateEvidenceGap <= counts.baselineEvidenceGap,
    candidateSevereErrorNotWorse: counts.candidateSevereError <= counts.baselineSevereError,
  }
  return { checks, pass: Object.values(checks).every(Boolean) }
}
