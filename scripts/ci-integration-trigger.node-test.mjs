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
  assert.match(workflow,/run: npm run test:safety/u)
  assert.equal(/run:.*(?:wrangler deploy|cloudflare:deploy)/u.test(workflow),false)
})
