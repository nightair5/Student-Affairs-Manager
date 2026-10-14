import { expect, it } from 'vitest'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { D20ReviewSessionRepository } from './d20ReviewSession'
import { summarizeD20Engineering } from './d20Measurement'
import {createD13Measurement, type D13Trace} from './measurement'

const name = 'rco-mainline-01-02-i1-real-input-d20-review-session-p2'
function workspace(): WorkspaceV8 {
  return {
    workspace: { id: name }, sources: [{ id: 'source', currentVersionId: 'version' }],
    sourceVersions: [{ id: 'version', sourceId: 'source' }],
    recognitionRuns: [{ id: 'run', sourceVersionId: 'version' }],
    extractionDrafts: [{ id: 'draft', recognitionRunId: 'run' }],
  } as unknown as WorkspaceV8
}
function setup() {
  const transport = Object.assign(new MemoryWorkspaceRecordStore(), { name })
  return { transport, repo: new D20ReviewSessionRepository(transport), w: workspace() }
}

it('merges disjoint fields but preserves both versions of a same-field multi-tab conflict', async () => {
  const { repo, w } = setup()
  await repo.stage(w, 'draft', 'task:T1:title', 'old', 'mine', 'tab-a')
  await repo.stage(w, 'draft', 'event:E1:title', 'talk', 'lecture', 'tab-b')
  const collision = await repo.stage(w, 'draft', 'task:T1:title', 'old', 'other', 'tab-b')
  expect(collision.fields['event:E1:title'].mine).toBe('lecture')
  expect(collision.fields['task:T1:title'].mine).toBe('mine')
  expect(collision.fields['task:T1:title'].conflict).toEqual({ latest: 'mine', incoming: 'other', incomingWriter: 'tab-b' })
  await expect(repo.stage(w, 'draft', 'task:T1:title', 'old', 'third', 'tab-c')).rejects.toThrow('D20_FIELD_CONFLICT_UNRESOLVED')
  const chosen = await repo.resolve(w, 'draft', 'task:T1:title', 'incoming', 'tab-b', collision.fields['task:T1:title'].revision)
  expect(chosen.fields['task:T1:title'].mine).toBe('other')
  expect((await repo.load(w, 'draft')).history.map(item => item.kind)).toEqual(['stage', 'stage', 'stage', 'resolve'])
})

it('recovers an unconfirmed field without creating canonical facts and rejects a changed source version', async () => {
  const { repo, transport, w } = setup()
  await repo.stage(w, 'draft', 'task:T1:deadline', '', '2026-10-21', 'tab-a')
  const original = await repo.load(w, 'draft')
  const recovered = await new D20ReviewSessionRepository(transport).recover(w, 'draft', 'tab-b', {
    'task:T1:deadline': original.fields['task:T1:deadline'].revision,
  })
  expect(recovered.fields['task:T1:deadline'].mine).toBe('2026-10-21')
  expect(recovered.fields['task:T1:deadline'].writer).toBe('tab-b')
  expect(await transport.read('current')).toBeUndefined()
  const changed = structuredClone(w); changed.sources[0].currentVersionId = 'another-version'
  await expect(repo.load(changed, 'draft')).rejects.toThrow('D20_SOURCE_VERSION_CONFLICT')
  await expect(repo.clear(w, 'draft', 'task:T1:deadline', 'tab-a', recovered.fields['task:T1:deadline'].revision)).rejects.toThrow('D20_FIELD_OWNED_BY_OTHER_TAB')
})

it('a failed checkpoint is not reported as persisted', async () => {
  const { repo, transport, w } = setup()
  const broken = { name, read: (key: string) => transport.read(key), write: (key: string, value: unknown) => transport.write(key, value),
    remove: (key: string) => transport.remove(key),
    transaction: transport.transaction.bind(transport), transactionMany: async () => { throw Error('INJECTED_CHECKPOINT_FAILURE') } }
  await expect(new D20ReviewSessionRepository(broken).stage(w, 'draft', 'task:T1:title', 'old', 'new', 'tab-a')).rejects.toThrow('INJECTED_CHECKPOINT_FAILURE')
  expect(Object.keys((await repo.load(w, 'draft')).fields)).toHaveLength(0)
})

it('cannot clear another tab conflict or a newer edit from the same writer', async () => {
  const { repo, w } = setup()
  const first = await repo.stage(w, 'draft', 'task:T1:title', 'old', 'first', 'tab-a')
  const collided = await repo.stage(w, 'draft', 'task:T1:title', 'old', 'second', 'tab-b')
  await expect(repo.clear(w, 'draft', 'task:T1:title', 'tab-a', first.fields['task:T1:title'].revision)).rejects.toThrow('D20_FIELD_STALE')
  expect((await repo.load(w, 'draft')).fields['task:T1:title'].conflict).toEqual(collided.fields['task:T1:title'].conflict)
  const resolved = await repo.resolve(w, 'draft', 'task:T1:title', 'latest', 'tab-a', collided.fields['task:T1:title'].revision)
  const newer = await repo.stage(w, 'draft', 'task:T1:title', 'old', 'newer', 'tab-a')
  await expect(repo.clear(w, 'draft', 'task:T1:title', 'tab-a', resolved.fields['task:T1:title'].revision)).rejects.toThrow('D20_FIELD_STALE')
  expect((await repo.load(w, 'draft')).fields['task:T1:title'].mine).toBe(newer.fields['task:T1:title'].mine)
})

it('blocks a stale formal field save after another tab takes over the checkpoint', async () => {
  const { repo, w } = setup()
  const first = await repo.stage(w, 'draft', 'task:T1:title', 'old', 'tab-a-value', 'tab-a')
  const taken = await repo.recover(w, 'draft', 'tab-b', { 'task:T1:title': first.fields['task:T1:title'].revision })
  await repo.stage(w, 'draft', 'task:T1:title', 'old', 'tab-b-value', 'tab-b')
  let committed = false
  await expect(repo.withFreshField(w, 'draft', 'task:T1:title', 'tab-a', first.fields['task:T1:title'].revision,
    'tab-a-value', async () => { committed = true })).rejects.toThrow('D21_FIELD_CHANGED_REVIEW_CONFLICT')
  expect(committed).toBe(false)
  expect(taken.fields['task:T1:title'].writer).toBe('tab-b')
  expect((await repo.load(w, 'draft')).fields['task:T1:title'].mine).toBe('tab-b-value')
})

it('rejects stale takeover and checks the actual current source version inside the transaction', async () => {
  const { repo, transport, w } = setup()
  const saved = await repo.stage(w, 'draft', 'task:T1:title', 'old', 'edited', 'tab-a')
  await repo.stage(w, 'draft', 'task:T1:title', 'old', 'later', 'tab-a')
  await expect(repo.recover(w, 'draft', 'tab-b', { 'task:T1:title': saved.fields['task:T1:title'].revision })).rejects.toThrow('D20_FIELD_STALE')
  const changed = structuredClone(w); changed.sources[0].currentVersionId = 'other'
  await transport.write('current', changed)
  await expect(repo.stage(w, 'draft', 'task:T1:deadline', null, 'tomorrow', 'tab-a')).rejects.toThrow('D20_SOURCE_VERSION_CONFLICT')
})

it('checkpoint transactions preserve the canonical source in stores where omitted keys mean deletion', async () => {
  const base = new MemoryWorkspaceRecordStore(), w = workspace()
  await base.write('current', w)
  const isolatedSemantics = {
    name: 'rco-mainline-01-02-i1-real-input-d21-review-session-p1',
    read: base.read.bind(base), write: base.write.bind(base), remove: base.remove.bind(base), transaction: base.transaction.bind(base),
    transactionMany: async (keys: string[], mutate: (records: Map<string, unknown>) => Map<string, unknown>) => {
      const before = new Map(await Promise.all(keys.map(async key => [key, await base.read(key)] as const)))
      const next = mutate(before)
      for (const key of keys) if (next.has(key)) await base.write(key, next.get(key)); else await base.remove(key)
      return next
    },
  }
  const repo = new D20ReviewSessionRepository(isolatedSemantics)
  const saved = await repo.stage(w, 'draft', 'event:E1:edit', null, {title:'讲座'}, repo.writer)
  expect(await base.read('current')).toEqual(w)
  await repo.clear(w, 'draft', 'event:E1:edit', repo.writer, saved.fields['event:E1:edit'].revision)
  expect(await base.read('current')).toEqual(w)
})

it('persists an event editor snapshot with full provenance instead of rejecting a valid large edit', async () => {
  const { repo, w } = setup()
  const snapshot = { change: { kind: 'independent_event', eventId: 'E1', value: { title: '检索讲座', provenance: '原文依据'.repeat(6000) } }, revision: 'baseline' }
  await repo.stage(w, 'draft', 'event:E1:edit', { title: '检索讲座' }, snapshot, 'tab-a')
  expect((await repo.load(w, 'draft')).fields['event:E1:edit'].mine).toEqual(snapshot)
})

it('keeps checkpoint writes separate from verified corrections and refuses a fabricated human metric', async () => {
  const { repo, w } = setup()
  const session = await repo.stage(w, 'draft', 'task:T1:title', 'old', 'new', 'tab-a')
  const trace = [
    { id: 'e1', draftId: 'draft', atMs: 1, kind: 'edit', editId: 'edit-1', fieldKey: 'T1:title' },
    { id: 'c1', draftId: 'draft', atMs: 2, kind: 'commit', commitId: 'commit-1', includedEditIds: ['edit-1'], fields: ['display.T1.title'] },
    { id: 'r1', draftId: 'draft', atMs: 3, kind: 'readback', commitId: 'commit-1' },
  ] as D13Trace[]
  const report = summarizeD20Engineering(session, trace)
  expect(report.checkpointStageCount).toBe(1)
  expect(report.verifiedCommitIds).toEqual(['commit-1'])
  expect(report.checkpointToEditId).toBe('NOT_DIRECTLY_LINKED')
  expect(report.humanMetrics).toBe('NOT_OBSERVABLE')
})

it('D21 links one semantic field edit through checkpoint, commit and readback without counting repeated staging', async () => {
  const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:'rco-mainline-01-02-i1-real-input-d21-review-session-p9'})
  const metrics=createD13Measurement(transport)
  const repo=new D20ReviewSessionRepository(transport,(draftId,field)=>metrics.changed(draftId,field))
  const w=workspace()
  await transport.write('current',w)
  const first=await repo.stage(w,'draft','event:E1:edit','old','new',repo.writer)
  await repo.stage(w,'draft','event:E1:edit','old','newer',repo.writer)
  const editId=first.fields['event:E1:edit'].editId!
  expect((await metrics.events('draft')).filter(row=>row.kind==='edit')).toHaveLength(1)
  await metrics.append('draft','commit',{commitId:'commit-1',includedEditIds:[editId]})
  await metrics.append('draft','readback',{commitId:'commit-1'})
  const report=summarizeD20Engineering(await repo.load(w,'draft'),await metrics.events('draft'))
  expect(report.checkpointToEditId).toEqual([{field:'event:E1:edit',editId,checkpointHistoryId:first.history[0].id,commitId:'commit-1',readbackVerified:true}])
})

it('D21 will not create a checkpoint after the canonical source has disappeared', async()=>{
  const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:'rco-mainline-01-02-i1-real-input-d21-review-session-p8'})
  const repo=new D20ReviewSessionRepository(transport)
  await expect(repo.stage(workspace(),'draft','task:T1:title','before','after',repo.writer)).rejects.toThrow('D21_CANONICAL_SOURCE_MISSING')
  expect(await transport.read('d20-review-session:draft')).toBeUndefined()
})
