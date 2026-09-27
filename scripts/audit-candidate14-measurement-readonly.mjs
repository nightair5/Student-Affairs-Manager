import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {transformSync} from 'esbuild'

// Diagnostic only: synthetic ENGINEERING_REPLAY events and an in-memory store.
// No candidate calls, real participants, database writes or historical rewrites.
if (process.argv.length !== 2) throw new Error('MEASUREMENT_AUDIT_TAKES_NO_ARGUMENTS')
const modulePath = 'src/experiments/candidate14/measurement.ts'
const bytes = readFileSync(resolve(modulePath))
const {code} = transformSync(bytes.toString('utf8'), {loader: 'ts', format: 'esm'})
const api = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const registration = {
  registrationId: 'review-only', trialId: 'offline-engineering',
  sourceIdentitySha256: 'a'.repeat(64), candidateIdentitySha256: 'b'.repeat(64),
  firstOutputSha256: 'c'.repeat(64), origin: 'ENGINEERING_REPLAY', status: 'REGISTERED', registeredAtMs: 0,
}
const store = {
  name: api.CANDIDATE14_MEASUREMENT_DATABASE,
  read: async key => key === 'candidate14-trial-registration:review-only' ? structuredClone(registration) : undefined,
  write: async () => {throw new Error('DIAGNOSTIC_MUST_NOT_WRITE')},
}
const authority = {name: api.CANDIDATE14_HUMAN_AUTHORITY_DATABASE, read: async () => undefined}
const base = [{kind: 'trial_started', atMs: 0}, {kind: 'first_snapshot_frozen', atMs: 1}, {kind: 'suggestion_interactive', atMs: 2}]
const makeEvents = tail => [...base, ...tail].map((row, index) => ({
  ...row, sequence: index + 1, eventId: 'event-' + (index + 1),
  registrationId: registration.registrationId, trialId: registration.trialId,
  sourceIdentitySha256: registration.sourceIdentitySha256,
  candidateIdentitySha256: registration.candidateIdentitySha256,
  snapshotSha256: registration.firstOutputSha256,
}))
const cases = [
  {
    id: 'READING_COUNTED_AS_EDIT',
    expectation: 'No edit occurred. Reading duration must not be labelled active editing.',
    judgment: {firstWholeCorrect: true, finalDispositionCorrect: true, disposition: 'confirmed'},
    events: makeEvents([
      {kind: 'confirmation_requested', atMs: 10002},
      {kind: 'commit_succeeded', atMs: 10003, operationId: 'save'},
      {kind: 'readback_verified', atMs: 10004, operationId: 'save'},
    ]),
  },
  {
    id: 'BATCH_SAVE_CORRECTION_NOT_COUNTED',
    expectation: 'An observed time correction needs an explicit edit-to-save mapping; absent mapping must not silently mean zero corrections.',
    judgment: {firstWholeCorrect: false, finalDispositionCorrect: true, disposition: 'confirmed'},
    events: makeEvents([
      {kind: 'edit_activity', atMs: 3, editCategory: 'time', operationId: 'field-edit'},
      {kind: 'confirmation_requested', atMs: 8},
      {kind: 'commit_succeeded', atMs: 9, operationId: 'batch-save'},
      {kind: 'readback_verified', atMs: 10, operationId: 'batch-save'},
    ]),
  },
  {
    id: 'TIMEOUT_READING_COUNTED_AS_EDIT',
    expectation: 'Keep timeout and elapsed engagement, but do not label a no-edit timeout as active editing.',
    judgment: {firstWholeCorrect: false, finalDispositionCorrect: false, disposition: 'timed_out'},
    events: makeEvents([{kind: 'timed_out', atMs: 12}]),
  },
]
const results = []
for (const item of cases) results.push({...item, result: await api.calculateCandidate14Trial(store, authority, registration, item.events, item.judgment)})
console.log(JSON.stringify({
  type: 'READ_ONLY_ENGINEERING_DIAGNOSTIC', origin: 'ENGINEERING_REPLAY',
  status: 'KNOWN_MEASUREMENT_CONTRACT_MISMATCH_NOT_FIXED',
  modulePath, moduleSha256: createHash('sha256').update(bytes).digest('hex'),
  moduleVersion: api.CANDIDATE14_MEASUREMENT_VERSION,
  judgmentProvenance: 'Synthetic inputs authored for engineering counterexamples; not independent human labels.',
  modelCalls: 0, humanTrials: 0, persistentDatabaseWrites: 0, registration, results,
}, null, 2))
