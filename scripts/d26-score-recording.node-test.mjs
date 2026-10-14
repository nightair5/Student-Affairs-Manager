import test from 'node:test'
import assert from 'node:assert/strict'
import { makeD26ReferenceData } from './d26-reference-data.mjs'
import { d26Components } from './d26-components.mjs'
import { evaluateRawD26 } from './score-d26.mjs'

const x = await d26Components(), data = await makeD26ReferenceData()
const sources = data['SOURCES.json'].sources, references = data['REFERENCES.json'].references, oracles = data['LEGAL_WIRE_ORACLES.json'].oracles
const raw = facts => ({ httpStatus: 200, rawHttpText: JSON.stringify({ model: 'deepseek-flash', status: 'completed',
  output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(facts) }] }], usage: { input_tokens: 100, output_tokens: 100 } }) })

test('D26 engineering HTTP fixtures preserve opposite original prose and separately score the source-grounded first display', async () => {
  const wire = structuredClone(oracles[6].wire)
  wire.tasks[0].detail.title = '删除已保存记录'
  wire.tasks[0].detail.description = '不用提交表格，改为删除记录。'
  const response = raw(wire), originalHttp = response.rawHttpText
  const scored = await evaluateRawD26(sources[6], references[6], response, 'Candidate17', x)
  assert.equal(scored.error, null)
  assert.equal(scored.originalAnswerScore.structuredCompleteStatus, true)
  assert.equal(scored.originalAnswerScore.firstDisplayCompleteStatus, false)
  assert.equal(scored.score.firstDisplayCompleteStatus, true)
  assert.equal(scored.originalFacts.tasks[0].detail.title, '删除已保存记录')
  assert.equal(scored.firstDisplayAudit.originalProse[0].title, '删除已保存记录')
  assert.equal(scored.productFirstFacts.tasks[0].detail.title, '提交实验物资核对表')
  assert.equal(response.rawHttpText, originalHttp)
  assert.equal(scored.humanEdits, 'NOT_APPLIED')
})

test('D26 C18 recording conversion stays explicit and does not erase the unchanged raw envelope', async () => {
  const response = raw(oracles[6].rawFacts), originalHttp = response.rawHttpText
  const scored = await evaluateRawD26(sources[6], references[6], response, 'Candidate18', x)
  assert.equal(scored.error, null)
  assert.equal(scored.score.completeStatus, true)
  assert.equal(scored.programConversion.inferredFacts, 0)
  assert.equal(scored.originalFacts.schemaVersion, oracles[6].rawFacts.schemaVersion)
  assert.equal(response.rawHttpText, originalHttp)
})

test('D26 transport and parse failures remain first-answer failures without repair or replacement', async () => {
  for (const response of [{ httpStatus: 500, rawHttpText: 'anonymous upstream failure' }, { httpStatus: 200, rawHttpText: 'not JSON' }]) {
    const unchanged = structuredClone(response)
    const scored = await evaluateRawD26(sources[0], references[0], response, 'Candidate17', x)
    assert.equal(scored.score.completeStatus, false)
    assert.equal(scored.productFirstFacts, null)
    assert.ok(scored.error)
    assert.deepEqual(response, unchanged)
  }
})
