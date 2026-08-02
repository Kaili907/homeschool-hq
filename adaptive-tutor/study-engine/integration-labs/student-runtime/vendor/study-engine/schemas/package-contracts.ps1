$ErrorActionPreference = 'Stop'

$studyEngineRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$artifactDirectory = Join-Path $studyEngineRoot 'docs\contracts\artifacts'
$archivePath = Join-Path $artifactDirectory 'CARD-1-STUDY-CONTRACTS.zip'
$temporaryBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$temporaryRoot = Join-Path $temporaryBase ('manuel-academy-card1-' + [guid]::NewGuid().ToString('N'))
$stagedStudyEngine = Join-Path $temporaryRoot 'adaptive-tutor\study-engine'

if (-not $studyEngineRoot.EndsWith('adaptive-tutor\study-engine')) {
  throw "Refusing to package an unexpected source root: $studyEngineRoot"
}

try {
  New-Item -ItemType Directory -Path $stagedStudyEngine -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $stagedStudyEngine 'docs\contracts') -Force |
    Out-Null

  foreach ($ownedDirectory in @('contracts', 'schemas', 'fixtures')) {
    Copy-Item -LiteralPath (Join-Path $studyEngineRoot $ownedDirectory) `
      -Destination $stagedStudyEngine -Recurse
  }

  $contractsDocumentation = Join-Path $studyEngineRoot 'docs\contracts'
  Get-ChildItem -LiteralPath $contractsDocumentation -File | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName `
      -Destination (Join-Path $stagedStudyEngine 'docs\contracts')
  }

  New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
  Compress-Archive -LiteralPath (Join-Path $temporaryRoot 'adaptive-tutor') `
    -DestinationPath $archivePath -CompressionLevel Optimal -Force
} finally {
  $resolvedTemporaryRoot = [System.IO.Path]::GetFullPath($temporaryRoot)
  if (
    $resolvedTemporaryRoot.StartsWith($temporaryBase, [System.StringComparison]::OrdinalIgnoreCase) -and
    $resolvedTemporaryRoot -ne $temporaryBase -and
    (Test-Path -LiteralPath $resolvedTemporaryRoot)
  ) {
    Remove-Item -LiteralPath $resolvedTemporaryRoot -Recurse -Force
  }
}

$archive = Get-Item -LiteralPath $archivePath
Write-Output ("Archive: {0}" -f $archive.FullName)
Write-Output ("Bytes: {0}" -f $archive.Length)

