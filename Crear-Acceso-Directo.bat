@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$desk=[Environment]::GetFolderPath('Desktop'); $ws=New-Object -ComObject WScript.Shell; $sc=$ws.CreateShortcut((Join-Path $desk 'La Vieja Esquina.lnk')); $exe=Join-Path (Get-Location) 'LaViejaEsquina.exe'; $sc.TargetPath=$exe; $sc.WorkingDirectory=(Get-Location).Path; $sc.IconLocation=$exe; $sc.Description='Caja e inventario La Vieja Esquina'; $sc.Save()"

echo Acceso directo creado en el escritorio.
pause
