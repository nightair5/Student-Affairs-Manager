import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B6_CHALLENGE_DATASET.json')
const required = { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' }
const groupRequired = { ...required, actor: 'addressed_group' }
const superseded = { ...required, polarity: 'negative', tense: 'past', status: 'cancelled', validity: 'superseded' }
const negative = { ...required, polarity: 'negative', status: 'cancelled' }
const info = { actor: 'issuer', speechAct: 'assertive', polarity: 'affirmative', tense: 'present', status: 'pending', validity: 'active', modality: 'informational' }
const S = (scopeText, surface) => ({ scopeText, surface })
const D = ({ id, scopes, action, object, actionType, effect, semantics = required, selected = false, timeRefs = [], materialRefs = [], locationRef = null }) => ({ expectedId: id, propositionScopeTexts: scopes, semantics, inferenceLevel: 'explicit', actionType, action, object, effect, timeRefs, materialRefs, eventRef: null, locationRef, revisionRefs: [], expectedDefaultSelected: selected })
const O = ({ id, kind = 'information', scopes, subject, semantics = info, timeRefs = [], locationRef = null }) => ({ expectedId: id, kind, propositionScopeTexts: scopes, semantics, inferenceLevel: 'explicit', subject, timeRefs, locationRef })
const R = (kind, targetExpectedId, replacementExpectedIds, evidenceScopeTexts, resolution, referentType) => ({ kind, targetExpectedId, replacementExpectedIds, evidenceScopeTexts, resolution, referentType })
const C = (id, semanticFamilyId, coverageTags, sourceTitle, sourceText, directives, observations = [], requiresAction = true, forbiddenDefaultSurfaces = [], ignoredScopeTexts = [], revisionRelations = [], unresolvedRevisionScopeTexts = []) => ({ id, semanticFamilyId, coverageTags, sourceTitle, sourceText, referenceTime: '2026-09-04T22:05:00+08:00', timezone: 'Asia/Shanghai', expected: { requiresAction, directives, observations, ignoredScopeTexts, forbiddenDefaultSurfaces, revisionRelations, unresolvedRevisionScopeTexts } })

const cases = [
  C('rco-task-b6-01', 'prior-version-process-cancelled-without-replacement', ['revision', 'cancels', 'adjacent_referent'], '审批流程废止',
    '上一版流程要求提交纸质审批单。该流程自今日起废止。', [D({ id: 'd-old-submit-approval', scopes: ['上一版流程要求提交纸质审批单。'], action: S('上一版流程要求提交纸质审批单。', '提交'), object: S('上一版流程要求提交纸质审批单。', '纸质审批单'), actionType: 'submit', effect: 'external_transfer', semantics: superseded })], [], false, ['提交纸质审批单'], ['该流程自今日起废止。'], [R('cancels', 'd-old-submit-approval', [], ['上一版流程要求提交纸质审批单。', '该流程自今日起废止。'], 'adjacent_unique_referent', '流程')]),
  C('rco-task-b6-02', 'earlier-task-terminated-by-shared-status', ['revision', 'cancels', 'shared_scope'], '场地联络终止',
    '早先任务要求联系场地管理员。现确认此任务终止执行。', [D({ id: 'd-old-contact-venue', scopes: ['早先任务要求联系场地管理员。', '现确认此任务终止执行。'], action: S('早先任务要求联系场地管理员。', '联系'), object: S('早先任务要求联系场地管理员。', '场地管理员'), actionType: 'contact', effect: 'external_interaction', semantics: superseded })], [], false, ['联系场地管理员'], [], [R('cancels', 'd-old-contact-venue', [], ['早先任务要求联系场地管理员。', '现确认此任务终止执行。'], 'shared_scope', '任务')]),
  C('rco-task-b6-03', 'old-plan-invalid-and-replacement-save', ['revision', 'supersedes', 'active_replacement'], '座位表版本替换',
    '原先方案须发送旧版座位表。该方案现已失效。替代要求为保存新版座位表。', [
      D({ id: 'd-old-send-seats', scopes: ['原先方案须发送旧版座位表。', '该方案现已失效。'], action: S('原先方案须发送旧版座位表。', '发送'), object: S('原先方案须发送旧版座位表。', '旧版座位表'), actionType: 'send', effect: 'external_transfer', semantics: superseded }),
      D({ id: 'd-save-new-seats', scopes: ['替代要求为保存新版座位表。'], action: S('替代要求为保存新版座位表。', '保存'), object: S('替代要求为保存新版座位表。', '新版座位表'), actionType: 'save', effect: 'local_change', selected: true }),
    ], [], true, ['发送旧版座位表'], [], [R('supersedes', 'd-old-send-seats', ['d-save-new-seats'], ['原先方案须发送旧版座位表。', '该方案现已失效。', '替代要求为保存新版座位表。'], 'shared_scope', '方案')]),
  C('rco-task-b6-04', 'existing-rule-invalid-current-review', ['revision', 'supersedes', 'cross_sentence_reference'], '录音规则替换',
    '既有规则要求上传原始录音。前述规则不再生效。当前要求是核对录音编号。', [
      D({ id: 'd-old-upload-audio', scopes: ['既有规则要求上传原始录音。', '前述规则不再生效。'], action: S('既有规则要求上传原始录音。', '上传'), object: S('既有规则要求上传原始录音。', '原始录音'), actionType: 'upload', effect: 'external_transfer', semantics: superseded }),
      D({ id: 'd-review-audio-number', scopes: ['当前要求是核对录音编号。'], action: S('当前要求是核对录音编号。', '核对'), object: S('当前要求是核对录音编号。', '录音编号'), actionType: 'review', effect: 'local_change', selected: true }),
    ], [], true, ['上传原始录音'], [], [R('supersedes', 'd-old-upload-audio', ['d-review-audio-number'], ['既有规则要求上传原始录音。', '前述规则不再生效。', '当前要求是核对录音编号。'], 'shared_scope', '规则')]),
  C('rco-task-b6-05', 'paper-receipt-amended-to-electronic-upload', ['revision', 'amends', 'adjacent_referent'], '回执方式修改',
    '原条款要求提交纸质回执。现更改为上传电子回执。', [
      D({ id: 'd-old-submit-receipt', scopes: ['原条款要求提交纸质回执。'], action: S('原条款要求提交纸质回执。', '提交'), object: S('原条款要求提交纸质回执。', '纸质回执'), actionType: 'submit', effect: 'external_transfer', semantics: superseded }),
      D({ id: 'd-upload-electronic-receipt', scopes: ['现更改为上传电子回执。'], action: S('现更改为上传电子回执。', '上传'), object: S('现更改为上传电子回执。', '电子回执'), actionType: 'upload', effect: 'external_transfer' }),
    ], [], true, ['提交纸质回执', '上传电子回执'], [], [R('amends', 'd-old-submit-receipt', ['d-upload-electronic-receipt'], ['原条款要求提交纸质回执。', '现更改为上传电子回执。'], 'adjacent_unique_referent', null)]),
  C('rco-task-b6-06', 'contact-task-amended-to-local-record', ['revision', 'amends', 'local_replacement'], '值班任务调整',
    '原任务要求联系值班室。现调整为保存值班记录。', [
      D({ id: 'd-old-contact-duty-room', scopes: ['原任务要求联系值班室。'], action: S('原任务要求联系值班室。', '联系'), object: S('原任务要求联系值班室。', '值班室'), actionType: 'contact', effect: 'external_interaction', semantics: superseded }),
      D({ id: 'd-save-duty-record', scopes: ['现调整为保存值班记录。'], action: S('现调整为保存值班记录。', '保存'), object: S('现调整为保存值班记录。', '值班记录'), actionType: 'save', effect: 'local_change', selected: true }),
    ], [], true, ['联系值班室'], [], [R('amends', 'd-old-contact-duty-room', ['d-save-duty-record'], ['原任务要求联系值班室。', '现调整为保存值班记录。'], 'adjacent_unique_referent', null)]),
  C('rco-task-b6-07', 'ambiguous-generic-cancellation-fails-closed', ['revision', 'ambiguous', 'unresolved'], '两项旧要求待核对',
    '上一版要求上传甲清单。此前要求发送乙清单。上述要求取消。', [
      D({ id: 'd-upload-list-a', scopes: ['上一版要求上传甲清单。'], action: S('上一版要求上传甲清单。', '上传'), object: S('上一版要求上传甲清单。', '甲清单'), actionType: 'upload', effect: 'external_transfer' }),
      D({ id: 'd-send-list-b', scopes: ['此前要求发送乙清单。'], action: S('此前要求发送乙清单。', '发送'), object: S('此前要求发送乙清单。', '乙清单'), actionType: 'send', effect: 'external_transfer' }),
    ], [], true, ['上传甲清单', '发送乙清单'], ['上述要求取消。'], [], ['上述要求取消。']),
  C('rco-task-b6-08', 'non-task-cancellation-does-not-rewrite-current-duty', ['revision', 'non_task_cancellation', 'unresolved'], '茶歇变动与反馈',
    '本次安排取消了茶歇。请填写参会反馈。', [D({ id: 'd-fill-attendance-feedback', scopes: ['请填写参会反馈。'], action: S('请填写参会反馈。', '填写'), object: S('请填写参会反馈。', '参会反馈'), actionType: 'fill', effect: 'local_change', selected: true })], [], true, [], ['本次安排取消了茶歇。'], [], ['本次安排取消了茶歇。']),
  C('rco-task-b6-09', 'return-condition-currently-confirmed', ['conditional', 'complete_proposition', 'external_interaction'], '备用钥匙催还',
    '若备用钥匙仍未归还，请联系器材管理员。当前备用钥匙仍未归还。', [D({ id: 'd-contact-equipment-admin', scopes: ['若备用钥匙仍未归还，', '请联系器材管理员。', '当前备用钥匙仍未归还。'], action: S('请联系器材管理员。', '联系'), object: S('请联系器材管理员。', '器材管理员'), actionType: 'contact', effect: 'external_interaction' })], [], true, ['联系器材管理员']),
  C('rco-task-b6-10', 'award-member-object-does-not-change-actor', ['actor', 'object_fidelity', 'safe_default'], '证书编号核对',
    '请核对获奖成员的证书编号。', [D({ id: 'd-review-certificate-number', scopes: ['请核对获奖成员的证书编号。'], action: S('请核对获奖成员的证书编号。', '核对'), object: S('请核对获奖成员的证书编号。', '获奖成员的证书编号'), actionType: 'review', effect: 'local_change', selected: true })]),
  C('rco-task-b6-11', 'exhibition-staff-explicit-group', ['actor', 'addressed_group'], '布展清单保存',
    '参展人员须保存布展清单。', [D({ id: 'd-save-exhibition-list', scopes: ['参展人员须保存布展清单。'], action: S('参展人员须保存布展清单。', '保存'), object: S('参展人员须保存布展清单。', '布展清单'), actionType: 'save', effect: 'local_change', semantics: groupRequired })]),
  C('rco-task-b6-12', 'surface-implement-classified-as-upload', ['action_surface', 'external_transfer'], '系统材料上传',
    '请落实系统材料上传。', [D({ id: 'd-implement-system-upload', scopes: ['请落实系统材料上传。'], action: S('请落实系统材料上传。', '落实'), object: S('请落实系统材料上传。', '系统材料上传'), actionType: 'upload', effect: 'external_transfer' })], [], true, ['系统材料上传']),
  C('rco-task-b6-13', 'distinct-object-summary-and-print', ['compound_action', 'object_boundary'], '访谈材料整理',
    '请整理访谈摘要并打印签字页。', [
      D({ id: 'd-prepare-interview-summary', scopes: ['请整理访谈摘要并打印签字页。'], action: S('请整理访谈摘要并打印签字页。', '整理'), object: S('请整理访谈摘要并打印签字页。', '访谈摘要'), actionType: 'prepare', effect: 'local_change', selected: true }),
      D({ id: 'd-print-signature-page', scopes: ['请整理访谈摘要并打印签字页。'], action: S('请整理访谈摘要并打印签字页。', '打印'), object: S('请整理访谈摘要并打印签字页。', '签字页'), actionType: 'print', effect: 'physical_action', selected: true }),
    ]),
  C('rco-task-b6-14', 'briefing-event-and-preparation-task', ['event', 'time_role', 'local_action'], '安全说明会准备',
    '安全说明会将于11月6日9:00在实验楼举行。请提前准备问题记录表。', [D({ id: 'd-prepare-question-form', scopes: ['请提前准备问题记录表。'], action: S('请提前准备问题记录表。', '准备'), object: S('请提前准备问题记录表。', '问题记录表'), actionType: 'prepare', effect: 'local_change', selected: true })], [O({ id: 'o-safety-briefing', kind: 'event', scopes: ['安全说明会将于11月6日9:00在实验楼举行。'], subject: S('安全说明会将于11月6日9:00在实验楼举行。', '安全说明会'), semantics: { actor: 'unknown', speechAct: 'assertive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'informational' }, timeRefs: [{ ...S('安全说明会将于11月6日9:00在实验楼举行。', '11月6日9:00'), type: 'event_start' }], locationRef: S('安全说明会将于11月6日9:00在实验楼举行。', '实验楼') })]),
  C('rco-task-b6-15', 'optional-route-print-required-review', ['optional', 'mixed_modality'], '参观点位确认',
    '参访路线可自行打印；但请检查集合点编号。', [
      D({ id: 'd-optional-print-route', scopes: ['参访路线可自行打印；'], action: S('参访路线可自行打印；', '打印'), object: S('参访路线可自行打印；', '参访路线'), actionType: 'print', effect: 'physical_action', semantics: { ...groupRequired, modality: 'optional' } }),
      D({ id: 'd-review-meeting-number', scopes: ['但请检查集合点编号。'], action: S('但请检查集合点编号。', '检查'), object: S('但请检查集合点编号。', '集合点编号'), actionType: 'review', effect: 'local_change', selected: true }),
    ]),
  C('rco-task-b6-16', 'event-information-plus-explicit-mail-ban', ['event_only', 'negative', 'requires_action_false'], '作品导览说明',
    '作品导览将在周六上午于艺术中心开始。本次不得邮寄纸质照片。', [D({ id: 'd-no-mail-photos', scopes: ['本次不得邮寄纸质照片。'], action: S('本次不得邮寄纸质照片。', '邮寄'), object: S('本次不得邮寄纸质照片。', '纸质照片'), actionType: 'submit', effect: 'external_transfer', semantics: negative })], [O({ id: 'o-art-tour', kind: 'event', scopes: ['作品导览将在周六上午于艺术中心开始。'], subject: S('作品导览将在周六上午于艺术中心开始。', '作品导览'), semantics: { actor: 'unknown', speechAct: 'assertive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'informational' }, timeRefs: [{ ...S('作品导览将在周六上午于艺术中心开始。', '周六上午'), type: 'event_start' }], locationRef: S('作品导览将在周六上午于艺术中心开始。', '艺术中心') })], false, ['邮寄纸质照片']),
]

const output = { schemaVersion: 'rco-5-007-b6-challenge-1.0.0', datasetId: 'rco-5-007-b6-challenge-20260904', split: 'Development-Challenge', classification: 'anonymous_synthetic_codex_authored_pre_oracle_p3_challenge', seenStatus: 'UNSEEN_BY_P3_AT_FREEZE_AND_UNSEEN_BY_DEEPSEEK', createdAt: '2026-09-04T19:58:00+08:00', labelProvenance: 'Codex-authored reference labels; not independent human ground truth', contractSchemaVersion: 'scope-reference-candidate-1.0', scopeIndexVersion: 'scope-index-1.1', taskFormationPolicyVersion: 'task-formation-policy-2.3.0-p3', revisionResolverVersion: 'revision-relation-resolver-1.0.0', sampleCount: cases.length, cases }
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, sampleCount: cases.length }))
