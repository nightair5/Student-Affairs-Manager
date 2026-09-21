import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {
  CANDIDATE12_BUNDLE_SHA, CANDIDATE12_FREEZE_COMMIT, OVERLAP_THRESHOLD, REQUIRED_COVERAGE, SOURCE_IDS,
  canonicalJson, detectPersonalData, jaccard, normalizeText, sha256, validateAuthorityLedger,
} from './candidate12-holdout-lib.mjs'

const CORPUS = 'docs/recognition-optimization/candidate12/c1-holdout-preparation/OVERLAP_CORPUS.json'
const check = (value, code) => { if (!value) throw Error(code) }
const digest = value => sha256(canonicalJson(value))

export function validateCandidate12HumanSubmission(input, root = process.cwd()) {
  check(input && typeof input === 'object' && !Array.isArray(input), 'C12_SUBMISSION_OBJECT')
  check(input.version === 'candidate12-human-holdout-submission-1.0.0', 'C12_SUBMISSION_VERSION')
  check(input.status === 'INDEPENDENT_HUMAN_DOUBLE_REVIEW_COMPLETE', 'C12_SUBMISSION_STATUS')
  check(input.protocolVersion === 'candidate12-human-protocol-1.0.0', 'C12_PROTOCOL_VERSION')
  check(input.candidateFreeze?.commit === CANDIDATE12_FREEZE_COMMIT && input.candidateFreeze?.candidateBundleSha === CANDIDATE12_BUNDLE_SHA, 'C12_CANDIDATE_FREEZE')
  const roles = input.roles ?? {}, declarations = input.declarations ?? {}
  for (const key of ['sourceProviderId', 'labelerAId', 'reviewerBId']) check(typeof roles[key] === 'string' && roles[key].length >= 3, 'C12_ROLE_' + key)
  check(roles.labelerAId !== roles.reviewerBId, 'C12_REVIEWERS_NOT_INDEPENDENT')
  for (const key of ['labelerAndReviewerAreDifferentPeople', 'candidateFrozenBeforeSourceAccess', 'allPersonalDataRemoved', 'allDisagreementsResolved']) check(declarations[key] === true, 'C12_DECLARATION_' + key)
  for (const key of ['candidateOutputsSeen', 'b1b2ModelOutputsSeen', 'teachingAnswersSeen', 'scoringResultsSeen', 'modelAssistanceUsed']) check(declarations[key] === false, 'C12_DECLARATION_' + key)
  check(Array.isArray(input.sources) && input.sources.length === 12, 'C12_SOURCE_COUNT')
  check(input.signatures && Date.parse(input.signatures.labelerASignedAt) && Date.parse(input.signatures.reviewerBSignedAt), 'C12_SIGNATURES')

  const corpus = JSON.parse(readFileSync(resolve(root, CORPUS), 'utf8'))
  const ids = new Set(), texts = new Set(), coverage = new Set(), overlap = []
  let multiEndpointRevisionCount = 0
  for (const source of input.sources) {
    check(SOURCE_IDS.includes(source.sourceId) && !ids.has(source.sourceId), 'C12_SOURCE_ID')
    ids.add(source.sourceId)
    check(source.sourceVersionId === source.sourceId + '-v1', 'C12_SOURCE_VERSION')
    check(typeof source.sourceText === 'string' && source.sourceText.length >= 20 && source.sourceText.length <= 24000, 'C12_SOURCE_TEXT')
    const normalized = normalizeText(source.sourceText)
    check(!texts.has(normalized), 'C12_SOURCE_DUPLICATE'); texts.add(normalized)
    check(source.sourceSha256 === sha256(source.sourceText), 'C12_SOURCE_SHA')
    check(detectPersonalData(source.sourceText).length === 0, 'C12_SOURCE_PERSONAL_DATA')
    check(source.provenance?.seenStatus === 'UNSEEN_FOR_CANDIDATE12' && source.provenance?.personalDataRemoved === true && Date.parse(source.provenance?.acquiredAt), 'C12_SOURCE_PROVENANCE')
    check(['ANONYMIZED_REAL_NOTICE', 'INDEPENDENT_HUMAN_AUTHORED_NOTICE'].includes(source.provenance?.originType), 'C12_SOURCE_ORIGIN')
    check(Array.isArray(source.coverageTags) && source.coverageTags.length > 0, 'C12_COVERAGE_TAGS')
    source.coverageTags.forEach(tag => coverage.add(tag))
    if (source.coverageTags.includes('multi_endpoint_revision')) multiEndpointRevisionCount++
    const reference = source.reference
    check(reference?.coverage === 'complete' && Array.isArray(reference.minimalObligations) && Array.isArray(reference.retainedFacts)
      && Array.isArray(reference.materials) && Array.isArray(reference.timePoints) && Array.isArray(reference.revisions)
      && Array.isArray(reference.forbiddenInferences) && Array.isArray(reference.ambiguities) && reference.ambiguities.length === 0, 'C12_REFERENCE_COMPLETE')
    check(reference.review?.labelerAStatus === 'COMPLETE' && reference.review?.reviewerBStatus === 'APPROVED'
      && reference.review?.adjudicationStatus === 'RESOLVED' && Array.isArray(reference.review?.disagreementIds), 'C12_REFERENCE_REVIEW')
    check(source.referenceSha256 === digest(reference), 'C12_REFERENCE_SHA')
    for (const item of corpus.entries) {
      const exact = normalized === item.normalizedText, similarity = jaccard(source.sourceText, item.text)
      if (exact || similarity >= OVERLAP_THRESHOLD) overlap.push({sourceId: source.sourceId, corpusId: item.id, exact, similarity})
    }
  }
  check(SOURCE_IDS.every(id => ids.has(id)), 'C12_SOURCE_ROSTER')
  check(REQUIRED_COVERAGE.every(tag => coverage.has(tag)) && multiEndpointRevisionCount >= 2, 'C12_COVERAGE_INCOMPLETE')
  check(overlap.length === 0, 'C12_SEEN_CORPUS_OVERLAP')
  validateAuthorityLedger()
  return {status: 'INDEPENDENT_HUMAN_PACKAGE_VALID', sources: 12, completeReferences: 12, overlapFindings: 0,
    candidateFreezeCommit: CANDIDATE12_FREEZE_COMMIT, candidateBundleSha: CANDIDATE12_BUNDLE_SHA, submissionSha256: digest(input),
    next: 'PREPARE_24_IDENTITIES_ONLY_NO_DISPATCH'}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  check(process.argv.length === 3, 'USAGE: node scripts/validate-candidate12-human-submission.mjs <sealed-submission.json>')
  const input = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'))
  console.log(JSON.stringify(validateCandidate12HumanSubmission(input), null, 2))
}
