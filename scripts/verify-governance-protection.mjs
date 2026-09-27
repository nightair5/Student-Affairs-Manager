import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {isAbsolute, relative, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

export const GOVERNANCE_MANIFEST = 'docs/governance/GOVERNANCE_BASELINE.json'
export const AUTHORITY_LEDGER = 'C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl'
const ORIGINAL_BASELINE = 'docs/recognition-optimization/candidate11/BRANCH_BASELINE.json'
const D7_FREEZE = 'docs/recognition-optimization/candidate14/d7-freeze/FREEZE_MANIFEST.json'
const DOCUMENTS = ['AGENTS.md', 'PRD.md']
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const check = (condition, code) => {
  if (!condition) throw new Error('GOVERNANCE_PROTECTION_' + code)
}

// A prospective protection version, never a replacement for historical checks.
// readBytes injection lets tests corrupt a virtual read without writing real evidence.
export function verifyGovernanceProtection(root = process.cwd(), readBytes = readFileSync) {
  const local = path => {
    check(typeof path === 'string' && !isAbsolute(path), 'LOCAL_PATH')
    const resolved = resolve(root, path), rel = relative(resolve(root), resolved)
    check(rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\') && !isAbsolute(rel), 'PATH_ESCAPE')
    return readBytes(resolved)
  }
  const json = path => JSON.parse(local(path).toString('utf8'))
  const manifest = json(GOVERNANCE_MANIFEST)
  check(manifest.version === 'governance-protection-1', 'VERSION')
  check(manifest.originalProtection.path === ORIGINAL_BASELINE, 'BASELINE_PATH')
  check(sha(local(ORIGINAL_BASELINE)) === manifest.originalProtection.sha256, 'BASELINE_DRIFT')
  const baseline = json(ORIGINAL_BASELINE), files = baseline.protectedFiles
  check(files.length === 84 && manifest.originalProtection.count === 84, 'COUNT')
  check(new Set(files.map(file => file.path)).size === 84, 'DUPLICATE_BASELINE')
  check(manifest.transitions.length === 2 &&
    JSON.stringify(manifest.transitions.map(item => item.path).sort()) === JSON.stringify(DOCUMENTS), 'TRANSITIONS')
  for (const file of files) {
    const transition = manifest.transitions.find(item => item.path === file.path)
    if (transition) {
      const archivePath = 'docs/governance/archive/2026-09-27/' + file.path.replace('.md', '.previous.md')
      check(transition.archivePath === archivePath, 'ARCHIVE_PATH')
      check(transition.previousSha256 === file.sha256, 'PREVIOUS_HASH:' + file.path)
      check(sha(local(archivePath)) === file.sha256, 'ARCHIVE_DRIFT:' + file.path)
      check(sha(local(file.path)) === transition.currentSha256, 'ACTIVE_DOCUMENT_DRIFT:' + file.path)
      check(transition.currentSha256 !== file.sha256, 'NO_DOCUMENT_TRANSITION')
    } else {
      check(sha(local(file.path)) === file.sha256, 'HISTORICAL_DRIFT:' + file.path)
    }
  }
  check(DOCUMENTS.every(path => files.some(file => file.path === path)), 'MISSING_TRANSITION_SOURCE')

  check(manifest.d7Freeze.path === D7_FREEZE, 'FREEZE_PATH')
  check(sha(local(D7_FREEZE)) === manifest.d7Freeze.sha256, 'FREEZE_MANIFEST_DRIFT')
  const freeze = json(D7_FREEZE)
  check(freeze.aggregateSha256 === manifest.d7Freeze.aggregateSha256 &&
    sha(JSON.stringify(freeze.components)) === freeze.aggregateSha256, 'FREEZE_AGGREGATE')
  for (const component of freeze.components) {
    const bytes = local(component.path)
    check(sha(bytes) === component.sha256 && bytes.length === component.bytes, 'D7_COMPONENT_DRIFT:' + component.path)
  }

  check(manifest.authorityLedger.path === AUTHORITY_LEDGER, 'LEDGER_PATH')
  const ledger = readBytes(resolve(AUTHORITY_LEDGER))
  const rows = ledger.toString('utf8').trimEnd().split('\n').length
  check(rows === manifest.authorityLedger.rows &&
    ledger.length === manifest.authorityLedger.bytes &&
    sha(ledger) === manifest.authorityLedger.sha256, 'LEDGER_DRIFT')
  return {
    status: 'PASS_GOVERNANCE_PROTECTION_ONLY',
    originalProtectedFiles: 84,
    historicalFilesUnchangedInPlace: 82,
    historicalDocumentsPreservedInArchive: 2,
    activeDocumentVersionsVerified: 2,
    legacyInPlaceChanged: DOCUMENTS,
    legacyVerifierStatus: 'EXPECTED_FAIL_AUTHORIZED_DOCUMENT_CHANGE',
    d7ComponentsUnchanged: freeze.components.length,
    d7QualityStatus: 'D7_BLOCKED_ON_REFERENCE_CONTRACT',
    ledger: {mode: 'READ_ONLY', rows, bytes: ledger.length, sha256: sha(ledger)},
    dispatchAuthorized: false,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  check(process.argv.slice(2).every(arg => arg === '--verify'), 'ARGUMENT')
  console.log(JSON.stringify(verifyGovernanceProtection(), null, 2))
}
