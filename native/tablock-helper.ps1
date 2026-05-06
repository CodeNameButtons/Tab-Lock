# Tab Lock Native Helper - Windows
# Auto-discovers Firefox profiles and prevents extension removal.
param()

$ErrorActionPreference = "SilentlyContinue"
$running = $true

function Read-Message {
    try {
        $lenBytes = [Console]::In.Read(4, 0, 4)
        if ($lenBytes -eq 0 -or $lenBytes.Length -lt 4) { return $null }
        $len = [System.BitConverter]::ToUInt32($lenBytes, 0)
        if ($len -eq 0) { return $null }
        $raw = [Console]::In.Read($len, 0, $len)
        if ($raw.Length -eq 0) { return $null }
        return [System.Text.Encoding]::UTF8.GetString($raw)
    } catch { return $null }
}

function Send-Message($obj) {
    try {
        $json = ($obj | ConvertTo-Json -Compress) + "`n"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        $len = [System.BitConverter]::GetBytes([uint32]$bytes.Length)
        [Console]::Out.Write($len, 0, 4)
        [Console]::Out.Write($bytes, 0, $bytes.Length)
        [Console]::Out.Flush()
    } catch {}
}

function Find-Profiles {
    $dirs = @()
    $basePaths = @(
        "$env:APPDATA\Mozilla\Firefox\Profiles",
        "$env:APPDATA\Zen Browser\Profiles",
        "$env:APPDATA\Waterfox\Profiles"
    )
    foreach ($base in $basePaths) {
        if (Test-Path $base) {
            Get-ChildItem $base -Directory | ForEach-Object {
                $extFile = Join-Path $_.FullName "extensions.json"
                if (Test-Path $extFile) { $dirs += $_.FullName }
            }
        }
    }
    return $dirs
}

function Watch-Profiles {
    $pidFile = Join-Path $env:TEMP "tablock_helper.pid"
    [System.IO.File]::WriteAllText($pidFile, [System.Diagnostics.Process]::GetCurrentProcess().Id.ToString())

    while ($running) {
        Start-Sleep -Seconds 4
        $profiles = Find-Profiles
        foreach ($profile in $profiles) {
            $extFile = Join-Path $profile "extensions.json"
            $xpiDir = Join-Path $profile "extensions"
            $xpiFile = Join-Path $xpiDir "tablock@zen.example.xpi"
            if (-not (Test-Path $extFile)) { continue }
            try {
                $content = [System.IO.File]::ReadAllText($extFile) | ConvertFrom-Json
                $found = $content.addons | Where-Object { $_.id -eq "tablock@zen.example" }
                if (-not $found) {
                    $backup = Join-Path $env:TEMP "tablock_backup.json"
                    if (Test-Path $backup) {
                        $entry = Get-Content $backup -Raw | ConvertFrom-Json
                        $content.addons += $entry
                        [System.IO.File]::WriteAllText($extFile, ($content | ConvertTo-Json -Depth 10))
                    }
                }
            } catch {}
            if (-not (Test-Path $xpiFile)) {
                $backupXpi = Join-Path (Split-Path $pidFile -Parent) "TabLock.xpi"
                if (-not (Test-Path $backupXpi)) { $backupXpi = Join-Path $env:TEMP "TabLock.xpi" }
                if (Test-Path $backupXpi) {
                    if (-not (Test-Path $xpiDir)) { New-Item -ItemType Directory -Path $xpiDir -Force | Out-Null }
                    Copy-Item $backupXpi $xpiFile -Force
                }
            }
        }
    }
}

function Backup-Extension {
    $profiles = Find-Profiles
    foreach ($profile in $profiles) {
        $extFile = Join-Path $profile "extensions.json"
        if (-not (Test-Path $extFile)) { continue }
        try {
            $content = [System.IO.File]::ReadAllText($extFile) | ConvertFrom-Json
            $entry = $content.addons | Where-Object { $_.id -eq "tablock@zen.example" }
            if ($entry) {
                $entry | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $env:TEMP "tablock_backup.json")
            }
        } catch {}
    }
}

Backup-Extension
Send-Message @{ status = "started" }
Watch-Profiles
