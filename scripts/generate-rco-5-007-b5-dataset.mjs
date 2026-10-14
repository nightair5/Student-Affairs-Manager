import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B5_CHALLENGE_DATASET.json')
const required = { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' }
const groupRequired = { ...required, actor: 'addressed_group' }
const negative = { ...required, polarity: 'negative', status: 'cancelled' }
const uncertain = { ...required, speechAct: 'hypothetical', polarity: 'uncertain', status: 'unknown', validity: 'uncertain' }
const info = { actor: 'issuer', speechAct: 'assertive', polarity: 'affirmative', tense: 'present', status: 'pending', validity: 'active', modality: 'informational' }
const S = (scopeText, surface) => ({ scopeText, surface })
const D = ({ id, scopes, action, object, actionType, effect, semantics = required, selected = false, timeRefs = [], materialRefs = [], locationRef = null }) => ({ expectedId: id, propositionScopeTexts: scopes, semantics, inferenceLevel: 'explicit', actionType, action, object, effect, timeRefs, materialRefs, eventRef: null, locationRef, revisionRefs: [], expectedDefaultSelected: selected })
const O = ({ id, kind = 'information', scopes, subject, semantics = info, timeRefs = [], locationRef = null }) => ({ expectedId: id, kind, propositionScopeTexts: scopes, semantics, inferenceLevel: 'explicit', subject, timeRefs, locationRef })
const C = (id, semanticFamilyId, coverageTags, sourceTitle, sourceText, directives, observations = [], requiresAction = true, forbiddenDefaultSurfaces = [], ignoredScopeTexts = []) => ({ id, semanticFamilyId, coverageTags, sourceTitle, sourceText, referenceTime: '2026-09-04T20:45:00+08:00', timezone: 'Asia/Shanghai', expected: { requiresAction, directives, observations, ignoredScopeTexts, forbiddenDefaultSurfaces } })

const cases = [
  C('rco-task-b5-01', 'cold-cabinet-negative-condition-confirmed', ['conditional', 'complete_proposition', 'external_interaction'], '冷藏柜异常处理',
    '若冷藏柜仍未降温，请联系实验室管理员。事实是冷藏柜仍未降温。', [D({ id: 'd-contact-lab-admin', scopes: ['若冷藏柜仍未降温，', '请联系实验室管理员。', '事实是冷藏柜仍未降温。'], action: S('请联系实验室管理员。', '联系'), object: S('请联系实验室管理员。', '实验室管理员'), actionType: 'contact', effect: 'external_interaction' })], [], true, ['联系实验室管理员']),
  C('rco-task-b5-02', 'approval-condition-explicitly-denied', ['conditional', 'complete_proposition', 'requires_action_false'], '场地审批状态',
    '如果预约表完成审批，再上传场地确认页。已确认预约表没有完成审批。', [D({ id: 'd-upload-venue-confirmation', scopes: ['如果预约表完成审批，', '再上传场地确认页。'], action: S('再上传场地确认页。', '上传'), object: S('再上传场地确认页。', '场地确认页'), actionType: 'upload', effect: 'external_transfer', semantics: uncertain })], [O({ id: 'o-approval-denied', scopes: ['已确认预约表没有完成审批。'], subject: S('已确认预约表没有完成审批。', '预约表'), semantics: { ...info, polarity: 'negative', status: 'unknown' } })], false, ['上传场地确认页']),
  C('rco-task-b5-03', 'volunteer-object-words-not-actor', ['actor', 'object_fidelity', 'compound_action'], '志愿者记录整理',
    '请检查新生志愿者名册，再保存缺勤情况说明。', [
      D({ id: 'd-review-volunteer-roster', scopes: ['请检查新生志愿者名册，'], action: S('请检查新生志愿者名册，', '检查'), object: S('请检查新生志愿者名册，', '新生志愿者名册'), actionType: 'review', effect: 'local_change', selected: true }),
      D({ id: 'd-save-absence-note', scopes: ['再保存缺勤情况说明。'], action: S('再保存缺勤情况说明。', '保存'), object: S('再保存缺勤情况说明。', '缺勤情况说明'), actionType: 'save', effect: 'local_change', selected: true }),
    ]),
  C('rco-task-b5-04', 'duty-staff-explicit-group-subject', ['actor', 'addressed_group', 'safe_default'], '设备交接登记',
    '值守人员须填写设备交接表。', [D({ id: 'd-fill-handover-form', scopes: ['值守人员须填写设备交接表。'], action: S('值守人员须填写设备交接表。', '填写'), object: S('值守人员须填写设备交接表。', '设备交接表'), actionType: 'fill', effect: 'local_change', semantics: groupRequired })]),
  C('rco-task-b5-05', 'surface-complete-classified-as-submit', ['action_surface', 'external_transfer', 'time'], '纸质申请递交',
    '请于下周一前完成纸质申请递交。', [D({ id: 'd-complete-paper-delivery', scopes: ['请于下周一前完成纸质申请递交。'], action: S('请于下周一前完成纸质申请递交。', '完成'), object: S('请于下周一前完成纸质申请递交。', '纸质申请递交'), actionType: 'submit', effect: 'external_transfer', timeRefs: [{ ...S('请于下周一前完成纸质申请递交。', '下周一'), type: 'submission_deadline' }] })], [], true, ['纸质申请递交']),
  C('rco-task-b5-06', 'surface-handle-classified-as-pay', ['action_surface', 'external_interaction', 'requires_action_without_default'], '培训费用处理',
    '请在9月18日前处理培训费支付。', [D({ id: 'd-handle-training-payment', scopes: ['请在9月18日前处理培训费支付。'], action: S('请在9月18日前处理培训费支付。', '处理'), object: S('请在9月18日前处理培训费支付。', '培训费支付'), actionType: 'pay', effect: 'external_interaction', timeRefs: [{ ...S('请在9月18日前处理培训费支付。', '9月18日'), type: 'task_deadline' }] })], [], true, ['培训费支付']),
  C('rco-task-b5-07', 'old-schedule-cancelled-new-local-rule', ['revision', 'superseded', 'local_replacement'], '彩排要求更新',
    '旧安排要求上传彩排录像，该安排已经取消。现行要求是整理彩排问题清单。', [
      D({ id: 'd-old-upload-rehearsal', scopes: ['旧安排要求上传彩排录像，', '该安排已经取消。'], action: S('旧安排要求上传彩排录像，', '上传'), object: S('旧安排要求上传彩排录像，', '彩排录像'), actionType: 'upload', effect: 'external_transfer', semantics: { ...negative, tense: 'past', validity: 'superseded' } }),
      D({ id: 'd-prepare-rehearsal-list', scopes: ['现行要求是整理彩排问题清单。'], action: S('现行要求是整理彩排问题清单。', '整理'), object: S('现行要求是整理彩排问题清单。', '彩排问题清单'), actionType: 'prepare', effect: 'local_change', selected: true }),
    ], [], true, ['上传彩排录像']),
  C('rco-task-b5-08', 'prior-rule-invalid-new-check-rule', ['revision', 'lexical_novelty', 'stale_task'], '宿舍表要求变更',
    '先前规定须发送宿舍分配表，现声明该规定不再有效。新的要求是核对房间编号。', [
      D({ id: 'd-old-send-room-table', scopes: ['先前规定须发送宿舍分配表，', '现声明该规定不再有效。'], action: S('先前规定须发送宿舍分配表，', '发送'), object: S('先前规定须发送宿舍分配表，', '宿舍分配表'), actionType: 'send', effect: 'external_transfer', semantics: { ...negative, tense: 'past', validity: 'superseded' } }),
      D({ id: 'd-review-room-number', scopes: ['新的要求是核对房间编号。'], action: S('新的要求是核对房间编号。', '核对'), object: S('新的要求是核对房间编号。', '房间编号'), actionType: 'review', effect: 'local_change', selected: true }),
    ], [], true, ['发送宿舍分配表']),
  C('rco-task-b5-09', 'quoted-deposit-example-plus-local-note', ['quoted', 'security_decoy', 'local_action'], '防骗培训提示',
    '培训材料举例：“请注册平台并支付押金”。此句仅为示例。请保存防骗提示。', [D({ id: 'd-save-fraud-warning', scopes: ['请保存防骗提示。'], action: S('请保存防骗提示。', '保存'), object: S('请保存防骗提示。', '防骗提示'), actionType: 'save', effect: 'local_change', selected: true })], [O({ id: 'o-deposit-example', scopes: ['培训材料举例：', '“请注册平台并支付押金”。'], subject: S('“请注册平台并支付押金”。', '注册平台并支付押金'), semantics: { actor: 'third_party', speechAct: 'quoted', polarity: 'affirmative', tense: 'present', status: 'unknown', validity: 'uncertain', modality: 'informational' } })], true, ['注册平台', '支付押金'], ['此句仅为示例。']),
  C('rco-task-b5-10', 'optional-map-and-required-badge', ['optional', 'physical_action', 'mixed_modality'], '开放日入场准备',
    '校园地图可以自行打印；入场时请携带访客证。', [
      D({ id: 'd-optional-print-map', scopes: ['校园地图可以自行打印；'], action: S('校园地图可以自行打印；', '打印'), object: S('校园地图可以自行打印；', '校园地图'), actionType: 'print', effect: 'physical_action', semantics: { ...groupRequired, modality: 'optional' } }),
      D({ id: 'd-carry-visitor-pass', scopes: ['入场时请携带访客证。'], action: S('入场时请携带访客证。', '携带'), object: S('入场时请携带访客证。', '访客证'), actionType: 'carry', effect: 'physical_action', selected: true, materialRefs: [{ ...S('入场时请携带访客证。', '访客证'), required: true }] }),
    ]),
  C('rco-task-b5-11', 'same-object-fill-and-sign-loan-form', ['compound_action', 'mixed_effect', 'same_scope'], '器材借用确认',
    '请填写器材借用单并签名。', [
      D({ id: 'd-fill-loan-form', scopes: ['请填写器材借用单并签名。'], action: S('请填写器材借用单并签名。', '填写'), object: S('请填写器材借用单并签名。', '器材借用单'), actionType: 'fill', effect: 'local_change', selected: true }),
      D({ id: 'd-sign-loan-form', scopes: ['请填写器材借用单并签名。'], action: S('请填写器材借用单并签名。', '签名'), object: S('请填写器材借用单并签名。', '器材借用单'), actionType: 'sign', effect: 'physical_action' }),
    ], [], true, ['签名']),
  C('rco-task-b5-12', 'defense-event-and-file-deadline', ['event', 'time_role', 'external_transfer'], '答辩材料安排',
    '项目答辩于10月9日14:30在综合楼举行。展示文件须在10月7日18:00前上传。', [D({ id: 'd-upload-presentation', scopes: ['展示文件须在10月7日18:00前上传。'], action: S('展示文件须在10月7日18:00前上传。', '上传'), object: S('展示文件须在10月7日18:00前上传。', '展示文件'), actionType: 'upload', effect: 'external_transfer', timeRefs: [{ ...S('展示文件须在10月7日18:00前上传。', '10月7日18:00'), type: 'submission_deadline' }] })], [O({ id: 'o-defense-event', kind: 'event', scopes: ['项目答辩于10月9日14:30在综合楼举行。'], subject: S('项目答辩于10月9日14:30在综合楼举行。', '项目答辩'), semantics: { actor: 'unknown', speechAct: 'assertive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'informational' }, timeRefs: [{ ...S('项目答辩于10月9日14:30在综合楼举行。', '10月9日14:30'), type: 'event_start' }], locationRef: S('项目答辩于10月9日14:30在综合楼举行。', '综合楼') })], true, ['上传展示文件']),
  C('rco-task-b5-13', 'archive-condition-currently-true', ['conditional', 'complete_proposition', 'external_transfer'], '借用记录归档',
    '当借用记录未归档时，请发送设备清单。目前借用记录未归档。', [D({ id: 'd-send-equipment-list', scopes: ['当借用记录未归档时，', '请发送设备清单。', '目前借用记录未归档。'], action: S('请发送设备清单。', '发送'), object: S('请发送设备清单。', '设备清单'), actionType: 'send', effect: 'external_transfer' })], [], true, ['发送设备清单']),
  C('rco-task-b5-14', 'third-party-cleaner-contact-own-check', ['third_party', 'reported_speech', 'actor'], '会场清洁分工',
    '物业要求保洁人员联系场馆主管，这项事务与你无关。你须检查自己的离场时间。', [D({ id: 'd-review-departure-time', scopes: ['你须检查自己的离场时间。'], action: S('你须检查自己的离场时间。', '检查'), object: S('你须检查自己的离场时间。', '离场时间'), actionType: 'review', effect: 'local_change', selected: true })], [O({ id: 'o-cleaner-contact', scopes: ['物业要求保洁人员联系场馆主管，', '这项事务与你无关。'], subject: S('物业要求保洁人员联系场馆主管，', '保洁人员联系场馆主管'), semantics: { actor: 'third_party', speechAct: 'assertive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'informational' } })], true, ['联系场馆主管']),
  C('rco-task-b5-15', 'shared-guide-for-two-separated-local-tasks', ['multi_task', 'shared_material_subset', 'explanation_ownership'], '参访记录处理',
    '请整理参访纪要。请打印座位图。另请填写观察表。纪要和观察表都依据讲解手册。', [
      D({ id: 'd-prepare-visit-notes', scopes: ['请整理参访纪要。', '纪要和观察表都依据讲解手册。'], action: S('请整理参访纪要。', '整理'), object: S('请整理参访纪要。', '参访纪要'), actionType: 'prepare', effect: 'local_change', selected: true, materialRefs: [{ ...S('纪要和观察表都依据讲解手册。', '讲解手册'), required: true }] }),
      D({ id: 'd-print-seat-map', scopes: ['请打印座位图。'], action: S('请打印座位图。', '打印'), object: S('请打印座位图。', '座位图'), actionType: 'print', effect: 'physical_action', selected: true }),
      D({ id: 'd-fill-observation-form', scopes: ['另请填写观察表。', '纪要和观察表都依据讲解手册。'], action: S('另请填写观察表。', '填写'), object: S('另请填写观察表。', '观察表'), actionType: 'fill', effect: 'local_change', selected: true, materialRefs: [{ ...S('纪要和观察表都依据讲解手册。', '讲解手册'), required: true }] }),
    ]),
  C('rco-task-b5-16', 'lecture-event-plus-explicit-recording-ban', ['event_only', 'negative', 'requires_action_false'], '专题讲座说明',
    '专题讲座将在周日下午于图书馆报告区开始。本场禁止发送现场录音。', [D({ id: 'd-no-send-recording', scopes: ['本场禁止发送现场录音。'], action: S('本场禁止发送现场录音。', '发送'), object: S('本场禁止发送现场录音。', '现场录音'), actionType: 'send', effect: 'external_transfer', semantics: negative })], [O({ id: 'o-lecture-event', kind: 'event', scopes: ['专题讲座将在周日下午于图书馆报告区开始。'], subject: S('专题讲座将在周日下午于图书馆报告区开始。', '专题讲座'), semantics: { actor: 'unknown', speechAct: 'assertive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'informational' }, timeRefs: [{ ...S('专题讲座将在周日下午于图书馆报告区开始。', '周日下午'), type: 'event_start' }], locationRef: S('专题讲座将在周日下午于图书馆报告区开始。', '图书馆报告区') })], false, ['发送现场录音']),
]

const output = { schemaVersion: 'rco-5-007-b5-challenge-1.0.0', datasetId: 'rco-5-007-b5-challenge-20260904', split: 'Development-Challenge', classification: 'anonymous_synthetic_codex_authored_pre_oracle_p2_challenge', seenStatus: 'UNSEEN_BY_P2_AT_FREEZE_AND_UNSEEN_BY_DEEPSEEK', createdAt: '2026-09-04T20:45:00+08:00', labelProvenance: 'Codex-authored reference labels; not independent human ground truth', contractSchemaVersion: 'scope-reference-candidate-1.0', scopeIndexVersion: 'scope-index-1.1', taskFormationPolicyVersion: 'task-formation-policy-2.2.0-p2', sampleCount: cases.length, cases }
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, sampleCount: cases.length }))
