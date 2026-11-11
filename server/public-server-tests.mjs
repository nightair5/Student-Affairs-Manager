import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createPublicServer, loadPublicConfig } from './public-server.mjs'

async function withServer(config, run) {
  const server = createPublicServer(config)
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
})

test('serves the built SPA and falls back for client routes', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'student-affairs-public-'))
  try {
    await writeFile(path.join(directory, 'index.html'), '<!doctype html><title>学生事务管家</title><div id="root"></div>')
    await writeFile(path.join(directory, 'app.js'), 'console.log("asset")')
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
