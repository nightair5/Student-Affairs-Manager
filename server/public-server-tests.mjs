import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { extractionProfile } from '../cloudflare/extraction-profile.mjs'
import { createWorker } from '../cloudflare/worker.mjs'
import { EventEmitter } from 'node:events'
import { gzipSync } from 'node:zlib'
import { callPinnedLookup, createPinnedHttpsFetch, resolvePublicNodeHostname } from './pinned-fetch.mjs'
import { createPublicServer, loadPublicConfig } from './public-server.mjs'

function statusWithHost(baseUrl, host) {
  const url = new URL(baseUrl)
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: url.hostname,
      port: url.port,
      path: '/api/deepseek/status',
      headers: { host },
    }, (response) => {
      response.resume()
      response.on('end', () => resolve(response.statusCode))
    })
    request.on('error', reject)
    request.end()
  })
}

async function withServer(config, run, worker) {
  const server = createPublicServer(config, worker)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  try {
    await run(baseUrl)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('public server defaults stay on loopback without enabling HSTS', () => {
  const config = loadPublicConfig({ DEEPSEEK_API_KEY: '' }, '/tmp/student-affairs')
  assert.equal(config.host, '127.0.0.1')
  assert.equal(config.port, 8788)
  assert.equal(config.httpsEnabled, false)
  assert.equal(config.staticDir, path.resolve('/tmp/student-affairs', 'dist'))
  assert.equal(config.workerEnv.DEEPSEEK_GENERATION_MODE, 'semantic-notice-3.0')
  assert.equal(config.workerEnv.SEMANTIC_GOAL_CONTEXT_VERSION, '1.0.29')
  assert.equal(config.workerEnv.TWO_STEP_COMPILER_VERSION, '2.1.16')
  assert.equal(config.workerEnv.DEEPSEEK_EXTRACTION_MAX_TOKENS, '16384')
  assert.equal(config.workerEnv.EXTRACTION_EDGE_RATE_REQUIRED, undefined)
  assert.equal(extractionProfile(config.workerEnv).maxTokens, 16384)
})

test('serves the built SPA and falls back for client routes', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'student-affairs-public-'))
  try {
    await writeFile(path.join(directory, 'index.html'), '<!doctype html><title>学生事务管家</title><div id="root"></div>')
    await writeFile(path.join(directory, 'app.js'), 'console.log("asset")')
    await writeFile(path.join(directory, 'pdf.worker.min.mjs'), 'export default 1')
    const config = loadPublicConfig({ SAM_STATIC_DIR: directory, DEEPSEEK_API_KEY: '' }, directory)
    config.staticDir = directory
    await withServer(config, async (baseUrl) => {
      const home = await fetch(`${baseUrl}/`)
      assert.equal(home.status, 200)
      assert.match(await home.text(), /id="root"/)
      const route = await fetch(`${baseUrl}/today`)
      assert.equal(route.status, 200)
      assert.match(await route.text(), /id="root"/)
      const asset = await fetch(`${baseUrl}/app.js`)
      assert.equal(asset.status, 200)
      assert.match(asset.headers.get('content-type') ?? '', /javascript/)
      const moduleAsset = await fetch(`${baseUrl}/pdf.worker.min.mjs`)
      assert.equal(moduleAsset.status, 200)
      assert.match(moduleAsset.headers.get('content-type') ?? '', /javascript/)
      const missingAsset = await fetch(`${baseUrl}/missing.js`)
      assert.equal(missingAsset.status, 404)
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('same-origin /api uses the worker and stays unconfigured without a key', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'student-affairs-public-api-'))
  try {
    await writeFile(path.join(directory, 'index.html'), '<!doctype html><div id="root"></div>')
    const config = {
      ...loadPublicConfig({ DEEPSEEK_API_KEY: '', ALLOWED_ORIGINS: '' }, directory),
      staticDir: directory,
    }
    await withServer(config, async (baseUrl) => {
      const origin = baseUrl
      const status = await fetch(`${baseUrl}/api/deepseek/status`)
      assert.equal(status.status, 200)
      assert.equal(status.headers.get('strict-transport-security'), null)
      assert.equal((await status.json()).configured, false)

      const extract = await fetch(`${baseUrl}/api/deepseek/extract`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({ sourceType: 'text', content: '明天提交材料', referenceTime: '2026-11-11T00:00:00.000Z' }),
      })
      assert.equal(extract.status, 503)
      assert.equal((await extract.json()).error, 'DEEPSEEK_NOT_CONFIGURED')

      const foreign = await fetch(`${baseUrl}/api/deepseek`, {
        method: 'POST',
        headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
        body: JSON.stringify({ question: '今天做什么？', context: [{ kind: '任务', title: '材料', excerpt: '今天' }] }),
      })
      assert.equal(foreign.status, 403)

      const blocked = await fetch(`${baseUrl}/api/source/fetch`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'http://127.0.0.1/secret' }),
      })
      assert.equal(blocked.status, 400)
      assert.equal((await blocked.json()).error, 'WEB_HTTPS_REQUIRED')

      const unknown = await fetch(`${baseUrl}/api/not-a-route`)
      assert.equal(unknown.status, 404)
      assert.equal((await unknown.text()).includes('id="root"'), false)
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('keeps HSTS only when this server terminates HTTPS', async () => {
  const config = {
    ...loadPublicConfig({ SAM_HTTPS: 'true', DEEPSEEK_API_KEY: '' }),
    staticDir: os.tmpdir(),
  }
  await withServer(config, async (baseUrl) => {
    const status = await fetch(`${baseUrl}/api/deepseek/status`)
    assert.equal(status.headers.get('strict-transport-security'), 'max-age=86400')
  })
})

test('spoofed CF-Connecting-IP does not bypass the shared rate limit', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'student-affairs-public-rate-'))
  const worker = createWorker({
    fetcher: async () => Response.json({ choices: [{ message: { content: '先交材料。' } }] }),
  })
  const config = {
    ...loadPublicConfig({ DEEPSEEK_API_KEY: 'server-only-test-key-with-length' }, directory),
    staticDir: directory,
  }
  try {
    await withServer(config, async (baseUrl) => {
      const body = JSON.stringify({
        question: '今天做什么？',
        context: [{ kind: '任务', title: '材料', excerpt: '今天截止' }],
      })
      const send = (headers) => fetch(`${baseUrl}/api/deepseek`, {
        method: 'POST',
        headers: { origin: baseUrl, 'content-type': 'application/json', ...headers },
        body,
      })
      const shared = []
      for (let index = 0; index < 9; index += 1) {
        shared.push(await send({ 'cf-connecting-ip': `203.0.113.${index}`, 'x-real-ip': '198.51.100.10' }))
      }
      assert.equal(shared[7].status, 200)
      assert.equal(shared[8].status, 429)
      const otherClient = await send({ 'cf-connecting-ip': '203.0.113.1', 'x-real-ip': '198.51.100.11' })
      assert.equal(otherClient.status, 200)
    }, worker)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('HTTPS browser origins match when the proxy or server terminates TLS', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'student-affairs-public-https-'))
  const body = JSON.stringify({
    sourceType: 'text',
    content: '明天提交材料',
    referenceTime: '2026-11-11T00:00:00.000Z',
  })
  try {
    const httpsConfig = {
      ...loadPublicConfig({ SAM_HTTPS: 'true', DEEPSEEK_API_KEY: '' }, directory),
      staticDir: directory,
    }
    await withServer(httpsConfig, async (baseUrl) => {
      const origin = `https://127.0.0.1:${new URL(baseUrl).port}`
      const response = await fetch(`${baseUrl}/api/deepseek/extract`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body,
      })
      assert.equal(response.status, 503)
      assert.equal((await response.json()).error, 'DEEPSEEK_NOT_CONFIGURED')
      const httpOrigin = `http://127.0.0.1:${new URL(baseUrl).port}`
      const throughHttpProxy = await fetch(`${baseUrl}/api/deepseek/extract`, {
        method: 'POST',
        headers: { origin: httpOrigin, 'content-type': 'application/json', 'x-forwarded-proto': 'http' },
        body,
      })
      assert.equal(throughHttpProxy.status, 503)
    })

    const proxyConfig = {
      ...loadPublicConfig({ SAM_HTTPS: 'false', DEEPSEEK_API_KEY: '' }, directory),
      staticDir: directory,
    }
    await withServer(proxyConfig, async (baseUrl) => {
      const origin = `https://127.0.0.1:${new URL(baseUrl).port}`
      const forwarded = await fetch(`${baseUrl}/api/deepseek/extract`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json', 'x-forwarded-proto': 'https' },
        body,
      })
      assert.equal(forwarded.status, 503)
      const plain = await fetch(`${baseUrl}/api/deepseek/extract`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body,
      })
      assert.equal(plain.status, 403)
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('nginx static site types mjs as javascript and keeps framing protections', async () => {
  const nginx = await readFile(new URL('../deploy/swas/nginx.conf', import.meta.url), 'utf8')
  const headers = await readFile(new URL('../deploy/swas/security-headers.conf', import.meta.url), 'utf8')
  const install = await readFile(new URL('../deploy/swas/install.sh', import.meta.url), 'utf8')
  assert.match(nginx, /\\.mjs\$/)
  assert.match(nginx, /default_type text\/javascript/)
  assert.match(nginx, /security-headers\.conf/)
  assert.match(nginx, /default_server/)
  assert.match(nginx, /return 444/)
  assert.match(nginx, /Cache-Control "no-cache"/)
  assert.match(nginx, /include \/etc\/nginx\/snippets\/student-affairs-extra\/\*\.conf;/)
  assert.doesNotMatch(nginx, /ssl_certificate/)
  assert.doesNotMatch(nginx, /return\s+30[18]\s+https:\/\//)
  assert.doesNotMatch(nginx, /Strict-Transport-Security/)
  assert.match(headers, /X-Content-Type-Options nosniff/)
  assert.match(headers, /X-Frame-Options DENY/)
  assert.match(headers, /Cross-Origin-Opener-Policy same-origin/)
  assert.doesNotMatch(headers, /add_header Strict-Transport-Security/)
  assert.match(install, /Kept existing \/etc\/student-affairs\.env/)
  assert.match(install, /cannot execute Node\.js 20 or newer/)
  assert.match(install, /process\.versions\.node\.split/)
  assert.match(install, /mkdir -p \/etc\/nginx\/snippets\/student-affairs-extra/)
  assert.doesNotMatch(install, />\s*["']?\/etc\/nginx\/snippets\/student-affairs-extra/)
})

test('every page can show one ICP record, including when scripts are off', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  const footer = await readFile(new URL('../src/components/SiteRecordFooter.tsx', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.equal(html.match(/桂ICP备2026027233号-1/g)?.length, 1)
  assert.match(html, /<noscript>[\s\S]*beian\.miit\.gov\.cn[\s\S]*<\/noscript>/)
  assert.match(footer, /https:\/\/beian\.miit\.gov\.cn/)
  assert.match(app, /<SiteRecordFooter \/>/)
  assert.doesNotMatch(`${html}\n${footer}`, /公网安备/)
})

test('rejects an unrecognized Host before it can match Origin', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'student-affairs-public-host-'))
  const config = { ...loadPublicConfig({ DEEPSEEK_API_KEY: '' }, directory), staticDir: directory }
  try {
    await withServer(config, async (baseUrl) => {
      assert.equal(await statusWithHost(baseUrl, 'evil.example'), 421)
      assert.equal(await statusWithHost(baseUrl, 'student-affairs.site'), 200)
      assert.equal(await statusWithHost(baseUrl, new URL(baseUrl).host), 200)
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('web fetch pins the validated address and refuses a private lookup', async () => {
  const lookupImpl = async () => [{ address: '10.1.1.1', family: 4 }]
  await assert.rejects(
    () => resolvePublicNodeHostname('example.com', lookupImpl),
    (error) => error.code === 'WEB_PRIVATE_ADDRESS_FORBIDDEN',
  )
  await resolvePublicNodeHostname('example.com', async () => [{ address: '93.184.216.34', family: 4 }])
  const publicAddresses = await new Promise((resolve, reject) => {
    callPinnedLookup('example.com', { all: true }, (error, addresses) => {
      if (error) reject(error)
      else resolve(addresses)
    }, async () => [{ address: '10.0.0.8', family: 4 }, { address: '93.184.216.34', family: 4 }])
  })
  assert.deepEqual(publicAddresses, [{ address: '93.184.216.34', family: 4 }])
  for (const address of ['fec0::1', '2001:2::1', '2001:10::1', '2001:1::4', '2001:4::1', '2001:db8::1', '2002::1', '3fff::1', '192.88.99.2', '192.0.0.8', '198.51.100.10']) {
    await assert.rejects(
      () => resolvePublicNodeHostname('example.com', async () => [{ address, family: 6 }]),
      (error) => error.code === 'WEB_PRIVATE_ADDRESS_FORBIDDEN',
    )
  }
  for (const address of ['2001:4860:4860::8888', '2001:1::1', '2001:1::3', '2001:3::1', '2001:4:112::1', '2001:20::1', '2001:30::1', '192.0.0.9', '192.0.0.10', '8.8.8.8']) {
    await resolvePublicNodeHostname('example.com', async () => [{ address, family: 6 }])
  }
  await resolvePublicNodeHostname('example.com', { ownHost: 'student-affairs.site' }, async () => [{ address: '2001:4860:4860::8888', family: 6 }])
  const fetcher = createPinnedHttpsFetch({ lookupImpl })
  await assert.rejects(
    () => fetcher('https://example.com/page'),
    (error) => error.code === 'WEB_PRIVATE_ADDRESS_FORBIDDEN' || error.message === 'WEB_PRIVATE_ADDRESS_FORBIDDEN',
  )
})

test('pinned fetch stops an oversized or aborted upstream body', async () => {
  const lookupImpl = async () => [{ address: '93.184.216.34', family: 4 }]
  const scripted = (chunks, { fail, rawHeaders = ['content-type', 'text/plain'], statusCode = 200 } = {}) => (_options, callback) => {
    const request = new EventEmitter()
    request.destroy = () => {}
    request.write = () => {}
    request.end = () => {
      const response = new EventEmitter()
      response.statusCode = statusCode
      response.rawHeaders = rawHeaders
      response.destroy = () => {
        response.emit('aborted')
        response.emit('close')
      }
      callback(response)
      for (const chunk of chunks) response.emit('data', chunk)
      if (fail) response.emit(fail)
      else response.emit('end')
    }
    return request
  }
  const oversized = createPinnedHttpsFetch({
    lookupImpl,
    maxBytes: 4,
    requestImpl: scripted([Buffer.from('too-large')]),
  })
  await assert.rejects(() => oversized('https://example.com/big'), (error) => error.code === 'WEB_RESPONSE_TOO_LARGE')
  const aborted = createPinnedHttpsFetch({
    lookupImpl,
    requestImpl: scripted([Buffer.from('partial')], { fail: 'aborted' }),
  })
  await assert.rejects(() => aborted('https://example.com/reset'), (error) => error.code === 'WEB_FETCH_FAILED')
  const fromUrl = createPinnedHttpsFetch({
    lookupImpl,
    requestImpl: scripted([Buffer.from('ok')]),
  })
  const page = await fromUrl(new URL('https://example.com/notice'))
  assert.equal(page.status, 200)
  assert.equal(await page.text(), 'ok')
  const encoded = gzipSync(Buffer.from('明文'))
  const gzipped = createPinnedHttpsFetch({
    lookupImpl,
    requestImpl: scripted([encoded], { rawHeaders: ['content-type', 'text/html', 'content-encoding', 'gzip'] }),
  })
  const decoded = await gzipped('https://example.com/gzip')
  assert.equal(await decoded.text(), '明文')
  assert.equal(decoded.headers.get('content-encoding'), null)
  const controller = new AbortController()
  controller.abort()
  let started = false
  const expired = createPinnedHttpsFetch({
    lookupImpl,
    requestImpl: () => {
      started = true
      throw new Error('started')
    },
  })
  await assert.rejects(
    () => expired('https://example.com/late', { signal: controller.signal }),
    (error) => error.code === 'WEB_FETCH_TIMEOUT',
  )
  assert.equal(started, false)
  const empty = createPinnedHttpsFetch({
    lookupImpl,
    requestImpl: scripted([], { statusCode: 204 }),
  })
  const noContent = await empty('https://example.com/empty')
  assert.equal(noContent.status, 204)
  assert.equal(await noContent.text(), '')
  const upgraded = createPinnedHttpsFetch({
    lookupImpl,
    requestImpl: (_options, _callback) => {
      const request = new EventEmitter()
      request.destroy = () => {}
      request.write = () => {}
      request.end = () => {
        const socket = { destroy() {} }
        request.emit('upgrade', { statusCode: 101 }, socket, Buffer.alloc(0))
      }
      return request
    },
  })
  await assert.rejects(() => upgraded('https://example.com/switch'), (error) => error.code === 'WEB_FETCH_FAILED')
})

test('does not expose filesystem paths outside the static directory', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'student-affairs-public-root-'))
  const outside = await mkdtemp(path.join(os.tmpdir(), 'student-affairs-secret-'))
  try {
    await writeFile(path.join(directory, 'index.html'), 'home')
    await writeFile(path.join(outside, 'secret.txt'), 'do-not-serve')
    const config = { ...loadPublicConfig({}, directory), staticDir: directory }
    await withServer(config, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/%2e%2e/${path.basename(outside)}/secret.txt`)
      assert.notEqual(response.status, 200)
      assert.notEqual(await response.text(), 'do-not-serve')
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})
