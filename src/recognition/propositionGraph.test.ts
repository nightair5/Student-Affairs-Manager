import { describe, expect, it } from 'vitest'
import {
  PROPOSITION_GRAPH_SCHEMA_VERSION,
  PROPOSITION_VERIFICATION_SCHEMA_VERSION,
  composeRecognitionFromPropositionGraph,
  createPropositionAtomSpan,
  indexPropositionScopes,
  propositionCandidateFingerprint,
  propositionSourceFingerprint,
  validatePropositionGraphCandidate,
  validatePropositionVerification,
  type PropositionGraphCandidate,
  type PropositionSemantics,
  type PropositionVerificationReport,
} from './propositionGraph'

const sourceContent = '请于9月10日前填写家庭经济困难认定表。家庭经济困难认定表为必交。'
const referenceTime = new Date('2026-09-03T08:00:00+08:00')

const directiveSemantics: PropositionSemantics = {
  actor: 'addressee',
  speechAct: 'directive',
  polarity: 'affirmative',
  tense: 'future',
  status: 'pending',
  validity: 'active',
  modality: 'required',
}

const assertedRequiredSemantics: PropositionSemantics = {
  actor: 'addressed_group',
  speechAct: 'assertive',
  polarity: 'affirmative',
  tense: 'present',
  status: 'pending',
  validity: 'active',
  modality: 'required',
}

function spanned(source: string, value: string, occurrence = 0) {
  return { value, span: createPropositionAtomSpan(source, value, occurrence) }
}

function graph(source = sourceContent): PropositionGraphCandidate {
  const scopes = indexPropositionScopes(source)
  return {
    schemaVersion: PROPOSITION_GRAPH_SCHEMA_VERSION,
    producerRunId: 'candidate-run-1',
    nodes: [
      {
        id: 'directive-1',
        kind: 'directive',
        scopeId: scopes[0].id,
        semantics: { ...directiveSemantics },
        inferenceLevel: 'explicit',
        action: {
          verb: '填写',
          verbSpan: createPropositionAtomSpan(source, '填写'),
          object: spanned(source, '家庭经济困难认定表'),
          effect: 'local_change',
        },
        material: null,
        time: null,
        event: null,
        location: null,
      },
      {
        id: 'time-1',
        kind: 'time',
        scopeId: scopes[0].id,
        semantics: { ...directiveSemantics },
        inferenceLevel: 'explicit',
        action: null,
        material: null,
        time: { type: 'submission_deadline', rawText: spanned(source, '9月10日前') },
        event: null,
        location: null,
      },
      {
        id: 'material-1',
        kind: 'material',
        scopeId: scopes[1].id,
        semantics: { ...assertedRequiredSemantics },
        inferenceLevel: 'explicit',
        action: null,
        material: {
          name: spanned(source, '家庭经济困难认定表', 1),
          required: true,
          formatRequirements: [],
          namingRequirements: [],
          quantity: null,
          submissionChannel: null,
        },
        time: null,
        event: null,
        location: null,
      },
    ],
    relations: [
      { id: 'relation-time-1', type: 'task_time', fromId: 'directive-1', toId: 'time-1', evidenceScopeIds: [scopes[0].id] },
      { id: 'relation-material-1', type: 'task_material', fromId: 'directive-1', toId: 'material-1', evidenceScopeIds: [scopes[0].id, scopes[1].id] },
    ],
  }
}

function verification(
  candidate: PropositionGraphCandidate,
  source = sourceContent,
  verdict: 'entailed' | 'contradicted' | 'unknown' = 'entailed',
): PropositionVerificationReport {
  return {
    schemaVersion: PROPOSITION_VERIFICATION_SCHEMA_VERSION,
    method: 'contract_fixture_oracle',
    verifierRunId: 'fixture-oracle-run-1',
    sourceFingerprint: propositionSourceFingerprint(source),
    candidateFingerprint: propositionCandidateFingerprint(candidate),
    consideredScopeIds: indexPropositionScopes(source).map((scope) => scope.id),
    graphCoverageVerdict: 'complete',
    revisionCoverageVerdict: 'complete',
    nodeDecisions: candidate.nodes.map((node) => ({ nodeId: node.id, verdict })),
    relationDecisions: candidate.relations.map((relation) => ({ relationId: relation.id, verdict })),
  }
}

function compose(candidate: PropositionGraphCandidate, source = sourceContent, report = verification(candidate, source)) {
  return composeRecognitionFromPropositionGraph(candidate, {
    sourceContent: source,
    sourceId: 'anonymous-source-1',
    sourceTitle: '匿名资助通知',
    sourceType: 'text',
    referenceTime,
    timezone: 'Asia/Shanghai',
    createdAt: '2026-09-03T00:00:00.000Z',
    verification: report,
    allowContractFixtureOracle: true,
  })
}

function expectContractError(run: () => unknown, code: string) {
  expect(run).toThrow(code)
}

function eventGraph(source = '请参加9月12日下午3点在一号楼101举行的讲座。'): PropositionGraphCandidate {
  const scopeId = indexPropositionScopes(source)[0].id
  return {
    schemaVersion: PROPOSITION_GRAPH_SCHEMA_VERSION,
    producerRunId: 'event-candidate-run-1',
    nodes: [
      {
        id: 'directive-1', kind: 'directive', scopeId, semantics: { ...directiveSemantics }, inferenceLevel: 'explicit',
        action: { verb: '参加', verbSpan: createPropositionAtomSpan(source, '参加'), object: spanned(source, '讲座'), effect: 'physical_action' },
        material: null, time: null, event: null, location: null,
      },
      {
        id: 'event-1', kind: 'event', scopeId, semantics: { ...assertedRequiredSemantics }, inferenceLevel: 'explicit',
        action: null, material: null, time: null, event: { title: spanned(source, '讲座') }, location: null,
      },
      {
        id: 'event-time-1', kind: 'time', scopeId, semantics: { ...assertedRequiredSemantics }, inferenceLevel: 'explicit',
        action: null, material: null, time: { type: 'event_start', rawText: spanned(source, '9月12日下午3点') }, event: null, location: null,
      },
      {
        id: 'location-1', kind: 'location', scopeId, semantics: { ...assertedRequiredSemantics }, inferenceLevel: 'explicit',
        action: null, material: null, time: null, event: null, location: spanned(source, '一号楼101'),
      },
    ],
    relations: [
      { id: 'task-event-relation-1', type: 'task_event', fromId: 'directive-1', toId: 'event-1', evidenceScopeIds: [scopeId] },
      { id: 'task-time-relation-1', type: 'task_time', fromId: 'directive-1', toId: 'event-time-1', evidenceScopeIds: [scopeId] },
      { id: 'event-time-relation-1', type: 'event_time_start', fromId: 'event-1', toId: 'event-time-1', evidenceScopeIds: [scopeId] },
      { id: 'event-location-relation-1', type: 'event_location', fromId: 'event-1', toId: 'location-1', evidenceScopeIds: [scopeId] },
    ],
  }
}

describe('RCO-5-004 proposition graph contract', () => {
  it('indexes complete scopes with their terminal punctuation and punctuation runs intact', () => {
    const source = '这是问题吗？！\r\n请提交材料。'
    expect(indexPropositionScopes(source)).toEqual([
      { id: 'scope-1', start: 0, end: 7, text: '这是问题吗？！' },
      { id: 'scope-2', start: 9, end: 15, text: '请提交材料。' },
    ])
  })

  it('treats compatibility and multilingual question marks as question scope boundaries', () => {
    const source = '报名表为必交﹖下一项؟'
    expect(indexPropositionScopes(source).map((scope) => scope.text)).toEqual(['报名表为必交﹖', '下一项؟'])
    const candidate = graph('请于9月10日前填写家庭经济困难认定表。家庭经济困难认定表为必交﹖')
    expect(validatePropositionGraphCandidate(candidate, '请于9月10日前填写家庭经济困难认定表。家庭经济困难认定表为必交﹖').issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'QUESTION_SCOPE_SEMANTICS_MISMATCH' })]),
    )
  })

  it('composes only verified, safe propositions and preserves full-scope evidence', () => {
    const result = compose(graph())
    expect(result.standaloneTasks[0]).toMatchObject({
      title: '填写家庭经济困难认定表',
      selected: true,
      timePointTempIds: ['time-1'],
      materialTempIds: ['material-1'],
    })
    expect(result.materials[0]).toMatchObject({ name: '家庭经济困难认定表', required: true, selected: true })
    expect(result.timePoints[0]).toMatchObject({ normalizedValue: '2026-09-10', selected: true })
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: 'anonymous-source-1', quote: '请于9月10日前填写家庭经济困难认定表。', textStart: 0, textEnd: 20 }),
      expect.objectContaining({ sourceId: 'anonymous-source-1', quote: '家庭经济困难认定表为必交。', textStart: 20, textEnd: sourceContent.length }),
    ]))
    expect(result.quality.needsHumanReview).toBe(true)
  })

  it('rejects selected or verifier output from the candidate graph', () => {
    const candidate = graph() as PropositionGraphCandidate & { selected?: boolean; verification?: unknown }
    candidate.selected = true
    candidate.verification = verification(graph())
    expect(validatePropositionGraphCandidate(candidate, sourceContent)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'UNKNOWN_FIELD', path: 'candidate.selected' }),
        expect.objectContaining({ code: 'UNKNOWN_FIELD', path: 'candidate.verification' }),
      ]),
    })
  })

  it('rejects an atom with forged offsets or a scope mismatch', () => {
    const candidate = graph()
    candidate.nodes[0].action!.verbSpan.start += 1
    candidate.nodes[0].action!.verbSpan.end += 1
    expect(validatePropositionGraphCandidate(candidate, sourceContent)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'SPAN_TEXT_MISMATCH' })]),
    })
  })

  it('rejects assertive semantics for a question scope and cannot select the questioned material', () => {
    const source = '请于9月10日前填写家庭经济困难认定表。家庭经济困难认定表为必交吗？'
    const candidate = graph(source)
    expect(validatePropositionGraphCandidate(candidate, source)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'QUESTION_SCOPE_SEMANTICS_MISMATCH' })]),
    })
    candidate.nodes[2].semantics.speechAct = 'interrogative'
    const result = compose(candidate, source, verification(candidate, source))
    expect(result.standaloneTasks[0]).toMatchObject({ selected: true, materialTempIds: [] })
    expect(result.materials[0]).toMatchObject({ selected: false, required: false })
  })

  it('requires explicit fixture-oracle opt-in and refuses a not-yet-connected independent verifier', () => {
    const candidate = graph()
    const report = verification(candidate)
    expectContractError(() => composeRecognitionFromPropositionGraph(candidate, {
      sourceContent,
      sourceId: 'anonymous-source-1',
      referenceTime,
      timezone: 'Asia/Shanghai',
      verification: report,
    }), 'FIXTURE_VERIFICATION_FORBIDDEN')
    const claimedIndependent = { ...report, method: 'independent_semantic_verifier' as const }
    expect(validatePropositionVerification(claimedIndependent, candidate, sourceContent)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'INDEPENDENT_VERIFIER_NOT_CONNECTED' })]),
    })
  })

  it.each([
    ['same verifier run', (report: PropositionVerificationReport, candidate: PropositionGraphCandidate) => { report.verifierRunId = candidate.producerRunId }, 'VERIFIER_NOT_INDEPENDENT'],
    ['wrong source fingerprint', (report: PropositionVerificationReport) => { report.sourceFingerprint = 'fnv1a32:00000000:0' }, 'VERIFICATION_SOURCE_MISMATCH'],
    ['wrong graph fingerprint', (report: PropositionVerificationReport) => { report.candidateFingerprint = 'fnv1a32:00000000:0' }, 'VERIFICATION_CANDIDATE_MISMATCH'],
    ['partial document', (report: PropositionVerificationReport) => { report.consideredScopeIds.pop() }, 'VERIFICATION_FULL_DOCUMENT_REQUIRED'],
    ['incomplete graph', (report: PropositionVerificationReport) => { report.graphCoverageVerdict = 'incomplete' }, 'GRAPH_COVERAGE_NOT_COMPLETE'],
    ['unknown revision coverage', (report: PropositionVerificationReport) => { report.revisionCoverageVerdict = 'unknown' }, 'REVISION_COVERAGE_NOT_COMPLETE'],
    ['missing node decision', (report: PropositionVerificationReport) => { report.nodeDecisions.pop() }, 'VERIFICATION_COVERAGE_INCOMPLETE'],
    ['missing relation decision', (report: PropositionVerificationReport) => { report.relationDecisions.pop() }, 'VERIFICATION_COVERAGE_INCOMPLETE'],
  ] as const)('rejects an unbound verification report: %s', (_name, mutate, code) => {
    const candidate = graph()
    const report = verification(candidate)
    mutate(report, candidate)
    expect(validatePropositionVerification(report, candidate, sourceContent, true)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([expect.objectContaining({ code })]),
    })
  })

  it('keeps unknown node and relation verdicts unselected and removes unsafe references', () => {
    const candidate = graph()
    const report = verification(candidate, sourceContent, 'unknown')
    const result = compose(candidate, sourceContent, report)
    expect(result.sourceSummary.requiresAction).toBe(false)
    expect(result.standaloneTasks[0]).toMatchObject({ selected: false, materialTempIds: [], timePointTempIds: [] })
    expect(result.materials[0]).toMatchObject({ selected: false, required: false, relatedTaskTempIds: [] })
    expect(result.timePoints[0]).toMatchObject({ selected: false, needsConfirmation: true, relatedTaskTempIds: [] })
  })

  it('requires full ordered relation evidence covering both endpoint propositions', () => {
    const missingEndpoint = graph()
    missingEndpoint.relations[1].evidenceScopeIds = ['scope-1']
    expect(validatePropositionGraphCandidate(missingEndpoint, sourceContent).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'RELATION_ENDPOINT_SCOPE_EVIDENCE_REQUIRED' })]),
    )

    const reverseOrder = graph()
    reverseOrder.relations[1].evidenceScopeIds = ['scope-2', 'scope-1']
    expect(validatePropositionGraphCandidate(reverseOrder, sourceContent).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'RELATION_EVIDENCE_SCOPE_ORDER_INVALID' })]),
    )
  })

  it('selects an event only through verified safe linked facts and fails closed when their subjects are unsafe', () => {
    const source = '请参加9月12日下午3点在一号楼101举行的讲座。'
    const candidate = eventGraph(source)
    const accepted = compose(candidate, source, verification(candidate, source))
    expect(accepted.events[0]).toMatchObject({ selected: true, startTimePointTempId: 'time-1', location: '一号楼101' })
    expect(accepted.timePoints[0]).toMatchObject({ selected: true, needsConfirmation: false })

    candidate.nodes[2].semantics.actor = 'third_party'
    candidate.nodes[3].semantics.actor = 'unknown'
    const rejected = compose(candidate, source, verification(candidate, source))
    expect(rejected.events[0]).toMatchObject({ selected: false, startTimePointTempId: null, location: null })
    expect(rejected.timePoints[0]).toMatchObject({ selected: false, needsConfirmation: true })
    expect(rejected.sourceSummary.requiresAction).toBe(true)
  })

  it('keeps a factual event with accurate time and location unselected when no verified user action points to it', () => {
    const source = '讲座将于9月12日下午3点在一号楼101举行。'
    const scopeId = indexPropositionScopes(source)[0].id
    const candidate: PropositionGraphCandidate = {
      schemaVersion: PROPOSITION_GRAPH_SCHEMA_VERSION,
      producerRunId: 'information-event-run-1',
      nodes: [
        { id: 'event-1', kind: 'event', scopeId, semantics: { ...assertedRequiredSemantics }, inferenceLevel: 'explicit', action: null, material: null, time: null, event: { title: spanned(source, '讲座') }, location: null },
        { id: 'time-1', kind: 'time', scopeId, semantics: { ...assertedRequiredSemantics }, inferenceLevel: 'explicit', action: null, material: null, time: { type: 'event_start', rawText: spanned(source, '9月12日下午3点') }, event: null, location: null },
        { id: 'location-1', kind: 'location', scopeId, semantics: { ...assertedRequiredSemantics }, inferenceLevel: 'explicit', action: null, material: null, time: null, event: null, location: spanned(source, '一号楼101') },
      ],
      relations: [
        { id: 'event-time-1', type: 'event_time_start', fromId: 'event-1', toId: 'time-1', evidenceScopeIds: [scopeId] },
        { id: 'event-location-1', type: 'event_location', fromId: 'event-1', toId: 'location-1', evidenceScopeIds: [scopeId] },
      ],
    }
    const result = compose(candidate, source, verification(candidate, source))
    expect(result.events[0].selected).toBe(false)
    expect(result.timePoints[0].selected).toBe(false)
    expect(result.sourceSummary.requiresAction).toBe(false)
  })

  it('does not let unsafe material or time propositions leak through a safe task relation', () => {
    const candidate = graph()
    candidate.nodes[1].semantics.actor = 'third_party'
    candidate.nodes[2].semantics.polarity = 'uncertain'
    const result = compose(candidate, sourceContent, verification(candidate))
    expect(result.standaloneTasks[0]).toMatchObject({ selected: true, materialTempIds: [], timePointTempIds: [] })
    expect(result.materials[0].selected).toBe(false)
    expect(result.timePoints[0].selected).toBe(false)
  })

  const semanticMutations: ReadonlyArray<readonly [string, keyof PropositionSemantics, PropositionSemantics[keyof PropositionSemantics]]> = [
    ['third-party actor', 'actor', 'third_party'],
    ['issuer actor', 'actor', 'issuer'],
    ['unknown actor', 'actor', 'unknown'],
    ['assertive act', 'speechAct', 'assertive'],
    ['question act', 'speechAct', 'interrogative'],
    ['hypothetical act', 'speechAct', 'hypothetical'],
    ['quoted act', 'speechAct', 'quoted'],
    ['unknown act', 'speechAct', 'unknown'],
    ['negative polarity', 'polarity', 'negative'],
    ['uncertain polarity', 'polarity', 'uncertain'],
    ['past tense', 'tense', 'past'],
    ['unknown tense', 'tense', 'unknown'],
    ['completed status', 'status', 'completed'],
    ['cancelled status', 'status', 'cancelled'],
    ['unknown status', 'status', 'unknown'],
    ['superseded validity', 'validity', 'superseded'],
    ['uncertain validity', 'validity', 'uncertain'],
    ['recommended modality', 'modality', 'recommended'],
    ['optional modality', 'modality', 'optional'],
    ['informational modality', 'modality', 'informational'],
    ['unknown modality', 'modality', 'unknown'],
  ]

  it.each(semanticMutations)('fails closed after one proposition-property mutation: %s', (_name, field, value) => {
    const candidate = graph()
    ;(candidate.nodes[0].semantics as unknown as Record<string, unknown>)[field] = value
    const result = compose(candidate, sourceContent, verification(candidate))
    expect(result.standaloneTasks[0]).toMatchObject({ selected: false, materialTempIds: [], timePointTempIds: [] })
    expect(result.sourceSummary.requiresAction).toBe(false)
  })

  it.each([
    ['strong inference', 'strong_inference'],
    ['optional suggestion', 'optional_suggestion'],
  ] as const)('fails closed after changing inference level to %s', (_name, inferenceLevel) => {
    const candidate = graph()
    candidate.nodes[0].inferenceLevel = inferenceLevel
    const result = compose(candidate, sourceContent, verification(candidate))
    expect(result.standaloneTasks[0].selected).toBe(false)
  })

  it.each([
    ['supersedes', 'entailed'],
    ['cancels', 'entailed'],
    ['amends', 'unknown'],
  ] as const)('suppresses a revised target fail-closed: %s/%s', (type, verdict) => {
    const candidate = graph()
    candidate.relations.push({ id: 'revision-1', type, fromId: 'material-1', toId: 'directive-1', evidenceScopeIds: ['scope-1', 'scope-2'] })
    const report = verification(candidate)
    report.relationDecisions.find((decision) => decision.relationId === 'revision-1')!.verdict = verdict
    const result = compose(candidate, sourceContent, report)
    expect(result.standaloneTasks[0]).toMatchObject({ selected: false, materialTempIds: [], timePointTempIds: [] })
  })

  it('does not suppress a target when the independent decision contradicts the revision relation', () => {
    const candidate = graph()
    candidate.relations.push({ id: 'revision-1', type: 'cancels', fromId: 'material-1', toId: 'directive-1', evidenceScopeIds: ['scope-1', 'scope-2'] })
    const report = verification(candidate)
    report.relationDecisions.find((decision) => decision.relationId === 'revision-1')!.verdict = 'contradicted'
    expect(compose(candidate, sourceContent, report).standaloneTasks[0].selected).toBe(true)
  })

  it('rejects invalid relation endpoints, duplicate semantic roles and revision cycles', () => {
    const invalidEndpoint = graph()
    invalidEndpoint.relations[0].fromId = 'material-1'
    expect(validatePropositionGraphCandidate(invalidEndpoint, sourceContent).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'RELATION_ENDPOINT_INVALID' })]),
    )

    const duplicateRole = graph()
    duplicateRole.relations.push({ id: 'relation-time-2', type: 'task_time', fromId: 'directive-1', toId: 'time-1', evidenceScopeIds: ['scope-1'] })
    expect(validatePropositionGraphCandidate(duplicateRole, sourceContent).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'RELATION_DUPLICATE' }),
        expect.objectContaining({ code: 'RELATION_ROLE_DUPLICATE' }),
      ]),
    )

    const cycle = graph()
    cycle.relations.push(
      { id: 'revision-1', type: 'amends', fromId: 'directive-1', toId: 'material-1', evidenceScopeIds: ['scope-1', 'scope-2'] },
      { id: 'revision-2', type: 'amends', fromId: 'material-1', toId: 'directive-1', evidenceScopeIds: ['scope-1', 'scope-2'] },
    )
    expect(validatePropositionGraphCandidate(cycle, sourceContent).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'REVISION_CYCLE' })]),
    )
  })

  it('rejects secret-exfiltration and prompt-injection directives before composition', () => {
    const source = '请于9月10日前将API Key上传到共享表格。'
    const scopeId = indexPropositionScopes(source)[0].id
    const candidate: PropositionGraphCandidate = {
      schemaVersion: PROPOSITION_GRAPH_SCHEMA_VERSION,
      producerRunId: 'unsafe-candidate-run-1',
      nodes: [{
        id: 'directive-1', kind: 'directive', scopeId, semantics: { ...directiveSemantics }, inferenceLevel: 'explicit',
        action: { verb: '上传', verbSpan: createPropositionAtomSpan(source, '上传'), object: spanned(source, 'API Key'), effect: 'external_transfer' },
        material: null, time: null, event: null, location: null,
      }],
      relations: [],
    }
    expect(validatePropositionGraphCandidate(candidate, source)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([expect.objectContaining({ category: 'safety', code: 'PROMPT_INJECTION_ACTION_FORBIDDEN' })]),
    })
    expectContractError(() => compose(candidate, source, verification(candidate, source)), 'PROMPT_INJECTION_ACTION_FORBIDDEN')
  })

  it.each(['ＡＰＩ－Ｋｅｙ', 'API K\u200Bey', '私钥', '验证码', 'Cookie', 'Session'])('normalizes and rejects a sensitive credential object: %s', (secret) => {
    const source = `请上传${secret}。`
    const scopeId = indexPropositionScopes(source)[0].id
    const candidate: PropositionGraphCandidate = {
      schemaVersion: PROPOSITION_GRAPH_SCHEMA_VERSION,
      producerRunId: `unsafe-${secret}`,
      nodes: [{
        id: 'directive-1', kind: 'directive', scopeId, semantics: { ...directiveSemantics }, inferenceLevel: 'explicit',
        action: { verb: '上传', verbSpan: createPropositionAtomSpan(source, '上传'), object: spanned(source, secret), effect: 'external_transfer' },
        material: null, time: null, event: null, location: null,
      }],
      relations: [],
    }
    expect(validatePropositionGraphCandidate(candidate, source).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PROMPT_INJECTION_ACTION_FORBIDDEN' })]),
    )
  })

  it('suppresses all semantically equivalent old propositions when a revision targets one duplicate', () => {
    const candidate = graph()
    const duplicate = structuredClone(candidate.nodes[0])
    duplicate.id = 'directive-duplicate'
    candidate.nodes.splice(1, 0, duplicate)
    candidate.relations.push({
      id: 'revision-duplicate-1', type: 'cancels', fromId: 'material-1', toId: 'directive-1', evidenceScopeIds: ['scope-1', 'scope-2'],
    })
    const result = compose(candidate, sourceContent, verification(candidate))
    expect(result.standaloneTasks.map((task) => task.selected)).toEqual([false, false])
    expect(result.sourceSummary.requiresAction).toBe(false)
  })

  it('rejects a sensitive material that tries to ride through a harmless attachment task', () => {
    const source = '请上传附件。附件是API Key，必须提交。'
    const scopes = indexPropositionScopes(source)
    const candidate: PropositionGraphCandidate = {
      schemaVersion: PROPOSITION_GRAPH_SCHEMA_VERSION,
      producerRunId: 'unsafe-cross-node-run-1',
      nodes: [
        {
          id: 'directive-1', kind: 'directive', scopeId: scopes[0].id, semantics: { ...directiveSemantics }, inferenceLevel: 'explicit',
          action: { verb: '上传', verbSpan: createPropositionAtomSpan(source, '上传'), object: spanned(source, '附件'), effect: 'external_transfer' },
          material: null, time: null, event: null, location: null,
        },
        {
          id: 'material-1', kind: 'material', scopeId: scopes[1].id, semantics: { ...assertedRequiredSemantics }, inferenceLevel: 'explicit',
          action: null,
          material: { name: spanned(source, 'API Key'), required: true, formatRequirements: [], namingRequirements: [], quantity: null, submissionChannel: null },
          time: null, event: null, location: null,
        },
      ],
      relations: [{ id: 'task-material-1', type: 'task_material', fromId: 'directive-1', toId: 'material-1', evidenceScopeIds: scopes.map((scope) => scope.id) }],
    }
    expect(validatePropositionGraphCandidate(candidate, source)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([expect.objectContaining({ category: 'safety', code: 'SENSITIVE_PROPOSITION_FORBIDDEN' })]),
    })
    expectContractError(() => compose(candidate, source, verification(candidate, source)), 'SENSITIVE_PROPOSITION_FORBIDDEN')
  })

  it.each(['提交', '上传', '发送', '交付'] as const)('keeps every outbound-transfer directive manually gated: %s', (verb) => {
    const source = `请${verb}报名表。`
    const scopeId = indexPropositionScopes(source)[0].id
    const candidate: PropositionGraphCandidate = {
      schemaVersion: PROPOSITION_GRAPH_SCHEMA_VERSION,
      producerRunId: `transfer-${verb}`,
      nodes: [{
        id: 'directive-1', kind: 'directive', scopeId, semantics: { ...directiveSemantics }, inferenceLevel: 'explicit',
        action: { verb, verbSpan: createPropositionAtomSpan(source, verb), object: spanned(source, '报名表'), effect: 'external_transfer' },
        material: null, time: null, event: null, location: null,
      }],
      relations: [],
    }
    const result = compose(candidate, source, verification(candidate, source))
    expect(result.standaloneTasks[0]).toMatchObject({ selected: false, userConfirmationRequired: true })
    expect(result.sourceSummary.requiresAction).toBe(false)
  })

  it.each([
    ['请填写并提交报名表。', '填写', '并提交报名表'],
    ['完成报名表递交。', '完成', '报名表递交'],
    ['办理报名表上传。', '办理', '报名表上传'],
    ['完成报名表发送。', '完成', '报名表发送'],
    ['办理成果交付。', '办理', '成果交付'],
    ['办理报名表上\u200B传。', '办理', '报名表上\u200B传'],
  ] as const)('binds external-transfer effect to the complete proposition scope: %s', (source, verb, object) => {
    const scopeId = indexPropositionScopes(source)[0].id
    const candidate: PropositionGraphCandidate = {
      schemaVersion: PROPOSITION_GRAPH_SCHEMA_VERSION,
      producerRunId: `effect-${verb}-${object}`,
      nodes: [{
        id: 'directive-1', kind: 'directive', scopeId, semantics: { ...directiveSemantics }, inferenceLevel: 'explicit',
        action: { verb, verbSpan: createPropositionAtomSpan(source, verb), object: spanned(source, object), effect: 'local_change' },
        material: null, time: null, event: null, location: null,
      }],
      relations: [],
    }
    expect(validatePropositionGraphCandidate(candidate, source).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ACTION_EFFECT_MISMATCH' })]),
    )
    candidate.nodes[0].action!.effect = 'external_transfer'
    const result = compose(candidate, source, verification(candidate, source))
    expect(result.standaloneTasks[0].selected).toBe(false)
    expect(result.sourceSummary.requiresAction).toBe(false)
  })

  it('requires caller-controlled source identity, reference time and timezone', () => {
    const candidate = graph()
    const base = {
      sourceContent,
      sourceId: 'anonymous-source-1',
      referenceTime,
      timezone: 'Asia/Shanghai',
      verification: verification(candidate),
      allowContractFixtureOracle: true,
    }
    expectContractError(() => composeRecognitionFromPropositionGraph(candidate, { ...base, sourceId: '' }), 'PROPOSITION_SOURCE_ID_REQUIRED')
    expectContractError(() => composeRecognitionFromPropositionGraph(candidate, { ...base, referenceTime: new Date('invalid') }), 'PROPOSITION_REFERENCE_TIME_REQUIRED')
    expectContractError(() => composeRecognitionFromPropositionGraph(candidate, { ...base, timezone: 'Mars/Olympus' }), 'PROPOSITION_TIMEZONE_REQUIRED')
  })

  it('uses only caller metadata and never creates a confirmed task', () => {
    const result = compose(graph())
    expect(result.sourceSummary).toMatchObject({ title: '匿名资助通知', sourceType: 'text', notificationType: 'uncertain' })
    expect(result.projectMatch.decision).toBe('uncertain')
    expect(result.standaloneTasks.every((task) => task.userConfirmationRequired)).toBe(true)
  })
})
