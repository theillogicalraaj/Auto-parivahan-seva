$ErrorActionPreference = "Stop"

# Folder containing this script and your website files
$projectFolder = $PSScriptRoot
$songsFolder = Join-Path $projectFolder "songs"
$outputFile = Join-Path $projectFolder "songs.json"

# Create the songs folder if it doesn't exist
if (!(Test-Path -LiteralPath $songsFolder)) {
    New-Item -ItemType Directory -Path $songsFolder | Out-Null
}

# Find MP3 files and create a JSON manifest for the website
$songs = @(
    Get-ChildItem -LiteralPath $songsFolder -Filter "*.mp3" -File |
    Sort-Object Name |
    ForEach-Object {
        [PSCustomObject]@{
            title = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
            src   = "songs/" + [uri]::EscapeDataString($_.Name)
        }
    }
)

# Write valid JSON, including an empty array when no MP3 files are present
$json = ConvertTo-Json -InputObject $songs -Depth 3
Set-Content -LiteralPath $outputFile -Value $json -Encoding utf8

Write-Host "Created: $outputFile"
Write-Host "MP3 files found: $($songs.Count)"
