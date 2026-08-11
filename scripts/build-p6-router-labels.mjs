import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()
const LEGACY_LABELS = path.join(ROOT, 'docs/e2-factledger/d6-router-labels.json')
const OUTPUT = path.join(ROOT, 'docs/e2-path-a-planning/p6-router-labels.json')

const additions = [
  ['e2-gen-05-1', 'simple', '仅公示一个信息事件，正文明确无需学生操作。'],
  ['e2-gen-05-2', 'simple', '只有资助名单公示期，没有用户义务或跨事实依赖。'],
  ['e2-gen-05-3', 'simple', '单一公示事件，且明确未要求个人提交或确认。'],
  ['e2-gen-05-4', 'simple', '单一信息通知，明确不用办理事项。'],
  ['e2-gen-14-1', 'simple', '单一系统维护事件和一个时间区间，无用户动作。'],
  ['e2-gen-14-2', 'simple', '单一维护窗口，仅供知悉。'],
  ['e2-gen-14-3', 'simple', '单一维护公告，明确无读者操作。'],
  ['e2-gen-14-4', 'simple', '单一信息事件，不含准备、提交或确认动作。'],
  ['e2-gen-02-1', 'simple', '一个模型作业交付义务、一个截止点和两个并列交付件。'],
  ['e2-gen-02-3', 'simple', '一个提交动作、一个截止时刻和一个材料包，无条件分支。'],
  ['e2-gen-01-1', 'medium', '阅读与准备讨论问题是两个相关动作，并共享相对时间。'],
  ['e2-gen-04-1', 'medium', '一个申请动作含三项必需材料、一项可选材料和截止时间。'],
  ['e2-gen-06-1', 'medium', '例会事件同时关联携带材料和说明进度两个动作。'],
  ['e2-gen-09-1', 'medium', '准备材料与日期未知的复核事件并存，需要保留时间歧义。'],
  ['e2-gen-12-3', 'medium', '办理动作需区分必需材料与仅供参考附件。'],
  ['e2-gen-13-1', 'medium', '一个资格确认动作受是否入围条件约束。'],
  ['e2-gen-08-1', 'complex', '表格列出三个可独立编辑的论文动作和三个不同时间节点。'],
  ['e2-gen-11-1', 'complex', '更正后的截止时间必须覆盖旧时间，同时保留另一项独立材料截止。'],
  ['e2-gen-03-1', 'complex', '报名、提交方案和条件性陈述构成多阶段动作与事件关系。'],
  ['e2-gen-07-2', 'complex', '条件性人群需参加两个事件并完成签到，存在跨事件任务边界。'],
]

const policies = {
  simple: {
    recommendedPipeline: 'single_pass_light_validation',
    underRoutingRisk: '已是最低强度；主要风险是把信息事件遗漏为无结构输出。',
    overRoutingCost: '增加不必要的校验、延迟和 Token，并可能诱发过度拆分。',
  },
  medium: {
    recommendedPipeline: 'single_pass_standard_validation',
    underRoutingRisk: '可能遗漏第二动作、材料角色、时间歧义或事件关系。',
    overRoutingCost: '严格校验或 Repair 可能增加延迟，并把紧凑结构过度拆分。',
  },
  complex: {
    recommendedPipeline: 'intensive_single_pass_strict_validation_conditional_single_repair',
    underRoutingRisk: '可能漏掉独立动作、条件分支、时间角色或任务与事件边界。',
    overRoutingCost: '更高 max tokens、严格 Validator 和至多一次 Repair 会增加延迟与 Token。',
  },
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

const legacy = JSON.parse(await readFile(LEGACY_LABELS, 'utf8'))
const vite = await createServer({
  root: ROOT,
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
})

try {
  const [golden, holdout, development] = await Promise.all([
    vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
  ])
  const fixtures = new Map([
    ...golden.recognitionGoldenDataset.map((entry) => [entry.id, { ...entry, sourceSet: 'golden' }]),
    ...holdout.recognitionHoldoutDataset.map((entry) => [entry.id, { ...entry, sourceSet: 'exposed_holdout' }]),
    ...development.recognitionGeneralizationDevelopmentDataset.map((entry) => [entry.id, { ...entry, sourceSet: 'development' }]),
  ])
  const original = legacy.labels.map((entry) => [entry.caseId, entry.label, entry.rationale])
  const rows = [...original, ...additions].map(([caseId, label, why]) => {
    const fixture = fixtures.get(caseId)
    if (!fixture) throw new Error(`Unknown case ${caseId}`)
    if (!policies[label]) throw new Error(`Unknown label ${label}`)
    return {
      caseId,
      sourceSet: fixture.sourceSet,
      sourceSha256: sha256(fixture.rawText),
      label,
      why,
      recommendedPipeline: policies[label].recommendedPipeline,
      underRoutingRisk: `${why}${policies[label].underRoutingRisk}`,
      overRoutingCost: `${why}${policies[label].overRoutingCost}`,
    }
  })
  if (rows.length !== 80) throw new Error(`Expected 80 labels, received ${rows.length}`)
  if (new Set(rows.map((entry) => entry.caseId)).size !== rows.length) throw new Error('Duplicate case ID')
  const distribution = rows.reduce((result, entry) => {
    result[entry.label] = (result[entry.label] ?? 0) + 1
    return result
  }, {})
  if (JSON.stringify(distribution) !== JSON.stringify({ complex: 32, simple: 20, medium: 28 })) {
    throw new Error(`Unexpected distribution ${JSON.stringify(distribution)}`)
  }
  const artifact = {
    schemaVersion: 'e2.7-p6-router-labels-1.0.0',
    frozenAt: '2026-08-11T00:00:00+08:00',
    datasetStatus: 'EXPOSED_DIAGNOSTIC_CALIBRATION_ONLY',
    purpose: 'Router intensity allocation only; labels are not business-recognition expected answers.',
    constraints: {
      factLedgerAllowed: false,
      model: 'deepseek-v4-flash',
      runtimeForbiddenFeatures: ['caseId', 'expected answers', 'test phrases', 'Golden category'],
      routerMeaning: 'Router only allocates recognition intensity; it does not perform business recognition.',
    },
    labelingPolicy: legacy.labelingPolicy,
    classPolicies: policies,
    distribution,
    labels: rows,
  }
  await writeFile(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  process.stdout.write(`${OUTPUT}\n${JSON.stringify(distribution)}\n`)
} finally {
  await vite.close()
}
