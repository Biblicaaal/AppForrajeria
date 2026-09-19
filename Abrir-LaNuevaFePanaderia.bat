@echo off
setlocal
cd /d "%~dp0"

set "APP_PROFILE=%CD%\_perfil_panaderia"
set "APP_DATA=%CD%\_data_panaderia"
set "APP_TOKEN_FILE=%APP_DATA%\local-token.txt"

if not exist "%APP_PROFILE%" mkdir "%APP_PROFILE%"
if not exist "%APP_DATA%" mkdir "%APP_DATA%"
if not exist "%APP_TOKEN_FILE%" powershell -NoProfile -WindowStyle Hidden -Command "[IO.File]::WriteAllText('%APP_TOKEN_FILE%', [guid]::NewGuid().ToString('N'), [Text.UTF8Encoding]::new($false))"
set /p APP_TOKEN=<"%APP_TOKEN_FILE%"
set "APP_URL=file:///%CD:\=/%/index.html?localToken=%APP_TOKEN%"

if exist "%CD%\tools\update-app.ps1" (
  rem Bakery pilot updates are manual until the separate release is verified.
)

if exist "%CD%\tools\detect-printers.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\tools\detect-printers.ps1"
)

if exist "%CD%\tools\local-data-server.ps1" (
  powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "$pidFile=Join-Path '%APP_DATA%' 'local-server.pid'; if(Test-Path -LiteralPath $pidFile){$oldPid=[int](Get-Content -LiteralPath $pidFile -Raw); $process=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $oldPid) -ErrorAction SilentlyContinue; if($process -and $process.CommandLine -like '*local-data-server.ps1*'){Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue}}"
  start "" /b powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%CD%\tools\local-data-server.ps1" -Port 4274 -Quiet
  powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 600"
)

if exist "%CD%\Browser\chrome.exe" (
  start "" "%CD%\Browser\chrome.exe" --app="%APP_URL%" --user-data-dir="%APP_PROFILE%" --disable-extensions --disable-background-networking --disable-sync --kiosk-printing
  exit /b
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%APP_URL%" --user-data-dir="%APP_PROFILE%" --disable-extensions --disable-background-networking --disable-sync --kiosk-printing
  exit /b
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="%APP_URL%" --user-data-dir="%APP_PROFILE%" --disable-extensions --disable-background-networking --disable-sync --kiosk-printing
  exit /b
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%APP_URL%" --user-data-dir="%APP_PROFILE%" --disable-extensions --disable-background-networking --disable-sync --kiosk-printing
  exit /b
)

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%APP_URL%" --user-data-dir="%APP_PROFILE%" --disable-extensions --disable-background-networking --disable-sync --kiosk-printing
  exit /b
)

echo No se encontro Chrome ni Edge.
echo.
echo La aplicacion necesita uno de esos navegadores para mantener siempre la misma
echo base de datos. Instale Chrome o Edge y vuelva a abrir LaNuevaFePanaderia.exe.
echo.
pause
exit /b 1
