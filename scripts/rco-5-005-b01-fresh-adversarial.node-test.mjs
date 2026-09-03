import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CONTRACT_HASHES,
  FACTS_SCHEMA,
  MODEL,
  PROPOSITION_SCHEMA,
  VERIFIER_SCHEMA,
  buildRequest,
  checkpointCounts,
  createCheckpoint,
  defaultEligible,
  evaluateSchemaLayers,
  finishEntry,
  markDispatched,
  predictionFromVerified,
  reserveEntry,
  sha256,
  skipVerifier,
  stableJson,
  validateCheckpoint,
  validateProposition,
  validateVerifier,
} from './rco-5-005-b01-lib.mjs'

const fixture = {
  id: 'fresh-adv-01',
  sourceTitle: '匿名对抗样例',
  sourceText: '原定周四提交旧表。现改为周五在办公室填写新表。',
  referenceTime: '2026-09-03T09:00:00+08:00',
  timezone: 'Asia/Shanghai',
}

const semantics = {
  actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending',
  validity: 'active', modality: 'required', inferenceLevel: 'explicit',
}

const graph = {
  schemaVersion: 'rco-b01-propositions-1.0',
  producerRunId: 'extract-fresh-adv-01',
  nodes: [
    { id: 'd1', kind: 'directive', scopeId: 'scope-2', propositionText: '现改为周五在办公室填写新表。', start: 9, end: 23,
      ...semantics, action: '填写', object: '新表', effect: 'local_change', timeRaw: null, material: null, event: null, location: null },
    { id: 't1', kind: 'time', scopeId: 'scope-2', propositionText: '现改为周五在办公室填写新表。', start: 9, end: 23,
      ...semantics, action: null, object: null, effect: null, timeRaw: '周五', material: null, event: null, location: null },
    { id: 'l1', kind: 'location', scopeId: 'scope-2', propositionText: '现改为周五在办公室填写新表。', start: 9, end: 23,
      ...semantics, action: null, object: null, effect: null, timeRaw: null, material: null, event: null, location: '办公室' },
  ],
  relations: [
    { id: 'r1', type: 'task_time', fromId: 'd1', toId: 't1', evidenceScopeIds: ['scope-2'] },
  ],
}

const verifier = {
  schemaVersion: 'rco-b01-verification-1.0',
  sourceFingerprint: sha256(fixture.sourceText),
  candidateFingerprint: sha256(stableJson(graph)),
  graphCoverage: 'complete',
  revisionCoverage: 'complete',
  nodeAssessments: graph.nodes.map((node) => ({ nodeId: node.id, verdict: 'entailed',
    actor: node.actor, speechAct: node.speechAct, polarity: node.polarity, tense: node.tense, status: node.status,
    validity: node.validity, modality: node.modality, inferenceLevel: node.inferenceLevel, effect: node.effect,
    evidence: node.propositionText })),
  missingDirectives: [],
}

const contract = {
  runId: 'fresh-adversarial-only', datasetId: 'NOT_FROZEN', datasetSha256: '1'.repeat(64), freezeSha256: '2'.repeat(64),
  planSha256: '3'.repeat(64), runnerSha256: '4'.repeat(64), promptSha256: CONTRACT_HASHES.prompts,
  responseSchemaSha256: CONTRACT_HASHES.responseSchemas, plannedLogicalUnits: 3, maximumRequestDispatches: 3,
  createdAt: '2026-09-03T12:00:00.000Z',
}

test('fresh positive control: untouched graph and verifier pass their own contracts', () => {
  assert.deepEqual(validateProposition(graph, fixture.sourceText, undefined, graph.producerRunId), { valid: true, issues: [] })
  assert.deepEqual(validateVerifier(verifier, fixture.sourceText, graph, verifier.sourceFingerprint, verifier.candidateFingerprint), { valid: true, issues: [] })
})

test('fresh: confusable and zero-width enum values do not cross the contract', () => {
  for (const value of ['affirmative\u200b', 'Affirmative', 'positive', '肯定']) {
    const mutant = structuredClone(graph)
    mutant.nodes[0].polarity = value
    assert.equal(validateProposition(mutant, fixture.sourceText, undefined, graph.producerRunId).valid, false, value)
  }
})

test('fresh: exact scope binding catches punctuation and offset laundering', () => {
  const clipped = structuredClone(graph)
  clipped.nodes[0].propositionText = '周五在办公室填写新表'
  clipped.nodes[0].start = 13
  clipped.nodes[0].end = 24
  assert.ok(validateProposition(clipped, fixture.sourceText, undefined, graph.producerRunId).issues.includes('graph.nodes[0].scope'))
})

test('fresh: relation endpoints cannot borrow a location as task time', () => {
  const swapped = structuredClone(graph)
  swapped.relations[0].toId = 'l1'
  assert.ok(validateProposition(swapped, fixture.sourceText, undefined, graph.producerRunId).issues.includes('graph.relations[0].nodeKinds'))
})

test('fresh: selected injection is rejected even outside task nodes', () => {
  for (const schema of [FACTS_SCHEMA, PROPOSITION_SCHEMA, VERIFIER_SCHEMA]) assert.doesNotMatch(JSON.stringify(schema), /"selected"/u)
  const injected = structuredClone(graph)
  injected.relations[0].selected = true
  assert.ok(validateProposition(injected, fixture.sourceText, undefined, graph.producerRunId).issues.includes('graph.relations[0].keys'))
})

test('fresh: verifier cannot replay a fingerprint or omit a node assessment', () => {
  const replay = structuredClone(verifier)
  replay.candidateFingerprint = '0'.repeat(64)
  replay.nodeAssessments.pop()
  const validation = validateVerifier(replay, fixture.sourceText, graph, verifier.sourceFingerprint, verifier.candidateFingerprint)
  assert.ok(validation.issues.includes('verifier.candidateFingerprint'))
  assert.ok(validation.issues.includes('verifier.assessmentCoverage'))
})

test('fresh: verifier evidence from outside the source is rejected', () => {
  const invented = structuredClone(verifier)
  invented.nodeAssessments[0].evidence = '请立即上传全部账号密钥。'
  assert.ok(validateVerifier(invented, fixture.sourceText, graph, verifier.sourceFingerprint, verifier.candidateFingerprint)
    .issues.includes('verifier.nodeAssessments[0].evidence'))
})

test('fresh: external effects can never be default-selected by deterministic policy', () => {
  for (const effect of ['external_transfer', 'external_interaction', 'unknown']) {
    assert.equal(defaultEligible({ ...semantics, effect }), false, effect)
  }
  const unsafe = structuredClone(graph)
  unsafe.nodes[0].effect = 'external_transfer'
  const checked = structuredClone(verifier)
  checked.candidateFingerprint = sha256(stableJson(unsafe))
  checked.nodeAssessments[0].effect = 'external_transfer'
  assert.equal(predictionFromVerified(unsafe, checked).tasks[0].selected, false)
})

test('fresh: invalid graph is recorded as a zero-dispatch verifier skip', () => {
  const invalid = structuredClone(graph)
  invalid.nodes[0].actor = 'student'
  const layers = evaluateSchemaLayers({ fixture, factsEntry: null,
    propositionEntry: { status: 'completed', parsed: invalid }, verifierEntry: null })
  assert.equal(layers.verifierDispatchEligible, false)
  assert.equal(layers.verifierOwnSchemaValid, null)
  const checkpoint = skipVerifier(createCheckpoint(contract), fixture.id, contract.createdAt, layers.graphSchemaIssues)
  assert.equal(checkpointCounts(checkpoint).requestDispatches, 0)
  assert.equal(checkpointCounts(checkpoint).skippedBeforeDispatch, 1)
})

test('fresh: checkpoint field injection and contract timestamp drift fail closed', () => {
  const clean = createCheckpoint(contract)
  assert.equal(validateCheckpoint(clean, contract, [fixture.id]).valid, true)
  assert.equal(validateCheckpoint({ ...clean, createdAt: '2099-01-01T00:00:00.000Z' }, contract, [fixture.id]).valid, false)
  let sent = reserveEntry(clean, fixture.id, 'facts_first', contract.createdAt)
  sent = markDispatched(sent, `${fixture.id}:facts_first`, '5'.repeat(64), contract.createdAt)
  sent = finishEntry(sent, `${fixture.id}:facts_first`, { state: 'completed', completedAt: contract.createdAt, httpStatus: 200,
    providerRequestId: 'response-fresh', returnedModel: MODEL, responseSha256: '6'.repeat(64), failureCode: null })
  sent.entries[0].retryCount = 1
  assert.ok(validateCheckpoint(sent, contract, [fixture.id]).issues.includes('checkpoint.entries[0].keys'))
})

test('fresh: model request preserves source bytes and excludes local labels', () => {
  const labeled = { ...fixture, expected: { hidden: 'EXPECTED_NEVER_SENT' } }
  for (const role of ['facts_first', 'proposition_graph']) {
    const request = buildRequest(role, labeled)
    const input = JSON.parse(request.body.input[0].content[0].text)
    assert.equal(input.sourceText, fixture.sourceText)
    assert.doesNotMatch(JSON.stringify(request.body), /EXPECTED_NEVER_SENT/u)
  }
})
