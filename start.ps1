# start.ps1 — 安全启动 Greeno AI Studio 后端
# 用法: .\start.ps1 [port]
# 会先清理占用端口的旧进程，再启动 uvicorn

param(
    [int]$Port = 8787
)

$ErrorActionPreference = "Stop"

# ── 1. 检查并终止占用端口的旧进程 ────────────────────────────
$occupied = netstat -ano | Select-String ":$Port\s.*LISTENING"
if ($occupied) {
    $procIds = $occupied | ForEach-Object {
        ($_.ToString().Trim() -split "\s+")[-1]
    } | Sort-Object -Unique

    foreach ($procId in $procIds) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Port $Port occupied by $($proc.ProcessName) (PID $($proc.Id)), killing..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force
        }
    }

    $waited = 0
    while ($waited -lt 10) {
        Start-Sleep -Milliseconds 500
        $still = netstat -ano | Select-String ":$Port\s.*LISTENING"
        if (-not $still) { break }
        $waited++
    }
    if ($waited -ge 10) {
        Write-Host "Port $Port could not be freed" -ForegroundColor Red
        exit 1
    }
    Write-Host "Port $Port freed" -ForegroundColor Green
}

# ── 2. 启动 ──────────────────────────────────────────────────
Set-Location $PSScriptRoot\src\workers\python
Write-Host "Starting Greeno AI Studio on port $Port..." -ForegroundColor Cyan
uv run uvicorn cc_music.http_app:app --reload --host 127.0.0.1 --port $Port
