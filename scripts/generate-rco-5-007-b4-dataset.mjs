import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B4_CHALLENGE_DATASET.json')
const required = { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' }
const groupRequired = { ...required, actor: 'addressed_group' }
const negative = { ...required, polarity: 'negative', status: 'cancelled' }
const uncertain = { ...required, speechAct: 'hypothetical', polarity: 'uncertain', status: 'unknown', validity: 'uncertain' }
const info = { actor: 'issuer', speechAct: 'assertive', polarity: 'affirmative', tense: 'present', status: 'pending', validity: 'active', modality: 'informational' }
const S = (scopeText, surface) => ({ scopeText, surface })
const D = ({ id, scopes, action, object, actionType, effect, semantics = required, selected = false, timeRefs = [], materialRefs = [], locationRef = null }) => ({ expectedId: id, propositionScopeTexts: scopes, semantics, inferenceLevel: 'explicit', actionType, action, object, effect, timeRefs, materialRefs, eventRef: null, locationRef, revisionRefs: [], expectedDefaultSelected: selected })
const O = ({ id, kind = 'information', scopes, subject, semantics = info, timeRefs = [], locationRef = null }) => ({ expectedId: id, kind, propositionScopeTexts: scopes, semantics, inferenceLevel: 'explicit', subject, timeRefs, locationRef })
const C = (id, semanticFamilyId, coverageTags, sourceTitle, sourceText, directives, observations = [], requiresAction = true, forbiddenDefaultSurfaces = [], ignoredScopeTexts = []) => ({ id, semanticFamilyId, coverageTags, sourceTitle, sourceText, referenceTime: '2026-09-04T19:30:00+08:00', timezone: 'Asia/Shanghai', expected: { requiresAction, directives, observations, ignoredScopeTexts, forbiddenDefaultSurfaces } })

const cases = [
  C('rco-task-b4-01', 'negative-looking-condition-confirmed-identically', ['conditional', 'complete_proposition', 'external_interaction'], '备用电源处置',
    '若备用电源仍未接通，请联系值班工程师。经确认备用电源仍未接通。', [D({ id: 'd-contact-engineer', scopes: ['若备用电源仍未接通，', '请联系值班工程师。', '经确认备用电源仍未接通。'], action: S('请联系值班工程师。', '联系'), object: S('请联系值班工程师。', '值班工程师'), actionType: 'contact', effect: 'external_interaction' })], [], true, ['联系值班工程师']),
  C('rco-task-b4-02', 'subject-internal-negation-keeps-condition-unmet', ['conditional', 'explicit_negation', 'requires_action_false'], '名单复核条件',
    '如果实验名单通过复核，再上传最终名单。实际情况是实验名单没有通过复核。', [D({ id: 'd-upload-after-review', scopes: ['如果实验名单通过复核，', '再上传最终名单。'], action: S('再上传最终名单。', '上传'), object: S('再上传最终名单。', '最终名单'), actionType: 'upload', effect: 'external_transfer', semantics: uncertain })], [O({ id: 'o-review-not-passed', scopes: ['实际情况是实验名单没有通过复核。'], subject: S('实际情况是实验名单没有通过复核。', '实验名单'), semantics: { ...info, polarity: 'negative', status: 'unknown' } })], false, ['上传最终名单']),
  C('rco-task-b4-03', 'people-words-in-two-local-objects', ['actor', 'object_fidelity', 'compound_action'], '报到名单检查',
    '请先检查报到人员清单，再保存异常人员说明。', [
      D({ id: 'd-check-arrivals', scopes: ['请先检查报到人员清单，'], action: S('请先检查报到人员清单，', '检查'), object: S('请先检查报到人员清单，', '报到人员清单'), actionType: 'review', effect: 'local_change', selected: true }),
      D({ id: 'd-save-exceptions', scopes: ['再保存异常人员说明。'], action: S('再保存异常人员说明。', '保存'), object: S('再保存异常人员说明。', '异常人员说明'), actionType: 'save', effect: 'local_change', selected: true }),
    ]),
  C('rco-task-b4-04', 'explicit-qualified-group-local-duty', ['actor', 'addressed_group', 'safe_default'], '领奖信息填写',
    '获奖成员须填写领奖信息。', [D({ id: 'd-fill-award-info', scopes: ['获奖成员须填写领奖信息。'], action: S('获奖成员须填写领奖信息。', '填写'), object: S('获奖成员须填写领奖信息。', '领奖信息'), actionType: 'fill', effect: 'local_change', semantics: groupRequired })]),
  C('rco-task-b4-05', 'surface-banli-classified-as-submit', ['action_surface', 'external_transfer', 'time'], '纸质备案递交',
    '请于周三前办理纸质材料递交。', [D({ id: 'd-handle-delivery', scopes: ['请于周三前办理纸质材料递交。'], action: S('请于周三前办理纸质材料递交。', '办理'), object: S('请于周三前办理纸质材料递交。', '纸质材料递交'), actionType: 'submit', effect: 'external_transfer', timeRefs: [{ ...S('请于周三前办理纸质材料递交。', '周三'), type: 'submission_deadline' }] })], [], true, ['纸质材料递交']),
  C('rco-task-b4-06', 'surface-bantuo-classified-as-pay', ['action_surface', 'external_interaction', 'requires_action_without_default'], '在线费用办理',
    '请在月底前办妥在线支付。', [D({ id: 'd-finish-payment', scopes: ['请在月底前办妥在线支付。'], action: S('请在月底前办妥在线支付。', '办妥'), object: S('请在月底前办妥在线支付。', '在线支付'), actionType: 'pay', effect: 'external_interaction', timeRefs: [{ ...S('请在月底前办妥在线支付。', '月底'), type: 'task_deadline' }] })], [], true, ['在线支付']),
  C('rco-task-b4-07', 'prior-notice-stopped-and-local-replacement', ['revision', 'lexical_novelty', 'local_replacement'], '名单要求变更',
    '此前通知要求发送获奖名单，该通知停止执行。现要求只核对奖项名称。', [
      D({ id: 'd-old-send-awards', scopes: ['此前通知要求发送获奖名单，', '该通知停止执行。'], action: S('此前通知要求发送获奖名单，', '发送'), object: S('此前通知要求发送获奖名单，', '获奖名单'), actionType: 'send', effect: 'external_transfer', semantics: { ...negative, tense: 'past', validity: 'superseded' } }),
      D({ id: 'd-review-award-name', scopes: ['现要求只核对奖项名称。'], action: S('现要求只核对奖项名称。', '核对'), object: S('现要求只核对奖项名称。', '奖项名称'), actionType: 'review', effect: 'local_change', selected: true }),
    ], [], true, ['发送获奖名单']),
  C('rco-task-b4-08', 'original-registration-revoked-new-preparation', ['revision', 'external_interaction', 'local_replacement'], '活动要求撤销',
    '原要求报名线下活动，现已撤销。最新要求是准备线上问答提纲。', [
      D({ id: 'd-old-register', scopes: ['原要求报名线下活动，', '现已撤销。'], action: S('原要求报名线下活动，', '报名'), object: S('原要求报名线下活动，', '线下活动'), actionType: 'register', effect: 'external_interaction', semantics: { ...negative, tense: 'past', validity: 'superseded' } }),
      D({ id: 'd-prepare-outline', scopes: ['最新要求是准备线上问答提纲。'], action: S('最新要求是准备线上问答提纲。', '准备'), object: S('最新要求是准备线上问答提纲。', '线上问答提纲'), actionType: 'prepare', effect: 'local_change', selected: true }),
    ], [], true, ['报名线下活动']),
  C('rco-task-b4-09', 'quoted-account-decoy-with-local-summary', ['quoted', 'security_decoy', 'local_action'], '账号安全示例',
    '公告示例写着“请注册账号并上传证件”。这不是本次要求。请保存安全提醒摘要。', [D({ id: 'd-save-security-summary', scopes: ['请保存安全提醒摘要。'], action: S('请保存安全提醒摘要。', '保存'), object: S('请保存安全提醒摘要。', '安全提醒摘要'), actionType: 'save', effect: 'local_change', selected: true })], [O({ id: 'o-account-quote', scopes: ['公告示例写着“请注册账号并上传证件”。'], subject: S('公告示例写着“请注册账号并上传证件”。', '注册账号并上传证件'), semantics: { actor: 'third_party', speechAct: 'quoted', polarity: 'affirmative', tense: 'present', status: 'unknown', validity: 'uncertain', modality: 'informational' } })], true, ['注册账号', '上传证件'], ['这不是本次要求。']),
  C('rco-task-b4-10', 'optional-print-and-required-carry', ['optional', 'physical_action', 'mixed_modality'], '参观入口准备',
    '参观手册可自行打印；但请携带校园卡到入口核验。', [
      D({ id: 'd-optional-print-guide', scopes: ['参观手册可自行打印；'], action: S('参观手册可自行打印；', '打印'), object: S('参观手册可自行打印；', '参观手册'), actionType: 'print', effect: 'physical_action', semantics: { ...groupRequired, modality: 'optional' } }),
      D({ id: 'd-carry-campus-card', scopes: ['但请携带校园卡到入口核验。'], action: S('但请携带校园卡到入口核验。', '携带'), object: S('但请携带校园卡到入口核验。', '校园卡'), actionType: 'carry', effect: 'physical_action', selected: true, materialRefs: [{ ...S('但请携带校园卡到入口核验。', '校园卡'), required: true }], locationRef: S('但请携带校园卡到入口核验。', '入口') }),
    ]),
  C('rco-task-b4-11', 'local-fill-plus-physical-sign-same-scope', ['compound_action', 'mixed_effect', 'same_scope'], '声明表处理',
    '请填写诚信声明并签名。', [
      D({ id: 'd-fill-declaration', scopes: ['请填写诚信声明并签名。'], action: S('请填写诚信声明并签名。', '填写'), object: S('请填写诚信声明并签名。', '诚信声明'), actionType: 'fill', effect: 'local_change', selected: true }),
      D({ id: 'd-sign-declaration', scopes: ['请填写诚信声明并签名。'], action: S('请填写诚信声明并签名。', '签名'), object: S('请填写诚信声明并签名。', '诚信声明'), actionType: 'sign', effect: 'physical_action' }),
    ], [], true, ['签名']),
  C('rco-task-b4-12', 'event-time-and-later-upload-deadline', ['event', 'time_role', 'external_transfer'], '作品评审安排',
    '作品评审于12月2日15:00在创新楼进行。电子作品须在11月29日20:00前上传。', [D({ id: 'd-upload-work', scopes: ['电子作品须在11月29日20:00前上传。'], action: S('电子作品须在11月29日20:00前上传。', '上传'), object: S('电子作品须在11月29日20:00前上传。', '电子作品'), actionType: 'upload', effect: 'external_transfer', timeRefs: [{ ...S('电子作品须在11月29日20:00前上传。', '11月29日20:00'), type: 'submission_deadline' }] })], [O({ id: 'o-review-event', kind: 'event', scopes: ['作品评审于12月2日15:00在创新楼进行。'], subject: S('作品评审于12月2日15:00在创新楼进行。', '作品评审'), semantics: { actor: 'unknown', speechAct: 'assertive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'informational' }, timeRefs: [{ ...S('作品评审于12月2日15:00在创新楼进行。', '12月2日15:00'), type: 'event_start' }], locationRef: S('作品评审于12月2日15:00在创新楼进行。', '创新楼') })], true, ['上传']),
  C('rco-task-b4-13', 'negative-looking-alarm-condition-confirmed-by-status', ['conditional', 'complete_proposition', 'external_transfer'], '报警记录上报',
    '当报警灯未熄灭时，请发送设备编号。现况是报警灯未熄灭。', [D({ id: 'd-send-device-id', scopes: ['当报警灯未熄灭时，', '请发送设备编号。', '现况是报警灯未熄灭。'], action: S('请发送设备编号。', '发送'), object: S('请发送设备编号。', '设备编号'), actionType: 'send', effect: 'external_transfer' })], [], true, ['发送设备编号']),
  C('rco-task-b4-14', 'reported-third-party-contact-and-own-local-check', ['third_party', 'reported_speech', 'actor'], '场地联络分工',
    '承办方要求工作人员联系保安室，这项工作不由你负责。你需要检查自己的到场时间。', [D({ id: 'd-check-arrival-time', scopes: ['你需要检查自己的到场时间。'], action: S('你需要检查自己的到场时间。', '检查'), object: S('你需要检查自己的到场时间。', '到场时间'), actionType: 'review', effect: 'local_change', selected: true })], [O({ id: 'o-staff-contact', scopes: ['承办方要求工作人员联系保安室，', '这项工作不由你负责。'], subject: S('承办方要求工作人员联系保安室，', '工作人员联系保安室'), semantics: { actor: 'third_party', speechAct: 'assertive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'informational' } })], true, ['联系保安室']),
  C('rco-task-b4-15', 'shared-template-for-first-and-third-actions', ['multi_task', 'shared_material_subset', 'explanation_ownership'], '评议材料整理',
    '请整理评议摘要。请打印签到页。另请填写反馈表。摘要和反馈表都参照会议记录。', [
      D({ id: 'd-prepare-review-summary', scopes: ['请整理评议摘要。', '摘要和反馈表都参照会议记录。'], action: S('请整理评议摘要。', '整理'), object: S('请整理评议摘要。', '评议摘要'), actionType: 'prepare', effect: 'local_change', selected: true, materialRefs: [{ ...S('摘要和反馈表都参照会议记录。', '会议记录'), required: true }] }),
      D({ id: 'd-print-signin', scopes: ['请打印签到页。'], action: S('请打印签到页。', '打印'), object: S('请打印签到页。', '签到页'), actionType: 'print', effect: 'physical_action', selected: true }),
      D({ id: 'd-fill-feedback', scopes: ['另请填写反馈表。', '摘要和反馈表都参照会议记录。'], action: S('另请填写反馈表。', '填写'), object: S('另请填写反馈表。', '反馈表'), actionType: 'fill', effect: 'local_change', selected: true, materialRefs: [{ ...S('摘要和反馈表都参照会议记录。', '会议记录'), required: true }] }),
    ]),
  C('rco-task-b4-16', 'event-only-with-explicit-upload-ban', ['event_only', 'negative', 'requires_action_false'], '展映说明',
    '纪录片展映将在周五晚于报告厅开始。本次不得上传现场录像。', [D({ id: 'd-no-upload-recording', scopes: ['本次不得上传现场录像。'], action: S('本次不得上传现场录像。', '上传'), object: S('本次不得上传现场录像。', '现场录像'), actionType: 'upload', effect: 'external_transfer', semantics: negative })], [O({ id: 'o-screening', kind: 'event', scopes: ['纪录片展映将在周五晚于报告厅开始。'], subject: S('纪录片展映将在周五晚于报告厅开始。', '纪录片展映'), semantics: { actor: 'unknown', speechAct: 'assertive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'informational' }, timeRefs: [{ ...S('纪录片展映将在周五晚于报告厅开始。', '周五晚'), type: 'event_start' }], locationRef: S('纪录片展映将在周五晚于报告厅开始。', '报告厅') })], false, ['上传现场录像']),
]

const output = { schemaVersion: 'rco-5-007-b4-challenge-1.0.0', datasetId: 'rco-5-007-b4-challenge-20260904', split: 'Development-Challenge', classification: 'anonymous_synthetic_codex_authored_pre_oracle_p2_challenge', seenStatus: 'UNSEEN_BY_P2_AT_FREEZE_AND_UNSEEN_BY_DEEPSEEK', createdAt: '2026-09-04T19:30:00+08:00', labelProvenance: 'Codex-authored reference labels; not independent human ground truth', contractSchemaVersion: 'scope-reference-candidate-1.0', scopeIndexVersion: 'scope-index-1.1', taskFormationPolicyVersion: 'task-formation-policy-2.2.0-p2', sampleCount: cases.length, cases }
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, sampleCount: cases.length }))
