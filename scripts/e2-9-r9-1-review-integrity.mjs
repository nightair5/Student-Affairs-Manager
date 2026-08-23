import { revealR9Mappings, sha256 } from './e2-9-r9-path-mask.mjs'
import { canonicalJson } from './e2-9-r6-path-mask.mjs'

export const R91_REVIEW_INTEGRITY_VERSION = 'e2-9-r9.1-review-integrity-1.0.0'

export const R91_REVIEW_GATE_POLICY = Object.freeze({
  pairCount: 16,
  minimumDeterminatePairs: 14,
  minimumCandidateWinMargin: 3,
  maximumBaselinePreferred: 3,
})

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function exactCommitments(privateBindings) {
  return privateBindings.map((item) => ({ caseAnonymousId: item.caseAnonymousId, commitment: item.commitment }))
}

export function evaluateR91ReviewGate(counts, pairCount) {
  const determinatePairs = pairCount - counts.insufficient
  const checks = {
    sixteenPairs: pairCount === R91_REVIEW_GATE_POLICY.pairCount,
    minimumDeterminatePairs: determinatePairs >= R91_REVIEW_GATE_POLICY.minimumDeterminatePairs,
    candidateWinMarginAtLeast3: counts.candidatePreferred - counts.baselinePreferred >= R91_REVIEW_GATE_POLICY.minimumCandidateWinMargin,
    baselinePreferredAtMost3: counts.baselinePreferred <= R91_REVIEW_GATE_POLICY.maximumBaselinePreferred,
    candidateMajorNotWorse: counts.candidateMajor <= counts.baselineMajor,
    candidatePlanningErrorLower: counts.candidatePlanningError < counts.baselinePlanningError,
    candidateFactLossNotWorse: counts.candidateFactLoss <= counts.baselineFactLoss,
    candidateOverSplitNotWorse: counts.candidateOverSplit <= counts.baselineOverSplit,
    candidateEvidenceCoverageNotWorse: counts.candidateEvidenceGap <= counts.baselineEvidenceGap,
    candidateSevereErrorNotWorse: counts.candidateSevereError <= counts.baselineSevereError,
  }
  return {
    checks,
    diagnostics: {
      factLossCeilingObserved: counts.candidateFactLoss === 0 && counts.baselineFactLoss === 0,
      factLossComparison: `${counts.candidateFactLoss}<=${counts.baselineFactLoss}`,
    },
    pass: Object.values(checks).every(Boolean),
  }
}

export function buildR91RevealVerificationBundle({
  revealSecret, runId, packet, privateBindings, commitments,
  labelsSha256, labelsCompletedAt, revealedAt,
}) {
  if (!validDate(labelsCompletedAt) || !validDate(revealedAt) || Date.parse(revealedAt) <= Date.parse(labelsCompletedAt)) {
    throw new Error('R91_REVEAL_MUST_FOLLOW_FROZEN_LABELS')
  }
  if (!Array.isArray(privateBindings) || !Array.isArray(commitments)
    || canonicalJson(commitments) !== canonicalJson(exactCommitments(privateBindings))) {
    throw new Error('R91_COMMITMENT_BINDING_INVALID')
  }
  const mappings = revealR9Mappings({ revealSecret, runId, packet, privateBindings })
  return {
    schemaVersion: 'e2.9-r9.1-reveal-verification-private-1.0.0',
    integrityVersion: R91_REVIEW_INTEGRITY_VERSION,
    runId,
    packetSha256: sha256(canonicalJson(packet)),
    labelsSha256,
    labelsCompletedAt,
    revealedAt,
    persistedAt: revealedAt,
    revealSecret,
    revealSecretSha256: sha256(revealSecret),
    commitmentsSha256: sha256(canonicalJson(commitments)),
    mappingsSha256: sha256(canonicalJson(mappings)),
    privateBindings,
  }
}

export function verifyR91RevealVerificationBundle({ bundle, packet, commitments }) {
  if (!bundle || bundle.schemaVersion !== 'e2.9-r9.1-reveal-verification-private-1.0.0'
    || bundle.integrityVersion !== R91_REVIEW_INTEGRITY_VERSION
    || !validDate(bundle.labelsCompletedAt) || !validDate(bundle.persistedAt)
    || Date.parse(bundle.persistedAt) <= Date.parse(bundle.labelsCompletedAt)
    || bundle.packetSha256 !== sha256(canonicalJson(packet))
    || bundle.revealSecretSha256 !== sha256(bundle.revealSecret)
    || bundle.commitmentsSha256 !== sha256(canonicalJson(commitments))
    || canonicalJson(commitments) !== canonicalJson(exactCommitments(bundle.privateBindings))) {
    throw new Error('R91_REVEAL_VERIFICATION_BUNDLE_INVALID')
  }
  const mappings = revealR9Mappings({
    revealSecret: bundle.revealSecret,
    runId: bundle.runId,
    packet,
    privateBindings: bundle.privateBindings,
  })
  if (bundle.mappingsSha256 !== sha256(canonicalJson(mappings))) throw new Error('R91_REVEAL_MAPPING_HASH_INVALID')
  return mappings
}

export function projectR91RevealVerificationPublic(bundle) {
  return {
    schemaVersion: 'e2.9-r9.1-reveal-verification-public-1.0.0',
    integrityVersion: bundle.integrityVersion,
    runId: bundle.runId,
    packetSha256: bundle.packetSha256,
    labelsSha256: bundle.labelsSha256,
    labelsCompletedAt: bundle.labelsCompletedAt,
    persistedAt: bundle.persistedAt,
    revealVerificationBundleSha256: sha256(canonicalJson(bundle)),
    revealSecretPersistedAfterLabels: true,
    independentlyReopenableFromIgnoredPrivateBundle: true,
  }
}
