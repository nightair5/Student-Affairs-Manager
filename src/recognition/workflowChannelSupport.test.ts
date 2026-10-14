import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { projectFactRole } from './factRoleContract'
import { projectTaskRequirements } from './taskRequirementsContract'
import { projectRoleAuthority } from './sourceContractV7'
import { projectWorkflowChannelSupport, verifyWorkflowChannelEvidence } from './workflowChannelSupport'

const root = 'docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/current-mechanism-followup/qualification-association-followup/real-notice-fact-role/'

describe('existing channel authority in bounded digital workflow', () => {
  it('derives only the declared RN02 channel citations without changing raw facts, personal state, dependencies or materials', async () => {
    const source = JSON.parse(readFileSync(root + 'SOURCES.json', 'utf8')).sources[1]
    const raw = JSON.parse(readFileSync(root + 'observed/raw-02.json', 'utf8')).rawHttpText
    const envelope = JSON.parse(raw), facts = JSON.parse(envelope.output[0].content[0].text)
    const context = { index: await indexImmutableScopesV11(source.sourceId, source.sourceVersionId, source.sourceText),
      referenceTime: source.referenceTime, timezone: source.timezone }
    const role = projectTaskRequirements(projectFactRole(facts, context).projected, context).projected
    const untouched = structuredClone(role), before = projectRoleAuthority(role, context, true)
    expect(before.audit.localChannels.quarantinedChannels).toHaveLength(4)
    const result = projectWorkflowChannelSupport(role, context)
    expect(role).toEqual(untouched)
    expect(result.audit.decisions.filter(d => d.status === 'DERIVED_WORKFLOW_SUPPORT')).toHaveLength(4)
    expect(projectRoleAuthority(result.projected, context, true).audit.localChannels.quarantinedChannels).toHaveLength(0)
    expect(result.projected.materials).toEqual(role.materials)
    expect(result.projected.tasks.map(t => [t.condition, t.detail.dependencyTempIds])).toEqual(role.tasks.map(t => [t.condition, t.detail.dependencyTempIds]))
    expect(result.audit.materialSupport).toHaveLength(1)
    expect(result.audit.materialSupport[0]).toMatchObject({ materialId: 'material-receipt', ownerTaskIds: ['task-upload-receipt'],
      channel: '厦门大学学工系统https://xmuxg.xmu.edu.cn/app/515' })
    expect(result.audit.materialSupport[0].workflowText).toContain('并上传贷款机构提供的回执材料照片或截图')
    expect(JSON.parse(raw)).toEqual(envelope)
  })
  it.each([
    ['请登录甲业务系统，选择资助业务期，填写申请信息，并上传本学年回执。', '上传本学年回执', '本学年回执', true],
    ['登录若水系统，点击申请模块，准确填写登记信息。', '准确填写登记信息', '登记信息', true],
    ['登录甲业务系统查询余额。请上传本学年回执。', '上传本学年回执', '本学年回执', false],
    ['登录甲业务系统，点击查询模块，并上传本学年回执至乙门户。', '上传本学年回执', '本学年回执', false],
    ['登录甲业务系统，点击查询模块，并上传本学年回执照片。', '上传本学年回执', '本学年回执', false],
    ['登录甲业务系统，点击查询模块，并上传本学年回执，但不得上传本学年回执。', '并上传本学年回执', '本学年回执', false],
    ['登录甲业务系统，点击查询模块，并上传本学年回执，但不要使用甲业务系统。', '上传本学年回执', '本学年回执', false],
    ['登录甲业务系统，点击查询模块，并上传本学年回执，但不得使用该系统。', '上传本学年回执', '本学年回执', false],
    ['登录甲业务系统，点击查询模块，并上传本学年回执，但不得通过甲业务系统提交活动照片。', '上传本学年回执', '本学年回执', true],
    ['登录甲业务系统，点击查询模块，并上传本学年回执。不得通过甲业务系统提交活动照片。', '上传本学年回执', '本学年回执', true],
    ['登录甲业务系统查看接收回执，回执材料另交学院窗口。', '回执材料另交学院窗口', '回执材料', false],
    ['登录甲业务系统，选择资助业务期，不要上传本学年回执。', '上传本学年回执', '本学年回执', false],
    ['如果登录甲业务系统，选择资助业务期，并上传本学年回执。', '上传本学年回执', '本学年回执', false],
    ['登录甲业务系统，填写申请信息，现场携带回执到服务台，并上传本学年回执。', '上传本学年回执', '本学年回执', false],
    ['登录甲业务系统，选择资助业务期；上传本学年回执。', '上传本学年回执', '本学年回执', false],
    ['甲业务系统显示已收到回执，选择资助业务期，并上传本学年回执。', '上传本学年回执', '本学年回执', false],
  ])('checks independent expression %s', (sourceText, actionSurface, objectSurface, accepted) => {
    const channel = sourceText.includes('若水系统') ? '若水系统' : '甲业务系统'
    const channelQuote = sourceText.slice(0, sourceText.indexOf('，') + 1) || sourceText
    const result = verifyWorkflowChannelEvidence({ sourceText, channel, channelQuotes: [channelQuote],
      taskQuotes: [sourceText], actionSurface, objectSurface })
    expect(Boolean(result)).toBe(accepted)
  })
  it('does not accept absent citations, a borrowed object or forged workflow proof', () => {
    const sourceText = '登录甲业务系统，选择业务期，并上传本学年回执。'
    const input = { sourceText, channel: '甲业务系统', channelQuotes: ['登录甲业务系统，'],
      taskQuotes: ['并上传本学年回执。'], actionSurface: '上传本学年回执', objectSurface: '本学年回执' }
    expect(verifyWorkflowChannelEvidence(input)).not.toBeNull()
    expect(verifyWorkflowChannelEvidence({ ...input, channelQuotes: ['登录乙业务系统，'] })).toBeNull()
    expect(verifyWorkflowChannelEvidence({ ...input, objectSurface: '缴费凭证' })).toBeNull()
    expect(verifyWorkflowChannelEvidence({ ...input, channel: '乙业务系统' })).toBeNull()
  })
  it.each([
    ['登录甲业务系统，选择资助业务期，并上传本学年回执，但请改用乙门户提交本学年回执。', false],
    ['登录甲业务系统，选择资助业务期，并上传本学年回执，提交渠道为乙门户。', false],
    ['登录甲业务系统，选择资助业务期，并上传本学年回执（上传至乙门户）。', false],
    ['登录甲业务系统，选择资助业务期，并上传本学年回执，但请改用乙门户提交活动照片。', true],
    ['登录甲业务系统，选择资助业务期，并上传本学年回执，活动照片的提交渠道为乙门户。', true],
    ['登录甲业务系统，选择资助业务期，并上传本学年回执，另将活动照片上传至乙门户。', true],
    ['登录甲业务系统，选择资助业务期，并上传本学年回执（活动照片上传至乙门户）。', true],
    ['登录甲业务系统，选择资助业务期，并上传本学年回执，“本学年回执”的提交渠道为乙门户。', false],
    ['登录甲业务系统，选择资助业务期，并上传本学年回执，提交渠道为甲业务系统。', true],
  ])('reviews the complete channel authority interval with narrow action citations: %s', (sourceText, accepted) => {
    const proof = verifyWorkflowChannelEvidence({ sourceText, channel: '甲业务系统',
      channelQuotes: ['登录甲业务系统，'], taskQuotes: ['并上传本学年回执'],
      actionSurface: '上传本学年回执', objectSurface: '本学年回执' })
    expect(Boolean(proof)).toBe(accepted)
    if (proof) expect(proof.end).toBe(sourceText.indexOf('。'))
  })
  it('leaves an unknown scope and an absent material channel unprojected', async () => {
    const source = JSON.parse(readFileSync(root + 'SOURCES.json', 'utf8')).sources[1]
    const raw = JSON.parse(readFileSync(root + 'observed/raw-02.json', 'utf8')).rawHttpText
    const facts = JSON.parse(JSON.parse(raw).output[0].content[0].text)
    const context = { index: await indexImmutableScopesV11(source.sourceId, source.sourceVersionId, source.sourceText),
      referenceTime: source.referenceTime, timezone: source.timezone }
    const role = projectTaskRequirements(projectFactRole(facts, context).projected, context).projected
    role.tasks[3].executionChannel!.scopeIds = ['foreign-source-id']
    role.materials[0].submissionChannel = null
    const result = projectWorkflowChannelSupport(role, context)
    expect(result.audit.decisions.find(d => d.taskId === role.tasks[3].id)?.status).toBe('NOT_PROVEN')
    expect(result.projected.tasks[3].propositionScopeIds).toEqual(role.tasks[3].propositionScopeIds)
    expect(result.audit.materialSupport).toHaveLength(0)
    expect(result.projected.materials[0].submissionChannel).toBeNull()
  })
})
