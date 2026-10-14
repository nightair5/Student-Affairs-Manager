import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import {AUTHORITY_LEDGER, GOVERNANCE_MANIFEST, verifyGovernanceProtection} from './verify-governance-protection.mjs'

// Unit tests must work in a fresh checkout, without this developer's private ledger.
// The CLI still checks the real repository and authority ledger separately.
const root = resolve(process.cwd(), '__virtual_governance_fixture__')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const files = new Map()
const put = (path, value) => {
  const bytes = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
  files.set(resolve(root, path), bytes)
  return {path, sha256: sha(bytes), bytes: bytes.length}
}
const transitions = ['AGENTS.md', 'PRD.md'].map(path => {
  const old = put('docs/governance/archive/2026-09-27/' + path.replace('.md', '.previous.md'), 'old ' + path)
  const current = put(path, 'current ' + path)
  return {path, archivePath: old.path, previousSha256: old.sha256, currentSha256: current.sha256}
})
const baseline = {protectedFiles: [
  ...transitions.map(item => ({path: item.path, sha256: item.previousSha256})),
  ...Array.from({length: 82}, (_, index) => put('history/file-' + index, 'frozen history ' + index)),
]}
const originalProtection = put('docs/recognition-optimization/candidate11/BRANCH_BASELINE.json', baseline)
const components = Array.from({length: 14}, (_, index) => put('frozen/component-' + index, 'component ' + index))
const freeze = {components, aggregateSha256: sha(JSON.stringify(components))}
const d7Freeze = put('docs/recognition-optimization/candidate14/d7-freeze/FREEZE_MANIFEST.json', freeze)
const ledger = Buffer.from(Array.from({length: 791}, (_, index) => JSON.stringify({syntheticRow: index})).join('\n') + '\n')
files.set(resolve(AUTHORITY_LEDGER), ledger)
const manifest = {
  version: 'governance-protection-1',
  originalProtection: {...originalProtection, count: 84}, transitions,
  d7Freeze: {...d7Freeze, aggregateSha256: freeze.aggregateSha256},
  authorityLedger: {path: AUTHORITY_LEDGER, rows: 791, bytes: ledger.length, sha256: sha(ledger)},
}
put(GOVERNANCE_MANIFEST, manifest)
const readFixture = path => {
  const bytes = files.get(resolve(path))
  assert.ok(bytes, 'Unexpected read outside the in-memory fixture: ' + path)
  return Buffer.from(bytes)
}
const withCorruption = (path, corrupt) => {
  const target = path === AUTHORITY_LEDGER ? resolve(AUTHORITY_LEDGER) : resolve(root, path)
  return file => {
    const bytes = readFixture(file)
    return resolve(file) === target ? corrupt(bytes) : bytes
  }
}
const appended = bytes => Buffer.concat([bytes, Buffer.from('unauthorized drift')])

test('authorized document transition preserves every historical byte and never grants dispatch', () => {
  const result = verifyGovernanceProtection(root, readFixture)
  assert.equal(result.historicalFilesUnchangedInPlace + result.historicalDocumentsPreservedInArchive, 84)
  assert.equal(result.activeDocumentVersionsVerified, 2)
  assert.equal(result.dispatchAuthorized, false)
  assert.equal(result.d7QualityStatus, 'D7_BLOCKED_ON_REFERENCE_CONTRACT')
  assert.equal(result.legacyVerifierStatus, 'EXPECTED_FAIL_AUTHORIZED_DOCUMENT_CHANGE')
})

for (const transition of manifest.transitions) {
  test('reject active document drift: ' + transition.path, () => {
    assert.throws(() => verifyGovernanceProtection(root, withCorruption(transition.path, appended)), /ACTIVE_DOCUMENT_DRIFT/)
  })
  test('reject damaged historical archive: ' + transition.path, () => {
    assert.throws(() => verifyGovernanceProtection(root, withCorruption(transition.archivePath, appended)), /ARCHIVE_DRIFT/)
  })
}

test('reject drift in any of the other 82 historical files', () => {
  for (const file of baseline.protectedFiles.filter(file => !manifest.transitions.some(item => item.path === file.path))) {
    assert.throws(() => verifyGovernanceProtection(root, withCorruption(file.path, appended)), /HISTORICAL_DRIFT/)
  }
})
test('reject original protection baseline rewrite', () => {
  assert.throws(() => verifyGovernanceProtection(root, withCorruption(manifest.originalProtection.path, appended)), /BASELINE_DRIFT/)
})
test('reject ledger change without modifying or repairing the ledger', () => {
  assert.throws(() => verifyGovernanceProtection(root, withCorruption(AUTHORITY_LEDGER, appended)), /LEDGER_DRIFT/)
})
test('reject frozen manifest drift', () => {
  assert.throws(() => verifyGovernanceProtection(root, withCorruption(manifest.d7Freeze.path, appended)), /FREEZE_MANIFEST_DRIFT/)
})
test('reject drift in every D7 frozen component', () => {
  for (const component of freeze.components) {
    assert.throws(() => verifyGovernanceProtection(root, withCorruption(component.path, appended)), /D7_COMPONENT_DRIFT/)
  }
})
test('a third exception cannot silently waive another protected file', () => {
  const read = withCorruption(GOVERNANCE_MANIFEST, bytes => {
    const value = JSON.parse(bytes)
    value.transitions.push({...value.transitions[0], path: 'package-lock.json'})
    return Buffer.from(JSON.stringify(value))
  })
  assert.throws(() => verifyGovernanceProtection(root, read), /TRANSITIONS/)
})
test('archives cannot be redirected outside the recorded location', () => {
  const read = withCorruption(GOVERNANCE_MANIFEST, bytes => {
    const value = JSON.parse(bytes)
    value.transitions[0].archivePath = '../../arbitrary-file'
    return Buffer.from(JSON.stringify(value))
  })
  assert.throws(() => verifyGovernanceProtection(root, read), /ARCHIVE_PATH/)
})
