import { describe, expect, it } from 'vitest'
import {
  indexImmutableScopes,
  type ImmutableScopeIndex,
  type ScopeReferenceCandidate,
  type ScopeReferenceDirective,
  type ScopeReferenceObservation,
} from './scopeReferenceContract'
import {
  formLocalTaskSuggestions,
  reduceModelCandidate,
  validateLocalTaskFormation,
} from './taskFormationPolicyV2'

const semantics: ScopeReferenceDirective['semantics'] = {
  actor: 'issuer', speechAct: 'assertive', polarity: 'affirmative', tense: 'present',
  status: 'completed', validity: 'active', modality: 'informational',
}

function directive(index: ImmutableScopeIndex, position: number, action: string, object: string, actionType: ScopeReferenceDirective['actionType'] = 'other'): ScopeReferenceDirective {
  const scope = index.scopes[position]
  return {
    id: `d-${position}-${action}`,
    propositionScopeIds: [scope.id],
    semantics,
    inferenceLevel: 'optional_suggestion',
    actionType,
    action: { scopeId: scope.id, surface: action },
    object: { scopeId: scope.id, surface: object },
    effect: 'unknown',
    timeRefs: [], materialRefs: [], eventRef: null, locationRef: null, revisionRefs: [],
  }
}

function observation(index: ImmutableScopeIndex, position: number, subject: string, kind: ScopeReferenceObservation['kind'] = 'information'): ScopeReferenceObservation {
  const scope = index.scopes[position]
  return {
    id: `o-${position}`,
    kind,
    propositionScopeIds: [scope.id],
    semantics,
    inferenceLevel: 'optional_suggestion',
    subject: { scopeId: scope.id, surface: subject },
    timeRefs: [], locationRef: null,
  }
}

function candidate(index: ImmutableScopeIndex, directives: ScopeReferenceDirective[], observations: ScopeReferenceObservation[] = []): ScopeReferenceCandidate {
  return {
    schemaVersion: 'scope-reference-candidate-1.0',
    sourceId: index.sourceId,
    sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint,
    producerRunId: 'untrusted-model-run',
    requiresAction: false,
    directives,
    observations,
    ignoredScopeIds: [],
  }
}

async function form(source: string, build: (index: ImmutableScopeIndex) => ScopeReferenceCandidate) {
  const index = await indexImmutableScopes('source-test', 'source-v1', source)
  const result = formLocalTaskSuggestions(index, reduceModelCandidate(build(index)))
  return { index, result }
}

describe('RCO-5-007 local task formation policy', () => {
  it('merges same-scope compound actions and blocks the negative external action', async () => {
    const { index, result } = await form('请检查乘车日期并保存预约草稿，暂勿提交。', (scopeIndex) => candidate(scopeIndex, [
      directive(scopeIndex, 0, '保存', '预约草稿', 'save'),
      directive(scopeIndex, 0, '检查', '乘车日期', 'review'),
      directive(scopeIndex, 1, '提交', '预约草稿', 'submit'),
    ]))
    expect(validateLocalTaskFormation(result, index)).toEqual([])
    expect(result.tasks).toHaveLength(2)
    expect(result.tasks[0]).toMatchObject({ action: { surface: '检查' }, object: { surface: '乘车日期' }, selected: true })
    expect(result.tasks[0].steps.map((step) => step.surface)).toContain('保存')
    expect(result.tasks[1]).toMatchObject({
      action: { surface: '提交' },
      semantics: { polarity: 'negative', tense: 'future', status: 'cancelled' },
      selected: false,
    })
    expect(result.diagnostics.mergedActionAnchors).toBe(1)
  })

  it('treats an untriggered condition as uncertain and derives requiresAction=false', async () => {
    const { index, result } = await form('若系统出现红色提示，请立即联系财务处。', (scopeIndex) => {
      const item = directive(scopeIndex, 1, '联系', '财务处', 'contact')
      item.propositionScopeIds.unshift(scopeIndex.scopes[0].id)
      return candidate(scopeIndex, [item])
    })
    expect(validateLocalTaskFormation(result, index)).toEqual([])
    expect(result.requiresAction).toBe(false)
    expect(result.tasks[0]).toMatchObject({
      semantics: { speechAct: 'hypothetical', polarity: 'uncertain', status: 'unknown', validity: 'uncertain' },
      selected: false,
    })
  })

  it('normalizes imperative tense locally even when the model labels it present', async () => {
    const { result } = await form('请打印空白承诺书。', (scopeIndex) => candidate(scopeIndex, [directive(scopeIndex, 0, '打印', '空白承诺书', 'print')]))
    expect(result.tasks[0].semantics).toMatchObject({ actor: 'addressee', speechAct: 'directive', tense: 'future', status: 'pending' })
    expect(result.tasks[0].selected).toBe(true)
  })

  it('keeps signing as an explicit but non-default sensitive action', async () => {
    const { result } = await form('请打印空白承诺书，并在纸面签名。', (scopeIndex) => candidate(scopeIndex, [
      directive(scopeIndex, 0, '打印', '空白承诺书', 'print'),
      directive(scopeIndex, 1, '签名', '纸面', 'sign'),
    ]))
    expect(result.tasks).toHaveLength(2)
    expect(result.tasks[0].selected).toBe(true)
    expect(result.tasks[1]).toMatchObject({ actionType: 'sign', selected: false, needsConfirmation: true })
  })

  it('keeps quoted examples and explanatory negation as observations', async () => {
    const { index, result } = await form('示例栏写着：“上传照片”。这只是界面演示，不是本次要求。', (scopeIndex) => candidate(scopeIndex, [], [
      observation(scopeIndex, 0, '上传照片'),
      observation(scopeIndex, 1, '这只是界面演示'),
      observation(scopeIndex, 2, '本次要求'),
    ]))
    expect(validateLocalTaskFormation(result, index)).toEqual([])
    expect(result.tasks).toEqual([])
    expect(result.requiresAction).toBe(false)
    expect(result.observations.every((item) => item.selected === false)).toBe(true)
  })

  it('attaches a shared material explanation to both tasks without making a task from it', async () => {
    const { index, result } = await form('请整理访谈提纲。请发送最终版。两项任务使用同一份访谈记录。', (scopeIndex) => candidate(scopeIndex, [
      directive(scopeIndex, 0, '整理', '访谈提纲', 'prepare'),
      directive(scopeIndex, 1, '发送', '最终版', 'send'),
    ], [observation(scopeIndex, 2, '两项任务')]))
    expect(validateLocalTaskFormation(result, index)).toEqual([])
    expect(result.tasks).toHaveLength(2)
    expect(result.tasks.every((task) => task.materialRefs.some((item) => item.surface === '访谈记录'))).toBe(true)
    expect(result.tasks[0].selected).toBe(true)
    expect(result.tasks[1].selected).toBe(false)
  })

  it('does not merge a local review with an external send merely because they share one scope', async () => {
    const { index, result } = await form('请核对名单并发送给群聊。', (scopeIndex) => candidate(scopeIndex, [
      directive(scopeIndex, 0, '核对', '名单', 'review'),
      directive(scopeIndex, 0, '发送', '名单', 'send'),
    ]))
    expect(validateLocalTaskFormation(result, index)).toEqual([])
    expect(result.tasks).toHaveLength(2)
    expect(result.tasks.find((task) => task.actionType === 'review')?.selected).toBe(true)
    expect(result.tasks.find((task) => task.actionType === 'send')?.selected).toBe(false)
  })

  it('promotes an explicit historical requirement but keeps it superseded and unselected', async () => {
    const { index, result } = await form('旧通知要求周三提交延期申请。最新更正：该安排取消，改为周四填写延期申请。', (scopeIndex) => candidate(scopeIndex, [
      directive(scopeIndex, 3, '填写', '延期申请', 'fill'),
    ], [
      observation(scopeIndex, 0, '旧通知'),
      observation(scopeIndex, 2, '该安排'),
    ]))
    expect(validateLocalTaskFormation(result, index)).toEqual([])
    expect(result.tasks).toHaveLength(2)
    expect(result.tasks[0]).toMatchObject({ action: { surface: '提交' }, semantics: { status: 'cancelled', validity: 'superseded' }, selected: false })
    expect(result.tasks[1].revisionRefs[0]).toMatchObject({ type: 'supersedes', targetTaskId: result.tasks[0].id })
    expect(result.tasks[1].selected).toBe(true)
  })
})

describe('RCO-5-007 authority and adversarial properties', () => {
  it('drops every model-owned decision field before local formation', async () => {
    const index = await indexImmutableScopes('source-test', 'source-v1', '请在本机核对名单。')
    const original = candidate(index, [directive(index, 0, '核对', '名单', 'review')])
    const hostile = structuredClone(original)
    hostile.requiresAction = true
    hostile.directives[0].semantics = {
      actor: 'third_party', speechAct: 'quoted', polarity: 'negative', tense: 'past', status: 'completed', validity: 'superseded', modality: 'optional',
    }
    hostile.directives[0].effect = 'external_transfer'
    hostile.directives[0].inferenceLevel = 'optional_suggestion'
    expect(reduceModelCandidate(hostile)).toEqual(reduceModelCandidate(original))
    const reduced = reduceModelCandidate(hostile)
    expect(Object.keys(reduced.directives[0])).not.toEqual(expect.arrayContaining(['semantics', 'effect', 'inferenceLevel', 'selected']))
    expect(Object.keys(reduced)).not.toEqual(expect.arrayContaining(['requiresAction', 'selected']))
  })

  it('is invariant to model directive order for same-scope compound actions', async () => {
    const index = await indexImmutableScopes('source-test', 'source-v1', '请检查日期并保存草稿。')
    const first = directive(index, 0, '检查', '日期', 'review')
    const second = directive(index, 0, '保存', '草稿', 'save')
    const left = formLocalTaskSuggestions(index, reduceModelCandidate(candidate(index, [first, second])))
    const right = formLocalTaskSuggestions(index, reduceModelCandidate(candidate(index, [second, first])))
    expect(left.tasks.map(({ action, object, selected }) => ({ action, object, selected })))
      .toEqual(right.tasks.map(({ action, object, selected }) => ({ action, object, selected })))
  })

  it('repairs an unsupported object hint without borrowing evidence from another scope', async () => {
    const { index, result } = await form('预约草稿已保存。暂勿提交。', (scopeIndex) => candidate(scopeIndex, [
      directive(scopeIndex, 1, '提交', '预约草稿', 'submit'),
    ]))
    expect(result.tasks[0].object).toEqual({ scopeId: index.scopes[1].id, surface: '提交' })
    expect(validateLocalTaskFormation(result, index)).toEqual([])
    expect(result.tasks[0].selected).toBe(false)
  })

  it('detects a tampered external default and a tampered requiresAction value', async () => {
    const { index, result } = await form('请提交申请。', (scopeIndex) => candidate(scopeIndex, [directive(scopeIndex, 0, '提交', '申请', 'submit')]))
    result.tasks[0].selected = true
    result.requiresAction = false
    expect(validateLocalTaskFormation(result, index).map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'SELECTED_NOT_POLICY_DERIVED', 'FORBIDDEN_EXTERNAL_DEFAULT', 'REQUIRES_ACTION_NOT_DERIVED',
    ]))
  })
})
