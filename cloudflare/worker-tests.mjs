import assert from 'node:assert/strict'
import test from 'node:test'
import { createWorker, validateDeepSeekRequest, validateExtractionRequest } from './worker.mjs'

const baseContext = [{ kind: '任务', title: '报名材料', excerpt: '今天 18:00 截止' }]

function request(path = '/api/deepseek', options = {}) {
  return new Request(`https://student-affairs-manager.example${path}`, {
    method: 'POST',
    headers: {
      origin: 'https://student-affairs-manager.example',
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.10',
      ...options.headers,
    },
    body: JSON.stringify({ question: '今天应该先做什么？', context: baseContext }),
    ...options,
  })
}

function environment(overrides = {}) {
  return {
    DEEPSEEK_API_KEY: '',
    ALLOWED_ORIGINS: '',
    ASSETS: { fetch: async () => new Response('asset') },
    ...overrides,
  }
}

test('status honestly reports a missing Cloudflare secret', async () => {
  const worker = createWorker()
  const response = await worker.fetch(new Request('https://student-affairs-manager.example/api/deepseek/status'), environment())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { configured: false, model: 'deepseek-v4-flash' })
})

test('same-origin POST sends only bounded citation summaries to DeepSeek', async () => {
  let upstreamBody
  const worker = createWorker({
    fetcher: async (_url, options) => {
      upstreamBody = JSON.parse(options.body)
      return Response.json({ choices: [{ message: { content: '先提交报名材料。' } }] })
    },
  })
  const response = await worker.fetch(request(), environment({ DEEPSEEK_API_KEY: 'server-only-test-key-with-length' }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).answer, '先提交报名材料。')
  assert.equal(upstreamBody.model, 'deepseek-v4-flash')
  assert.deepEqual(upstreamBody.thinking, { type: 'disabled' })
  assert.match(upstreamBody.messages[0].content, /不可信资料/)
  assert.match(upstreamBody.messages[1].content, /报名材料/)
})

test('cross-origin POST is rejected before contacting DeepSeek', async () => {
  let contacted = false
  const worker = createWorker({ fetcher: async () => { contacted = true } })
  const response = await worker.fetch(request('/api/deepseek', {
    headers: { origin: 'https://attacker.example' },
  }), environment({ DEEPSEEK_API_KEY: 'server-only-test-key-with-length' }))
  assert.equal(response.status, 403)
  assert.equal(contacted, false)
})

test('non-API routes fall through to static assets', async () => {
  const worker = createWorker()
  const response = await worker.fetch(new Request('https://student-affairs-manager.example/calendar'), environment())
  assert.equal(await response.text(), 'asset')
})

test('validation requires one to four complete citations', () => {
  assert.equal(validateDeepSeekRequest({ question: '今天做什么？', context: [] }), 'DEEPSEEK_CONTEXT_INVALID')
  assert.equal(validateDeepSeekRequest({ question: '今天做什么？', context: baseContext }), null)
})

test('structured extraction uses V4 Flash JSON mode and returns bounded suggestions', async () => {
  let upstreamBody
  const worker = createWorker({
    fetcher: async (_url, options) => {
      upstreamBody = JSON.parse(options.body)
      return Response.json({ choices: [{ message: { content: JSON.stringify({
        tasks: [{
          title: '提交报名表', category: '比赛', deadline: '2026-08-10T18:00',
          estimatedMinutes: 30, nextAction: '核对报名表字段', description: '提交比赛报名表',
          priority: '中', materials: ['报名表'], evidence: '8月10日18:00提交报名表', confidence: '高',
        }],
      }) } }] })
    },
  })
  const response = await worker.fetch(request('/api/deepseek/extract', {
    body: JSON.stringify({
      sourceType: 'text',
      sourceTitle: '比赛通知',
      content: '请大家注意：8月10日18:00提交报名表，谢谢。',
      referenceTime: '2026-08-02T08:00:00.000Z',
      timezone: 'Asia/Shanghai',
    }),
  }), environment({ DEEPSEEK_API_KEY: 'server-only-test-key-with-length' }))

  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.model, 'deepseek-v4-flash')
  assert.equal(payload.suggestions[0].title, '提交报名表')
  assert.equal(payload.suggestions[0].evidence, '8月10日18:00提交报名表')
  assert.equal(upstreamBody.model, 'deepseek-v4-flash')
  assert.deepEqual(upstreamBody.response_format, { type: 'json_object' })
  assert.match(upstreamBody.messages[0].content, /不可信资料/)
})

test('structured extraction rejects invalid source payloads before contacting DeepSeek', async () => {
  let contacted = false
  const worker = createWorker({ fetcher: async () => { contacted = true } })
  const response = await worker.fetch(request('/api/deepseek/extract', {
    body: JSON.stringify({ sourceType: 'link', content: 'https://example.com', referenceTime: 'invalid' }),
  }), environment({ DEEPSEEK_API_KEY: 'server-only-test-key-with-length' }))
  assert.equal(response.status, 400)
  assert.equal(contacted, false)
})

test('extraction validation requires local text and a valid reference time', () => {
  assert.equal(validateExtractionRequest({
    sourceType: 'text', content: '8月10日提交材料', referenceTime: '2026-08-02T08:00:00.000Z',
  }), null)
  assert.equal(validateExtractionRequest({
    sourceType: 'link', content: 'https://example.com', referenceTime: '2026-08-02T08:00:00.000Z',
  }), 'DEEPSEEK_SOURCE_TYPE_INVALID')
  assert.equal(validateExtractionRequest({
    sourceType: 'text', content: 'a'.repeat(24_001), referenceTime: '2026-08-02T08:00:00.000Z',
  }), 'DEEPSEEK_CONTENT_INVALID')
})
