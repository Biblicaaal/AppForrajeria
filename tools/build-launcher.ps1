param()

$ErrorActionPreference = "Stop"
$AppDir = Split-Path -Parent $PSScriptRoot
$Source = Join-Path $PSScriptRoot "LaViejaEsquinaLauncher.cs"
$Output = Join-Path $AppDir "LaViejaEsquina.exe"
$Compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"

if (-not (Test-Path -LiteralPath $Compiler)) { throw "No se encontro el compilador de Windows: $Compiler" }
& $Compiler /nologo /target:winexe /platform:anycpu /optimize+ /reference:System.Windows.Forms.dll "/out:$Output" $Source
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Output)) { throw "No se pudo crear LaViejaEsquina.exe" }
Write-Host "Ejecutable creado: $Output"
