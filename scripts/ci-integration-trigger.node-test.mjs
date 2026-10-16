import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
test('ordinary pushes on the current integration mainline trigger the existing CI jobs',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8')
  const branchSection=/\n  push:\s*\n    branches:\s*\n((?:      -[^\n]*\r?\n)+)/u.exec(workflow)?.[1]
  assert.ok(branchSection,'push branch filter missing')
  const branches=[...branchSection.matchAll(/      -\s+['"]?([^'"\r\n]+)['"]?/gu)].map(m=>m[1])
  assert.ok(branches.includes('integration/product-v3'))
  assert.ok(branches.includes('release/**'))
  assert.match(workflow,/run: npm run test:product/u)
  assert.match(workflow,/run: node scripts\/current-safety-ci\.mjs/u)
  const safetyRunner=readFileSync(new URL('./current-safety-ci.mjs',import.meta.url),'utf8')
  assert.match(safetyRunner,/spawnSync\(process\.execPath,\['scripts\/candidate11-checks\.mjs','current-safety'\]/u)
  assert.match(workflow,/os: \[ubuntu-latest, windows-latest\]/u)
  assert.equal(/run:.*(?:wrangler deploy|cloudflare:deploy)/u.test(workflow),false)
})

test('Windows enables existing long evidence paths before checkout rather than dropping history',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8')
  const safety=workflow.split('\n  current-safety:')[1]?.split('\n  historical:')[0]
  assert.ok(safety)
  assert.match(safety,/if: runner\.os == 'Windows'\s+shell: pwsh\s+run: git config --global core\.longpaths true/u)
  assert.ok(safety.indexOf('git config --global core.longpaths true')<safety.indexOf('uses: actions/checkout@v4'))
  assert.equal(safety.includes('sparse-checkout:'),false)
})
