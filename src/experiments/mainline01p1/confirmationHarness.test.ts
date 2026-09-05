import { expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DraftReviewPanel } from '../../components/DraftReviewPanel'
import { captureFixture, memoryRepository } from '../mainline01/chain'
import { observeFidelity } from '../mainline01/fidelity'
import { observeV2Fidelity, reviewV2 } from './confirmationHarness'

it.each(['strong_inference', 'optional_suggestion'] as const)('P1-R1: %s is not a safe default; explicit sibling stays selected', async (level) => {
  const repository = memoryRepository(), handle = await captureFixture(repository, 'multi')
  const workspace = (await repository.load())!
  workspace.extractionDrafts[0].result!.standaloneTasks[0].inferenceLevel = level
  const view = reviewV2(workspace, handle.draftId)
  expect(view.draft.items[0].selected).toBe(false)
  expect(view.draft.items[1].selected).toBe(true)
})

it('P1-R1: V2 advertises an explicit save boundary; V1 rendering is unchanged', async () => {
  const repository = memoryRepository(), handle = await captureFixture(repository, 'no-date')
  const view = reviewV2((await repository.load())!, handle.draftId)
  const noop = () => undefined
  const props = { draft: view.draft, source: view.source, projects: [], projectWillCreate: false,
    onClose: noop, onUpdate: noop, onConfirm: noop, onReject: noop, onConfirmAll: noop,
    onProjectChoice: noop, onKeepExplicit: noop, onMoveTask: noop, onToggleRecognitionEntity: noop,
    onToggleTaskSelected: noop, onSplitTask: noop, onMergeTask: noop }
  const v2 = renderToStaticMarkup(createElement(DraftReviewPanel, { ...props, confirmationV2: { busy: false, items: view.states } }))
  expect(v2).toContain('保存修改')
  expect(renderToStaticMarkup(createElement(DraftReviewPanel, props))).not.toContain('保存修改')
})

it('same 42-field contract: protected V1 remains 40/42, V2 is 42/42', async () => {
  const old = await observeFidelity(true)
  const next = await observeV2Fidelity()
  expect(old.checked).toBe(42); expect(old.equal).toBe(40)
  expect(next.rows.map((r) => [r.task, r.field])).toEqual(old.rows.map((r) => [r.task, r.field]))
  expect(next.checked).toBe(42); expect(next.equal).toBe(42)
  expect(next.differences).toEqual([])
})
