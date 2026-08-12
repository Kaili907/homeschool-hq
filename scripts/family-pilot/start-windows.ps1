<#
.SYNOPSIS
  Windows launcher for the Homeschool HQ family pilot - local/preview only.

.DESCRIPTION
  Verifies the local checkout is safe to launch, then runs the repo's
  existing dev/preview npm scripts. Never deploys, never writes to a
  hosted database, and never touches production Study feature flags.

.PARAMETER Check
  Run all verification steps and report PASS/BLOCKED, then exit without
  starting any service. Use this to confirm the pilot can launch before
  actually starting it.

.PARAMETER Preview
  Build the app and serve the production-style local preview
  (npm run build && npm run preview) instead of the dev server
  (npm run dev, the default).

.PARAMETER RepoRoot
  Override the repo root the launcher checks and runs in. Defaults to the
  repo containing this script (two levels above scripts/family-pilot).
  Intended for tests; not needed for normal use.

.PARAMETER Format
  Output format for -Check. Defaults to 'text' (existing human-readable
  output, unchanged). 'json' emits exactly one JSON document to stdout
  describing the check result instead, for tooling that consumes this
  launcher's output programmatically (see pilot-acceptance.mjs). Never
  includes secret values, only key names and pass/fail status.
#>
[CmdletBinding()]
param(
    [switch]$Check,
    [switch]$Preview,
    [string]$RepoRoot,
    [ValidateSet('text', 'json')]
    [string]$Format = 'text'
)

$ErrorActionPreference = 'Stop'
$jsonMode = $Format -eq 'json'

if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).ProviderPath

$checkResults = New-Object System.Collections.Generic.List[object]

function Write-Check {
    param([bool]$Ok, [string]$Label, [string]$Detail)
    $checkResults.Add([ordered]@{ name = $Label; ok = $Ok; detail = $Detail }) | Out-Null
    if ($jsonMode) { return }
    $mark = if ($Ok) { '[OK]' } else { '[BLOCKED]' }
    $color = if ($Ok) { 'Green' } else { 'Red' }
    Write-Host "$mark $Label" -ForegroundColor $color
    if ($Detail) { Write-Host "      $Detail" }
}

$blockers = New-Object System.Collections.Generic.List[string]

# 1. Repo identity - refuse to run against the wrong checkout.
$pkgPath = Join-Path $RepoRoot 'package.json'
$repoOk = $false
if (Test-Path -LiteralPath $pkgPath) {
    try {
        $pkg = Get-Content -LiteralPath $pkgPath -Raw | ConvertFrom-Json
        $repoOk = ($pkg.name -eq 'homeschool-hq') -and (Test-Path -LiteralPath (Join-Path $RepoRoot '.git'))
    } catch {
        $repoOk = $false
    }
}
Write-Check $repoOk 'Repo path (homeschool-hq checkout)' $RepoRoot
if (-not $repoOk) {
    $blockers.Add('PILOT_LAUNCH_BLOCKER: this is not a homeschool-hq checkout (package.json name or .git missing).')
}

# 2. Node.js present. The pinned deployed-build version (netlify.toml,
#    build.environment.NODE_VERSION) is reported for information only -
#    local dev is not blocked on matching it exactly.
$expectedNodeMajor = 22
$netlifyTomlPath = Join-Path $RepoRoot 'netlify.toml'
if (Test-Path -LiteralPath $netlifyTomlPath) {
    $tomlMatch = Select-String -LiteralPath $netlifyTomlPath -Pattern 'NODE_VERSION\s*=\s*"(\d+)"' | Select-Object -First 1
    if ($tomlMatch) { $expectedNodeMajor = [int]$tomlMatch.Matches[0].Groups[1].Value }
}
$nodeOk = $false
try {
    $nodeVersionRaw = (& node --version) 2>$null
    if ($nodeVersionRaw -match '^v(\d+)\.') {
        $nodeOk = $true
        $installedMajor = [int]$Matches[1]
        if ($installedMajor -eq $expectedNodeMajor) {
            Write-Check $true "Node.js present ($nodeVersionRaw)" $null
        } else {
            Write-Check $true "Node.js present ($nodeVersionRaw)" `
                "NOTE: the deployed build pins Node $expectedNodeMajor; local dev on $installedMajor proceeds unverified against that pin."
        }
    }
} catch {
    $nodeOk = $false
}
if (-not $nodeOk) {
    Write-Check $false 'Node.js present' 'node.exe was not found on PATH.'
    $blockers.Add('PILOT_LAUNCH_BLOCKER: Node.js is not installed or not on PATH.')
}

# 3. npm present.
$npmOk = $false
try {
    $npmVersionRaw = (& npm.cmd --version) 2>$null
    $npmOk = [bool]$npmVersionRaw
} catch {
    $npmOk = $false
}
Write-Check $npmOk 'npm present' $(if ($npmOk) { "v$npmVersionRaw" } else { 'npm.cmd was not found on PATH.' })
if (-not $npmOk) {
    $blockers.Add('PILOT_LAUNCH_BLOCKER: npm is not installed or not on PATH.')
}

# 4. Dependencies installed. The launcher refuses rather than installing on
#    its own, so it never runs an unrequested package install.
$nodeModulesOk = Test-Path -LiteralPath (Join-Path $RepoRoot 'node_modules')
Write-Check $nodeModulesOk 'Dependencies installed (node_modules)' $(if (-not $nodeModulesOk) { 'Run "npm ci" in the repo root, then re-run this launcher.' })
if (-not $nodeModulesOk) {
    $blockers.Add('PILOT_LAUNCH_BLOCKER: dependencies are not installed. Run "npm ci" in the repo root, then re-run this launcher.')
}

# 5. Local configuration sanity - report which keys are configured without
#    ever printing their values, and never read/set/clear production flags.
$envLocalPath = Join-Path $RepoRoot '.env.local'
if (Test-Path -LiteralPath $envLocalPath) {
    $configuredKeys = Get-Content -LiteralPath $envLocalPath |
        Where-Object { $_ -match '^\s*[A-Za-z_][A-Za-z0-9_]*\s*=' } |
        ForEach-Object { ($_ -split '=', 2)[0].Trim() }
    Write-Check $true '.env.local found' "Keys present (values hidden): $($configuredKeys -join ', ')"
    if ($configuredKeys -contains 'ACADEMY_STUDY_ENABLED' -and -not $jsonMode) {
        Write-Host '      NOTE: ACADEMY_STUDY_ENABLED is set locally. This launcher never reads, sets, or clears it - production Study flags are out of scope.' -ForegroundColor Yellow
    }
} else {
    Write-Check $true '.env.local not present' 'Optional - the app runs local-only without it; cloud sync and the Study engine stay inactive.'
}

function Write-JsonResult {
    param([string]$Status, [string]$Detail)
    $envLocalPresentNow = Test-Path -LiteralPath $envLocalPath
    $envLocalKeysNow = New-Object System.Collections.Generic.List[string]
    if ($envLocalPresentNow -and $configuredKeys) {
        foreach ($key in $configuredKeys) { $envLocalKeysNow.Add($key) }
    }
    $nodeVersionForJson = $null
    if ($nodeOk) { $nodeVersionForJson = $nodeVersionRaw }
    $npmVersionForJson = $null
    if ($npmOk) { $npmVersionForJson = "v$npmVersionRaw" }
    $environment = [ordered]@{
        nodeVersion       = $nodeVersionForJson
        npmVersion        = $npmVersionForJson
        expectedNodeMajor = $expectedNodeMajor
        envLocalPresent   = $envLocalPresentNow
        envLocalKeys      = $envLocalKeysNow
    }
    $result = [ordered]@{
        schemaVersion = 1
        launcher      = 'start-windows.ps1'
        status        = $Status
        detail        = $Detail
        repoRoot      = $RepoRoot
        checks        = $checkResults
        blockers      = $blockers
        environment   = $environment
    }
    $result | ConvertTo-Json -Depth 6
}

if ($blockers.Count -gt 0) {
    if ($jsonMode) {
        Write-JsonResult -Status 'FAIL' -Detail 'Pilot launch BLOCKED.'
        exit 2
    }
    Write-Host ''
    Write-Host 'Pilot launch BLOCKED:' -ForegroundColor Red
    foreach ($blocker in $blockers) { Write-Host "  - $blocker" -ForegroundColor Red }
    exit 2
}

if ($Check) {
    if ($jsonMode) {
        Write-JsonResult -Status 'PASS' -Detail 'Pilot launch checks PASSED. (-Check: no service was started)'
        exit 0
    }
    Write-Host ''
    Write-Host 'Pilot launch checks PASSED. (-Check: no service was started)' -ForegroundColor Green
    exit 0
}

Write-Host ''
Write-Host 'Pilot launch checks PASSED. Starting local service...' -ForegroundColor Green
Push-Location $RepoRoot
try {
    if ($Preview) {
        Write-Host 'Running: npm run build'
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Write-Host 'Running: npm run preview'
        & npm.cmd run preview
    } else {
        Write-Host 'Running: npm run dev'
        & npm.cmd run dev
    }
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
