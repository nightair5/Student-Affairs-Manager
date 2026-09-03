import type { ImmutableScopeIndex } from './scopeReferenceContract'

export const SCOPE_INDEX_VERSION = 'scope-index-1.1' as const

function boundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

async function sha256(value: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return `sha256:${Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function isTerminal(source: string, index: number): boolean {
  const value = source[index]
  if (value === ':' || value === '：') {
    return !(index > 0 && index + 1 < source.length && /\d/u.test(source[index - 1]) && /\d/u.test(source[index + 1]))
  }
  return /[。！？；;!?，,]/u.test(value.normalize('NFKC')) || /[؟⁇⁈⁉]/u.test(value)
}

export async function indexImmutableScopesV11(sourceId: string, sourceVersionId: string, sourceContent: string): Promise<ImmutableScopeIndex> {
  if (!boundedString(sourceId, 160) || !boundedString(sourceVersionId, 160) || !boundedString(sourceContent, 100_000)) {
    throw new Error('SCOPE_SOURCE_INVALID')
  }
  const sourceFingerprint = await sha256(`${sourceId}\u0000${sourceVersionId}\u0000${sourceContent}`)
  const boundaries: Array<{ start: number; end: number; text: string }> = []
  let cursor = 0
  const emit = (rawEnd: number) => {
    let start = cursor
    let end = rawEnd
    while (start < end && /\s/u.test(sourceContent[start])) start += 1
    while (end > start && /\s/u.test(sourceContent[end - 1])) end -= 1
    if (end > start) boundaries.push({ start, end, text: sourceContent.slice(start, end) })
    cursor = rawEnd
  }
  for (let index = 0; index < sourceContent.length; index += 1) {
    if (isTerminal(sourceContent, index)) {
      let end = index + 1
      while (end < sourceContent.length && isTerminal(sourceContent, end)) end += 1
      emit(end)
      index = end - 1
    } else if (/\r|\n/u.test(sourceContent[index])) {
      let end = index + 1
      while (end < sourceContent.length && /\r|\n/u.test(sourceContent[end])) end += 1
      emit(end)
      index = end - 1
    }
  }
  if (cursor < sourceContent.length) emit(sourceContent.length)
  const scopes = await Promise.all(boundaries.map(async (boundary, order) => {
    const contentHash = await sha256(`${SCOPE_INDEX_VERSION}\u0000${sourceFingerprint}\u0000${order}\u0000${boundary.start}\u0000${boundary.end}\u0000${boundary.text}`)
    return {
      id: `scope-${String(order + 1).padStart(4, '0')}-${contentHash.slice(7)}`,
      sourceId,
      sourceVersionId,
      sourceFingerprint,
      order,
      ...boundary,
      contentHash,
    }
  }))
  return { sourceId, sourceVersionId, sourceFingerprint, sourceContent, scopes }
}
