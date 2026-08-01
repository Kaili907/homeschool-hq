$ErrorActionPreference = 'Stop'

$packageRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseDirectory = Join-Path $packageRoot 'releases'
$archiveName = 'manuel-academy-adaptive-english-v0.2.0-packaging-corrected.zip'
$archivePath = Join-Path $releaseDirectory $archiveName
$temporaryArchivePath = "$archivePath.tmp"
$checksumPath = "$archivePath.sha256"
$expectedEntryCount = 46
$fixedEntryTimestamp = [System.DateTimeOffset]::new(2000, 1, 1, 0, 0, 0, [System.TimeSpan]::Zero)

function Assert-ExpectedFilePath {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$ExpectedParent,
    [Parameter(Mandatory = $true)][string]$ExpectedName
  )

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $parent = [System.IO.Path]::GetDirectoryName($fullPath)
  $name = [System.IO.Path]::GetFileName($fullPath)
  if (-not $parent.Equals([System.IO.Path]::GetFullPath($ExpectedParent), [System.StringComparison]::OrdinalIgnoreCase) -or
      -not $name.Equals($ExpectedName, [System.StringComparison]::Ordinal)) {
    throw "Refusing to use unexpected release path: $fullPath"
  }
}

function Assert-SafeEntryName {
  param([Parameter(Mandatory = $true)][string]$Name)

  if ([string]::IsNullOrWhiteSpace($Name) -or
      $Name.Contains('\') -or
      $Name.StartsWith('/', [System.StringComparison]::Ordinal) -or
      $Name -match '^[A-Za-z]:' -or
      [System.IO.Path]::IsPathRooted($Name) -or
      $Name.EndsWith('/', [System.StringComparison]::Ordinal)) {
    throw "Unsafe raw ZIP entry name: $Name"
  }

  $components = @($Name.Split('/'))
  if ($components.Count -eq 0 -or
      @($components | Where-Object { $_ -eq '' -or $_ -eq '.' -or $_ -eq '..' }).Count -gt 0) {
    throw "Unsafe ZIP path component in: $Name"
  }
}

function Get-EntryName {
  param([Parameter(Mandatory = $true)][string]$FilePath)

  $fullPath = [System.IO.Path]::GetFullPath($FilePath)
  $rootPrefix = $packageRoot.TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  ) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Source file is outside the English package root: $fullPath"
  }

  $relativeName = $fullPath.Substring($rootPrefix.Length)
  if ([System.IO.Path]::IsPathRooted($relativeName)) {
    throw "Source file produced a rooted relative name: $fullPath"
  }

  $entryName = $relativeName.Replace('\', '/')
  Assert-SafeEntryName -Name $entryName
  return $entryName
}

function Get-ZipCentralDirectory {
  param([Parameter(Mandatory = $true)][string]$Path)

  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 22) {
    throw 'ZIP is too short to contain an end-of-central-directory record.'
  }

  $minimumOffset = [Math]::Max(0, $bytes.Length - 65557)
  $eocdOffset = -1
  for ($offset = $bytes.Length - 22; $offset -ge $minimumOffset; $offset--) {
    if ($bytes[$offset] -eq 0x50 -and $bytes[$offset + 1] -eq 0x4b -and
        $bytes[$offset + 2] -eq 0x05 -and $bytes[$offset + 3] -eq 0x06) {
      $commentLength = [System.BitConverter]::ToUInt16($bytes, $offset + 20)
      if ($offset + 22 + $commentLength -eq $bytes.Length) {
        $eocdOffset = $offset
        break
      }
    }
  }
  if ($eocdOffset -lt 0) {
    throw 'ZIP end-of-central-directory record was not found.'
  }

  $diskNumber = [System.BitConverter]::ToUInt16($bytes, $eocdOffset + 4)
  $centralDirectoryDisk = [System.BitConverter]::ToUInt16($bytes, $eocdOffset + 6)
  $entriesOnDisk = [System.BitConverter]::ToUInt16($bytes, $eocdOffset + 8)
  $totalEntries = [System.BitConverter]::ToUInt16($bytes, $eocdOffset + 10)
  $centralDirectorySize = [System.BitConverter]::ToUInt32($bytes, $eocdOffset + 12)
  $centralDirectoryOffset = [System.BitConverter]::ToUInt32($bytes, $eocdOffset + 16)
  if ($diskNumber -ne 0 -or $centralDirectoryDisk -ne 0 -or $entriesOnDisk -ne $totalEntries -or
      $totalEntries -eq [UInt16]::MaxValue -or $centralDirectorySize -eq [UInt32]::MaxValue -or
      $centralDirectoryOffset -eq [UInt32]::MaxValue) {
    throw 'Multi-disk and ZIP64 archives are not permitted for this package.'
  }

  $metadata = @()
  $cursor = [int64]$centralDirectoryOffset
  $centralDirectoryEnd = $cursor + [int64]$centralDirectorySize
  $strictUtf8 = [System.Text.UTF8Encoding]::new($false, $true)
  for ($index = 0; $index -lt $totalEntries; $index++) {
    if ($cursor + 46 -gt $bytes.Length -or
        $bytes[$cursor] -ne 0x50 -or $bytes[$cursor + 1] -ne 0x4b -or
        $bytes[$cursor + 2] -ne 0x01 -or $bytes[$cursor + 3] -ne 0x02) {
      throw "Invalid central-directory header at entry index $index."
    }

    $flags = [System.BitConverter]::ToUInt16($bytes, [int]$cursor + 8)
    $fileNameLength = [System.BitConverter]::ToUInt16($bytes, [int]$cursor + 28)
    $extraLength = [System.BitConverter]::ToUInt16($bytes, [int]$cursor + 30)
    $commentLength = [System.BitConverter]::ToUInt16($bytes, [int]$cursor + 32)
    $externalAttributes = [System.BitConverter]::ToUInt32($bytes, [int]$cursor + 38)
    $nameOffset = [int]$cursor + 46
    if ($nameOffset + $fileNameLength -gt $bytes.Length) {
      throw "Truncated central-directory name at entry index $index."
    }
    $rawName = $strictUtf8.GetString($bytes, $nameOffset, $fileNameLength)
    $metadata += [pscustomobject]@{
      Name = $rawName
      Flags = $flags
      ExternalAttributes = $externalAttributes
    }
    $cursor += 46 + $fileNameLength + $extraLength + $commentLength
  }
  if ($cursor -ne $centralDirectoryEnd) {
    throw 'Central-directory size does not reconcile with its entry records.'
  }
  return @($metadata)
}

function Get-StreamSha256 {
  param([Parameter(Mandatory = $true)][System.IO.Stream]$Stream)

  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha256.ComputeHash($Stream))).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha256.Dispose()
  }
}

Assert-ExpectedFilePath -Path $archivePath -ExpectedParent $releaseDirectory -ExpectedName $archiveName
Assert-ExpectedFilePath -Path $temporaryArchivePath -ExpectedParent $releaseDirectory -ExpectedName "$archiveName.tmp"
Assert-ExpectedFilePath -Path $checksumPath -ExpectedParent $releaseDirectory -ExpectedName "$archiveName.sha256"

New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null

$excludedRoots = @('node_modules', 'releases', '.build-dist', '.test-dist', '.validation-dist', '.release-stage')
$sourceFiles = @(
  Get-ChildItem -LiteralPath $packageRoot -Force |
    Where-Object { $excludedRoots -notcontains $_.Name } |
    ForEach-Object {
      if (-not $_.PSIsContainer) {
        $_
      } else {
        Get-ChildItem -LiteralPath $_.FullName -File -Recurse
      }
    } |
    Sort-Object { Get-EntryName -FilePath $_.FullName }
)
if ($sourceFiles.Count -ne $expectedEntryCount) {
  throw "Package source count is $($sourceFiles.Count); expected $expectedEntryCount."
}

$sourceEntryNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
$portableSourceEntryNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($sourceFile in $sourceFiles) {
  if (($sourceFile.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Symlink or reparse-point source is not permitted: $($sourceFile.FullName)"
  }
  $entryName = Get-EntryName -FilePath $sourceFile.FullName
  if (-not $sourceEntryNames.Add($entryName) -or -not $portableSourceEntryNames.Add($entryName)) {
    throw "Duplicate ZIP path after portability normalization: $entryName"
  }
}

if (Test-Path -LiteralPath $temporaryArchivePath) {
  Remove-Item -LiteralPath $temporaryArchivePath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archiveStream = [System.IO.File]::Open(
  $temporaryArchivePath,
  [System.IO.FileMode]::CreateNew,
  [System.IO.FileAccess]::ReadWrite,
  [System.IO.FileShare]::None
)
try {
  $zip = [System.IO.Compression.ZipArchive]::new(
    $archiveStream,
    [System.IO.Compression.ZipArchiveMode]::Create,
    $true,
    [System.Text.UTF8Encoding]::new($false)
  )
  try {
    foreach ($sourceFile in $sourceFiles) {
      $entryName = Get-EntryName -FilePath $sourceFile.FullName
      $entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = $fixedEntryTimestamp
      $sourceStream = [System.IO.File]::OpenRead($sourceFile.FullName)
      $entryStream = $entry.Open()
      try {
        $sourceStream.CopyTo($entryStream)
      } finally {
        $entryStream.Dispose()
        $sourceStream.Dispose()
      }
    }
  } finally {
    $zip.Dispose()
  }
} finally {
  $archiveStream.Dispose()
}

$centralEntries = @(Get-ZipCentralDirectory -Path $temporaryArchivePath)
if ($centralEntries.Count -ne $expectedEntryCount) {
  throw "Raw central-directory count is $($centralEntries.Count); expected $expectedEntryCount."
}
$rawEntryNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
$portableEntryNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($entry in $centralEntries) {
  Assert-SafeEntryName -Name $entry.Name
  if (($entry.Flags -band 0x0001) -ne 0) {
    throw "Encrypted ZIP entry is not permitted: $($entry.Name)"
  }
  $unixFileType = (($entry.ExternalAttributes -shr 16) -band 0xF000)
  if ($unixFileType -eq 0xA000) {
    throw "Symlink ZIP entry is not permitted: $($entry.Name)"
  }
  if (-not $rawEntryNames.Add($entry.Name) -or -not $portableEntryNames.Add($entry.Name)) {
    throw "Duplicate raw or normalized ZIP path: $($entry.Name)"
  }
}
if (@($centralEntries | Where-Object { $_.Name.Contains('\') }).Count -ne 0) {
  throw 'Raw ZIP entry names contain a backslash.'
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($temporaryArchivePath)
try {
  $entries = @($zip.Entries)
  if ($entries.Count -ne $centralEntries.Count -or @($entries | Where-Object { [string]::IsNullOrEmpty($_.Name) }).Count -ne 0) {
    throw 'ZIP contains an unintended directory-only record or its decoded entry count does not reconcile.'
  }
  for ($index = 0; $index -lt $entries.Count; $index++) {
    if ($entries[$index].FullName -cne $centralEntries[$index].Name) {
      throw "Decoded ZIP entry name differs from its raw central-directory name at index $index."
    }
    $stream = $entries[$index].Open()
    try {
      $buffer = New-Object byte[] 81920
      while ($stream.Read($buffer, 0, $buffer.Length) -gt 0) { }
    } finally {
      $stream.Dispose()
    }
  }

  $expectedNames = @($sourceFiles | ForEach-Object { Get-EntryName -FilePath $_.FullName })
  $missing = @($expectedNames | Where-Object { -not $rawEntryNames.Contains($_) })
  if ($missing.Count -gt 0 -or $rawEntryNames.Count -ne $expectedNames.Count) {
    throw "ZIP integrity mismatch. Missing: $($missing -join ', '); entries: $($rawEntryNames.Count); expected: $($expectedNames.Count)"
  }

  $manifestEntry = $zip.GetEntry('package-manifest.generated.json')
  if ($null -eq $manifestEntry) {
    throw 'Generated manifest is missing from the ZIP.'
  }
  $manifestReader = [System.IO.StreamReader]::new($manifestEntry.Open(), [System.Text.Encoding]::UTF8)
  try {
    $manifest = $manifestReader.ReadToEnd() | ConvertFrom-Json
  } finally {
    $manifestReader.Dispose()
  }
  $expectedExcludes = @('node_modules', 'releases', 'temporary build directories', 'this manifest', 'generated inventory')
  $actualExcludes = @($manifest.excludes)
  if ($actualExcludes.Count -ne $expectedExcludes.Count) {
    throw 'Manifest self-exclusion documentation count changed.'
  }
  for ($index = 0; $index -lt $expectedExcludes.Count; $index++) {
    if ($actualExcludes[$index] -cne $expectedExcludes[$index]) {
      throw 'Manifest self-exclusion documentation changed.'
    }
  }

  $manifestExcludedPaths = @('package-manifest.generated.json', 'docs/FILE-INVENTORY.generated.md')
  $expectedManifestPaths = @($expectedNames | Where-Object { $_ -notin $manifestExcludedPaths })
  $manifestPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
  foreach ($item in @($manifest.files)) {
    Assert-SafeEntryName -Name $item.path
    if (-not $manifestPaths.Add($item.path)) {
      throw "Duplicate manifest path: $($item.path)"
    }
    $archivedFile = $zip.GetEntry($item.path)
    if ($null -eq $archivedFile) {
      throw "Manifest path is absent from ZIP: $($item.path)"
    }
    if ([int64]$item.bytes -ne $archivedFile.Length) {
      throw "Manifest byte size mismatch for $($item.path)."
    }
    $stream = $archivedFile.Open()
    try {
      $archiveHash = Get-StreamSha256 -Stream $stream
    } finally {
      $stream.Dispose()
    }
    if ($archiveHash -cne [string]$item.sha256) {
      throw "Manifest SHA-256 mismatch for $($item.path)."
    }
  }
  if ($manifestPaths.Count -ne $expectedManifestPaths.Count -or
      @($expectedManifestPaths | Where-Object { -not $manifestPaths.Contains($_) }).Count -ne 0 -or
      @($manifestExcludedPaths | Where-Object { $manifestPaths.Contains($_) }).Count -ne 0) {
    throw 'Manifest contents do not match the archive after its exact documented self-exclusions.'
  }

  $inventoryEntry = $zip.GetEntry('docs/FILE-INVENTORY.generated.md')
  if ($null -eq $inventoryEntry) {
    throw 'Generated inventory is missing from the ZIP.'
  }
  $inventoryReader = [System.IO.StreamReader]::new($inventoryEntry.Open(), [System.Text.Encoding]::UTF8)
  try {
    $inventoryText = $inventoryReader.ReadToEnd()
  } finally {
    $inventoryReader.Dispose()
  }
  $inventoryCountMatch = [regex]::Match($inventoryText, '(?m)^- File count: ([0-9]+)\r?$')
  $inventoryMatches = [regex]::Matches($inventoryText, '(?m)^- `([^`]+)`\r?$')
  $inventoryPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
  foreach ($match in $inventoryMatches) {
    if (-not $inventoryPaths.Add($match.Groups[1].Value)) {
      throw "Duplicate inventory path: $($match.Groups[1].Value)"
    }
  }
  if (-not $inventoryCountMatch.Success -or [int]$inventoryCountMatch.Groups[1].Value -ne $expectedEntryCount -or
      $inventoryPaths.Count -ne $rawEntryNames.Count -or
      @($rawEntryNames | Where-Object { -not $inventoryPaths.Contains($_) }).Count -ne 0) {
    throw 'Generated inventory does not match the complete archive.'
  }
} finally {
  $zip.Dispose()
}

$forbiddenEntries = @($centralEntries | Where-Object {
  $_.Name -match '^(?:\.github|adaptive-tutor/core|supabase|netlify|lovable|database|auth|authentication|identity|storage|synchronization|progress-sync)/'
})
if ($forbiddenEntries.Count -gt 0) {
  throw "Core-owned or external-system files entered the archive: $($forbiddenEntries.Name -join ', ')"
}

if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}
Move-Item -LiteralPath $temporaryArchivePath -Destination $archivePath

$checksum = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText($checksumPath, "$checksum  $archiveName`n", [System.Text.UTF8Encoding]::new($false))

Write-Output "ZIP=$archivePath"
Write-Output "SHA256=$checksum"
Write-Output "ENTRIES=$($centralEntries.Count)"
Write-Output "RAW_BACKSLASH_ENTRIES=$(@($centralEntries | Where-Object { $_.Name.Contains('\') }).Count)"
Write-Output "RAW_FORWARD_SLASH_ENTRIES=$(@($centralEntries | Where-Object { $_.Name.Contains('/') }).Count)"
Write-Output 'RAW_PATH_SAFETY=PASS'
Write-Output 'ZIP_ENCRYPTION=NONE'
Write-Output 'ZIP_SYMLINKS=NONE'
Write-Output 'ZIP_DIRECTORY_RECORDS=NONE'
Write-Output 'ZIP_INTEGRITY=PASS'
Write-Output 'MANIFEST_RECONCILIATION=PASS'
Write-Output 'MANIFEST_SELF_EXCLUSIONS=PASS'
Write-Output 'INVENTORY_RECONCILIATION=PASS'
Write-Output 'PACKAGE_BOUNDARY=PASS'
Write-Output 'CHECKSUM_VERIFICATION=PASS'
