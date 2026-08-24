#Requires -Version 7.0

param([switch]$LocalRuntimePreflightOnly)

$ErrorActionPreference = 'Stop'

function New-R10Token {
  $bytes = [byte[]]::new(48)
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
    [Convert]::ToBase64String($bytes)
  } finally {
    $generator.Dispose()
  }
}

function Get-R10Sha256([string]$Value) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
  $hash = [System.Security.Cryptography.SHA256]::HashData($bytes)
  ([Convert]::ToHexString($hash)).ToLowerInvariant()
}

function Get-LatestR10Version([string]$ConfigPath) {
  $raw = npx wrangler versions list --config $ConfigPath --json 2>$null
  if ($LASTEXITCODE -ne 0) { throw "R10_VERSION_LIST_FAILED:$ConfigPath" }
  $versions = $raw | ConvertFrom-Json
  $latest = $versions | Sort-Object { $_.metadata.created_on } -Descending | Select-Object -First 1
  if ($null -eq $latest -or $latest.id -notmatch '^[0-9a-f-]{36}$') {
    throw "R10_VERSION_UNAVAILABLE:$ConfigPath"
  }
  $latest.id
}

if ($LocalRuntimePreflightOnly) {
  $preflightToken = New-R10Token
  $preflightHash = Get-R10Sha256 $preflightToken
  if ($preflightToken.Length -lt 64 -or $preflightHash -notmatch '^[0-9a-f]{64}$') {
    throw 'R10_LOCAL_RUNTIME_PREFLIGHT_FAILED'
  }
  [ordered]@{
    status = 'R10_LOCAL_RUNTIME_PREFLIGHT_PASSED'
    powerShellMajor = $PSVersionTable.PSVersion.Major
    tokenLengthAtLeast64 = $true
    sha256ShapeValid = $true
    remoteCalls = 0
  } | ConvertTo-Json -Compress
  exit 0
}

function Invoke-R10Request {
  param(
    [Parameter(Mandatory)] [string]$Uri,
    [Parameter(Mandatory)] [hashtable]$Headers,
    [ValidateSet('GET', 'POST')] [string]$Method = 'GET',
    [string]$Body
  )
  $parameters = @{
    Uri = $Uri
    Method = $Method
    Headers = $Headers
    SkipHttpErrorCheck = $true
  }
  if ($Method -eq 'POST') {
    $parameters.ContentType = 'application/json'
    $parameters.Body = $Body
  }
  Invoke-WebRequest @parameters
}

$qualificationConfig = 'wrangler.e2-r10-qualification-preview.jsonc'
$ledgerConfig = 'wrangler.e2-r10-qualification-ledger.jsonc'
$qualificationResultPath = 'docs/e2-v4-pro-benchmark-r10/qualification-result-h.json'
$qualificationEvidencePath = 'docs/e2-v4-pro-benchmark-r10/qualification-evidence-h.json'
$qualificationConfigValue = Get-Content -Raw -LiteralPath $qualificationConfig | ConvertFrom-Json
$ledgerConfigValue = Get-Content -Raw -LiteralPath $ledgerConfig | ConvertFrom-Json
$qualificationResult = Get-Content -Raw -LiteralPath $qualificationResultPath | ConvertFrom-Json
$qualificationEvidence = Get-Content -Raw -LiteralPath $qualificationEvidencePath | ConvertFrom-Json
$qualificationOriginHost = ([Uri]$qualificationConfigValue.vars.E2_R10_QUALIFICATION_PREVIEW_ORIGIN).Host
$qualificationNameInvalid = $qualificationConfigValue.name.Length -gt 54 -or $qualificationConfigValue.name -notmatch '^[a-z0-9-]+$'
if ($qualificationNameInvalid -or $qualificationOriginHost -notlike "$($qualificationConfigValue.name).*") {
  throw 'R10_QUALIFICATION_PREVIEW_NAME_INCOMPATIBLE'
}
$bindingChecks = @(
  $qualificationResult.status -eq 'LOCAL_QUALIFIED_PREVIEW_UPLOAD_REQUESTABLE'
  $qualificationConfigValue.vars.E2_R10_PROTOCOL_BUNDLE_SHA256 -eq $qualificationResult.protocolBundleSha256
  $qualificationConfigValue.vars.E2_R10_QUALIFICATION_RESULT_SHA256 -eq $qualificationEvidence.qualificationResultSha256
  $qualificationConfigValue.vars.E2_R10_QUALIFICATION_WORKER_BYTES_SHA256 -eq $qualificationEvidence.deploymentArtifacts.qualificationWorkerBytesSha256
  $qualificationConfigValue.vars.E2_R10_QUALIFICATION_WORKER_CONFIG_SHA256 -eq $qualificationEvidence.deploymentArtifacts.qualificationWorkerConfigSha256
  $qualificationConfigValue.vars.E2_R10_LEDGER_WORKER_BYTES_SHA256 -eq $qualificationEvidence.deploymentArtifacts.ledgerWorkerBytesSha256
  $qualificationConfigValue.vars.E2_R10_LEDGER_WORKER_CONFIG_SHA256 -eq $qualificationEvidence.deploymentArtifacts.ledgerWorkerConfigSha256
  $ledgerConfigValue.vars.E2_R10_LEDGER_WORKER_BYTES_SHA256 -eq $qualificationEvidence.deploymentArtifacts.ledgerWorkerBytesSha256
  $ledgerConfigValue.vars.E2_R10_LEDGER_WORKER_CONFIG_SHA256 -eq $qualificationEvidence.deploymentArtifacts.ledgerWorkerConfigSha256
)
if ($bindingChecks -contains $false) {
  throw 'R10_LOCAL_QUALIFICATION_BINDINGS_INVALID'
}
$qualificationToken = New-R10Token
$ledgerCallerToken = New-R10Token
$qualificationHash = Get-R10Sha256 $qualificationToken
$ledgerCallerHash = Get-R10Sha256 $ledgerCallerToken

$ledgerDeployOutput = npx wrangler deploy --config $ledgerConfig 2>&1
if ($LASTEXITCODE -ne 0) { throw "R10_LEDGER_CODE_DEPLOY_FAILED:$($ledgerDeployOutput -join ' ')" }
$null = $ledgerCallerHash | npx wrangler secret put E2_R10_LEDGER_CALLER_TOKEN_SHA256 --config $ledgerConfig 2>&1
if ($LASTEXITCODE -ne 0) { throw 'R10_LEDGER_SECRET_INSTALL_FAILED' }
$ledgerVersionId = Get-LatestR10Version $ledgerConfig
$ledgerDeploymentRaw = npx wrangler deployments status --config $ledgerConfig --json 2>$null
if ($LASTEXITCODE -ne 0) { throw 'R10_LEDGER_DEPLOYMENT_STATUS_FAILED' }
$ledgerDeployment = $ledgerDeploymentRaw | ConvertFrom-Json
$activeLedgerVersions = @($ledgerDeployment.versions | Where-Object { $_.percentage -eq 100 })
if ($activeLedgerVersions.Count -ne 1 -or $activeLedgerVersions[0].version_id -ne $ledgerVersionId) {
  throw 'R10_LEDGER_ACTIVE_VERSION_MISMATCH'
}

Write-Output "R10_LEDGER_VERSION_ID=$ledgerVersionId"
Write-Output 'Patch E2_R10_LEDGER_WORKER_VERSION_ID with this value, then press Enter.'
$null = Read-Host

$configuredLedgerVersion = (Get-Content -Raw -LiteralPath $qualificationConfig | ConvertFrom-Json).vars.E2_R10_LEDGER_WORKER_VERSION_ID
if ($configuredLedgerVersion -ne $ledgerVersionId) { throw 'R10_LEDGER_VERSION_NOT_PATCHED' }

$existingFrontVersions = npx wrangler versions list --config $qualificationConfig --json 2>$null
if ($LASTEXITCODE -eq 0 -and ($existingFrontVersions | ConvertFrom-Json).Count -gt 0) {
  $qualificationUploadOutput = npx wrangler versions upload --config $qualificationConfig 2>&1
} else {
  $qualificationUploadOutput = npx wrangler deploy --config $qualificationConfig 2>&1
}
if ($LASTEXITCODE -ne 0) {
  throw "R10_QUALIFICATION_UPLOAD_FAILED:$($qualificationUploadOutput -join ' ')"
}
$frontSecrets = @{
  E2_R10_QUALIFICATION_TOKEN_SHA256 = $qualificationHash
  E2_R10_LEDGER_CALLER_TOKEN = $ledgerCallerToken
} | ConvertTo-Json -Compress
$null = $frontSecrets | npx wrangler versions secret bulk --config $qualificationConfig 2>&1
if ($LASTEXITCODE -ne 0) { throw 'R10_QUALIFICATION_SECRET_INSTALL_FAILED' }

$frontVersionId = Get-LatestR10Version $qualificationConfig
$frontDeploymentRaw = npx wrangler deployments status --config $qualificationConfig --json 2>$null
if ($LASTEXITCODE -ne 0) { throw 'R10_QUALIFICATION_DEPLOYMENT_STATUS_FAILED' }
$frontDeployment = $frontDeploymentRaw | ConvertFrom-Json
$activeFrontVersions = @($frontDeployment.versions | Where-Object { $_.percentage -gt 0 })
$qualificationStableTraffic = @($activeFrontVersions | Where-Object { $_.version_id -eq $frontVersionId } |
  Measure-Object -Property percentage -Sum).Sum
if ($null -eq $qualificationStableTraffic) { $qualificationStableTraffic = 0 }
$stableTrafficTotal = @($activeFrontVersions | Measure-Object -Property percentage -Sum).Sum
if ($qualificationStableTraffic -ne 0 -or $stableTrafficTotal -ne 100) {
  throw 'R10_QUALIFICATION_VERSION_STABLE_TRAFFIC_FORBIDDEN'
}
$stableFrontVersions = @($activeFrontVersions | ForEach-Object {
  [ordered]@{ versionId = $_.version_id; percentage = $_.percentage }
})
$baseHost = 'sa-e2-r10-facts-first-qual-preview.nightsdell.workers.dev'
$origin = "https://$($frontVersionId.Substring(0, 8))-$baseHost"
$prefix = "$origin/api/experiments/e2-9/r10/qualification/"
$headers = @{ Authorization = "Bearer $qualificationToken"; Origin = $origin }
$contracts = @()

for ($index = 0; $index -lt 3; $index += 1) {
  $attempt = 0
  do {
    $attempt += 1
    $response = Invoke-R10Request -Uri "${prefix}contract" -Headers $headers
    if ($response.StatusCode -eq 200) { break }
    if ($attempt -ge 5) { throw "R10_CONTRACT_FAILED:$($response.StatusCode)" }
    Start-Sleep -Seconds 2
  } while ($true)
  $contracts += ($response.Content | ConvertFrom-Json)
}

$contract = $contracts[0]
if (($contracts | Where-Object { $_.workerVersionId -ne $frontVersionId }).Count -ne 0) {
  throw 'R10_VERSION_INSTABILITY'
}
if ($contract.deploymentEvidence.ledgerWorkerVersionId -ne $ledgerVersionId) {
  throw 'R10_LEDGER_BINDING_DRIFT'
}

$deploymentJson = $contract.deploymentEvidence | ConvertTo-Json -Depth 20 -Compress
$env:R10_DEPLOYMENT_JSON = $deploymentJson
$deploymentHash = node --input-type=module -e "import { canonicalJson, sha256 } from './scripts/e2-9-r10-protocol.mjs'; process.stdout.write(sha256(canonicalJson(JSON.parse(process.env.R10_DEPLOYMENT_JSON))))"
Remove-Item Env:R10_DEPLOYMENT_JSON

$registration = [ordered]@{
  schemaVersion = 'e2.9-r10-qualification-registration-1.1.0'
  runLabel = $qualificationResult.runLabel
  protocolVersion = $qualificationResult.protocolVersion
  qualificationVersion = $qualificationResult.schemaVersion
  expectedWorkerVersionId = $frontVersionId
  protocolBundleSha256 = $qualificationResult.protocolBundleSha256
  qualificationResultSha256 = $contract.qualificationResultSha256
  qualificationResult = $qualificationResult
  deploymentEvidenceSha256 = $deploymentHash
  deploymentEvidence = $contract.deploymentEvidence
}
$registrationJson = $registration | ConvertTo-Json -Depth 40 -Compress

$record = Invoke-R10Request -Uri "${prefix}record" -Headers $headers -Method POST -Body $registrationJson
if ($record.StatusCode -ne 201) { throw "R10_RECORD_FAILED:$($record.StatusCode):$($record.Content)" }
$duplicate = Invoke-R10Request -Uri "${prefix}record" -Headers $headers -Method POST -Body $registrationJson
if ($duplicate.StatusCode -ne 200 -or $duplicate.Headers['x-idempotent-replay'] -ne 'true') {
  throw "R10_IDEMPOTENCY_FAILED:$($duplicate.StatusCode)"
}
$state = Invoke-R10Request -Uri "${prefix}state?runLabel=$($qualificationResult.runLabel)" -Headers $headers
if ($state.StatusCode -ne 200) { throw "R10_STATE_FAILED:$($state.StatusCode)" }

$lockedStatuses = [ordered]@{}
foreach ($stage in @('readiness', 'smoke', 'screening', 'selection', 'blind', 'production')) {
  $stageResponse = Invoke-R10Request -Uri "${prefix}${stage}" -Headers $headers -Method POST -Body '{}'
  $stagePayload = $stageResponse.Content | ConvertFrom-Json
  if ($stageResponse.StatusCode -ne 412 -or $stagePayload.error -ne 'MODEL_PHASE_NOT_AUTHORIZED' -or $stagePayload.modelCalls -ne 0) {
    throw "R10_STAGE_LOCK_FAILED:$stage"
  }
  $lockedStatuses[$stage] = $stageResponse.StatusCode
}

$wrongOrigin = Invoke-R10Request -Uri "${prefix}contract" -Headers @{
  Authorization = "Bearer $qualificationToken"
  Origin = 'https://invalid.example'
}
$wrongAuthentication = Invoke-R10Request -Uri "${prefix}contract" -Headers @{
  Authorization = 'Bearer invalid-token-material-invalid-token'
  Origin = $origin
}
if ($wrongOrigin.StatusCode -ne 403 -or $wrongAuthentication.StatusCode -ne 401) {
  throw 'R10_AUTH_FIREWALL_FAILED'
}

[ordered]@{
  schemaVersion = 'e2.9-r10-preview-qualification-evidence-1.0.0'
  runLabel = $qualificationResult.runLabel
  protocolVersion = $qualificationResult.protocolVersion
  sourceCommit = $qualificationResult.sourceCommit
  qualificationStatus = $qualificationResult.status
  protocolBundleSha256 = $qualificationResult.protocolBundleSha256
  qualificationResultSha256 = $contract.qualificationResultSha256
  deploymentEvidenceSha256 = $deploymentHash
  deploymentEvidence = $contract.deploymentEvidence
  qualificationWorkerVersionId = $frontVersionId
  qualificationWorkerUploadedAt = $contract.deploymentEvidence.qualificationWorkerUploadedAt
  qualificationWorkerVersionedOrigin = $origin
  qualificationWorkerStableTrafficPercentage = $qualificationStableTraffic
  stableWorkerVersions = $stableFrontVersions
  ledgerWorkerVersionId = $ledgerVersionId
  ledgerWorkerActiveTrafficPercentage = 100
  contractStableReads = 3
  recordStatus = $record.StatusCode
  idempotentReplayStatus = $duplicate.StatusCode
  stateStatus = $state.StatusCode
  lockedStageStatuses = $lockedStatuses
  wrongOriginStatus = $wrongOrigin.StatusCode
  wrongAuthenticationStatus = $wrongAuthentication.StatusCode
  modelCalls = 0
  upstreamNetworkCalls = 0
  expectedAnswerReads = 0
  productionSiteConfigChanged = $false
  productionDeployment = 'NOT_DEPLOYED'
  screeningAuthorization = 'NOT_AUTHORIZED'
} | ConvertTo-Json -Depth 20

Remove-Variable qualificationToken, ledgerCallerToken, frontSecrets -ErrorAction SilentlyContinue
