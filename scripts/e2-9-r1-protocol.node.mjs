import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { canonicalJson, canonicalizeFileContent, hashBundle, normalizeLf, sha256 } from './e2-9-r1-hash.mjs'

test('R1 canonical JSON is stable across object key order', () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, x: [3, 4] } }), canonicalJson({ a: { x: [3, 4], y: 2 }, z: 1 }))
})

test('R1 canonical text is stable across CRLF, CR and LF', () => {
  assert.equal(normalizeLf('a\r\nb\rc\n'), 'a\nb\nc\n')
  assert.equal(canonicalizeFileContent('x.md', 'a\r\nb'), canonicalizeFileContent('x.md', 'a\nb'))
})

test('R1 bundle hash is externally reproducible and input-order independent', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'e2-9-r1-hash-'))
  await writeFile(path.join(root, 'a.json'), '{\r\n  "z": 1, "a": 2\r\n}\r\n', 'utf8')
  await writeFile(path.join(root, 'b.txt'), 'line1\r\nline2\r\n', 'utf8')
  const first = await hashBundle(root, ['b.txt', 'a.json'])
  const second = await hashBundle(root, ['a.json', 'b.txt'])
  assert.equal(first.sha256, second.sha256)
  assert.deepEqual(first.inputFiles, ['a.json', 'b.txt'])
  assert.match(first.sha256, /^[a-f0-9]{64}$/u)
  assert.equal(first.entries[0].canonicalSha256, sha256('{"a":2,"z":1}'))
})
