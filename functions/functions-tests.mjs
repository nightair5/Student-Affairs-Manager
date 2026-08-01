import assert from 'node:assert/strict'
import test from 'node:test'
import { createDeepSeekHandler, createRateLimiter, validateDeepSeekRequest } from './deepseek-handler.mjs'

function request(overrides = {}) {
  const headers = {
    origin: 'https://student-affairs-nightair.web.app',
    'content-length': '120',
    'x-forwarded-for': '203.0.113.10',
    ...overrides.headers,
  }
  return {
    method: 'POST',
    path: '/api/deepseek',
    ip: '203.0.113.10',
    body: {
      question: '我今天应该先做什么？',
      context: [{ kind: '任务', title: '报名材料', excerpt: '今天 18:00 截止' }],
    },
    get: (name) => headers[name.toLowerCase()],
    ...overrides,
    headers,
  }
}

function response() {
  return {
    statusCode: 0,
    headers: {},
    payload: '',
    status(value) { this.statusCode = value; return this },
    set(name, value) { this.headers[name] = value; return this },
    send(value) { this.payload = value; return this },
  }
}

test('status reports whether the server secret is configured', async () => {
  const handler = createDeepSeekHandler({ getApiKey: () => '' })
  const output = response()
  await handler(request({ method: 'GET', path: '/api/deepseek/status' }), output)
  assert.equal(output.statusCode, 200)
  assert.deepEqual(JSON.parse(output.payload), { configured: false })
})

test('POST rejects untrusted origins before contacting DeepSeek', async () => {
  let contacted = false
  const handler = createDeepSeekHandler({
    getApiKey: () => 'server-only-test-key-with-length',
    fetcher: async () => { contacted = true },
  })
  const output = response()
  await handler(request({ headers: { origin: 'https://attacker.example' } }), output)
  assert.equal(output.statusCode, 403)
  assert.equal(contacted, false)
})

test('POST sends only bounded question and citation summaries', async () => {
  let upstreamBody
  const handler = createDeepSeekHandler({
    getApiKey: () => 'server-only-test-key-with-length',
    fetcher: async (_url, options) => {
      upstreamBody = JSON.parse(options.body)
      return Response.json({ choices: [{ message: { content: '先提交报名材料。' } }] })
    },
  })
  const output = response()
  await handler(request(), output)
  assert.equal(output.statusCode, 200)
  assert.equal(JSON.parse(output.payload).answer, '先提交报名材料。')
  assert.equal(upstreamBody.model, 'deepseek-chat')
  assert.match(upstreamBody.messages[0].content, /不可信资料/)
  assert.match(upstreamBody.messages[1].content, /报名材料/)
})

test('rate limiter blocks requests over the per-window limit', () => {
  let timestamp = 100
  const limited = createRateLimiter({ maxRequests: 2, windowMs: 1_000, now: () => timestamp })
  assert.equal(limited('client'), false)
  assert.equal(limited('client'), false)
  assert.equal(limited('client'), true)
  timestamp = 1_101
  assert.equal(limited('client'), false)
})

test('validation rejects missing citations and accepts bounded input', () => {
  assert.equal(validateDeepSeekRequest({ question: '今天做什么？', context: [] }), 'DEEPSEEK_CONTEXT_INVALID')
  assert.equal(validateDeepSeekRequest({
    question: '今天做什么？',
    context: [{ kind: '任务', title: '报名', excerpt: '今天截止' }],
  }), null)
})
