param(
    [string]$ProjectPath = "C:\Users\GPO\exam-manager-frontend"
)

$ErrorActionPreference = "Stop"

$lockFile = Join-Path $ProjectPath "package-lock.json"
$backupFile = Join-Path $ProjectPath "package-lock.before-fix.json"

if (-not (Test-Path $lockFile)) {
    Write-Error "package-lock.json غير موجود في: $lockFile"
}

Write-Host "Project Path: $ProjectPath"
Write-Host "Lock File:    $lockFile"

Copy-Item $lockFile $backupFile -Force
Write-Host "Backup saved: $backupFile"

$content = Get-Content $lockFile -Raw -Encoding UTF8

$patterns = @(
    'https://packages\.applied-caas-gateway1\.internal\.api\.openai\.org/artifactory/api/npm/npm-public/',
    'https://packages\.applied-caas-gateway1\.internal\.api\.openai\.org/'
)

foreach ($pattern in $patterns) {
    $content = [regex]::Replace($content, $pattern, 'https://registry.npmjs.org/')
}

[System.IO.File]::WriteAllText($lockFile, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "package-lock.json updated."

npm config set registry https://registry.npmjs.org/ | Out-Null
$registry = npm config get registry
Write-Host "npm registry: $registry"

$remaining = Select-String -Path $lockFile -Pattern 'packages\.applied-caas|artifactory/api/npm' -SimpleMatch:$false

if ($remaining) {
    Write-Warning "ما زالت توجد روابط داخلية داخل package-lock.json. راجع الملف يدويًا."
} else {
    Write-Host "Success: لم يعد يوجد أي رابط داخلي داخل package-lock.json"
}

Write-Host ""
Write-Host "الخطوة التالية:"
Write-Host "1) ارفع package-lock.json الجديد إلى GitHub"
Write-Host "2) في Vercel اجعل Install Command = npm install --registry=https://registry.npmjs.org/"
Write-Host "3) ثم Redeploy"
