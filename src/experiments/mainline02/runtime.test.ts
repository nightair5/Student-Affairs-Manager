import { describe, expect, it, vi } from 'vitest'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import { artificialResponse, emptyWorkspace, notices } from '../mainline01/fixtures'
import { createMainlineRuntime } from './runtime'

const name = 'rco-mainline-01-02-i1-unit-runtime'
const initial = () => ({ ...emptyWorkspace(), workspace: { ...emptyWorkspace().workspace, id: name } })
const setup = () => Object.assign(new MemoryWorkspaceRecordStore(), { name })
describe('isolated runtime storage and capture', () => {
  it('rejects malformed records without reading any legacy key', async () => {
    const store = setup()
    await store.write('current', { schemaVersion: 8, workspace: { id: name } })
    const spy = vi.spyOn(store, 'read')
    await expect(createMainlineRuntime({ name, store, recognize: () => { throw Error('not called') } })).rejects.toThrow()
    expect(spy.mock.calls.every(call => call[0] === 'current')).toBe(true)
  })
  it('rejects swapped database binding after initialization', async () => {
    const store = setup()
    const runtime = await createMainlineRuntime({ name, store, initialize: initial(), recognize: (_,id) => artificialResponse('no-date',id) })
    store.name += '-swapped'
    await expect(runtime.capture({sourceType:'text',content:notices['no-date']})).rejects.toThrow('MAINLINE_STORE_BINDING_INVALID')
    expect((await store.read('current') as ReturnType<typeof initial>).sources).toHaveLength(0)
  })
  it('rejects invalid database name before reading a store', async () => {
    await expect(createMainlineRuntime({ name: 'student-affairs-steward', store: setup(), recognize: () => { throw Error('not called') } })).rejects.toThrow('MAINLINE_DATABASE_INVALID')
  })
  it('fails on missing current record without migration or demo fallback', async () => {
    await expect(createMainlineRuntime({ name, store: setup(), recognize: () => { throw Error('not called') } })).rejects.toThrow('MAINLINE_WORKSPACE_MISSING')
  })
  it('requires store name binding and rejects populated initialization', async () => {
    const store = setup()
    store.name = name + '-other'
    await expect(createMainlineRuntime({ name, store, initialize: initial(), recognize: () => { throw Error() } })).rejects.toThrow('MAINLINE_STORE_BINDING')
    const populated = initial(); populated.historyRecords.push({} as never)
    await expect(createMainlineRuntime({ name, store: setup(), initialize: populated, recognize: () => { throw Error() } })).rejects.toThrow('MAINLINE_INITIALIZATION_REJECTED')
  })
  it('stores source before callback; restores draft and exports canonical without tasks', async () => {
    const store = setup()
    const recognize = async (text: string, id: string) => {
      const saved = await store.read('current') as ReturnType<typeof initial>
      expect(saved.sourceVersions[0].rawText).toBe(text); expect(saved.tasks).toHaveLength(0)
      expect(saved.extractionDrafts).toHaveLength(1)
      return artificialResponse('no-date', id)
    }
    const runtime = await createMainlineRuntime({ name, store, initialize: initial(), recognize })
    const draftId = await runtime.capture({ sourceType: 'text', content: notices['no-date'], operationId: 'unit-no-date' })
    const reopened = await createMainlineRuntime({ name, store, recognize })
    expect((await reopened.load()).extractionDrafts[0].id).toBe(draftId)
    expect(JSON.parse(await reopened.exportJson()).schemaVersion).toBe(8)
    expect((await reopened.load()).tasks).toHaveLength(0)
    await expect(createMainlineRuntime({ name, store, initialize: initial(), recognize })).rejects.toThrow('MAINLINE_INITIALIZATION_REJECTED')
  })
  it('retains source and failed draft on unsupported response, without retries', async () => {
    let calls = 0
    const runtime = await createMainlineRuntime({ name, store: setup(), initialize: initial(), recognize: () => { calls++; throw Error('UNREPRESENTABLE_CONDITION_STATE') } })
    await expect(runtime.capture({ sourceType: 'text', content: notices['condition-unknown'] })).rejects.toThrow()
    const saved = await runtime.load()
    expect(calls).toBe(1); expect(saved.sources).toHaveLength(1); expect(saved.tasks).toHaveLength(0)
    expect(saved.extractionDrafts[0].status).toBe('failed')
  })
  it('rejects image/network inputs and wrong workspace identity without writes', async () => {
    const store = setup()
    const runtime = await createMainlineRuntime({ name, store, initialize: initial(), recognize: () => { throw Error('not called') } })
    await expect(runtime.capture({ sourceType: 'image', content: 'x' })).rejects.toThrow('MAINLINE_TEXT_ONLY')
    expect((await runtime.load()).sources).toHaveLength(0)
    await store.write('current', emptyWorkspace())
    await expect(runtime.load()).rejects.toThrow('MAINLINE_WORKSPACE_MISSING_OR_WRONG')
  })
})
