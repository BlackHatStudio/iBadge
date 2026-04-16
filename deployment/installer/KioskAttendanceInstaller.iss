#ifndef StageDir
  #define StageDir "..\\staging\\package"
#endif
#ifndef OutputDir
  #define OutputDir "..\\output"
#endif
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

#define AppId "{{3E77565D-48D3-4A1B-8FA3-22D5C0F5B4EF}"
#define AppName "iBadge Attendance Kiosk"
#define AppPublisher "iBadge"
#define AppExeName "iBadge.ApiService.exe"

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\iBadge
DefaultGroupName=iBadge
DisableProgramGroupPage=yes
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
PrivilegesRequired=admin
OutputDir={#OutputDir}
OutputBaseFilename=KioskAttendanceInstaller-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UsePreviousAppDir=yes
UsePreviousLanguage=yes
SetupLogging=yes
UninstallDisplayIcon={app}\backend\service\{#AppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Dirs]
Name: "{commonappdata}\iBadge"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{commonappdata}\iBadge\config"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{commonappdata}\iBadge\logs"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{commonappdata}\iBadge\logs\api"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{commonappdata}\iBadge\logs\import"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{commonappdata}\iBadge\exports"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{commonappdata}\iBadge\exports\csv"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{commonappdata}\iBadge\exports\excel"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{commonappdata}\iBadge\exports\pdf"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{commonappdata}\iBadge\temp"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{commonappdata}\iBadge\backup\pre-upgrade"; Permissions: users-modify; Flags: uninsneveruninstall

[Files]
Source: "{#StageDir}\frontend\*"; DestDir: "{app}\frontend"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\sql\*"; DestDir: "{app}\sql"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\config\*"; DestDir: "{app}\config"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\deployment-manifest.json"; DestDir: "{app}"; Flags: ignoreversion

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\install-deployment.ps1"" -SettingsFile ""{code:GetSettingsFilePath}"" -InstallRoot ""{app}"" -ProgramDataRoot ""{commonappdata}\iBadge"""; Flags: runhidden waituntilterminated; StatusMsg: "Configuring IIS, database, service, and scheduled task..."

[Code]
var
  SqlPage: TInputQueryWizardPage;
  IisPage: TInputQueryWizardPage;
  SecurityPage: TInputQueryWizardPage;
  SettingsCreated: Boolean;

function JsonEscape(const Value: string): string;
begin
  Result := Value;
  StringChangeEx(Result, '\', '\\', True);
  StringChangeEx(Result, '"', '\"', True);
end;

function GetSettingsFilePath(Value: string): string;
begin
  Result := ExpandConstant('{commonappdata}\iBadge\config\deploy.settings.json');
end;

procedure InitializeWizard;
begin
  IisPage := CreateInputQueryPage(wpSelectDir,
    'IIS Configuration',
    'Enter the IIS site settings for this deployment.',
    'These values are written once on first install. Existing settings are preserved on upgrade.');
  IisPage.Add('IIS site name:', False);
  IisPage.Add('IIS app pool:', False);
  IisPage.Add('Binding protocol (http or https):', False);
  IisPage.Add('Binding port:', False);
  IisPage.Add('Host header:', False);
  IisPage.Add('API listen port:', False);
  IisPage.Values[0] := 'iBadge';
  IisPage.Values[1] := 'iBadgeStaticPool';
  IisPage.Values[2] := 'http';
  IisPage.Values[3] := '80';
  IisPage.Values[4] := 'attendance.local';
  IisPage.Values[5] := '4100';

  SqlPage := CreateInputQueryPage(IisPage.ID,
    'SQL Configuration',
    'Enter the kiosk and source database connection values.',
    'Full connection strings are stored in ProgramData so upgrades do not destroy them.');
  SqlPage.Add('SQL Server host:', False);
  SqlPage.Add('Kiosk database name:', False);
  SqlPage.Add('Admin connection string:', False);
  SqlPage.Add('App connection string:', False);
  SqlPage.Add('Access control source connection string:', False);
  SqlPage.Values[0] := 'SQLSERVER01';
  SqlPage.Values[1] := 'iBadgeKiosk';
  SqlPage.Values[2] := 'Server=SQLSERVER01;Database=master;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;';
  SqlPage.Values[3] := 'Server=SQLSERVER01;Database=iBadgeKiosk;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;';
  SqlPage.Values[4] := 'Server=SQLSERVER01;Database=AccessControl;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;';

  SecurityPage := CreateInputQueryPage(SqlPage.ID,
    'Application Security',
    'Enter the backend runtime secret values.',
    'Do not leave the placeholder defaults in production.');
  SecurityPage.Add('JWT secret:', False);
  SecurityPage.Add('Admin PIN hash:', False);
  SecurityPage.Values[0] := 'CHANGE-ME';
  SecurityPage.Values[1] := '__SET_ADMIN_PIN_HASH__';
end;

procedure SaveDeploySettings;
var
  SettingsPath: string;
  Json: string;
begin
  SettingsPath := GetSettingsFilePath('');
  if FileExists(SettingsPath) then
  begin
    Log('Preserving existing deploy.settings.json');
    Exit;
  end;

  ForceDirectories(ExtractFileDir(SettingsPath));

  Json := '{' + #13#10 +
    '  "application": {' + #13#10 +
    '    "name": "iBadge",' + #13#10 +
    '    "version": "{#AppVersion}"' + #13#10 +
    '  },' + #13#10 +
    '  "paths": {' + #13#10 +
    '    "installRoot": "' + JsonEscape(ExpandConstant('{app}')) + '",' + #13#10 +
    '    "programDataRoot": "' + JsonEscape(ExpandConstant('{commonappdata}\iBadge')) + '"' + #13#10 +
    '  },' + #13#10 +
    '  "frontend": {' + #13#10 +
    '    "referenceRefreshHours": 12,' + #13#10 +
    '    "queueRetryMinutes": 2,' + #13#10 +
    '    "duplicateWindowSeconds": 30' + #13#10 +
    '  },' + #13#10 +
    '  "iis": {' + #13#10 +
    '    "siteName": "' + JsonEscape(IisPage.Values[0]) + '",' + #13#10 +
    '    "appPoolName": "' + JsonEscape(IisPage.Values[1]) + '",' + #13#10 +
    '    "bindingProtocol": "' + JsonEscape(IisPage.Values[2]) + '",' + #13#10 +
    '    "bindingPort": ' + IisPage.Values[3] + ',' + #13#10 +
    '    "hostHeader": "' + JsonEscape(IisPage.Values[4]) + '"' + #13#10 +
    '  },' + #13#10 +
    '  "api": {' + #13#10 +
    '    "serviceName": "iBadgeApiService",' + #13#10 +
    '    "displayName": "iBadge API Service",' + #13#10 +
    '    "listenHost": "127.0.0.1",' + #13#10 +
    '    "listenPort": ' + IisPage.Values[5] + ',' + #13#10 +
    '    "publicBaseUrl": "' + JsonEscape(IisPage.Values[2] + '://' + IisPage.Values[4] + '/api') + '"' + #13#10 +
    '  },' + #13#10 +
    '  "database": {' + #13#10 +
    '    "installDatabase": true,' + #13#10 +
    '    "createDatabaseIfMissing": true,' + #13#10 +
    '    "server": "' + JsonEscape(SqlPage.Values[0]) + '",' + #13#10 +
    '    "databaseName": "' + JsonEscape(SqlPage.Values[1]) + '",' + #13#10 +
    '    "adminConnectionString": "' + JsonEscape(SqlPage.Values[2]) + '",' + #13#10 +
    '    "appConnectionString": "' + JsonEscape(SqlPage.Values[3]) + '",' + #13#10 +
    '    "sourceAccessControlConnectionString": "' + JsonEscape(SqlPage.Values[4]) + '"' + #13#10 +
    '  },' + #13#10 +
    '  "security": {' + #13#10 +
    '    "adminPinHash": "' + JsonEscape(SecurityPage.Values[1]) + '",' + #13#10 +
    '    "jwtSecret": "' + JsonEscape(SecurityPage.Values[0]) + '"' + #13#10 +
    '  },' + #13#10 +
    '  "imports": {' + #13#10 +
    '    "enabled": true,' + #13#10 +
    '    "taskName": "iBadge Employee Import",' + #13#10 +
    '    "intervalHours": 1' + #13#10 +
    '  }' + #13#10 +
    '}';

  SaveStringToFile(SettingsPath, Json, False);
  SettingsCreated := True;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if CurPageID = IisPage.ID then
  begin
    if (CompareText(IisPage.Values[2], 'http') <> 0) and (CompareText(IisPage.Values[2], 'https') <> 0) then
    begin
      MsgBox('Binding protocol must be http or https.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    SaveDeploySettings;
  end;
end;
