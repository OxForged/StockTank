# Save a timestamped backup of your database.
# Run any time, or let Windows Task Scheduler run it daily.
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$dir = "$PSScriptRoot\..\backups"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$out = "$dir\metarealm_os_$stamp.sql"
docker exec docker-db-1 pg_dump -U metarealm metarealm_os | Out-File -Encoding utf8 $out
Write-Host "Backup saved to $out"
# Keep only the last 14 backups.
Get-ChildItem $dir -Filter *.sql | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force
