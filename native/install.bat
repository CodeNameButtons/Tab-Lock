@echo off
setlocal enabledelayedexpansion
echo Tab Lock - Native Helper Installer (Windows)
echo ==============================================
echo.
echo This installs a background helper that prevents
echo Tab Lock from being removed from Firefox.
echo.

set HELPER_DIR=%LOCALAPPDATA%\TabLock\Helper
if not exist "%HELPER_DIR%" mkdir "%HELPER_DIR%"

copy "%~dp0tablock-helper.bat" "%HELPER_DIR%\" >nul
copy "%~dp0tablock-helper.ps1" "%HELPER_DIR%\" >nul
copy "%~dp0..\TabLock.xpi" "%HELPER_DIR%\" >nul

set MANIFEST_PATH=%HELPER_DIR%\tablock@zen.example.json
copy "%~dp0tablock@zen.example.json" "%MANIFEST_PATH%" >nul
REM Update path in manifest to absolute
powershell -Command "$m = Get-Content '%MANIFEST_PATH%' | ConvertFrom-Json; $m.path = '%HELPER_DIR%\\tablock-helper.bat'; $m | ConvertTo-Json | Set-Content '%MANIFEST_PATH%'"

REM Register in registry
reg add "HKCU\Software\Mozilla\NativeMessagingHosts\tablock_helper" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1
reg add "HKCU\Software\Waterfox\NativeMessagingHosts\tablock_helper" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1

echo.
echo [OK] Helper installed at %HELPER_DIR%
echo.
echo Restart your browser for changes to take effect.
pause
