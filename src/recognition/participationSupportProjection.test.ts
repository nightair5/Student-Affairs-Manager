import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { projectParticipationSupport } from './participationSupportProjection'
import { projectRoleAuthority, ROLE_AUTHORITY_VERSION, type RoleAuthorityFacts } from './sourceContractV7'
import { projectFactRole } from './factRoleContract'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { createRoleFixture } from '../experiments/candidate19Recorded/roleFixtures'

const root = 'docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/current-mechanism-followup/qualification-association-followup/real-notice-fact-role/'

async function actualRn03() {
  const sources = JSON.parse(readFileSync(root + 'SOURCES.json', 'utf8')).sources as Array<{ sourceId: string; sourceVersionId: string; sourceText: string; referenceTime: string; timezone: string }>
  const s = sources[2], context = { index: await indexImmutableScopesV11(s.sourceId, s.sourceVersionId, s.sourceText), referenceTime: s.referenceTime, timezone: s.timezone }
  const raw = (JSON.parse(readFileSync(root + 'observed/raw-03.json', 'utf8')) as { rawHttpText: string }).rawHttpText
  const envelope = JSON.parse(raw), facts = JSON.parse(envelope.output[0].content[0].text)
  const { requirements, ...rest } = projectFactRole(facts, context).projected
  void requirements // The parent decoder preserves and projects these separately.
  return { raw, context, input: { ...rest, schemaVersion: ROLE_AUTHORITY_VERSION } as RoleAuthorityFacts }
}

async function caseFixture(condition: string, mode: 'optional' | 'required' = 'optional', object = '青禾讲座') {
  const base = await createRoleFixture(), source = condition + '。请报名' + object + '。'
  const context = { ...base.context, index: await indexImmutableScopesV11('participation-fixture', 'participation-fixture-v1', source) }
  const input = structuredClone(base.facts), task = input.tasks[0]
  input.tasks = [task]
  task.propositionScopeIds = [context.index.scopes[1].id]
  task.action = { scopeId: context.index.scopes[1].id, surface: '报名' }
  task.object = { scopeId: context.index.scopes[1].id, surface: object }
  task.condition = { value: 'unknown', conditionScopeIds: [context.index.scopes[0].id], factScopeIds: [] }
  task.participation = { mode, scopeIds: [context.index.scopes[0].id] }
  task.executionChannel = null
  return { input, context }
}

describe('existing same-task participation condition supports a derived citation only', () => {
  it('real RN03 preserves the exact mode, unknown eligibility, raw and original input', async () => {
    const { raw, context, input } = await actualRn03(), before = structuredClone(input)
    expect(() => projectRoleAuthority(input, context, true)).toThrow('PARTICIPATION_EVIDENCE')
    const p = projectParticipationSupport(input, context)
    expect(input).toEqual(before)
    expect(p.audit.inferredFacts).toBe(0)
    expect(p.audit.decisions.map(d => d.addedScopeIds.length)).toEqual([1, 1])
    expect(p.projected.tasks.map(t => t.condition)).toEqual(input.tasks.map(t => t.condition))
    expect(p.projected.tasks.map(t => t.participation)).toEqual(input.tasks.map(t => t.participation))
    expect(p.projected.tasks).toHaveLength(2)
    expect(() => projectRoleAuthority(p.projected, context, true)).not.toThrow()
    expect((JSON.parse(readFileSync(root + 'observed/raw-03.json', 'utf8')) as { rawHttpText: string }).rawHttpText).toBe(raw)
    expect(projectParticipationSupport(p.projected, context).audit.decisions.every(d => d.reason === 'NO_MISSING_REFERENCE')).toBe(true)
  })
  it.each([
    ['满300分即可参与青禾讲座', 'optional', true],
    ['已录取者须报名青禾讲座', 'required', true],
    ['满300分可以报名青禾讲座', 'required', false],
    ['须报名青禾讲座', 'optional', false],
    ['满300分', 'optional', false],
    ['满300分不可参与青禾讲座', 'optional', false],
    ['并非不可参与青禾讲座', 'optional', false],
    ['是否可以报名青禾讲座', 'optional', false],
    ['不需要报名青禾讲座', 'required', false],
    ['无须报名青禾讲座', 'required', false],
    ['不一定需要报名青禾讲座', 'required', false],
    ['可以报名实验设备培训', 'optional', false],
    ['可以办理', 'optional', false],
    ['可以报名青禾讲座但不得报名青禾讲座', 'optional', false],
  ] as const)('distinguishes literal mode and object: %s/%s', async (condition, mode, supported) => {
    const { input, context } = await caseFixture(condition, mode)
    const p = projectParticipationSupport(input, context)
    expect(p.audit.decisions[0].addedScopeIds.length).toBe(supported ? 1 : 0)
    if (supported) expect(() => projectRoleAuthority(p.projected, context)).not.toThrow('PARTICIPATION_EVIDENCE')
    else expect(() => projectRoleAuthority(p.projected, context)).toThrow('PARTICIPATION_EVIDENCE')
  })
  it('retains missing/cross-task references and does not invent unknown participation', async () => {
    for (const kind of ['missing', 'other-task-condition', 'unknown'] as const) {
      const { input, context } = await caseFixture('可以报名青禾讲座')
      if (kind === 'missing') input.tasks[0].participation.scopeIds = ['other-source-scope']
      if (kind === 'other-task-condition') input.tasks[0].condition.conditionScopeIds = []
      if (kind === 'unknown') input.tasks[0].participation.mode = 'unknown'
      const p = projectParticipationSupport(input, context)
      expect(p.projected).toEqual(input)
      expect(p.audit.decisions[0].addedScopeIds).toEqual([])
      expect(() => projectRoleAuthority(p.projected, context)).toThrow('PARTICIPATION_EVIDENCE')
    }
  })
  it('cannot borrow an explicit different object from background proposition text', async () => {
    const { input, context: before } = await caseFixture('满300分可以报名实验设备培训')
    const source = '满300分可以报名实验设备培训。请报名青禾讲座，并了解报名实验设备培训。'
    const context = { ...before, index: await indexImmutableScopesV11('participation-cross-object', 'participation-cross-object-v1', source) }
    const task = input.tasks[0]
    task.propositionScopeIds = context.index.scopes.slice(1).map(s => s.id)
    task.action.scopeId = task.object.scopeId = context.index.scopes[1].id
    task.condition.conditionScopeIds = task.participation.scopeIds = [context.index.scopes[0].id]
    const p = projectParticipationSupport(input, context)
    expect(p.projected).toEqual(input)
    expect(p.audit.decisions[0].reason).toBe('UNSUPPORTED_REFERENCE_RETAINED')
    expect(() => projectRoleAuthority(p.projected, context)).toThrow('PARTICIPATION_EVIDENCE')
  })
  it.each(['并了解兑换', '实验设备兑换时间：'])('bare service permission cannot borrow an unbound handling mention: %s', async background => {
    const { input, context: before } = await caseFixture('满300分可以参与兑换')
    const source = '满300分可以参与兑换。请报名青禾讲座。' + background + '。'
    const context = { ...before, index: await indexImmutableScopesV11('participation-unbound-service', 'participation-unbound-service-v1', source) }
    const task = input.tasks[0]
    task.propositionScopeIds = context.index.scopes.slice(1).map(s => s.id)
    task.action.scopeId = task.object.scopeId = context.index.scopes[1].id
    task.condition.conditionScopeIds = task.participation.scopeIds = [context.index.scopes[0].id]
    const p = projectParticipationSupport(input, context)
    expect(p.projected).toEqual(input)
    expect(() => projectRoleAuthority(p.projected, context)).toThrow('PARTICIPATION_EVIDENCE')
  })
})
