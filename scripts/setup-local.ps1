# scripts/setup-local.ps1 - Fix 69: get a Windows PC ready to run Vaulte's checks locally.
# Run in PowerShell from the repo folder:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-local.ps1
# Safe to run again: it only installs what is missing.
$ErrorActionPreference = "Stop"

function Major($text, $pattern) {
  if ($text -match $pattern) { return [int]$Matches[1] }
  return 0
}

function NodeMajor() {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return 0 }
  return Major (node -v) 'v(\d+)\.'
}

function JavaMajor() {
  if (-not (Get-Command java -ErrorAction SilentlyContinue)) { return 0 }
  $out = cmd /c "java -version 2>&1" | Out-String
  return Major $out 'version "(\d+)'
}

function Step($label, $ok, $wingetId) {
  if ($ok) { Write-Host "ok       $label"; return $false }
  Write-Host "missing  $label -> installing $wingetId"
  winget install --id $wingetId -e --accept-package-agreements --accept-source-agreements | Out-Host
  return $true
}

if (-not (Test-Path "package.json")) { throw "Run this from the vaulte repo folder (package.json not found)." }

$installed = @()
$installed += Step "Git" ([bool](Get-Command git -ErrorAction SilentlyContinue)) "Git.Git"
$installed += Step "Node 22 or newer" ((NodeMajor) -ge 22) "OpenJS.NodeJS.LTS"
$installed += Step "Java 21 or newer (Firestore emulator)" ((JavaMajor) -ge 21) "EclipseAdoptium.Temurin.21.JDK"

if ($installed -contains $true) {
  Write-Host ""
  Write-Host "Something was installed. Close this window, open a NEW PowerShell in this folder and run the script again so it sees the new programs."
  exit 0
}

git config core.autocrlf true
Write-Host "ok       git core.autocrlf = true"

npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "Playwright browser install failed" }

$threads = (Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
Write-Host ""
Write-Host "Logical processors: $threads (Playwright uses half as workers)"
Write-Host "Unit tests:"
npm test
Write-Host "Plan for the current changes:"
npm run check -- --dry
Write-Host ""
Write-Host "Setup done. Send the output above back to Claude."
