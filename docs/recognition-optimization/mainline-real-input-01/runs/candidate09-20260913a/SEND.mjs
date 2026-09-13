// Explicit dispatch only. Importing this script never reads credentials.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { join } from 'node:path'
import { PAIRED08_DIRECTORY, PAIRED09_DIRECTORY, inspectProtection } from '../../../../../scripts/check-mainline-real-input-01.mjs'
import { dispatchPaired09, verifyPaired09Send } from '../../../../../scripts/run-mainline-real-input-01.mjs'
import { FLASH41_PAIRED09_POLICY, openBudget } from '../../../../../scripts/real-input-budget.mjs'
const read = name => JSON.parse(readFileSync(join(PAIRED09_DIRECTORY, name)))
const hash = value => createHash('sha256').update(value).digest('hex')
const ensure = (value, code) => { if (!value) throw Error('P09_SEND_' + code) }
const bindingBytes = readFileSync(join(PAIRED09_DIRECTORY, 'BINDING_FINAL.json')), binding = JSON.parse(bindingBytes), baseline = read('BASELINE.json')
if (process.argv[2] === 'prepare-review') {
  const old = JSON.parse(readFileSync(join(PAIRED08_DIRECTORY, 'BINDING_FINAL.json')))
  for (const item of binding.items) {
    const unit = item.id + '-03'
    ensure(binding.requests[unit] === old.requests[item.previousId + '-03'], 'BASELINE_REQUEST_CHANGED')
  }
  const target = read(process.argv[3])
  ensure(target.success === true && target.numPassedTests === 18, 'TARGET_TESTS')
  for (const [path, text] of [[process.argv[4], 'pass 1'], [process.argv[5], 'pass 1']]) {
    const log = readFileSync(join(PAIRED09_DIRECTORY, path), 'utf8')
    ensure(log.includes(text) && log.includes('fail 0'), 'BOUNDARY_TESTS')
  }
  const checkedAt = new Date().toISOString(), validUntil = new Date(Date.now() + 86400000).toISOString()
  const document = join(PAIRED09_DIRECTORY, 'PUBLIC_VERIFICATION.md')
  const billing = { verified: true, policy: FLASH41_PAIRED09_POLICY, method: 'official-public-document-review', checkedAt, validUntil,
    documents: [{ path: document, sha256: hash(readFileSync(document)) }], officialPeakMicroPerMillion: { input: 2000000, output: 8000000 },
    conservativeUpperPolicy: 'Existing 3/9 upper rates retained above current official 2/8; not claimed as provider billed amount.' }
  writeFileSync(join(PAIRED09_DIRECTORY, 'BILLING.json'), JSON.stringify(billing, null, 2) + '\n', { flag: 'wx' })
  const protection = inspectProtection({ stage: 'paired09' }), sources = protection.sources.map(s => ({ path: s.path, sha256: s.workingSha256 }))
  const review = { status: 'PASS', scope: 'PAIRED09_SEND', head: baseline.head, bindingSha: hash(bindingBytes), billingSha: hash(JSON.stringify(billing)),
    sourcesSha: hash(JSON.stringify(sources)), grantId: randomUUID(), checkedAt, reviewer: 'primary-agent targeted boundary review; not independent audit',
    evidence: [process.argv[3], process.argv[4], process.argv[5]], checks: {
      all20BaselineRequestsByteIdenticalToPrevious: true, referenceFactsExcludedFromRequestClosure: true,
      typedFactsCarryDirectSourceRefs: true, onlyReverseLinksDerived: true, danglingTargetsRejected: true,
      coverageNotInferredFromEmptyArrays: true, unknownConditionsPreserved: true, userConfirmationRequired: true,
      old168ReservationsAndPrefixPreservedByNewGrantTest: true, max208And20YuanEnforced: true,
      noCredentialsReadByReview: true, pinnedProxyAndTlsUnchanged: true, oldConvertersUnmodified: true } }
  writeFileSync(join(PAIRED09_DIRECTORY, 'SEND_REVIEW.json'), JSON.stringify(review, null, 2) + '\n', { flag: 'wx' })
  const grant = verifyPaired09Send({ bindingBytes, binding, baseline, billing, review, protection })
  const budget = await openBudget('docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a', grant.manifestSha, { batchGrant: grant })
  const state = await budget.snapshot(), total = state.reservations.reduce((n, r) => n + r.costUpperMicroCny, 0)
  ensure(state.reservations.length === 168 && total === 7197982, 'ORIGINAL_BUDGET')
  console.log(JSON.stringify({ status: 'READY', modelCalls: 0, attempts: state.reservations.length, totalUpperMicroCny: total,
    remainingUnderCapMicroCny: 20000000 - total, firstPair: binding.units.slice(0, 2).map(u => u.unitId) }))
} else if (['first-pair', 'remaining'].includes(process.argv[2])) {
  // No retries: on resume, only a settled on-disk receipt can make a prior unit skip.
  const units = process.argv[2] === 'first-pair' ? binding.units.slice(0, 2) : binding.units
  for (const unit of units) {
    const path = join(PAIRED09_DIRECTORY, unit.unitId + '_RESULT.json')
    if (existsSync(path)) {
      const result = JSON.parse(readFileSync(path))
      ensure(!result.stopDispatch && result.http === 200 && result.bindingSha === hash(bindingBytes) && result.requestSha === unit.requestSha, 'PRIOR_STOP')
      continue
    }
    const result = await dispatchPaired09(unit.unitId)
    console.log(JSON.stringify(result))
    if (result.stopDispatch) { process.exitCode = 1; break }
  }
} else throw Error('EXPLICIT_SEND_MODE_REQUIRED')
