import test from 'node:test'
import assert from 'node:assert/strict'
import { makeD26ReferenceData } from './d26-reference-data.mjs'
import { recordedComponents } from './d26-recorded-components.mjs'
const x = await recordedComponents(), data = await makeD26ReferenceData()
const sources = data['SOURCES.json'].sources, oracles = data['LEGAL_WIRE_ORACLES.json'].oracles
const context = async i => ({ index: await x.indexImmutableScopesV11(sources[i].sourceId, sources[i].sourceVersionId, sources[i].sourceText), referenceTime: sources[i].referenceTime, timezone: sources[i].timezone })
const envelope = facts => JSON.stringify({ model: 'deepseek-flash', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(facts) }] }], usage: { input_tokens: 1, output_tokens: 1 } })
test('supported secondary references project only accounting, preserving events, times and raw', async () => {
  const facts = structuredClone(oracles[0].rawFacts), original = envelope(facts), row = facts.scopeAccounting.find(r => r.kind === 'event')
  row.entityIds.push(facts.timePoints[0].tempId)
  const raw = envelope(facts), result = x.projectRecordedAccounting(raw, await context(0))
  assert.equal(result.projectionAudit.inferredFacts, 0)
  assert.equal(result.projectionAudit.extras.length, 1)
  assert.deepEqual(result.rawFacts.events, facts.events)
  assert.deepEqual(result.rawFacts.timePoints, facts.timePoints)
  assert.equal(envelope(oracles[0].rawFacts), original)
  assert.equal(result.projectionAudit.originalFacts.scopeAccounting.find(r => r.kind === 'event').entityIds.length, 2)
})
test('cross-scope, wrong-kind, absent-primary and made-up references remain rejected', async () => {
  for (const mode of ['wrong-scope', 'wrong-kind', 'no-primary', 'absent']) {
    const facts = structuredClone(oracles[0].rawFacts), row = facts.scopeAccounting.find(r => r.kind === 'event')
    if (mode === 'wrong-scope') facts.timePoints[0].scopeIds = [contexts[0].index.scopes[1].id]
    row.entityIds.push(mode === 'absent' ? 'made-up' : facts.timePoints[0].tempId)
    if (mode === 'no-primary') row.entityIds.shift()
    if (mode === 'wrong-kind') row.kind = 'action'
    assert.throws(() => x.projectRecordedAccounting(envelope(facts), contexts[0]), /UNSUPPORTED_REFERENCE/, mode)
  }
})
const contexts = await Promise.all(sources.map((_, i) => context(i)))
test('null coverage with missing event is not silently converted to not_stated or synthesized', () => {
  const facts = structuredClone(oracles[6].rawFacts); facts.tasks[0].coverage.event = null
  assert.throws(() => x.projectRecordedAccounting(envelope(facts), contexts[6]), /COVERAGE_MISSING_FACT/)
  assert.equal(facts.events.length, 0); assert.equal(facts.tasks[0].coverage.event, null)
})
test('both candidates keep unknown eligibility and wrong dual time edges for local confirmation guards', () => {
  const legal = structuredClone(oracles[4].wire)
  legal.tasks[0].detail.timePointTempIds = []
  const result = x.decodeRecordedD26(envelope(legal), 'Candidate17', contexts[4])
  assert.equal(result.originalAdapted.tasks[0].condition.value, 'unknown')
  assert.equal(result.result.standaloneTasks[0].selected, false)
  assert.equal(result.result.standaloneTasks[0].timePointTempIds.length, 0)
  assert.equal(result.result.timePoints[0].relatedTaskTempIds.length, 1)
  assert.ok(result.representationGaps.some(g => g.kind === 'condition'))
})
test('source rendering preserves explicit event and fuzzy time, never fabricates an omitted event', () => {
  const facts = structuredClone(oracles[0].rawFacts); facts.events[0].title = '图书借阅门户停机'
  const result = x.decodeRecordedD26(envelope(facts), 'Candidate18', contexts[0], true)
  assert.equal(result.result.events.length, 1)
  assert.equal(result.result.events[0].title, '图书借阅门户将在周三晚停机')
  assert.equal(result.result.timePoints[0].normalizedValue, null)
  assert.equal(result.result.timePoints[0].needsConfirmation, true)
  assert.equal(result.sourceRenderedEvents.length, 1)
  const omitted = structuredClone(oracles[0].wire); omitted.events = []; omitted.timePoints = []
  const empty = x.decodeRecordedD26(envelope(omitted), 'Candidate17', contexts[0])
  assert.equal(empty.result.events.length, 0); assert.equal(empty.result.timePoints.length, 0)
})

test('recorded scopes rebind identical text reversibly while entity IDs and values remain exact', async () => {
  const before = contexts[0].index, after = await x.indexImmutableScopesV11('fresh-source', 'fresh-version', before.sourceContent)
  const facts = structuredClone(oracles[0].rawFacts), raw = envelope(facts)
  const rebound = x.rebindRecordedScopes(raw, before, after)
  const parsed = JSON.parse(JSON.parse(rebound.reboundHttpText).output[0].content[0].text)
  assert.equal(parsed.events[0].tempId, facts.events[0].tempId)
  assert.equal(parsed.events[0].title, facts.events[0].title)
  assert.equal(parsed.timePoints[0].rawText, facts.timePoints[0].rawText)
  assert.equal(parsed.events[0].scopeIds[0], after.scopes[0].id)
  assert.equal(x.decodeRecordedD26(rebound.reboundHttpText, 'Candidate18', { ...contexts[0], index: after }, true).result.events.length, 1)
  const reverted = x.rebindRecordedScopes(rebound.reboundHttpText, after, before)
  assert.deepEqual(JSON.parse(JSON.parse(reverted.reboundHttpText).output[0].content[0].text), facts)
  assert.equal(raw, envelope(facts))
})

test('source text or evidence boundary drift cannot be rebound into a fresh source', () => {
  for (const key of ['sourceContent', 'start', 'end', 'text']) {
    const altered = structuredClone(contexts[0].index)
    if (key === 'sourceContent') altered.sourceContent += '不要停机'
    else if (key === 'text') altered.scopes[0].text += '不要'
    else altered.scopes[0][key] += 1
    assert.throws(() => x.rebindRecordedScopes(envelope(oracles[0].rawFacts), contexts[0].index, altered), /SCOPE_DRIFT/)
  }
})

test('duplicate citations and title polarity changes cannot be disguised as harmless compression', () => {
  const facts = structuredClone(oracles[0].rawFacts)
  facts.scopeAccounting.find(r => r.kind === 'event').entityIds.push(facts.events[0].tempId)
  assert.throws(() => x.projectRecordedAccounting(envelope(facts), contexts[0]), /DUPLICATE_REFERENCE/)
  const negative = structuredClone(oracles[0].rawFacts); negative.events[0].title = '图书借阅门户不停机'
  const decoded = x.decodeRecordedD26(envelope(negative), 'Candidate18', contexts[0], true)
  assert.equal(decoded.sourceRenderedEvents.length, 0)
  assert.equal(decoded.result.events[0].title, '待核对事件')
})
