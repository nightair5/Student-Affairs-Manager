import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const DEFAULT_SCHEMA_URL = new URL('../src/recognition/schema.ts', import.meta.url)

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

let defaultLoad

export async function loadClientRecognitionValidatorSource(source, sourcePath = 'in-memory-schema.ts') {
  const compiled = ts.transpileModule(source, {
    fileName: sourcePath,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      isolatedModules: true,
    },
  })
  const errors = (compiled.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
  if (errors.length) {
    const details = errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('; ')
    throw new Error(`CLIENT_VALIDATOR_TRANSPILE_FAILED:${details}`)
  }
  const dataUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`
  const module = await import(dataUrl)
  if (typeof module.isRecognitionResult !== 'function') throw new Error('CLIENT_VALIDATOR_EXPORT_MISSING')
  return {
    sourcePath,
    sourceSha256: sha256(source),
    validateRecognitionResult: module.validateRecognitionResult,
    isRecognitionResult: module.isRecognitionResult,
  }
}

/**
 * Loads the exact browser-side TypeScript validator in memory for Node evaluation tools.
 * No generated validator or copied schema is written to disk, so browser and evaluator
 * cannot silently drift into two independent contracts.
 */
export async function loadClientRecognitionValidator(schemaUrl = DEFAULT_SCHEMA_URL) {
  if (schemaUrl === DEFAULT_SCHEMA_URL && defaultLoad) return defaultLoad
  const load = (async () => {
    const schemaPath = fileURLToPath(schemaUrl)
    const source = await readFile(schemaPath, 'utf8')
    const loaded = await loadClientRecognitionValidatorSource(source, schemaPath)
    if (typeof loaded.validateRecognitionResult !== 'function') {
      throw new Error('CLIENT_VALIDATOR_EXPORT_MISSING')
    }
    return loaded
  })()
  if (schemaUrl === DEFAULT_SCHEMA_URL) defaultLoad = load
  return load
}
