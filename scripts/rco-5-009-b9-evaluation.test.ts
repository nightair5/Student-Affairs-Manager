import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  B9_SEMANTICS_BY_LABEL,
  evaluateB9ZeroCall,
  expectedB9LedgerStatus,
  expectedB9UnresolvedActionScopeTexts,
  type B9ActualCandidate,
  type B9ActualCase,
  type B9ExpectedCase,
  type B9FixedZeroCallGate,
} from './rco-5-009-b9-evaluation'

const POLICY_VERSION = 'local-action-candidate-policy-1.2.0'
const GATE: B9FixedZeroCallGate = {
  candidateIdentityExact: 1,
  actionSpanExact: 1,
  singletonOrEmptyObjectSpanExact: 1,
  ledgerDispositionExact: 1,
  acceptedCandidateTaskBijectionExact: 1,
  taskSemanticExact: 1,
  taskSelectedExact: 1,
  requiresActionExact: 1,
  responseContractCompletenessExact: 1,
  semanticCoverageCompletenessExact: 1,
  revisionUncertaintyExact: 1,
  resolvedRevisionRelationExact: 1,
  safeDefaultRecall: 1,
  unsafeDefaultSelectionsMaximum: 0,
  siblingSurvivalRate: 1,
}

const expectedCases: B9ExpectedCase[] = [
  {
    id: 'current', coverageTags: ['current'], sourceText: '请保存记录。', expected: {
      candidates: [{ key: 'save', action: '保存', occurrence: 1, object: '记录', localDisposition: 'local_proposition', responseVerdict: 'proposition', responseObject: 'own' }],
      tasks: [{ candidateKey: 'save', action: '保存', object: '记录', semanticLabel: 'CURRENT', selected: true }],
      requiresAction: true, responseContractComplete: true, semanticCoverageComplete: true, expectedIssueCodes: [],
      revisionRelations: [], unresolvedRevisionScopeTexts: [], suppressedRevisionScopeTexts: [],
    },
  },
  {
    id: 'sibling', coverageTags: ['sibling_survival'], sourceText: '请整理摘要。核对箱号。', expected: {
      candidates: [
        { key: 'prepare', action: '整理', occurrence: 1, object: '摘要', localDisposition: 'local_proposition', responseVerdict: 'proposition', responseObject: 'own' },
        { key: 'review', action: '核对', occurrence: 1, object: '箱号', localDisposition: 'needs_model', responseVerdict: 'proposition', responseObject: 'prepare' },
      ],
      tasks: [{ candidateKey: 'prepare', action: '整理', object: '摘要', semanticLabel: 'CURRENT', selected: true }],
      requiresAction: true, responseContractComplete: false, semanticCoverageComplete: false,
      expectedIssueCodes: ['OBJECT_CANDIDATE_INVALID'], revisionRelations: [], unresolvedRevisionScopeTexts: [], suppressedRevisionScopeTexts: [],
    },
  },
  {
    id: 'revision', coverageTags: ['resolved_amendment'], sourceText: '旧规则要求发送旧表。该规则调整为上传新表。', expected: {
      candidates: [
        { key: 'send', action: '发送', occurrence: 1, object: '旧表', localDisposition: 'local_proposition', responseVerdict: 'proposition', responseObject: 'own' },
        { key: 'upload', action: '上传', occurrence: 1, object: '新表', localDisposition: 'local_proposition', responseVerdict: 'proposition', responseObject: 'own' },
      ],
      tasks: [
        { candidateKey: 'send', action: '发送', object: '旧表', semanticLabel: 'SUPERSEDED', selected: false },
        { candidateKey: 'upload', action: '上传', object: '新表', semanticLabel: 'CURRENT', selected: false },
      ],
      requiresAction: true, responseContractComplete: true, semanticCoverageComplete: true, expectedIssueCodes: [],
      revisionRelations: [{
        kind: 'amends', targetCandidateKey: 'send', replacementCandidateKeys: ['upload'],
        evidenceScopeTexts: ['旧规则要求发送旧表。', '该规则调整为上传新表。'], resolution: 'adjacent_unique_referent',
      }],
      unresolvedRevisionScopeTexts: [], suppressedRevisionScopeTexts: [],
    },
  },
  {
    id: 'oov', coverageTags: ['out_of_vocabulary'], sourceText: '请抄录温度。', expected: {
      candidates: [], tasks: [], requiresAction: null, responseContractComplete: true, semanticCoverageComplete: false,
      expectedIssueCodes: [], revisionRelations: [], unresolvedRevisionScopeTexts: [], suppressedRevisionScopeTexts: [],
    },
  },
  {
    id: 'condition', coverageTags: ['condition_unknown'], sourceText: '若门卡异常，请联系服务席。', expected: {
      candidates: [{ key: 'contact', action: '联系', occurrence: 1, object: '服务席', localDisposition: 'local_proposition', responseVerdict: 'proposition', responseObject: 'own' }],
      tasks: [{ candidateKey: 'contact', action: '联系', object: '服务席', semanticLabel: 'CONDITION_UNKNOWN', selected: false }],
      requiresAction: null, responseContractComplete: true, semanticCoverageComplete: true, expectedIssueCodes: [],
      revisionRelations: [], unresolvedRevisionScopeTexts: [], suppressedRevisionScopeTexts: [],
    },
  },
  {
    id: 'shared-object', coverageTags: ['shared_object_span'], sourceText: '请核对并提交名单。', expected: {
      candidates: [
        { key: 'review-list', action: '核对', occurrence: 1, object: '名单', localDisposition: 'local_proposition', responseVerdict: 'proposition', responseObject: 'own' },
        { key: 'submit-list', action: '提交', occurrence: 1, object: '名单', localDisposition: 'local_proposition', responseVerdict: 'proposition', responseObject: 'own' },
      ],
      tasks: [
        { candidateKey: 'review-list', action: '核对', object: '名单', semanticLabel: 'CURRENT', selected: true },
        { candidateKey: 'submit-list', action: '提交', object: '名单', semanticLabel: 'CURRENT', selected: true },
      ],
      requiresAction: true, responseContractComplete: true, semanticCoverageComplete: true, expectedIssueCodes: [],
      revisionRelations: [], unresolvedRevisionScopeTexts: [], suppressedRevisionScopeTexts: [],
    },
  },
]

function nthIndex(text: string, needle: string, occurrence: number): number {
  let cursor = -1
  for (let index = 0; index < occurrence; index += 1) cursor = text.indexOf(needle, cursor + 1)
  if (cursor < 0) throw new Error(`missing ${needle}#${occurrence}`)
  return cursor
}

function makeActual(expected: B9ExpectedCase): B9ActualCase {
  const fingerprint = `sha256:${createHash('sha256').update(`${expected.id}\u0000source-v1\u0000${expected.sourceText}`).digest('hex')}`
  const candidates: B9ActualCandidate[] = expected.expected.candidates.map((candidate) => {
    const actionSourceStart = nthIndex(expected.sourceText, candidate.action, candidate.occurrence)
    const actionSourceEnd = actionSourceStart + candidate.action.length
    const objectStart = candidate.object === null ? -1 : expected.sourceText.indexOf(candidate.object)
    const objectCandidates = candidate.object === null ? [] : [{
      id: `object:${fingerprint.slice(7, 19)}:${objectStart}:${objectStart + candidate.object.length}`,
      surface: candidate.object,
      sourceStart: objectStart,
      sourceEnd: objectStart + candidate.object.length,
      sourceSlice: candidate.object,
    }]
    return {
      key: candidate.key,
      candidateId: `action:${POLICY_VERSION}:${fingerprint.slice(7, 19)}:${actionSourceStart}:${actionSourceEnd}`,
      action: candidate.action,
      occurrence: candidate.occurrence,
      actionSourceStart,
      actionSourceEnd,
      actionSourceSlice: candidate.action,
      objectCandidates,
      defaultObjectCandidateId: objectCandidates[0]?.id ?? null,
      localDisposition: candidate.localDisposition,
      clauseRole: 'directive',
      currentness: expected.id === 'revision' && candidate.key === 'send' ? 'historical' : 'current',
      conditionStatus: expected.coverageTags.includes('condition_unknown') ? 'no_match' : 'none',
      conditionTruth: expected.coverageTags.includes('condition_unknown') ? 'unknown' : 'none',
      responseVerdict: candidate.responseVerdict,
      responseObjectCandidateId: null,
      responseObjectOwnerKey: candidate.responseObject === 'own' ? candidate.key : candidate.responseObject,
    }
  })
  const byKey = new Map(candidates.map((candidate) => [candidate.key, candidate]))
  for (const candidate of candidates) {
    const expectedCandidate = expected.expected.candidates.find((item) => item.key === candidate.key)
    const ownerKey = expectedCandidate?.responseObject === 'own' ? candidate.key : expectedCandidate?.responseObject
    candidate.responseObjectCandidateId = ownerKey ? byKey.get(ownerKey)?.objectCandidates[0]?.id ?? null : null
  }
  const ledger = expected.expected.candidates.map((candidate) => {
    const actualCandidate = byKey.get(candidate.key)
    if (!actualCandidate) throw new Error(candidate.key)
    const status = expectedB9LedgerStatus(candidate)
    return {
      candidateKey: candidate.key,
      candidateId: actualCandidate.candidateId,
      status,
      objectCandidateId: status === 'accepted_local' || status === 'accepted_model' ? actualCandidate.objectCandidates[0]?.id ?? null : null,
      reasonCodes: [],
    }
  })
  const tasks = expected.expected.tasks.map((task) => {
    const candidate = byKey.get(task.candidateKey)
    const object = candidate?.objectCandidates[0]
    if (!candidate || !object) throw new Error(task.candidateKey)
    return {
      candidateKey: task.candidateKey,
      id: `task:${candidate.candidateId}`,
      originCandidateId: candidate.candidateId,
      occurrenceId: candidate.candidateId,
      action: candidate.action,
      actionSourceStart: candidate.actionSourceStart,
      actionSourceEnd: candidate.actionSourceEnd,
      actionSourceSlice: candidate.actionSourceSlice,
      object: object.surface,
      objectCandidateId: object.id,
      objectSourceStart: object.sourceStart,
      objectSourceEnd: object.sourceEnd,
      objectSourceSlice: object.sourceSlice,
      semantics: B9_SEMANTICS_BY_LABEL[task.semanticLabel],
      selected: task.selected,
      needsConfirmation: !task.selected,
      conditionStatus: candidate.conditionStatus,
      conditionTruth: candidate.conditionTruth,
    }
  })
  return {
    caseId: expected.id,
    sourceText: expected.sourceText,
    sourceFingerprint: fingerprint,
    candidatePolicyVersion: POLICY_VERSION,
    candidates,
    ledger,
    tasks,
    requiresAction: expected.expected.requiresAction,
    responseContractComplete: expected.expected.responseContractComplete,
    semanticCoverageComplete: expected.expected.semanticCoverageComplete,
    issueCodes: [...expected.expected.expectedIssueCodes],
    materializerIssueCodes: [],
    runnerIssueCodes: [],
    revisionRelations: expected.expected.revisionRelations.map((relation) => ({ ...relation, referentType: '规则' })),
    unresolvedRevisionScopeTexts: [...expected.expected.unresolvedRevisionScopeTexts],
    suppressedRevisionScopeTexts: [...expected.expected.suppressedRevisionScopeTexts],
    unresolvedActionScopeTexts: expectedB9UnresolvedActionScopeTexts(expected),
    unsafeDefaultSelections: [],
  }
}

function cloneActual(cases: B9ActualCase[]): B9ActualCase[] {
  return structuredClone(cases)
}

describe('RCO-5-009 B9 pure evaluation', () => {
  it('passes exact candidate identity, issue, revision, OOV and condition invariants', () => {
    const result = evaluateB9ZeroCall(expectedCases, expectedCases.map(makeActual), GATE)
    expect(B9_SEMANTICS_BY_LABEL.UNKNOWN.actor).toBe('unknown')
    expect(result.gateFailures).toEqual([])
    expect(result.gate).toBe('PASS')
    expect(Object.entries(result.metrics).filter(([name]) => !name.endsWith('Selections')).every(([, value]) => value === 1)).toBe(true)
    expect(result.metrics.unsafeDefaultSelections).toBe(0)
    expect(result.metrics.extraDefaultSelections).toBe(0)
  })

  it('fails an altered occurrence span and object ownership without text-based recovery', () => {
    const actual = cloneActual(expectedCases.map(makeActual))
    actual[0].candidates[0].candidateId = 'action:wrong'
    actual[0].candidates[0].actionSourceSlice = '保'
    actual[0].candidates[0].responseObjectOwnerKey = 'wrong-owner'
    actual[0].tasks[0].objectCandidateId = 'object:wrong'
    const result = evaluateB9ZeroCall(expectedCases, actual, GATE)
    expect(result.gate).toBe('FAIL')
    expect(result.metrics.candidateIdentityExact).toBeLessThan(1)
    expect(result.metrics.actionSpanExact).toBeLessThan(1)
    expect(result.metrics.inputFixtureTransportExact).toBeLessThan(1)
    expect(result.metrics.acceptedCandidateTaskBijectionExact).toBeLessThan(1)
  })

  it('recomputes source identity and the frozen candidate policy instead of trusting self-reported values', () => {
    const actual = cloneActual(expectedCases.map(makeActual))
    const forgedFingerprint = `sha256:${'0'.repeat(64)}`
    actual[0].sourceFingerprint = forgedFingerprint
    actual[0].candidatePolicyVersion = 'forged-policy'
    const candidate = actual[0].candidates[0]
    const object = candidate.objectCandidates[0]
    candidate.candidateId = `action:forged-policy:${forgedFingerprint.slice(7, 19)}:${candidate.actionSourceStart}:${candidate.actionSourceEnd}`
    object.id = `object:${forgedFingerprint.slice(7, 19)}:${object.sourceStart}:${object.sourceEnd}`
    candidate.defaultObjectCandidateId = object.id
    candidate.responseObjectCandidateId = object.id
    actual[0].ledger[0].candidateId = candidate.candidateId
    actual[0].ledger[0].objectCandidateId = object.id
    actual[0].tasks[0].id = `task:${candidate.candidateId}`
    actual[0].tasks[0].originCandidateId = candidate.candidateId
    actual[0].tasks[0].occurrenceId = candidate.candidateId
    actual[0].tasks[0].objectCandidateId = object.id
    const result = evaluateB9ZeroCall(expectedCases, actual, GATE)
    expect(result.gate).toBe('FAIL')
    expect(result.metrics.sourceFingerprintExact).toBeLessThan(1)
    expect(result.metrics.candidatePolicyVersionExact).toBeLessThan(1)
    expect(result.metrics.candidateIdentityExact).toBeLessThan(1)
  })

  it('keeps shared object spans owned by each current candidate', () => {
    const actual = expectedCases.map(makeActual)
    const shared = actual.find((item) => item.caseId === 'shared-object')
    expect(shared).toBeDefined()
    expect(shared?.candidates[0].objectCandidates[0].id).toBe(shared?.candidates[1].objectCandidates[0].id)
    const result = evaluateB9ZeroCall(expectedCases, actual, GATE)
    expect(result.gate).toBe('PASS')
    expect(result.metrics.inputFixtureTransportExact).toBe(1)
  })

  it('scores expected issue codes and the positive revision relation exactly', () => {
    const actual = cloneActual(expectedCases.map(makeActual))
    actual[1].issueCodes = []
    actual[2].revisionRelations[0].targetCandidateKey = 'upload'
    const result = evaluateB9ZeroCall(expectedCases, actual, GATE)
    expect(result.gate).toBe('FAIL')
    expect(result.metrics.expectedIssueCodesExact).toBeLessThan(1)
    expect(result.metrics.resolvedRevisionRelationExact).toBeLessThan(1)
  })

  it('derives the OOV unresolved scope and condition no-match requirements from tags', () => {
    const actual = cloneActual(expectedCases.map(makeActual))
    actual[3].unresolvedActionScopeTexts = []
    actual[4].candidates[0].conditionStatus = 'attached_unique'
    actual[4].tasks[0].conditionTruth = 'true'
    const result = evaluateB9ZeroCall(expectedCases, actual, GATE)
    expect(result.gate).toBe('FAIL')
    expect(result.metrics.outOfVocabularyUnresolvedActionExact).toBe(0)
    expect(result.metrics.conditionUnknownExact).toBe(0)
  })

  it('rejects an extra default selection even when it is otherwise a valid task', () => {
    const actual = cloneActual(expectedCases.map(makeActual))
    actual[2].tasks[1].selected = true
    actual[2].tasks[1].needsConfirmation = false
    const result = evaluateB9ZeroCall(expectedCases, actual, GATE)
    expect(result.gate).toBe('FAIL')
    expect(result.metrics.taskSelectedExact).toBeLessThan(1)
    expect(result.metrics.extraDefaultSelections).toBe(1)
  })

  it('keeps the one-shot runner on the direct candidate path and free of external dispatch hooks', async () => {
    const source = await readFile(new URL('./run-rco-5-009-b9-zero-call.ts', import.meta.url), 'utf8')
    expect(source).toContain("from '../src/recognition/scopeIndexV11'")
    expect(source).toContain("from '../src/recognition/localActionCandidateIndexV2'")
    expect(source).toContain("from '../src/recognition/actionCandidateComposerV2'")
    expect(source).toContain("from '../src/recognition/candidateTaskSafetyPolicy'")
    expect(source).toContain("flag: 'wx'")
    expect(source).toContain("'status', '--porcelain'")
    expect(source).toContain("'rev-parse', '@{u}'")
    expect(source).toContain('B9_UNSAFE_REPOSITORY_PATH')
    expect(source).toContain('FIRST_RUN_B9_ZERO_CALL_RUNTIME_FAILURE_NOW_SEEN_DEVELOPMENT')
    expect(source).toContain('failurePhase')
    expect(source).toContain('rco-5-009-b9-zero-call-20260904a')
    expect(source).not.toMatch(/taskFormationPolicyP[234]|revisionRelationResolver|materializeRevisionRelationsByScope|projectLegacySelectionToCandidateClassifications/u)
    expect(source).not.toMatch(/fetch|https?|process\.env|deepseek|api.?key|clipboard/iu)
  })
})
