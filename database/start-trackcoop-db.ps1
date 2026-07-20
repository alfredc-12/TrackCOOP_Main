$ErrorActionPreference = "Stop"

$mysqlServer = "C:\xampp\mysql\bin\mysqld.exe"
$mysqlClient = "C:\xampp\mysql\bin\mysql.exe"
$config = "C:\CAPSTONE\mysql-trackcoop-data\my.ini"

$isRunning = $false
try {
  & $mysqlClient --protocol=TCP -h 127.0.0.1 -P 3307 -u root -e "SELECT 1;" *> $null
  $isRunning = $LASTEXITCODE -eq 0
} catch {
  $isRunning = $false
}

if ($isRunning) {
  Write-Host "TrackCOOP database is already running on port 3307."
  exit 0
}

Start-Process `
  -FilePath $mysqlServer `
  -ArgumentList "--defaults-file=$config", "--standalone" `
  -WorkingDirectory "C:\CAPSTONE" `
  -WindowStyle Hidden

Start-Sleep -Seconds 2
& $mysqlClient --protocol=TCP -h 127.0.0.1 -P 3307 -u root -e "SELECT 'TrackCOOP database is ready on port 3307' AS status;"
