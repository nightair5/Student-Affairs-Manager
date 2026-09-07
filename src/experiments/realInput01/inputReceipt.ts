import { plainJson, stableJson } from '../mainline04/semanticContract'

export const RECEIPT_VERSION = 'real-input-receipt-1' as const
export type InputKind = 'text' | 'image' | 'file'
export type PageRoute = 'parser' | 'ocr' | 'empty' | 'error' | 'unprocessed'
export interface ReadPage {
  number: number; route: PageRoute; chunks: string[]; issues: string[]
  parserChunks: string[] | null; ocrChunks: string[] | null
}
export interface InputFileIdentity { name: string; mime: string; bytes: number; sha256: string }
export interface TextCorrection { id: string; at: string; page: number; beforeSha256: string; chunks: string[] }
export interface InputReceipt {
  version: typeof RECEIPT_VERSION; inputId: string; sourceType: InputKind; file: InputFileIdentity | null
  extractorVersion: string; pageCount: number | null; pages: ReadPage[]; originalSha256: string
  corrections: TextCorrection[]
}
export interface SendSnapshot {
  version: 'real-input-send-1'; inputId: string; receiptSha256: string; text: string; textSha256: string
  pages: number[]; ranges: Array<{ page: number; start: number; end: number; pageTextSha256: string }>
  coverage: 'complete_declared_range' | 'selected_partial_source'; reviewedPages: number[]; consentAt: string
}
const guard = (condition: unknown, code: string): void => { if (!condition) throw Error('REAL_INPUT_' + code) }
const exact = (value: object, keys: string[]) => guard(stableJson(Object.keys(value).sort()) === stableJson([...keys].sort()), 'RECEIPT_FIELDS')
const digestPattern = /^[a-f0-9]{64}$/
const operationPattern = /^[a-zA-Z0-9-]{1,100}$/
export const textChunks = (text: string): string[] => {
  guard(typeof text === 'string' && text.length <= 500000, 'LOCAL_TEXT_LIMIT')
  return text.match(/[\s\S]{1,4000}/gu) ?? []
}
export async function sha256Text(text: string): Promise<string> {
  const value = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
const chunksValid = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 200
  && value.every(text => typeof text === 'string' && text.length <= 8000)
const dateValid = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const originals = (receipt: InputReceipt) => receipt.pages.map(page => ({ page: page.number, route: page.route,
  chunks: page.chunks, parserChunks: page.parserChunks, ocrChunks: page.ocrChunks, issues: page.issues }))

export async function validateInputReceipt(input: unknown): Promise<InputReceipt> {
  const receipt = plainJson(input) as InputReceipt
  guard(receipt && typeof receipt === 'object' && !Array.isArray(receipt), 'RECEIPT_OBJECT')
  exact(receipt, ['version','inputId','sourceType','file','extractorVersion','pageCount','pages','originalSha256','corrections'])
  guard(receipt.version === RECEIPT_VERSION && typeof receipt.inputId === 'string' && operationPattern.test(receipt.inputId), 'RECEIPT_VERSION')
  guard(['text','image','file'].includes(receipt.sourceType) && typeof receipt.extractorVersion === 'string'
    && receipt.extractorVersion.length > 0 && receipt.extractorVersion.length <= 200, 'RECEIPT_TYPE')
  if (receipt.file === null) guard(receipt.sourceType === 'text', 'FILE_IDENTITY_REQUIRED')
  else {
    guard(receipt.file && typeof receipt.file === 'object' && !Array.isArray(receipt.file), 'FILE_IDENTITY')
    exact(receipt.file, ['name','mime','bytes','sha256'])
    guard(receipt.sourceType !== 'text' && typeof receipt.file.name === 'string' && receipt.file.name.length > 0
      && receipt.file.name.length <= 300 && Number.isSafeInteger(receipt.file.bytes) && receipt.file.bytes > 0
      && receipt.file.bytes <= 20 * 1024 * 1024 && typeof receipt.file.sha256 === 'string'
      && digestPattern.test(receipt.file.sha256), 'FILE_IDENTITY')
    guard(receipt.sourceType === 'image' ? ['image/png','image/jpeg','image/webp'].includes(receipt.file.mime)
      && receipt.file.bytes <= 10 * 1024 * 1024 : ['application/pdf','text/plain','text/markdown'].includes(receipt.file.mime), 'FILE_MIME')
    if (receipt.file.mime.startsWith('text/')) guard(receipt.file.bytes <= 2 * 1024 * 1024, 'TEXT_FILE_LIMIT')
  }
  guard(receipt.pageCount === null || Number.isSafeInteger(receipt.pageCount) && receipt.pageCount > 0 && receipt.pageCount <= 100000, 'PAGE_COUNT')
  guard(Array.isArray(receipt.pages) && receipt.pages.length <= 1000 && Array.isArray(receipt.corrections), 'PAGES')
  const ids = new Set<number>(), textByPage = new Map<number,string>()
  for (const page of receipt.pages) {
    exact(page, ['number','route','chunks','issues','parserChunks','ocrChunks'])
    guard(Number.isSafeInteger(page.number) && page.number > 0 && !ids.has(page.number)
      && (receipt.pageCount === null || page.number <= receipt.pageCount), 'PAGE_ID')
    guard(['parser','ocr','empty','error','unprocessed'].includes(page.route) && chunksValid(page.chunks)
      && (page.parserChunks === null || chunksValid(page.parserChunks)) && (page.ocrChunks === null || chunksValid(page.ocrChunks))
      && Array.isArray(page.issues) && page.issues.every(x => typeof x === 'string' && x.length <= 1000), 'PAGE_SHAPE')
    guard(!['empty','unprocessed'].includes(page.route) || page.chunks.length === 0, 'PAGE_FALSE_SUCCESS')
    ids.add(page.number); textByPage.set(page.number, page.chunks.join(''))
  }
  guard(receipt.pages.reduce((sum,p) => sum+p.chunks.join('').length,0) <= 500000, 'LOCAL_TEXT_LIMIT')
  guard(receipt.pages.every((p,i) => i === 0 || receipt.pages[i-1].number < p.number), 'PAGE_ORDER')
  guard(receipt.originalSha256 === await sha256Text(stableJson(originals(receipt))), 'READING_CHANGED')
  let lastTime = -Infinity
  const operations = new Set<string>()
  for (const correction of receipt.corrections) {
    exact(correction, ['id','at','page','beforeSha256','chunks'])
    guard(typeof correction.id === 'string' && operationPattern.test(correction.id) && !operations.has(correction.id) && dateValid(correction.at)
      && Date.parse(correction.at) >= lastTime && ids.has(correction.page) && chunksValid(correction.chunks), 'CORRECTION_SHAPE')
    guard(correction.beforeSha256 === await sha256Text(textByPage.get(correction.page)!), 'CORRECTION_CHAIN')
    const before = textByPage.get(correction.page)!, after = correction.chunks.join('')
    guard(before !== after && before.trim() !== after.trim(), 'WHITESPACE_ONLY_NOT_SAVED')
    guard(after.length <= 500000, 'LOCAL_TEXT_LIMIT')
    textByPage.set(correction.page, after); operations.add(correction.id); lastTime = Date.parse(correction.at)
  }
  return receipt
}

export async function createInputReceipt(input: Omit<InputReceipt, 'version' | 'originalSha256' | 'corrections'>) {
  const receipt: InputReceipt = { ...plainJson(input), version: RECEIPT_VERSION, originalSha256: '', corrections: [] }
  receipt.originalSha256 = await sha256Text(stableJson(originals(receipt)))
  return validateInputReceipt(receipt)
}
export function effectivePages(receipt: InputReceipt): Array<{ number: number; text: string }> {
  return receipt.pages.map(page => ({ number: page.number,
    text: receipt.corrections.filter(edit => edit.page === page.number).at(-1)?.chunks.join('') ?? page.chunks.join('') }))
}
export async function correctReadPage(input: InputReceipt, page: number, text: string, id: string, at: string) {
  const receipt = await validateInputReceipt(input)
  const before = effectivePages(receipt).find(p => p.number === page)?.text
  guard(before !== undefined, 'PAGE_NOT_FOUND')
  if (before === text) return receipt
  receipt.corrections.push({ id, at, page, beforeSha256: await sha256Text(before!), chunks: textChunks(text) })
  return validateInputReceipt(receipt)
}

/** Consent binds the saved version; a new range, edit or source invalidates it. */
export async function makeSendSnapshot(input: InputReceipt, pages: number[], reviewedPages: number[], consentAt: string): Promise<SendSnapshot> {
  // Capture the user's request before the first await; never retain mutable UI arrays.
  const requested = plainJson({ pages, reviewedPages })
  pages = requested.pages; reviewedPages = requested.reviewedPages
  const receipt = await validateInputReceipt(input)
  guard(pages.length > 0 && pages.length <= 6 && new Set(pages).size === pages.length
    && pages.every((p,i) => i === 0 || pages[i-1] < p) && dateValid(consentAt), 'SEND_PAGE_RANGE')
  guard(new Set(reviewedPages).size === reviewedPages.length && reviewedPages.every(p => pages.includes(p))
    && pages.every(p => reviewedPages.includes(p)), 'READING_REVIEW_REQUIRED')
  const effective = effectivePages(receipt), ranges: SendSnapshot['ranges'] = []
  let text = ''
  for (const number of pages) {
    const page = receipt.pages.find(p => p.number === number), value = effective.find(p => p.number === number)?.text
    guard(page && ['parser','ocr','empty'].includes(page.route) && value !== undefined, 'UNREAD_PAGE')
    if (text) text += '\n\n'
    const start = text.length; text += value!
    ranges.push({ page: number, start, end: text.length, pageTextSha256: await sha256Text(value!) })
  }
  guard(text.trim() && text.length <= 24000, 'SEND_TEXT_LIMIT')
  const complete = receipt.pageCount !== null && pages.length === receipt.pageCount && pages.every((p,i) => p === i+1)
  return { version: 'real-input-send-1', inputId: receipt.inputId, receiptSha256: await sha256Text(stableJson(receipt)),
    text, textSha256: await sha256Text(text), pages: [...pages], ranges,
    coverage: complete ? 'complete_declared_range' : 'selected_partial_source', reviewedPages: [...reviewedPages], consentAt }
}
export async function validateSendSnapshot(receipt: InputReceipt, input: unknown): Promise<SendSnapshot> {
  const value = plainJson(input) as SendSnapshot
  guard(value && typeof value === 'object' && !Array.isArray(value), 'SEND_OBJECT')
  exact(value, ['version','inputId','receiptSha256','text','textSha256','pages','ranges','coverage','reviewedPages','consentAt'])
  const recomputed = await makeSendSnapshot(receipt, value.pages, value.reviewedPages, value.consentAt)
  guard(stableJson(value) === stableJson(recomputed), 'SEND_SNAPSHOT_CHANGED')
  return recomputed
}
