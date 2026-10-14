import { extractFileEvidence, type FileExtractionOptions, type FileExtractionResult, type LocalExtractionResources } from '../../lib/fileExtraction'
import { createInputReceipt, textChunks, validateInputReceipt, type InputReceipt, type ReadPage } from './inputReceipt'

export const EXTRACTION_PROFILE = 'real-input-01' as const
export interface AcquiredInput { receipt: InputReceipt | null; result: FileExtractionResult }
export async function acquireText(inputId: string, text: string): Promise<InputReceipt> {
  if (!text.trim()) throw Error('REAL_INPUT_EMPTY_TEXT')
  return createInputReceipt({ inputId, sourceType: 'text', file: null, extractorVersion: 'real-input-paste-1', pageCount: 1,
    pages: [{ number: 1, route: 'parser', chunks: textChunks(text), issues: [], parserChunks: textChunks(text), ocrChunks: null }] })
}
export async function acquireFile(inputId: string, file: File, options: {
  resources: LocalExtractionResources; signal: AbortSignal; isCurrent: () => boolean
  onProgress?: FileExtractionOptions['onProgress']; timeoutMs?: number
}): Promise<AcquiredInput | null> {
  const result = await extractFileEvidence(file, { ...options, profile: EXTRACTION_PROFILE })
  if (!result || options.signal.aborted || !options.isCurrent()) return null
  if (!result.fileHash || !['image/png','image/jpeg','image/webp','text/plain','text/markdown','application/pdf'].includes(file.type)
    || file.size === 0 || file.size > (file.type.startsWith('image/') ? 10 : file.type.startsWith('text/') ? 2 : 20) * 1024 * 1024) {
    return { receipt: null, result: result.result }
  }
  const read = result.result
  const pages: ReadPage[] = read.pages?.map(page => ({ number: page.pageNumber, route: page.route,
    chunks: textChunks(page.text), issues: [...page.qualityFlags],
    parserChunks: page.parserText === undefined ? null : textChunks(page.parserText),
    ocrChunks: page.ocrText === undefined ? null : textChunks(page.ocrText) })) ?? [{ number: 1,
    route: read.status === 'ready' ? read.extractionMethod === 'ocr' ? 'ocr' : 'parser' : 'error',
    chunks: textChunks(read.text), issues: read.status === 'ready' ? read.qualityFlags ?? [] : [read.message],
    parserChunks: read.extractionMethod === 'parser' ? textChunks(read.text) : null, ocrChunks: read.extractionMethod === 'ocr' ? textChunks(read.text) : null }]
  const receipt = await createInputReceipt({ inputId, sourceType: file.type.startsWith('image/') ? 'image' : 'file',
    file: { name: file.name, mime: file.type, bytes: file.size, sha256: result.fileHash }, extractorVersion: 'real-input-local-extraction-1',
    pageCount: read.pageCount ?? (file.type === 'application/pdf' ? null : 1), pages })
  if (options.signal.aborted || !options.isCurrent()) return null
  return { receipt, result: read }
}
/** The binary is not persisted: resuming an unfinished read needs the same file again. */
export async function assertSameReselectedFile(receipt: InputReceipt, file: File) {
  const checked = await validateInputReceipt(receipt)
  if (!checked.file || file.name !== checked.file.name || file.type !== checked.file.mime || file.size !== checked.file.bytes) throw Error('REAL_INPUT_RESELECT_IDENTITY')
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('')
  if (hash !== checked.file.sha256) throw Error('REAL_INPUT_RESELECT_HASH')
}
