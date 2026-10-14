import assert from 'node:assert/strict'
import test from 'node:test'
import { createWorker, validateExtractionRequest, validateMultimodalExtractionRequest } from './worker.mjs'

const source = '无需办理：匿名社团器材维护说明。'
const base = { sourceType: 'text', sourceTitle: '匿名说明', content: source, referenceTime: '2026-10-02T08:00:00+08:00', timezone: 'Asia/Shanghai' }
const project = { projectId: 'project-anonymous', title: '明确选择的匿名项目', category: '其他', keywords: [], activeMilestones: [], recentSourceTitles: [], dateRange: [] }
const task = { id: 'task-anonymous', projectId: null, title: '明确选择的匿名任务', deadline: '2026-10-19T16:30' }
const selected = { projectIds: [project.projectId], taskIds: [task.id] }
const fakeEnvironment = { DEEPSEEK_API_KEY: 'anonymous-test-placeholder', ALLOWED_ORIGINS: '', ASSETS: { fetch: async () => new Response('anonymous asset') } }
function request(body) {
  return new Request('https://anonymous.example/api/deepseek/extract', {
    method: 'POST', headers: { origin: 'https://anonymous.example', 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}
function emptyResult() {
  return {
    schemaVersion: '2.0', promptVersion: 'anonymous', modelName: 'anonymous', createdAt: '2026-10-02T08:00:00.000Z',
    sourceSummary: { title: '匿名说明', sourceType: 'text', notificationType: 'information_only', summary: '无需办理', requiresAction: false, actionReason: '没有办理义务' },
    projectMatch: { decision: 'uncertain', matchedProjectId: null, suggestedProjectTitle: null, confidence: 0.8, reasons: ['无需建项目'] },
    projectSuggestion: null, milestones: [], standaloneTasks: [], materials: [], timePoints: [], events: [], evidence: [], conflicts: [], ambiguities: [], ignoredContent: [],
    quality: { overallConfidence: 0.8, hierarchyConfidence: 0.8, dateConfidence: 0.8, evidenceCoverage: 1, duplicateRisk: 0, overFragmentationRisk: 0, missingActionRisk: 0, needsHumanReview: false, reviewReasons: [] },
  }
}

test('D26 accepts bounded source-only and empty legacy contexts', () => {
  assert.equal(validateExtractionRequest(base), null)
  assert.equal(validateExtractionRequest({ ...base, projectCandidates: [], existingTasks: [] }), null)
})

test('D26 requires selection matching every sent project and task, rejecting extras and duplicate IDs', () => {
  assert.equal(validateExtractionRequest({ ...base, projectCandidates: [project], existingTasks: [task] }), 'DEEPSEEK_CONTEXT_SELECTION_REQUIRED')
  assert.equal(validateExtractionRequest({ ...base, projectCandidates: [project], existingTasks: [task], contextSelection: selected }), null)
  for (const contextSelection of [
    { projectIds: [], taskIds: [task.id] },
    { projectIds: [project.projectId], taskIds: [task.id, 'task-unselected'] },
    { projectIds: [project.projectId, project.projectId], taskIds: [task.id] },
    { ...selected, wholeWorkspace: true },
  ]) assert.equal(validateExtractionRequest({ ...base, projectCandidates: [project], existingTasks: [task], contextSelection }), 'DEEPSEEK_CONTEXT_SELECTION_REQUIRED')
})

test('D26 multimodal base also rejects silently attached workspace summaries', () => {
  assert.equal(validateMultimodalExtractionRequest({
    ...base, sourceType: 'image', projectCandidates: [project],
    consent: true, inputMode: 'image', ocrTextIncluded: true,
    images: [{ dataUrl: 'data:image/png;base64,AAAA', mimeType: 'image/png', label: '匿名图片', byteLength: 3 }],
  }), 'DEEPSEEK_CONTEXT_SELECTION_REQUIRED')
})

test('D26 worker does not contact upstream for unselected workspace details', async () => {
  let calls = 0
  const worker = createWorker({ fetcher: async () => { calls += 1; return Response.json({ choices: [{ message: { content: JSON.stringify(emptyResult()) } }] }) } })
  const response = await worker.fetch(request({ ...base, projectCandidates: [project], existingTasks: [task] }), fakeEnvironment)
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'DEEPSEEK_CONTEXT_SELECTION_REQUIRED')
  assert.equal(calls, 0)
})

test('D26 fake upstream receives only current source or exactly selected context', async () => {
  const sent = []
  const worker = createWorker({ fetcher: async (_url, options) => {
    sent.push(JSON.parse(options.body))
    return Response.json({ choices: [{ message: { content: JSON.stringify(emptyResult()) } }] })
  } })
  assert.equal((await worker.fetch(request(base), fakeEnvironment)).status, 200)
  assert.equal(sent.length, 1)
  assert.ok(sent[0].messages[1].content.endsWith(source))
  assert.ok(!sent[0].messages[1].content.includes(project.title))
  assert.ok(!sent[0].messages[1].content.includes(task.title))
  assert.equal((await worker.fetch(request({ ...base, projectCandidates: [project], existingTasks: [task], contextSelection: selected }), fakeEnvironment)).status, 200)
  assert.equal(sent.length, 2)
  assert.ok(sent[1].messages[1].content.includes(project.title))
  assert.ok(sent[1].messages[1].content.includes(task.title))
})

test('D26 missing configuration prevents upstream source transmission', async () => {
  let calls = 0
  const worker = createWorker({ fetcher: async () => { calls += 1; return Response.json({}) } })
  const response = await worker.fetch(request(base), { ...fakeEnvironment, DEEPSEEK_API_KEY: '' })
  assert.equal(response.status, 503)
  assert.equal((await response.json()).error, 'DEEPSEEK_NOT_CONFIGURED')
  assert.equal(calls, 0)
})
