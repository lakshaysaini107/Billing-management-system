# BillFlow - Automated Database Backup Script (PowerShell)
$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$SourceDb = Join-Path $ProjectRoot "data\rsa_billing.db"

# 1. Target Directory (Default: D:\bsm_backups, or set to your Google Drive / OneDrive folder)
$BackupDir = "D:\bsm_backups"

# If user prefers OneDrive or Google Drive, uncomment the line below:
# $BackupDir = Join-Path $env:USERPROFILE "OneDrive\BSM_Backups"
# $BackupDir = Join-Path $env:USERPROFILE "Google Drive\BSM_Backups"

if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

if (!(Test-Path $SourceDb)) {
    Write-Host "[ERROR] Source database $SourceDb not found!" -ForegroundColor Red
    exit 1
}

# 2. Timestamped target file name (e.g., rsa_billing_2026-11-22_1130.db)
$Timestamp = (Get-Date).ToString("yyyy-MM-dd_HHmm")
$TargetDb = Join-Path $BackupDir "rsa_billing_$Timestamp.db"

# 3. Perform Copy
Copy-Item -Path $SourceDb -Destination $TargetDb -Force
Write-Host "[SUCCESS] Database backup created at: $TargetDb" -ForegroundColor Green

# 4. Cleanup backups older than 30 days
$CutoffDate = (Get-Date).AddDays(-30)
$OldBackups = Get-ChildItem -Path $BackupDir -Filter "rsa_billing_*.db" | Where-Object { $_.LastWriteTime -lt $CutoffDate }

foreach ($old in $OldBackups) {
    Remove-Item -Path $old.FullName -Force
    Write-Host "[CLEANUP] Removed old backup: $($old.Name)" -ForegroundColor DarkGray
}

Write-Host "[DONE] All operations completed." -ForegroundColor Cyan
