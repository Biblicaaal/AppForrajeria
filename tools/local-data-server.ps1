param(
  [int]$Port = 4174,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $AppDir "_data"
$SnapshotPath = Join-Path $DataDir "app-data.json"
$PreviousSnapshotPath = Join-Path $DataDir "app-data.previous.json"
$ArchiveDir = Join-Path $DataDir "archives"
$InvoiceDir = Join-Path $DataDir "invoices"
$ReportDir = Join-Path $DataDir "reports"
$TokenPath = Join-Path $DataDir "local-token.txt"
$PidPath = Join-Path $DataDir "local-server.pid"
$SnapshotStores = @("users", "sessions", "transactions", "closures", "monthlyEntries", "productionItems", "products", "baskets", "basketItems", "settings", "auditLog")
$OptionalSnapshotStores = @("masterProducts", "suppliers", "purchases", "purchaseLines", "inventoryMovements", "purchaseCostHistory", "priceReviews", "priceHistory", "mlCandidates", "mlResearch", "mlListings", "mlSyncEvents", "weatherDaily", "stockCountMissions", "stockCountResults", "stockCountCampaigns")
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
New-Item -ItemType Directory -Path $ArchiveDir -Force | Out-Null
New-Item -ItemType Directory -Path $InvoiceDir -Force | Out-Null
New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null
if (-not (Test-Path -LiteralPath $TokenPath)) {
  [System.IO.File]::WriteAllText($TokenPath, [guid]::NewGuid().ToString("N"), [System.Text.UTF8Encoding]::new($false))
}
$LocalToken = ([System.IO.File]::ReadAllText($TokenPath)).Trim()
[System.IO.File]::WriteAllText($PidPath, [string]$PID, [System.Text.UTF8Encoding]::new($false))

function Test-AllowedOrigin {
  param([string]$Origin)
  if (-not $Origin) { return $true }
  if ($Origin -eq "null") { return $true }
  try {
    $uri = [uri]$Origin
    return $uri.Scheme -eq "http" -and ($uri.Host -eq "127.0.0.1" -or $uri.Host -eq "localhost")
  } catch {
    return $false
  }
}

function Write-HttpResponse {
  param(
    [System.IO.Stream]$Stream,
    [int]$StatusCode,
    [string]$ContentType,
    [string]$Body,
    [string]$Origin = ""
  )
  $statusText = switch ($StatusCode) {
    200 { "OK" }
    204 { "No Content" }
    400 { "Bad Request" }
    401 { "Unauthorized" }
    403 { "Forbidden" }
    404 { "Not Found" }
    405 { "Method Not Allowed" }
    413 { "Payload Too Large" }
    500 { "Internal Server Error" }
    502 { "Bad Gateway" }
    503 { "Service Unavailable" }
    default { "Error" }
  }
  $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes([string]$Body)
  $headers = "HTTP/1.1 $StatusCode $statusText`r`nContent-Type: $ContentType`r`nContent-Length: $($bodyBytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`nX-Content-Type-Options: nosniff`r`n"
  if ($Origin -and (Test-AllowedOrigin -Origin $Origin)) {
    $headers += "Access-Control-Allow-Origin: $Origin`r`nVary: Origin`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type, X-App-Token`r`n"
  }
  $headers += "`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($bodyBytes.Length) { $Stream.Write($bodyBytes, 0, $bodyBytes.Length) }
  $Stream.Flush()
}

function Write-JsonResponse {
  param(
    [System.IO.Stream]$Stream,
    [int]$StatusCode,
    [object]$Value,
    [string]$Origin = ""
  )
  $json = $Value | ConvertTo-Json -Depth 12 -Compress
  Write-HttpResponse -Stream $Stream -StatusCode $StatusCode -ContentType "application/json; charset=utf-8" -Body $json -Origin $Origin
}

function Read-HttpRequest {
  param([System.IO.Stream]$Stream)
  $buffer = New-Object byte[] 4096
  $memory = New-Object System.IO.MemoryStream
  $headerEnd = -1
  while ($headerEnd -lt 0) {
    $read = $Stream.Read($buffer, 0, $buffer.Length)
    if ($read -le 0) { throw "Conexion cerrada antes de recibir cabeceras" }
    $memory.Write($buffer, 0, $read)
    if ($memory.Length -gt 65536) { throw "Cabeceras demasiado grandes" }
    $rawText = [System.Text.Encoding]::ASCII.GetString($memory.ToArray())
    $headerEnd = $rawText.IndexOf("`r`n`r`n")
  }

  $headerLength = $headerEnd + 4
  $allBytes = $memory.ToArray()
  $headerText = [System.Text.Encoding]::ASCII.GetString($allBytes, 0, $headerEnd)
  $lines = $headerText -split "`r`n"
  $requestParts = $lines[0].Split(" ")
  if ($requestParts.Length -lt 2) { throw "Solicitud HTTP invalida" }
  $headers = @{}
  for ($index = 1; $index -lt $lines.Length; $index++) {
    $separator = $lines[$index].IndexOf(":")
    if ($separator -gt 0) {
      $headers[$lines[$index].Substring(0, $separator).Trim()] = $lines[$index].Substring($separator + 1).Trim()
    }
  }
  $contentLength = 0
  if ($headers.ContainsKey("Content-Length")) { $contentLength = [int]$headers["Content-Length"] }
  $requestTarget = [string]$requestParts[1]
  $maxBodyLength = if ($requestTarget.StartsWith("/api/data-snapshot", [System.StringComparison]::OrdinalIgnoreCase)) { 64MB } elseif ($requestTarget.StartsWith("/api/ml/images/", [System.StringComparison]::OrdinalIgnoreCase)) { 8MB } elseif ($requestTarget.StartsWith("/api/ml/publish", [System.StringComparison]::OrdinalIgnoreCase)) { 1MB } elseif ($requestTarget.StartsWith("/api/invoice-attachment/", [System.StringComparison]::OrdinalIgnoreCase)) { 3MB } elseif ($requestTarget.StartsWith("/api/monthly-report", [System.StringComparison]::OrdinalIgnoreCase)) { 8MB } else { 70000 }
  if ($contentLength -gt $maxBodyLength) { throw "Cuerpo demasiado grande" }
  $expectedLength = $headerLength + $contentLength
  while ($memory.Length -lt $expectedLength) {
    $read = $Stream.Read($buffer, 0, [Math]::Min($buffer.Length, $expectedLength - $memory.Length))
    if ($read -le 0) { throw "Conexion cerrada antes de recibir el cuerpo" }
    $memory.Write($buffer, 0, $read)
  }
  $allBytes = $memory.ToArray()
  $body = if ($contentLength -gt 0) { [System.Text.Encoding]::UTF8.GetString($allBytes, $headerLength, $contentLength) } else { "" }
  return @{
    Method = $requestParts[0].ToUpperInvariant()
    Target = $requestParts[1]
    Headers = $headers
    Body = $body
  }
}

function Test-SnapshotToken {
  param([hashtable]$Headers)
  if (-not $LocalToken -or -not $Headers.ContainsKey("X-App-Token")) { return $false }
  return [string]$Headers["X-App-Token"] -eq $LocalToken
}

function ConvertTo-ValidatedSnapshot {
  param([string]$Body)
  try { $payload = $Body | ConvertFrom-Json } catch { throw "JSON de respaldo invalido" }
  if ([string]$payload.format -ne "AppCajaPanaSnapshot" -or [int]$payload.schemaVersion -ne 1) { throw "Formato de respaldo no reconocido" }
  if ($null -eq $payload.stores) { throw "El respaldo no contiene almacenes" }
  foreach ($store in $SnapshotStores) {
    $property = $payload.stores.PSObject.Properties[$store]
    if ($null -eq $property) { throw "Falta el almacen $store" }
    foreach ($record in @($property.Value)) {
      if ($null -eq $record -or -not [string]$record.id) { throw "Registro sin identificador en $store" }
    }
  }
  foreach ($store in $OptionalSnapshotStores) {
    $property = $payload.stores.PSObject.Properties[$store]
    if ($null -eq $property) { continue }
    foreach ($record in @($property.Value)) {
      if ($null -eq $record -or -not [string]$record.id) { throw "Registro sin identificador en $store" }
    }
  }
  return $payload
}

function Save-SnapshotBody {
  param(
    [string]$Body,
    [switch]$ArchiveOnly
  )
  $null = ConvertTo-ValidatedSnapshot -Body $Body
  $utf8 = [System.Text.UTF8Encoding]::new($false)
  if ($ArchiveOnly) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
    $archivePath = Join-Path $ArchiveDir "app-data-$stamp.json"
    [System.IO.File]::WriteAllText($archivePath, $Body, $utf8)
    return Split-Path -Leaf $archivePath
  }

  $tempPath = Join-Path $DataDir ("app-data.tmp-" + [guid]::NewGuid().ToString("N") + ".json")
  [System.IO.File]::WriteAllText($tempPath, $Body, $utf8)
  try {
    if (Test-Path -LiteralPath $SnapshotPath) {
      try {
        [System.IO.File]::Replace($tempPath, $SnapshotPath, $PreviousSnapshotPath, $true)
      } catch {
        Copy-Item -LiteralPath $SnapshotPath -Destination $PreviousSnapshotPath -Force
        Move-Item -LiteralPath $tempPath -Destination $SnapshotPath -Force
      }
    } else {
      Move-Item -LiteralPath $tempPath -Destination $SnapshotPath -Force
    }
  } finally {
    if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force }
  }
  return Split-Path -Leaf $SnapshotPath
}

function Get-InvoiceAttachmentPaths {
  param([string]$Id)
  if ($Id -notmatch '^[A-Za-z0-9_-]{6,80}$') { throw "Identificador de adjunto invalido" }
  return @{ Image = Join-Path $InvoiceDir ($Id + ".bin"); Metadata = Join-Path $InvoiceDir ($Id + ".json") }
}

function Save-MonthlyReport {
  param([string]$Body)
  try { $payload = $Body | ConvertFrom-Json } catch { throw "Informe JSON invalido" }
  $month = [string]$payload.month
  $content = [string]$payload.content
  if ($month -notmatch '^20[0-9]{2}-(0[1-9]|1[0-2])$') { throw "Mes de informe invalido" }
  if (-not $content.Trim()) { throw "El informe esta vacio" }
  $utf8 = [System.Text.UTF8Encoding]::new($false)
  $contentBytes = $utf8.GetBytes($content)
  if ($contentBytes.Length -gt 7MB) { throw "El informe supera el limite local" }
  $fileName = "Informe-mensual-La-Vieja-Esquina-$month.md"
  $reportPath = Join-Path $ReportDir $fileName
  $tempPath = Join-Path $ReportDir ($fileName + ".tmp-" + [guid]::NewGuid().ToString("N"))
  try {
    [System.IO.File]::WriteAllBytes($tempPath, $contentBytes)
    Move-Item -LiteralPath $tempPath -Destination $reportPath -Force
  } finally {
    if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force }
  }
  return @{ ok=$true; file=$fileName; path=$reportPath; size=$contentBytes.Length }
}

function Get-LocalWeather {
  param([string]$RequestTarget)
  $requestUri = [uri]("http://127.0.0.1" + $RequestTarget)
  $query = [System.Web.HttpUtility]::ParseQueryString($requestUri.Query)
  $latitude = 0.0
  $longitude = 0.0
  if (-not [double]::TryParse([string]$query["latitude"], [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$latitude)) { throw "Latitud invalida" }
  if (-not [double]::TryParse([string]$query["longitude"], [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$longitude)) { throw "Longitud invalida" }
  if ($latitude -lt -90 -or $latitude -gt 90 -or $longitude -lt -180 -or $longitude -gt 180) { throw "Ubicacion fuera de rango" }
  $lat = $latitude.ToString("0.###", [Globalization.CultureInfo]::InvariantCulture)
  $lon = $longitude.ToString("0.###", [Globalization.CultureInfo]::InvariantCulture)
  $url = "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&current=temperature_2m%2Capparent_temperature%2Cweather_code%2Cprecipitation&hourly=temperature_2m%2Capparent_temperature%2Cweather_code%2Cprecipitation&daily=weather_code%2Ctemperature_2m_max%2Ctemperature_2m_min%2Cprecipitation_sum&timezone=auto&forecast_days=1"
  $response = Invoke-RestMethod -Method Get -Uri $url -TimeoutSec 12 -Headers @{ "User-Agent" = "LaViejaEsquina-POS/1.0" }
  return @{ current = $response.current; hourly = $response.hourly; daily = $response.daily; timezone = $response.timezone; utcOffsetSeconds = $response.utc_offset_seconds; latitude = [double]$lat; longitude = [double]$lon; provider = "Open-Meteo"; fetchedAt = (Get-Date).ToUniversalTime().ToString("o") }
}

function Save-InvoiceAttachment {
  param([string]$Id, [string]$Body)
  $paths = Get-InvoiceAttachmentPaths -Id $Id
  if ((Test-Path -LiteralPath $paths.Image) -or (Test-Path -LiteralPath $paths.Metadata)) { throw "Ese identificador de factura ya existe; los adjuntos son inmutables" }
  try { $payload = $Body | ConvertFrom-Json } catch { throw "Adjunto JSON invalido" }
  $match = [regex]::Match([string]$payload.dataUrl, '^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if (-not $match.Success) { throw "Solo se aceptan imagenes JPEG, PNG o WebP" }
  try { $bytes = [Convert]::FromBase64String(($match.Groups[2].Value -replace '\s','')) } catch { throw "Imagen base64 invalida" }
  if ($bytes.Length -lt 16 -or $bytes.Length -gt 2MB) { throw "La imagen debe pesar entre 16 bytes y 2 MB" }
  $mime = $match.Groups[1].Value.ToLowerInvariant()
  $validMagic = ($mime -eq "image/jpeg" -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8) -or ($mime -eq "image/png" -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50 -and $bytes[2] -eq 0x4E -and $bytes[3] -eq 0x47) -or ($mime -eq "image/webp" -and [Text.Encoding]::ASCII.GetString($bytes,0,4) -eq "RIFF" -and [Text.Encoding]::ASCII.GetString($bytes,8,4) -eq "WEBP")
  if (-not $validMagic) { throw "El contenido no coincide con el tipo de imagen" }
  $sha256 = [BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes)).Replace("-", "").ToLowerInvariant()
  $metadata = @{ id=$Id; storage="local-file"; mimeType=$mime; fileName=[IO.Path]::GetFileName([string]$payload.fileName); size=$bytes.Length; sha256=$sha256; createdAt=(Get-Date).ToUniversalTime().ToString("o") }
  $imageTemp = $paths.Image + ".tmp-" + [guid]::NewGuid().ToString("N"); $metaTemp = $paths.Metadata + ".tmp-" + [guid]::NewGuid().ToString("N")
  $imageCommitted = $false
  try {
    [IO.File]::WriteAllBytes($imageTemp,$bytes)
    [IO.File]::WriteAllText($metaTemp,($metadata|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
    if ((Test-Path -LiteralPath $paths.Image) -or (Test-Path -LiteralPath $paths.Metadata)) { throw "Ese identificador de factura ya existe; los adjuntos son inmutables" }
    [IO.File]::Move($imageTemp, $paths.Image)
    $imageCommitted = $true
    [IO.File]::Move($metaTemp, $paths.Metadata)
  } catch {
    if ($imageCommitted -and -not (Test-Path -LiteralPath $paths.Metadata) -and (Test-Path -LiteralPath $paths.Image)) { Remove-Item -LiteralPath $paths.Image -Force }
    throw
  } finally {
    if(Test-Path -LiteralPath $imageTemp){Remove-Item -LiteralPath $imageTemp -Force}
    if(Test-Path -LiteralPath $metaTemp){Remove-Item -LiteralPath $metaTemp -Force}
  }
  return $metadata
}

$MercadoLibreServicePath = Join-Path $PSScriptRoot "mercado-libre-service.ps1"
if (-not (Test-Path -LiteralPath $MercadoLibreServicePath)) { throw "Falta el servicio local de Mercado Libre" }
. $MercadoLibreServicePath
Initialize-MercadoLibreService

[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)

try {
  $listener.Start()
  if (-not $Quiet) { Write-Host "Servidor de datos local disponible en http://127.0.0.1:$Port" -ForegroundColor Green }
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 15000
      $client.SendTimeout = 70000
      $stream = $client.GetStream()
      $request = Read-HttpRequest -Stream $stream
      $origin = if ($request.Headers.ContainsKey("Origin")) { [string]$request.Headers["Origin"] } else { "" }
      $path = [uri]::UnescapeDataString(([string]$request.Target -split "\?", 2)[0])

      if (-not (Test-AllowedOrigin -Origin $origin)) {
        Write-JsonResponse -Stream $stream -StatusCode 403 -Value @{ error = "Origen no permitido" }
        continue
      }
      if ($request.Method -eq "OPTIONS") {
        Write-HttpResponse -Stream $stream -StatusCode 204 -ContentType "text/plain; charset=utf-8" -Body "" -Origin $origin
        continue
      }
      if ($request.Method -eq "GET" -and $path -eq "/api/health") {
        Write-JsonResponse -Stream $stream -StatusCode 200 -Value @{ ok = $true; dataBackupAvailable = $true } -Origin $origin
        continue
      }
      if ($request.Method -eq "GET" -and $path -eq "/api/weather") {
        if (-not (Test-SnapshotToken -Headers $request.Headers)) { Write-JsonResponse -Stream $stream -StatusCode 401 -Value @{ error = "Token local invalido" } -Origin $origin; continue }
        try {
          $weather = Get-LocalWeather -RequestTarget ([string]$request.Target)
          Write-JsonResponse -Stream $stream -StatusCode 200 -Value $weather -Origin $origin
        } catch {
          if (-not $Quiet) { Write-Warning ("No se pudo consultar el clima: " + $_.Exception.Message) }
          Write-JsonResponse -Stream $stream -StatusCode 502 -Value @{ error = "No se pudo consultar el clima" } -Origin $origin
        }
        continue
      }
      if ($path.StartsWith("/api/ml/", [System.StringComparison]::OrdinalIgnoreCase)) {
        $handled = Invoke-MercadoLibreRoute -Request $request -Path $path -Stream $stream -Origin $origin
        if ($handled) { continue }
      }
      if ($path -eq "/api/monthly-report") {
        if (-not (Test-SnapshotToken -Headers $request.Headers)) { Write-JsonResponse -Stream $stream -StatusCode 401 -Value @{ error = "Token local invalido" } -Origin $origin; continue }
        if ($request.Method -ne "POST") { Write-JsonResponse -Stream $stream -StatusCode 405 -Value @{ error = "Metodo no permitido" } -Origin $origin; continue }
        try {
          $reportResult = Save-MonthlyReport -Body $request.Body
          Write-JsonResponse -Stream $stream -StatusCode 200 -Value $reportResult -Origin $origin
        } catch {
          if (-not $Quiet) { Write-Warning ("Informe mensual invalido: " + $_.Exception.Message) }
          Write-JsonResponse -Stream $stream -StatusCode 400 -Value @{ error = $_.Exception.Message } -Origin $origin
        }
        continue
      }
      if ($path -match '^/api/invoice-attachment/([A-Za-z0-9_-]{6,80})$') {
        if (-not (Test-SnapshotToken -Headers $request.Headers)) { Write-JsonResponse -Stream $stream -StatusCode 401 -Value @{ error = "Token local invalido" } -Origin $origin; continue }
        $attachmentId = [string]$Matches[1]
        try {
          $attachmentPaths = Get-InvoiceAttachmentPaths -Id $attachmentId
          if ($request.Method -eq "POST") { $metadata = Save-InvoiceAttachment -Id $attachmentId -Body $request.Body; Write-JsonResponse -Stream $stream -StatusCode 200 -Value $metadata -Origin $origin; continue }
          if ($request.Method -eq "GET") {
            if (-not (Test-Path -LiteralPath $attachmentPaths.Image) -or -not (Test-Path -LiteralPath $attachmentPaths.Metadata)) { Write-JsonResponse -Stream $stream -StatusCode 404 -Value @{ error = "Adjunto no encontrado" } -Origin $origin; continue }
            $metadata = Get-Content -Raw -LiteralPath $attachmentPaths.Metadata | ConvertFrom-Json; $encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($attachmentPaths.Image)); Write-JsonResponse -Stream $stream -StatusCode 200 -Value @{ attachment=$metadata; dataUrl=("data:"+[string]$metadata.mimeType+";base64,"+$encoded) } -Origin $origin; continue
          }
          Write-JsonResponse -Stream $stream -StatusCode 405 -Value @{ error = "Metodo no permitido" } -Origin $origin
        } catch { Write-JsonResponse -Stream $stream -StatusCode 400 -Value @{ error = $_.Exception.Message } -Origin $origin }
        continue
      }
      if ($path -eq "/api/data-snapshot" -or $path -eq "/api/data-snapshot/archive") {
        if (-not (Test-SnapshotToken -Headers $request.Headers)) {
          Write-JsonResponse -Stream $stream -StatusCode 401 -Value @{ error = "Token local invalido" } -Origin $origin
          continue
        }
        if ($request.Method -eq "GET" -and $path -eq "/api/data-snapshot") {
          if (-not (Test-Path -LiteralPath $SnapshotPath)) {
            Write-JsonResponse -Stream $stream -StatusCode 404 -Value @{ error = "Todavia no hay respaldo" } -Origin $origin
          } else {
            $snapshotBody = [System.IO.File]::ReadAllText($SnapshotPath)
            $null = ConvertTo-ValidatedSnapshot -Body $snapshotBody
            Write-HttpResponse -Stream $stream -StatusCode 200 -ContentType "application/json; charset=utf-8" -Body $snapshotBody -Origin $origin
          }
          continue
        }
        if ($request.Method -ne "POST") {
          Write-JsonResponse -Stream $stream -StatusCode 405 -Value @{ error = "Metodo no permitido" } -Origin $origin
          continue
        }
        try {
          $savedName = Save-SnapshotBody -Body $request.Body -ArchiveOnly:($path -eq "/api/data-snapshot/archive")
          Write-JsonResponse -Stream $stream -StatusCode 200 -Value @{ ok = $true; file = $savedName } -Origin $origin
        } catch {
          if (-not $Quiet) { Write-Warning ("Respaldo local invalido: " + $_.Exception.Message) }
          Write-JsonResponse -Stream $stream -StatusCode 400 -Value @{ error = "No se pudo validar o guardar el respaldo" } -Origin $origin
        }
        continue
      }
      Write-JsonResponse -Stream $stream -StatusCode 404 -Value @{ error = "Ruta no encontrada" } -Origin $origin
    } catch {
      if (-not $Quiet) { Write-Warning ("Solicitud local invalida: " + $_.Exception.Message) }
      try { Write-JsonResponse -Stream $stream -StatusCode 400 -Value @{ error = "Solicitud local invalida" } } catch {}
    } finally {
      if ($stream) { $stream.Dispose() }
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
  try {
    if ((Test-Path -LiteralPath $PidPath) -and ([System.IO.File]::ReadAllText($PidPath)).Trim() -eq [string]$PID) {
      Remove-Item -LiteralPath $PidPath -Force
    }
  } catch {}
}
