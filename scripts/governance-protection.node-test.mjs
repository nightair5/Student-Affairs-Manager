import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {AUTHORITY_LEDGER, GOVERNANCE_MANIFEST, verifyGovernanceProtection} from './verify-governance-protection.mjs'

const root = process.cwd()
const manifest = JSON.parse(readFileSync(resolve(root, GOVERNANCE_MANIFEST), 'utf8'))
const baseline = JSON.parse(readFileSync(resolve(root, manifest.originalProtection.path), 'utf8'))
const freeze = JSON.parse(readFileSync(resolve(root, manifest.d7Freeze.path), 'utf8'))
const withCorruption = (path, corrupt) => {
  const target = resolve(root, path)
  return file => {
    const bytes = readFileSync(file)
    return resolve(file) === target ? corrupt(bytes) : bytes
  }
}
const appended = bytes => Buffer.concat([bytes, Buffer.from('unauthorized drift')])

test('authorized document transition preserves every historical byte and never grants dispatch', () => {
  const result = verifyGovernanceProtection(root)
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
