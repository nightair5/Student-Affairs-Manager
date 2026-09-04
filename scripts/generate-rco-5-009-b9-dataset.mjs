import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-009-B9_DEVELOPMENT_DATASET.json')

const CURRENT = 'CURRENT'
const HISTORICAL = 'HISTORICAL'
const SUPERSEDED = 'SUPERSEDED'
const UNKNOWN = 'UNKNOWN'
const CONDITION_UNKNOWN = 'CONDITION_UNKNOWN'
const own = 'own'
const C = (key, action, occurrence, object, localDisposition, responseVerdict, responseObject) => ({
  key, action, occurrence, object, localDisposition, responseVerdict, responseObject,
})
const T = (candidateKey, action, object, semanticLabel, selected) => ({ candidateKey, action, object, semanticLabel, selected })
const E = ({ candidates, tasks, requiresAction, responseContractComplete = true, semanticCoverageComplete = true,
  expectedIssueCodes = [], revisionRelations = [], unresolvedRevisionScopeTexts = [], suppressedRevisionScopeTexts = [] }) => ({ candidates, tasks, requiresAction,
  responseContractComplete, semanticCoverageComplete, expectedIssueCodes, revisionRelations, unresolvedRevisionScopeTexts, suppressedRevisionScopeTexts })
const F = (id, semanticFamilyId, coverageTags, sourceTitle, sourceText, expected) => ({
  id, semanticFamilyId, coverageTags, sourceTitle, sourceText,
  referenceTime: '2026-09-04T23:05:00+08:00', timezone: 'Asia/Shanghai', expected,
})

const cases = [
  F('rco-task-b9-01', 'bare-imperative-needs-model-proposition', ['needs_model', 'proposition'], '纸质值班簿保存', '保存纸质值班簿。', E({
    candidates: [C('b9-01-save', '保存', 1, '纸质值班簿', 'needs_model', 'proposition', own)],
    tasks: [T('b9-01-save', '保存', '纸质值班簿', UNKNOWN, false)], requiresAction: null,
  })),
  F('rco-task-b9-02', 'reported-operation-needs-model-mention', ['needs_model', 'mention_only'], '会议记录操作说明', '会议记录提到保存纸质值班簿这一操作。', E({
    candidates: [C('b9-02-save', '保存', 1, '纸质值班簿这一操作', 'needs_model', 'mention_only', null)],
    tasks: [], requiresAction: false,
  })),
  F('rco-task-b9-03', 'adjacent-prepare-submit-model-disambiguation', ['compound_action', 'needs_model', 'external_effect'], '场地申请包准备', '请准备提交场地申请包。', E({
    candidates: [
      C('b9-03-prepare', '准备', 1, '场地申请包', 'local_proposition', 'proposition', own),
      C('b9-03-submit', '提交', 1, '场地申请包', 'needs_model', 'proposition', own),
    ],
    tasks: [
      T('b9-03-prepare', '准备', '场地申请包', CURRENT, true),
      T('b9-03-submit', '提交', '场地申请包', UNKNOWN, false),
    ], requiresAction: true,
  })),
  F('rco-task-b9-04', 'empty-object-closed-set-quarantine', ['empty_object_set', 'quarantine'], '空对象保存要求', '请保存。', E({
    candidates: [C('b9-04-save', '保存', 1, null, 'local_proposition', 'uncertain', null)],
    tasks: [], requiresAction: null, semanticCoverageComplete: false,
  })),
  F('rco-task-b9-05', 'same-scope-same-verb-distinct-occurrences', ['same_action_repeated', 'occurrence_identity'], '南北柜号核对', '请核对北区柜号再核对南区柜号。', E({
    candidates: [
      C('b9-05-review-north', '核对', 1, '北区柜号', 'local_proposition', 'proposition', own),
      C('b9-05-review-south', '核对', 2, '南区柜号', 'local_proposition', 'proposition', own),
    ],
    tasks: [
      T('b9-05-review-north', '核对', '北区柜号', CURRENT, true),
      T('b9-05-review-south', '核对', '南区柜号', CURRENT, true),
    ], requiresAction: true,
  })),
  F('rco-task-b9-06', 'bad-object-response-sibling-survival', ['bad_owned_object', 'sibling_survival', 'needs_model'], '器材摘要与箱号', '请整理器材交接摘要。核对备用箱序号。', E({
    candidates: [
      C('b9-06-prepare', '整理', 1, '器材交接摘要', 'local_proposition', 'proposition', own),
      C('b9-06-review', '核对', 1, '备用箱序号', 'needs_model', 'proposition', 'b9-06-prepare'),
    ],
    tasks: [T('b9-06-prepare', '整理', '器材交接摘要', CURRENT, true)], requiresAction: true,
    responseContractComplete: false, semanticCoverageComplete: false, expectedIssueCodes: ['OBJECT_CANDIDATE_INVALID'],
  })),
  F('rco-task-b9-07', 'uncertain-membership-blocks-old-process-revision', ['needs_model', 'historical', 'revision_quarantine'], '旧门签流程归属不明', '档案载明旧流程要求保存红色门签。核对蓝色门签是否属于该流程尚未说明。该流程后来作废。', E({
    candidates: [
      C('b9-07-save-red', '保存', 1, '红色门签', 'local_proposition', 'proposition', own),
      C('b9-07-review-blue', '核对', 1, '蓝色门签是否属于该流程尚未说明', 'needs_model', 'uncertain', null),
    ],
    tasks: [T('b9-07-save-red', '保存', '红色门签', HISTORICAL, false)], requiresAction: false,
    semanticCoverageComplete: false, unresolvedRevisionScopeTexts: ['该流程后来作废。'],
    suppressedRevisionScopeTexts: ['该流程后来作废。'],
  })),
  F('rco-task-b9-08', 'resolved-rule-amendment-with-independent-current-save', ['historical', 'resolved_amendment', 'local_revision_window'], '路线规则修订与门岗记录', '旧规则要求发送东组路线表。该规则调整为上传西组值守表。请保存今日门岗记录。', E({
    candidates: [
      C('b9-08-send-east', '发送', 1, '东组路线表', 'local_proposition', 'proposition', own),
      C('b9-08-upload-west', '上传', 1, '西组值守表', 'local_proposition', 'proposition', own),
      C('b9-08-save-today', '保存', 1, '今日门岗记录', 'local_proposition', 'proposition', own),
    ],
    tasks: [
      T('b9-08-send-east', '发送', '东组路线表', SUPERSEDED, false),
      T('b9-08-upload-west', '上传', '西组值守表', CURRENT, false),
      T('b9-08-save-today', '保存', '今日门岗记录', CURRENT, true),
    ], requiresAction: true, revisionRelations: [{
      kind: 'amends', targetCandidateKey: 'b9-08-send-east', replacementCandidateKeys: ['b9-08-upload-west'],
      evidenceScopeTexts: ['旧规则要求发送东组路线表。', '该规则调整为上传西组值守表。'], resolution: 'adjacent_unique_referent',
    }],
  })),
  F('rco-task-b9-09', 'out-of-vocabulary-temperature-transcription', ['out_of_vocabulary', 'requires_action_unknown'], '会场温度抄录', '请抄录会场温度。', E({
    candidates: [], tasks: [], requiresAction: null, semanticCoverageComplete: false,
  })),
  F('rco-task-b9-10', 'document-title-needs-model-mention-plus-fire-door-review', ['needs_model', 'mention_only', 'separate_scope_decoy'], '标题文字与消防门检查', '资料标题是“上传调试包”。请检查消防门编号。', E({
    candidates: [
      C('b9-10-upload-decoy', '上传', 1, '调试包', 'needs_model', 'mention_only', null),
      C('b9-10-review-door', '检查', 1, '消防门编号', 'local_proposition', 'proposition', own),
    ],
    tasks: [T('b9-10-review-door', '检查', '消防门编号', CURRENT, true)], requiresAction: true,
  })),
  F('rco-task-b9-11', 'relative-clause-action-contained-in-object', ['relative_clause', 'object_fidelity', 'local_non_task'], '晚班记录保存', '请保存已经检查的晚班记录。', E({
    candidates: [
      C('b9-11-save', '保存', 1, '已经检查的晚班记录', 'local_proposition', 'proposition', own),
      C('b9-11-review-contained', '检查', 1, '的晚班记录', 'local_non_task', 'mention_only', null),
    ],
    tasks: [T('b9-11-save', '保存', '已经检查的晚班记录', CURRENT, true)], requiresAction: true,
  })),
  F('rco-task-b9-12', 'distant-condition-fact-blocked-by-ui-scope', ['condition_unknown', 'adjacency_boundary', 'external_effect'], '门卡异常联系', '若门卡颜色异常，请联系服务席。页面按钮名为“返回”。当前门卡颜色异常。', E({
    candidates: [C('b9-12-contact', '联系', 1, '服务席', 'local_proposition', 'proposition', own)],
    tasks: [T('b9-12-contact', '联系', '服务席', CONDITION_UNKNOWN, false)], requiresAction: null,
  })),
]

const output = {
  schemaVersion: 'rco-5-009-b9-development-1.0.0',
  datasetId: 'rco-5-009-b9-development-20260904',
  split: 'Development',
  classification: 'anonymous_synthetic_codex_authored_candidate_classification_development',
  seenStatus: 'UNSEEN_BY_DEEPSEEK_AT_FREEZE_LOCAL_DESIGN_PREFLIGHT_ONLY',
  createdAt: '2026-09-04T23:05:00+08:00',
  labelProvenance: 'Codex-authored reference labels; not independent human ground truth',
  scopeIndexVersion: 'scope-index-1.1',
  candidatePolicyVersion: 'local-action-candidate-policy-1.2.0',
  composerVersion: 'action-candidate-composer-1.2.0',
  taskSafetySchemaVersion: 'candidate-task-safety-result-2.0.0',
  taskSafetyPolicyVersion: 'candidate-task-safety-policy-2.0.0',
  multipleObjectChoiceStatus: 'NOT_EXPRESSIBLE_BY_POLICY_1.2.0',
  sampleCount: cases.length,
  cases,
}

const serialized = `${JSON.stringify(output, null, 2)}\n`
if (process.argv.includes('--check')) {
  const existing = await readFile(outputPath, 'utf8')
  if (existing !== serialized) throw new Error('RCO_5_009_B9_DATASET_NOT_REPRODUCIBLE')
  console.log(JSON.stringify({ status: 'PASS', output: outputPath, sampleCount: cases.length }))
} else {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, serialized, 'utf8')
  console.log(JSON.stringify({ output: outputPath, sampleCount: cases.length }))
}
