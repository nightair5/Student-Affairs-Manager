import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const snapshot = '4699d5cfdd6211299d9ab82ef7000d99fc8fe8f8', root = 'docs/recognition-optimization/d26-correction'
const sha = v => createHash('sha256').update(v).digest('hex')
const normalized = v => sha(v.toString('utf8').replace(/\r\n/gu, '\n'))
const original = path => execFileSync('git', ['show', snapshot + ':' + path], { maxBuffer: 32 * 1024 * 1024 })
const manifestBytes = readFileSync(root + '/MANIFEST.json'), identitiesBytes = readFileSync(root + '/PREPARED_REQUEST_IDENTITIES.json')
if (sha(manifestBytes) !== 'c41185c3831d35db610e5a4a563b7471b0bd60d1d92a373edd6a5c10d28f7ac2' || sha(identitiesBytes) !== '89f33327eabd2ec90f9d383ac922d56b56ca4654cfee0be47aac083eea411e89') throw Error('D26_ORIGINAL_PACKAGE_BYTES_CHANGED')
const manifest = JSON.parse(manifestBytes), identities = JSON.parse(identitiesBytes)
const activeDrift = []
for (const file of manifest.components) {
  if (normalized(original(file.path)) !== file.sha256) throw Error('D26_SNAPSHOT_COMPONENT_MISMATCH:' + file.path)
  if (normalized(readFileSync(file.path)) !== file.sha256) activeDrift.push(file.path)
}
for (const file of manifest.artifacts) {
  const path = root + '/' + file.path
  if (sha(original(path)) !== file.sha256 || sha(readFileSync(path)) !== file.sha256) throw Error('D26_FROZEN_ARTIFACT_CHANGED:' + path)
}
if (identities.requests.length !== 16 || identities.requests.some(r => r.status !== 'NOT_RUN' || r.dispatchAuthorized !== false || sha(JSON.stringify(r.body)) !== r.requestSha256)) throw Error('D26_REQUEST_STATE_CHANGED')
console.log(JSON.stringify({ status: 'ORIGINAL_D26_GIT_SNAPSHOT_AND_PACKAGE_PRESERVED', snapshot, components: manifest.components.length, artifacts: manifest.artifacts.length, units: 16, notRun: 16, activeDrift, dispatchFromActiveHead: activeDrift.length ? 'FORBIDDEN_USE_ORIGINAL_SNAPSHOT_HOST' : 'STILL_REQUIRES_BATCH_AUTHORIZATION', modelCalls: 0, ledgerWrites: 0 }, null, 2))
