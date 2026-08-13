/* global console, process */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const R5_POST_GENERATION_ENTRYPOINTS = Object.freeze([
  'scripts/prepare-e2-9-r5-packet-preview.mjs',
  'scripts/finalize-e2-9-r5-packet.mjs',
  'scripts/reveal-e2-9-r5-adjudication.mjs',
  'scripts/score-e2-9-r5.mjs',
  'scripts/evaluate-e2-9-r5-gate.mjs',
])

function importedNames(clause) {
  const names = []
  const normalized = clause.replace(/\s+/gu, ' ').trim()
  if (!normalized.startsWith('{') && !normalized.startsWith('*')) names.push('default')
  const named = normalized.match(/\{([^}]*)\}/u)?.[1] ?? ''
  for (const item of named.split(',').map((value) => value.trim()).filter(Boolean)) {
    const sourceName = item.replace(/^type\s+/u, '').split(/\s+as\s+/u)[0]?.trim()
    if (sourceName) names.push(sourceName)
  }
  return [...new Set(names)]
}

function staticImports(source) {
  const imports = []
  const pattern = /^\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/gmu
  for (const match of source.matchAll(pattern)) {
    imports.push({ specifier: match[2], names: importedNames(match[1]) })
  }
  return imports
}

function resolvedSpecifier(entryPath, specifier) {
  if (specifier.startsWith('.')) return new URL(specifier, pathToFileURL(entryPath)).href
  return specifier
}

export async function verifyEntrypointImportContracts({ root = process.cwd(), entryFiles = R5_POST_GENERATION_ENTRYPOINTS } = {}) {
  const verified = []
  for (const relativeEntry of entryFiles) {
    const entryPath = path.resolve(root, relativeEntry)
    const source = await readFile(entryPath, 'utf8')
    const imports = staticImports(source)
    for (const dependency of imports) {
      const namespace = await import(resolvedSpecifier(entryPath, dependency.specifier))
      for (const name of dependency.names) {
        if (!(name in namespace)) {
          throw new Error(`ENTRYPOINT_IMPORT_MISSING_EXPORT:${relativeEntry}:${dependency.specifier}:${name}`)
        }
      }
    }
    verified.push({ entry: relativeEntry, imports: imports.length })
  }
  return { status: 'PASS', entrypoints: verified.length, verified }
}

const invokedDirectly = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (invokedDirectly) {
  console.log(JSON.stringify(await verifyEntrypointImportContracts(), null, 2))
}
