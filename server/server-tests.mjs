import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createRequestHandler } from './app.mjs'
import { FileWorkspaceStore } from './workspace-store.mjs'
import { DisabledEmailProvider, FileEmailQueue } from './email-service.mjs'
import { AllowlistedWebFetcher, DisabledWebFetcher, validateFetchTarget } from './web-fetch-service.mjs'

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

test('email queue stays blocked without a provider', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'student-affairs-email-'))
  try {
    const queue = new FileEmailQueue(path.join(directory, 'queue.json'))
    const job = await queue.enqueue({
      recipient: 'student@example.test',
      taskId: 'task-1',
      taskTitle: '提交报名表',
      nextAction: '检查签字',
      deadline: '2026-08-04T18:00:00+08:00',
      scheduledAt: '2026-08-01T10:00:00+08:00',
    }, new DisabledEmailProvider(), new Date('2026-08-01T09:00:00+08:00'))
    assert.equal(job.status, 'blocked-not-configured')
    assert.equal(job.attempts, 0)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('email queue records failure and explicit retry before sent', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'student-affairs-email-retry-'))
  let calls = 0
  const provider = {
    configured: true,
    name: 'test',
    async send() {
      calls += 1
      if (calls === 1) {
        const error = new Error('rejected')
        error.code = 'EMAIL_PROVIDER_REJECTED'
        throw error
      }
    },
  }
  try {
    const queue = new FileEmailQueue(path.join(directory, 'queue.json'))
    const now = new Date('2026-08-01T10:00:00+08:00')
    const job = await queue.enqueue({
      recipient: 'student@example.test', taskId: 'task-1', taskTitle: '提交报名表',
      nextAction: '检查签字', deadline: '2026-08-04T18:00:00+08:00', scheduledAt: now.toISOString(),
    }, provider, now)
    let jobs = await queue.processDue(provider, now)
    assert.equal(jobs[0].status, 'failed')
    assert.equal(jobs[0].attempts, 1)
    await queue.retry(job.id, provider, now)
    jobs = await queue.processDue(provider, now)
    assert.equal(jobs[0].status, 'sent')
    assert.equal(jobs[0].attempts, 2)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('web fetch is closed without an explicit allowlist configuration', async () => {
  await assert.rejects(() => new DisabledWebFetcher().fetchText('https://example.edu'), { code: 'WEB_FETCH_NOT_CONFIGURED' })
  assert.equal(validateFetchTarget('http://example.edu', ['example.edu']).error, 'WEB_HTTPS_REQUIRED')
  assert.equal(validateFetchTarget('https://127.0.0.1/private', ['127.0.0.1']).error, 'WEB_PRIVATE_ADDRESS_FORBIDDEN')
  assert.equal(validateFetchTarget('https://other.edu', ['example.edu']).error, 'WEB_HOST_NOT_ALLOWED')
})

test('allowlisted web fetch extracts inert text and never follows redirects', async () => {
  let options
  const fetcher = async (_url, receivedOptions) => {
    options = receivedOptions
    return new Response('<main><h1>比赛通知</h1><script>steal()</script><p>截止 8 月 4 日</p></main>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }
  const resolver = async () => [{ address: '203.0.113.10', family: 4 }]
  const result = await new AllowlistedWebFetcher(['example.edu'], fetcher, resolver).fetchText('https://example.edu/notice')
  assert.equal(options.redirect, 'error')
  assert.match(result.text, /比赛通知/)
  assert.doesNotMatch(result.text, /steal/)
})
