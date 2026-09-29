import { expect, it } from 'vitest'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { D20ReviewSessionRepository } from './d20ReviewSession'
import { summarizeD20Engineering } from './d20Measurement'
import type { D13Trace } from './measurement'

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
  const chosen = await repo.resolve(w, 'draft', 'task:T1:title', 'incoming', 'tab-b')
  expect(chosen.fields['task:T1:title'].mine).toBe('other')
  expect((await repo.load(w, 'draft')).history.map(item => item.kind)).toEqual(['stage', 'stage', 'stage', 'resolve'])
})

it('recovers an unconfirmed field without creating canonical facts and rejects a changed source version', async () => {
  const { repo, transport, w } = setup()
  await repo.stage(w, 'draft', 'task:T1:deadline', '', '2026-10-21', 'tab-a')
  const recovered = await new D20ReviewSessionRepository(transport).recover(w, 'draft', 'tab-b')
  expect(recovered.fields['task:T1:deadline'].mine).toBe('2026-10-21')
  expect(recovered.fields['task:T1:deadline'].writer).toBe('tab-b')
  expect(await transport.read('current')).toBeUndefined()
  const changed = structuredClone(w); changed.sources[0].currentVersionId = 'another-version'
  await expect(repo.load(changed, 'draft')).rejects.toThrow('D20_SOURCE_VERSION_CONFLICT')
  await expect(repo.clear(w, 'draft', 'task:T1:deadline', 'tab-a')).rejects.toThrow('D20_FIELD_OWNED_BY_OTHER_TAB')
})

it('a failed checkpoint is not reported as persisted', async () => {
  const { repo, transport, w } = setup()
  const broken = { name, read: (key: string) => transport.read(key), write: (key: string, value: unknown) => transport.write(key, value),
    remove: (key: string) => transport.remove(key), transactionMany: transport.transactionMany.bind(transport),
    transaction: async () => { throw Error('INJECTED_CHECKPOINT_FAILURE') } }
  await expect(new D20ReviewSessionRepository(broken).stage(w, 'draft', 'task:T1:title', 'old', 'new', 'tab-a')).rejects.toThrow('INJECTED_CHECKPOINT_FAILURE')
  expect(Object.keys((await repo.load(w, 'draft')).fields)).toHaveLength(0)
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
