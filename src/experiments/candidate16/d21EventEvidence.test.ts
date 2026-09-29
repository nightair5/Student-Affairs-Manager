import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// @ts-expect-error Local anonymous fixture builder is outside the app bundle.
import { buildD21Preview } from '../../../scripts/serve-d21-review-session.mjs'
import { createD13Runtime } from './runtime'
import type { D13ReplayRecord } from './replay'
import { correctSemanticFact, reviewIndependentEvents, reviewSemanticFact } from '../mainline05/semanticConfirmation'
import { effectiveStateFacts, semanticRevision, stateOfRuntime } from '../mainline05/semanticState'
import { IndependentEventEditor } from '../realInput01/IndependentEventEditor'
import { D20ReviewSessionRepository } from './d20ReviewSession'

it('a validated human event title correction can be confirmed without pretending it was a literal source quote', async () => {
  const preview = await buildD21Preview('6709', 'p18')
  const record = JSON.parse(readFileSync(preview.directory + '/records/d13-fixture-d21-mixed.json', 'utf8')) as D13ReplayRecord
  const transport = Object.assign(new MemoryWorkspaceRecordStore(), { name: 'rco-mainline-01-02-i1-real-input-d21-review-session-p18' })
  const app = await createD13Runtime({ transport, choices: [record], read: async () => record, sourceSession: true })
  const draftId = await app.open(record.id)
  const before = await app.repository.load()
  const facts = effectiveStateFacts(stateOfRuntime(before, draftId)).facts
  const original = facts.events.find(event => event.title === '校园服务台维护')!
  const edited = await correctSemanticFact(app.repository, {
    draftId, revision: semanticRevision(before), operationId: 'rename-maintenance',
    change: { kind: 'independent_event', eventId: original.tempId,
      value: { ...original, title: '校园服务台夜间维护' }, scopeIds: original.scopeIds,
      note: '用户依原文核对后更正事件名称' },
  })
  const reviewed = await reviewIndependentEvents(app.repository, {
    draftId, revision: semanticRevision(edited), operationId: 'review-corrected-events',
  })
  const task = facts.tasks[0]
  const taskReviewed = await reviewSemanticFact(app.repository, {
    draftId, taskId: task.id, revision: semanticRevision(reviewed), operationId: 'review-task',
  })
  const saved = await app.runtime.confirm({ draftId, revision: semanticRevision(taskReviewed), taskTempIds: [task.id] })
  expect(saved.events.find(event => event.title === '校园服务台夜间维护')).toBeDefined()
  expect(saved.events).toHaveLength(2)
  expect(saved.tasks).toHaveLength(1)
  expect(await app.independentReadback()).toEqual(saved)
  expect(stateOfRuntime(saved, draftId).rawResponse.events.find(event => event.tempId === original.tempId)?.title).toBe('校园服务台维护')
  const html = renderToStaticMarkup(createElement(IndependentEventEditor, {
    repo: app.repository, workspace: saved, draftId, busy: false, onDirty: () => undefined,
    onSaved: async () => undefined, reviewSession: new D20ReviewSessionRepository(transport),
  }))
  expect(html).toContain('独立事件已正式确认并保存')
  expect(html).not.toContain('草稿纠正已保存，尚未正式确认')
}, 30_000)
