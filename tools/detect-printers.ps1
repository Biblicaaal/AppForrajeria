$ErrorActionPreference = "SilentlyContinue"

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "printers.json"
$printers = @()

try {
  $defaultPrinter = Get-WmiObject Win32_Printer | Where-Object { $_.Default } | Select-Object -First 1
  $printers = Get-WmiObject Win32_Printer |
    Sort-Object Name |
    ForEach-Object {
      [pscustomobject]@{
        name = $_.Name
        default = [bool]($_.Name -eq $defaultPrinter.Name)
      }
    }
} catch {
  $printers = @()
}

if (-not $printers) {
  $printers = @()
}

@{
  generatedAt = (Get-Date).ToString("s")
  printers = @($printers)
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $out -Encoding UTF8

$jsOut = Join-Path $root "printers.js"
$payload = (@{
  generatedAt = (Get-Date).ToString("s")
  printers = @($printers)
} | ConvertTo-Json -Depth 4 -Compress)

$js = "window.FORRAJERIA_PRINTERS_DATA = $payload; window.FORRAJERIA_PRINTERS = window.FORRAJERIA_PRINTERS_DATA.printers || [];"
Set-Content -LiteralPath $jsOut -Value $js -Encoding UTF8
