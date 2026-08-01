import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createRequestHandler } from './app.mjs'
import { FileWorkspaceStore } from './workspace-store.mjs'

const workspace = {
  schemaVersion: 4,
  tasks: [],
  sources: [],
  drafts: [],
  projects: [],
  courseBlocks: [],
  savedAt: '2026-08-01T00:00:00.000Z',
}

async function withServer(configPatch, run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'student-affairs-test-'))
  const config = {
    allowedOrigin: 'http://localhost:4173',
    syncToken: 'test-token-with-enough-length',
    syncConfigured: true,
    maxBodyBytes: 2 * 1024 * 1024,
    ...configPatch,
  }
  const server = createServer(createRequestHandler(config, new FileWorkspaceStore(path.join(directory, 'workspace.json'))))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
}

test('sync is closed when the server token is missing', async () => {
  await withServer({ syncConfigured: false, syncToken: '' }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/sync/workspace`)
    assert.equal(response.status, 503)
    assert.equal((await response.json()).error, 'SYNC_NOT_CONFIGURED')
  })
})

test('authenticated sync persists data and reports conflicts', async () => {
  await withServer({}, async (baseUrl) => {
    const headers = { authorization: 'Bearer test-token-with-enough-length', 'content-type': 'application/json' }
    const initial = await fetch(`${baseUrl}/api/sync/workspace`, {
      method: 'PUT', headers, body: JSON.stringify({ workspace, baseRevision: null }),
    })
    assert.equal(initial.status, 200)
    const firstRecord = await initial.json()

    const conflict = await fetch(`${baseUrl}/api/sync/workspace`, {
      method: 'PUT', headers, body: JSON.stringify({ workspace: { ...workspace, savedAt: 'changed' }, baseRevision: 'stale' }),
    })
    assert.equal(conflict.status, 409)
    assert.equal((await conflict.json()).remoteRevision, firstRecord.revision)

    const pulled = await fetch(`${baseUrl}/api/sync/workspace`, { headers })
    assert.equal(pulled.status, 200)
    assert.deepEqual((await pulled.json()).workspace.tasks, [])
  })
})
