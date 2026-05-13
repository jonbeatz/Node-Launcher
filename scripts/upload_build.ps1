# Vader Station: Automated Build Deployer v2.5 - SOVEREIGN FINAL
Write-Host "🦾 VADER PROTOCOL v2.5 ACTIVE" -ForegroundColor Magenta

# --- CONFIGURATION ---
$repo = "jonbeatz/Node-Launcher"
$distFolder = "D:\Cursor_Projectz\Node-Launcher-v2\dist"
$unpackedFolder = "$distFolder\win-unpacked"
$templatePath = "D:\Cursor_Projectz\Node-Launcher-v2\.cursor\docs\release_notes_template.md"

# 1. HARD-CODED PREFIX (Forces clean naming regardless of branch glitches)
$cleanPrefix = "VPE-JediBuild-main"

# 2. GITHUB TAG SYNC
Write-Host "🔍 Scrutinizing GitHub for existing releases..." -ForegroundColor Gray
$ghTags = gh release list --limit 50 | ForEach-Object { ($_ -split "`t")[0] }

$count = 1
while ($true) {
    $vaderVersion = "$cleanPrefix-v1.$count"
    # Skip if tag exists OR if it matches the old double-name glitch pattern
    if ($ghTags -contains $vaderVersion -or $vaderVersion -match "v1.1-v1.1") { 
        $count++ 
    } else { 
        break 
    }
}

Write-Host "🚀 TARGET VERSION: $vaderVersion" -ForegroundColor Cyan

# 3. ABSOLUTE CLEANUP (Vader Protocol: No Clutter)
if (Test-Path "$distFolder\*.zip") {
    Write-Host "🧹 Nuking all old zips in dist..." -NoNewline
    Get-ChildItem "$distFolder\*.zip" | Remove-Item -Force
    Write-Host " [DONE]" -ForegroundColor Green
}

# 4. CREATE THE ZIP
$vaderZipPath = "$distFolder\$vaderVersion.zip"
if (Test-Path $unpackedFolder) {
    Write-Host "📦 ZIPPING AS: $vaderVersion.zip" -ForegroundColor Yellow
    Compress-Archive -Path "$unpackedFolder\*" -DestinationPath $vaderZipPath -Force
    Write-Host "✅ Zip Created." -ForegroundColor Green
} else {
    Write-Error "❌ win-unpacked folder missing! Build the app first."; exit 1
}

# 5. PREPARE RELEASE NOTES (Template Injection)
$tempNotes = "$distFolder\temp_notes.md"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"

if (Test-Path $templatePath) {
    Write-Host "📝 Injecting data into Release Template..." -ForegroundColor Cyan
    $notesContent = Get-Content $templatePath
    $notesContent = $notesContent -replace '\{\{VERSION\}\}', $vaderVersion
    $notesContent = $notesContent -replace '\{\{BRANCH\}\}', "main"
    $notesContent = $notesContent -replace '\{\{TIMESTAMP\}\}', $timestamp
    $notesContent | Out-File -FilePath $tempNotes -Encoding utf8
} else {
    Write-Warning "⚠️ Template not found. Using fallback notes."
    "Automated Build: $vaderVersion`nTimestamp: $timestamp" | Out-File $tempNotes -Encoding utf8
}

# 6. ASSET HUNT (Locate the EXE)
$vaderExe = Get-ChildItem -Path $distFolder -Filter "*.exe" | Where-Object { $_.Name -notmatch "setup" } | Select-Object -First 1

# 7. UPLOAD TO GITHUB
Write-Host "📤 UPLOADING TO GITHUB..." -ForegroundColor Cyan
gh release create $vaderVersion --title "Build: $vaderVersion" --notes-file $tempNotes

if ($LASTEXITCODE -eq 0) {
    gh release upload $vaderVersion "$($vaderExe.FullName)" "$vaderZipPath"
    Write-Host "✨ MISSION ACCOMPLISHED: $vaderVersion" -ForegroundColor Green
} else {
    Write-Error "❌ GitHub Release creation failed."
}

# 8. CLEANUP TEMP FILES
if (Test-Path $tempNotes) { Remove-Item $tempNotes }

Write-Host "Powered by the MSC Media Engine 🦾✨" -ForegroundColor Gray