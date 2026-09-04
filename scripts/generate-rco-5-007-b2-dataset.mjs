import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B2_CHALLENGE_DATASET.json')
const required = { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' }
const negative = { actor: 'addressee', speechAct: 'directive', polarity: 'negative', tense: 'future', status: 'cancelled', validity: 'active', modality: 'required' }
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
  id, semanticFamilyId, coverageTags, sourceTitle, sourceText, referenceTime: '2026-09-04T09:00:00+08:00', timezone: 'Asia/Shanghai',
  expected: { requiresAction, directives, observations, ignoredScopeTexts, forbiddenDefaultSurfaces },
})

const cases = [
  C('rco-task-b2-01', 'same-scope-distinct-local-objects', ['compound_action', 'same_scope', 'distinct_objects'], '宿舍门禁核查',
    '请核对宿舍名单并保存门禁故障说明。', [
      D({ id: 'd-review-roster', scopes: ['请核对宿舍名单并保存门禁故障说明。'], action: S('请核对宿舍名单并保存门禁故障说明。', '核对'), object: S('请核对宿舍名单并保存门禁故障说明。', '宿舍名单'), actionType: 'review', effect: 'local_change', selected: true }),
      D({ id: 'd-save-issue', scopes: ['请核对宿舍名单并保存门禁故障说明。'], action: S('请核对宿舍名单并保存门禁故障说明。', '保存'), object: S('请核对宿舍名单并保存门禁故障说明。', '门禁故障说明'), actionType: 'save', effect: 'local_change', selected: true }),
    ]),
  C('rco-task-b2-02', 'same-scope-local-and-transfer', ['compound_action', 'external_transfer', 'same_scope'], '志愿名单整理',
    '请整理志愿服务名单并发送给值班老师。', [
      D({ id: 'd-prepare-list', scopes: ['请整理志愿服务名单并发送给值班老师。'], action: S('请整理志愿服务名单并发送给值班老师。', '整理'), object: S('请整理志愿服务名单并发送给值班老师。', '志愿服务名单'), actionType: 'prepare', effect: 'local_change', selected: true }),
      D({ id: 'd-send-list', scopes: ['请整理志愿服务名单并发送给值班老师。'], action: S('请整理志愿服务名单并发送给值班老师。', '发送'), object: S('请整理志愿服务名单并发送给值班老师。', '志愿服务名单'), actionType: 'send', effect: 'external_transfer' }),
    ], [], true, ['发送给值班老师']),
  C('rco-task-b2-03', 'condition-explicitly-triggered', ['conditional', 'trigger_satisfied', 'external_interaction'], '实验柜告警',
    '若实验柜持续闪红，请联系值班室。当前实验柜确实持续闪红。', [
      D({ id: 'd-contact-triggered', scopes: ['若实验柜持续闪红，', '请联系值班室。', '当前实验柜确实持续闪红。'], action: S('请联系值班室。', '联系'), object: S('请联系值班室。', '值班室'), actionType: 'contact', effect: 'external_interaction' }),
    ], [], true, ['联系值班室']),
  C('rco-task-b2-04', 'condition-explicitly-untriggered', ['conditional', 'trigger_unsatisfied', 'no_current_action'], '盖章通知',
    '若收到正式盖章通知，再提交住宿申请。目前只有未盖章的预览稿。', [
      D({ id: 'd-submit-if-notice', scopes: ['若收到正式盖章通知，', '再提交住宿申请。'], action: S('再提交住宿申请。', '提交'), object: S('再提交住宿申请。', '住宿申请'), actionType: 'submit', effect: 'external_transfer', semantics: { ...required, speechAct: 'hypothetical', polarity: 'uncertain', status: 'unknown', validity: 'uncertain' } }),
    ], [O({ id: 'o-preview-only', scopes: ['目前只有未盖章的预览稿。'], subject: S('目前只有未盖章的预览稿。', '未盖章的预览稿') })], false, ['提交住宿申请']),
  C('rco-task-b2-05', 'quoted-fraud-decoy-with-local-action', ['quoted', 'security_decoy', 'local_action'], '群聊安全提醒',
    '群里有人转发“请立即付款并上传验证码”。这是安全提醒，不是本次要求。请只在本机保存截图。', [
      D({ id: 'd-save-screenshot', scopes: ['请只在本机保存截图。'], action: S('请只在本机保存截图。', '保存'), object: S('请只在本机保存截图。', '截图'), actionType: 'save', effect: 'local_change', selected: true, locationRef: S('请只在本机保存截图。', '本机') }),
    ], [
      O({ id: 'o-fraud-quote', scopes: ['群里有人转发“请立即付款并上传验证码”。'], subject: S('群里有人转发“请立即付款并上传验证码”。', '付款并上传验证码'), semantics: { actor: 'third_party', speechAct: 'quoted', polarity: 'affirmative', tense: 'present', status: 'unknown', validity: 'uncertain', modality: 'informational' } }),
      O({ id: 'o-not-requirement', scopes: ['这是安全提醒，', '不是本次要求。'], subject: S('不是本次要求。', '本次要求'), semantics: { ...info, polarity: 'negative', status: 'cancelled' } }),
    ], true, ['付款', '上传验证码']),
  C('rco-task-b2-06', 'external-only-required-action', ['external_transfer', 'requires_action_without_default'], '学院申请提交',
    '请在周五17:00前向学院邮箱提交申请。', [
      D({ id: 'd-submit-application', scopes: ['请在周五17:00前向学院邮箱提交申请。'], action: S('请在周五17:00前向学院邮箱提交申请。', '提交'), object: S('请在周五17:00前向学院邮箱提交申请。', '申请'), actionType: 'submit', effect: 'external_transfer', timeRefs: [{ ...S('请在周五17:00前向学院邮箱提交申请。', '周五17:00'), type: 'submission_deadline' }] }),
    ], [], true, ['提交申请']),
  C('rco-task-b2-07', 'third-party-completed-and-addressee-review', ['third_party', 'completed', 'local_action'], '迎新名册复核',
    '辅导员昨天已下载迎新名册。请今天核对其中的宿舍号。', [
      D({ id: 'd-review-room', scopes: ['请今天核对其中的宿舍号。'], action: S('请今天核对其中的宿舍号。', '核对'), object: S('请今天核对其中的宿舍号。', '宿舍号'), actionType: 'review', effect: 'local_change', selected: true, timeRefs: [{ ...S('请今天核对其中的宿舍号。', '今天'), type: 'task_deadline' }] }),
    ], [O({ id: 'o-counselor-download', scopes: ['辅导员昨天已下载迎新名册。'], subject: S('辅导员昨天已下载迎新名册。', '迎新名册'), semantics: { actor: 'third_party', speechAct: 'assertive', polarity: 'affirmative', tense: 'past', status: 'completed', validity: 'active', modality: 'informational' }, timeRefs: [{ ...S('辅导员昨天已下载迎新名册。', '昨天'), type: 'planned_start' }] })]),
  C('rco-task-b2-08', 'optional-print-required-online-confirm', ['optional', 'required', 'external_interaction'], '回执阅读确认',
    '纸质回执可以自行打印，但必须在周四前在线确认阅读状态。', [
      D({ id: 'd-optional-print', scopes: ['纸质回执可以自行打印，'], action: S('纸质回执可以自行打印，', '打印'), object: S('纸质回执可以自行打印，', '纸质回执'), actionType: 'print', effect: 'physical_action', semantics: { ...required, actor: 'addressed_group', modality: 'optional' } }),
      D({ id: 'd-confirm-read', scopes: ['但必须在周四前在线确认阅读状态。'], action: S('但必须在周四前在线确认阅读状态。', '确认'), object: S('但必须在周四前在线确认阅读状态。', '阅读状态'), actionType: 'complete', effect: 'external_interaction', timeRefs: [{ ...S('但必须在周四前在线确认阅读状态。', '周四'), type: 'task_deadline' }] }),
    ], [], true, ['打印', '在线确认']),
  C('rco-task-b2-09', 'shared-material-subset-three-tasks', ['multi_task', 'shared_material_subset', 'explanation_ownership'], '调研材料整理',
    '请整理调查问卷。请撰写访谈摘要。上述两项使用同一份原始记录。另请打印会议座位表。', [
      D({ id: 'd-prepare-questionnaire', scopes: ['请整理调查问卷。', '上述两项使用同一份原始记录。'], action: S('请整理调查问卷。', '整理'), object: S('请整理调查问卷。', '调查问卷'), actionType: 'prepare', effect: 'local_change', selected: true, materialRefs: [{ ...S('上述两项使用同一份原始记录。', '原始记录'), required: true }] }),
      D({ id: 'd-write-summary', scopes: ['请撰写访谈摘要。', '上述两项使用同一份原始记录。'], action: S('请撰写访谈摘要。', '撰写'), object: S('请撰写访谈摘要。', '访谈摘要'), actionType: 'prepare', effect: 'local_change', selected: true, materialRefs: [{ ...S('上述两项使用同一份原始记录。', '原始记录'), required: true }] }),
      D({ id: 'd-print-seats', scopes: ['另请打印会议座位表。'], action: S('另请打印会议座位表。', '打印'), object: S('另请打印会议座位表。', '会议座位表'), actionType: 'print', effect: 'physical_action', selected: true }),
    ]),
  C('rco-task-b2-10', 'exception-group-negative-and-required', ['exception', 'negative', 'addressed_group', 'external_transfer'], '纸质证明例外',
    '已获批免交的同学无需提交纸质证明；其余同学须在窗口递交纸质证明。', [
      D({ id: 'd-exempt-no-submit', scopes: ['已获批免交的同学无需提交纸质证明；'], action: S('已获批免交的同学无需提交纸质证明；', '提交'), object: S('已获批免交的同学无需提交纸质证明；', '纸质证明'), actionType: 'submit', effect: 'external_transfer', semantics: { ...negative, actor: 'addressed_group' } }),
      D({ id: 'd-others-deliver', scopes: ['其余同学须在窗口递交纸质证明。'], action: S('其余同学须在窗口递交纸质证明。', '递交'), object: S('其余同学须在窗口递交纸质证明。', '纸质证明'), actionType: 'submit', effect: 'external_transfer', semantics: { ...required, actor: 'addressed_group' }, locationRef: S('其余同学须在窗口递交纸质证明。', '窗口') }),
    ], [], true, ['提交纸质证明', '递交纸质证明']),
  C('rco-task-b2-11', 'completed-form-with-remaining-review', ['completed', 'remaining_action', 'compound_action'], '申请表补充核对',
    '申请表已经填写完成，但联系电话尚未核对。请核对联系电话后保存批注。', [
      D({ id: 'd-review-phone', scopes: ['请核对联系电话后保存批注。'], action: S('请核对联系电话后保存批注。', '核对'), object: S('请核对联系电话后保存批注。', '联系电话'), actionType: 'review', effect: 'local_change', selected: true }),
    ], [
      O({ id: 'o-form-completed', scopes: ['申请表已经填写完成，'], subject: S('申请表已经填写完成，', '申请表'), semantics: { ...info, tense: 'past', status: 'completed' } }),
      O({ id: 'o-phone-unchecked', scopes: ['但联系电话尚未核对。'], subject: S('但联系电话尚未核对。', '联系电话'), semantics: { ...info, polarity: 'negative', status: 'unknown' } }),
    ]),
  C('rco-task-b2-12', 'event-time-versus-submission-deadline', ['event', 'time_role', 'external_transfer'], '奖学金说明会',
    '奖学金说明会于10月8日14:00在主楼举行。申请材料须在10月10日12:00前提交。', [
      D({ id: 'd-submit-material', scopes: ['申请材料须在10月10日12:00前提交。'], action: S('申请材料须在10月10日12:00前提交。', '提交'), object: S('申请材料须在10月10日12:00前提交。', '申请材料'), actionType: 'submit', effect: 'external_transfer', timeRefs: [{ ...S('申请材料须在10月10日12:00前提交。', '10月10日12:00'), type: 'submission_deadline' }], materialRefs: [{ ...S('申请材料须在10月10日12:00前提交。', '申请材料'), required: true }] }),
    ], [O({ id: 'o-briefing', kind: 'event', scopes: ['奖学金说明会于10月8日14:00在主楼举行。'], subject: S('奖学金说明会于10月8日14:00在主楼举行。', '奖学金说明会'), semantics: { actor: 'unknown', speechAct: 'assertive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'informational' }, timeRefs: [{ ...S('奖学金说明会于10月8日14:00在主楼举行。', '10月8日14:00'), type: 'event_start' }], locationRef: S('奖学金说明会于10月8日14:00在主楼举行。', '主楼') })], true, ['提交']),
  C('rco-task-b2-13', 'question-followed-by-authoritative-answer', ['question', 'negative', 'external_transfer'], '周末安排答复',
    '有同学询问周六是否需要到场。正式答复：不用到场，但须在周五前上传电子回执。', [
      D({ id: 'd-no-attend', scopes: ['不用到场，'], action: S('不用到场，', '到场'), object: S('不用到场，', '到场'), actionType: 'attend', effect: 'physical_action', semantics: negative }),
      D({ id: 'd-upload-receipt', scopes: ['但须在周五前上传电子回执。'], action: S('但须在周五前上传电子回执。', '上传'), object: S('但须在周五前上传电子回执。', '电子回执'), actionType: 'upload', effect: 'external_transfer', timeRefs: [{ ...S('但须在周五前上传电子回执。', '周五'), type: 'submission_deadline' }] }),
    ], [O({ id: 'o-question', scopes: ['有同学询问周六是否需要到场。'], subject: S('有同学询问周六是否需要到场。', '到场'), semantics: { actor: 'third_party', speechAct: 'interrogative', polarity: 'uncertain', tense: 'future', status: 'unknown', validity: 'uncertain', modality: 'informational' }, timeRefs: [{ ...S('有同学询问周六是否需要到场。', '周六'), type: 'event_start' }] })], true, ['到场', '上传电子回执'], ['正式答复：']),
  C('rco-task-b2-14', 'unregistered-action-synonyms', ['lexical_novelty', 'external_transfer', 'multi_task'], '课程说明修订',
    '请先校阅课程说明，再把修订稿递交到教务窗口。', [
      D({ id: 'd-proofread-course', scopes: ['请先校阅课程说明，'], action: S('请先校阅课程说明，', '校阅'), object: S('请先校阅课程说明，', '课程说明'), actionType: 'review', effect: 'local_change', selected: true }),
      D({ id: 'd-deliver-revision', scopes: ['再把修订稿递交到教务窗口。'], action: S('再把修订稿递交到教务窗口。', '递交'), object: S('再把修订稿递交到教务窗口。', '修订稿'), actionType: 'submit', effect: 'external_transfer', locationRef: S('再把修订稿递交到教务窗口。', '教务窗口') }),
    ], [], true, ['递交到教务窗口']),
  C('rco-task-b2-15', 'event-with-optional-view-and-no-registration', ['event_only', 'optional', 'negative'], '图书馆讲座直播',
    '图书馆讲座将于周日举行，可通过网页查看直播，不需要报名。', [
      D({ id: 'd-optional-view', scopes: ['可通过网页查看直播，'], action: S('可通过网页查看直播，', '查看'), object: S('可通过网页查看直播，', '直播'), actionType: 'review', effect: 'local_change', semantics: { ...required, actor: 'addressed_group', modality: 'optional' } }),
      D({ id: 'd-no-register', scopes: ['不需要报名。'], action: S('不需要报名。', '报名'), object: S('不需要报名。', '报名'), actionType: 'register', effect: 'external_interaction', semantics: negative }),
    ], [O({ id: 'o-library-talk', kind: 'event', scopes: ['图书馆讲座将于周日举行，'], subject: S('图书馆讲座将于周日举行，', '图书馆讲座'), semantics: { actor: 'unknown', speechAct: 'assertive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'informational' }, timeRefs: [{ ...S('图书馆讲座将于周日举行，', '周日'), type: 'event_start' }] })], false, ['查看直播', '报名']),
  C('rco-task-b2-16', 'cross-paragraph-shared-and-specific-support', ['multi_task', 'cross_paragraph', 'shared_material_subset', 'location'], '预算与审批材料',
    '请在周二前完成预算表。\n请在周三前打印审批页。\n这两项均需使用财务模板，其中打印任务还需携带学生证到综合窗口。', [
      D({ id: 'd-complete-budget', scopes: ['请在周二前完成预算表。', '这两项均需使用财务模板，'], action: S('请在周二前完成预算表。', '完成'), object: S('请在周二前完成预算表。', '预算表'), actionType: 'complete', effect: 'local_change', selected: true, timeRefs: [{ ...S('请在周二前完成预算表。', '周二'), type: 'task_deadline' }], materialRefs: [{ ...S('这两项均需使用财务模板，', '财务模板'), required: true }] }),
      D({ id: 'd-print-approval', scopes: ['请在周三前打印审批页。', '这两项均需使用财务模板，'], action: S('请在周三前打印审批页。', '打印'), object: S('请在周三前打印审批页。', '审批页'), actionType: 'print', effect: 'physical_action', selected: true, timeRefs: [{ ...S('请在周三前打印审批页。', '周三'), type: 'task_deadline' }], materialRefs: [{ ...S('这两项均需使用财务模板，', '财务模板'), required: true }] }),
      D({ id: 'd-carry-card', scopes: ['其中打印任务还需携带学生证到综合窗口。'], action: S('其中打印任务还需携带学生证到综合窗口。', '携带'), object: S('其中打印任务还需携带学生证到综合窗口。', '学生证'), actionType: 'carry', effect: 'physical_action', selected: true, materialRefs: [{ ...S('其中打印任务还需携带学生证到综合窗口。', '学生证'), required: true }], locationRef: S('其中打印任务还需携带学生证到综合窗口。', '综合窗口') }),
    ]),
]

const output = {
  schemaVersion: 'rco-5-007-b2-challenge-1.0.0',
  datasetId: 'rco-5-007-b2-challenge-20260904',
  split: 'Development-Challenge',
  classification: 'anonymous_synthetic_codex_authored_post_policy_challenge',
  seenStatus: 'UNSEEN_BY_DEEPSEEK_AND_NOT_USED_TO_AUTHOR_POLICY_2_0_0',
  createdAt: '2026-09-04T09:00:00+08:00',
  labelProvenance: 'Codex-authored reference labels; not independent human ground truth',
  contractSchemaVersion: 'scope-reference-candidate-1.0',
  scopeIndexVersion: 'scope-index-1.1',
  taskFormationPolicyVersion: 'task-formation-policy-2.0.0',
  sampleCount: cases.length,
  cases,
}
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, sampleCount: cases.length }))
