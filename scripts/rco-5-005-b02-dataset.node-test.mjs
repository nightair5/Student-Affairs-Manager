import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildRequest, sha256 } from './rco-5-005-b01-lib.mjs'

const datasetPath = new URL('../docs/recognition-optimization/RCO-5-005-B02_DEVELOPMENT_DATASET.json', import.meta.url)
const priorDatasetPath = new URL('../docs/recognition-optimization/RCO-5-005-B0_DEVELOPMENT_DATASET.json', import.meta.url)
const raw = readFileSync(datasetPath)
const dataset = JSON.parse(raw.toString('utf8'))
const priorRaw = readFileSync(priorDatasetPath)
const prior = JSON.parse(priorRaw.toString('utf8'))

function normalized(value) {
  return String(value ?? '').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase()
}

function sourceContainsOne(sourceText, values) {
  const source = normalized(sourceText)
  return values.some((value) => source.includes(normalized(value)))
}

test('B02 dataset has the frozen Development identity and declared size', () => {
  assert.equal(dataset.schemaVersion, 'rco-5-005-b02-development-1.0.0')
  assert.equal(dataset.datasetId, 'rco-5-005-b02-development-20260903')
  assert.equal(dataset.split, 'Development')
  assert.equal(dataset.classification, 'anonymous_synthetic_codex_authored_development')
  assert.equal(dataset.seenStatus, 'UNSEEN_BY_DEEPSEEK_FROZEN_BEFORE_MODEL_CALLS')
  assert.equal(dataset.sampleCount, 12)
  assert.equal(dataset.cases.length, 12)
  assert.match(dataset.labelProvenance, /not independent human ground truth/u)
})

test('B02 cases and semantic families are unique and do not reuse B0', () => {
  const ids = dataset.cases.map((item) => item.id)
  const families = dataset.cases.map((item) => item.semanticFamilyId)
  const sources = dataset.cases.map((item) => item.sourceText)
  assert.equal(new Set(ids).size, 12)
  assert.equal(new Set(families).size, 12)
  assert.equal(new Set(sources).size, 12)
  const priorFamilies = new Set(prior.cases.map((item) => item.semanticFamilyId))
  const priorSources = new Set(prior.cases.map((item) => item.sourceText))
  assert.equal(families.some((value) => priorFamilies.has(value)), false)
  assert.equal(sources.some((value) => priorSources.has(value)), false)
})

test('B02 expected labels are complete, locally grounded and internally consistent', () => {
  for (const fixture of dataset.cases) {
    assert.match(fixture.id, /^rco-b02-\d{2}$/u)
    assert.equal(typeof fixture.sourceTitle, 'string')
    assert.ok(fixture.sourceText.length >= 25)
    assert.equal(fixture.timezone, 'Asia/Shanghai')
    assert.equal(typeof fixture.expected.requiresAction, 'boolean')
    assert.equal(fixture.expected.requiresAction, fixture.expected.tasks.length > 0)
    assert.ok(Array.isArray(fixture.coverageTags) && fixture.coverageTags.length >= 3)
    assert.ok(Array.isArray(fixture.expected.forbiddenDefaultTokens))
    const taskIds = new Set()
    for (const task of fixture.expected.tasks) {
      assert.equal(taskIds.has(task.id), false, `${fixture.id}:${task.id}`)
      taskIds.add(task.id)
      assert.ok(sourceContainsOne(fixture.sourceText, task.actionAny), `${fixture.id}:${task.id}:action`)
      for (const token of task.objectAll) assert.ok(sourceContainsOne(fixture.sourceText, [token]), `${fixture.id}:${task.id}:object:${token}`)
      assert.ok(['local_change', 'external_transfer', 'external_interaction', 'physical_action', 'unknown'].includes(task.effect))
      assert.equal(task.shouldDefaultSelect, task.effect === 'local_change' || task.effect === 'physical_action')
      for (const alternatives of task.materials) assert.ok(sourceContainsOne(fixture.sourceText, alternatives), `${fixture.id}:${task.id}:material`)
      if (task.timeAny.length > 0) assert.ok(sourceContainsOne(fixture.sourceText, task.timeAny), `${fixture.id}:${task.id}:time`)
      if (task.eventAny.length > 0) assert.ok(sourceContainsOne(fixture.sourceText, task.eventAny), `${fixture.id}:${task.id}:event`)
      if (task.locationAny.length > 0) assert.ok(sourceContainsOne(fixture.sourceText, task.locationAny), `${fixture.id}:${task.id}:location`)
    }
  }
})

test('B02 contains negative, revision, multi-task and unsafe-effect challenge coverage', () => {
  const negativeCases = dataset.cases.filter((item) => !item.expected.requiresAction)
  const allTasks = dataset.cases.flatMap((item) => item.expected.tasks)
  const allTags = new Set(dataset.cases.flatMap((item) => item.coverageTags))
  assert.ok(negativeCases.length >= 4)
  assert.ok(allTasks.length >= 9)
  assert.ok(allTasks.some((task) => task.effect === 'external_interaction' && task.shouldDefaultSelect === false))
  for (const tag of ['revision', 'prompt_injection', 'multi_task', 'time_non_attachment', 'state_gate']) assert.ok(allTags.has(tag), tag)
})

test('B02 contains no obvious direct identifier or credential material', () => {
  const content = dataset.cases.map((item) => `${item.sourceTitle}\n${item.sourceText}`).join('\n')
  assert.doesNotMatch(content, /\b1[3-9]\d{9}\b|\b\d{15,18}[0-9Xx]\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:api|access)[-_ ]?key\s*[:=]/iu)
})

test('B02 labels never enter facts or graph model requests', () => {
  for (const fixture of dataset.cases) {
    const labeled = { ...fixture, expectedSentinel: 'EXPECTED_B02_NEVER_SENT' }
    for (const role of ['facts_first', 'proposition_graph']) {
      const request = buildRequest(role, labeled)
      assert.doesNotMatch(JSON.stringify(request.body), /EXPECTED_B02_NEVER_SENT|forbiddenDefaultTokens|shouldDefaultSelect/u)
      const input = JSON.parse(request.body.input[0].content[0].text)
      assert.equal(input.sourceText, fixture.sourceText)
    }
  }
})

test('B02 preserves the prior B0 dataset bytes', () => {
  assert.equal(sha256(priorRaw), 'f80abd495c3075e59055a17e0298c5393556e52b6fb3ba797638c5be19c94a99')
})

test('B02 dataset SHA is stable for freeze generation', () => {
  assert.match(sha256(raw), /^[a-f0-9]{64}$/u)
})
