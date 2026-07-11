param(
  [string]$OutputDir = "..\..\releases"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$PackageJsonPath = Join-Path $Root "package.json"
$PackageJson = Get-Content -Raw -Encoding UTF8 -LiteralPath $PackageJsonPath | ConvertFrom-Json
$Version = [string]$PackageJson.version
$Out = Join-Path $Root $OutputDir
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$Zip = Join-Path $Out ("ddys-macos-v{0}.zip" -f $Version)
$PackageDir = Join-Path $Root "package"
if (Test-Path -LiteralPath $PackageDir) {
  Remove-Item -LiteralPath $PackageDir -Recurse -Force
}
if (Test-Path -LiteralPath $Zip) {
  Remove-Item -LiteralPath $Zip -Force
}

$RootPath = [System.IO.Path]::GetFullPath($Root)
$PackagePath = [System.IO.Path]::GetFullPath($PackageDir)
if (-not $PackagePath.StartsWith($RootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to create a package outside the project root."
}

$Include = @(
  ".github",
  "assets",
  "docs",
  "public",
  "src",
  "src-tauri",
  "tests",
  "tools",
  "index.html",
  "package.json",
  "vite.config.js",
  "README.md",
  "README.en.md",
  "PRIVACY.md",
  "LICENSE",
  ".gitignore"
)

New-Item -ItemType Directory -Path $PackageDir | Out-Null
foreach ($Item in $Include) {
  $Source = Join-Path $Root $Item
  $Target = Join-Path $PackageDir $Item
  if (-not (Test-Path -LiteralPath $Source)) {
    throw "Missing package item: $Item"
  }
  if ((Get-Item -LiteralPath $Source).PSIsContainer) {
    Copy-Item -LiteralPath $Source -Destination $Target -Recurse
  } else {
    New-Item -ItemType Directory -Path (Split-Path $Target -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Target
  }
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$Archive = [System.IO.Compression.ZipFile]::Open($Zip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $ResolvedPackage = [System.IO.Path]::GetFullPath($PackageDir).TrimEnd("\") + "\"
  $Files = Get-ChildItem -LiteralPath $PackageDir -Recurse -File
  foreach ($File in $Files) {
    $Full = [System.IO.Path]::GetFullPath($File.FullName)
    if (-not $Full.StartsWith($ResolvedPackage, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to package a file outside the staging directory: $Full"
    }
    $Relative = $Full.Substring($ResolvedPackage.Length).Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($Archive, $Full, $Relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally {
  $Archive.Dispose()
}

Remove-Item -LiteralPath $PackageDir -Recurse -Force
Write-Host $Zip
