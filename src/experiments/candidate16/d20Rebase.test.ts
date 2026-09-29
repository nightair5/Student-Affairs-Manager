import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
// @ts-expect-error Node-only anonymous preview builder; no model call.
import { buildD20Preview } from '../../../scripts/serve-d20-review-session.mjs'
import { createD13Runtime } from './runtime'
import { editSemantic, reviewIndependentEvents } from '../mainline05/semanticConfirmation'
import { effectiveStateFacts, life, semanticRevision, stateOfRuntime } from '../mainline05/semanticState'
import type { D13ReplayRecord } from './replay'

it('D20 can save an unchanged task after an independent event review, keeping repository CAS and both facts', async () => {
  const preview = await buildD20Preview('6688','p4')
  const record = JSON.parse(readFileSync(preview.directory+'/records/d13-fixture-d20-mixed.json','utf8')) as D13ReplayRecord
  const transport = Object.assign(new MemoryWorkspaceRecordStore(), { name: 'rco-mainline-01-02-i1-real-input-d20-review-session-p4' })
  const app = await createD13Runtime({ transport, choices: [record], read: async () => record, sourceSession: true })
  const draftId = await app.open(record.id), before = await app.repository.load(), revision = semanticRevision(before)
  const task = effectiveStateFacts(stateOfRuntime(before,draftId)).facts.tasks[0]
  expect(task).toBeDefined()
  await reviewIndependentEvents(app.repository,{draftId,revision,operationId:'review-independent'})
  const saved = await editSemantic(app.repository,{draftId,taskTempId:task.id,revision,operationId:'edit-after-event',field:'title',value:'复核项目成员名单'})
  expect(life(stateOfRuntime(saved,draftId)).values[task.id].title).toBe('复核项目成员名单')
  expect(life(stateOfRuntime(saved,draftId)).independentEventsReviewedAt).toBeDefined()
  expect(saved.tasks).toHaveLength(0)
})
