import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  API_STYLE,
  CONTRACT_HASHES,
  ENDPOINT,
  ENUMS,
  FACTS_SCHEMA,
  MODEL,
  PROMPTS,
  PROPOSITION_SCHEMA,
  ROLES,
  TEMPERATURE,
  VERIFIER_SCHEMA,
  aggregateRole,
  buildRequest,
  candidateDecision,
  checkpointCounts,
  createCheckpoint,
  finishEntry,
  evaluateSchemaLayers,
  markDispatched,
  parseResponsesPayload,
  predictionFromFacts,
  predictionFromProposition,
  predictionFromVerified,
  reserveEntry,
  scoreCase,
  sha256,
  skipVerifier,
  stableJson,
  validateCheckpoint,
  validateFacts,
  validateProposition,
  validateVerifier,
} from './rco-5-005-b01-lib.mjs'

const fixture = {
  id: 'b01-test-1',
  sourceTitle: '匿名测试',
  sourceText: '请于周五前填写登记表。',
  referenceTime: '2026-09-03T09:00:00+08:00',
  timezone: 'Asia/Shanghai',
  expected: {
    requiresAction: true,
    tasks: [{ actionAny: ['填写'], objectAll: ['登记表'], effect: 'local_change', shouldDefaultSelect: true,
      timeAny: ['周五前'], materials: [], eventAny: [], locationAny: [] }],
    forbiddenDefaultTokens: ['提交'],
  },
  expectedMustNeverReachModel: 'EXPECTED_SENTINEL',
}

const semantics = {
  actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending',
  validity: 'active', modality: 'required', inferenceLevel: 'explicit',
}

const facts = {
  schemaVersion: 'rco-b01-facts-1.0',
  requiresAction: true,
  tasks: [{ id: 't1', action: '填写', object: '登记表', effect: 'local_change', ...semantics,
    evidence: '请于周五前填写登记表。', timeRaw: ['周五前'], materials: [], event: null, location: null }],
  ignored: [],
}

const graph = {
  schemaVersion: 'rco-b01-propositions-1.0',
  producerRunId: 'extract-b01-test-1',
  nodes: [
    { id: 'n1', kind: 'directive', scopeId: 'scope-1', propositionText: fixture.sourceText, start: 0, end: fixture.sourceText.length,
      ...semantics, action: '填写', object: '登记表', effect: 'local_change', timeRaw: null, material: null, event: null, location: null },
    { id: 'n2', kind: 'time', scopeId: 'scope-1', propositionText: fixture.sourceText, start: 0, end: fixture.sourceText.length,
      ...semantics, action: null, object: null, effect: null, timeRaw: '周五前', material: null, event: null, location: null },
  ],
  relations: [{ id: 'r1', type: 'task_time', fromId: 'n1', toId: 'n2', evidenceScopeIds: ['scope-1'] }],
}

const verifier = {
  schemaVersion: 'rco-b01-verification-1.0',
  sourceFingerprint: sha256(fixture.sourceText),
  candidateFingerprint: sha256(stableJson(graph)),
  graphCoverage: 'complete',
  revisionCoverage: 'complete',
  nodeAssessments: [
    { nodeId: 'n1', verdict: 'entailed', ...semantics, effect: 'local_change', evidence: fixture.sourceText },
    { nodeId: 'n2', verdict: 'entailed', ...semantics, effect: null, evidence: fixture.sourceText },
  ],
  missingDirectives: [],
}

const checkpointContract = {
  runId: 'rco-5-005-b01-test',
  datasetId: 'new-freeze-required',
  datasetSha256: 'a'.repeat(64),
  freezeSha256: 'b'.repeat(64),
  planSha256: 'c'.repeat(64),
  runnerSha256: 'd'.repeat(64),
  promptSha256: CONTRACT_HASHES.prompts,
  responseSchemaSha256: CONTRACT_HASHES.responseSchemas,
  plannedLogicalUnits: 36,
  maximumRequestDispatches: 36,
  createdAt: '2026-09-03T10:00:00.000Z',
}

test('every independent prompt carries every canonical enum and no cross-call shorthand', () => {
  for (const role of ROLES) {
    for (const [name, values] of Object.entries(ENUMS)) {
      if (['nodeKind', 'relationType'].includes(name) && role !== 'proposition_graph') continue
      if (name === 'effect' || !['nodeKind', 'relationType'].includes(name)) {
        for (const value of values) assert.match(PROMPTS[role], new RegExp(value))
      }
    }
    assert.doesNotMatch(PROMPTS[role], /与紧凑事实抽取一致|其他语义枚举与候选一致/u)
    assert.match(PROMPTS[role], /JSON/u)
  }
})

test('response schemas are strict and graph nodes use kind-specific variants', () => {
  for (const schema of [FACTS_SCHEMA, PROPOSITION_SCHEMA, VERIFIER_SCHEMA]) assert.equal(schema.additionalProperties, false)
  assert.equal(PROPOSITION_SCHEMA.properties.nodes.items.oneOf.length, ENUMS.nodeKind.length)
  for (const variant of PROPOSITION_SCHEMA.properties.nodes.items.oneOf) assert.equal(variant.additionalProperties, false)
  assert.equal(FACTS_SCHEMA.properties.tasks.items.additionalProperties, false)
  assert.equal(VERIFIER_SCHEMA.properties.nodeAssessments.items.additionalProperties, false)
})

test('no model response schema can carry selected at any depth', () => {
  const walk = (value) => {
    if (!value || typeof value !== 'object') return
    assert.equal(Object.hasOwn(value.properties ?? {}, 'selected'), false)
    for (const child of Object.values(value)) walk(child)
  }
  for (const schema of [FACTS_SCHEMA, PROPOSITION_SCHEMA, VERIFIER_SCHEMA]) walk(schema)
})

test('Responses API request uses json_schema and never serializes Expected', () => {
  for (const role of ['facts_first', 'proposition_graph']) {
    const request = buildRequest(role, fixture)
    assert.equal(request.endpoint, ENDPOINT)
    assert.equal(request.apiStyle, API_STYLE)
    assert.equal(request.body.model, MODEL)
    assert.equal(request.body.temperature, TEMPERATURE)
    assert.deepEqual(request.body.reasoning, { effort: 'none' })
    assert.equal(request.body.text.format.type, 'json_schema')
    assert.doesNotMatch(JSON.stringify(request.body), /EXPECTED_SENTINEL|expectedMustNeverReachModel/u)
    assert.equal(request.requestSha256, sha256(stableJson(request.body)))
  }
})

test('offline verification entry has no network primitive and rejects paid-run arguments', () => {
  const runnerUrl = new URL('./verify-rco-5-005-b01.mjs', import.meta.url)
  const runnerPath = fileURLToPath(runnerUrl)
  const source = readFileSync(runnerUrl, 'utf8')
  assert.doesNotMatch(source, /\bfetch\s*\(|node:https|node:http|axios|undici/u)
  const ok = spawnSync(process.execPath, [runnerPath, '--verify-only'], { encoding: 'utf8' })
  assert.equal(ok.status, 0, ok.stderr)
  const result = JSON.parse(ok.stdout)
  assert.equal(result.modelCalls, 0)
  assert.equal(result.networkDispatches, 0)
  assert.equal(result.paidRunAuthorized, false)
  assert.equal(result.newDatasetFrozen, false)
  const blocked = spawnSync(process.execPath, [runnerPath, '--run'], { encoding: 'utf8' })
  assert.notEqual(blocked.status, 0)
  assert.match(blocked.stderr, /B01_ZERO_CALL_RUNNER_LOCKED/u)
})

test('graph validation emits field-level reasons for the B0 failure family', () => {
  const invalid = structuredClone(graph)
  invalid.nodes[0].actor = '学院'
  invalid.nodes[0].polarity = 'positive'
  invalid.nodes[0].timeRaw = '周五前'
  const validation = validateProposition(invalid, fixture.sourceText)
  assert.equal(validation.valid, false)
  assert.ok(validation.issues.includes('graph.nodes[0].actor'))
  assert.ok(validation.issues.includes('graph.nodes[0].polarity'))
  assert.ok(validation.issues.includes('graph.nodes[0].timeRaw'))
})

test('facts rejects missing ignored and any model-selected field', () => {
  const missing = structuredClone(facts)
  delete missing.ignored
  assert.deepEqual(validateFacts(missing, fixture.sourceText).valid, false)
  const selected = structuredClone(facts)
  selected.tasks[0].selected = true
  assert.deepEqual(validateFacts(selected, fixture.sourceText).valid, false)
})

test('facts rejects cross-state inconsistency while allowing no-action source with no tasks', () => {
  const inconsistent = structuredClone(facts)
  inconsistent.requiresAction = false
  assert.ok(validateFacts(inconsistent, fixture.sourceText).issues.includes('facts.requiresActionConsistency'))
  const eventOnly = { schemaVersion: 'rco-b01-facts-1.0', requiresAction: false, tasks: [], ignored: ['讲座将于周五举行。'] }
  assert.equal(validateFacts(eventOnly, '讲座将于周五举行。').valid, true)
})

test('verifier is not dispatched unless graph has passed local Schema', () => {
  const invalidEntry = { status: 'completed', parsed: { ...graph, nodes: graph.nodes.map((node, index) => index ? node : { ...node, actor: '学院' }) } }
  assert.throws(() => buildRequest('semantic_verifier', fixture, invalidEntry), (error) => {
    assert.equal(error.message, 'UPSTREAM_GRAPH_SCHEMA_INVALID')
    assert.ok(error.issues.includes('graph.nodes[0].actor'))
    return true
  })
  assert.throws(() => buildRequest('semantic_verifier', fixture, { status: 'request_failure', parsed: null }), /UPSTREAM_GRAPH_SCHEMA_INVALID/u)
})

test('schema accounting separates verifier-own validity from pipeline validity', () => {
  const skipped = evaluateSchemaLayers({
    fixture,
    factsEntry: { status: 'completed', parsed: facts },
    propositionEntry: { status: 'completed', parsed: { ...graph, nodes: graph.nodes.map((node, index) => index ? node : { ...node, actor: '学院' }) } },
    verifierEntry: { status: 'completed', parsed: verifier },
  })
  assert.equal(skipped.factsSchemaValid, true)
  assert.equal(skipped.graphSchemaValid, false)
  assert.equal(skipped.verifierOwnSchemaValid, null)
  assert.equal(skipped.verifierDispatchEligible, false)
  assert.equal(skipped.pipelineSchemaValid, false)

  const invalidVerifier = structuredClone(verifier)
  invalidVerifier.nodeAssessments[0].polarity = 'positive'
  const layered = evaluateSchemaLayers({
    fixture,
    factsEntry: { status: 'completed', parsed: facts },
    propositionEntry: { status: 'completed', parsed: graph },
    verifierEntry: { status: 'completed', parsed: invalidVerifier },
  })
  assert.equal(layered.graphSchemaValid, true)
  assert.equal(layered.verifierDispatchEligible, true)
  assert.equal(layered.verifierOwnSchemaValid, false)
  assert.equal(layered.pipelineSchemaValid, false)
})

test('valid graph builds verifier request with bound fingerprints and canonical schema', () => {
  const request = buildRequest('semantic_verifier', fixture, { status: 'completed', parsed: graph })
  const input = JSON.parse(request.body.input[0].content[0].text)
  assert.equal(input.sourceFingerprint, sha256(fixture.sourceText))
  assert.equal(input.candidateFingerprint, sha256(stableJson(graph)))
  assert.deepEqual(input.candidate, graph)
  assert.equal(request.body.text.format.schema, VERIFIER_SCHEMA)
})

test('verifier gate rejects a graph replayed under another case id', () => {
  const swapped = { ...fixture, id: 'b01-other-case' }
  assert.throws(() => buildRequest('semantic_verifier', swapped, { status: 'completed', parsed: graph }), (error) => {
    assert.ok(error.issues.includes('graph.producerRunIdBinding'))
    return true
  })
})

test('verifier rejects copied noncanonical values and extra action/object fields', () => {
  const copied = structuredClone(verifier)
  copied.nodeAssessments[0].actor = '学院'
  copied.nodeAssessments[0].polarity = 'positive'
  copied.nodeAssessments[0].action = '填写'
  const validation = validateVerifier(copied, fixture.sourceText, graph, verifier.sourceFingerprint, verifier.candidateFingerprint)
  assert.equal(validation.valid, false)
  assert.ok(validation.issues.includes('verifier.nodeAssessments[0].keys'))
  assert.ok(validation.issues.includes('verifier.nodeAssessments[0].actor'))
  assert.ok(validation.issues.includes('verifier.nodeAssessments[0].polarity'))
})

test('selected is composed locally and graph-only output never defaults a task', () => {
  const factsPrediction = predictionFromFacts(facts)
  assert.equal(factsPrediction.requiresAction, facts.requiresAction)
  assert.equal(factsPrediction.tasks[0].selected, true)
  const graphPrediction = predictionFromProposition(graph)
  assert.equal(graphPrediction.requiresAction, true)
  assert.equal(graphPrediction.tasks[0].selected, false)
})

test('verified default selection requires complete coverage and agreement of linked nodes', () => {
  assert.equal(predictionFromVerified(graph, verifier).tasks[0].selected, true)
  const incomplete = { ...verifier, graphCoverage: 'incomplete' }
  assert.equal(predictionFromVerified(graph, incomplete).tasks[0].selected, false)
  const missing = { ...verifier, missingDirectives: [{ action: '提交', object: '登记表', effect: 'external_transfer', evidence: fixture.sourceText }] }
  const missingPrediction = predictionFromVerified(graph, missing)
  assert.equal(missingPrediction.tasks[0].selected, false)
  assert.equal(missingPrediction.requiresAction, true)
  const supportMismatch = structuredClone(verifier)
  supportMismatch.nodeAssessments[1].verdict = 'unknown'
  assert.equal(predictionFromVerified(graph, supportMismatch).tasks[0].selected, false)
})

test('Responses payload parser distinguishes completed, incomplete and invalid output', () => {
  const completed = parseResponsesPayload({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }] })
  assert.deepEqual(completed.parsed, { ok: true })
  assert.equal(completed.status, 'completed')
  assert.equal(parseResponsesPayload({ status: 'incomplete', output: [] }).status, 'incomplete')
  assert.equal(parseResponsesPayload({ status: 'completed', output: [{ content: [{ type: 'output_text', text: 'no-json' }] }] }).status, 'invalid_output')
})

test('checkpoint binds the complete frozen contract and rejects drift', () => {
  const checkpoint = createCheckpoint(checkpointContract)
  assert.deepEqual(validateCheckpoint(checkpoint, checkpointContract, [fixture.id]), { valid: true, issues: [] })
  for (const [field, value] of [['runId', 'wrong-run'], ['freezeSha256', 'e'.repeat(64)], ['planSha256', 'f'.repeat(64)],
    ['runnerSha256', '0'.repeat(64)], ['model', 'wrong-model'], ['endpoint', 'https://invalid.example']]) {
    const changed = { ...checkpoint, [field]: value }
    assert.equal(validateCheckpoint(changed, checkpointContract, [fixture.id]).valid, false, field)
  }
  const changedPrompts = { ...checkpoint, promptSha256: { ...checkpoint.promptSha256, facts_first: '0'.repeat(64) } }
  assert.equal(validateCheckpoint(changedPrompts, checkpointContract, [fixture.id]).valid, false)
})

test('checkpoint has one attempt, explicit dispatch evidence and no silent retry path', () => {
  let checkpoint = createCheckpoint(checkpointContract)
  checkpoint = reserveEntry(checkpoint, fixture.id, 'facts_first', '2026-09-03T10:01:00.000Z')
  assert.equal(checkpointCounts(checkpoint).safeToDispatchReserved, 1)
  assert.throws(() => reserveEntry(checkpoint, fixture.id, 'facts_first', '2026-09-03T10:01:01.000Z'), /ALREADY_EXISTS/u)
  checkpoint = markDispatched(checkpoint, `${fixture.id}:facts_first`, '1'.repeat(64), '2026-09-03T10:01:02.000Z')
  assert.deepEqual(checkpointCounts(checkpoint), { logicalEntries: 1, requestDispatches: 1, confirmedResponses: 0, dispatchUnknown: 1, skippedBeforeDispatch: 0, safeToDispatchReserved: 0 })
  assert.throws(() => markDispatched(checkpoint, `${fixture.id}:facts_first`, '2'.repeat(64), '2026-09-03T10:01:03.000Z'), /NOT_DISPATCHABLE/u)
  checkpoint = finishEntry(checkpoint, `${fixture.id}:facts_first`, { state: 'completed', completedAt: '2026-09-03T10:01:04.000Z', httpStatus: 200,
    providerRequestId: 'response-1', returnedModel: MODEL, responseSha256: '4'.repeat(64), failureCode: null })
  assert.equal(checkpointCounts(checkpoint).confirmedResponses, 1)
  assert.equal(validateCheckpoint(checkpoint, checkpointContract, [fixture.id]).valid, true)
  assert.throws(() => finishEntry(checkpoint, `${fixture.id}:facts_first`, { state: 'completed' }), /NOT_FINISHABLE/u)
})

test('invalid graph produces a non-dispatched verifier skip instead of a paid call', () => {
  const checkpoint = skipVerifier(createCheckpoint(checkpointContract), fixture.id, '2026-09-03T10:02:00.000Z', ['graph.nodes[0].actor'])
  assert.deepEqual(checkpointCounts(checkpoint), { logicalEntries: 1, requestDispatches: 0, confirmedResponses: 0, dispatchUnknown: 0, skippedBeforeDispatch: 1, safeToDispatchReserved: 0 })
  assert.equal(validateCheckpoint(checkpoint, checkpointContract, [fixture.id]).valid, true)
})

test('completed checkpoint rejects provider model mismatch and duplicate keys', () => {
  let checkpoint = reserveEntry(createCheckpoint(checkpointContract), fixture.id, 'facts_first', '2026-09-03T10:03:00.000Z')
  checkpoint = markDispatched(checkpoint, `${fixture.id}:facts_first`, '3'.repeat(64), '2026-09-03T10:03:01.000Z')
  checkpoint = finishEntry(checkpoint, `${fixture.id}:facts_first`, { state: 'completed', completedAt: '2026-09-03T10:03:02.000Z', httpStatus: 200,
    providerRequestId: 'response-2', returnedModel: 'unexpected-model', responseSha256: '5'.repeat(64), failureCode: null })
  assert.equal(validateCheckpoint(checkpoint, checkpointContract, [fixture.id]).valid, false)
  const duplicate = { ...checkpoint, entries: [...checkpoint.entries, checkpoint.entries[0]] }
  assert.equal(validateCheckpoint(duplicate, checkpointContract, [fixture.id]).valid, false)
})

test('checkpoint success binds provider response identity and response hash', () => {
  let checkpoint = reserveEntry(createCheckpoint(checkpointContract), fixture.id, 'proposition_graph', '2026-09-03T10:04:00.000Z')
  checkpoint = markDispatched(checkpoint, `${fixture.id}:proposition_graph`, '6'.repeat(64), '2026-09-03T10:04:01.000Z')
  const incompleteEvidence = finishEntry(checkpoint, `${fixture.id}:proposition_graph`, {
    state: 'completed', completedAt: '2026-09-03T10:04:02.000Z', httpStatus: 200, returnedModel: MODEL,
  })
  const validation = validateCheckpoint(incompleteEvidence, checkpointContract, [fixture.id])
  assert.equal(validation.valid, false)
  assert.ok(validation.issues.includes('checkpoint.entries[0].completedEvidence'))
})

test('checkpoint transport failure remains a dispatched non-retryable attempt', () => {
  let checkpoint = reserveEntry(createCheckpoint(checkpointContract), fixture.id, 'facts_first', '2026-09-03T10:05:00.000Z')
  checkpoint = markDispatched(checkpoint, `${fixture.id}:facts_first`, '7'.repeat(64), '2026-09-03T10:05:01.000Z')
  checkpoint = finishEntry(checkpoint, `${fixture.id}:facts_first`, {
    state: 'transport_failure', completedAt: '2026-09-03T10:05:02.000Z', failureCode: 'SOCKET_CLOSED_AFTER_DISPATCH',
  })
  assert.equal(validateCheckpoint(checkpoint, checkpointContract, [fixture.id]).valid, true)
  assert.equal(checkpointCounts(checkpoint).requestDispatches, 1)
  assert.equal(checkpointCounts(checkpoint).confirmedResponses, 0)
  assert.throws(() => reserveEntry(checkpoint, fixture.id, 'facts_first', '2026-09-03T10:05:03.000Z'), /ALREADY_EXISTS/u)
})

function predictedTask(overrides = {}) {
  return { ...facts.tasks[0], selected: true, ...overrides }
}

test('requiresAction is scored from model output rather than inferred from active tasks', () => {
  const score = scoreCase(fixture, { status: 'completed', schemaValid: true, requiresAction: false, tasks: [predictedTask()] })
  assert.equal(score.requiresActionCorrect, false)
  assert.equal(score.completeCase, false)
})

test('invalid empty results receive no negative-case requiresAction credit', () => {
  const negative = { ...fixture, id: 'negative', expected: { requiresAction: false, tasks: [], forbiddenDefaultTokens: [] } }
  const score = scoreCase(negative, { status: 'completed', schemaValid: false, requiresAction: false, tasks: [] })
  assert.equal(score.qualityEligible, false)
  assert.equal(score.requiresActionCorrect, null)
  const aggregate = aggregateRole([score])
  assert.equal(aggregate.runStatus, 'INVALID_RUN')
  assert.equal(aggregate.qualityMetrics, null)
})

test('missed safe defaults fail Complete Case and are reported in aggregate metrics', () => {
  const score = scoreCase(fixture, { status: 'completed', schemaValid: true, requiresAction: true, tasks: [predictedTask({ selected: false })] })
  assert.equal(score.missedSafeDefaults, 1)
  assert.equal(score.completeCase, false)
  const aggregate = aggregateRole([score])
  assert.equal(aggregate.qualityMetrics.safeDefaultRecall, 0)
  assert.equal(aggregate.qualityMetrics.missedSafeDefaults, 1)
})

test('unmatched false-positive auxiliary fields are penalized', () => {
  const extra = predictedTask({ id: 'fp', action: '提交', object: '另一份表', effect: 'external_transfer', selected: false,
    timeRaw: ['明天'], materials: ['身份证'], event: '虚构会议', location: '虚构地点' })
  const score = scoreCase(fixture, { status: 'completed', schemaValid: true, requiresAction: true, tasks: [predictedTask(), extra] })
  assert.equal(score.fp, 1)
  assert.equal(score.fields.time.total, 2)
  assert.equal(score.fields.time.correct, 1)
  assert.equal(score.fields.materials.total, 1)
  assert.equal(score.fields.materials.correct, 0)
  assert.equal(score.fields.event.total, 1)
  assert.equal(score.fields.location.total, 1)
})

test('task matching is based on action and object, not keywords borrowed from evidence', () => {
  const borrowed = predictedTask({ action: '查看', object: '通知', evidence: fixture.sourceText })
  const score = scoreCase(fixture, { status: 'completed', schemaValid: true, requiresAction: true, tasks: [borrowed] })
  assert.equal(score.tp, 0)
  assert.equal(score.fp, 1)
  assert.equal(score.fn, 1)
})

test('candidate decision fails closed on invalid arms and unsafe default recall', () => {
  const validMetrics = { taskPrecision: 1, taskRecall: 1, requiresActionAccuracy: 1, effectAccuracy: 1, timeAccuracy: 1,
    materialsAccuracy: 1, eventAccuracy: null, locationAccuracy: null, evidenceSpanValidity: 1, completeCaseAccuracy: 1,
    majorCorrectionProxyRate: 0, forbiddenDefaultSelections: 0, safeDefaultRecall: 1, missedSafeDefaults: 0 }
  const valid = { runStatus: 'VALID', qualityMetrics: validMetrics }
  assert.equal(candidateDecision({ facts_first: valid, proposition_graph: { runStatus: 'INVALID_RUN' }, semantic_verifier: valid }).code, 'INVALID_RUN')
  const unsafe = { runStatus: 'VALID', qualityMetrics: { ...valid.qualityMetrics, safeDefaultRecall: 0.5 } }
  assert.equal(candidateDecision({ facts_first: valid, proposition_graph: valid, semantic_verifier: unsafe }).code, 'REJECT_CANDIDATE')
  const fieldRegression = { runStatus: 'VALID', qualityMetrics: { ...valid.qualityMetrics, timeAccuracy: 0.5 } }
  assert.equal(candidateDecision({ facts_first: valid, proposition_graph: valid, semantic_verifier: fieldRegression }).code, 'REJECT_CANDIDATE')
})
