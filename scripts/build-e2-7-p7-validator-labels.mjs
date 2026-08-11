import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const REVIEW_PATH = path.join(ROOT, '.evaluation-cache/e2-7/p7-validator-review.json')
const OUTPUT_PATH = path.join(ROOT, 'docs/e2-path-a-planning/p7-validator-labels.json')

const ISSUE_CODES = [
  'MISSING_TASK',
  'MISSING_MATERIAL',
  'MISSING_TIMEPOINT',
  'WRONG_TIME_ROLE',
  'POSSIBLE_FALSE_PRECISION',
  'MISSING_AMBIGUITY',
  'EVENT_TASK_CONFUSION',
  'MATERIAL_TASK_CONFUSION',
  'POSSIBLE_FALSE_ACTION',
  'INVALID_EVIDENCE',
  'INVALID_REFERENCE',
  'OVER_FRAGMENTATION',
  'OVER_MERGING',
]

const N = '逐项核对原文与当前输出后，未发现本标签集定义范围内的问题；结构差异如有不构成用户需要修改的错误。'
const decisions = {
  'e2-complex_notice-01': [['NO_ISSUE'], '报告与原始访谈记录属于同一提交动作，合并表达不丢失用户行动。'],
  'e2-complex_notice-02': [['WRONG_TIME_ROLE'], '报名截止被标为一般任务截止，时间事实存在但角色错误。'],
  'e2-complex_notice-03': [['NO_ISSUE'], '层级组织与标准不同，但行动、材料和时间事实均可用。'],
  'e2-complex_notice-04': [['MISSING_TASK', 'EVENT_TASK_CONFUSION', 'INVALID_REFERENCE'], '遗漏自行准备志愿者马甲；集合上岗被重复写为任务与事件；并存在悬空依赖引用。'],
  'e2-complex_notice-05': [['MISSING_AMBIGUITY'], '未表达“仅入选同学适用”的条件不确定性。'],
  'e2-complex_notice-06': [['MISSING_TASK', 'MATERIAL_TASK_CONFUSION', 'WRONG_TIME_ROLE'], '遗漏携带电脑的明确行动，材料未正确关联行动，未知补考时间被误作任务截止。'],
  'e2-complex_notice-07': [['NO_ISSUE'], '材料属于同一提交动作；“时间待定”已保留，当前 Validator 的缺时间提示是假阳性。'],
  'e2-complex_notice-08': [['NO_ISSUE'], N],
  'e2-complex_notice-09': [['NO_ISSUE'], '材料属于同一上传动作；教师归档时间是背景事实，不是学生新增行动。'],
  'e2-complex_notice-10': [['MISSING_TASK', 'POSSIBLE_FALSE_ACTION', 'WRONG_TIME_ROLE', 'INVALID_REFERENCE'], '遗漏报名动作，新增“查看附件”伪行动，计划区间误作任务截止，并有悬空引用。'],
  'e2-holdout-01': [['NO_ISSUE'], N],
  'e2-holdout-02': [['MISSING_TASK', 'POSSIBLE_FALSE_ACTION'], '把明确的携带行动替换为准备清单，导致行动缺失并产生伪行动。'],
  'e2-holdout-03': [['MISSING_TASK'], '遗漏复核数据的明确行动。'],
  'e2-holdout-04': [['NO_ISSUE'], N],
  'e2-holdout-05': [['INVALID_EVIDENCE'], '报名行动与材料分组在语义上可接受，但至少一处证据不能支持对应输出。'],
  'e2-holdout-06': [['MISSING_AMBIGUITY'], '未捕获“仅入选团队适用”的条件不确定性。'],
  'e2-holdout-07': [['NO_ISSUE'], '多个材料属于同一上传动作，合并不构成遗漏。'],
  'e2-holdout-08': [['INVALID_EVIDENCE'], '任务和时间语义可接受，但输出证据未完整支撑事实。'],
  'e2-holdout-09': [['INVALID_EVIDENCE'], '行动结构可用，但存在无法由引用原文支持的证据。'],
  'e2-holdout-10': [['WRONG_TIME_ROLE'], '明确的报名截止被分配为错误时间角色。'],
  'e2-holdout-11': [['NO_ISSUE'], '材料属于同一提交动作，任务合并是合理等价结构。'],
  'e2-holdout-12': [['POSSIBLE_FALSE_ACTION'], '把“报名截止时间另行通知”的状态事实序列化成用户行动。'],
  'e2-holdout-13': [['INVALID_EVIDENCE'], '任务语义正确，但至少一条证据引用不能支撑输出。'],
  'e2-holdout-14': [['MISSING_AMBIGUITY'], '未表达该通知是补充/更正语境所带来的待确认关系。'],
  'e2-holdout-15': [['NO_ISSUE'], '原文是信息通知，无用户行动；当前缺时间告警是假阳性。'],
  'e2-holdout-16': [['NO_ISSUE'], '原文没有需要补建的用户时间节点；当前缺时间告警是假阳性。'],
  'e2-holdout-17': [['NO_ISSUE'], '原文明确否定额外准备材料，当前缺材料告警是假阳性。'],
  'e2-holdout-18': [['MISSING_TIMEPOINT', 'EVENT_TASK_CONFUSION', 'MISSING_AMBIGUITY'], '活动时间和事件未结构化，并遗漏时间未定的歧义。'],
  'e2-holdout-19': [['NO_ISSUE'], N],
  'e2-holdout-20': [['MISSING_TASK', 'MATERIAL_TASK_CONFUSION'], '遗漏出示校园卡的明确行动，卡片只作为材料存在。'],
  'e2-holdout-21': [['MISSING_TIMEPOINT', 'EVENT_TASK_CONFUSION', 'MISSING_AMBIGUITY'], '活动时间与事件未结构化，且未标注仍需确认的时间信息。'],
  'e2-holdout-22': [['INVALID_EVIDENCE'], '行动语义可用，但证据引用未完整支持输出。'],
  'e2-holdout-23': [['NO_ISSUE'], '同一提交动作的材料合并合理；当前缺时间告警是假阳性。'],
  'e2-holdout-24': [['WRONG_TIME_ROLE', 'MISSING_AMBIGUITY', 'INVALID_REFERENCE'], '时间被分配为错误角色，条件不确定性缺失，并存在无效引用。'],
  'e2-holdout-25': [['MISSING_MATERIAL'], '遗漏原文明示的节目单材料；其余材料同属一项提交。'],
  'e2-holdout-26': [['NO_ISSUE'], N],
  'e2-holdout-27': [['NO_ISSUE'], '输出保留了用户行动；对“中午前”的额外确认提示不构成错误。'],
  'e2-holdout-28': [['WRONG_TIME_ROLE', 'MISSING_AMBIGUITY'], '新旧报名截止的角色/替代关系错误，且未明确更正关系的待确认点。'],
  'e2-holdout-29': [['MISSING_MATERIAL', 'INVALID_EVIDENCE'], '遗漏档案袋材料，且部分输出缺少有效原文支撑。'],
  'e2-holdout-30': [['INVALID_EVIDENCE'], '任务和材料语义可用，但至少一处证据覆盖无效。'],
  'e2-holdout-31': [['NO_ISSUE'], N],
  'e2-holdout-32': [['WRONG_TIME_ROLE', 'EVENT_TASK_CONFUSION'], '未来访谈仅表示为带截止的任务，未正确表达协商后的事件时间。'],
  'e2-holdout-33': [['MISSING_TASK', 'POSSIBLE_FALSE_ACTION', 'INVALID_REFERENCE'], '明确回复动作被“参加”替代，产生伪行动并伴随无效引用。'],
  'e2-holdout-34': [['MISSING_MATERIAL'], '遗漏原文明示的材料。'],
  'e2-holdout-35': [['NO_ISSUE'], N],
  'e2-holdout-36': [['NO_ISSUE'], N],
  'e2-holdout-37': [['NO_ISSUE'], 'OCR 时间被标记待确认并保留原文，没有无提示的虚假精确化。'],
  'e2-holdout-38': [['MISSING_TASK', 'MATERIAL_TASK_CONFUSION'], '遗漏明确行动，材料存在但没有被组织到正确任务。'],
  'e2-holdout-39': [['WRONG_TIME_ROLE'], '明确时间事实已发现，但分配到错误角色。'],
  'e2-holdout-40': [['NO_ISSUE'], N],
  'e2-gen-03-3': [['WRONG_TIME_ROLE', 'MISSING_AMBIGUITY'], '时间角色错误，并遗漏适用对象条件的不确定性。'],
  'e2-gen-07-1': [['MISSING_TASK', 'EVENT_TASK_CONFUSION'], '签到行动只体现在事件表达中，没有形成可执行任务。'],
  'e2-gen-10-3': [['MISSING_TASK', 'POSSIBLE_FALSE_ACTION'], '遗漏原文明示行动，并用不等价的建议性动作替代。'],
  'e2-gen-11-3': [['MISSING_AMBIGUITY'], '输出提示了其他材料，但没有捕获通知更正关系的不确定性。'],
  'e2-gen-12-1': [['OVER_MERGING', 'MATERIAL_TASK_CONFUSION'], '出示校园卡与提交申请表被压成笼统借用动作，行动边界和材料关系均丢失。'],
  'e2-gen-15-3': [['NO_ISSUE'], '任务、材料、时间和待确认信息在语义上均可用。'],
  'e2-gen-20-2': [['MISSING_MATERIAL', 'INVALID_REFERENCE'], '遗漏原文明示材料，并有指向不存在实体的引用。'],
  'e2-gen-21-3': [['NO_ISSUE'], N],
  'e2-gen-22-1': [['WRONG_TIME_ROLE'], '地点另行通知被错误序列化为 event_start 时间点。'],
  'e2-gen-22-3': [['WRONG_TIME_ROLE'], '地点另行通知被错误序列化为 event_start 时间点。'],
  'e2-gen-05-1': [['NO_ISSUE'], '该文本主要提供事件信息，额外结构化事件不构成用户伪行动。'],
  'e2-gen-05-2': [['NO_ISSUE'], N],
  'e2-gen-05-3': [['NO_ISSUE'], '信息型通知未要求用户执行新增行动，当前结构没有目标标签问题。'],
  'e2-gen-05-4': [['NO_ISSUE'], N],
  'e2-gen-14-1': [['NO_ISSUE'], N],
  'e2-gen-14-2': [['NO_ISSUE'], N],
  'e2-gen-14-3': [['NO_ISSUE'], N],
  'e2-gen-14-4': [['NO_ISSUE'], N],
  'e2-gen-02-1': [['NO_ISSUE'], N],
  'e2-gen-02-3': [['NO_ISSUE'], N],
  'e2-gen-01-1': [['MISSING_MATERIAL'], '讨论题作为明确准备材料未进入材料列表。'],
  'e2-gen-04-1': [['NO_ISSUE'], '“提交申请”标题可等价表达原文明示行动。'],
  'e2-gen-06-1': [['INVALID_REFERENCE'], '输出包含指向不存在实体的引用。'],
  'e2-gen-09-1': [['WRONG_TIME_ROLE', 'EVENT_TASK_CONFUSION', 'INVALID_EVIDENCE'], '复核事件未正确表达，新增群通知时间角色错误，且存在证据覆盖缺口。'],
  'e2-gen-12-3': [['OVER_MERGING', 'MATERIAL_TASK_CONFUSION'], '出示校园卡与提交申请表被合成笼统借用动作，材料与行动边界丢失。'],
  'e2-gen-13-1': [['MISSING_AMBIGUITY'], '未表达通知仅适用于入选团队的条件不确定性。'],
  'e2-gen-08-1': [['NO_ISSUE'], '对“中午”的额外待确认提示是安全保守表达，不构成目标问题。'],
  'e2-gen-11-1': [['MISSING_AMBIGUITY'], '遗漏通知更正关系的待确认信息。'],
  'e2-gen-03-1': [['MISSING_AMBIGUITY'], '遗漏仅适用于入选团队的条件不确定性。'],
  'e2-gen-07-2': [['MISSING_TASK', 'EVENT_TASK_CONFUSION'], '签到只存在于事件标题，没有形成用户可执行任务。'],
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

const reviewBytes = await readFile(REVIEW_PATH)
const review = JSON.parse(reviewBytes.toString('utf8'))
if (review.caseCount !== 80 || review.cases.length !== 80) throw new Error('Expected exactly 80 real model outputs')

const labels = review.cases.map((entry) => {
  const decision = decisions[entry.caseId]
  if (!decision) throw new Error(`Missing human decision for ${entry.caseId}`)
  const [issues, rationale] = decision
  if (!rationale) throw new Error(`Missing rationale for ${entry.caseId}`)
  if (issues.includes('NO_ISSUE') && issues.length !== 1) throw new Error(`NO_ISSUE cannot be mixed for ${entry.caseId}`)
  for (const issue of issues) {
    if (issue !== 'NO_ISSUE' && !ISSUE_CODES.includes(issue)) throw new Error(`Unknown issue ${issue}`)
  }
  return {
    caseId: entry.caseId,
    sourceSet: entry.sourceSet,
    sourceSha256: entry.sourceSha256,
    inputSha256: entry.inputSha256,
    resultSha256: entry.resultSha256,
    issues,
    rationale,
  }
})

if (Object.keys(decisions).length !== labels.length) throw new Error('Decision map contains extra or missing cases')
const support = Object.fromEntries(ISSUE_CODES.map((code) => [code, labels.filter((label) => label.issues.includes(code)).length]))
support.NO_ISSUE = labels.filter((label) => label.issues[0] === 'NO_ISSUE').length

const output = {
  schemaVersion: 'e2.7-p7-validator-labels-1.0.0',
  frozenAt: '2026-08-11T20:56:51.4567610+08:00',
  status: 'FROZEN_BEFORE_VALIDATOR_CHANGE',
  datasetVisibility: 'EXPOSED_DIAGNOSTIC_ONLY',
  reviewMethod: 'Single human multi-label review of the frozen 80-case P6 real-model output packet; expected answers were used only for this post-generation labeling pass.',
  exclusions: [
    'No synthetic mutation is mixed into primary metrics.',
    'POSSIBLE_FALSE_PRECISION and OVER_FRAGMENTATION have zero positive support in these 80 real outputs; detection is verified separately by contract tests.',
  ],
  sourceBinding: {
    reviewPacketSha256: sha256(reviewBytes),
    modelName: [...new Set(review.cases.map((entry) => entry.modelName))],
    promptVersion: [...new Set(review.cases.map((entry) => entry.promptVersion))],
    pipelineVersion: [...new Set(review.cases.map((entry) => entry.pipelineVersion))],
  },
  issueCodes: ISSUE_CODES,
  caseCount: labels.length,
  support,
  labels,
}

await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
process.stdout.write(`${OUTPUT_PATH}\n${JSON.stringify(support)}\n`)
