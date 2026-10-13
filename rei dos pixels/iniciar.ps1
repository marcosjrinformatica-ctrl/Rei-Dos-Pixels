param([switch]$AbrirNavegador)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$bundledNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$candidates = @()
if ($nodeCommand) { $candidates += $nodeCommand.Source }
$candidates += $bundledNode
$nodeExe = $null
foreach ($candidate in ($candidates | Select-Object -Unique)) {
  if (-not (Test-Path -LiteralPath $candidate)) { continue }
  $major = & $candidate -p 'parseInt(process.versions.node)'
  if ($LASTEXITCODE -eq 0 -and [int]$major -ge 24) { $nodeExe = $candidate; break }
}
if (-not $nodeExe) { throw 'Instale o Node.js 24 ou superior. O login precisa dele para acessar o banco de contas.' }
Write-Host "Iniciando o fliperama com Node.js $(& $nodeExe --version)"
if ($AbrirNavegador) {
  $serverUrl = 'http://localhost:3000'
  $envPath = Join-Path $PSScriptRoot '.env'
  if (Test-Path -LiteralPath $envPath) {
    $originLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^PUBLIC_ORIGIN=' } | Select-Object -First 1
    if ($originLine) { $serverUrl = ($originLine -replace '^PUBLIC_ORIGIN=', '').Trim() }
  }
  $browserJob = Start-Job -ArgumentList $serverUrl -ScriptBlock {
    param($url)
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
      try { $config = Invoke-RestMethod -Uri "$url/api/config" -TimeoutSec 2; if ($config.accounts) { Start-Process $url; return } } catch {}
      Start-Sleep -Seconds 1
    }
  }
}
try { & $nodeExe server.js } finally { if ($browserJob) { Stop-Job $browserJob -ErrorAction SilentlyContinue; Remove-Job $browserJob -Force -ErrorAction SilentlyContinue } }

