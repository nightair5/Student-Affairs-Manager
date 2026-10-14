import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const generatedUrl = new URL('../cloudflare/chinese-time-ast.generated.mjs', import.meta.url)
const runner = `import { parseChineseTimeAst } from ${JSON.stringify(generatedUrl.href)}; console.log(JSON.stringify(parseChineseTimeAst('明天晚上八点', { referenceTime: '2026-08-05T00:00:00.000Z', timezone: 'Asia/Shanghai', type: 'task_deadline' })))`

test('generated Chinese time AST is host-timezone independent', () => {
  const outputs = ['UTC', 'America/New_York', 'Asia/Shanghai'].map((timezone) => execFileSync(
    process.execPath,
    ['--input-type=module', '--eval', runner],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { ...process.env, TZ: timezone },
      encoding: 'utf8',
    },
  ).trim())
  assert.equal(new Set(outputs).size, 1)
  assert.equal(JSON.parse(outputs[0]).normalizedValue, '2026-08-06T20:00')
})
