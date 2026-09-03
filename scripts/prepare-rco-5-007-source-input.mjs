import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const datasetPath = resolve(root, 'docs/recognition-optimization/RCO-5-006-B1_DEVELOPMENT_DATASET.json')
const outputPath = resolve(root, 'docs/recognition-optimization/rco-5-007-replay/b1-source-input.json')

const sourceBytes = await readFile(datasetPath)
const dataset = JSON.parse(sourceBytes.toString('utf8'))
const output = {
  schemaVersion: 'rco-5-007-source-only-input-1.0.0',
  authorizationId: 'RCO-5-007',
  classification: 'SEEN_DIAGNOSTIC_REPLAY',
  sourceDatasetId: dataset.datasetId,
  sourceDatasetSha256: createHash('sha256').update(sourceBytes).digest('hex'),
  containsExpected: false,
  cases: dataset.cases.map((item) => ({
    id: item.id,
    sourceTitle: item.sourceTitle,
    sourceText: item.sourceText,
    sourceVersionId: 'source-v1',
    referenceTime: item.referenceTime,
    timezone: item.timezone,
  })),
}
if (JSON.stringify(output).includes('"expected"')) throw new Error('SOURCE_ONLY_INPUT_CONTAINS_EXPECTED')
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, cases: output.cases.length, containsExpected: output.containsExpected }))

