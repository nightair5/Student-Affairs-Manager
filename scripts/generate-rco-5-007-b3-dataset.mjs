import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B3_CHALLENGE_DATASET.json')
const required = { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' }
const groupRequired = { ...required, actor: 'addressed_group' }
const negative = { ...required, polarity: 'negative', status: 'cancelled' }
const groupNegative = { ...negative, actor: 'addressed_group' }
const uncertain = { ...required, speechAct: 'hypothetical', polarity: 'uncertain', status: 'unknown', validity: 'uncertain' }
const info = { actor: 'issuer', speechAct: 'assertive', polarity: 'affirmative', tense: 'present', status: 'pending', validity: 'active', modality: 'informational' }
const S = (scopeText, surface) => ({ scopeText, surface })
const D = ({ id, scopes, action, object, actionType, effect, semantics = required, selected = false, timeRefs = [], materialRefs = [], locationRef = null, revisionRefs = [], inferenceLevel = 'explicit' }) => ({
  expectedId: id, propositionScopeTexts: scopes, semantics, inferenceLevel, actionType, action, object, effect,
  timeRefs, materialRefs, eventRef: null, locationRef, revisionRefs, expectedDefaultSelected: selected,
})
const O = ({ id, kind = 'information', scopes, subject, semantics = info, timeRefs = [], locationRef = null }) => ({
  expectedId: id, kind, propositionScopeTexts: scopes, semantics, inferenceLevel: 'explicit', subject, timeRefs, locationRef,
})
const C = (id, semanticFamilyId, coverageTags, sourceTitle, sourceText, directives, observations = [], requiresAction = true, forbiddenDefaultSurfaces = [], ignoredScopeTexts = []) => ({
  id, semanticFamilyId, coverageTags, sourceTitle, sourceText, referenceTime: '2026-09-04T18:00:00+08:00', timezone: 'Asia/Shanghai',
  expected: { requiresAction, directives, observations, ignoredScopeTexts, forbiddenDefaultSurfaces },
})

const cases = [
  C('rco-task-b3-01', 'superseded-transfer-replaced-by-local-review', ['revision', 'historical', 'local_replacement'], '旧要求替换',
    '原安排要求上传住宿申请，现已作废。最新要求是核对申请中的房间号。', [
      D({ id: 'd-old-upload', scopes: ['原安排要求上传住宿申请，', '现已作废。'], action: S('原安排要求上传住宿申请，', '上传'), object: S('原安排要求上传住宿申请，', '住宿申请'), actionType: 'upload', effect: 'external_transfer', semantics: { ...negative, tense: 'past', validity: 'superseded' } }),
      D({ id: 'd-review-room', scopes: ['最新要求是核对申请中的房间号。'], action: S('最新要求是核对申请中的房间号。', '核对'), object: S('最新要求是核对申请中的房间号。', '房间号'), actionType: 'review', effect: 'local_change', selected: true }),
    ], [], true, ['上传住宿申请']),
  C('rco-task-b3-02', 'permission-precedes-separate-obligation', ['permission', 'required', 'external_transfer'], '成果展示许可',
    '展示海报可以自行保存副本，但最终版本必须提交至学院系统。', [
      D({ id: 'd-optional-save', scopes: ['展示海报可以自行保存副本，'], action: S('展示海报可以自行保存副本，', '保存'), object: S('展示海报可以自行保存副本，', '副本'), actionType: 'save', effect: 'local_change', semantics: { ...groupRequired, modality: 'optional' } }),
      D({ id: 'd-submit-final', scopes: ['但最终版本必须提交至学院系统。'], action: S('但最终版本必须提交至学院系统。', '提交'), object: S('但最终版本必须提交至学院系统。', '最终版本'), actionType: 'submit', effect: 'external_transfer' }),
    ], [], true, ['保存副本', '提交至学院系统']),
  C('rco-task-b3-03', 'prohibition-plus-distinct-local-duty', ['negative', 'external_transfer', 'local_action'], '名单保密处理',
    '不得把成员名单发送到群聊。请在本机检查名单中的重复姓名。', [
      D({ id: 'd-no-send', scopes: ['不得把成员名单发送到群聊。'], action: S('不得把成员名单发送到群聊。', '发送'), object: S('不得把成员名单发送到群聊。', '成员名单'), actionType: 'send', effect: 'external_transfer', semantics: negative }),
      D({ id: 'd-check-duplicates', scopes: ['请在本机检查名单中的重复姓名。'], action: S('请在本机检查名单中的重复姓名。', '检查'), object: S('请在本机检查名单中的重复姓名。', '重复姓名'), actionType: 'review', effect: 'local_change', selected: true, locationRef: S('请在本机检查名单中的重复姓名。', '本机') }),
    ], [], true, ['发送到群聊']),
  C('rco-task-b3-04', 'membership-exception-opposite-duties', ['exception', 'addressed_group', 'negative', 'required'], '成员信息补录',
    '旁听人员不用填写紧急联系人；正式成员请填写紧急联系人。', [
      D({ id: 'd-auditor-no-fill', scopes: ['旁听人员不用填写紧急联系人；'], action: S('旁听人员不用填写紧急联系人；', '填写'), object: S('旁听人员不用填写紧急联系人；', '紧急联系人'), actionType: 'fill', effect: 'local_change', semantics: groupNegative }),
      D({ id: 'd-member-fill', scopes: ['正式成员请填写紧急联系人。'], action: S('正式成员请填写紧急联系人。', '填写'), object: S('正式成员请填写紧急联系人。', '紧急联系人'), actionType: 'fill', effect: 'local_change', semantics: groupRequired }),
    ], [], true, []),
  C('rco-task-b3-05', 'completed-prior-output-new-distinct-followups', ['completed', 'compound_action', 'distinct_objects'], '签到表后续检查',
    '签到表已打印完成。现在请核对缺席栏并保存更正备注。', [
      D({ id: 'd-review-absence', scopes: ['现在请核对缺席栏并保存更正备注。'], action: S('现在请核对缺席栏并保存更正备注。', '核对'), object: S('现在请核对缺席栏并保存更正备注。', '缺席栏'), actionType: 'review', effect: 'local_change', selected: true }),
      D({ id: 'd-save-note', scopes: ['现在请核对缺席栏并保存更正备注。'], action: S('现在请核对缺席栏并保存更正备注。', '保存'), object: S('现在请核对缺席栏并保存更正备注。', '更正备注'), actionType: 'save', effect: 'local_change', selected: true }),
    ], [O({ id: 'o-roster-printed', scopes: ['签到表已打印完成。'], subject: S('签到表已打印完成。', '签到表'), semantics: { ...info, tense: 'past', status: 'completed' } })]),
  C('rco-task-b3-06', 'trigger-restated-with-current-fact', ['conditional', 'trigger_satisfied', 'external_interaction'], '门锁异常处置',
    '如门锁无法闭合，请联系物业前台。事实是门锁现在无法闭合。', [
      D({ id: 'd-contact-property', scopes: ['如门锁无法闭合，', '请联系物业前台。', '事实是门锁现在无法闭合。'], action: S('请联系物业前台。', '联系'), object: S('请联系物业前台。', '物业前台'), actionType: 'contact', effect: 'external_interaction' }),
    ], [], true, ['联系物业前台']),
  C('rco-task-b3-07', 'future-condition-without-present-trigger', ['conditional', 'trigger_unknown', 'no_current_action'], '证明生效条件',
    '当证明加盖公章时，再上传证明扫描件。目前尚未收到盖章件。', [
      D({ id: 'd-upload-if-stamped', scopes: ['当证明加盖公章时，', '再上传证明扫描件。'], action: S('再上传证明扫描件。', '上传'), object: S('再上传证明扫描件。', '证明扫描件'), actionType: 'upload', effect: 'external_transfer', semantics: uncertain }),
    ], [O({ id: 'o-no-stamped-copy', scopes: ['目前尚未收到盖章件。'], subject: S('目前尚未收到盖章件。', '盖章件'), semantics: { ...info, polarity: 'negative', status: 'unknown' } })], false, ['上传证明扫描件']),
  C('rco-task-b3-08', 'quoted-payment-decoy-with-required-draft', ['quoted', 'security_decoy', 'local_action'], '可疑短信留档',
    '短信写着“请马上缴费并发送付款截图”。该内容仅作风险样例。请整理一份风险说明。', [
      D({ id: 'd-prepare-risk-note', scopes: ['请整理一份风险说明。'], action: S('请整理一份风险说明。', '整理'), object: S('请整理一份风险说明。', '风险说明'), actionType: 'prepare', effect: 'local_change', selected: true }),
    ], [O({ id: 'o-risk-quote', scopes: ['短信写着“请马上缴费并发送付款截图”。'], subject: S('短信写着“请马上缴费并发送付款截图”。', '缴费并发送付款截图'), semantics: { actor: 'third_party', speechAct: 'quoted', polarity: 'affirmative', tense: 'present', status: 'unknown', validity: 'uncertain', modality: 'informational' } })], true, ['缴费', '发送付款截图'], ['该内容仅作风险样例。']),
  C('rco-task-b3-09', 'external-looking-nouns-inside-local-objects', ['object_fidelity', 'false_external_keyword', 'compound_action'], '表格本机整理',
    '请核对报名表并保存联系人表。', [
      D({ id: 'd-review-registration-form', scopes: ['请核对报名表并保存联系人表。'], action: S('请核对报名表并保存联系人表。', '核对'), object: S('请核对报名表并保存联系人表。', '报名表'), actionType: 'review', effect: 'local_change', selected: true }),
      D({ id: 'd-save-contact-form', scopes: ['请核对报名表并保存联系人表。'], action: S('请核对报名表并保存联系人表。', '保存'), object: S('请核对报名表并保存联系人表。', '联系人表'), actionType: 'save', effect: 'local_change', selected: true }),
    ]),
  C('rco-task-b3-10', 'nominalized-external-payment-duty', ['external_interaction', 'action_type_authority', 'requires_action_without_default'], '场地费用办理',
    '本周内须办理线上缴费。', [
      D({ id: 'd-pay-online', scopes: ['本周内须办理线上缴费。'], action: S('本周内须办理线上缴费。', '办理'), object: S('本周内须办理线上缴费。', '线上缴费'), actionType: 'pay', effect: 'external_interaction', timeRefs: [{ ...S('本周内须办理线上缴费。', '本周内'), type: 'task_deadline' }] }),
    ], [], true, ['线上缴费']),
  C('rco-task-b3-11', 'same-object-review-save-chain', ['compound_action', 'same_object', 'local_action'], '会议纪要整理',
    '请检查会议纪要，确认无误后保存会议纪要。', [
      D({ id: 'd-check-minutes', scopes: ['请检查会议纪要，', '确认无误后保存会议纪要。'], action: S('请检查会议纪要，', '检查'), object: S('请检查会议纪要，', '会议纪要'), actionType: 'review', effect: 'local_change', selected: true }),
    ]),
  C('rco-task-b3-12', 'event-and-later-registration-deadline', ['event', 'time_role', 'external_interaction'], '培训报名安排',
    '安全培训在11月6日09:30于南楼举行。参加人员须在11月3日18:00前报名。', [
      D({ id: 'd-register-training', scopes: ['参加人员须在11月3日18:00前报名。'], action: S('参加人员须在11月3日18:00前报名。', '报名'), object: S('参加人员须在11月3日18:00前报名。', '参加人员'), actionType: 'register', effect: 'external_interaction', semantics: groupRequired, timeRefs: [{ ...S('参加人员须在11月3日18:00前报名。', '11月3日18:00'), type: 'registration_deadline' }] }),
    ], [O({ id: 'o-training-event', kind: 'event', scopes: ['安全培训在11月6日09:30于南楼举行。'], subject: S('安全培训在11月6日09:30于南楼举行。', '安全培训'), semantics: { actor: 'unknown', speechAct: 'assertive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'informational' }, timeRefs: [{ ...S('安全培训在11月6日09:30于南楼举行。', '11月6日09:30'), type: 'event_start' }], locationRef: S('安全培训在11月6日09:30于南楼举行。', '南楼') })], true, ['报名']),
  C('rco-task-b3-13', 'optional-attendance-required-local-preparation', ['optional', 'physical_action', 'local_action'], '开放日安排',
    '开放日可以自愿参加；但请提前准备个人介绍。', [
      D({ id: 'd-optional-attend', scopes: ['开放日可以自愿参加；'], action: S('开放日可以自愿参加；', '参加'), object: S('开放日可以自愿参加；', '开放日'), actionType: 'attend', effect: 'physical_action', semantics: { ...groupRequired, modality: 'optional' } }),
      D({ id: 'd-prepare-introduction', scopes: ['但请提前准备个人介绍。'], action: S('但请提前准备个人介绍。', '准备'), object: S('但请提前准备个人介绍。', '个人介绍'), actionType: 'prepare', effect: 'local_change', selected: true }),
    ], [], true, ['参加']),
  C('rco-task-b3-14', 'third-party-directive-report-versus-addressee-duty', ['third_party', 'reported_speech', 'local_action'], '教师要求转述',
    '老师让组长联系场地方，这是对组长的要求。你只需检查自己的行程表。', [
      D({ id: 'd-check-schedule', scopes: ['你只需检查自己的行程表。'], action: S('你只需检查自己的行程表。', '检查'), object: S('你只需检查自己的行程表。', '行程表'), actionType: 'review', effect: 'local_change', selected: true }),
    ], [O({ id: 'o-leader-contact', scopes: ['老师让组长联系场地方，', '这是对组长的要求。'], subject: S('老师让组长联系场地方，', '组长联系场地方'), semantics: { actor: 'third_party', speechAct: 'assertive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'informational' } })], true, ['联系场地方']),
  C('rco-task-b3-15', 'shared-source-for-two-of-three-actions', ['multi_task', 'shared_material_subset', 'explanation_ownership'], '档案摘要制作',
    '请填写活动摘要。请整理经费说明。前两项都要参照原始台账。另请保存座位草图。', [
      D({ id: 'd-fill-summary', scopes: ['请填写活动摘要。', '前两项都要参照原始台账。'], action: S('请填写活动摘要。', '填写'), object: S('请填写活动摘要。', '活动摘要'), actionType: 'fill', effect: 'local_change', selected: true, materialRefs: [{ ...S('前两项都要参照原始台账。', '原始台账'), required: true }] }),
      D({ id: 'd-prepare-budget-note', scopes: ['请整理经费说明。', '前两项都要参照原始台账。'], action: S('请整理经费说明。', '整理'), object: S('请整理经费说明。', '经费说明'), actionType: 'prepare', effect: 'local_change', selected: true, materialRefs: [{ ...S('前两项都要参照原始台账。', '原始台账'), required: true }] }),
      D({ id: 'd-save-seat-sketch', scopes: ['另请保存座位草图。'], action: S('另请保存座位草图。', '保存'), object: S('另请保存座位草图。', '座位草图'), actionType: 'save', effect: 'local_change', selected: true }),
    ]),
  C('rco-task-b3-16', 'event-only-with-explicit-registration-prohibition', ['event_only', 'negative', 'requires_action_false'], '公开展览说明',
    '成果展于周六下午在艺术中心开放。本场禁止现场报名。', [
      D({ id: 'd-no-onsite-register', scopes: ['本场禁止现场报名。'], action: S('本场禁止现场报名。', '报名'), object: S('本场禁止现场报名。', '现场报名'), actionType: 'register', effect: 'external_interaction', semantics: negative }),
    ], [O({ id: 'o-exhibition', kind: 'event', scopes: ['成果展于周六下午在艺术中心开放。'], subject: S('成果展于周六下午在艺术中心开放。', '成果展'), semantics: { actor: 'unknown', speechAct: 'assertive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'informational' }, timeRefs: [{ ...S('成果展于周六下午在艺术中心开放。', '周六下午'), type: 'event_start' }], locationRef: S('成果展于周六下午在艺术中心开放。', '艺术中心') })], false, ['现场报名']),
]

const output = {
  schemaVersion: 'rco-5-007-b3-challenge-1.0.0', datasetId: 'rco-5-007-b3-challenge-20260904', split: 'Development-Challenge',
  classification: 'anonymous_synthetic_codex_authored_pre_oracle_p1_challenge', seenStatus: 'UNSEEN_BY_P1_AT_FREEZE_AND_UNSEEN_BY_DEEPSEEK',
  createdAt: '2026-09-04T18:00:00+08:00', labelProvenance: 'Codex-authored reference labels; not independent human ground truth',
  contractSchemaVersion: 'scope-reference-candidate-1.0', scopeIndexVersion: 'scope-index-1.1', taskFormationPolicyVersion: 'task-formation-policy-2.1.0-p1',
  sampleCount: cases.length, cases,
}
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, sampleCount: cases.length }))
