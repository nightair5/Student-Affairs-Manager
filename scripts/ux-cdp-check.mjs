import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createServer as createNetServer } from 'node:net'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function freePort() {
  const server = createNetServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

/** Fresh-profile CDP acceptance helper. No third-party dependency or existing browser connection. */
export class UxBrowser {
  constructor(options) { this.options = options; this.pending = new Map(); this.serial = 0; this.clicks = 0; this.consoleErrors = [] }
  static async launch({ artifacts, browser = 'C:/Program Files/Google/Chrome/Application/chrome.exe', allowProduction = false } = {}) {
    if (!artifacts) throw Error('ARTIFACT_DIRECTORY_REQUIRED')
    const instance = new UxBrowser({ artifacts: path.resolve(artifacts), browser, allowProduction })
    await fs.mkdir(instance.options.artifacts, { recursive: true })
    instance.profile = await fs.mkdtemp(path.join(instance.options.artifacts, 'browser-profile-'))
    instance.port = await freePort()
    instance.child = spawn(browser, ['--headless=new', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${instance.port}`, `--user-data-dir=${instance.profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    let errors = ''
    instance.child.stderr.on('data', data => { errors = (errors + String(data)).slice(-4000) })
    instance.child.on('error', error => { instance.launchError = error })
    try {
      let version
      for (let i = 0; i < 80; i++) {
        if (instance.launchError) throw instance.launchError
        if (instance.child.exitCode !== null) throw Error('BROWSER_EXITED_' + instance.child.exitCode + ': ' + errors)
        try { version = await fetch(`http://127.0.0.1:${instance.port}/json/version`, { signal: AbortSignal.timeout(750) }).then(r => r.json()); break } catch { await pause(150) }
      }
      if (!version?.webSocketDebuggerUrl) throw Error('DEVTOOLS_NOT_READY: ' + errors)
      instance.version = version.Browser
      instance.socket = new WebSocket(version.webSocketDebuggerUrl)
      await new Promise((resolve, reject) => { instance.socket.addEventListener('open', resolve, { once: true }); instance.socket.addEventListener('error', reject, { once: true }) })
      instance.socket.addEventListener('message', event => {
        const message = JSON.parse(event.data)
        if (message.id) {
          const call = instance.pending.get(message.id)
          if (call) { clearTimeout(call.timer); instance.pending.delete(message.id); message.error ? call.reject(Error(message.error.message)) : call.resolve(message.result ?? {}) }
        }
        if (message.method === 'Runtime.exceptionThrown') instance.consoleErrors.push(message.params.exceptionDetails)
      })
      const { targetId } = await instance.call('Target.createTarget', { url: 'about:blank' })
      instance.targetId = targetId
      instance.sessionId = (await instance.call('Target.attachToTarget', { targetId, flatten: true })).sessionId
      await instance.call('Page.enable')
      await instance.call('Runtime.enable')
      await instance.call('Network.enable')
      await instance.call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: instance.options.artifacts, eventsEnabled: true }, false)
      return instance
    } catch (error) { await instance.close(); throw error }
  }
  call(method, params = {}, page = true) {
    const id = ++this.serial
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(Error('CDP_TIMEOUT_' + method)) }, 15000)
      this.pending.set(id, { resolve, reject, timer })
      this.socket.send(JSON.stringify({ id, method, params, ...(page && this.sessionId ? { sessionId: this.sessionId } : {}) }))
    })
  }
  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  checkUrl(url) {
    const u = new URL(url)
    if (u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname) && u.port && Number(u.port) >= 1024) return
    if (this.options.allowProduction && u.origin === 'https://student-affairs.site') return
    throw Error('ONLY_EXPLICIT_TEST_ORIGIN_ALLOWED: ' + u.origin)
  }
  async open(url, { width = 1024, height = 800 } = {}) {
    this.checkUrl(url)
    this.origin = new URL(url).origin
    await this.viewport(width, height)
    const navigated = await this.call('Page.navigate', { url })
    if (navigated.errorText) throw Error(navigated.errorText)
    await this.waitFor('document.readyState === "complete"')
    return this
  }
  async viewport(width, height) { await this.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 }) }
  async waitFor(expression, timeout = 20000) {
    const until = Date.now() + timeout
    while (Date.now() < until) { if (await this.evaluate(expression)) return; await pause(100) }
    throw Error('UI_TIMEOUT: ' + expression)
  }
  async wait(selector, timeout) { await this.waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)}))`, timeout) }
  async text(selector = 'body') { return this.evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`) }
  async click(selector) {
    const point = await this.evaluate(`(async () => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('MISSING_CLICK_TARGET');e.scrollIntoView({block:'center',behavior:'instant'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect();if(!r.width||!r.height||e.disabled)throw Error('NOT_CLICKABLE');const x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(!hit||!e.contains(hit))throw Error('CLICK_TARGET_OCCLUDED_BY_'+hit?.className);return {x,y}})()`)
    await this.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
    await this.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 })
    this.clicks++
  }
  async clickText(text, { tag = 'button', exact = true, scope = 'body' } = {}) {
    const marker = 'r21-' + (++this.serial)
    await this.evaluate(`(() => {const root=document.querySelector(${JSON.stringify(scope)});const list=[...root.querySelectorAll(${JSON.stringify(tag)})];const visible=e=>{for(let p=e;p&&p!==root;p=p.parentElement){if(p.tagName==='DETAILS'&&!p.open&&e!==p.querySelector(':scope>summary')&&!p.querySelector(':scope>summary')?.contains(e))return false}const r=e.getBoundingClientRect();return r.width>0&&r.height>0};const e=list.find(e=>visible(e)&&${exact ? 'e.innerText.trim()===' : 'e.innerText.includes('}${JSON.stringify(text)}${exact ? '' : ')'});if(!e)throw Error('MISSING_TEXT_TARGET: '+${JSON.stringify(text)});e.dataset.uxCdp=${JSON.stringify(marker)}})()`)
    await this.click(`[data-ux-cdp="${marker}"]`)
  }
  async input(selector, value) {
    await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`)
    await this.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 })
    await this.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 })
    await this.call('Input.insertText', { text: value })
  }
  async select(selector, value) { await this.evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('SELECT_MISSING');e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('change',{bubbles:true}))})()`) }
  async key(key, code = key) {
    await this.call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: ({ Escape: 27, Enter: 13, Tab: 9 })[key], ...(key === 'Enter' ? {text:'\r',unmodifiedText:'\r'} : {}) })
    await this.call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: ({ Escape: 27, Enter: 13, Tab: 9 })[key] })
  }
  async stats(selector = '[role="dialog"]') {
    return this.evaluate(`(() => {const root=document.querySelector(${JSON.stringify(selector)});if(!root)return null;const visible=e=>{for(let p=e;p&&p!==root;p=p.parentElement){if(p.tagName==='DETAILS'&&!p.open&&e!==p.querySelector(':scope>summary')&&!p.querySelector(':scope>summary')?.contains(e))return false;const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden')return false}const r=e.getBoundingClientRect();return r.width>0&&r.height>0};const text=root.innerText;const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};return {text,buttons:[...root.querySelectorAll('button')].filter(visible).map(e=>({text:e.innerText.trim(),label:e.getAttribute('aria-label'),disabled:e.disabled})),lines:text.split(/\\n/).filter(s=>s.trim()).length,disclosures:[...root.querySelectorAll('summary')].filter(visible).map(e=>e.innerText),iso:(text.match(/\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}/g)||[]),selected:[...root.querySelectorAll('input[type=checkbox]')].filter(e=>e.checked).map(e=>e.getAttribute('aria-label')||e.name),selects:[...root.querySelectorAll('select')].filter(visible).map(e=>({label:e.getAttribute('aria-label'),value:e.value,text:e.options[e.selectedIndex]?.text})),box:box(root),footer:root.querySelector('.detail-footer')?box(root.querySelector('.detail-footer')):null,viewport:{width:innerWidth,height:innerHeight},pageWidth:document.documentElement.scrollWidth,focusWithin:root.contains(document.activeElement)}})()`)
  }
  async screenshot(name) {
    const result = await this.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const file = path.join(this.options.artifacts, path.basename(name))
    await fs.writeFile(file, Buffer.from(result.data, 'base64')); return file
  }
  async indexedDB() {
    // This browser always has a new profile created by launch(); never attaches to a user's browser.
    return this.evaluate(`(async()=>{if(location.origin!==${JSON.stringify(this.origin)})throw Error('ORIGIN_CHANGED');const dbs=await indexedDB.databases();const result=[];for(const {name} of dbs){const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});try{const stores={};for(const store of db.objectStoreNames){stores[store]=await new Promise((resolve,reject)=>{const t=db.transaction(store,'readonly'),s=t.objectStore(store),r=s.getAll(),k=s.getAllKeys();t.oncomplete=()=>resolve(r.result.map((value,i)=>({key:k.result[i],value})));t.onerror=()=>reject(t.error)})}result.push({name,version:db.version,stores})}finally{db.close()}}return result})()`)
  }
  async upload(selector, file) {
    const { root } = await this.call('DOM.getDocument', { depth: -1 })
    const { nodeId } = await this.call('DOM.querySelector', { nodeId: root.nodeId, selector })
    if (!nodeId) throw Error('FILE_INPUT_MISSING')
    await this.call('DOM.setFileInputFiles', { nodeId, files: [path.resolve(file)] })
  }
  async refresh() { await this.call('Page.reload', { ignoreCache: true }); await this.waitFor('document.readyState === "complete"'); await pause(300) }
  async close() {
    if (this.closed) return
    this.closed = true
    if (this.socket?.readyState === WebSocket.OPEN) {
      try { await this.call('Browser.close', {}, false) } catch { /* Owned process may close before acknowledgement. */ }
      this.socket.close()
    }
    if (this.child && this.child.exitCode === null) {
      await Promise.race([new Promise(resolve => this.child.once('exit', resolve)), pause(8000)])
      if (this.child.exitCode === null) this.child.kill()
    }
    for (const call of this.pending.values()) { clearTimeout(call.timer); call.reject(Error('BROWSER_CLOSED')) }
    this.pending.clear()
    if (this.profile) {
      const resolved = path.resolve(this.profile)
      if (!resolved.startsWith(this.options.artifacts + path.sep) || !path.basename(resolved).startsWith('browser-profile-')) throw Error('PROFILE_CLEANUP_SCOPE')
      await fs.rm(resolved, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 })
      const debugPortClosed = this.port ? await fetch('http://127.0.0.1:' + this.port + '/json/version', {signal: AbortSignal.timeout(750)}).then(() => false).catch(() => true) : true
      await fs.appendFile(path.join(this.options.artifacts, 'BROWSER_CLEANUP.jsonl'), JSON.stringify({at:new Date().toISOString(),pid:this.child?.pid,port:this.port,profile:path.basename(resolved),profileRemoved:true,ownedProcessExited:this.child?.exitCode !== null,debugPortClosed}) + '\n')
    }
  }
}

async function selfTest(artifacts) {
  const server = createServer((_req, res) => { res.setHeader('content-type', 'text/html;charset=utf-8'); res.end('<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CDP验收夹具</title><textarea aria-label="通知"></textarea><div style="height:1200px">滚动自测</div><button onclick="document.querySelector(\'output\').textContent=document.querySelector(\'textarea\').value">确认</button><output></output><details><summary>更多</summary><button>隐藏按钮</button></details></html>') })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = 'http://127.0.0.1:' + server.address().port
  const results = []
  try {
    for (let i = 0; i < 2; i++) {
      const browser = await UxBrowser.launch({ artifacts })
      try {
        await browser.open(url, { width: 320, height: 800 })
        await browser.wait('textarea')
        await browser.input('textarea', '匿名通知')
        await browser.evaluate("document.querySelector('button').focus()")
        await browser.key('Enter')
        assert.equal(await browser.text('output'), '匿名通知')
        await browser.clickText('确认')
        assert.equal(await browser.text('output'), '匿名通知')
        const stats = await browser.stats('body')
        assert.equal(stats.buttons.length, 1)
        assert.equal(stats.iso.length, 0)
        assert.equal(stats.viewport.width, 320)
        await browser.screenshot('selftest-' + i + '.png')
        const db = await browser.indexedDB()
        assert.deepEqual(db, [])
        await browser.refresh()
        results.push({ buttonCount: stats.buttons.length, lines: stats.lines, text: await browser.text('output'), width: stats.viewport.width, browser: browser.version, profileIsNew: true })
      } finally { await browser.close() }
    }
    assert.deepEqual(results[0], results[1])
    await fs.writeFile(path.join(artifacts, 'CDP_SELFTEST.json'), JSON.stringify({ pass: true, at: new Date().toISOString(), results, scope: 'Two fresh profiles; only owned localhost fixture; no user browser/profile access' }, null, 2))
    console.log(JSON.stringify({ pass: true, results }))
  } finally { await new Promise(resolve => server.close(resolve)) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, artifacts, url] = process.argv.slice(2)
  if (command === 'selftest') await selfTest(path.resolve(artifacts))
  else if (command === 'snapshot') {
    const b = await UxBrowser.launch({ artifacts })
    try { await b.open(url); console.log(JSON.stringify(await b.stats('body'))); await b.screenshot('snapshot.png') } finally { await b.close() }
  } else throw Error('Usage: node scripts/ux-cdp-check.mjs selftest <new-round-directory> | snapshot <directory> <localhost-url>')
}
