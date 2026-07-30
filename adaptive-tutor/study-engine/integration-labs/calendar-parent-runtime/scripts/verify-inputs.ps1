[CmdletBinding()]
param(
  [string]$RepositoryRoot = (
    Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')
  ).Path,
  [string]$ArtifactDirectory = $env:STUDY_ARTIFACT_DIR
)

$ErrorActionPreference = 'Stop'

$inputs = @(
  @{
    Label = 'CARD-1-STUDY-CONTRACTS.zip'
    Filename = 'CARD-1-STUDY-CONTRACTS.zip'
    RelativePath = 'adaptive-tutor\study-engine\docs\contracts\artifacts\CARD-1-STUDY-CONTRACTS.zip'
    Expected = '79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41'
  },
  @{
    Label = 'Study-Engine ZIP'
    Filename = 'manuel-academy-session-2-study-engine.zip'
    RelativePath = 'adaptive-tutor\study-engine\docs\engine\manuel-academy-session-2-study-engine.zip'
    Expected = '979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770'
  },
  @{
    Label = 'Study-Integrations ZIP'
    Filename = 'manuel-academy-session-4-study-integrations.zip'
    RelativePath = 'adaptive-tutor\study-engine\docs\integrations\artifacts\manuel-academy-session-4-study-integrations.zip'
    Expected = 'F4AB726446DA4129E3548919D91E56B85C93FF31BE63DEA692B0BA7926C39C1B'
  },
  @{
    Label = 'SESSION-5-R2-PORTABLE-RECONCILIATION-PACKAGE.zip'
    Filename = 'SESSION-5-R2-PORTABLE-RECONCILIATION-PACKAGE.zip'
    RelativePath = 'adaptive-tutor\study-engine\reconciliation\SESSION-5-R2-PORTABLE-RECONCILIATION-PACKAGE.zip'
    Expected = '39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41'
  }
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

$summary = foreach ($input in $inputs) {
  $archivePath = if ([string]::IsNullOrWhiteSpace($ArtifactDirectory)) {
    Join-Path $RepositoryRoot $input.RelativePath
  }
  else {
    Join-Path $ArtifactDirectory $input.Filename
  }
  if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
    throw "Missing required package: $($input.Label)"
  }

  $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
  if ($actual -ne $input.Expected) {
    throw "SHA-256 mismatch for $($input.Label): expected $($input.Expected), got $actual"
  }

  $archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
  try {
    $matchedWorkspaceEntries = 0
    $workspaceMismatches = [System.Collections.Generic.List[string]]::new()

    foreach ($entry in $archive.Entries) {
      if ([string]::IsNullOrWhiteSpace($entry.Name)) {
        continue
      }

      $relativeEntry = $entry.FullName.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      $workspacePath = Join-Path $RepositoryRoot $relativeEntry
      if (-not (Test-Path -LiteralPath $workspacePath -PathType Leaf)) {
        continue
      }

      $matchedWorkspaceEntries += 1
      $algorithm = [System.Security.Cryptography.SHA256]::Create()
      try {
        $stream = $entry.Open()
        try {
          $entryHash = (
            [BitConverter]::ToString($algorithm.ComputeHash($stream))
          ).Replace('-', '')
        }
        finally {
          $stream.Dispose()
        }
      }
      finally {
        $algorithm.Dispose()
      }

      $workspaceHash = (Get-FileHash -LiteralPath $workspacePath -Algorithm SHA256).Hash
      if ($entryHash -ne $workspaceHash) {
        $workspaceMismatches.Add($entry.FullName)
      }
    }

    if ($workspaceMismatches.Count -gt 0) {
      throw (
        "Verified archive $($input.Label), but matching workspace files differ: " +
        ($workspaceMismatches -join ', ')
      )
    }

    [pscustomobject]@{
      Package = $input.Label
      SHA256 = $actual
      ArchiveEntries = $archive.Entries.Count
      MatchingWorkspaceFiles = $matchedWorkspaceEntries
      WorkspaceMismatches = $workspaceMismatches.Count
      Result = 'PASS'
    }
  }
  finally {
    $archive.Dispose()
  }
}

$summary | Format-Table -AutoSize
