import type { RecognitionResult } from '../../recognition/types'
import { CapturePersistenceService, type RecognitionExecutor, type SourceRetryRequest } from './capture'

export type ExistingSourceRetryRequest = SourceRetryRequest

/**
 * The only retry entry point exposed to Inbox/Library adapters. It deliberately
 * starts from an existing source ID, so CapturePersistenceService reuses the
 * source's current SourceVersion and appends a new Run/Draft audit trail.
 */
export async function retryExistingSourceRecognition(
  service: CapturePersistenceService,
  sourceId: string,
  request: ExistingSourceRetryRequest,
  executor: RecognitionExecutor,
): Promise<{ draftId: string; result: RecognitionResult }> {
  const handle = await service.beginRetry(sourceId, request)
  if (handle.sourceId !== sourceId || handle.duplicate) throw new Error('CAPTURE_RETRY_SOURCE_MISMATCH')
  const result = await service.recognize(handle, executor)
  return { draftId: handle.draftId, result }
}
