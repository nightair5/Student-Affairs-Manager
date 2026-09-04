import { describe, expect, it } from 'vitest'
import datasetJson from '../../docs/recognition-optimization/RCO-5-009-B9_DEVELOPMENT_DATASET.json'
import priorB0Json from '../../docs/recognition-optimization/RCO-5-005-B0_DEVELOPMENT_DATASET.json'
import priorB02Json from '../../docs/recognition-optimization/RCO-5-005-B02_DEVELOPMENT_DATASET.json'
import priorB1Json from '../../docs/recognition-optimization/RCO-5-006-B1_DEVELOPMENT_DATASET.json'
import priorB2Json from '../../docs/recognition-optimization/RCO-5-007-B2_CHALLENGE_DATASET.json'
import priorB3Json from '../../docs/recognition-optimization/RCO-5-007-B3_CHALLENGE_DATASET.json'
import priorB4Json from '../../docs/recognition-optimization/RCO-5-007-B4_CHALLENGE_DATASET.json'
import priorB5Json from '../../docs/recognition-optimization/RCO-5-007-B5_CHALLENGE_DATASET.json'
import priorB6Json from '../../docs/recognition-optimization/RCO-5-007-B6_CHALLENGE_DATASET.json'
import priorB7Json from '../../docs/recognition-optimization/RCO-5-007-B7_DEVELOPMENT_DATASET.json'
import priorB8Json from '../../docs/recognition-optimization/RCO-5-008-B8_DEVELOPMENT_DATASET.json'

type LocalDisposition = 'local_proposition' | 'needs_model' | 'local_non_task'
type ResponseVerdict = 'proposition' | 'mention_only' | 'uncertain'
type SemanticLabel = 'CURRENT' | 'HISTORICAL' | 'SUPERSEDED' | 'UNKNOWN' | 'CONDITION_UNKNOWN'

interface ExpectedRevisionRelation {
  kind: 'cancels' | 'supersedes' | 'amends'
  targetCandidateKey: string
  replacementCandidateKeys: string[]
  evidenceScopeTexts: string[]
  resolution: string
}

interface ExpectedCandidate {
  key: string
  action: string
  occurrence: number
  object: string | null
  localDisposition: LocalDisposition
  responseVerdict: ResponseVerdict
  responseObject: 'own' | string | null
}

interface ExpectedTask {
  candidateKey: string
  action: string
  object: string
  semanticLabel: SemanticLabel
  selected: boolean
}

interface ExpectedCase {
  candidates: ExpectedCandidate[]
  tasks: ExpectedTask[]
  requiresAction: boolean | null
  responseContractComplete: boolean
  semanticCoverageComplete: boolean
  expectedIssueCodes: string[]
  revisionRelations: ExpectedRevisionRelation[]
  unresolvedRevisionScopeTexts: string[]
  suppressedRevisionScopeTexts: string[]
}

interface DatasetCase {
  id: string
  semanticFamilyId: string
  coverageTags: string[]
  sourceTitle: string
  sourceText: string
  referenceTime: string
  timezone: string
  expected: ExpectedCase
}

interface Dataset {
  schemaVersion: string
  datasetId: string
  split: string
  classification: string
  seenStatus: string
  createdAt: string
  labelProvenance: string
  scopeIndexVersion: string
  candidatePolicyVersion: string
  composerVersion: string
  taskSafetySchemaVersion: string
  taskSafetyPolicyVersion: string
  multipleObjectChoiceStatus: string
  sampleCount: number
  cases: DatasetCase[]
}

interface PriorDataset {
  cases: Array<{
    id?: string
    sourceText: string
    semanticFamilyId?: string
  }>
}

const dataset = datasetJson as Dataset
const priors = [
  priorB0Json,
  priorB02Json,
  priorB1Json,
  priorB2Json,
  priorB3Json,
  priorB4Json,
  priorB5Json,
  priorB6Json,
  priorB7Json,
  priorB8Json,
] as PriorDataset[]

const TOP_LEVEL_KEYS = [
  'schemaVersion',
  'datasetId',
  'split',
  'classification',
  'seenStatus',
  'createdAt',
  'labelProvenance',
  'scopeIndexVersion',
  'candidatePolicyVersion',
  'composerVersion',
  'taskSafetySchemaVersion',
  'taskSafetyPolicyVersion',
  'multipleObjectChoiceStatus',
  'sampleCount',
  'cases',
] as const

const CASE_KEYS = [
  'id',
  'semanticFamilyId',
  'coverageTags',
  'sourceTitle',
  'sourceText',
  'referenceTime',
  'timezone',
  'expected',
] as const

const EXPECTED_KEYS = [
  'candidates',
  'tasks',
  'requiresAction',
  'responseContractComplete',
  'semanticCoverageComplete',
  'expectedIssueCodes',
  'revisionRelations',
  'unresolvedRevisionScopeTexts',
  'suppressedRevisionScopeTexts',
] as const

const CANDIDATE_KEYS = [
  'key',
  'action',
  'occurrence',
  'object',
  'localDisposition',
  'responseVerdict',
  'responseObject',
] as const

const TASK_KEYS = ['candidateKey', 'action', 'object', 'semanticLabel', 'selected'] as const

function sortedKeys(value: object): string[] {
  return Object.keys(value).sort()
}

function normalizedBigrams(value: string): Set<string> {
  const normalized = value.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase()
  return new Set(Array.from(
    { length: Math.max(0, normalized.length - 1) },
    (_, index) => normalized.slice(index, index + 2),
  ))
}

function bigramJaccard(left: string, right: string): number {
  const leftSet = normalizedBigrams(left)
  const rightSet = normalizedBigrams(right)
  const intersection = [...leftSet].filter((item) => rightSet.has(item)).length
  const union = new Set([...leftSet, ...rightSet]).size
  return union === 0 ? 1 : intersection / union
}

function fixture(id: string): DatasetCase {
  const matches = dataset.cases.filter((item) => item.id === id)
  expect(matches, id).toHaveLength(1)
  return matches[0]
}

function candidate(fixtureValue: DatasetCase, key: string): ExpectedCandidate {
  const matches = fixtureValue.expected.candidates.filter((item) => item.key === key)
  expect(matches, `${fixtureValue.id}:${key}`).toHaveLength(1)
  return matches[0]
}

function task(fixtureValue: DatasetCase, key: string): ExpectedTask {
  const matches = fixtureValue.expected.tasks.filter((item) => item.candidateKey === key)
  expect(matches, `${fixtureValue.id}:${key}`).toHaveLength(1)
  return matches[0]
}

describe('RCO-5-009-B9 frozen data structure', () => {
  it('has the preregistered identity, versions and exact closed structure', () => {
    expect(sortedKeys(dataset)).toEqual([...TOP_LEVEL_KEYS].sort())
    expect(dataset).toMatchObject({
      schemaVersion: 'rco-5-009-b9-development-1.0.0',
      datasetId: 'rco-5-009-b9-development-20260904',
      split: 'Development',
      classification: 'anonymous_synthetic_codex_authored_candidate_classification_development',
      seenStatus: 'UNSEEN_BY_DEEPSEEK_AT_FREEZE_LOCAL_DESIGN_PREFLIGHT_ONLY',
      labelProvenance: 'Codex-authored reference labels; not independent human ground truth',
      scopeIndexVersion: 'scope-index-1.1',
      candidatePolicyVersion: 'local-action-candidate-policy-1.2.0',
      composerVersion: 'action-candidate-composer-1.2.0',
      taskSafetySchemaVersion: 'candidate-task-safety-result-2.0.0',
      taskSafetyPolicyVersion: 'candidate-task-safety-policy-2.0.0',
      multipleObjectChoiceStatus: 'NOT_EXPRESSIBLE_BY_POLICY_1.2.0',
      sampleCount: 12,
    })
    expect(dataset.cases).toHaveLength(12)
    for (const item of dataset.cases) {
      expect(sortedKeys(item), item.id).toEqual([...CASE_KEYS].sort())
      expect(sortedKeys(item.expected), item.id).toEqual([...EXPECTED_KEYS].sort())
      expect(item.sourceTitle.trim().length, item.id).toBeGreaterThan(0)
      expect(item.sourceText.trim().length, item.id).toBeGreaterThan(0)
      expect(item.coverageTags.length, item.id).toBeGreaterThan(0)
      expect(new Set(item.coverageTags).size, item.id).toBe(item.coverageTags.length)
      expect(item.timezone, item.id).toBe('Asia/Shanghai')
      for (const entry of item.expected.candidates) {
        expect(sortedKeys(entry), `${item.id}:${entry.key}`).toEqual([...CANDIDATE_KEYS].sort())
        expect(entry.key.trim().length, item.id).toBeGreaterThan(0)
        expect(entry.action.trim().length, entry.key).toBeGreaterThan(0)
        expect(Number.isInteger(entry.occurrence), entry.key).toBe(true)
        expect(entry.occurrence, entry.key).toBeGreaterThan(0)
        expect(['local_proposition', 'needs_model', 'local_non_task'], entry.key).toContain(entry.localDisposition)
        expect(['proposition', 'mention_only', 'uncertain'], entry.key).toContain(entry.responseVerdict)
        if (entry.responseVerdict !== 'proposition') expect(entry.responseObject, entry.key).toBeNull()
        if (entry.responseObject === 'own') expect(entry.object, entry.key).not.toBeNull()
      }
      for (const entry of item.expected.tasks) {
        expect(sortedKeys(entry), `${item.id}:${entry.candidateKey}`).toEqual([...TASK_KEYS].sort())
        expect(['CURRENT', 'HISTORICAL', 'SUPERSEDED', 'UNKNOWN', 'CONDITION_UNKNOWN'], entry.candidateKey).toContain(entry.semanticLabel)
      }
    }
  })

  it('freezes all aggregate counts and the tri-state actionability vector', () => {
    const candidates = dataset.cases.flatMap((item) => item.expected.candidates)
    const tasks = dataset.cases.flatMap((item) => item.expected.tasks)
    const dispositionCounts = Object.fromEntries(['local_proposition', 'needs_model', 'local_non_task'].map((value) => [
      value,
      candidates.filter((item) => item.localDisposition === value).length,
    ]))
    expect(candidates).toHaveLength(19)
    expect(tasks).toHaveLength(13)
    expect(tasks.filter((item) => item.selected)).toHaveLength(7)
    expect(dispositionCounts).toEqual({ local_proposition: 12, needs_model: 6, local_non_task: 1 })
    expect(dataset.cases.map((item) => item.expected.requiresAction)).toEqual([
      null,
      false,
      true,
      null,
      true,
      true,
      false,
      true,
      null,
      true,
      true,
      null,
    ])
    expect(dataset.cases.filter((item) => !item.expected.responseContractComplete).map((item) => item.id)).toEqual([
      'rco-task-b9-06',
    ])
    expect(dataset.cases.filter((item) => !item.expected.semanticCoverageComplete).map((item) => item.id)).toEqual([
      'rco-task-b9-04',
      'rco-task-b9-06',
      'rco-task-b9-07',
      'rco-task-b9-09',
    ])
    expect(dataset.cases.filter((item) => item.expected.expectedIssueCodes.length > 0).map((item) => [item.id, item.expected.expectedIssueCodes])).toEqual([
      ['rco-task-b9-06', ['OBJECT_CANDIDATE_INVALID']],
    ])
  })

  it('keeps candidate keys, response ownership and task bindings internally closed', () => {
    const globalCandidateKeys = dataset.cases.flatMap((item) => item.expected.candidates.map((entry) => entry.key))
    expect(new Set(globalCandidateKeys).size).toBe(globalCandidateKeys.length)
    for (const item of dataset.cases) {
      const byKey = new Map(item.expected.candidates.map((entry) => [entry.key, entry]))
      expect(byKey.size, item.id).toBe(item.expected.candidates.length)
      for (const entry of item.expected.candidates) {
        if (entry.responseObject !== null && entry.responseObject !== 'own') {
          expect(byKey.has(entry.responseObject), `${item.id}:${entry.key}`).toBe(true)
        }
      }
      for (const expectedTask of item.expected.tasks) {
        const sourceCandidate = byKey.get(expectedTask.candidateKey)
        expect(sourceCandidate, `${item.id}:${expectedTask.candidateKey}`).toBeDefined()
        expect(expectedTask.action, expectedTask.candidateKey).toBe(sourceCandidate?.action)
        expect(expectedTask.object, expectedTask.candidateKey).toBe(sourceCandidate?.object)
      }
    }
    const borrowedObjects = dataset.cases.flatMap((item) => item.expected.candidates)
      .filter((item) => item.responseObject !== null && item.responseObject !== 'own')
    expect(borrowedObjects).toEqual([
      expect.objectContaining({
        key: 'b9-06-review',
        responseObject: 'b9-06-prepare',
      }),
    ])
  })

  it('freezes each decisive expected edge case without running the implementation', () => {
    const b901 = fixture('rco-task-b9-01')
    expect(candidate(b901, 'b9-01-save')).toMatchObject({ localDisposition: 'needs_model', responseVerdict: 'proposition', object: '纸质值班簿' })
    expect(task(b901, 'b9-01-save')).toMatchObject({ semanticLabel: 'UNKNOWN', selected: false })

    const b902 = fixture('rco-task-b9-02')
    expect(candidate(b902, 'b9-02-save')).toMatchObject({ localDisposition: 'needs_model', responseVerdict: 'mention_only', responseObject: null })
    expect(b902.expected.tasks).toEqual([])

    const b903 = fixture('rco-task-b9-03')
    expect(b903.expected.candidates.map((item) => [item.action, item.localDisposition])).toEqual([
      ['准备', 'local_proposition'],
      ['提交', 'needs_model'],
    ])
    expect(b903.expected.tasks.map((item) => [item.semanticLabel, item.selected])).toEqual([
      ['CURRENT', true],
      ['UNKNOWN', false],
    ])

    const b904 = fixture('rco-task-b9-04')
    expect(candidate(b904, 'b9-04-save')).toMatchObject({ object: null, responseVerdict: 'uncertain', responseObject: null })
    expect(b904.expected).toMatchObject({ tasks: [], requiresAction: null, semanticCoverageComplete: false })

    const b905 = fixture('rco-task-b9-05')
    expect(b905.expected.candidates.map((item) => [item.action, item.occurrence, item.object])).toEqual([
      ['核对', 1, '北区柜号'],
      ['核对', 2, '南区柜号'],
    ])
    expect(new Set(b905.expected.tasks.map((item) => item.candidateKey)).size).toBe(2)

    const b906 = fixture('rco-task-b9-06')
    expect(candidate(b906, 'b9-06-review')).toMatchObject({
      localDisposition: 'needs_model',
      responseVerdict: 'proposition',
      responseObject: 'b9-06-prepare',
    })
    expect(b906.expected.tasks.map((item) => item.candidateKey)).toEqual(['b9-06-prepare'])
    expect(b906.expected.responseContractComplete).toBe(false)

    const b907 = fixture('rco-task-b9-07')
    expect(b907.expected.tasks).toEqual([
      expect.objectContaining({ candidateKey: 'b9-07-save-red', semanticLabel: 'HISTORICAL', selected: false }),
    ])
    expect(candidate(b907, 'b9-07-save-red').localDisposition).toBe('local_proposition')
    expect(candidate(b907, 'b9-07-review-blue').object).toBe('蓝色门签是否属于该流程尚未说明')
    expect(b907.expected.unresolvedRevisionScopeTexts).toEqual(['该流程后来作废。'])
    expect(b907.expected.suppressedRevisionScopeTexts).toEqual(['该流程后来作废。'])

    const b908 = fixture('rco-task-b9-08')
    expect(b908.expected.tasks.map((item) => [item.candidateKey, item.semanticLabel, item.selected])).toEqual([
      ['b9-08-send-east', 'SUPERSEDED', false],
      ['b9-08-upload-west', 'CURRENT', false],
      ['b9-08-save-today', 'CURRENT', true],
    ])
    expect(b908.expected.revisionRelations).toEqual([{
      kind: 'amends',
      targetCandidateKey: 'b9-08-send-east',
      replacementCandidateKeys: ['b9-08-upload-west'],
      evidenceScopeTexts: ['旧规则要求发送东组路线表。', '该规则调整为上传西组值守表。'],
      resolution: 'adjacent_unique_referent',
    }])
    expect(b908.expected.unresolvedRevisionScopeTexts).toEqual([])
    expect(b908.expected.suppressedRevisionScopeTexts).toEqual([])

    const b909 = fixture('rco-task-b9-09')
    expect(b909.expected).toMatchObject({ candidates: [], tasks: [], requiresAction: null, semanticCoverageComplete: false })

    const b910 = fixture('rco-task-b9-10')
    expect(b910.expected.candidates.map((item) => [item.action, item.localDisposition])).toEqual([
      ['上传', 'needs_model'],
      ['检查', 'local_proposition'],
    ])
    expect(b910.expected.tasks).toEqual([
      expect.objectContaining({ candidateKey: 'b9-10-review-door', object: '消防门编号', selected: true }),
    ])

    const b911 = fixture('rco-task-b9-11')
    expect(candidate(b911, 'b9-11-save').object).toBe('已经检查的晚班记录')
    expect(candidate(b911, 'b9-11-review-contained').localDisposition).toBe('local_non_task')
    expect(task(b911, 'b9-11-save').object).toBe('已经检查的晚班记录')

    const b912 = fixture('rco-task-b9-12')
    expect(task(b912, 'b9-12-contact')).toMatchObject({ semanticLabel: 'CONDITION_UNKNOWN', selected: false })
    expect(b912.expected.requiresAction).toBeNull()
  })

  it('does not reuse B0-B8 source text or semantic families and stays below the frozen similarity limit', () => {
    const oldCases = priors.flatMap((prior) => prior.cases)
    const oldIds = new Set(oldCases.map((item) => item.id).filter((value): value is string => Boolean(value)))
    const oldTexts = new Set(oldCases.map((item) => item.sourceText))
    const oldFamilies = new Set(oldCases.map((item) => item.semanticFamilyId).filter((value): value is string => Boolean(value)))
    expect(new Set(dataset.cases.map((item) => item.id)).size).toBe(dataset.cases.length)
    expect(new Set(dataset.cases.map((item) => item.sourceText)).size).toBe(dataset.cases.length)
    expect(new Set(dataset.cases.map((item) => item.semanticFamilyId)).size).toBe(dataset.cases.length)
    for (const item of dataset.cases) {
      expect(oldIds.has(item.id), item.id).toBe(false)
      expect(oldTexts.has(item.sourceText), item.id).toBe(false)
      expect(oldFamilies.has(item.semanticFamilyId), item.id).toBe(false)
      const maximumSimilarity = Math.max(...oldCases.map((old) => bigramJaccard(item.sourceText, old.sourceText)))
      expect(maximumSimilarity, `${item.id}:${maximumSimilarity}`).toBeLessThan(0.55)
    }
  })

  it('contains no obvious personal identifier, credential or API secret', () => {
    const sourceMaterial = dataset.cases.map((item) => `${item.sourceTitle}\n${item.sourceText}`).join('\n')
    expect(sourceMaterial).not.toMatch(/\b1[3-9]\d{9}\b|\b\d{15,18}[0-9Xx]\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:api|access)[-_ ]?key\s*[:=]/iu)
  })
})
