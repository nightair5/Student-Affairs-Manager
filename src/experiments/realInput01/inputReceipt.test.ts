import { describe, expect, it } from 'vitest'
import { createInputReceipt, correctReadPage, makeSendSnapshot, validateSendSnapshot, validateInputReceipt, textChunks } from './inputReceipt'
import { notices, NOW } from './seenInputs'
const make = () => createInputReceipt({ inputId: 'read-original', sourceType: 'text', file: null, extractorVersion: 'manual-paste-1', pageCount: 1,
  pages: [{ number: 1, route: 'parser', chunks: textChunks(notices['no-date']), issues: [], parserChunks: null, ocrChunks: null }] })
describe('input receipt and explicit send boundaries', () => {
  it('preserves original text and sends only an explicitly reviewed saved page', async () => {
    const original = await make(), sent = await makeSendSnapshot(original, [1], [1], NOW)
    expect(sent.text).toBe(notices['no-date']); expect(sent.coverage).toBe('complete_declared_range')
    expect(await validateSendSnapshot(original, sent)).toEqual(sent)
    await expect(makeSendSnapshot(original, [1], [], NOW)).rejects.toThrow('READING_REVIEW_REQUIRED')
    const changed = await correctReadPage(original, 1, notices['no-date'].replace('手册','指南'), 'edit-1', NOW)
    expect(changed.pages).toEqual(original.pages); expect(changed.corrections).toHaveLength(1)
    expect(original.corrections).toEqual([])
    await expect(validateSendSnapshot(changed, sent)).rejects.toThrow('SEND_SNAPSHOT_CHANGED')
    const resent = await makeSendSnapshot(changed, [1], [1], NOW)
    expect(resent.text).toContain('指南'); expect(resent.textSha256).not.toBe(sent.textSha256)
  })
  it('unchanged save is a no-op; unsupported whitespace-only edits fail without altering input', async () => {
    const receipt = await make(), before = structuredClone(receipt)
    expect(await correctReadPage(receipt, 1, notices['no-date'], 'same', NOW)).toEqual(before)
    await expect(correctReadPage(receipt, 1, ' '+notices['no-date'], 'spaces', NOW)).rejects.toThrow('WHITESPACE_ONLY_NOT_SAVED')
    expect(receipt).toEqual(before)
  })
  it('keeps image identity and rejects a disguised text source or binary fields', async () => {
    const receipt = await make()
    const image = await createInputReceipt({ inputId: 'image-source', sourceType: 'image', file: {
      name: 'engineering.png', mime: 'image/png', bytes: 2048, sha256: 'a'.repeat(64) }, extractorVersion: 'local-ocr-1', pageCount: 1,
      pages: receipt.pages.map(p => ({ ...p, route: 'ocr' })) })
    expect(image.sourceType).toBe('image'); expect(image.file?.name).toBe('engineering.png')
    await expect(validateInputReceipt({ ...image, sourceType: 'text' })).rejects.toThrow('FILE_IDENTITY')
    await expect(validateInputReceipt({ ...image, imageData: 'data:image/png;base64,AAAA' })).rejects.toThrow('RECEIPT_FIELDS')
  })
  it('never treats missing or failed pages as whole-file success', async () => {
    const first = await make()
    const partial = await createInputReceipt({ inputId: 'partial-pdf', sourceType: 'file',
      file: { name: 'engineering.pdf', mime: 'application/pdf', bytes: 4096, sha256: 'b'.repeat(64) },
      extractorVersion: 'pdf-local-1', pageCount: 7, pages: [first.pages[0], { number: 2, route: 'error', chunks: [], issues: ['READ_FAILED'], parserChunks: null, ocrChunks: null }] })
    expect((await makeSendSnapshot(partial, [1], [1], NOW)).coverage).toBe('selected_partial_source')
    await expect(makeSendSnapshot(partial, [1,2], [1,2], NOW)).rejects.toThrow('UNREAD_PAGE')
    await expect(makeSendSnapshot(partial, [3], [3], NOW)).rejects.toThrow('UNREAD_PAGE')
  })
  it('rejects old reading changes, broken edit history, duplicate ranges and sparse arrays', async () => {
    const original = await make(), changed = structuredClone(original)
    changed.pages[0].chunks[0] += '串源'
    await expect(validateInputReceipt(changed)).rejects.toThrow('READING_CHANGED')
    const edited = await correctReadPage(original, 1, notices['no-date'].replace('手册','指南'), 'edit', NOW)
    edited.corrections[0].beforeSha256 = 'f'.repeat(64)
    await expect(validateInputReceipt(edited)).rejects.toThrow('CORRECTION_CHAIN')
    await expect(makeSendSnapshot(original, [1,1], [1], NOW)).rejects.toThrow('SEND_PAGE_RANGE')
    const sparse = structuredClone(original); sparse.pages.length = 2
    await expect(validateInputReceipt(sparse)).rejects.toThrow('NON_JSON_SPARSE')
  })
  it('does not coerce receipt IDs, correction IDs or file hashes to strings', async () => {
    const original = await make()
    const edited = await correctReadPage(original, 1, notices['no-date'].replace('手册','指南'), 'edit-valid', NOW)
    for (const invalid of [42, true, null, ['valid-id']]) {
      await expect(validateInputReceipt({ ...original, inputId: invalid })).rejects.toThrow()
      await expect(validateInputReceipt({ ...edited, corrections: [{ ...edited.corrections[0], id: invalid }] })).rejects.toThrow()
    }
    const image = { ...original, sourceType: 'image', file: { name: 'engineering.png', mime: 'image/png', bytes: 2048, sha256: 'a'.repeat(64) } }
    expect((await validateInputReceipt(image)).file?.sha256).toBe('a'.repeat(64))
    for (const invalid of [42, true, null, ['a'.repeat(64)]]) {
      await expect(validateInputReceipt({ ...image, file: { ...image.file, sha256: invalid } })).rejects.toThrow()
    }
  })
  it('snapshots consent arrays before awaiting, so later page changes cannot alter this send', async () => {
    const first = await make()
    const source = await createInputReceipt({ inputId: 'two-page-source', sourceType: 'file',
      file: { name: 'engineering.pdf', mime: 'application/pdf', bytes: 4096, sha256: 'b'.repeat(64) },
      extractorVersion: 'pdf-local-1', pageCount: 2,
      pages: [first.pages[0], { ...first.pages[0], number: 2, chunks: textChunks(notices.multi) }] })
    const pages = [1], reviewed = [1]
    const pending = makeSendSnapshot(source, pages, reviewed, NOW)
    pages[0] = 2; reviewed[0] = 2
    const sent = await pending
    expect(sent.pages).toEqual([1]); expect(sent.reviewedPages).toEqual([1])
    expect(sent.text).toBe(notices['no-date']); expect(sent.ranges[0].page).toBe(1)
    expect(await validateSendSnapshot(source, sent)).toEqual(sent)
  })
})
