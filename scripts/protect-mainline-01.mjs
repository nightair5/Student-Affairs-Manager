import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const path = 'docs/recognition-optimization/mainline-01/PROTECTION_BASELINE.json'
const baseline = JSON.parse(readFileSync(path, 'utf8'))
const failures = []
const protectedFiles = Object.entries(baseline.hashes).filter(([file]) => !baseline.allowedChanges.includes(file))
for (const [file, expected] of protectedFiles) {
  try { if (createHash('sha256').update(readFileSync(file)).digest('hex') !== expected) failures.push(file) }
  catch { failures.push(file) }
}
const log = 'docs/recognition-optimization/OPTIMIZATION_LOG.md'
const oldLog = execFileSync('git', ['show', `${baseline.head}:${log}`])
if (!readFileSync(log).subarray(0, oldLog.length).equals(oldLog)) failures.push('LOG_NOT_APPEND_ONLY')
console.log(JSON.stringify({ protected: protectedFiles.length, unchanged: protectedFiles.length - failures.filter((file) => file !== 'LOG_NOT_APPEND_ONLY').length,
  appendOnlyLog: !failures.includes('LOG_NOT_APPEND_ONLY'), failures }))
if (failures.length) process.exitCode = 1
