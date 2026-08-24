#Requires -Version 7.0

param(
  [switch]$LocalRuntimePreflightOnly,
  [switch]$DeployAndExecute,
  [int]$AuthorizedCallCap = 0
)

$ErrorActionPreference = 'Stop'

function New-R10ScreeningToken {
  $bytes = [byte[]]::new(48)
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
    [Convert]::ToBase64String($bytes)
  } finally {
    $generator.Dispose()
  }
}

function Get-R10ScreeningSha256([string]$Value) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
  $hash = [System.Security.Cryptography.SHA256]::HashData($bytes)
  ([Convert]::ToHexString($hash)).ToLowerInvariant()
}

function Get-R10ScreeningFileSha256([string]$Path) {
  (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Get-LatestR10ScreeningVersion([string]$ConfigPath) {
  $raw = npx wrangler versions list --config $ConfigPath --json 2>$null
  if ($LASTEXITCODE -ne 0) { throw "R10_SCREENING_VERSION_LIST_FAILED:$ConfigPath" }
  $versions = $raw | ConvertFrom-Json
  $latest = $versions | Sort-Object { $_.metadata.created_on } -Descending | Select-Object -First 1
  if ($null -eq $latest -or $latest.id -notmatch '^[0-9a-f-]{36}$') { throw "R10_SCREENING_VERSION_UNAVAILABLE:$ConfigPath" }
  $latest.id
}

function Invoke-R10ScreeningRequest {
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

if ($LocalRuntimePreflightOnly) {
  $token = New-R10ScreeningToken
  $hash = Get-R10ScreeningSha256 $token
  if ($token.Length -lt 64 -or $hash -notmatch '^[0-9a-f]{64}$') { throw 'R10_SCREENING_RUNTIME_PREFLIGHT_FAILED' }
  [ordered]@{
    status = 'R10_SCREENING_RUNTIME_PREFLIGHT_PASS'
    powerShellMajor = $PSVersionTable.PSVersion.Major
    tokenShapeValid = $true
    sha256ShapeValid = $true
    remoteCalls = 0
    modelCalls = 0
  } | ConvertTo-Json -Compress
  exit 0
}

if (-not $DeployAndExecute -or $AuthorizedCallCap -ne 16) {
  throw 'EXPLICIT_DEPLOY_AND_MAX_16_CALL_AUTHORIZATION_REQUIRED'
}
if ([string]::IsNullOrWhiteSpace($env:DEEPSEEK_API_KEY) -or $env:DEEPSEEK_API_KEY.Length -lt 20) {
  throw 'DEEPSEEK_API_KEY_MUST_BE_PRESENT_ONLY_IN_PROCESS_ENVIRONMENT'
}

$protocolBundlePath = 'docs/e2-v4-pro-benchmark-r10/screening-protocol-1.0.0/protocol-bundle.json'
$caseManifestPath = 'docs/e2-v4-pro-benchmark-r10/screening-protocol-1.0.0/case-manifest.json'
$qualificationAuditPath = 'docs/e2-v4-pro-benchmark-r10/qualification-audit-h.json'
$bootstrapConfig = 'wrangler.e2-r10-screening-bootstrap.jsonc'
$screeningConfig = 'wrangler.e2-r10-screening-preview.jsonc'
$ledgerConfig = 'wrangler.e2-r10-screening-ledger.jsonc'
$protocolBundleHash = Get-R10ScreeningFileSha256 $protocolBundlePath
$caseManifestHash = Get-R10ScreeningFileSha256 $caseManifestPath
$qualificationAuditHash = Get-R10ScreeningFileSha256 $qualificationAuditPath
$screeningConfigValue = Get-Content -Raw -LiteralPath $screeningConfig | ConvertFrom-Json

$screeningConfigChecks = @(
  $screeningConfigValue.vars.E2_R10_SCREENING_CASE_MANIFEST_SHA256 -eq $caseManifestHash
  $screeningConfigValue.vars.E2_R10_QUALIFICATION_AUDIT_SHA256 -eq $qualificationAuditHash
  $screeningConfigValue.vars.E2_R10_SCREENING_PROTOCOL_BUNDLE_SHA256 -eq ('0' * 64)
  $screeningConfigValue.routes.Count -eq 0
  $screeningConfigValue.name -eq 'sa-e2-r10-screening-preview'
)
if ($screeningConfigChecks -contains $false) {
  throw 'SCREENING_CONFIG_FROZEN_BINDINGS_INVALID'
}

node scripts/run-e2-9-r10-screening.mjs --phase=preflight
if ($LASTEXITCODE -ne 0) { throw 'R10_SCREENING_LOCAL_PREFLIGHT_FAILED' }
npx wrangler deploy --dry-run --config $bootstrapConfig | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'R10_SCREENING_BOOTSTRAP_DRY_RUN_FAILED' }
npx wrangler deploy --dry-run --config $ledgerConfig | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'R10_SCREENING_LEDGER_DRY_RUN_FAILED' }
npx wrangler versions upload --dry-run --config $screeningConfig --var "E2_R10_SCREENING_PROTOCOL_BUNDLE_SHA256:$protocolBundleHash" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'R10_SCREENING_WORKER_DRY_RUN_FAILED' }

$screeningToken = New-R10ScreeningToken
$ledgerCallerToken = New-R10ScreeningToken
$screeningTokenHash = Get-R10ScreeningSha256 $screeningToken
$ledgerCallerHash = Get-R10ScreeningSha256 $ledgerCallerToken

# The stable Worker is deliberately a zero-model bootstrap. The model-enabled
# version is uploaded later and must retain zero stable traffic.
$bootstrapOutput = npx wrangler deploy --config $bootstrapConfig 2>&1
if ($LASTEXITCODE -ne 0) { throw "R10_SCREENING_BOOTSTRAP_DEPLOY_FAILED:$($bootstrapOutput -join ' ')" }

$ledgerOutput = npx wrangler deploy --config $ledgerConfig 2>&1
if ($LASTEXITCODE -ne 0) { throw "R10_SCREENING_LEDGER_DEPLOY_FAILED:$($ledgerOutput -join ' ')" }
$null = $ledgerCallerHash | npx wrangler secret put E2_R10_SCREENING_LEDGER_CALLER_TOKEN_SHA256 --config $ledgerConfig 2>&1
if ($LASTEXITCODE -ne 0) { throw 'R10_SCREENING_LEDGER_SECRET_INSTALL_FAILED' }
$ledgerVersionId = Get-LatestR10ScreeningVersion $ledgerConfig
$ledgerDeployment = (npx wrangler deployments status --config $ledgerConfig --json 2>$null) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'R10_SCREENING_LEDGER_DEPLOYMENT_STATUS_FAILED' }
$activeLedgerVersions = @($ledgerDeployment.versions | Where-Object { $_.percentage -eq 100 })
if ($activeLedgerVersions.Count -ne 1 -or $activeLedgerVersions[0].version_id -ne $ledgerVersionId) {
  throw 'R10_SCREENING_LEDGER_ACTIVE_VERSION_MISMATCH'
}

$uploadOutput = npx wrangler versions upload --config $screeningConfig --var "E2_R10_SCREENING_PROTOCOL_BUNDLE_SHA256:$protocolBundleHash" 2>&1
if ($LASTEXITCODE -ne 0) { throw "R10_SCREENING_VERSION_UPLOAD_FAILED:$($uploadOutput -join ' ')" }
$screeningSecrets = @{
  DEEPSEEK_API_KEY = $env:DEEPSEEK_API_KEY
  E2_R10_SCREENING_TOKEN_SHA256 = $screeningTokenHash
  E2_R10_SCREENING_LEDGER_CALLER_TOKEN = $ledgerCallerToken
} | ConvertTo-Json -Compress
$null = $screeningSecrets | npx wrangler versions secret bulk --config $screeningConfig 2>&1
if ($LASTEXITCODE -ne 0) { throw 'R10_SCREENING_VERSION_SECRET_INSTALL_FAILED' }
$screeningVersionId = Get-LatestR10ScreeningVersion $screeningConfig
$frontDeployment = (npx wrangler deployments status --config $screeningConfig --json 2>$null) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'R10_SCREENING_DEPLOYMENT_STATUS_FAILED' }
$activeFrontVersions = @($frontDeployment.versions | Where-Object { $_.percentage -gt 0 })
$screeningStableTraffic = @($activeFrontVersions | Where-Object { $_.version_id -eq $screeningVersionId } | Measure-Object -Property percentage -Sum).Sum
if ($null -eq $screeningStableTraffic) { $screeningStableTraffic = 0 }
$stableTrafficTotal = @($activeFrontVersions | Measure-Object -Property percentage -Sum).Sum
if ($screeningStableTraffic -ne 0 -or $stableTrafficTotal -ne 100) { throw 'MODEL_VERSION_STABLE_TRAFFIC_FORBIDDEN' }

$baseHost = 'sa-e2-r10-screening-preview.nightsdell.workers.dev'
$origin = "https://$($screeningVersionId.Substring(0, 8))-$baseHost"
$prefix = "$origin/api/experiments/e2-9/r10/screening/"
$headers = @{ Authorization = "Bearer $screeningToken"; Origin = $origin }
$contracts = @()
for ($index = 0; $index -lt 3; $index += 1) {
  $response = Invoke-R10ScreeningRequest -Uri "${prefix}contract" -Headers $headers
  if ($response.StatusCode -ne 200) { throw "R10_SCREENING_CONTRACT_FAILED:$($response.StatusCode)" }
  $contracts += ($response.Content | ConvertFrom-Json)
}
$contract = $contracts[0]
if (($contracts | Where-Object {
  $_.workerVersionId -ne $screeningVersionId -or
  $_.protocolBundleSha256 -ne $protocolBundleHash -or
  $_.caseManifestSha256 -ne $caseManifestHash -or
  $_.qualificationAuditSha256 -ne $qualificationAuditHash -or
  $_.modelCalls -ne 0 -or
  $_.previewOnly -ne $true
}).Count -ne 0) { throw 'R10_SCREENING_CONTRACT_BINDING_DRIFT' }

$wrongOrigin = Invoke-R10ScreeningRequest -Uri "${prefix}contract" -Headers @{ Authorization = "Bearer $screeningToken"; Origin = 'https://invalid.example' }
$wrongAuth = Invoke-R10ScreeningRequest -Uri "${prefix}contract" -Headers @{ Authorization = 'Bearer invalid'; Origin = $origin }
$selectionLock = Invoke-R10ScreeningRequest -Uri "${prefix}selection" -Headers $headers
$blindLock = Invoke-R10ScreeningRequest -Uri "${prefix}blind" -Headers $headers
$productionLock = Invoke-R10ScreeningRequest -Uri "${prefix}production" -Headers $headers
if ($wrongOrigin.StatusCode -ne 403 -or $wrongAuth.StatusCode -ne 401 -or
  $selectionLock.StatusCode -ne 412 -or $blindLock.StatusCode -ne 412 -or $productionLock.StatusCode -ne 412) {
  throw 'R10_SCREENING_PREVIEW_ISOLATION_FAILED'
}

$cacheRoot = '.evaluation-cache/e2-9-r10/screening-protocol-1.0.0/e29r10-screening-20260824-a'
New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null
$deploymentEvidence = [ordered]@{
  schemaVersion = 'e2.9-r10-screening-deployment-evidence-1.0.0'
  protocolVersion = 'e2-9-r10-screening-protocol-1.0.0'
  runLabel = 'e29r10-screening-20260824-a'
  protocolBundleSha256 = $protocolBundleHash
  caseManifestSha256 = $caseManifestHash
  qualificationAuditSha256 = $qualificationAuditHash
  screeningWorkerVersionId = $screeningVersionId
  screeningWorkerVersionedOrigin = $origin
  screeningVersionStableTrafficPercent = $screeningStableTraffic
  ledgerWorkerVersionId = $ledgerVersionId
  ledgerActiveTrafficPercent = 100
  contractReads = 3
  wrongOriginStatus = $wrongOrigin.StatusCode
  wrongAuthStatus = $wrongAuth.StatusCode
  selectionStatus = $selectionLock.StatusCode
  blindStatus = $blindLock.StatusCode
  productionStatus = $productionLock.StatusCode
  modelCallsBeforeRunner = 0
  productionDeployed = $false
}
$deploymentEvidencePath = Join-Path $cacheRoot 'deployment-evidence.json'
if (Test-Path -LiteralPath $deploymentEvidencePath) { throw 'REFUSING_TO_OVERWRITE_DEPLOYMENT_EVIDENCE' }
$deploymentEvidence | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $deploymentEvidencePath -Encoding utf8NoBOM

$previousToken = $env:E2_R10_SCREENING_TOKEN
try {
  $env:E2_R10_SCREENING_TOKEN = $screeningToken
  node scripts/run-e2-9-r10-screening.mjs --phase=screening --execute=true --authorized-call-cap=16 --endpoint=$origin --deployment-version=$screeningVersionId
  if ($LASTEXITCODE -ne 0) { throw 'R10_SCREENING_GENERATION_FAILED_STOP' }
} finally {
  if ($null -eq $previousToken) { Remove-Item Env:E2_R10_SCREENING_TOKEN -ErrorAction SilentlyContinue }
  else { $env:E2_R10_SCREENING_TOKEN = $previousToken }
}

node scripts/score-e2-9-r10-screening.mjs
if ($LASTEXITCODE -ne 0) { throw 'R10_SCREENING_SCORING_FAILED_STOP' }
node scripts/prepare-e2-9-r10-path-masked-review.mjs
if ($LASTEXITCODE -ne 0) { throw 'R10_SCREENING_PATH_MASK_PREPARATION_FAILED_STOP' }

[ordered]@{
  status = 'SCREENING_GENERATED_SCORED_AWAITING_INDEPENDENT_PATH_MASKED_REVIEW'
  screeningWorkerVersionId = $screeningVersionId
  screeningVersionStableTrafficPercent = 0
  ledgerWorkerVersionId = $ledgerVersionId
  modelCallCap = 16
  selection = 'NOT_AUTHORIZED'
  blind = 'NOT_CREATED'
  production = 'NOT_DEPLOYED'
} | ConvertTo-Json -Compress
