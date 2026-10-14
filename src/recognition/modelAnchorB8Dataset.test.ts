import { describe, expect, it } from 'vitest'
import datasetJson from '../../docs/recognition-optimization/RCO-5-008-B8_DEVELOPMENT_DATASET.json'
import priorB0Json from '../../docs/recognition-optimization/RCO-5-005-B0_DEVELOPMENT_DATASET.json'
import priorB02Json from '../../docs/recognition-optimization/RCO-5-005-B02_DEVELOPMENT_DATASET.json'
import priorB1Json from '../../docs/recognition-optimization/RCO-5-006-B1_DEVELOPMENT_DATASET.json'
import priorB2Json from '../../docs/recognition-optimization/RCO-5-007-B2_CHALLENGE_DATASET.json'
import priorB3Json from '../../docs/recognition-optimization/RCO-5-007-B3_CHALLENGE_DATASET.json'
import priorB4Json from '../../docs/recognition-optimization/RCO-5-007-B4_CHALLENGE_DATASET.json'
import priorB5Json from '../../docs/recognition-optimization/RCO-5-007-B5_CHALLENGE_DATASET.json'
import priorB6Json from '../../docs/recognition-optimization/RCO-5-007-B6_CHALLENGE_DATASET.json'
import priorB7Json from '../../docs/recognition-optimization/RCO-5-007-B7_DEVELOPMENT_DATASET.json'
import { composeLocalAnchorsV2, MODEL_ANCHOR_LOCAL_COMPOSER_VERSION } from './modelAnchorLocalComposerV2'
import { MODEL_ANCHOR_SELECTION_SCHEMA_VERSION, validateModelAnchorSelection, type ModelAnchorSelection } from './modelAnchorSelectionContract'
import { indexImmutableScopesV11, SCOPE_INDEX_VERSION } from './scopeIndexV11'
import { scoreTaskFormationCase, type TaskFormationExpectedCase, type TaskFormationPredictionCase } from './taskFormationEvaluation'
import { materializeRevisionRelationsByScope, scoreStableDefaultSafety, TASK_FORMATION_EVALUATOR_V2_VERSION, type ExpectedRevisionRelationV2 } from './taskFormationEvaluationV2'
import { formLocalTaskSuggestionsP4, TASK_FORMATION_P4_POLICY_VERSION, validateLocalTaskFormationP4 } from './taskFormationPolicyP4'

type Surface = { scopeText: string; surface: string }
interface Selection { expectedId: string; propositionScopeTexts: string[]; action: Surface; object: Surface }
interface Fixture extends TaskFormationExpectedCase { semanticFamilyId: string; coverageTags: string[]; sourceTitle: string; sourceText: string; referenceTime: string; timezone: string; expected: TaskFormationExpectedCase['expected'] & { selections: Selection[]; ignoredScopeTexts: string[]; revisionRelations: ExpectedRevisionRelationV2[]; unresolvedRevisionScopeTexts: string[] } }
interface Dataset { schemaVersion: string; datasetId: string; classification: string; seenStatus: string; sampleCount: number; scopeIndexVersion: string; modelSelectionSchemaVersion: string; localComposerVersion: string; p4PolicyVersion: string; evaluatorVersion: string; cases: Fixture[] }
const dataset = datasetJson as Dataset
const priors = [priorB0Json, priorB02Json, priorB1Json, priorB2Json, priorB3Json, priorB4Json, priorB5Json, priorB6Json, priorB7Json] as Array<{ cases: Array<{ sourceText: string; semanticFamilyId?: string }> }>

function grams(value: string): Set<string> { const normalized = value.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase(); return new Set(Array.from({ length: Math.max(0, normalized.length - 1) }, (_, index) => normalized.slice(index, index + 2))) }
function jaccard(left: string, right: string): number { const a = grams(left); const b = grams(right); const intersection = [...a].filter((item) => b.has(item)).length; const union = new Set([...a, ...b]).size; return union === 0 ? 1 : intersection / union }

async function idealSelection(fixture: Fixture) {
  const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
  const lookup = (text: string) => { const matches = index.scopes.filter((scope) => scope.text === text); expect(matches, `${fixture.id}:${text}`).toHaveLength(1); return matches[0].id }
  const selection: ModelAnchorSelection = {
    schemaVersion: MODEL_ANCHOR_SELECTION_SCHEMA_VERSION,
    sourceId: index.sourceId, sourceVersionId: index.sourceVersionId, sourceFingerprint: index.sourceFingerprint,
    producerRunId: `b8-oracle-${fixture.id}`,
    directives: fixture.expected.selections.map((item) => ({ id: item.expectedId, propositionScopeIds: item.propositionScopeTexts.map(lookup), action: { scopeId: lookup(item.action.scopeText), surface: item.action.surface }, object: { scopeId: lookup(item.object.scopeText), surface: item.object.surface } })),
    ignoredScopeIds: fixture.expected.ignoredScopeTexts.map(lookup),
  }
  return { selection, index }
}

describe('RCO-5-008-B8 frozen pre-model Development data', () => {
  it('has a new identity, twelve cases and the frozen RCO-5-008 chain', () => {
    expect(dataset).toMatchObject({ schemaVersion: 'rco-5-008-b8-development-1.0.0', datasetId: 'rco-5-008-b8-development-20260904', sampleCount: 12, seenStatus: 'UNSEEN_BY_DEEPSEEK_AT_FREEZE_P4_ORACLE_PREFLIGHT_ALLOWED' })
    expect(dataset.scopeIndexVersion).toBe(SCOPE_INDEX_VERSION)
    expect(dataset.modelSelectionSchemaVersion).toBe(MODEL_ANCHOR_SELECTION_SCHEMA_VERSION)
    expect(dataset.localComposerVersion).toBe(MODEL_ANCHOR_LOCAL_COMPOSER_VERSION)
    expect(dataset.p4PolicyVersion).toBe(TASK_FORMATION_P4_POLICY_VERSION)
    expect(dataset.evaluatorVersion).toBe(TASK_FORMATION_EVALUATOR_V2_VERSION)
  })

  it('does not reuse source text or semantic family from B0 through B7', () => {
    const oldCases = priors.flatMap((prior) => prior.cases)
    const oldTexts = new Set(oldCases.map((item) => item.sourceText))
    const oldFamilies = new Set(oldCases.map((item) => item.semanticFamilyId).filter(Boolean))
    expect(new Set(dataset.cases.map((item) => item.semanticFamilyId)).size).toBe(12)
    for (const fixture of dataset.cases) {
      expect(oldTexts.has(fixture.sourceText)).toBe(false)
      expect(oldFamilies.has(fixture.semanticFamilyId)).toBe(false)
      expect(Math.max(...oldCases.map((item) => jaccard(fixture.sourceText, item.sourceText)))).toBeLessThan(0.55)
    }
  })

  it('contains no obvious identifier, credential or secret', () => {
    const text = dataset.cases.map((item) => `${item.sourceTitle}\n${item.sourceText}`).join('\n')
    expect(text).not.toMatch(/\b1[3-9]\d{9}\b|\b\d{15,18}[0-9Xx]\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:api|access)[-_ ]?key\s*[:=]/iu)
  })

  it('makes every ideal model selection strict-valid and locally composable', async () => {
    for (const fixture of dataset.cases) {
      const { selection, index } = await idealSelection(fixture)
      expect(validateModelAnchorSelection(selection, index, selection.producerRunId), fixture.id).toEqual({ valid: true, issues: [] })
      const composition = composeLocalAnchorsV2(selection, index, selection.producerRunId)
      expect(composition.ok, fixture.id).toBe(true)
      if (composition.ok) expect(composition.value.warnings, fixture.id).toEqual([])
    }
  })

  it('has a perfect P4 and safety ceiling before any model call', async () => {
    for (const fixture of dataset.cases) {
      const { selection, index } = await idealSelection(fixture)
      const composition = composeLocalAnchorsV2(selection, index, selection.producerRunId)
      if (!composition.ok) throw new Error(`${fixture.id}:${JSON.stringify(composition.issues)}`)
      const formed = formLocalTaskSuggestionsP4(index, composition.value.reduced)
      expect(validateLocalTaskFormationP4(formed, index, composition.value.reduced), fixture.id).toEqual([])
      const scopeById = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
      const prediction: TaskFormationPredictionCase = { caseId: fixture.id, status: 'completed', requiresAction: formed.requiresAction, tasks: formed.tasks.map((task) => ({ id: task.id, propositionScopeTexts: task.propositionScopeIds.map((id) => scopeById.get(id)!).filter(Boolean), semantics: task.semantics, inferenceLevel: task.inferenceLevel, actionType: task.actionType, action: task.action.surface, object: task.object.surface, effect: task.effect, selected: task.selected })) }
      expect(scoreTaskFormationCase(fixture, prediction).completeTaskCase, `${fixture.id}:${JSON.stringify(prediction)}`).toBe(true)
      expect(scoreStableDefaultSafety(fixture.expected.directives, prediction.tasks).unsafeDefaultFalsePositives, fixture.id).toBe(0)
      expect(materializeRevisionRelationsByScope(fixture.expected.directives, fixture.expected.revisionRelations, prediction.tasks, formed, index).exact, fixture.id).toBe(true)
      expect(formed.unresolvedRevisionScopeIds.map((id) => scopeById.get(id)), fixture.id).toEqual(fixture.expected.unresolvedRevisionScopeTexts)
    }
  })

  it('keeps Expected and all local-authority fields out of the future request projection', async () => {
    for (const fixture of dataset.cases) {
      const { index } = await idealSelection(fixture)
      const projection = { sourceId: fixture.id, sourceVersionId: 'source-v1', sourceFingerprint: index.sourceFingerprint, sourceTitle: fixture.sourceTitle, sourceText: fixture.sourceText, referenceTime: fixture.referenceTime, timezone: fixture.timezone, scopeCatalog: index.scopes.map(({ id, order, text }) => ({ id, order, text })) }
      expect(JSON.stringify(projection)).not.toMatch(/expected|semanticFamily|requiresAction|semantics|effect|actionType|selected|revisionRefs|forbiddenDefault/iu)
    }
  })

  it('covers the new decisive safety and relation families', () => {
    const tags = new Set(dataset.cases.flatMap((item) => item.coverageTags))
    for (const tag of ['compound_action', 'same_scope', 'condition_true', 'condition_false', 'negative', 'local_action', 'completed', 'third_party', 'cancels', 'supersedes', 'amends', 'ambiguous']) expect(tags.has(tag), tag).toBe(true)
    expect(dataset.cases.flatMap((item) => item.expected.selections)).toHaveLength(20)
    expect(dataset.cases.flatMap((item) => item.expected.revisionRelations)).toHaveLength(3)
    expect(dataset.cases.flatMap((item) => item.expected.unresolvedRevisionScopeTexts)).toHaveLength(1)
  })
})
