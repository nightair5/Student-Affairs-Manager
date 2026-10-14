import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {OUTPUT, verifyProvisionalDevelopment} from './build-candidate12-provisional-development.mjs'
import {canonicalJson, jaccard, OVERLAP_THRESHOLD, sha256} from './candidate12-holdout-lib.mjs'
import {validateCandidate12HumanSubmission} from './validate-candidate12-human-submission.mjs'

test('provisional package is complete, deterministic and explicitly ineligible for independent Holdout', () => {
  const result = verifyProvisionalDevelopment()
  assert.equal(result.sources.length, 12)
  assert.equal(result.truthStatus, 'PROVISIONAL_MODEL_AUTHORED')
  assert.equal(result.eligibleForIndependentHoldout, false)
  assert.equal(result.authorship.modelAssistanceUsed, true)
  assert.equal(result.authorship.independentHumanLabelers, 0)
  assert.equal(result.authorship.independentHumanReviewers, 0)
  assert.deepEqual(result.operations, {modelApiCalls: 0, secretReads: 0, grants: 0, reserves: 0, settlements: 0, ledgerWrites: 0})
  for (const source of result.sources) {
    assert.equal(source.sourceSha256, sha256(source.sourceText))
    assert.equal(source.referenceSha256, sha256(canonicalJson(source.reference)))
    assert.equal(source.reference.coverage, 'complete')
  }
})

test('provisional package cannot pass the independent human validator', () => {
  const value = JSON.parse(readFileSync(OUTPUT, 'utf8'))
  assert.throws(() => validateCandidate12HumanSubmission(value), /C12_SUBMISSION_VERSION/)
})

test('all provisional source texts are registered in the seen exclusion corpus', () => {
  const value = JSON.parse(readFileSync(OUTPUT, 'utf8'))
  const corpus = JSON.parse(readFileSync('docs/recognition-optimization/candidate12/c1-holdout-preparation/OVERLAP_CORPUS.json', 'utf8'))
  const registered = new Set(corpus.entries.filter(item => item.category === 'candidate12-provisional-development').map(item => item.textSha256))
  assert.equal(registered.size, 12)
  for (const source of value.sources) assert.ok(registered.has(source.sourceSha256))
})

test('provisional sources are distinct from the pre-existing seen corpus and one another', () => {
  const value = JSON.parse(readFileSync(OUTPUT, 'utf8'))
  const corpus = JSON.parse(readFileSync('docs/recognition-optimization/candidate12/c1-holdout-preparation/OVERLAP_CORPUS.json', 'utf8'))
  const prior = corpus.entries.filter(item => item.category !== 'candidate12-provisional-development')
  for (const source of value.sources) {
    for (const item of prior) assert.ok(jaccard(source.sourceText, item.text) < OVERLAP_THRESHOLD, `${source.sourceId}:${item.id}`)
  }
  for (let left = 0; left < value.sources.length; left++) for (let right = left + 1; right < value.sources.length; right++) {
    assert.ok(jaccard(value.sources[left].sourceText, value.sources[right].sourceText) < OVERLAP_THRESHOLD,
      `${value.sources[left].sourceId}:${value.sources[right].sourceId}`)
  }
})
