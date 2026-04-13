#ifndef StageDir
  #define StageDir "..\\staging\\webapp-package"
#endif
#ifndef OutputDir
  #define OutputDir "..\\output"
#endif
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

#define AppId "{{F2EE0F2A-64E7-4A38-A7AC-E779FCB676E9}"
#define AppName "iBadge Attendance Kiosk"
#define AppPublisher "iBadge"
#define AppExeName "iBadge.WebApp.exe"

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
OutputBaseFilename=iBadgeWebAppInstaller-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UsePreviousAppDir=yes
UsePreviousLanguage=yes
SetupLogging=yes
UninstallDisplayIcon={app}\app\service\{#AppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Dirs]
Name: "{commonappdata}\iBadge"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{commonappdata}\iBadge\config"; Permissions: users-modify; Flags: uninsneveruninstall

[Files]
Source: "{#StageDir}\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\config\*"; DestDir: "{app}\config"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\deployment-manifest.json"; DestDir: "{app}"; Flags: ignoreversion

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\install-web-package.ps1"" -SettingsFile ""{code:GetSettingsFilePath}"" -PackageRoot ""{app}"""; Flags: runhidden waituntilterminated; StatusMsg: "Updating the iBadge web service..."

[Code]
var
  AppPage: TInputQueryWizardPage;
  SqlPage: TInputQueryWizardPage;

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
  AppPage := CreateInputQueryPage(wpSelectDir,
    'Application Settings',
    'Enter the local service settings for the packaged web application.',
    'Existing IIS bindings and DNS are left alone by this update package.');
  AppPage.Add('Local app port:', False);
  AppPage.Add('API base URL:', False);
  AppPage.Values[0] := '4300';
  AppPage.Values[1] := '/api';

  SqlPage := CreateInputQueryPage(AppPage.ID,
    'Database Settings',
    'Enter the SQL Server connection values used by the packaged app.',
    'These values are written to app\server\.env on install.');
  SqlPage.Add('SQL Server host:', False);
  SqlPage.Add('Database name:', False);
  SqlPage.Add('SQL username:', False);
  SqlPage.Add('SQL password:', True);
  SqlPage.Values[0] := 'localhost';
  SqlPage.Values[1] := 'ibadge';
  SqlPage.Values[2] := 'ibadge';
  SqlPage.Values[3] := 'BadgeThis';
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
    '  "app": {' + #13#10 +
    '    "serviceName": "iBadgeWebApp",' + #13#10 +
    '    "displayName": "iBadge Web App Service",' + #13#10 +
    '    "listenPort": ' + AppPage.Values[0] + '' + #13#10 +
    '  },' + #13#10 +
    '  "runtime": {' + #13#10 +
    '    "apiBaseUrl": "' + JsonEscape(AppPage.Values[1]) + '",' + #13#10 +
    '    "referenceRefreshHours": 12,' + #13#10 +
    '    "queueRetryMinutes": 2,' + #13#10 +
    '    "duplicateWindowSeconds": 30' + #13#10 +
    '  },' + #13#10 +
    '  "database": {' + #13#10 +
    '    "server": "' + JsonEscape(SqlPage.Values[0]) + '",' + #13#10 +
    '    "databaseName": "' + JsonEscape(SqlPage.Values[1]) + '",' + #13#10 +
    '    "username": "' + JsonEscape(SqlPage.Values[2]) + '",' + #13#10 +
    '    "password": "' + JsonEscape(SqlPage.Values[3]) + '"' + #13#10 +
    '  }' + #13#10 +
    '}';

  SaveStringToFile(SettingsPath, Json, False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    SaveDeploySettings;
  end;
end;
