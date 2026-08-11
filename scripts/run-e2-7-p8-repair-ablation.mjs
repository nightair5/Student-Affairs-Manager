import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const INPUT_PATH = path.join(ROOT, '.evaluation-cache/e2-7/p8-repair-inputs.json')
const MANIFEST_PATH = path.join(ROOT, 'docs/e2-path-a-planning/p8-repair-input-manifest.json')
const CHECKPOINT_PATH = path.join(ROOT, '.evaluation-cache/e2-7/p8-repair-ablation.json')
const endpoint = process.env.E2_REPAIR_ENDPOINT
const token = process.env.E2_REPAIR_TOKEN
if (!endpoint || !token) throw new Error('E2_REPAIR_ENDPOINT and E2_REPAIR_TOKEN are required')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const inputBytes = await readFile(INPUT_PATH)
const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
if (sha256(inputBytes) !== manifest.inputArtifactSha256) throw new Error('P8 input artifact hash mismatch')
const input = JSON.parse(inputBytes.toString('utf8'))
let rows = []
try { rows = JSON.parse(await readFile(CHECKPOINT_PATH, 'utf8')).rows ?? [] } catch {}
const completed = new Map(rows.filter((row) => row.status === 'ok').map((row) => [`${row.caseId}:${row.mode}`, row]))

for (const entry of input.inputs.filter((item) => item.issues.length > 0)) {
  const modes = Number.parseInt(entry.sourceSha256.slice(-2), 16) % 2 === 0 ? ['R1', 'R2'] : ['R2', 'R1']
  for (const mode of modes) {
    const key = `${entry.caseId}:${mode}`
    if (completed.has(key)) continue
    const started = Date.now()
    let row
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ mode, sourceContent: entry.sourceContent, referenceTime: entry.referenceTime, baseResult: entry.baseResult, issues: entry.issues }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.result) throw new Error(`${response.status}:${payload.error ?? 'UNKNOWN'}`)
      row = {
        caseId: entry.caseId,
        mode,
        status: 'ok',
        sourceSha256: entry.sourceSha256,
        baseResultSha256: entry.baseResultSha256,
        resultSha256: sha256(JSON.stringify(payload.result)),
        latencyMs: Date.now() - started,
        applied: payload.applied,
        issueCodes: payload.issueCodes,
        execution: payload.execution,
        result: payload.result,
      }
    } catch (error) {
      row = {
        caseId: entry.caseId,
        mode,
        status: 'failed',
        sourceSha256: entry.sourceSha256,
        baseResultSha256: entry.baseResultSha256,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : 'UNKNOWN',
      }
    }
    rows = rows.filter((existing) => `${existing.caseId}:${existing.mode}` !== key)
    rows.push(row)
    completed.set(key, row)
    await writeFile(CHECKPOINT_PATH, `${JSON.stringify({ schemaVersion: 'e2.7-p8-repair-ablation-1.0.0', inputArtifactSha256: manifest.inputArtifactSha256, endpoint, rows }, null, 2)}\n`, 'utf8')
    process.stdout.write(`${entry.caseId} ${mode} ${row.status} ${row.latencyMs}ms\n`)
  }
}
const expected = manifest.callCountPlanned
const ok = rows.filter((row) => row.status === 'ok').length
process.stdout.write(`COMPLETE ${ok}/${expected} ok; ${rows.length - ok} failed\n`)
if (rows.length !== expected || ok !== expected) process.exitCode = 2
