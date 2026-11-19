$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot)
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
$releaseRoot = Join-Path $PWD ('.netlify/exonhost-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $releaseRoot
foreach ($item in @('dist','package.json','package-lock.json','passenger.cjs')) {
  Copy-Item -LiteralPath (Join-Path $PWD $item) -Destination $releaseRoot -Recurse
}
$manifest = Get-ChildItem -LiteralPath $releaseRoot -File -Recurse | ForEach-Object {
  [pscustomobject]@{ File=$_.FullName.Substring($releaseRoot.Length+1).Replace('\','/'); SHA256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $releaseRoot 'manifest.json')
$archive = $releaseRoot + '.zip'
# ZIP entry names must use '/' on Linux. Compress-Archive on this Windows host
# produced backslash entries, which are not a portable release artifact.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open($archive, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in (Get-ChildItem -LiteralPath $releaseRoot -File -Recurse)) {
    $entry = $file.FullName.Substring($releaseRoot.Length+1).Replace('\','/')
    $null = [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entry)
  }
} finally { $zip.Dispose() }
Write-Output $archive
