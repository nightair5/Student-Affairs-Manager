import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {resolve, relative, isAbsolute} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {validateChain} from './candidate13-d6-budget.mjs'

export const HISTORY_MANIFEST = 'docs/governance/GOVERNANCE_BASELINE_V2.json'
export const HISTORY_PARENT_HEAD = 'a4bb253d7973052488949fbed4d2b381d4178d26'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const check = (value, code) => { if (!value) throw Error('HISTORY_' + code) }
const lf = bytes => bytes.toString('utf8').replace(/\r\n/g, '\n')
const extraFrozen = ['scripts/score-candidate15-contract.mjs', 'scripts/candidate15-reference-contract.mjs',
  'scripts/score-candidate15-d11.mjs', 'scripts/run-candidate15-d11.mjs', 'scripts/audit-candidate15-d11.mjs',
  'src/experiments/realInput01/candidate03.ts', 'src/experiments/realInput01/candidate15.ts',
  'src/experiments/candidate14/commonAdapter.ts', 'docs/governance/GOVERNANCE_BASELINE.json', 'scripts/verify-governance-protection.mjs']
const archivedDocuments = ['AGENTS.md', 'PRD.md', 'docs/governance/PROJECT_EXECUTION_ROADMAP.md',
  'docs/governance/NEXT_STAGE_EXECUTION_PROMPT.md', 'docs/recognition-optimization/CURRENT_CONTEXT.md',
  'refine-logs/EXPERIMENT_PLAN.md', 'refine-logs/EXPERIMENT_TRACKER.md']

function historicalBlobs(root, paths) {
  const unique = [...new Set(paths)]
  const output = execFileSync('git', ['cat-file', '--batch'], {cwd: root, input: unique.map(path => HISTORY_PARENT_HEAD + ':' + path + '\n').join(''), maxBuffer: 32 * 1024 * 1024})
  let offset = 0
  const blobs = new Map()
  for (const path of unique) {
    const end = output.indexOf(10, offset), header = output.subarray(offset, end).toString('utf8')
    const match = /^[a-f0-9]+ blob ([0-9]+)$/.exec(header)
    check(match, 'GIT_OBJECT_MISSING:' + path)
    const size = Number(match[1]), bytes = output.subarray(end + 1, end + 1 + size)
    check(bytes.length === size, 'GIT_OBJECT_TRUNCATED')
    blobs.set(path, bytes); offset = end + 1 + size + 1
  }
  return blobs
}

// Historical evidence is frozen; active plans are versioned in Git, not sealed forever.
// A valid append is reported for review, never treated as a new dispatch permission.
export function verifyRecognitionHistory(root = process.cwd(), read = readFileSync) {
  const local = path => {
    const rel = relative(resolve(root), resolve(root, path))
    check(!isAbsolute(path) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\') && !isAbsolute(rel), 'PATH_ESCAPE')
    return read(resolve(root, path))
  }
  const json = path => JSON.parse(local(path).toString('utf8'))
  const manifest = json(HISTORY_MANIFEST)
  check(manifest.version === 'recognition-history-protection-2', 'VERSION')
  check(manifest.parentHead === HISTORY_PARENT_HEAD, 'PARENT_HEAD')
  const dirs = ['d8-development', 'd9-development', 'd10-development', 'd11-development-20260928a'].map(name => 'docs/recognition-optimization/candidate15/' + name)
  const treeFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', HISTORY_PARENT_HEAD, '--', ...dirs], {cwd: root, encoding: 'utf8'}).trim().split('\n')
  const expectedFrozen = [...new Set([...treeFiles, ...extraFrozen])].sort()
  check(JSON.stringify(manifest.frozenFiles.map(row => row.path).sort()) === JSON.stringify(expectedFrozen), 'GIT_FILE_SET')
  check(JSON.stringify(manifest.archives.map(row => row.path).sort()) === JSON.stringify([...archivedDocuments].sort()), 'ARCHIVE_SET')
  const historical = historicalBlobs(root, [...expectedFrozen, ...archivedDocuments])
  const oldGovernance = JSON.parse(historical.get('docs/governance/GOVERNANCE_BASELINE.json'))
  check(JSON.stringify(manifest.originalProtection) === JSON.stringify(oldGovernance.originalProtection), 'BASELINE_ANCHOR')
  check(JSON.stringify(manifest.d7Freeze) === JSON.stringify(oldGovernance.d7Freeze), 'D7_ANCHOR')
  const baseline = json(manifest.originalProtection.path)
  check(sha(local(manifest.originalProtection.path)) === manifest.originalProtection.sha256, 'BASELINE_DRIFT')
  check(baseline.protectedFiles.length === 84 && manifest.protectedFiles.length === 84, 'PROTECTED_COUNT')
  check(new Set(manifest.protectedFiles.map(row => row.path)).size === 84, 'PROTECTED_DUPLICATE')
  for (const row of manifest.protectedFiles) {
    check(baseline.protectedFiles.some(old => old.path === row.path && old.sha256 === row.sha256), 'PROTECTION_REMOVED')
    check(row.readPath === (oldGovernance.transitions.find(t => t.path === row.path)?.archivePath ?? row.path), 'PROTECTION_REDIRECTED')
    check(sha(local(row.readPath)) === row.sha256, 'PROTECTED_DRIFT:' + row.path)
  }
  for (const row of manifest.archives) {
    check(row.archivePath === 'docs/governance/archive/2026-09-28-d12/' + row.path, 'ARCHIVE_PATH')
    check(sha(local(row.archivePath)) === row.sha256 && lf(local(row.archivePath)) === lf(historical.get(row.path)), 'ARCHIVE_DRIFT:' + row.path)
  }
  check(sha(local(manifest.d7Freeze.path)) === manifest.d7Freeze.sha256, 'D7_MANIFEST_DRIFT')
  const freeze = json(manifest.d7Freeze.path)
  check(sha(JSON.stringify(freeze.components)) === manifest.d7Freeze.aggregateSha256, 'D7_AGGREGATE')
  for (const row of freeze.components) check(sha(local(row.path)) === row.sha256, 'D7_COMPONENT_DRIFT:' + row.path)
  check(new Set(manifest.frozenFiles.map(row => row.path)).size === manifest.frozenFiles.length, 'FROZEN_DUPLICATE')
  for (const row of manifest.frozenFiles) {
    const bytes = local(row.path)
    check(row.mode === (row.path.includes('d11-development-') ? 'raw' : 'lf'), 'HASH_MODE')
    const digest = sha(row.mode === 'raw' ? bytes : lf(bytes)), old = historical.get(row.path)
    check(digest === row.sha256 && digest === sha(row.mode === 'raw' ? old : lf(old)), 'FROZEN_DRIFT:' + row.path)
  }
  const authority = 'C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl'
  check(manifest.ledger.path === authority, 'LEDGER_AUTHORITY')
  const oldAudit = JSON.parse(historical.get('docs/recognition-optimization/candidate15/d11-development-20260928a/AUDIT.json'))
  check(manifest.ledger.rows === oldAudit.ledgerRows && manifest.ledger.sha256 === oldAudit.ledgerSha256, 'LEDGER_BASELINE_ANCHOR')
  const bytes = read(resolve(authority)), chain = validateChain(bytes)
  check(chain.rows.length >= manifest.ledger.rows && sha(bytes.subarray(0, manifest.ledger.bytes)) === manifest.ledger.sha256, 'LEDGER_PREFIX_DRIFT')
  const appendRows = chain.rows.length - manifest.ledger.rows
  return {
    status: appendRows === 0 ? 'PASS_HISTORICAL_INTEGRITY' : 'HISTORY_PRESERVED_LEDGER_APPEND_REVIEW_REQUIRED',
    protectedFiles: 84, archives: manifest.archives.length, frozenFiles: manifest.frozenFiles.length,
    activeDocuments: 'GIT_VERSIONED_NOT_A_RUNTIME_FREEZE', historicalDecisions: 'UNCHANGED',
    ledger: {rows: chain.rows.length, sha256: sha(bytes), appendRows, mode: 'READ_ONLY'},
    dispatchAuthorized: false, qualityPromotion: false,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  check(process.argv.slice(2).every(arg => arg === '--verify'), 'ARGUMENT')
  console.log(JSON.stringify(verifyRecognitionHistory(), null, 2))
}
