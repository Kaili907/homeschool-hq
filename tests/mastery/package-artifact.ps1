[CmdletBinding()]
param(
  [string]$ValidateArchivePath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$approvedOwnershipRoots = @(
  "adaptive-learning/mastery/",
  "app/features/mastery/",
  "tests/mastery/"
)
$ownedRelativeRoots = @(
  "adaptive-learning/mastery",
  "app/features/mastery",
  "tests/mastery"
)
$expectedSourceFileCount = 54
$manifestRelativePath =
  "adaptive-learning/mastery/artifacts/SOURCE-MANIFEST.sha256"
$verificationRelativePath = "tests/mastery/zip-verification-result.json"
$correctedArchiveRelativePath =
  "adaptive-learning/mastery/artifacts/manuel-academy-mastery-map-session-1-corrected.zip"
$correctedSidecarRelativePath = "$correctedArchiveRelativePath.sha256"
$rejectedArchiveRelativePath =
  "adaptive-learning/mastery/artifacts/manuel-academy-mastery-map-session-1.zip"
$rejectedSidecarRelativePath = "$rejectedArchiveRelativePath.sha256"
$packageWorkRelativeRoot = "tests/mastery/.package-work"

function Assert-PathInsideRepository {
  param([Parameter(Mandatory)][string]$AbsolutePath)

  $rootWithSeparator = $repositoryRoot.TrimEnd("\") + "\"
  $candidate = [System.IO.Path]::GetFullPath($AbsolutePath)
  if (-not $candidate.StartsWith(
    $rootWithSeparator,
    [System.StringComparison]::OrdinalIgnoreCase
  )) {
    throw "Refusing to use a package path outside the repository: $candidate"
  }
}

function Get-NormalizedRepositoryRelativePath {
  param([Parameter(Mandatory)][string]$AbsolutePath)

  $absolute = [System.IO.Path]::GetFullPath($AbsolutePath)
  $rootWithSeparator = $repositoryRoot.TrimEnd("\") + "\"
  if (-not $absolute.StartsWith(
    $rootWithSeparator,
    [System.StringComparison]::OrdinalIgnoreCase
  )) {
    throw "Cannot create a repository-relative path for: $absolute"
  }

  return $absolute.Substring($rootWithSeparator.Length).Replace("\", "/")
}

function Write-Utf8File {
  param(
    [Parameter(Mandatory)][string]$LiteralPath,
    [Parameter(Mandatory)][string]$Content
  )

  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($LiteralPath, $Content, $utf8WithoutBom)
}

function Get-FileSha256 {
  param([Parameter(Mandatory)][string]$LiteralPath)

  return (
    Get-FileHash -LiteralPath $LiteralPath -Algorithm SHA256
  ).Hash.ToLowerInvariant()
}

function Get-StreamSha256 {
  param([Parameter(Mandatory)][System.IO.Stream]$Stream)

  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $sha256.ComputeHash($Stream)
    return (
      ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""
    )
  } finally {
    $sha256.Dispose()
  }
}

function Test-ApprovedOwnershipPath {
  param([Parameter(Mandatory)][string]$EntryName)

  foreach ($root in $approvedOwnershipRoots) {
    if ($EntryName.StartsWith(
      $root,
      [System.StringComparison]::Ordinal
    )) {
      return $true
    }
  }
  return $false
}

function Read-SourceManifest {
  param([Parameter(Mandatory)][string]$LiteralPath)

  $entries = @()
  $seenPaths = @()
  foreach ($line in @(
    Get-Content -LiteralPath $LiteralPath -Encoding UTF8 |
      Where-Object { $_.Trim().Length -gt 0 }
  )) {
    if ($line -notmatch "^([0-9a-f]{64})  (.+)$") {
      throw "Invalid source-manifest line: $line"
    }

    $entryPath = $Matches[2]
    if ($seenPaths -ccontains $entryPath) {
      throw "Duplicate source-manifest path: $entryPath"
    }
    $seenPaths += $entryPath
    $entries += [pscustomobject]@{
      Sha256 = $Matches[1]
      Path = $entryPath
    }
  }

  return @($entries)
}

function Read-ZipCentralDirectory {
  param([Parameter(Mandatory)][string]$LiteralPath)

  $bytes = [System.IO.File]::ReadAllBytes($LiteralPath)
  if ($bytes.Length -lt 22) {
    throw "ZIP is shorter than the minimum end-of-central-directory record."
  }

  $eocdOffset = -1
  $minimumSearchOffset = [Math]::Max(0, $bytes.Length - 65557)
  for ($offset = $bytes.Length - 22; $offset -ge $minimumSearchOffset; $offset--) {
    if (
      $bytes[$offset] -eq 0x50 -and
      $bytes[$offset + 1] -eq 0x4b -and
      $bytes[$offset + 2] -eq 0x05 -and
      $bytes[$offset + 3] -eq 0x06
    ) {
      $commentLength = [BitConverter]::ToUInt16($bytes, $offset + 20)
      if ($offset + 22 + $commentLength -eq $bytes.Length) {
        $eocdOffset = $offset
        break
      }
    }
  }
  if ($eocdOffset -lt 0) {
    throw "ZIP end-of-central-directory record was not found."
  }

  $diskNumber = [BitConverter]::ToUInt16($bytes, $eocdOffset + 4)
  $centralDirectoryDisk =
    [BitConverter]::ToUInt16($bytes, $eocdOffset + 6)
  $entriesOnDisk = [BitConverter]::ToUInt16($bytes, $eocdOffset + 8)
  $totalEntries = [BitConverter]::ToUInt16($bytes, $eocdOffset + 10)
  $centralDirectorySize =
    [BitConverter]::ToUInt32($bytes, $eocdOffset + 12)
  $centralDirectoryOffset =
    [BitConverter]::ToUInt32($bytes, $eocdOffset + 16)

  if (
    $diskNumber -ne 0 -or
    $centralDirectoryDisk -ne 0 -or
    $entriesOnDisk -ne $totalEntries
  ) {
    throw "Multi-disk ZIP archives are not accepted."
  }
  if (
    $totalEntries -eq 0xffff -or
    $centralDirectorySize -eq 0xffffffff -or
    $centralDirectoryOffset -eq 0xffffffff
  ) {
    throw "ZIP64 archives are not accepted for this artifact."
  }

  $centralDirectoryEnd =
    [int64]$centralDirectoryOffset + [int64]$centralDirectorySize
  if (
    $centralDirectoryOffset -gt $bytes.Length -or
    $centralDirectoryEnd -gt $eocdOffset
  ) {
    throw "ZIP central-directory bounds are invalid."
  }

  $strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
  $legacyEncoding = [System.Text.Encoding]::GetEncoding(437)
  $entries = @()
  $cursor = [int]$centralDirectoryOffset

  for ($index = 0; $index -lt $totalEntries; $index++) {
    if ($cursor + 46 -gt $bytes.Length) {
      throw "ZIP central-directory entry $index is truncated."
    }
    if (
      $bytes[$cursor] -ne 0x50 -or
      $bytes[$cursor + 1] -ne 0x4b -or
      $bytes[$cursor + 2] -ne 0x01 -or
      $bytes[$cursor + 3] -ne 0x02
    ) {
      throw "ZIP central-directory signature is invalid at entry $index."
    }

    $versionMadeBy = [BitConverter]::ToUInt16($bytes, $cursor + 4)
    $generalPurposeFlags =
      [BitConverter]::ToUInt16($bytes, $cursor + 8)
    $compressionMethod =
      [BitConverter]::ToUInt16($bytes, $cursor + 10)
    $compressedSize =
      [BitConverter]::ToUInt32($bytes, $cursor + 20)
    $uncompressedSize =
      [BitConverter]::ToUInt32($bytes, $cursor + 24)
    $fileNameLength =
      [BitConverter]::ToUInt16($bytes, $cursor + 28)
    $extraFieldLength =
      [BitConverter]::ToUInt16($bytes, $cursor + 30)
    $commentLength =
      [BitConverter]::ToUInt16($bytes, $cursor + 32)
    $externalAttributes =
      [BitConverter]::ToUInt32($bytes, $cursor + 38)
    $localHeaderOffset =
      [BitConverter]::ToUInt32($bytes, $cursor + 42)

    $entryLength =
      46 + $fileNameLength + $extraFieldLength + $commentLength
    if ($cursor + $entryLength -gt $bytes.Length) {
      throw "ZIP central-directory entry $index extends beyond the file."
    }

    $nameBytes = New-Object byte[] $fileNameLength
    [Array]::Copy($bytes, $cursor + 46, $nameBytes, 0, $fileNameLength)
    $usesUtf8 = ($generalPurposeFlags -band 0x0800) -ne 0
    try {
      if ($usesUtf8) {
        $name = $strictUtf8.GetString($nameBytes)
      } else {
        $name = $legacyEncoding.GetString($nameBytes)
      }
    } catch {
      throw "ZIP entry $index has an invalid encoded name."
    }

    $hostSystem = ($versionMadeBy -shr 8) -band 0xff
    $unixMode = ($externalAttributes -shr 16) -band 0xffff
    $unixFileType = $unixMode -band 0xf000
    $dosAttributes = $externalAttributes -band 0xffff
    $hasDosDirectoryAttribute = ($dosAttributes -band 0x10) -ne 0
    $hasUnixDirectoryType =
      $hostSystem -eq 3 -and $unixFileType -eq 0x4000
    $isDirectory =
      $name.EndsWith("/") -or
      $name.EndsWith("\") -or
      $hasDosDirectoryAttribute -or
      $hasUnixDirectoryType
    $isSymlink =
      $hostSystem -eq 3 -and $unixFileType -eq 0xa000
    $isUnixSpecial =
      $hostSystem -eq 3 -and
      $unixFileType -ne 0 -and
      $unixFileType -ne 0x8000 -and
      $unixFileType -ne 0x4000 -and
      $unixFileType -ne 0xa000
    $isDosSpecial =
      ($dosAttributes -band 0x08) -ne 0 -or
      ($dosAttributes -band 0x40) -ne 0
    $isSpecial = $isUnixSpecial -or $isDosSpecial

    $entries += [pscustomobject]@{
      Index = $index
      Name = $name
      GeneralPurposeFlags = [int]$generalPurposeFlags
      CompressionMethod = [int]$compressionMethod
      CompressedSize = [uint32]$compressedSize
      UncompressedSize = [uint32]$uncompressedSize
      LocalHeaderOffset = [uint32]$localHeaderOffset
      ExternalAttributes = [uint32]$externalAttributes
      IsDirectory = [bool]$isDirectory
      IsSymlink = [bool]$isSymlink
      IsSpecial = [bool]$isSpecial
      IsRegularFile =
        [bool](-not $isDirectory -and -not $isSymlink -and -not $isSpecial)
      IsEncrypted = [bool](($generalPurposeFlags -band 0x0001) -ne 0)
      HasBackslash = [bool]($nameBytes -contains [byte]0x5c)
    }
    $cursor += $entryLength
  }

  if ($cursor -ne $centralDirectoryEnd) {
    throw (
      "ZIP central-directory size mismatch: parsed $cursor, expected " +
      "$centralDirectoryEnd."
    )
  }

  return [pscustomobject]@{
    EntryCount = [int]$totalEntries
    CentralDirectoryOffset = [uint32]$centralDirectoryOffset
    CentralDirectorySize = [uint32]$centralDirectorySize
    Entries = @($entries)
  }
}

function Get-ArchiveEntryContentMeasurements {
  param(
    [Parameter(Mandatory)][string]$ArchivePath,
    [Parameter(Mandatory)]$CentralDirectory
  )

  $measurements = @()
  $errors = @()
  $archive = $null
  try {
    $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
    if ($archive.Entries.Count -ne $CentralDirectory.Entries.Count) {
      $errors += (
        "ZipArchive exposed $($archive.Entries.Count) entries; the central " +
        "directory declared $($CentralDirectory.Entries.Count)."
      )
    }

    $comparableCount =
      [Math]::Min($archive.Entries.Count, $CentralDirectory.Entries.Count)
    for ($index = 0; $index -lt $comparableCount; $index++) {
      $zipEntry = $archive.Entries[$index]
      $centralEntry = $CentralDirectory.Entries[$index]
      if ($zipEntry.FullName -cne $centralEntry.Name) {
        $errors += (
          "Entry-name disagreement at index ${index}: ZipArchive=" +
          "'$($zipEntry.FullName)', central-directory='$($centralEntry.Name)'."
        )
      }

      $entryHash = $null
      $readSucceeded = $false
      $entryError = $null
      try {
        $entryStream = $zipEntry.Open()
        try {
          $entryHash = Get-StreamSha256 -Stream $entryStream
          $readSucceeded = $true
        } finally {
          $entryStream.Dispose()
        }
      } catch {
        $entryError = $_.Exception.Message
        $errors += "Unable to read '$($centralEntry.Name)': $entryError"
      }

      $measurements += [pscustomobject]@{
        Index = $index
        Name = $centralEntry.Name
        Sha256 = $entryHash
        ReadSucceeded = $readSucceeded
        Error = $entryError
      }
    }
  } catch {
    $errors += "Unable to open ZIP content: $($_.Exception.Message)"
  } finally {
    if ($null -ne $archive) {
      $archive.Dispose()
    }
  }

  return [pscustomobject]@{
    Entries = @($measurements)
    Errors = @($errors)
  }
}

function Measure-PackageArchive {
  param(
    [Parameter(Mandatory)][string]$ArchivePath,
    [Parameter(Mandatory)][string]$ManifestPath
  )

  $manifestEntries = @(Read-SourceManifest -LiteralPath $ManifestPath)
  $expectedEntryNames = @(
    $manifestEntries | ForEach-Object { $_.Path }
    $manifestRelativePath
    $verificationRelativePath
  )
  $centralDirectory =
    Read-ZipCentralDirectory -LiteralPath $ArchivePath
  $centralEntries = @($centralDirectory.Entries)
  $centralNames = @($centralEntries | ForEach-Object { $_.Name })

  $directoryEntries = @(
    $centralEntries |
      Where-Object { $_.IsDirectory } |
      ForEach-Object { $_.Name }
  )
  $regularFileEntries = @(
    $centralEntries |
      Where-Object { $_.IsRegularFile } |
      ForEach-Object { $_.Name }
  )
  $symlinkEntries = @(
    $centralEntries |
      Where-Object { $_.IsSymlink } |
      ForEach-Object { $_.Name }
  )
  $specialFileEntries = @(
    $centralEntries |
      Where-Object { $_.IsSpecial } |
      ForEach-Object { $_.Name }
  )
  $encryptedEntries = @(
    $centralEntries |
      Where-Object { $_.IsEncrypted } |
      ForEach-Object { $_.Name }
  )
  $backslashEntries = @(
    $centralEntries |
      Where-Object { $_.HasBackslash -or $_.Name.Contains("\") } |
      ForEach-Object { $_.Name }
  )

  $absolutePathEntries = @()
  $traversalPathEntries = @()
  $outsideOwnershipEntries = @()
  $unsafePathEntries = @()
  foreach ($entry in $centralEntries) {
    $name = $entry.Name
    $isAbsolute =
      $name.StartsWith("/") -or
      $name.StartsWith("\") -or
      $name -match "^[A-Za-z]:" -or
      $name.StartsWith("//")
    if ($isAbsolute) {
      $absolutePathEntries += $name
    }

    $segments = @($name.Split([char]"/"))
    $hasTraversalSegment =
      $segments -contains "." -or
      $segments -contains ".." -or
      $segments -contains ""
    if ($hasTraversalSegment) {
      $traversalPathEntries += $name
    }

    $insideOwnership = Test-ApprovedOwnershipPath -EntryName $name
    if (-not $insideOwnership) {
      $outsideOwnershipEntries += $name
    }

    if (
      $isAbsolute -or
      $hasTraversalSegment -or
      -not $insideOwnership -or
      $entry.HasBackslash -or
      $name.Contains([char]0)
    ) {
      $unsafePathEntries += $name
    }
  }

  $duplicateEntries = @()
  $caseCollisions = @()
  for ($left = 0; $left -lt $centralNames.Count; $left++) {
    for ($right = $left + 1; $right -lt $centralNames.Count; $right++) {
      $leftName = $centralNames[$left]
      $rightName = $centralNames[$right]
      if ($leftName -ceq $rightName) {
        if (-not ($duplicateEntries -ccontains $leftName)) {
          $duplicateEntries += $leftName
        }
      } elseif ($leftName -ieq $rightName) {
        $collision = "$leftName <> $rightName"
        if (-not ($caseCollisions -ccontains $collision)) {
          $caseCollisions += $collision
        }
      }
    }
  }

  $missingEntries = @(
    $expectedEntryNames |
      Where-Object {
        $expectedName = $_
        @($centralNames | Where-Object { $_ -ceq $expectedName }).Count -ne 1
      }
  )
  $unexpectedEntries = @(
    $centralNames |
      Where-Object {
        $actualName = $_
        -not ($expectedEntryNames -ccontains $actualName)
      }
  )

  $content =
    Get-ArchiveEntryContentMeasurements `
      -ArchivePath $ArchivePath `
      -CentralDirectory $centralDirectory

  $sourceHashResults = @()
  foreach ($manifestEntry in $manifestEntries) {
    $matchingContent = @(
      $content.Entries |
        Where-Object {
          $_.Name -ceq $manifestEntry.Path -and $_.ReadSucceeded
        }
    )
    $actualHash = $null
    if ($matchingContent.Count -eq 1) {
      $actualHash = $matchingContent[0].Sha256
    }
    $sourceHashResults += [pscustomobject]@{
      path = $manifestEntry.Path
      expectedSha256 = $manifestEntry.Sha256
      actualSha256 = $actualHash
      matches =
        [bool](
          $null -ne $actualHash -and
          $actualHash -ceq $manifestEntry.Sha256
        )
    }
  }
  $hashMismatchEntries = @(
    $sourceHashResults |
      Where-Object { -not $_.matches } |
      ForEach-Object { $_.path }
  )
  $sourceHashesCalculatedCount = @(
    $sourceHashResults | Where-Object { $null -ne $_.actualSha256 }
  ).Count

  $manifestContentEntry = @(
    $content.Entries |
      Where-Object {
        $_.Name -ceq $manifestRelativePath -and $_.ReadSucceeded
      }
  )
  $externalManifestHash = Get-FileSha256 -LiteralPath $ManifestPath
  $manifestEntryMatchesExternalManifest =
    $manifestContentEntry.Count -eq 1 -and
    $manifestContentEntry[0].Sha256 -ceq $externalManifestHash

  $verificationContentEntry = @(
    $content.Entries |
      Where-Object {
        $_.Name -ceq $verificationRelativePath -and $_.ReadSucceeded
      }
  )
  $zipIntegrityPassed =
    $content.Errors.Count -eq 0 -and
    $content.Entries.Count -eq $centralEntries.Count -and
    @($content.Entries | Where-Object { -not $_.ReadSucceeded }).Count -eq 0
  $exactEntrySetMatched =
    $missingEntries.Count -eq 0 -and
    $unexpectedEntries.Count -eq 0 -and
    $duplicateEntries.Count -eq 0 -and
    $caseCollisions.Count -eq 0
  $sourceHashesMatched =
    $manifestEntries.Count -eq $expectedSourceFileCount -and
    $sourceHashesCalculatedCount -eq $manifestEntries.Count -and
    $hashMismatchEntries.Count -eq 0
  $packagingChecksPassed =
    $zipIntegrityPassed -and
    $centralEntries.Count -eq $expectedEntryNames.Count -and
    $regularFileEntries.Count -eq $expectedEntryNames.Count -and
    $directoryEntries.Count -eq 0 -and
    $symlinkEntries.Count -eq 0 -and
    $specialFileEntries.Count -eq 0 -and
    $encryptedEntries.Count -eq 0 -and
    $backslashEntries.Count -eq 0 -and
    $absolutePathEntries.Count -eq 0 -and
    $traversalPathEntries.Count -eq 0 -and
    $outsideOwnershipEntries.Count -eq 0 -and
    $unsafePathEntries.Count -eq 0 -and
    $exactEntrySetMatched -and
    $sourceHashesMatched -and
    $manifestEntryMatchesExternalManifest -and
    $verificationContentEntry.Count -eq 1

  return [pscustomobject]@{
    CentralDirectoryEntryNames = @($centralNames)
    CentralDirectoryEntryCount = $centralEntries.Count
    RegularFileEntryCount = $regularFileEntries.Count
    DirectoryEntryCount = $directoryEntries.Count
    ManifestSourceFileCount = $manifestEntries.Count
    ExpectedRegularFileEntryCount = $expectedEntryNames.Count
    SourceHashesCalculatedCount = $sourceHashesCalculatedCount
    DirectoryEntries = @($directoryEntries)
    BackslashEntries = @($backslashEntries)
    MissingEntries = @($missingEntries)
    UnexpectedEntries = @($unexpectedEntries)
    OutsideOwnershipEntries = @($outsideOwnershipEntries)
    UnsafePathEntries = @($unsafePathEntries)
    AbsolutePathEntries = @($absolutePathEntries)
    TraversalPathEntries = @($traversalPathEntries)
    DuplicateEntries = @($duplicateEntries)
    CaseCollisions = @($caseCollisions)
    SymlinkEntries = @($symlinkEntries)
    SpecialFileEntries = @($specialFileEntries)
    EncryptedEntries = @($encryptedEntries)
    HashMismatchEntries = @($hashMismatchEntries)
    IntegrityErrors = @($content.Errors)
    SourceHashResults = @($sourceHashResults)
    ManifestEntryMatchesExternalManifest =
      [bool]$manifestEntryMatchesExternalManifest
    ZipIntegrityPassed = [bool]$zipIntegrityPassed
    ForwardSlashPathsOnly = [bool]($backslashEntries.Count -eq 0)
    ExactEntrySetMatched = [bool]$exactEntrySetMatched
    ApprovedOwnershipOnly =
      [bool]($outsideOwnershipEntries.Count -eq 0)
    SourceHashesMatched = [bool]$sourceHashesMatched
    PackagingChecksPassed = [bool]$packagingChecksPassed
  }
}

function Convert-MeasurementToVerificationRecord {
  param([Parameter(Mandatory)]$Measurement)

  return [ordered]@{
    centralDirectoryEntryCount =
      $Measurement.CentralDirectoryEntryCount
    centralDirectoryEntries =
      @($Measurement.CentralDirectoryEntryNames)
    regularFileEntryCount = $Measurement.RegularFileEntryCount
    directoryEntryCount = $Measurement.DirectoryEntryCount
    manifestSourceFileCount = $Measurement.ManifestSourceFileCount
    expectedRegularFileEntryCount =
      $Measurement.ExpectedRegularFileEntryCount
    sourceHashesCalculatedCount =
      $Measurement.SourceHashesCalculatedCount
    directoryEntries = @($Measurement.DirectoryEntries)
    backslashEntries = @($Measurement.BackslashEntries)
    missingEntries = @($Measurement.MissingEntries)
    unexpectedEntries = @($Measurement.UnexpectedEntries)
    outsideOwnershipEntries = @($Measurement.OutsideOwnershipEntries)
    unsafePathEntries = @($Measurement.UnsafePathEntries)
    absolutePathEntries = @($Measurement.AbsolutePathEntries)
    traversalPathEntries = @($Measurement.TraversalPathEntries)
    duplicateEntries = @($Measurement.DuplicateEntries)
    caseCollisions = @($Measurement.CaseCollisions)
    symlinkEntries = @($Measurement.SymlinkEntries)
    specialFileEntries = @($Measurement.SpecialFileEntries)
    encryptedEntries = @($Measurement.EncryptedEntries)
    hashMismatchEntries = @($Measurement.HashMismatchEntries)
    integrityErrors = @($Measurement.IntegrityErrors)
    sourceHashResults = @($Measurement.SourceHashResults)
    manifestEntryMatchesExternalManifest =
      [bool]$Measurement.ManifestEntryMatchesExternalManifest
    zipIntegrityPassed = [bool]$Measurement.ZipIntegrityPassed
    forwardSlashPathsOnly = [bool]$Measurement.ForwardSlashPathsOnly
    exactEntrySetMatched = [bool]$Measurement.ExactEntrySetMatched
    approvedOwnershipOnly = [bool]$Measurement.ApprovedOwnershipOnly
    sourceHashesMatched = [bool]$Measurement.SourceHashesMatched
    packagingChecksPassed = [bool]$Measurement.PackagingChecksPassed
  }
}

function Convert-VerificationRecordToJson {
  param([Parameter(Mandatory)]$Record)

  return ($Record | ConvertTo-Json -Depth 12)
}

function Get-EmbeddedVerificationJson {
  param([Parameter(Mandatory)][string]$ArchivePath)

  $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
  try {
    $matchingEntries = @(
      $archive.Entries |
        Where-Object { $_.FullName -ceq $verificationRelativePath }
    )
    if ($matchingEntries.Count -ne 1) {
      return $null
    }

    $stream = $matchingEntries[0].Open()
    try {
      $reader = New-Object System.IO.StreamReader(
        $stream,
        (New-Object System.Text.UTF8Encoding($false, $true)),
        $true
      )
      try {
        return $reader.ReadToEnd()
      } finally {
        $reader.Dispose()
      }
    } finally {
      $stream.Dispose()
    }
  } finally {
    $archive.Dispose()
  }
}

function Add-RegularFileEntry {
  param(
    [Parameter(Mandatory)][System.IO.Compression.ZipArchive]$Archive,
    [Parameter(Mandatory)][string]$EntryName,
    [Parameter(Mandatory)][string]$SourcePath
  )

  if ($EntryName.Contains("\") -or $EntryName.EndsWith("/")) {
    throw "Refusing to create a non-regular ZIP path: $EntryName"
  }
  if (-not (Test-ApprovedOwnershipPath -EntryName $EntryName)) {
    throw "Refusing to create an outside-ownership ZIP path: $EntryName"
  }

  $entry = $Archive.CreateEntry(
    $EntryName,
    [System.IO.Compression.CompressionLevel]::Optimal
  )
  $entry.ExternalAttributes = 0x20
  $source = [System.IO.File]::OpenRead($SourcePath)
  try {
    $destination = $entry.Open()
    try {
      $source.CopyTo($destination)
    } finally {
      $destination.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

function New-PackageArchive {
  param(
    [Parameter(Mandatory)][string]$DestinationPath,
    [Parameter(Mandatory)]$SourceFiles,
    [Parameter(Mandatory)][string]$ManifestPath,
    [Parameter(Mandatory)][string]$VerificationPath
  )

  if (Test-Path -LiteralPath $DestinationPath -PathType Leaf) {
    Remove-Item -LiteralPath $DestinationPath -Force
  }

  $items = @(
    $SourceFiles | ForEach-Object {
      [pscustomobject]@{
        EntryName = $_.EntryName
        SourcePath = $_.AbsolutePath
      }
    }
    [pscustomobject]@{
      EntryName = $manifestRelativePath
      SourcePath = $ManifestPath
    }
    [pscustomobject]@{
      EntryName = $verificationRelativePath
      SourcePath = $VerificationPath
    }
  ) | Sort-Object -Property EntryName

  $fileStream = [System.IO.File]::Open(
    $DestinationPath,
    [System.IO.FileMode]::CreateNew,
    [System.IO.FileAccess]::ReadWrite,
    [System.IO.FileShare]::None
  )
  try {
    $archive = New-Object System.IO.Compression.ZipArchive(
      $fileStream,
      [System.IO.Compression.ZipArchiveMode]::Create,
      $false,
      (New-Object System.Text.UTF8Encoding($false))
    )
    try {
      foreach ($item in $items) {
        Add-RegularFileEntry `
          -Archive $archive `
          -EntryName $item.EntryName `
          -SourcePath $item.SourcePath
      }
    } finally {
      $archive.Dispose()
    }
  } finally {
    $fileStream.Dispose()
  }
}

function Get-PackagedSourceFiles {
  $excludedExactPaths = @(
    $rejectedArchiveRelativePath,
    $rejectedSidecarRelativePath,
    $correctedArchiveRelativePath,
    $correctedSidecarRelativePath,
    $manifestRelativePath,
    $verificationRelativePath,
    "tests/mastery/preview-server.out.log",
    "tests/mastery/preview-server.err.log"
  )
  $excludedPrefixes = @(
    "app/features/mastery/.preview-dist/",
    "$packageWorkRelativeRoot/"
  )

  $files = @()
  foreach ($relativeRoot in $ownedRelativeRoots) {
    $absoluteRoot = Join-Path $repositoryRoot $relativeRoot
    if (-not (Test-Path -LiteralPath $absoluteRoot -PathType Container)) {
      throw "Owned source root is missing: $relativeRoot"
    }

    foreach ($file in @(
      Get-ChildItem -LiteralPath $absoluteRoot -Recurse -File -Force
    )) {
      $relativePath =
        Get-NormalizedRepositoryRelativePath -AbsolutePath $file.FullName
      $excludedByPrefix = $false
      foreach ($prefix in $excludedPrefixes) {
        if ($relativePath.StartsWith(
          $prefix,
          [System.StringComparison]::OrdinalIgnoreCase
        )) {
          $excludedByPrefix = $true
          break
        }
      }
      if (
        -not ($excludedExactPaths -contains $relativePath) -and
        -not $excludedByPrefix
      ) {
        $files += [pscustomobject]@{
          AbsolutePath = $file.FullName
          EntryName = $relativePath
        }
      }
    }
  }

  return @($files | Sort-Object -Property EntryName)
}

function Write-SourceManifest {
  param(
    [Parameter(Mandatory)]$SourceFiles,
    [Parameter(Mandatory)][string]$DestinationPath
  )

  $lines = @(
    $SourceFiles | ForEach-Object {
      "$(Get-FileSha256 -LiteralPath $_.AbsolutePath)  $($_.EntryName)"
    }
  )
  Write-Utf8File `
    -LiteralPath $DestinationPath `
    -Content (($lines -join [Environment]::NewLine) + [Environment]::NewLine)
}

$publishedManifestPath = Join-Path $repositoryRoot $manifestRelativePath

if ($ValidateArchivePath) {
  $resolvedArchivePath = (Resolve-Path -LiteralPath $ValidateArchivePath).Path
  $measurement =
    Measure-PackageArchive `
      -ArchivePath $resolvedArchivePath `
      -ManifestPath $publishedManifestPath
  $record = Convert-MeasurementToVerificationRecord -Measurement $measurement
  $expectedRecordJson =
    Convert-VerificationRecordToJson -Record $record
  $embeddedRecordJson =
    Get-EmbeddedVerificationJson -ArchivePath $resolvedArchivePath
  $embeddedRecordMatchesMeasurements =
    $null -ne $embeddedRecordJson -and
    $embeddedRecordJson.Trim() -ceq $expectedRecordJson.Trim()
  $accepted =
    $measurement.PackagingChecksPassed -and
    $embeddedRecordMatchesMeasurements

  [ordered]@{
    accepted = [bool]$accepted
    embeddedVerificationRecordMatchesMeasurements =
      [bool]$embeddedRecordMatchesMeasurements
    measuredVerificationRecord = $record
  } | ConvertTo-Json -Depth 14

  if (-not $accepted) {
    throw "Archive packaging checks failed."
  }
  return
}

$sourceFiles = @(Get-PackagedSourceFiles)
if ($sourceFiles.Count -ne $expectedSourceFileCount) {
  throw (
    "Expected exactly $expectedSourceFileCount source/report files; found " +
    "$($sourceFiles.Count)."
  )
}

$packageWorkRoot = Join-Path $repositoryRoot $packageWorkRelativeRoot
$workRoot = Join-Path $packageWorkRoot ([Guid]::NewGuid().ToString("N"))
$candidateArchivePath = Join-Path $workRoot "corrected-candidate.zip"
$candidateManifestPath = Join-Path $workRoot "SOURCE-MANIFEST.sha256"
$candidateVerificationPath =
  Join-Path $workRoot "zip-verification-result.json"
$candidateSidecarPath = Join-Path $workRoot "corrected-candidate.zip.sha256"
Assert-PathInsideRepository -AbsolutePath $workRoot

try {
  New-Item -ItemType Directory -Path $workRoot -Force | Out-Null
  Write-SourceManifest `
    -SourceFiles $sourceFiles `
    -DestinationPath $candidateManifestPath
  $candidateManifestEntries =
    @(Read-SourceManifest -LiteralPath $candidateManifestPath)
  if ($candidateManifestEntries.Count -ne $expectedSourceFileCount) {
    throw "Generated source manifest does not contain 54 entries."
  }

  Write-Utf8File -LiteralPath $candidateVerificationPath -Content "{}"
  New-PackageArchive `
    -DestinationPath $candidateArchivePath `
    -SourceFiles $sourceFiles `
    -ManifestPath $candidateManifestPath `
    -VerificationPath $candidateVerificationPath

  $initialMeasurement =
    Measure-PackageArchive `
      -ArchivePath $candidateArchivePath `
      -ManifestPath $candidateManifestPath
  if (-not $initialMeasurement.PackagingChecksPassed) {
    throw "Candidate archive failed structural or source-hash measurement."
  }

  $measuredRecord =
    Convert-MeasurementToVerificationRecord -Measurement $initialMeasurement
  $measuredRecordJson =
    Convert-VerificationRecordToJson -Record $measuredRecord
  Write-Utf8File `
    -LiteralPath $candidateVerificationPath `
    -Content ($measuredRecordJson + [Environment]::NewLine)

  New-PackageArchive `
    -DestinationPath $candidateArchivePath `
    -SourceFiles $sourceFiles `
    -ManifestPath $candidateManifestPath `
    -VerificationPath $candidateVerificationPath

  $finalMeasurement =
    Measure-PackageArchive `
      -ArchivePath $candidateArchivePath `
      -ManifestPath $candidateManifestPath
  $finalRecord =
    Convert-MeasurementToVerificationRecord -Measurement $finalMeasurement
  $finalRecordJson =
    Convert-VerificationRecordToJson -Record $finalRecord
  $embeddedRecordJson =
    Get-EmbeddedVerificationJson -ArchivePath $candidateArchivePath
  $recordMatchesMeasurements =
    $null -ne $embeddedRecordJson -and
    $embeddedRecordJson.Trim() -ceq $finalRecordJson.Trim()

  if (
    -not $finalMeasurement.PackagingChecksPassed -or
    -not $recordMatchesMeasurements
  ) {
    throw (
      "Candidate archive failed final measurement or its embedded " +
      "verification record did not match the measured central directory."
    )
  }

  $candidateHash = Get-FileSha256 -LiteralPath $candidateArchivePath
  $correctedArchiveFileName =
    [System.IO.Path]::GetFileName($correctedArchiveRelativePath)
  Write-Utf8File `
    -LiteralPath $candidateSidecarPath `
    -Content (
      "$candidateHash *$correctedArchiveFileName" +
      [Environment]::NewLine
    )

  $publishedCorrectedArchivePath =
    Join-Path $repositoryRoot $correctedArchiveRelativePath
  $publishedCorrectedSidecarPath =
    Join-Path $repositoryRoot $correctedSidecarRelativePath
  $publishedVerificationPath =
    Join-Path $repositoryRoot $verificationRelativePath
  $publishedArtifactDirectory =
    Split-Path -Parent $publishedCorrectedArchivePath

  @(
    $publishedCorrectedArchivePath,
    $publishedCorrectedSidecarPath,
    $publishedManifestPath,
    $publishedVerificationPath
  ) | ForEach-Object { Assert-PathInsideRepository -AbsolutePath $_ }
  New-Item `
    -ItemType Directory `
    -Path $publishedArtifactDirectory `
    -Force |
    Out-Null

  Copy-Item `
    -LiteralPath $candidateArchivePath `
    -Destination $publishedCorrectedArchivePath `
    -Force
  Copy-Item `
    -LiteralPath $candidateSidecarPath `
    -Destination $publishedCorrectedSidecarPath `
    -Force
  Copy-Item `
    -LiteralPath $candidateManifestPath `
    -Destination $publishedManifestPath `
    -Force
  Copy-Item `
    -LiteralPath $candidateVerificationPath `
    -Destination $publishedVerificationPath `
    -Force

  [ordered]@{
    archive = $correctedArchiveRelativePath
    sidecar = $correctedSidecarRelativePath
    sha256 = $candidateHash
    centralDirectoryEntryCount =
      $finalMeasurement.CentralDirectoryEntryCount
    regularFileEntryCount = $finalMeasurement.RegularFileEntryCount
    directoryEntryCount = $finalMeasurement.DirectoryEntryCount
    sourceManifestEntryCount =
      $finalMeasurement.ManifestSourceFileCount
    forwardSlashPathsOnly =
      $finalMeasurement.ForwardSlashPathsOnly
    exactEntrySetMatched =
      $finalMeasurement.ExactEntrySetMatched
    approvedOwnershipOnly =
      $finalMeasurement.ApprovedOwnershipOnly
    sourceHashesMatched =
      $finalMeasurement.SourceHashesMatched
    embeddedVerificationRecordMatchesMeasurements =
      [bool]$recordMatchesMeasurements
  } | ConvertTo-Json -Depth 5
} finally {
  if (Test-Path -LiteralPath $workRoot -PathType Container) {
    $resolvedWorkRoot = (Resolve-Path -LiteralPath $workRoot).Path
    Assert-PathInsideRepository -AbsolutePath $resolvedWorkRoot
    Remove-Item -LiteralPath $resolvedWorkRoot -Recurse -Force
  }
  if (
    (Test-Path -LiteralPath $packageWorkRoot -PathType Container) -and
    @(Get-ChildItem -LiteralPath $packageWorkRoot -Force).Count -eq 0
  ) {
    $resolvedPackageWorkRoot =
      (Resolve-Path -LiteralPath $packageWorkRoot).Path
    Assert-PathInsideRepository -AbsolutePath $resolvedPackageWorkRoot
    Remove-Item -LiteralPath $resolvedPackageWorkRoot -Force
  }
}
