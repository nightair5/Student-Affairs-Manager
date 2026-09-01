/* global console, process */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const sourceUrl = new URL('../src/recognition/schema.ts', import.meta.url)
const outputUrl = new URL('../cloudflare/recognition-contract.generated.mjs', import.meta.url)

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function generateRecognitionContract(source) {
  const compiled = ts.transpileModule(source, {
    fileName: fileURLToPath(sourceUrl),
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      isolatedModules: true,
      removeComments: false,
    },
  })
  const errors = (compiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) {
    const detail = errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('; ')
    throw new Error(`RECOGNITION_CONTRACT_GENERATION_FAILED:${detail}`)
  }
  const sourceSha256 = sha256(source)
  return `// GENERATED from src/recognition/schema.ts; do not edit.\n// source-sha256: ${sourceSha256}\n${compiled.outputText}`
}

async function main() {
  const source = await readFile(sourceUrl, 'utf8')
  const generated = generateRecognitionContract(source)
  if (process.argv.includes('--check')) {
    const current = await readFile(outputUrl, 'utf8').catch(() => '')
    if (current !== generated) throw new Error('RECOGNITION_CONTRACT_GENERATED_FILE_STALE')
    console.log(JSON.stringify({ status: 'PASS', sourceSha256: sha256(source), output: fileURLToPath(outputUrl) }))
    return
  }
  await writeFile(outputUrl, generated, 'utf8')
  console.log(JSON.stringify({ status: 'WROTE', sourceSha256: sha256(source), output: fileURLToPath(outputUrl) }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main()
}
