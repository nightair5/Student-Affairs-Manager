import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'
import { readFileSync, statSync, writeFileSync } from 'node:fs'

const [independentPath, exportPath] = process.argv.slice(2)
if (!independentPath || !exportPath) throw new Error('TWO_ACTUAL_DOWNLOADS_REQUIRED')
const outputDirectory = 'docs/recognition-optimization/mainline-real-input-01/runs/baseline-conversion-20260914a'
const bytes = path => readFileSync(path)
const hash = value => createHash('sha256').update(value).digest('hex')
const stable = value => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value
const objectHash = value => hash(JSON.stringify(stable(value)))

const independentFile = JSON.parse(bytes(independentPath))
const exportedWorkspace = JSON.parse(bytes(exportPath))
if (independentFile.source !== 'new CanonicalWorkspaceRepository(new IsolatedTestStore(name)).load()') {
  throw new Error('INDEPENDENT_REPOSITORY_SOURCE_REQUIRED')
}
if (independentFile.origin !== 'http://127.0.0.1:6632') throw new Error('LOCAL_6632_EVIDENCE_REQUIRED')
const independentWorkspace = independentFile.workspace
const fields = [
  'tasks', 'materials', 'timePoints', 'sources', 'sourceVersions', 'recognitionRuns',
  'extractionDrafts', 'historyRecords', 'changeProposals', 'events', 'evidenceRefs',
]
const fieldComparison = Object.fromEntries(fields.map(field => [field, {
  independentCount: independentWorkspace[field].length,
  exportCount: exportedWorkspace[field].length,
  equal: objectHash(independentWorkspace[field]) === objectHash(exportedWorkspace[field]),
  sha256: objectHash(independentWorkspace[field]),
}]))
const revisions = workspace => workspace.extractionDrafts.flatMap(draft =>
  draft.legacyData?.mainline05?.adaptedResponse?.revisions ?? [])
fieldComparison.revisions = {
  independentCount: revisions(independentWorkspace).length,
  exportCount: revisions(exportedWorkspace).length,
  equal: objectHash(revisions(independentWorkspace)) === objectHash(revisions(exportedWorkspace)),
  sha256: objectHash(revisions(independentWorkspace)),
}
const exactEqual = objectHash(independentWorkspace) === objectHash(exportedWorkspace)
if (!exactEqual || Object.values(fieldComparison).some(result => !result.equal)) {
  throw new Error('DOWNLOADS_DO_NOT_MATCH')
}

const result = {
  version: 'baseline-conversion-download-comparison-1',
  claim: '2026-09-13由用户在6632真实页面取得的两个实际文件；证明当时该浏览器实验库的独立读库与完整导出一致，不冒充本轮自动浏览器操作。',
  independentDownload: {
    file: basename(independentPath),
    bytes: statSync(independentPath).size,
    fileSha256: hash(bytes(independentPath)),
    embeddedWorkspaceSha256: independentFile.sha256,
  },
  fullExportDownload: {
    file: basename(exportPath),
    bytes: statSync(exportPath).size,
    fileSha256: hash(bytes(exportPath)),
  },
  workspaceExactEqual: exactEqual,
  workspaceSha256: objectHash(independentWorkspace),
  fields: fieldComparison,
  savedAt: independentWorkspace.savedAt,
  savedTasks: independentWorkspace.tasks.map(task => ({ id: task.id, title: task.title })),
  savedMaterials: independentWorkspace.materials.map(material => ({
    id: material.id,
    name: material.name,
    required: material.required,
    status: material.status,
    relatedTaskIds: material.relatedTaskIds,
  })),
  savedTimePoints: independentWorkspace.timePoints.map(time => ({
    id: time.id,
    rawText: time.rawText,
    normalizedValue: time.normalizedValue,
    relatedTaskIds: time.relatedTaskIds,
  })),
  limits: [
    '该文件对证明的一项已保存任务及其材料、时间有效。',
    '文件不含第二条新旧要求替代旅程；本轮官方浏览器连接失败，因此该旅程仍未在当前浏览器复验。',
  ],
}
writeFileSync(join(outputDirectory, 'DOWNLOAD_COMPARISON.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({
  workspaceExactEqual: result.workspaceExactEqual,
  tasks: result.savedTasks.length,
  materials: result.savedMaterials.length,
  timePoints: result.savedTimePoints.length,
  sources: result.fields.sources.independentCount,
  runs: result.fields.recognitionRuns.independentCount,
  drafts: result.fields.extractionDrafts.independentCount,
  history: result.fields.historyRecords.independentCount,
}, null, 2))
