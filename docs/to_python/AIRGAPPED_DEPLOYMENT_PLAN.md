# AIRGAPPED_DEPLOYMENT_PLAN.md
# iBadge Python — Air-Gapped Deployment Plan

> Generated: 2026-06-19

---

## 1. Overview

The Python application must be installable and runnable on a Windows Server machine with **no internet access**. All dependencies — Python packages, ODBC drivers, and static assets — must be bundled in the deployment package created on an internet-connected build machine.

---

## 2. Requirements

### Software Requirements (Build Machine, must have internet)

- Python 3.11.x or 3.12.x (must match target server version exactly)
- `pip` ≥ 23.0
- PowerShell 5.1+
- Git (for tagging and packaging)

### Software Requirements (Target Air-Gapped Server)

- Windows Server 2019 or 2022
- Python 3.11.x or 3.12.x (same minor version as build machine)
- ODBC Driver 17 or 18 for SQL Server (install via MSI — include in package)
- NSSM (Non-Sucking Service Manager) or WinSW for Windows service registration
- IIS (optional — for reverse proxy and SSL termination)
- .NET 4.8+ (for WinSW if used)
- SQL Server instance accessible from the server

---

## 3. Directory Layout (Target Machine)

```
C:\ibadge-python\
├── app\                         # Flask application
├── config\
│   └── appsettings.prod.ini     # Production configuration (NOT in git)
├── deploy\                      # PowerShell scripts
├── wheelhouse\                  # Pre-downloaded Python packages
├── venv\                        # Virtual environment (created during install)
├── logs\                        # Application logs (created during install)
├── exports\                     # CSV/PDF exports (created during install)
├── run.py                       # WSGI entry point
├── requirements.txt
├── requirements.lock.txt
└── README.md
```

---

## 4. Build Package Creation (Internet-Connected Machine)

Run `deploy/create_offline_package.ps1`:

```powershell
# Step 1: Download all packages to wheelhouse
python -m pip download -r requirements.txt -d wheelhouse\

# Step 2: Verify checksums (recommended)
Get-ChildItem wheelhouse\ | ForEach-Object {
    $hash = Get-FileHash $_.FullName -Algorithm SHA256
    "$($hash.Hash)  $($_.Name)" >> wheelhouse\SHA256SUMS.txt
}

# Step 3: Bundle everything
Compress-Archive -Path . -DestinationPath "ibadge-python-{VERSION}.zip" `
    -CompressionLevel Optimal `
    -Exclude ".git","venv","logs","exports","__pycache__","*.pyc"
```

### Package Contents

```
ibadge-python-{VERSION}.zip
├── app\
├── config\
│   └── appsettings.example.ini  # Copy and fill in before install
├── deploy\
│   ├── install_service.ps1
│   ├── uninstall_service.ps1
│   ├── start_service.ps1
│   ├── stop_service.ps1
│   ├── verify_install.ps1
│   └── create_offline_package.ps1
├── wheelhouse\
│   ├── Flask-3.x.x-py3-none-any.whl
│   ├── pyodbc-5.x.x-cp311-win_amd64.whl
│   ├── ... (all dependencies)
│   └── SHA256SUMS.txt
├── requirements.txt
├── requirements.lock.txt
├── run.py
└── README.md
```

---

## 5. Installation Steps (Air-Gapped Target Server)

### Pre-Installation Checklist

- [ ] Python 3.11.x (or 3.12.x) installed on target server
- [ ] ODBC Driver 17 or 18 for SQL Server installed (`msodbcsql17.msi` or `msodbcsql18.msi`)
- [ ] NSSM downloaded and available at `C:\tools\nssm.exe`
- [ ] SQL Server instance reachable (test: `ping <sql_server_host>`)
- [ ] SQL Server login created with least-privilege (SELECT/INSERT/UPDATE on required tables)
- [ ] `ibadge` database exists with required schema deployed

### Step 1 — Extract Package

```powershell
# Run as Administrator
$TargetDir = "C:\ibadge-python"
New-Item -ItemType Directory -Path $TargetDir -Force
Expand-Archive -Path "ibadge-python-{VERSION}.zip" -DestinationPath $TargetDir
```

### Step 2 — Verify Package Integrity (Optional but Recommended)

```powershell
Set-Location "$TargetDir\wheelhouse"
$lines = Get-Content SHA256SUMS.txt
foreach ($line in $lines) {
    $parts = $line -split '  ', 2
    $hash = $parts[0]; $file = $parts[1]
    $actual = (Get-FileHash $file -Algorithm SHA256).Hash
    if ($actual -ne $hash) {
        Write-Error "CHECKSUM MISMATCH: $file"
    }
}
Write-Host "All checksums verified."
```

### Step 3 — Create Virtual Environment

```powershell
Set-Location "C:\ibadge-python"
python -m venv venv
```

### Step 4 — Install Dependencies from Wheelhouse

```powershell
# IMPORTANT: --no-index ensures no internet access
.\venv\Scripts\pip install --no-index --find-links=wheelhouse -r requirements.txt
```

### Step 5 — Create Required Directories

```powershell
New-Item -ItemType Directory -Path "C:\ibadge-python\logs" -Force
New-Item -ItemType Directory -Path "C:\ibadge-python\exports" -Force
```

### Step 6 — Configure the Application

```powershell
Copy-Item "config\appsettings.example.ini" "config\appsettings.prod.ini"
notepad "config\appsettings.prod.ini"
```

Fill in:
```ini
[database]
host = YOUR_SQL_SERVER_HOST
name = ibadge
user = ibadge_app
password = YOUR_SQL_PASSWORD

[server]
port = 5000
secret_key = GENERATE_A_STRONG_RANDOM_KEY

[admin]
session_ttl_hours = 8

[kiosk]
duplicate_suppress_seconds = 30
reference_refresh_hours = 12
```

Set environment variable to point to config:
```powershell
[System.Environment]::SetEnvironmentVariable("IBADGE_ENV", "prod", "Machine")
[System.Environment]::SetEnvironmentVariable("IBADGE_CONFIG", "C:\ibadge-python\config\appsettings.prod.ini", "Machine")
```

### Step 7 — Test SQL Server Connectivity

```powershell
.\venv\Scripts\python -c "
import pyodbc
conn = pyodbc.connect(
    'DRIVER={ODBC Driver 18 for SQL Server};'
    'SERVER=YOUR_SQL_SERVER;DATABASE=ibadge;UID=ibadge_app;PWD=YOUR_PASSWORD;'
    'Encrypt=yes;TrustServerCertificate=yes;'
)
cursor = conn.cursor()
cursor.execute('SELECT TOP 1 EventID FROM dbo.Event')
print('Connection OK:', cursor.fetchone())
conn.close()
"
```

### Step 8 — Test Application Start

```powershell
Set-Location "C:\ibadge-python"
$env:IBADGE_CONFIG = "C:\ibadge-python\config\appsettings.prod.ini"
.\venv\Scripts\python run.py
# Should output: * Serving on http://0.0.0.0:5000
# Test: curl http://localhost:5000/health
# CTRL+C to stop
```

### Step 9 — Install as Windows Service

```powershell
# Using NSSM:
C:\tools\nssm.exe install ibadge-python `
    "C:\ibadge-python\venv\Scripts\python.exe" `
    "C:\ibadge-python\run.py"

C:\tools\nssm.exe set ibadge-python AppDirectory "C:\ibadge-python"
C:\tools\nssm.exe set ibadge-python AppEnvironmentExtra "IBADGE_CONFIG=C:\ibadge-python\config\appsettings.prod.ini"
C:\tools\nssm.exe set ibadge-python AppStdout "C:\ibadge-python\logs\service-stdout.log"
C:\tools\nssm.exe set ibadge-python AppStderr "C:\ibadge-python\logs\service-stderr.log"
C:\tools\nssm.exe set ibadge-python Start SERVICE_AUTO_START
C:\tools\nssm.exe set ibadge-python ObjectName LocalSystem

# Start the service
C:\tools\nssm.exe start ibadge-python
```

### Step 10 — Configure IIS Reverse Proxy (Optional)

Create an IIS site pointing to a `web.config`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ibadge proxy" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:5000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

---

## 6. Verification Commands

```powershell
# Check service is running
Get-Service ibadge-python

# Test health endpoint
Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing

# Check application log
Get-Content "C:\ibadge-python\logs\app.log" -Tail 50

# Check audit log
Get-Content "C:\ibadge-python\logs\audit.log" -Tail 20

# Smoke test: kiosk page loads
Invoke-WebRequest -Uri "http://localhost:5000/" -UseBasicParsing | Select-Object StatusCode

# Smoke test: admin access page loads
Invoke-WebRequest -Uri "http://localhost:5000/admin/access" -UseBasicParsing | Select-Object StatusCode

# Smoke test: API health
Invoke-WebRequest -Uri "http://localhost:5000/api/events" -UseBasicParsing | Select-Object StatusCode
```

---

## 7. Backup Steps (Pre-Upgrade)

```powershell
# 1. Stop service
C:\tools\nssm.exe stop ibadge-python

# 2. Back up current application
$BackupPath = "C:\ibadge-python-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -Path "C:\ibadge-python" -Destination $BackupPath -Recurse

# 3. Back up database (run from SQL Server host or with sqlcmd)
# NEEDS VALIDATION: Confirm backup procedure with DBA
# sqlcmd -S <server> -Q "BACKUP DATABASE ibadge TO DISK='D:\backups\ibadge.bak'"

Write-Host "Backup complete: $BackupPath"
```

---

## 8. Rollback Steps

```powershell
# 1. Stop current service
C:\tools\nssm.exe stop ibadge-python

# 2. Remove current installation
Remove-Item -Path "C:\ibadge-python" -Recurse -Force

# 3. Restore backup
Copy-Item -Path $BackupPath -Destination "C:\ibadge-python" -Recurse

# 4. Start service
C:\tools\nssm.exe start ibadge-python

# 5. Verify
Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing
```

---

## 9. Upgrade Procedure

```powershell
# 1. Backup (see section 7)
# 2. Stop service
C:\tools\nssm.exe stop ibadge-python

# 3. Extract new version (preserve config and logs)
Expand-Archive -Path "ibadge-python-{NEW_VERSION}.zip" -DestinationPath "C:\ibadge-python-new"
Copy-Item "C:\ibadge-python\config\appsettings.prod.ini" "C:\ibadge-python-new\config\"
Move-Item "C:\ibadge-python" "C:\ibadge-python-old-$(Get-Date -Format 'yyyyMMdd')"
Move-Item "C:\ibadge-python-new" "C:\ibadge-python"

# 4. Re-install packages (in case of new deps)
.\venv\Scripts\pip install --no-index --find-links=wheelhouse -r requirements.txt

# 5. Start service
C:\tools\nssm.exe start ibadge-python

# 6. Verify
.\deploy\verify_install.ps1
```

---

## 10. Service Uninstall

```powershell
C:\tools\nssm.exe stop ibadge-python
C:\tools\nssm.exe remove ibadge-python confirm
```

---

## 11. Troubleshooting

| Symptom | Check |
|---|---|
| Service won't start | Check `C:\ibadge-python\logs\service-stderr.log` |
| Database connection error | Verify ODBC driver installed; test connection string manually |
| 500 errors | Check `C:\ibadge-python\logs\error.log` |
| PIN verify fails | Check `dbo.AdminConfig` has a row; verify bcrypt hash |
| Kiosk page blank | Check browser console for JS errors; verify static assets served |
| QR check-in fails | Verify `ATTENDEE_QR_BASE_URL` config matches app URL |
| Exports empty | Check `dbo.BadgeScan` has records; verify filter params |
| Slow employee cache | Check index on `dbo.Employee.IsActive`; check employee count |

---

## 12. Python Version Pinning

```
requirements.txt example:
Flask==3.1.0
Waitress==3.0.1
pyodbc==5.2.0
bcrypt==4.2.1
passlib==1.7.4
Flask-WTF==1.2.2
reportlab==4.2.5
pytest==8.3.5
```

Pin exact versions in `requirements.lock.txt`. Generate with:
```
pip freeze > requirements.lock.txt
```

---

## 13. ODBC Driver Offline Installation

Include in the deployment package:
- `msodbcsql18.msi` (Microsoft ODBC Driver 18 for SQL Server)
- Or `msodbcsql17.msi` (version 17, if server uses older SQL Server)

Install silently:
```powershell
msiexec /i msodbcsql18.msi /quiet IACCEPTMSODBCSQLLICENSETERMS=YES
```

Verify:
```powershell
Get-OdbcDriver | Where-Object { $_.Name -like "*SQL Server*" }
```
