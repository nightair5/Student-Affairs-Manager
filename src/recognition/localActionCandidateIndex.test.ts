import { describe, expect, it } from 'vitest'
import {
  indexLocalActionCandidates,
  validateLocalActionCandidateCatalog,
  type LocalActionCandidateCatalog,
} from './localActionCandidateIndex'
import { indexImmutableScopesV11 } from './scopeIndexV11'

async function catalog(sourceText: string, sourceId = 'candidate-source') {
  const index = await indexImmutableScopesV11(sourceId, 'source-v1', sourceText)
  return { index, catalog: await indexLocalActionCandidates(index) }
}

describe('local immutable action candidate index', () => {
  it('is deterministic and binds every ID and UTF-16 span to the source', async () => {
    const first = await catalog('请保存甲表。请保存乙表。')
    const repeated = await catalog('请保存甲表。请保存乙表。')
    const changed = await catalog('请保存甲表。请保存丙表。')
    expect(first.catalog).toEqual(repeated.catalog)
    expect(first.catalog.catalogFingerprint).not.toBe(changed.catalog.catalogFingerprint)
    expect(first.catalog.candidates).toHaveLength(2)
    expect(new Set(first.catalog.candidates.map((item) => item.id)).size).toBe(2)
    for (const candidate of first.catalog.candidates) {
      const scope = first.index.scopes.find((item) => item.id === candidate.scopeId)
      expect(scope).toBeDefined()
      expect(scope?.text.slice(candidate.action.startInScope, candidate.action.endInScope)).toBe(candidate.action.surface)
      expect(first.index.sourceContent.slice(candidate.action.sourceStart, candidate.action.sourceEnd)).toBe(candidate.action.surface)
      for (const object of candidate.objectCandidates) {
        expect(scope?.text.slice(object.startInScope, object.endInScope)).toBe(object.surface)
        expect(first.index.sourceContent.slice(object.sourceStart, object.sourceEnd)).toBe(object.surface)
      }
    }
  })

  it('keeps compound and repeated actions as separate occurrence IDs', async () => {
    const { catalog: value } = await catalog('请整理清单并保存副本。请核对甲表再核对乙表。')
    expect(value.candidates.map((item) => item.action.surface)).toEqual(['整理', '保存', '核对', '核对'])
    expect(value.candidates.map((item) => item.objectCandidates[0]?.surface)).toEqual(['清单', '副本', '甲表', '乙表'])
    expect(new Set(value.candidates.map((item) => item.id)).size).toBe(4)
  })

  it('shares one immutable object span across chained actions on either side', async () => {
    const { catalog: value } = await catalog('请填写并提交申请表。申请表请核对并保存。')
    expect(value.candidates.map((item) => item.action.surface)).toEqual(['填写', '提交', '核对', '保存'])
    expect(value.candidates.map((item) => item.objectCandidates[0]?.surface)).toEqual(['申请表', '申请表', '申请表', '申请表'])
    expect(value.candidates[0].objectCandidates[0].id).toBe(value.candidates[1].objectCandidates[0].id)
    expect(value.candidates[2].objectCandidates[0].id).toBe(value.candidates[3].objectCandidates[0].id)
  })

  it('accounts for interface, assertion and completion decoys without making them current tasks', async () => {
    const { catalog: value } = await catalog('页面按钮名为“上传附件”，仅用于说明界面。经确认回执编号仍为空。材料目录已经整理完成。')
    expect(value.candidates.map((item) => [item.action.surface, item.localDisposition])).toEqual([
      ['上传', 'local_non_task'],
      ['确认', 'local_non_task'],
      ['整理', 'local_proposition'],
    ])
  })

  it('does not split an action object at a lexicalized action-looking noun', async () => {
    const { catalog: value } = await catalog('请提交报名表。')
    expect(value.candidates.map((item) => [item.action.surface, item.objectCandidates[0]?.surface, item.localDisposition])).toEqual([
      ['提交', '报名表', 'local_proposition'],
      ['报名', '表', 'local_non_task'],
    ])
  })

  it('keeps unknown explicit action scopes visible instead of silently reporting complete coverage', async () => {
    const { index, catalog: value } = await catalog('请领取纪念品。该安排停止执行。')
    expect(value.candidates).toEqual([])
    expect(value.unresolvedActionScopeIds).toEqual([index.scopes[0].id])
    expect(value.scopesWithoutActionCandidates).toEqual(index.scopes.map((scope) => scope.id))
  })

  it('returns a legal empty catalog for plain information', async () => {
    const { index, catalog: value } = await catalog('今天晴朗。')
    expect(value.candidates).toEqual([])
    expect(value.unresolvedActionScopeIds).toEqual([])
    expect(await validateLocalActionCandidateCatalog(value, index)).toEqual([])
  })

  it('rejects any catalog mutation by recomputing the complete local derivation', async () => {
    const { index, catalog: value } = await catalog('请保存核对记录。')
    const tampered = structuredClone(value) as LocalActionCandidateCatalog
    tampered.candidates[0].action.surface = '核对'
    expect((await validateLocalActionCandidateCatalog(tampered, index)).map((issue) => issue.code)).toEqual([
      'CATALOG_DERIVATION_MISMATCH',
    ])
    const rebound = await indexImmutableScopesV11('other-source', 'source-v1', '请保存核对记录。')
    expect((await validateLocalActionCandidateCatalog(value, rebound)).map((issue) => issue.code)).toContain('CATALOG_SOURCE_BINDING_MISMATCH')
  })
})
