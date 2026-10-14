param([Parameter(Mandatory=$true)][string]$Ledger,[Parameter(Mandatory=$true)][string]$ExpectedSha,[Parameter(Mandatory=$true)][string]$RowPath,[Parameter(Mandatory=$true)][string]$ExpectedAfterSha)
$ErrorActionPreference = 'Stop'
if ($ExpectedSha -notmatch '^[a-f0-9]{64}$' -or $ExpectedAfterSha -notmatch '^[a-f0-9]{64}$') { throw 'D25_LEDGER_HASH_ARGUMENT' }
# Exclusive writer handle: concurrent Node/PowerShell append handles cannot overlap.
# No truncate/replace. Compare and append are inside the same OS file lock.
$d25Stream = [System.IO.File]::Open($Ledger,[System.IO.FileMode]::Open,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::Read)
try {
  if ($d25Stream.Length -gt 67108864) { throw 'D25_LEDGER_SIZE_LIMIT' }
  $d25Bytes = New-Object byte[] $d25Stream.Length
  $d25Read = 0
  while ($d25Read -lt $d25Bytes.Length) { $d25N = $d25Stream.Read($d25Bytes,$d25Read,$d25Bytes.Length-$d25Read); if ($d25N -eq 0) { throw 'D25_LEDGER_SHORT_READ' }; $d25Read += $d25N }
  $d25Hasher = [System.Security.Cryptography.SHA256]::Create()
  try { $d25Before = ([BitConverter]::ToString($d25Hasher.ComputeHash($d25Bytes))).Replace('-','').ToLowerInvariant() } finally { $d25Hasher.Dispose() }
  if ($d25Before -ne $ExpectedSha) { throw 'D25_LEDGER_COMPARE_AND_APPEND_DRIFT' }
  $d25Row = [System.IO.File]::ReadAllBytes($RowPath)
  if ($d25Row.Length -eq 0 -or $d25Row[$d25Row.Length-1] -ne 10) { throw 'D25_LEDGER_ROW_TERMINATOR' }
  $d25Stream.Position = $d25Stream.Length
  $d25Stream.Write($d25Row,0,$d25Row.Length)
  $d25Stream.Flush($true)
  $d25Stream.Position = 0
  $d25Hasher = [System.Security.Cryptography.SHA256]::Create()
  try { $d25After = ([BitConverter]::ToString($d25Hasher.ComputeHash($d25Stream))).Replace('-','').ToLowerInvariant() } finally { $d25Hasher.Dispose() }
  if ($d25After -ne $ExpectedAfterSha) { throw 'D25_LEDGER_APPEND_UNCERTAIN' }
  Write-Output ('{"status":"APPENDED_ONCE","sha256":"'+$d25After+'"}')
} finally { $d25Stream.Dispose() }
