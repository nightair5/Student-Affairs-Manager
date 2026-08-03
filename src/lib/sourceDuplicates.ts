import type { Source } from '../types'

export interface DuplicateSourceCandidate {
  sourceId: string
  score: number
  reason: string
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\s\p{P}\p{S}]/gu, '')
}

function bigrams(value: string): Set<string> {
  if (value.length < 2) return new Set(value ? [value] : [])
  return new Set(Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2)))
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0
  const intersection = [...left].filter((item) => right.has(item)).length
  const union = new Set([...left, ...right]).size
  return intersection / union
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    url.searchParams.sort()
    url.pathname = url.pathname.replace(/\/$/, '') || '/'
    return url.toString().replace(/\/$/, '')
  } catch {
    return value.trim().replace(/\/$/, '')
  }
}

export function duplicateSourceScore(left: Source, right: Source): number {
  if (left.fileHash && right.fileHash && left.fileHash === right.fileHash) return 1
  if (left.url && right.url && normalizeUrl(left.url) === normalizeUrl(right.url)) return 1
  const leftTitle = normalize(left.title)
  const rightTitle = normalize(right.title)
  const titleScore = leftTitle && leftTitle === rightTitle
    ? 1
    : jaccard(bigrams(leftTitle), bigrams(rightTitle))
  const contentScore = jaccard(
    bigrams(normalize(left.contentPreview)),
    bigrams(normalize(right.contentPreview)),
  )
  return Math.max(titleScore * 0.75 + contentScore * 0.25, contentScore)
}

export function findDuplicateSources(
  source: Source,
  existingSources: Source[],
): DuplicateSourceCandidate[] {
  return existingSources
    .filter((candidate) => candidate.id !== source.id)
    .map((candidate) => {
      const score = duplicateSourceScore(source, candidate)
      return {
        sourceId: candidate.id,
        score,
        reason: source.fileHash && source.fileHash === candidate.fileHash
          ? '文件指纹完全相同'
          : source.url && candidate.url && normalizeUrl(source.url) === normalizeUrl(candidate.url)
            ? '网页链接相同'
            : normalize(source.title) === normalize(candidate.title)
              ? '标题相同，正文摘要也可能重复'
              : '正文摘要高度相似',
      }
    })
    .filter((candidate) => candidate.score >= 0.72)
    .sort((left, right) => right.score - left.score)
}
