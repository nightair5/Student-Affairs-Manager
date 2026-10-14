import { describe, expect, it } from 'vitest'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import { emptyWorkspace } from '../mainline01/fixtures'
import { SemanticRepository } from './semanticRepository'
import { captureSemantic } from './semanticCapture'
import { engineeringCase, engineeringReply, notices } from './engineeringReplay'

describe('MAINLINE05 source-first capture', () => {
  it('persists a real source chain before the response and retains the raw/first response separately', async () => {
    const name = 'rco-mainline-01-02-i1-mainline05-capture-source-first'
    const store = Object.assign(new MemoryWorkspaceRecordStore(), { name })
    const initial = emptyWorkspace(); initial.workspace.id = name
    const repo = await SemanticRepository.open(name, store, initial)
    const id = await captureSemantic(repo, { sourceType: 'text', content: notices['no-date'], operationId: 'source-first' }, async (text, h) => {
      const saved = await repo.load()
      expect(saved.sources[0].id).toBe(h.sourceId); expect(saved.sourceVersions[0].rawText).toBe(text)
      expect(saved.tasks).toEqual([]); expect(saved.extractionDrafts[0].result).toBeNull()
      return engineeringReply(engineeringCase(text), h)
    })
    const saved = await repo.load(), state = saved.extractionDrafts[0].legacyData!.mainline05
    expect(id).toBe(saved.extractionDrafts[0].id); expect(saved.recognitionRuns[0].status).toBe('succeeded')
    expect(state).toHaveProperty('rawOutputText'); expect(state).toHaveProperty('first')
    expect(saved.tasks).toEqual([])
  })
  it('retains failed source without fake result when callback fails; operation collisions do not rewrite original', async () => {
    const name = 'rco-mainline-01-02-i1-mainline05-capture-failure'
    const store = Object.assign(new MemoryWorkspaceRecordStore(), { name })
    const initial = emptyWorkspace(); initial.workspace.id = name
    const repo = await SemanticRepository.open(name, store, initial)
    await expect(captureSemantic(repo, { sourceType: 'text', content: notices.multi, operationId: 'op' },
      async () => { throw Error('ENGINEERING_FAULT') })).rejects.toThrow('ENGINEERING_FAULT')
    const before = await repo.load()
    expect(before.extractionDrafts[0].status).toBe('failed'); expect(before.extractionDrafts[0].result).toBeNull()
    expect(before.tasks).toEqual([])
    await expect(captureSemantic(repo, { sourceType: 'text', content: notices['no-date'], operationId: 'op' },
      async (text,h) => engineeringReply(engineeringCase(text),h))).rejects.toThrow('CAPTURE_OPERATION_COLLISION')
    expect(await repo.load()).toEqual(before)
  })
})
