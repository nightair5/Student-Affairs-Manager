import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeD26, writeD26Freeze, verifyD26, sha, componentSha, D26_BATCH } from './prepare-d26.mjs'
import { summarizeD26Cases } from './score-d26.mjs'

test('D26 source component binding survives checkout newlines and still rejects semantic drift', () => {
  assert.equal(componentSha(Buffer.from('甲\r\n乙\r\n')), componentSha(Buffer.from('甲\n乙\n')))
  assert.notEqual(componentSha(Buffer.from('甲\n乙\n')), componentSha(Buffer.from('甲\n丙\n')))
  assert.notEqual(sha('甲\r\n'), sha('甲\n')) // Frozen artifact/raw bytes remain exact.
})

test('D26 builds 8 reused-source/16 newly identified balanced requests with source-authored times and no answer leakage', async () => {
  const artifacts = await makeD26(), identities = artifacts['PREPARED_REQUEST_IDENTITIES.json']
  assert.equal(identities.dispatchAuthorized, false); assert.equal(identities.status, 'NOT_RUN')
  assert.equal(identities.requests.length, 16)
  assert.equal(new Set(identities.requests.map(row => row.unitIdentitySha256)).size, 16)
  assert.equal(identities.requests.filter((row, index) => index % 2 === 0 && row.arm === 'A').length, 4)
  const old = JSON.parse(readFileSync('docs/recognition-optimization/d25-accuracy/SOURCES.json', 'utf8')).sources
  for (const [index, source] of artifacts['SOURCES.json'].sources.entries()) {
    assert.equal(source.sourceText, old[index].sourceText)
    assert.notEqual(source.sourceId, old[index].sourceId)
    assert.equal(source.sourceSha256, sha(source.sourceText))
  }
  for (const row of identities.requests) {
    assert.equal(row.batch, D26_BATCH)
    assert.doesNotMatch(JSON.stringify(row.body), /\bexpected\b/iu)
    assert.equal(row.requestSha256, sha(JSON.stringify(row.body)))
  }
  assert.equal(artifacts['SOURCE_TIME_ASSERTIONS.json'].role, 'PROVISIONAL_SOURCE_AUTHORED_NOT_PARSER_DERIVED')
  assert.ok(artifacts['ROUNDTRIP_RESULTS.json'].roundtrip.every(row => row.positive === 'PASS' && row.negative === 'DETECTED' && row.orderInvariant === 'PASS'))
  const directory = mkdtempSync(join(tmpdir(), 'd26-anonymous-freeze-'))
  writeD26Freeze(artifacts, directory)
  assert.equal(verifyD26(directory).status, 'FROZEN_NOT_RUN')
  assert.throws(() => writeD26Freeze(artifacts, directory), /ALREADY_FROZEN/u)
  const path = join(directory, 'PREPARED_REQUEST_IDENTITIES.json'), before = readFileSync(path)
  const drifted = JSON.parse(before); drifted.requests[0].body.model = 'another-model'
  writeFileSync(path, JSON.stringify(drifted))
  assert.throws(() => verifyD26(directory), /FROZEN_DRIFT/u)
  writeFileSync(path, before)
  assert.equal(verifyD26(directory).units, 16)
})

test('D26 reporting retains missing rows in each denominator and refuses duplicate or unknown units', () => {
  const sources = Array.from({ length: 8 }, (_, index) => ({ sourceId: 'D26-S' + index }))
  const result = summarizeD26Cases(sources, [])
  assert.equal(result.decision.denominator, 8)
  assert.equal(result.decision.status, 'EVIDENCE_INCOMPLETE')
  assert.equal(result.arms.Candidate17.unknown, 8)
  assert.equal(result.arms.Candidate18.unknown, 8)
  const row = { sourceId: sources[0].sourceId, arm: 'A', score: { completeStatus: false, risks: [], riskUnits: [] } }
  assert.throws(() => summarizeD26Cases(sources, [row, row]), /DUPLICATE/u)
  assert.throws(() => summarizeD26Cases(sources, [{ ...row, sourceId: 'UNSEEN_UNKNOWN' }]), /UNKNOWN/u)
})
