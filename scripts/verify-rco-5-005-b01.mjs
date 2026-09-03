import {
  API_STYLE,
  CONTRACT_HASHES,
  ENDPOINT,
  MODEL,
  ROLES,
  TEMPERATURE,
} from './rco-5-005-b01-lib.mjs'

const allowedArguments = new Set(['--verify-only'])
const unexpected = process.argv.slice(2).filter((argument) => !allowedArguments.has(argument))
if (unexpected.length > 0) {
  throw new Error(`B01_ZERO_CALL_RUNNER_LOCKED:${unexpected.join(',')}`)
}

const result = {
  schemaVersion: 'rco-5-005-b01-offline-verification-1.0.0',
  status: 'ZERO_CALL_CONTRACT_READY_FOR_ADVERSARIAL_TESTS',
  paidRunAuthorized: false,
  newDatasetFrozen: false,
  networkDispatches: 0,
  modelCalls: 0,
  repairCalls: 0,
  endpointCandidate: ENDPOINT,
  apiStyle: API_STYLE,
  modelCandidate: MODEL,
  temperatureCandidate: TEMPERATURE,
  roles: ROLES,
  contractHashes: CONTRACT_HASHES,
  nextAllowedAction: 'REQUEST_AUTHORIZATION_TO_FREEZE_A_NEW_ANONYMOUS_DEVELOPMENT_DATASET',
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
