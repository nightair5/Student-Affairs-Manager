import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const runDirectory = new URL('.', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1')
const read = name => JSON.parse(readFileSync(join(runDirectory, name), 'utf8'))
const sha256 = value => createHash('sha256').update(value).digest('hex')
const inputs = read('BUSINESS_INPUTS.json')
const binding = read('BINDING_FINAL.json')
const billing = read('BILLING.json')

const zero = () => ({
  taskExtra: 0,
  taskMissing: 0,
  materialMissing: 0,
  materialExtra: 0,
  materialOwnership: 0,
  timeMissing: 0,
  timeFalse: 0,
  timeOwnership: 0,
  condition: 0,
  dependency: 0,
  revision: 0,
})

const adjudications = {
  W01: {
    A: { note: '两个任务、各自截止和三份材料正确。' },
    B: { structural: true, note: '事实正确，但来源范围和时间证据引用不一致，增加核对阻断。' },
  },
  W02: {
    A: { note: '保留“近期”和“具体完成日期另行通知”，日期待定而不是无日期。' },
    B: { errors: { timeMissing: 2 }, structural: true, note: '两个模糊时间均遗漏，并把缺失误写成时间覆盖矛盾。' },
  },
  W03: { A: { note: '正确。' }, B: { note: '正确。' } },
  W04: {
    A: { structural: true, note: '取消条件和独立检查任务的事实正确；条件来源表达仍需核对。' },
    B: { structural: true, note: '与A相同，事实正确但条件来源表达仍需核对。' },
  },
  W05: { A: { note: '条件成立、任务、材料和时间正确。' }, B: { note: '条件成立、任务、材料和时间正确。' } },
  W06: {
    A: { note: '条件保持unknown，领取任务和学生证材料正确。' },
    B: { structural: true, note: '核心事实正确，但任务coverage与已提取材料矛盾。' },
  },
  W07: { A: { note: '旧要求作废、新PDF要求生效，关系正确。' }, B: { note: '旧要求作废、新PDF要求生效，关系正确。' } },
  W08: {
    A: { errors: { revision: 1 }, note: '独立反思任务正确；无替代的纯取消被写成superseded。' },
    B: { errors: { revision: 1 }, note: '与A相同，纯取消语义仍需改。' },
  },
  W09: { A: { note: '纯信息，不造任务；结束时间待核对。' }, B: { note: '纯信息，不造任务；结束时间待核对。' } },
  W10: { A: { note: '两个任务、材料和截止归属正确。' }, B: { note: '两个任务、材料和截止归属正确。' } },
  W11: {
    A: { errors: { taskExtra: 1, materialOwnership: 1, condition: 1 }, note: '多造密封袋任务；密封袋归属扩散；送样条件被误判成立。' },
    B: { errors: { taskExtra: 1, materialExtra: 1, materialOwnership: 1 }, note: '条件unknown改善，但仍多造密封袋任务，又把检测样本多造为材料并错归密封袋。' },
  },
  W12: {
    A: { errors: { dependency: 1, revision: 1 }, note: '给独立保存任务增加无依据依赖；纯取消仍被写成替代。' },
    B: { errors: { dependency: 1, revision: 1 }, note: '与A相同，依赖和纯取消语义仍需纠正。' },
  },
  X01: { A: { note: '两个任务、材料和截止正确。' }, B: { note: '两个任务、材料和截止正确。' } },
  X02: { A: { note: '共享材料归属正确；当日17:00保留待核对。' }, B: { note: '共享材料归属正确；当日17:00保留待核对。' } },
  X03: {
    A: { note: '模糊截止保留为待核对，材料规格在原文和建议中保留。' },
    B: { structural: true, note: '事实基本保留，但把辅助事实范围放入条件字段，增加无谓核对。' },
  },
  X04: { A: { note: '真正无日期任务正确。' }, B: { note: '真正无日期任务正确。' } },
  X05: {
    A: { note: '条件unknown，领取任务和工作证材料正确。' },
    B: { errors: { taskExtra: 1, materialOwnership: 1 }, structural: true, note: '把“出示工作证”多拆成任务，并把工作证只归给多余任务。' },
  },
  X06: { A: { note: '旧上传要求作废，新校验值任务生效。' }, B: { note: '旧上传要求作废，新校验值任务生效；保留旧材料不影响当前行动。' } },
  X07: {
    A: { auxiliaryReviewBurden: 2, note: '事实正确；授权编号和校对人姓名被拆成两个辅助材料核对项。' },
    B: { note: '事实正确，并把两个辅助属性保留在主材料中，少2个材料核对项。' },
  },
  X08: { A: { note: '纯信息，不造任务；结束时间待核对。' }, B: { note: '纯信息，不造任务；结束时间待核对。' } },
}

const categories = Object.keys(zero())
const errorTotal = errors => categories.reduce((sum, key) => sum + (errors[key] ?? 0), 0)
const normalize = arm => ({ ...zero(), ...(arm.errors ?? {}) })
const percentile = (values, value) => {
  const sorted = [...values].sort((left, right) => left - right)
  if (sorted.length === 0) return null
  return sorted[Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)]
}

const cases = inputs.map(item => {
  const arms = {}
  for (const armName of ['A', 'B']) {
    const observed = item.arms[armName]
    const adjudication = adjudications[item.id][armName]
    const errors = normalize(adjudication)
    arms[armName] = {
      requestModel: observed.requestModel,
      returnedModel: observed.returnedModel,
      http: observed.http,
      schemaParsed: observed.facts != null,
      strictScored: observed.strict != null,
      strictCompleteCase: observed.strictCompleteCase,
      businessErrors: errors,
      substantiveErrorCount: errorTotal(errors),
      substantiveCorrectionRequired: errorTotal(errors) > 0,
      structuralReviewBlocker: adjudication.structural === true,
      auxiliaryReviewBurden: adjudication.auxiliaryReviewBurden ?? 0,
      reviewIssueCodes: [...new Set((observed.review?.issues ?? []).map(issue => issue.code))],
      suggestedTasks: observed.facts.tasks.map(task => task.title),
      waitingMs: observed.waitingMs,
      usage: observed.usage,
      costUpperMicroCny: observed.costUpperMicroCny,
      note: adjudication.note,
    }
  }
  return { id: item.id, previousId: item.previousId, cohort: item.cohort, arms }
})

function summarize(selected, armName) {
  const arms = selected.map(item => item.arms[armName])
  const businessErrors = Object.fromEntries(categories.map(category => [
    category,
    arms.reduce((sum, arm) => sum + arm.businessErrors[category], 0),
  ]))
  const waiting = arms.map(arm => arm.waitingMs)
  return {
    model: arms[0].returnedModel,
    sources: arms.length,
    http200: arms.filter(arm => arm.http === 200).length,
    schemaParsed: arms.filter(arm => arm.schemaParsed).length,
    strictScored: arms.filter(arm => arm.strictScored).length,
    strictCompleteCases: arms.filter(arm => arm.strictCompleteCase).length,
    noSubstantiveCorrection: arms.filter(arm => !arm.substantiveCorrectionRequired).length,
    substantiveCorrectionSources: arms.filter(arm => arm.substantiveCorrectionRequired).length,
    businessErrors,
    totalBusinessErrors: errorTotal(businessErrors),
    structuralReviewBlockerSources: arms.filter(arm => arm.structuralReviewBlocker).length,
    auxiliaryReviewBurden: arms.reduce((sum, arm) => sum + arm.auxiliaryReviewBurden, 0),
    waitingMs: {
      total: waiting.reduce((sum, value) => sum + value, 0),
      median: percentile(waiting, 0.5),
      p95: percentile(waiting, 0.95),
      max: Math.max(...waiting),
    },
    usage: {
      inputTokens: arms.reduce((sum, arm) => sum + (arm.usage?.input_tokens ?? 0), 0),
      cachedInputTokens: arms.reduce((sum, arm) => sum + (arm.usage?.input_tokens_details?.cached_tokens ?? 0), 0),
      outputTokens: arms.reduce((sum, arm) => sum + (arm.usage?.output_tokens ?? 0), 0),
      totalTokens: arms.reduce((sum, arm) => sum + (arm.usage?.total_tokens ?? 0), 0),
    },
    observedPeakPriceUpperMicroCny: arms.reduce((sum, arm) => sum + arm.costUpperMicroCny, 0),
    providerBilledCny: 'NOT_OBSERVABLE',
  }
}

const cohorts = {
  original12: cases.filter(item => item.cohort === 'original12'),
  later8: cases.filter(item => item.cohort === 'later8'),
  all20: cases,
}
const summaries = Object.fromEntries(Object.entries(cohorts).map(([name, selected]) => [name, {
  A: summarize(selected, 'A'),
  B: summarize(selected, 'B'),
}]))

const result = {
  version: 'model-compare-business-1',
  generatedAt: new Date().toISOString(),
  claim: '固定candidate03、wire、正文、参考时刻、时区和评分，只改变模型；20份均为已见材料开发回归。',
  bindingSha256: sha256(readFileSync(join(runDirectory, 'BINDING_FINAL.json'))),
  requestCount: Object.keys(binding.requests).length,
  exactReturnedModelIdentity: cases.every(item => item.arms.A.returnedModel === 'deepseek-flash' && item.arms.B.returnedModel === 'deepseek-v4-pro'),
  verifierRepairRetry: 0,
  billing,
  summaries,
  adoption: {
    candidate03Model: 'deepseek-flash',
    comparedModel: 'deepseek-v4-pro',
    decision: 'DO_NOT_ADOPT_PRO',
    reasons: [
      '无需实质纠正从17/20降至15/20。',
      '实质错误总数从6增至10；新增两个模糊时间遗漏和一项工作证动作误拆。',
      '结构核对阻断来源从1份增至6份。',
      'Pro把W11条件从错误true修正为unknown，并在X07少2个辅助材料核对项，但收益不足以覆盖退化。',
    ],
    isolated6632PreferredModelRemains: 'deepseek-flash',
  },
  strictScoringCaveat: 'W01-B原始响应身份核验和schema解析均成功，但冻结candidate03评分入口拒绝非Flash模型标识；原始RESULT保留失败，业务比较使用未改raw的解析结果，严格汇总覆盖B臂19/20。',
  productConversionEvidence: {
    source: '../baseline-conversion-20260914a/REPLAY.json',
    model: 'deepseek-flash',
    sources: 20,
    suggestedTasks: 31,
    correctlySavedTasksInZeroCallEngineeringReplay: 20,
    sourcesWithAtLeastOneSavedTask: 16,
    unexpectedProgramBlockers: 0,
    claim: '既有可靠Flash回答的公开接口工程回放，不是真人转化率，也不是本轮新模型请求的浏览器保存结果。',
  },
  cases,
}

writeFileSync(join(runDirectory, 'COMPARISON.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({
  requestCount: result.requestCount,
  all20: result.summaries.all20,
  adoption: result.adoption,
}, null, 2))
