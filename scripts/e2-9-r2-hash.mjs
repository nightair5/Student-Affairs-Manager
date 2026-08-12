import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const E2_9_R2_HASH_CONTRACT_VERSION = 'e2-9-r2-bundle-hash-3.0.0'
export const E2_9_R2_BUNDLE_SEPARATOR = '\n--E2-9-R2-BUNDLE-ENTRY--\n'

export function normalizeLf(value) {
  return value.replace(/\r\n?/gu, '\n')
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function canonicalizeFileContent(filePath, rawText) {
  const lf = normalizeLf(rawText)
  return path.extname(filePath).toLowerCase() === '.json' ? canonicalJson(JSON.parse(lf)) : lf
}

export function frameBundleEntry(relativePath, canonicalContent) {
  const normalizedPath = relativePath.replaceAll('\\', '/')
  return `${Buffer.byteLength(normalizedPath, 'utf8')}:${normalizedPath}\n${Buffer.byteLength(canonicalContent, 'utf8')}:${canonicalContent}`
}

export async function hashBundle(root, inputFiles) {
  const files = [...inputFiles].map((file) => file.replaceAll('\\', '/')).sort()
  const entries = []
  for (const file of files) {
    const raw = await readFile(path.join(root, file), 'utf8')
    const canonicalContent = canonicalizeFileContent(file, raw)
    entries.push({ path: file, canonicalSha256: sha256(canonicalContent), canonicalByteLength: Buffer.byteLength(canonicalContent, 'utf8'), frame: frameBundleEntry(file, canonicalContent) })
  }
  const framed = entries.map((entry) => entry.frame).join(E2_9_R2_BUNDLE_SEPARATOR)
  return {
    contractVersion: E2_9_R2_HASH_CONTRACT_VERSION,
    separator: E2_9_R2_BUNDLE_SEPARATOR,
    inputFiles: files,
    entries: entries.map(({ frame, ...entry }) => entry),
    sha256: sha256(framed),
    canonicalByteLength: Buffer.byteLength(framed, 'utf8'),
  }
}
