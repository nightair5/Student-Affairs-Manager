import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {verifyPreparation} from './prepare-candidate12-c1.mjs'
import {canonicalJson, sha256, validateAuthorityLedger} from './candidate12-holdout-lib.mjs'
import {validateCandidate12HumanSubmission} from './validate-candidate12-human-submission.mjs'

const DIRECTORY = 'docs/recognition-optimization/candidate12/c1-holdout-preparation'
const coverage = [
  ['single_task', 'precise_time'], ['multi_task', 'shared_material'], ['condition_true'], ['condition_false'],
  ['condition_unknown', 'vague_time'], ['completion_standard'], ['dependency'], ['forbidden_non_task'],
  ['multi_endpoint_revision'], ['multi_endpoint_revision'], ['information_only'], ['cross_sentence_scope'],
]
const digest = value => sha256(canonicalJson(value))
function reference(id) {
  const value = {referenceVersion: id + '-r1', coverage: 'complete', minimalObligations: [], retainedFacts: [], materials: [], timePoints: [], revisions: [],
    composition: {allowedMerges: [], requiredSeparations: []}, forbiddenInferences: [], ambiguities: [], scorerReference: {coverage: 'complete', tasks: [], checks: []},
    review: {labelerAStatus: 'COMPLETE', reviewerBStatus: 'APPROVED', adjudicationStatus: 'RESOLVED', disagreementIds: []}}
  return value
}
function validFixture() {
  const sources = coverage.map((tags, index) => {
    const id = `C12-H${String(index + 1).padStart(2, '0')}`
    const sourceText = `ENGINEERING_VALIDATOR_FIXTURE_${index + 1}_QZ${String.fromCharCode(65 + index)}：此文本只测试密封包结构与哈希，不是人工来源或语义真值。`
    const ref = reference(id)
    return {sourceId: id, sourceVersionId: id + '-v1', sourceText, sourceSha256: sha256(sourceText), coverageTags: tags,
      provenance: {originType: 'INDEPENDENT_HUMAN_AUTHORED_NOTICE', acquiredAt: '2026-09-22T09:00:00+08:00', anonymizationMethod: 'engineering validator fixture only', personalDataRemoved: true, seenStatus: 'UNSEEN_FOR_CANDIDATE12'},
      reference: ref, referenceSha256: digest(ref)}
  })
  return {version: 'candidate12-human-holdout-submission-1.0.0', status: 'INDEPENDENT_HUMAN_DOUBLE_REVIEW_COMPLETE',
    candidateFreeze: {commit: 'c03368054ff8c357f055658c2d2d39b45bbcb761', candidateBundleSha: '880488f038cec55763276f525c1847638533fe95d79a64599e9585dc8d92296a'},
    protocolVersion: 'candidate12-human-protocol-1.0.0', roles: {sourceProviderId: 'fixture-provider', labelerAId: 'fixture-labeler-a', reviewerBId: 'fixture-reviewer-b', conflictAdjudicatorId: null},
    declarations: {labelerAndReviewerAreDifferentPeople: true, candidateFrozenBeforeSourceAccess: true, candidateOutputsSeen: false, b1b2ModelOutputsSeen: false,
      teachingAnswersSeen: false, scoringResultsSeen: false, modelAssistanceUsed: false, allPersonalDataRemoved: true, allDisagreementsResolved: true},
    sources, signatures: {labelerASignedAt: '2026-09-22T10:00:00+08:00', reviewerBSignedAt: '2026-09-22T11:00:00+08:00', adjudicatorSignedAt: null}}
}

test('C1 preparation remains zero-call, empty and bound to frozen Candidate12', async () => {
  const result = await verifyPreparation()
  assert.equal(result.manifest.status, 'WAITING_FOR_INDEPENDENT_HUMAN_LABELS')
  assert.deepEqual(result.manifest.holdout.actualSources, 0)
  assert.deepEqual(result.manifest.holdout.completeReferences, 0)
  assert.deepEqual(result.manifest.holdout.requestIdentities, 0)
  assert.deepEqual(result.manifest.holdoutHashes.sourceSet, {status: 'NOT_AVAILABLE', sha256: null})
  assert.deepEqual(result.manifest.holdoutHashes.expectedSet, {status: 'NOT_AVAILABLE', sha256: null})
  for (const key of ['schema', 'scorer', 'adapter', 'candidate12']) {
    assert.equal(result.manifest.holdoutHashes[key].status, 'FROZEN')
    assert.match(result.manifest.holdoutHashes[key].sha256, /^[a-f0-9]{64}$/u)
  }
  assert.deepEqual(result.manifest.operations, {secretReads: 0, grants: 0, reserves: 0, settlements: 0, ledgerWrites: 0, modelCalls: 0})
  assert.deepEqual(validateAuthorityLedger(), result.manifest.authorityLedger)
})

test('empty roster template cannot masquerade as a human submission', () => {
  const template = JSON.parse(readFileSync(DIRECTORY + '/HOLDOUT_ROSTER_TEMPLATE.json', 'utf8'))
  assert.throws(() => validateCandidate12HumanSubmission(template), /C12_SUBMISSION_VERSION/)
})

test('validator accepts only a structurally complete test fixture and never writes or dispatches', () => {
  const result = validateCandidate12HumanSubmission(validFixture())
  assert.equal(result.status, 'INDEPENDENT_HUMAN_PACKAGE_VALID')
  assert.equal(result.sources, 12)
  assert.equal(result.next, 'PREPARE_24_IDENTITIES_ONLY_NO_DISPATCH')
})

test('validator blocks model assistance, personal data, seen overlap and incomplete coverage', () => {
  const assisted = validFixture(); assisted.declarations.modelAssistanceUsed = true
  assert.throws(() => validateCandidate12HumanSubmission(assisted), /C12_DECLARATION_modelAssistanceUsed/)
  const personal = validFixture(); personal.sources[0].sourceText += ' 联系电话13812345678'; personal.sources[0].sourceSha256 = sha256(personal.sources[0].sourceText)
  assert.throws(() => validateCandidate12HumanSubmission(personal), /C12_SOURCE_PERSONAL_DATA/)
  const overlap = validFixture(); const corpus = JSON.parse(readFileSync(DIRECTORY + '/OVERLAP_CORPUS.json', 'utf8')); overlap.sources[0].sourceText = corpus.entries[0].text; overlap.sources[0].sourceSha256 = sha256(overlap.sources[0].sourceText)
  assert.throws(() => validateCandidate12HumanSubmission(overlap), /C12_SEEN_CORPUS_OVERLAP/)
  const incomplete = validFixture(); incomplete.sources.forEach(source => { source.coverageTags = ['single_task'] })
  assert.throws(() => validateCandidate12HumanSubmission(incomplete), /C12_COVERAGE_INCOMPLETE/)
})
