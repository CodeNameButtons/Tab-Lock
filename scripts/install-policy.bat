@echo off
REM Tab Lock - Enterprise Policy Installer (Windows)
REM Run as Administrator to lock the extension from removal.
REM Usage: Right-click -> "Run as administrator"

setlocal enabledelayedexpansion

echo Tab Lock - Policy Installer
echo ============================
echo.
echo This will lock Tab Lock so it cannot be removed from about:addons
echo without deleting the policy file (requires admin access).
echo.

set FOUND=

REM Check common Firefox/Zen Browser installation paths
for %%P in (
  "%PROGRAMFILES%\Mozilla Firefox"
  "%PROGRAMFILES%\Firefox Developer Edition"
  "%PROGRAMFILES%\Zen Browser"
  "%PROGRAMFILES%\Mozilla Thunderbird"
  "%LOCALAPPDATA%\Mozilla Firefox"
  "%LOCALAPPDATA%\Zen Browser"
) do (
  if exist "%%~P\" (
    if not exist "%%~P\distribution\*" mkdir "%%~P\distribution"
    copy /Y "%~dp0..\deploy\policies.json" "%%~P\distribution\policies.json" >nul
    if exist "%%~P\distribution\policies.json" (
      echo [OK] Installed policy at: %%~P\distribution\policies.json
      set FOUND=1
    )
  )
)

if not defined FOUND (
  echo [!!] Could not find Firefox or Zen Browser installation.
  echo.
  echo Manual install:
  echo   1. Find your browser install folder (e.g. C:\Program Files\Zen Browser)
  echo   2. Create a "distribution" folder inside it
  echo   3. Copy deploy\policies.json into it
  echo   4. Restart the browser
)

echo.
echo Done. Restart your browser for the policy to take effect.
pause
