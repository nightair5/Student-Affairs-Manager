import {createHash} from 'node:crypto'
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs'
import {dirname, join, relative, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {buildContractFixtures} from './candidate12-d3-fixtures.mjs'
import {
  REFERENCE_CONTRACT_VERSION,
  SCORER_INPUT_VERSION,
  canonicalJson,
  sha256,
} from './candidate12-reference-contract.mjs'
import {COMPILER_VERSION} from './compile-candidate12-reference.mjs'
import {SCORER_VERSION} from './score-candidate12-contract-v3.mjs'
import {verifyProtectedFiles} from './verify-candidate11-analysis.mjs'

export const D3_DIRECTORY = 'docs/recognition-optimization/candidate12/d3-scorer-contract'
const D1_DIRECTORY = 'docs/recognition-optimization/candidate12/d1-provisional-paired-preparation'
const D2_DIRECTORY = 'docs/recognition-optimization/candidate12/d2-provisional-development-20260921a'
const AUTHORITY_LEDGER = resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
const EXPECTED = {
  head: 'd23b107ef59268b7a6146023f65cd91cebe1d7e3',
  d1Aggregate: '4afa5b08a368961ba6782b4ac3d4450f6e6d89c02fa034e1eb426f0390855a5b',
  d2Aggregate: '2074b8931077a9975ea61293723d1a668728f3baefb5933da84602f61aab6d53',
  ledgerRows: 742,
  ledgerBytes: 631869,
  ledgerSha: 'df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e',
  ledgerTail: '6812e1b072caeaa4fd3e6e8e55b485c57533bc0a0d9eaaff4dd84bbf48809922',
}
const GENERATED = ['REFERENCE_SCHEMA.json', 'SCORER_INPUT_SCHEMA.json', 'CONTRACT_FIXTURES.json', 'HISTORICAL_REFERENCE_COMPATIBILITY_REPORT.json']
const DOCUMENTS = ['README.md', 'REFERENCE_CONTRACT.md', 'CONTRACT_DECISIONS.md', 'FUTURE_EVALUATION_PREREGISTRATION.md',
  'CANDIDATE13_CHANGE_PLAN.md', 'VALIDATION.md']
const SCRIPTS = ['scripts/candidate12-reference-contract.mjs', 'scripts/compile-candidate12-reference.mjs',
  'scripts/score-candidate12-contract-v3.mjs', 'scripts/candidate12-d3-fixtures.mjs', 'scripts/build-candidate12-d3.mjs',
  'scripts/candidate12-d3.node-test.mjs']

const check = (condition, code) => { if (!condition) throw Error(code) }
const digest = value => createHash('sha256').update(value).digest('hex')
const posix = value => value.replaceAll('\\', '/')

function referenceSchema() {
  const relation = type => ({type: 'object', additionalProperties: false,
    required: ['relationId', 'type', 'fromReferenceTaskId', 'targetReferenceTaskId', 'effective', 'evidence'],
    properties: {relationId: {$ref: '#/$defs/nonEmpty'}, type: {const: type}, fromReferenceTaskId: {type: ['string', 'null']},
      targetReferenceTaskId: {$ref: '#/$defs/nonEmpty'}, effective: {const: true}, evidence: {$ref: '#/$defs/nonEmptyStrings'}}})
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'urn:student-affairs:candidate12:reference-contract:3.0.0',
    title: REFERENCE_CONTRACT_VERSION,
    type: 'object', additionalProperties: false,
    required: ['contractVersion', 'referenceVersion', 'sourceId', 'coverage', 'truthStatus', 'provenance', 'tasks', 'checks'],
    properties: {
      contractVersion: {const: REFERENCE_CONTRACT_VERSION}, referenceVersion: {$ref: '#/$defs/nonEmpty'}, sourceId: {$ref: '#/$defs/nonEmpty'},
      coverage: {enum: ['complete', 'partial']}, truthStatus: {enum: ['INDEPENDENT_HUMAN', 'PROVISIONAL_MODEL_AUTHORED', 'CONTRACT_FIXTURE']},
      provenance: {type: 'object', additionalProperties: false, required: ['labelerAStatus', 'reviewerBStatus', 'modelAssistanceUsed'],
        properties: {labelerAStatus: {$ref: '#/$defs/nonEmpty'}, reviewerBStatus: {$ref: '#/$defs/nonEmpty'}, modelAssistanceUsed: {type: 'boolean'}}},
      tasks: {type: 'array', items: {$ref: '#/$defs/task'}},
      checks: {type: 'array', items: {$ref: '#/$defs/check'}},
    },
    $defs: {
      nonEmpty: {type: 'string', minLength: 1}, nonEmptyStrings: {type: 'array', minItems: 1, uniqueItems: true, items: {$ref: '#/$defs/nonEmpty'}},
      strings: {type: 'array', uniqueItems: true, items: {$ref: '#/$defs/nonEmpty'}},
      alias: {type: 'object', additionalProperties: false, required: ['action', 'object'], properties: {action: {$ref: '#/$defs/nonEmpty'}, object: {$ref: '#/$defs/nonEmpty'}}},
      evidence: {type: 'object', additionalProperties: false, required: ['basis', 'actionEvidence', 'objectEvidence'], properties: {
        basis: {enum: ['explicit_action_object', 'strongly_inferred_action_object']}, actionEvidence: {$ref: '#/$defs/nonEmptyStrings'}, objectEvidence: {$ref: '#/$defs/nonEmptyStrings'}}},
      material: {type: 'object', additionalProperties: false, required: ['materialId', 'names', 'required', 'formatRequirements', 'namingRequirements', 'relatedReferenceTaskIds', 'evidence'],
        properties: {materialId: {$ref: '#/$defs/nonEmpty'}, names: {$ref: '#/$defs/nonEmptyStrings'}, required: {type: 'boolean'}, formatRequirements: {$ref: '#/$defs/strings'},
          namingRequirements: {$ref: '#/$defs/strings'}, relatedReferenceTaskIds: {$ref: '#/$defs/nonEmptyStrings'}, evidence: {$ref: '#/$defs/nonEmptyStrings'}}},
      timePoint: {type: 'object', additionalProperties: false, required: ['timePointId', 'rawTexts', 'type', 'normalizedValues', 'precision', 'actionable', 'relatedReferenceTaskIds', 'evidence'],
        properties: {timePointId: {$ref: '#/$defs/nonEmpty'}, rawTexts: {$ref: '#/$defs/nonEmptyStrings'}, type: {enum: ['deadline', 'event_time', 'availability', 'publication_time', 'other']},
          normalizedValues: {$ref: '#/$defs/strings'}, precision: {enum: ['exact', 'date_only', 'range', 'vague', 'unknown']}, actionable: {type: 'boolean'},
          relatedReferenceTaskIds: {$ref: '#/$defs/nonEmptyStrings'}, evidence: {$ref: '#/$defs/nonEmptyStrings'}}},
      merge: {type: 'object', additionalProperties: false, required: ['withReferenceTaskIds', 'reason'], properties: {withReferenceTaskIds: {$ref: '#/$defs/nonEmptyStrings'}, reason: {$ref: '#/$defs/nonEmpty'}}},
      forbiddenAssertion: {type: 'object', additionalProperties: false, required: ['path', 'operator', 'value'], properties: {path: {enum: ['actions', 'objects', 'semanticStatus', 'semanticValidity', 'actionable', 'condition.value', 'completionStandard.accepted', 'dependencies']}, operator: {enum: ['equals', 'contains', 'setEquals']}, value: {}}},
      forbidden: {type: 'object', additionalProperties: false, required: ['code', 'kind', 'statement', 'evidence', 'assertion'], properties: {code: {$ref: '#/$defs/nonEmpty'}, kind: {enum: ['task', 'field', 'merge', 'relation']}, statement: {$ref: '#/$defs/nonEmpty'}, evidence: {$ref: '#/$defs/nonEmptyStrings'}, assertion: {$ref: '#/$defs/forbiddenAssertion'}}},
      ambiguity: {type: 'object', additionalProperties: false, required: ['ruleId', 'fieldPath', 'allowedValues', 'resolution'], properties: {ruleId: {$ref: '#/$defs/nonEmpty'}, fieldPath: {$ref: '#/$defs/nonEmpty'}, allowedValues: {$ref: '#/$defs/nonEmptyStrings'}, resolution: {enum: ['accept_any', 'require_adjudication']}}},
      check: {type: 'object', additionalProperties: false, required: ['checkId', 'path', 'operator', 'value'], properties: {checkId: {$ref: '#/$defs/nonEmpty'}, path: {$ref: '#/$defs/nonEmpty'}, operator: {enum: ['equals', 'oneOf', 'setEquals', 'requiredFragments', 'forbiddenFragments', 'countEquals']}, value: {}}},
      task: {type: 'object', additionalProperties: false,
        required: ['referenceTaskId', 'actions', 'objects', 'actionObjectAliases', 'taskBasis', 'taskEvidence', 'semanticStatus', 'semanticValidity', 'actionable', 'condition', 'materials', 'timePoints', 'completionStandard', 'dependencies', 'revisionRelations', 'cancellationRelations', 'replacementRelations', 'allowedMerges', 'forbiddenMerges', 'forbiddenInferences', 'requiredFields', 'optionalFields', 'ambiguityRules'],
        properties: {referenceTaskId: {$ref: '#/$defs/nonEmpty'}, actions: {$ref: '#/$defs/nonEmptyStrings'}, objects: {$ref: '#/$defs/nonEmptyStrings'}, actionObjectAliases: {type: 'array', minItems: 1, items: {$ref: '#/$defs/alias'}},
          taskBasis: {enum: ['explicit_action_object', 'strongly_inferred_action_object']}, taskEvidence: {$ref: '#/$defs/evidence'}, semanticStatus: {enum: ['pending', 'completed', 'cancelled', 'historical']},
          semanticValidity: {enum: ['active', 'cancelled', 'superseded', 'expired']}, actionable: {type: 'boolean'}, condition: {type: 'object', additionalProperties: false, required: ['value', 'evidence'], properties: {value: {enum: ['true', 'false', 'unknown', 'not_applicable']}, evidence: {$ref: '#/$defs/strings'}}},
          materials: {type: 'array', items: {$ref: '#/$defs/material'}}, timePoints: {type: 'array', items: {$ref: '#/$defs/timePoint'}}, completionStandard: {type: 'object', additionalProperties: false, required: ['accepted', 'evidence'], properties: {accepted: {$ref: '#/$defs/nonEmptyStrings'}, evidence: {$ref: '#/$defs/nonEmptyStrings'}}},
          dependencies: {$ref: '#/$defs/strings'}, revisionRelations: {type: 'array', items: relation('amends')}, cancellationRelations: {type: 'array', items: relation('cancels')}, replacementRelations: {type: 'array', items: relation('replaces')},
          allowedMerges: {type: 'array', items: {$ref: '#/$defs/merge'}}, forbiddenMerges: {type: 'array', items: {$ref: '#/$defs/merge'}}, forbiddenInferences: {type: 'array', items: {$ref: '#/$defs/forbidden'}},
          requiredFields: {$ref: '#/$defs/nonEmptyStrings'}, optionalFields: {$ref: '#/$defs/strings'}, ambiguityRules: {type: 'array', items: {$ref: '#/$defs/ambiguity'}}}},
    },
  }
}

function scorerInputSchema() {
  return {$schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'urn:student-affairs:candidate12:scorer-input:3.0.0',
    title: SCORER_INPUT_VERSION, type: 'object', additionalProperties: false,
    required: ['version', 'contractVersion', 'compilerVersion', 'sourceId', 'referenceVersion', 'coverage', 'truthStatus', 'inputSha256', 'tasks', 'checks', 'boundary', 'compiledSha256'],
    properties: {version: {const: SCORER_INPUT_VERSION}, contractVersion: {const: REFERENCE_CONTRACT_VERSION}, compilerVersion: {const: COMPILER_VERSION},
      sourceId: {type: 'string', minLength: 1}, referenceVersion: {type: 'string', minLength: 1}, coverage: {enum: ['complete', 'partial']}, truthStatus: {type: 'string'},
      inputSha256: {type: 'string', pattern: '^[0-9a-f]{64}$'}, tasks: {type: 'array'}, checks: {type: 'array'}, boundary: {type: 'object'}, compiledSha256: {type: 'string', pattern: '^[0-9a-f]{64}$'}}}
}

function walkFiles(root) {
  const files = []
  for (const entry of readdirSync(root, {recursive: true})) {
    const full = join(root, entry)
    if (statSync(full).isFile()) files.push({path: posix(relative(root, full)), bytes: statSync(full).size,
      sha256: digest(readFileSync(full))})
  }
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

function aggregate(root) {
  const files = walkFiles(root)
  return {count: files.length, aggregateSha256: digest(JSON.stringify(files))}
}

function verifyD2Manifest(root) {
  const directory = resolve(root, D2_DIRECTORY)
  const manifest = JSON.parse(readFileSync(join(directory, 'RESULT_MANIFEST.json'), 'utf8'))
  for (const file of manifest.files) {
    const bytes = readFileSync(join(directory, file.path))
    check(bytes.length === file.bytes && digest(bytes) === file.sha256, `D3_D2_FILE_DRIFT:${file.path}`)
  }
  return {manifestFiles: manifest.files.length, raw: manifest.files.filter(file => file.path.startsWith('raw/')).length,
    results: manifest.files.filter(file => file.path.startsWith('results/')).length, decision: manifest.officialDecision}
}

function historicalCompatibility(root) {
  const source = JSON.parse(readFileSync(resolve(root, D1_DIRECTORY, 'PROVISIONAL_REFERENCES.json'), 'utf8'))
  const cases = source.references.map(item => {
    const legacy = item.reference.scorerReference
    const taskFailures = legacy.tasks.flatMap((task, index) => [
      ...(!Array.isArray(task.actions) || task.actions.length === 0 ? [{path: `scorerReference.tasks[${index}].actions`, code: 'ACTIONS_ARRAY_MISSING'}] : []),
      ...(!Array.isArray(task.objects) || task.objects.length === 0 ? [{path: `scorerReference.tasks[${index}].objects`, code: 'OBJECTS_ARRAY_MISSING'}] : []),
      ...(!task.fields || typeof task.fields !== 'object' ? [{path: `scorerReference.tasks[${index}].fields`, code: 'FIELDS_OBJECT_MISSING'}] : []),
    ])
    const checkFailures = legacy.checks.flatMap((check, index) => typeof check === 'string'
      ? [{path: `scorerReference.checks[${index}]`, code: 'NATURAL_LANGUAGE_CHECK_NOT_MACHINE_READABLE'}] : [])
    return {sourceId: item.sourceId, legacyReferenceSha256: item.referenceSha256, taskCount: legacy.tasks.length,
      compatibleWithV3: false, failures: [...taskFailures, ...checkFailures],
      requiresIndependentRelabeling: true, automaticConversionAllowed: false, historicalDiagnosticOnly: true,
      humanFieldsRequired: ['actions[]', 'objects[]', 'actionObjectAliases[]', 'structured fields', 'condition evidence',
        'completion standard', 'relations', 'merge rules', 'forbidden inferences', 'ambiguity rules']}
  })
  return {version: 'candidate12-d3-historical-compatibility-1', status: 'HISTORICAL_REFERENCES_INCOMPATIBLE_NO_RETROACTIVE_RESCORING',
    sourceVersion: source.version, sources: cases.length, taskIdentityFailures: cases.filter(item => item.taskCount > 0).length,
    naturalLanguageCheckFailures: cases.length, compatible: cases.filter(item => item.compatibleWithV3).length,
    officialD2DecisionPreserved: 'REJECT_CANDIDATE12_ENGINEERING_SCREEN', cases,
    boundary: ['No D1 Expected was changed', 'No D2 result was rescored for promotion', 'No automatic conversion is an independent human label']}
}

function verifyLedger() {
  const bytes = readFileSync(AUTHORITY_LEDGER)
  const rows = bytes.toString('utf8').trimEnd().split(/\r?\n/).map(JSON.parse)
  const result = {path: AUTHORITY_LEDGER, rows: rows.length, bytes: bytes.length, sha256: digest(bytes), tail: rows.at(-1).hash, writerOpened: false}
  check(result.rows === EXPECTED.ledgerRows && result.bytes === EXPECTED.ledgerBytes && result.sha256 === EXPECTED.ledgerSha
    && result.tail === EXPECTED.ledgerTail, 'D3_AUTHORITY_LEDGER_DRIFT')
  return result
}

function generatedOutputs(root) {
  const fixtures = buildContractFixtures()
  return {
    'REFERENCE_SCHEMA.json': canonicalJson(referenceSchema()),
    'SCORER_INPUT_SCHEMA.json': canonicalJson(scorerInputSchema()),
    'CONTRACT_FIXTURES.json': canonicalJson({version: 'candidate12-d3-contract-fixtures-1', evaluationRole: 'ANONYMOUS_CONTRACT_FIXTURE_ONLY',
      notDevelopmentOrHoldout: true, categories: fixtures.length, cases: fixtures}),
    'HISTORICAL_REFERENCE_COMPATIBILITY_REPORT.json': canonicalJson(historicalCompatibility(root)),
  }
}

function manifest(root, generatedAt) {
  const directory = resolve(root, D3_DIRECTORY)
  const d1 = aggregate(resolve(root, D1_DIRECTORY)), d2 = aggregate(resolve(root, D2_DIRECTORY))
  check(d1.aggregateSha256 === EXPECTED.d1Aggregate, 'D3_D1_FROZEN_DRIFT')
  check(d2.aggregateSha256 === EXPECTED.d2Aggregate, 'D3_D2_FROZEN_DRIFT')
  const protection = verifyProtectedFiles(root)
  check(protection.count === 84, 'D3_PROTECTED_FILES_DRIFT')
  const paths = [...GENERATED, ...DOCUMENTS].map(name => `${D3_DIRECTORY}/${name}`).concat(SCRIPTS)
  const files = paths.map(path => {
    const bytes = readFileSync(resolve(root, path))
    return {path, bytes: bytes.length, sha256: digest(bytes)}
  })
  return {
    version: 'candidate12-d3-scorer-contract-manifest-1', status: 'D3_SCORER_CONTRACT_READY_FOR_FRESH_DATA', generatedAt,
    baselineHead: EXPECTED.head, versions: {referenceContract: REFERENCE_CONTRACT_VERSION, scorerInput: SCORER_INPUT_VERSION,
      compiler: COMPILER_VERSION, scorer: SCORER_VERSION},
    fixtures: {categories: 24, valid: 24, invalid: 24, evaluationRole: 'ANONYMOUS_CONTRACT_FIXTURE_ONLY'},
    historicalCompatibility: {sources: 12, taskIdentityFailures: 10, naturalLanguageCheckFailures: 12, compatible: 0,
      officialD2DecisionPreserved: 'REJECT_CANDIDATE12_ENGINEERING_SCREEN'},
    frozenEvidence: {d1, d2, d2Manifest: verifyD2Manifest(root), protectedFiles: protection.count, authorityLedger: verifyLedger()},
    files,
    operations: {modelCalls: 0, secretReads: 0, grants: 0, reserves: 0, settlements: 0, ledgerWrites: 0,
      humanTrials: 0, holdoutRequests: 0, merge: 0, deploy: 0},
    boundaries: {workspaceSchemaChanged: false, dependenciesChanged: false, defaultCandidateChanged: false,
      candidate13ModelEvaluated: false, historicalExpectedChanged: false, historicalD2RescoredForPromotion: false},
    nextStageRequires: ['fresh anonymous Development or independent human Holdout', 'Candidate13 frozen before new Expected is visible',
      'new model-call authorization and budget only after zero-call package review'],
  }
}

function writeGenerated(root) {
  const directory = resolve(root, D3_DIRECTORY)
  mkdirSync(directory, {recursive: true})
  for (const [name, contents] of Object.entries(generatedOutputs(root))) writeFileSync(join(directory, name), contents)
  const manifestPath = join(directory, 'MANIFEST.json')
  const generatedAt = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')).generatedAt : new Date().toISOString()
  writeFileSync(manifestPath, canonicalJson(manifest(root, generatedAt)))
  return JSON.parse(readFileSync(manifestPath, 'utf8'))
}

export function verifyD3(root = process.cwd()) {
  const directory = resolve(root, D3_DIRECTORY)
  const manifestPath = join(directory, 'MANIFEST.json')
  check(existsSync(manifestPath), 'D3_MANIFEST_MISSING')
  const frozen = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const outputs = generatedOutputs(root)
  for (const [name, contents] of Object.entries(outputs)) check(readFileSync(join(directory, name), 'utf8') === contents, `D3_GENERATED_DRIFT:${name}`)
  check(readFileSync(manifestPath, 'utf8') === canonicalJson(manifest(root, frozen.generatedAt)), 'D3_MANIFEST_DRIFT')
  return frozen
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode] = process.argv.slice(2)
  check(['--write', '--verify'].includes(mode), 'D3_USAGE')
  const result = mode === '--write' ? writeGenerated(process.cwd()) : verifyD3(process.cwd())
  console.log(JSON.stringify({status: result.status, versions: result.versions, fixtures: result.fixtures,
    historicalCompatibility: result.historicalCompatibility, operations: result.operations, ledger: result.frozenEvidence.authorityLedger}))
}
