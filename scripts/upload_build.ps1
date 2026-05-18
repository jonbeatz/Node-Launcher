# VPE Jedi-Master: Automated Build Deployer v3.0
Write-Host "🦾 VPE JEDI-MASTER PROTOCOL v3.0 ACTIVE" -ForegroundColor Magenta

# --- CONFIGURATION ---
$repo       = "jonbeatz/Node-Launcher"
$repoRoot   = Split-Path -Parent $PSScriptRoot
$distFolder = Join-Path $repoRoot "dist"
$unpackedFolder = Join-Path $distFolder "win-unpacked"
$templatePath   = Join-Path $repoRoot ".cursor\docs\release_notes_template.md"

# 1. READ VERSION FROM package.json  (e.g. "3.0.0" → display "3.0")
$pkgJson = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$pkgVersion = $pkgJson.version          # e.g. "3.0.0"
# Convert semver to display form: "3.0.0" → "3.0", "3.1.0" → "3.1"
$verParts   = $pkgVersion -split '\.'
$displayVer = "$($verParts[0]).$($verParts[1])"   # major.minor only

# 2. GIT BRANCH — always named VPE-Jedi-Master-v<major.minor>
$gitBranch = (& git -C $repoRoot branch --show-current 2>$null | ForEach-Object { $_.Trim() })
if ([string]::IsNullOrWhiteSpace($gitBranch)) { $gitBranch = 'detached' }

# Canonical release prefix always matches the versioned branch name
$cleanPrefix = "VPE-Jedi-Master-v$displayVer"
Write-Host "🌿 Git branch : $gitBranch" -ForegroundColor DarkGray
Write-Host "📦 Release tag: $cleanPrefix  (package.json v$pkgVersion)" -ForegroundColor DarkGray

# 3. GITHUB TAG DEDUP — if the tag already exists, append a build counter
Write-Host "🔍 Checking GitHub for existing releases..." -ForegroundColor Gray
$ghTags = gh release list --limit 100 | ForEach-Object { ($_ -split "`t")[0] }

$releaseTag = $cleanPrefix
if ($ghTags -contains $releaseTag) {
    $count = 2
    while ($ghTags -contains "$cleanPrefix-b$count") { $count++ }
    $releaseTag = "$cleanPrefix-b$count"
    Write-Host "⚠️  Tag $cleanPrefix exists — using $releaseTag" -ForegroundColor Yellow
}
Write-Host "🚀 TARGET TAG: $releaseTag" -ForegroundColor Cyan

# 4. CLEAN OLD ZIPS
if (Test-Path "$distFolder\*.zip") {
    Write-Host "🧹 Removing old zips from dist..." -NoNewline
    Get-ChildItem "$distFolder\*.zip" | Remove-Item -Force
    Write-Host " [DONE]" -ForegroundColor Green
}

# 5. CREATE THE ZIP — Node-Launcher-v3.0-JEDI-MASTER.zip
$zipName    = "Node-Launcher-v$displayVer-JEDI-MASTER.zip"
$vaderZipPath = Join-Path $distFolder $zipName
if (Test-Path $unpackedFolder) {
    Write-Host "📦 ZIPPING AS: $zipName" -ForegroundColor Yellow
    Compress-Archive -Path "$unpackedFolder\*" -DestinationPath $vaderZipPath -Force
    Write-Host "✅ Zip created: $vaderZipPath" -ForegroundColor Green
} else {
    Write-Error "❌ win-unpacked folder missing! Run 'npm run build:win' first."; exit 1
}

# 6. RELEASE NOTES (template injection)
$tempNotes = Join-Path $distFolder "temp_notes.md"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
if (Test-Path $templatePath) {
    Write-Host "📝 Injecting release template..." -ForegroundColor Cyan
    $notes = (Get-Content $templatePath) `
        -replace '\{\{VERSION\}\}',   $releaseTag `
        -replace '\{\{BRANCH\}\}',    $gitBranch `
        -replace '\{\{TIMESTAMP\}\}', $timestamp
    $notes | Out-File -FilePath $tempNotes -Encoding utf8
} else {
    Write-Warning "⚠️ Template not found — using fallback notes."
    "VPE Jedi-Master Build: $releaseTag`nTimestamp: $timestamp" | Out-File $tempNotes -Encoding utf8
}

# 7. LOCATE EXE
$vaderExe = Get-ChildItem -Path $distFolder -Filter "*.exe" |
    Where-Object { $_.Name -notmatch "setup|Setup" } |
    Select-Object -First 1

# 8. UPLOAD TO GITHUB
Write-Host "📤 UPLOADING TO GITHUB: $releaseTag" -ForegroundColor Cyan
gh release create $releaseTag `
    --title "VPE Jedi-Master v$displayVer" `
    --notes-file $tempNotes

if ($LASTEXITCODE -eq 0) {
    if ($vaderExe) {
        gh release upload $releaseTag "$($vaderExe.FullName)" "$vaderZipPath"
    } else {
        gh release upload $releaseTag "$vaderZipPath"
        Write-Warning "⚠️ No EXE found — uploaded ZIP only."
    }
    Write-Host "✨ MISSION ACCOMPLISHED: $releaseTag  ($zipName)" -ForegroundColor Green
} else {
    Write-Error "❌ GitHub release creation failed."
}

# 9. CLEANUP
if (Test-Path $tempNotes) { Remove-Item $tempNotes }

Write-Host "Powered by the VPE Jedi-Master 🦾✨  v$displayVer" -ForegroundColor Gray
