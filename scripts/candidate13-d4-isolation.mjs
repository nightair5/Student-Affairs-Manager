import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {sha256, stable} from './candidate12-reference-contract.mjs'
import {buildCandidate13EngineeringFixtures, validateCandidate13EngineeringFixtures} from './candidate13-d4-fixtures.mjs'

export const D4_BINDING_VERSION = 'candidate13-d4-binding-1.0.0'
export const D4_DEFAULT_COMPONENTS = {
  'src/experiments/realInput01/candidate03.ts': 'f3a2dd9358ca2a50b9b3eba8a090211666db4c0fb8dc5fc146e742c9895f9508',
  'src/experiments/realInput01/candidate12.ts': 'b4f6db69360019bc81355edf181fda48ae8470d1a84d8034545e7f458b1c4bfe',
  'src/experiments/realInput01/modelWire.ts': 'c7c81ae516c30faec850f4d765ae625d2cf1d11f39ed0d515ab93da45efb8be2',
  'src/experiments/realInput01/modelClient.ts': 'fd639d306f069296054abd44ba29c2d9124c3a21b515f341a03c90f3adad5359',
  'src/experiments/mainline04/semanticContract.ts': 'fca1be185c94d169f2505ad420f107aed24fe49c0208e80ea784b65f80188961',
}

const check = (value, code) => { if (!value) throw Error(code) }
const hashFile = (root, path) => sha256(readFileSync(resolve(root, path)))

export function buildCandidate13Binding(metadata, bindings) {
  const payload = {
    version: D4_BINDING_VERSION,
    candidateVersion: metadata.candidateVersion,
    promptVersion: metadata.promptVersion,
    promptSha: metadata.promptSha,
    schemaSha: metadata.schemaSha,
    modelConfig: metadata.modelConfig,
    adapterSha: bindings.adapterSha,
    referenceContractVersion: metadata.referenceContractVersion,
    referenceContractSha: bindings.referenceContractSha,
    compilerVersion: bindings.compilerVersion,
    compilerSha: bindings.compilerSha,
    scorerVersion: metadata.scorerVersion,
    scorerSha: bindings.scorerSha,
    fixtureSha: bindings.fixtureSha,
  }
  return {...payload, bindingSha: sha256(stable(payload))}
}

export function assertCandidate13Binding(actual, frozen) {
  check(stable(actual) === stable(frozen), 'D4_BINDING_DRIFT')
  check(actual.bindingSha === sha256(stable(Object.fromEntries(Object.entries(actual).filter(([key]) => key !== 'bindingSha')))), 'D4_BINDING_HASH')
  return actual
}

export function rejectCandidate13D4Dispatch() {
  throw Error('D4_MODEL_CALL_NOT_AUTHORIZED')
}

export function verifyCandidate13D4Isolation(root = process.cwd()) {
  for (const [path, expected] of Object.entries(D4_DEFAULT_COMPONENTS)) check(hashFile(root, path) === expected, `D4_PROTECTED_COMPONENT_DRIFT:${path}`)
  const implementation = readFileSync(resolve(root, 'src/experiments/realInput01/candidate13.ts'), 'utf8')
  const imports = [...implementation.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(match => match[1])
  const allowedImports = new Set(['./candidate03', './candidate12', './modelWire', './inputReceipt'])
  check(imports.every(path => allowedImports.has(path)), 'D4_CANDIDATE13_IMPORT_BOUNDARY')
  for (const token of ['process.env', 'fetch(', 'DEEPSEEK_API_KEY', 'CALL_LEDGER', 'grant', 'reserve', 'settle',
    'c1-holdout-preparation', 'future-development', 'PROVISIONAL_REFERENCES', 'RESULT_MANIFEST']) {
    check(!implementation.includes(token), `D4_CANDIDATE13_FORBIDDEN_RUNTIME_TOKEN:${token}`)
  }
  for (const path of ['src/App.tsx', 'src/main.tsx', 'src/experiments/realInput01/browser.tsx',
    'src/experiments/realInput01/runtime.ts', 'src/experiments/realInput01/modelClient.ts', 'src/experiments/candidate11/runtime.tsx']) {
    check(!readFileSync(resolve(root, path), 'utf8').includes('candidate13'), `D4_DEFAULT_ENTRY_CHANGED:${path}`)
  }
  const fixtures = buildCandidate13EngineeringFixtures()
  const fixtureValidation = validateCandidate13EngineeringFixtures(fixtures)
  check(fixtures.every(row => row.seen && !row.eligibleForFreshDevelopment && !row.eligibleForIndependentHoldout), 'D4_FIXTURE_FRESHNESS_CLAIM')
  return {
    status: 'D4_FRESH_DATA_ISOLATION_PASS',
    candidateImports: imports,
    defaultComponents: D4_DEFAULT_COMPONENTS,
    fixtureValidation,
    freshDevelopmentSourcesObserved: 0,
    freshExpectedObserved: 0,
    holdoutSourcesObserved: 0,
    holdoutExpectedObserved: 0,
    formalRequestIdentitiesCreated: 0,
    modelDispatchPathPresent: false,
    defaultCandidateChanged: false,
    previewChanged: false,
    productionChanged: false,
    nextDataRule: 'Candidate13 freeze commit must precede creation or disclosure of any fresh Expected.',
  }
}
