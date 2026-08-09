import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routerLabels = JSON.parse(await readFile('docs/e2-factledger/d6-router-labels.json', 'utf8'))
const validatorLabels = JSON.parse(await readFile('docs/e2-factledger/d6-validator-labels.json', 'utf8'))

function assertSharedRules(labels) {
  assert.ok(labels.length >= 60)
  assert.equal(new Set(labels.map((entry) => entry.caseId)).size, labels.length)
  labels.forEach((entry) => {
    assert.match(entry.caseId, /^e2-/u)
    assert.ok(entry.rationale.length >= 12)
  })
}

test('router diagnostic labels are frozen, unique, and valid', () => {
  assert.equal(routerLabels.schemaVersion, 'e2.5-router-labels-1.0.0')
  assert.equal(routerLabels.datasetStatus, 'EXPOSED_DIAGNOSTIC_ONLY')
  assertSharedRules(routerLabels.labels)
  routerLabels.labels.forEach((entry) => assert.ok(['simple', 'medium', 'complex'].includes(entry.label)))
  assert.deepEqual(
    [...new Set(routerLabels.labels.map((entry) => entry.label))].sort(),
    ['complex', 'medium', 'simple'],
  )
})

test('validator diagnostic labels are frozen, unique, and valid', () => {
  const allowed = new Set(['MISSING_TASK', 'MISSING_TIMEPOINT', 'WRONG_TIME_ROLE', 'MISSING_AMBIGUITY', 'EVENT_TASK_CONFUSION', 'NO_ISSUE'])
  assert.equal(validatorLabels.schemaVersion, 'e2.5-validator-labels-1.0.0')
  assert.equal(validatorLabels.datasetStatus, 'EXPOSED_DIAGNOSTIC_ONLY')
  assertSharedRules(validatorLabels.labels)
  validatorLabels.labels.forEach((entry) => {
    assert.ok(entry.expectedIssues.length > 0)
    entry.expectedIssues.forEach((issue) => assert.ok(allowed.has(issue)))
    if (entry.expectedIssues.includes('NO_ISSUE')) assert.deepEqual(entry.expectedIssues, ['NO_ISSUE'])
  })
  const represented = new Set(validatorLabels.labels.flatMap((entry) => entry.expectedIssues))
  assert.deepEqual([...represented].sort(), [...allowed].sort())
})
