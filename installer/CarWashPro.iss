; CAR WASH PRO — Windows installer script (Inno Setup 6, free: https://jrsoftware.org/isdl.php)
; 1) Extract "CAR WASH PRO-win32-x64" next to this file.  2) Open this file in Inno Setup.  3) Build > Compile.
; Output: Output\CarWashPro-Setup-1.0.0.exe
[Setup]
AppName=CAR WASH PRO
AppVersion=1.0.0
AppPublisher=CAR WASH PRO
DefaultDirName={autopf}\CarWashPro
DefaultGroupName=CAR WASH PRO
OutputBaseFilename=CarWashPro-Setup-1.0.0
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
PrivilegesRequired=admin
UninstallDisplayName=CAR WASH PRO

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "CAR WASH PRO-win32-x64\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\CAR WASH PRO"; Filename: "{app}\CAR WASH PRO.exe"
Name: "{group}\{cm:UninstallProgram,CAR WASH PRO}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\CAR WASH PRO"; Filename: "{app}\CAR WASH PRO.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\CAR WASH PRO.exe"; Description: "{cm:LaunchProgram,CAR WASH PRO}"; Flags: nowait postinstall skipifsilent
