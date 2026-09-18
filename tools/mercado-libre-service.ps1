function Initialize-MercadoLibreService {
  $script:MlDataDir = Join-Path $DataDir "mercado-libre"
  $script:MlImagesDir = Join-Path $script:MlDataDir "images"
  $script:MlSecurePath = Join-Path $script:MlDataDir "secure.dat"
  $script:MlOAuthStatePath = Join-Path $script:MlDataDir "oauth-state.json"
  $script:MlEntropy = [System.Text.Encoding]::UTF8.GetBytes("LaViejaEsquina-MercadoLibre-v1")
  New-Item -ItemType Directory -Path $script:MlDataDir -Force | Out-Null
  New-Item -ItemType Directory -Path $script:MlImagesDir -Force | Out-Null
}

function Get-MlRequestJson {
  param([string]$Body)
  if (-not $Body) { return [pscustomobject]@{} }
  try { return $Body | ConvertFrom-Json } catch { throw "Solicitud JSON de Mercado Libre invalida" }
}

function Read-MlSecureRecord {
  if (-not (Test-Path -LiteralPath $script:MlSecurePath)) { return $null }
  try {
    $encoded = [System.IO.File]::ReadAllText($script:MlSecurePath).Trim()
    if (-not $encoded) { return $null }
    $encrypted = [Convert]::FromBase64String($encoded)
    $plain = [System.Security.Cryptography.ProtectedData]::Unprotect(
      $encrypted,
      $script:MlEntropy,
      [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    return ([System.Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json)
  } catch {
    throw "No se pudieron abrir las credenciales cifradas de Mercado Libre para este usuario de Windows"
  }
}

function Write-MlSecureRecord {
  param([object]$Record)
  $json = $Record | ConvertTo-Json -Depth 20 -Compress
  $plain = [System.Text.Encoding]::UTF8.GetBytes($json)
  $encrypted = [System.Security.Cryptography.ProtectedData]::Protect(
    $plain,
    $script:MlEntropy,
    [System.Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  $encoded = [Convert]::ToBase64String($encrypted)
  $tempPath = $script:MlSecurePath + ".tmp-" + [guid]::NewGuid().ToString("N")
  try {
    [System.IO.File]::WriteAllText($tempPath, $encoded, [System.Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $tempPath -Destination $script:MlSecurePath -Force
  } finally {
    if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force }
  }
}

function ConvertTo-MlSecureRecord {
  param([object]$Existing)
  return [ordered]@{
    appId = [string]$Existing.appId
    clientSecret = [string]$Existing.clientSecret
    redirectUri = [string]$Existing.redirectUri
    siteId = if ([string]$Existing.siteId) { [string]$Existing.siteId } else { "MLA" }
    accessToken = [string]$Existing.accessToken
    refreshToken = [string]$Existing.refreshToken
    expiresAt = [string]$Existing.expiresAt
    userId = [string]$Existing.userId
    nickname = [string]$Existing.nickname
    aiApiKey = [string]$Existing.aiApiKey
    aiModel = if ([string]$Existing.aiModel) { [string]$Existing.aiModel } else { "gemini-2.5-flash" }
    connectedAt = [string]$Existing.connectedAt
    updatedAt = [string]$Existing.updatedAt
  }
}

function Get-MlPublicStatus {
  $record = Read-MlSecureRecord
  if ($null -eq $record) {
    return @{ configured = $false; connected = $false; siteId = "MLA"; redirectUri = "http://127.0.0.1:4174/api/ml/oauth/callback" }
  }
  $connected = [bool]([string]$record.accessToken -or [string]$record.refreshToken)
  return @{
    configured = [bool]([string]$record.appId -and [string]$record.clientSecret -and [string]$record.redirectUri)
    connected = $connected
    appId = [string]$record.appId
    redirectUri = [string]$record.redirectUri
    siteId = if ([string]$record.siteId) { [string]$record.siteId } else { "MLA" }
    userId = [string]$record.userId
    nickname = [string]$record.nickname
    expiresAt = [string]$record.expiresAt
    aiConfigured = [bool]([string]$record.aiApiKey)
    aiModel = if ([string]$record.aiModel) { [string]$record.aiModel } else { "gemini-2.5-flash" }
  }
}

function Get-MlSafeError {
  param([object]$ErrorRecord)
  $message = "Mercado Libre respondio con un error"
  if ($ErrorRecord.Exception -and $ErrorRecord.Exception.Message) { $message = [string]$ErrorRecord.Exception.Message }
  if ($ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) {
    try {
      $details = [string]$ErrorRecord.ErrorDetails.Message | ConvertFrom-Json
      if ($details.message) { $message = [string]$details.message }
      $causes = @($details.cause | ForEach-Object { [string]$_.message } | Where-Object { $_ })
      if ($causes.Count) { $message += ": " + ($causes -join "; ") }
    } catch {}
  }
  if ($message.Length -gt 1200) { $message = $message.Substring(0, 1200) }
  return $message -replace 'APP_USR-[A-Za-z0-9_-]+', '[token oculto]' -replace 'TG-[A-Za-z0-9_-]+', '[token oculto]'
}

function Invoke-MlTokenRequest {
  param([hashtable]$Fields)
  try {
    return Invoke-RestMethod -Method Post -Uri "https://api.mercadolibre.com/oauth/token" -ContentType "application/x-www-form-urlencoded" -Body $Fields -TimeoutSec 45
  } catch {
    throw (Get-MlSafeError -ErrorRecord $_)
  }
}

function Save-MlTokenResponse {
  param([object]$Existing, [object]$TokenResponse)
  $record = ConvertTo-MlSecureRecord -Existing $Existing
  $record.accessToken = [string]$TokenResponse.access_token
  if ([string]$TokenResponse.refresh_token) { $record.refreshToken = [string]$TokenResponse.refresh_token }
  $expiresIn = [Math]::Max(60, [int]$TokenResponse.expires_in)
  $record.expiresAt = [DateTimeOffset]::UtcNow.AddSeconds($expiresIn).ToString("o")
  if ([string]$TokenResponse.user_id) { $record.userId = [string]$TokenResponse.user_id }
  if (-not $record.connectedAt) { $record.connectedAt = [DateTimeOffset]::UtcNow.ToString("o") }
  $record.updatedAt = [DateTimeOffset]::UtcNow.ToString("o")
  Write-MlSecureRecord -Record $record
  return $record
}

function Get-MlAccessToken {
  $record = Read-MlSecureRecord
  if ($null -eq $record -or -not [string]$record.appId -or -not [string]$record.clientSecret) { throw "Configure primero la aplicacion de Mercado Libre" }
  $expiresAt = [DateTimeOffset]::MinValue
  if ([string]$record.expiresAt) { [DateTimeOffset]::TryParse([string]$record.expiresAt, [ref]$expiresAt) | Out-Null }
  if ([string]$record.accessToken -and $expiresAt -gt [DateTimeOffset]::UtcNow.AddMinutes(5)) { return [string]$record.accessToken }
  if (-not [string]$record.refreshToken) { throw "La cuenta de Mercado Libre debe autorizarse nuevamente" }
  $token = Invoke-MlTokenRequest -Fields @{
    grant_type = "refresh_token"
    client_id = [string]$record.appId
    client_secret = [string]$record.clientSecret
    refresh_token = [string]$record.refreshToken
  }
  $saved = Save-MlTokenResponse -Existing $record -TokenResponse $token
  return [string]$saved.accessToken
}

function Invoke-MlApi {
  param(
    [ValidateSet("GET", "POST", "PUT")][string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [switch]$AllowAnonymous
  )
  if (-not $Path.StartsWith("/")) { throw "Ruta externa invalida" }
  $headers = @{ Accept = "application/json" }
  if ($AllowAnonymous) {
    try {
      $record = Read-MlSecureRecord
      if ($record -and ([string]$record.accessToken -or [string]$record.refreshToken)) { $headers.Authorization = "Bearer " + (Get-MlAccessToken) }
    } catch {}
  } else {
    $headers.Authorization = "Bearer " + (Get-MlAccessToken)
  }
  $params = @{ Method = $Method; Uri = "https://api.mercadolibre.com" + $Path; Headers = $headers; TimeoutSec = 55 }
  if ($null -ne $Body) {
    $params.ContentType = "application/json; charset=utf-8"
    $params.Body = $Body | ConvertTo-Json -Depth 30 -Compress
  }
  try { return Invoke-RestMethod @params } catch { throw (Get-MlSafeError -ErrorRecord $_) }
}

function Get-MlQueryParameters {
  param([string]$Target)
  $values = @{}
  $parts = [string]$Target -split "\?", 2
  if ($parts.Length -lt 2) { return $values }
  foreach ($pair in ($parts[1] -split "&")) {
    if (-not $pair) { continue }
    $entry = $pair -split "=", 2
    $key = [uri]::UnescapeDataString(([string]$entry[0] -replace '\+', ' '))
    $value = if ($entry.Length -gt 1) { [uri]::UnescapeDataString(([string]$entry[1] -replace '\+', ' ')) } else { "" }
    $values[$key] = $value
  }
  return $values
}

function Save-MlOAuthState {
  param([string]$State)
  $payload = @{ state = $State; expiresAt = [DateTimeOffset]::UtcNow.AddMinutes(15).ToString("o") } | ConvertTo-Json -Compress
  [System.IO.File]::WriteAllText($script:MlOAuthStatePath, $payload, [System.Text.UTF8Encoding]::new($false))
}

function Test-MlOAuthState {
  param([string]$State)
  if (-not $State -or -not (Test-Path -LiteralPath $script:MlOAuthStatePath)) { return $false }
  try {
    $saved = Get-Content -Raw -LiteralPath $script:MlOAuthStatePath | ConvertFrom-Json
    $expiresAt = [DateTimeOffset]::Parse([string]$saved.expiresAt)
    return ([string]$saved.state -eq $State -and $expiresAt -gt [DateTimeOffset]::UtcNow)
  } catch { return $false }
}

function Complete-MlOAuth {
  param([string]$Code, [string]$State)
  if (-not (Test-MlOAuthState -State $State)) { throw "La autorizacion vencio o no coincide. Inicie la conexion nuevamente desde el POS" }
  if (-not $Code) { throw "Mercado Libre no devolvio un codigo de autorizacion" }
  $record = Read-MlSecureRecord
  if ($null -eq $record) { throw "Falta la configuracion local de Mercado Libre" }
  $token = Invoke-MlTokenRequest -Fields @{
    grant_type = "authorization_code"
    client_id = [string]$record.appId
    client_secret = [string]$record.clientSecret
    code = $Code
    redirect_uri = [string]$record.redirectUri
  }
  $saved = Save-MlTokenResponse -Existing $record -TokenResponse $token
  try {
    $me = Invoke-MlApi -Method GET -Path "/users/me"
    $saved.nickname = [string]$me.nickname
    if ([string]$me.id) { $saved.userId = [string]$me.id }
    $saved.updatedAt = [DateTimeOffset]::UtcNow.ToString("o")
    Write-MlSecureRecord -Record $saved
  } catch {}
  if (Test-Path -LiteralPath $script:MlOAuthStatePath) { Remove-Item -LiteralPath $script:MlOAuthStatePath -Force }
  return Get-MlPublicStatus
}

function Get-MlImagePaths {
  param([string]$ImageId)
  if ($ImageId -notmatch '^mli_[A-Za-z0-9_-]{6,90}$') { throw "Identificador de imagen invalido" }
  return @{ Image = Join-Path $script:MlImagesDir ($ImageId + ".bin"); Metadata = Join-Path $script:MlImagesDir ($ImageId + ".json") }
}

function Save-MlImage {
  param([string]$CandidateId, [string]$ImageId, [string]$Body)
  if ($CandidateId -notmatch '^mlc_[A-Za-z0-9_-]{2,100}$') { throw "Identificador de candidato invalido" }
  $paths = Get-MlImagePaths -ImageId $ImageId
  if ((Test-Path -LiteralPath $paths.Image) -or (Test-Path -LiteralPath $paths.Metadata)) { throw "La imagen ya existe" }
  $payload = Get-MlRequestJson -Body $Body
  $match = [regex]::Match([string]$payload.dataUrl, '^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if (-not $match.Success) { throw "Solo se aceptan imagenes JPEG, PNG o WebP" }
  try { $bytes = [Convert]::FromBase64String(($match.Groups[2].Value -replace '\s', '')) } catch { throw "Imagen base64 invalida" }
  if ($bytes.Length -lt 64 -or $bytes.Length -gt 6MB) { throw "La imagen debe pesar menos de 6 MB" }
  $mime = $match.Groups[1].Value.ToLowerInvariant()
  $validMagic = ($mime -eq "image/jpeg" -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8) -or
    ($mime -eq "image/png" -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50 -and $bytes[2] -eq 0x4E -and $bytes[3] -eq 0x47) -or
    ($mime -eq "image/webp" -and [Text.Encoding]::ASCII.GetString($bytes, 0, 4) -eq "RIFF" -and [Text.Encoding]::ASCII.GetString($bytes, 8, 4) -eq "WEBP")
  if (-not $validMagic) { throw "El contenido no coincide con el tipo de imagen" }
  $safeName = [IO.Path]::GetFileName([string]$payload.fileName)
  if (-not $safeName) { $safeName = "producto.jpg" }
  $metadata = @{ id = $ImageId; candidateId = $CandidateId; fileName = $safeName; mimeType = $mime; size = $bytes.Length; source = "ADMIN_UPLOAD"; createdAt = [DateTimeOffset]::UtcNow.ToString("o") }
  $imageTemp = $paths.Image + ".tmp-" + [guid]::NewGuid().ToString("N")
  $metaTemp = $paths.Metadata + ".tmp-" + [guid]::NewGuid().ToString("N")
  try {
    [IO.File]::WriteAllBytes($imageTemp, $bytes)
    [IO.File]::WriteAllText($metaTemp, ($metadata | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
    [IO.File]::Move($imageTemp, $paths.Image)
    [IO.File]::Move($metaTemp, $paths.Metadata)
  } finally {
    if (Test-Path -LiteralPath $imageTemp) { Remove-Item -LiteralPath $imageTemp -Force }
    if (Test-Path -LiteralPath $metaTemp) { Remove-Item -LiteralPath $metaTemp -Force }
  }
  return $metadata
}

function Read-MlImage {
  param([string]$ImageId)
  $paths = Get-MlImagePaths -ImageId $ImageId
  if (-not (Test-Path -LiteralPath $paths.Image) -or -not (Test-Path -LiteralPath $paths.Metadata)) { throw "Imagen no encontrada" }
  $metadata = Get-Content -Raw -LiteralPath $paths.Metadata | ConvertFrom-Json
  $data = [Convert]::ToBase64String([IO.File]::ReadAllBytes($paths.Image))
  return @{ id = $ImageId; dataUrl = "data:" + [string]$metadata.mimeType + ";base64," + $data; fileName = [string]$metadata.fileName; source = [string]$metadata.source }
}

function Send-MlPicture {
  param([string]$ImageId)
  $paths = Get-MlImagePaths -ImageId $ImageId
  if (-not (Test-Path -LiteralPath $paths.Image) -or -not (Test-Path -LiteralPath $paths.Metadata)) { throw "Falta una imagen local de la publicacion" }
  $metadata = Get-Content -Raw -LiteralPath $paths.Metadata | ConvertFrom-Json
  $token = Get-MlAccessToken
  Add-Type -AssemblyName System.Net.Http
  $client = [System.Net.Http.HttpClient]::new()
  $content = [System.Net.Http.MultipartFormDataContent]::new()
  try {
    $client.Timeout = [TimeSpan]::FromSeconds(60)
    $client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $token)
    $bytes = [IO.File]::ReadAllBytes($paths.Image)
    $fileContent = [System.Net.Http.ByteArrayContent]::new($bytes)
    $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse([string]$metadata.mimeType)
    $content.Add($fileContent, "file", [string]$metadata.fileName)
    $response = $client.PostAsync("https://api.mercadolibre.com/pictures/items/upload", $content).GetAwaiter().GetResult()
    $responseText = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) {
      $message = "No se pudo subir una foto a Mercado Libre"
      try { $errorBody = $responseText | ConvertFrom-Json; if ($errorBody.message) { $message += ": " + [string]$errorBody.message } } catch {}
      throw $message
    }
    $body = $responseText | ConvertFrom-Json
    if (-not [string]$body.id) { throw "Mercado Libre no devolvio el ID de una foto" }
    return @{ id = [string]$body.id }
  } finally {
    if ($content) { $content.Dispose() }
    if ($client) { $client.Dispose() }
  }
}

function Get-MlTechnicalAttributes {
  param([object]$TechnicalSpecs)
  $attributes = @()
  $requiredIds = @()
  foreach ($group in @($TechnicalSpecs.groups)) {
    foreach ($component in @($group.components)) {
      foreach ($attribute in @($component.attributes)) {
        $attributes += $attribute
        if (@($attribute.tags) -contains "required") { $requiredIds += [string]$attribute.id }
      }
    }
  }
  return @{ attributes = $attributes; requiredIds = @($requiredIds | Select-Object -Unique) }
}

function Invoke-MlAiAssist {
  param([object]$Payload)
  $record = Read-MlSecureRecord
  if ($null -eq $record -or -not [string]$record.aiApiKey) { throw "Configure una Gemini API key en la cuenta de Mercado Libre para usar el borrador con IA" }
  $model = if ([string]$record.aiModel) { ([string]$record.aiModel).Trim() } else { "gemini-2.5-flash" }
  if ($model -notmatch '^[A-Za-z0-9._-]{3,80}$') { throw "Modelo de IA invalido" }
  $inputJson = $Payload | ConvertTo-Json -Depth 18 -Compress
  if ($inputJson.Length -gt 45000) { throw "El contexto del asistente es demasiado grande" }
  $prompt = @"
Sos el asistente de publicaciones de la forrajeria argentina La Vieja Esquina. Preparas un borrador para revision humana; nunca publicas, nunca cambias precios y nunca cambias stock.

REGLAS OBLIGATORIAS:
- Responde exclusivamente JSON valido, sin markdown.
- Usa solamente los datos incluidos abajo. No inventes costo, marca, GTIN, dimensiones, peso, contenido del envase, stock, demanda ni categoria.
- Si costState es UNKNOWN o knownUnitCost es null/cero, minimumViablePrice debe ser null y debes advertir que margen y rentabilidad no son confiables.
- Stock por kg/litro no significa paquetes cerrados. No recomiendes publicarlo hasta que packagingStatus sea sealed/mixed y packagingConfirmed sea true.
- No sugieras usar fotos de otros vendedores. imageChecklist debe pedir fotos propias o autorizadas.
- categorySearchTitle es solo texto para el predictor oficial; no inventes un category_id.
- suggestedPrice solo puede ser numerico cuando exista precio local o evidencia de precios comparables. Es una sugerencia que el administrador debe aprobar.
- El titulo debe estar en espanol, ser factual y tener como maximo 60 caracteres.
- La descripcion debe ser texto plano, clara y no incluir afirmaciones no verificadas.

Devuelve este objeto:
{
  "worthListing": true,
  "confidence": "low|medium|high",
  "reasoningSummary": "resumen breve",
  "title": "titulo factual",
  "description": "descripcion en texto plano",
  "offerType": "individual|multipack",
  "packUnits": 1,
  "recommendedOnlineQuantity": 1,
  "suggestedPrice": null,
  "minimumViablePrice": null,
  "categorySearchTitle": "texto para predictor",
  "missingInformation": [],
  "warnings": [],
  "virtualBundleIdeas": [],
  "imageChecklist": []
}

DATOS VERIFICADOS Y RESULTADOS ML:
$inputJson
"@
  $requestBody = @{
    contents = @(@{ role = "user"; parts = @(@{ text = $prompt }) })
    generationConfig = @{ responseMimeType = "application/json"; temperature = 0.15; maxOutputTokens = 3000 }
  }
  $headers = @{ "x-goog-api-key" = [string]$record.aiApiKey; Accept = "application/json" }
  $uri = "https://generativelanguage.googleapis.com/v1beta/models/" + [uri]::EscapeDataString($model) + ":generateContent"
  try {
    $response = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json; charset=utf-8" -Body ($requestBody | ConvertTo-Json -Depth 20 -Compress) -TimeoutSec 75
  } catch { throw (Get-MlSafeError -ErrorRecord $_) }
  $text = [string]$response.candidates[0].content.parts[0].text
  if (-not $text) { throw "Gemini no devolvio un borrador" }
  $text = $text.Trim() -replace '^```(?:json)?\s*', '' -replace '\s*```$', ''
  try { $suggestion = $text | ConvertFrom-Json } catch { throw "Gemini devolvio un formato que no se pudo validar" }
  if (-not [string]$suggestion.title -or -not [string]$suggestion.description) { throw "El borrador de IA esta incompleto" }
  if ([string]$suggestion.offerType -notin @("individual", "multipack")) { $suggestion.offerType = "individual" }
  $suggestion.title = ([string]$suggestion.title).Trim()
  if ($suggestion.title.Length -gt 60) { $suggestion.title = $suggestion.title.Substring(0, 60).Trim() }
  $candidate = $Payload.candidate
  if ([string]$candidate.costState -eq "UNKNOWN" -or -not [double]$candidate.knownUnitCost) { $suggestion.minimumViablePrice = $null }
  if (-not $Payload.mercadoLibreResearch -and -not [double]$candidate.localPrice) { $suggestion.suggestedPrice = $null }
  return @{ suggestion = $suggestion; model = $model; generatedAt = [DateTimeOffset]::UtcNow.ToString("o") }
}

function Invoke-MlResearch {
  param([object]$Payload)
  $query = ([string]$Payload.query).Trim()
  if (-not $query -or $query.Length -gt 180) { throw "La busqueda debe tener entre 1 y 180 caracteres" }
  $encoded = [uri]::EscapeDataString($query)
  $predictions = @(Invoke-MlApi -Method GET -Path ("/sites/MLA/domain_discovery/search?limit=3&q=" + $encoded) -AllowAnonymous)
  $results = @()
  if (-not [bool]$Payload.categoryOnly) {
    $path = "/sites/MLA/search?limit=24&q=" + $encoded
    if ([string]$Payload.categoryId -match '^MLA[0-9]+$') { $path += "&category=" + [uri]::EscapeDataString([string]$Payload.categoryId) }
    $search = Invoke-MlApi -Method GET -Path $path -AllowAnonymous
    $results = @($search.results | ForEach-Object {
      @{
        id = [string]$_.id
        title = [string]$_.title
        price = [double]$_.price
        soldQuantity = [double]$_.sold_quantity
        categoryId = [string]$_.category_id
        listingTypeId = [string]$_.listing_type_id
        condition = [string]$_.condition
        permalink = [string]$_.permalink
      }
    })
  }
  return @{
    query = $query
    predictions = @($predictions | ForEach-Object { @{ domainId = [string]$_.domain_id; domainName = [string]$_.domain_name; categoryId = [string]$_.category_id; categoryName = [string]$_.category_name; attributes = @($_.attributes) } })
    results = $results
    researchedAt = [DateTimeOffset]::UtcNow.ToString("o")
  }
}

function Get-MlFeeEstimate {
  param([object]$Payload)
  $categoryId = ([string]$Payload.categoryId).Trim().ToUpperInvariant()
  $price = [double]$Payload.price
  $weight = [int]$Payload.billableWeight
  $listingType = ([string]$Payload.listingTypeId).Trim()
  if ($categoryId -notmatch '^MLA[0-9]+$') { throw "Categoria de Mercado Libre invalida" }
  if ($price -le 0) { throw "Precio ML invalido" }
  if ($weight -le 0) { throw "Ingrese el peso facturable real en gramos" }
  if ($listingType -notin @("gold_special", "gold_pro", "free")) { throw "Tipo de publicacion invalido" }
  $priceText = $price.ToString([Globalization.CultureInfo]::InvariantCulture)
  $path = "/sites/MLA/listing_prices?price=$priceText&currency_id=ARS&category_id=$categoryId&listing_type_id=$listingType&shipping_mode=me2&logistic_type=drop_off&billable_weight=$weight"
  $response = @(Invoke-MlApi -Method GET -Path $path)
  $flat = @()
  foreach ($entry in $response) {
    if ($entry -is [System.Array]) { $flat += @($entry) } else { $flat += $entry }
  }
  $selected = $flat | Where-Object { [string]$_.listing_type_id -eq $listingType } | Select-Object -First 1
  if ($null -eq $selected) { $selected = $flat | Select-Object -First 1 }
  if ($null -eq $selected) { throw "Mercado Libre no devolvio una estimacion de cargos" }
  return @{
    selected = @{
      currencyId = [string]$selected.currency_id
      listingTypeId = [string]$selected.listing_type_id
      listingTypeName = [string]$selected.listing_type_name
      listingFeeAmount = [double]$selected.listing_fee_amount
      saleFeeAmount = [double]$selected.sale_fee_amount
      fixedFee = [double]$selected.sale_fee_details.fixed_fee
      percentageFee = [double]$selected.sale_fee_details.percentage_fee
      financingFee = [double]$selected.sale_fee_details.financing_add_on_fee
    }
    calculatedAt = [DateTimeOffset]::UtcNow.ToString("o")
  }
}

function Publish-MlItem {
  param([object]$Payload)
  if ([string]$Payload.approval -cne "PUBLICAR") { throw "Falta la aprobacion explicita PUBLICAR" }
  $candidateId = ([string]$Payload.candidateId).Trim()
  $title = ([string]$Payload.title).Trim()
  $categoryId = ([string]$Payload.categoryId).Trim().ToUpperInvariant()
  $price = [double]$Payload.price
  $quantity = [int]$Payload.availableQuantity
  $physical = [double]$Payload.physicalStock
  $maximum = [int]$Payload.mlMaxStock
  $packaging = ([string]$Payload.packagingStatus).Trim().ToLowerInvariant()
  if ($candidateId -notmatch '^mlc_[A-Za-z0-9_-]{2,100}$') { throw "Candidato invalido" }
  if (-not [bool]$Payload.packagingConfirmed -or $packaging -notin @("sealed", "mixed")) { throw "El envase debe estar confirmado como cerrado o mixto antes de publicar" }
  if ($title.Length -lt 3 -or $title.Length -gt 60) { throw "El titulo debe tener entre 3 y 60 caracteres" }
  if ($categoryId -notmatch '^MLA[0-9]+$') { throw "Categoria invalida" }
  if ($price -le 0) { throw "Precio invalido" }
  if ($quantity -le 0 -or $maximum -le 0) { throw "La cantidad online debe ser mayor a cero" }
  if ($quantity -gt [Math]::Floor([Math]::Min($physical, $maximum))) { throw "La cantidad online supera el limite seguro de stock" }
  if ([string]$Payload.listingTypeId -notin @("gold_special", "gold_pro", "free")) { throw "Tipo de publicacion invalido" }
  $imageRefs = @($Payload.imageRefs)
  if ($imageRefs.Count -lt 1 -or $imageRefs.Count -gt 8) { throw "Cargue entre 1 y 8 fotos propias" }
  $pictures = @()
  foreach ($imageRef in $imageRefs) { $pictures += Send-MlPicture -ImageId ([string]$imageRef) }
  $attributes = @($Payload.attributes | ForEach-Object {
    if (-not [string]$_.id) { return }
    if ([string]$_.value_id) { @{ id = [string]$_.id; value_id = [string]$_.value_id } }
    elseif ([string]$_.value_name) { @{ id = [string]$_.id; value_name = [string]$_.value_name } }
  })
  $itemPayload = @{
    site_id = "MLA"
    title = $title
    category_id = $categoryId
    price = $price
    currency_id = "ARS"
    available_quantity = $quantity
    buying_mode = "buy_it_now"
    listing_type_id = [string]$Payload.listingTypeId
    condition = "new"
    pictures = @($pictures | ForEach-Object { @{ id = [string]$_.id } })
    attributes = $attributes
  }
  $item = Invoke-MlApi -Method POST -Path "/items" -Body $itemPayload
  $descriptionSaved = $false
  $descriptionError = ""
  try {
    $description = ([string]$Payload.description).Trim()
    if (-not $description) { throw "La descripcion esta vacia" }
    $null = Invoke-MlApi -Method POST -Path ("/items/" + [uri]::EscapeDataString([string]$item.id) + "/description") -Body @{ plain_text = $description }
    $descriptionSaved = $true
  } catch { $descriptionError = [string]$_.Exception.Message }
  return @{
    item = @{
      id = [string]$item.id
      permalink = [string]$item.permalink
      status = [string]$item.status
      price = [double]$item.price
      availableQuantity = [int]$item.available_quantity
      userProductId = [string]$item.user_product_id
    }
    descriptionSaved = $descriptionSaved
    descriptionError = $descriptionError
  }
}

function Invoke-MercadoLibreRoute {
  param(
    [hashtable]$Request,
    [string]$Path,
    [System.IO.Stream]$Stream,
    [string]$Origin
  )
  if (-not $Path.StartsWith("/api/ml/", [System.StringComparison]::OrdinalIgnoreCase)) { return $false }
  $isCallback = $Request.Method -eq "GET" -and $Path -eq "/api/ml/oauth/callback"
  if (-not $isCallback -and -not (Test-SnapshotToken -Headers $Request.Headers)) {
    Write-JsonResponse -Stream $Stream -StatusCode 401 -Value @{ error = "Token local invalido" } -Origin $Origin
    return $true
  }
  try {
    if ($Request.Method -eq "GET" -and $Path -eq "/api/ml/status") {
      Write-JsonResponse -Stream $Stream -StatusCode 200 -Value (Get-MlPublicStatus) -Origin $Origin
      return $true
    }
    if ($Request.Method -eq "POST" -and $Path -eq "/api/ml/config") {
      $payload = Get-MlRequestJson -Body $Request.Body
      $appId = ([string]$payload.appId).Trim()
      $redirectUri = ([string]$payload.redirectUri).Trim()
      if ($appId -notmatch '^[0-9]{4,30}$') { throw "App ID invalido" }
      try { $redirect = [uri]$redirectUri } catch { throw "Redirect URI invalida" }
      $localCallback = $redirect.Scheme -eq "http" -and $redirect.Host -in @("127.0.0.1", "localhost") -and $redirect.Port -eq 4174 -and $redirect.AbsolutePath -eq "/api/ml/oauth/callback"
      if ($redirect.Scheme -ne "https" -and -not $localCallback) { throw "Use HTTPS o el callback local exacto mostrado por la aplicacion" }
      $existing = Read-MlSecureRecord
      if ($null -eq $existing) { $existing = [pscustomobject]@{} }
      $record = ConvertTo-MlSecureRecord -Existing $existing
      $record.appId = $appId
      if ([string]$payload.clientSecret) { $record.clientSecret = [string]$payload.clientSecret }
      if (-not $record.clientSecret) { throw "Ingrese la Secret Key la primera vez" }
      $record.redirectUri = $redirectUri
      $record.siteId = "MLA"
      if ([string]$payload.aiApiKey) { $record.aiApiKey = [string]$payload.aiApiKey }
      if ([string]$payload.aiModel) {
        $aiModel = ([string]$payload.aiModel).Trim()
        if ($aiModel -notmatch '^[A-Za-z0-9._-]{3,80}$') { throw "Modelo de IA invalido" }
        $record.aiModel = $aiModel
      }
      $record.updatedAt = [DateTimeOffset]::UtcNow.ToString("o")
      Write-MlSecureRecord -Record $record
      Write-JsonResponse -Stream $Stream -StatusCode 200 -Value (Get-MlPublicStatus) -Origin $Origin
      return $true
    }
    if ($Request.Method -eq "POST" -and $Path -eq "/api/ml/oauth-url") {
      $record = Read-MlSecureRecord
      if ($null -eq $record -or -not [string]$record.appId -or -not [string]$record.clientSecret -or -not [string]$record.redirectUri) { throw "Guarde primero App ID, Secret Key y Redirect URI" }
      $state = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
      Save-MlOAuthState -State $state
      $url = "https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=" + [uri]::EscapeDataString([string]$record.appId) + "&redirect_uri=" + [uri]::EscapeDataString([string]$record.redirectUri) + "&state=" + $state
      Write-JsonResponse -Stream $Stream -StatusCode 200 -Value @{ authorizationUrl = $url; expiresInMinutes = 15 } -Origin $Origin
      return $true
    }
    if ($isCallback) {
      $query = Get-MlQueryParameters -Target $Request.Target
      if ($query.error) { throw ("Mercado Libre rechazo la autorizacion: " + [string]$query.error) }
      $status = Complete-MlOAuth -Code ([string]$query.code) -State ([string]$query.state)
      $nickname = if ([string]$status.nickname) { [System.Net.WebUtility]::HtmlEncode([string]$status.nickname) } else { "la cuenta" }
      $html = "<!doctype html><html lang='es'><meta charset='utf-8'><title>Mercado Libre conectado</title><style>body{font-family:Arial;background:#f4f7f6;color:#153e3b;display:grid;place-items:center;min-height:100vh;margin:0}.card{background:#fff;border:1px solid #cadbd6;border-radius:18px;padding:32px;max-width:520px;box-shadow:0 18px 50px #173e3620}h1{margin-top:0;color:#08783f}button{padding:12px 18px;border:0;border-radius:9px;background:#123f45;color:#fff;font-weight:800}</style><div class='card'><h1>Cuenta conectada</h1><p>Mercado Libre autorizo " + $nickname + ". Los tokens quedaron cifrados localmente.</p><p>Vuelva al POS y pulse <b>Actualizar estado</b>.</p><button onclick='window.close()'>Cerrar ventana</button></div></html>"
      Write-HttpResponse -Stream $Stream -StatusCode 200 -ContentType "text/html; charset=utf-8" -Body $html
      return $true
    }
    if ($Request.Method -eq "POST" -and $Path -eq "/api/ml/research") {
      $payload = Get-MlRequestJson -Body $Request.Body
      Write-JsonResponse -Stream $Stream -StatusCode 200 -Value (Invoke-MlResearch -Payload $payload) -Origin $Origin
      return $true
    }
    if ($Request.Method -eq "POST" -and $Path -eq "/api/ml/assist") {
      $payload = Get-MlRequestJson -Body $Request.Body
      Write-JsonResponse -Stream $Stream -StatusCode 200 -Value (Invoke-MlAiAssist -Payload $payload) -Origin $Origin
      return $true
    }
    if ($Request.Method -eq "GET" -and $Path -match '^/api/ml/categories/(MLA[0-9]+)/attributes$') {
      $categoryId = [string]$Matches[1]
      $attributes = @(Invoke-MlApi -Method GET -Path ("/categories/$categoryId/attributes"))
      $technical = $null
      try { $technical = Invoke-MlApi -Method GET -Path ("/categories/$categoryId/technical_specs/input") } catch {}
      $technicalResult = if ($technical) { Get-MlTechnicalAttributes -TechnicalSpecs $technical } else { @{ attributes = @(); requiredIds = @() } }
      Write-JsonResponse -Stream $Stream -StatusCode 200 -Value @{ attributes = $attributes; technicalAttributes = @($technicalResult.attributes); technicalRequiredIds = @($technicalResult.requiredIds) } -Origin $Origin
      return $true
    }
    if ($Request.Method -eq "POST" -and $Path -match '^/api/ml/categories/(MLA[0-9]+)/conditional$') {
      $categoryId = [string]$Matches[1]
      $payload = Get-MlRequestJson -Body $Request.Body
      $result = Invoke-MlApi -Method POST -Path ("/categories/$categoryId/attributes/conditional") -Body $payload
      Write-JsonResponse -Stream $Stream -StatusCode 200 -Value $result -Origin $Origin
      return $true
    }
    if ($Request.Method -eq "POST" -and $Path -eq "/api/ml/fees") {
      $payload = Get-MlRequestJson -Body $Request.Body
      Write-JsonResponse -Stream $Stream -StatusCode 200 -Value (Get-MlFeeEstimate -Payload $payload) -Origin $Origin
      return $true
    }
    if ($Request.Method -eq "POST" -and $Path -match '^/api/ml/images/(mlc_[A-Za-z0-9_-]{2,100})/(mli_[A-Za-z0-9_-]{6,90})$') {
      $saved = Save-MlImage -CandidateId ([string]$Matches[1]) -ImageId ([string]$Matches[2]) -Body $Request.Body
      Write-JsonResponse -Stream $Stream -StatusCode 200 -Value $saved -Origin $Origin
      return $true
    }
    if ($Request.Method -eq "GET" -and $Path -match '^/api/ml/images/(mli_[A-Za-z0-9_-]{6,90})$') {
      Write-JsonResponse -Stream $Stream -StatusCode 200 -Value (Read-MlImage -ImageId ([string]$Matches[1])) -Origin $Origin
      return $true
    }
    if ($Request.Method -eq "POST" -and $Path -eq "/api/ml/publish") {
      $payload = Get-MlRequestJson -Body $Request.Body
      Write-JsonResponse -Stream $Stream -StatusCode 200 -Value (Publish-MlItem -Payload $payload) -Origin $Origin
      return $true
    }
    if ($Request.Method -eq "GET" -and $Path -match '^/api/ml/items/(MLA[0-9]+)$') {
      $item = Invoke-MlApi -Method GET -Path ("/items/" + [string]$Matches[1])
      Write-JsonResponse -Stream $Stream -StatusCode 200 -Value @{ id = [string]$item.id; status = [string]$item.status; price = [double]$item.price; availableQuantity = [int]$item.available_quantity; userProductId = [string]$item.user_product_id; lastUpdated = [string]$item.last_updated; permalink = [string]$item.permalink } -Origin $Origin
      return $true
    }
    if ($Request.Method -eq "POST" -and $Path -match '^/api/ml/items/(MLA[0-9]+)/sync-stock$') {
      $itemId = [string]$Matches[1]
      $payload = Get-MlRequestJson -Body $Request.Body
      if ([string]$payload.approval -cne "SINCRONIZAR") { throw "Falta la confirmacion SINCRONIZAR" }
      $quantity = [int]$payload.availableQuantity
      if ($quantity -lt 0) { throw "Stock online invalido" }
      $remote = Invoke-MlApi -Method GET -Path ("/items/$itemId")
      $userProductId = if ([string]$remote.user_product_id) { [string]$remote.user_product_id } else { [string]$payload.userProductId }
      if ($userProductId) { throw "Esta cuenta usa User Products o stock multideposito. Configure el deposito exacto antes de sincronizar; no se modifico el stock remoto" }
      $updated = Invoke-MlApi -Method PUT -Path ("/items/$itemId") -Body @{ available_quantity = $quantity }
      Write-JsonResponse -Stream $Stream -StatusCode 200 -Value @{ id = [string]$updated.id; availableQuantity = [int]$updated.available_quantity; userProductId = [string]$updated.user_product_id; syncedAt = [DateTimeOffset]::UtcNow.ToString("o") } -Origin $Origin
      return $true
    }
    return $false
  } catch {
    if (-not $Quiet) { Write-Warning ("Mercado Libre: " + $_.Exception.Message) }
    Write-JsonResponse -Stream $Stream -StatusCode 400 -Value @{ error = [string]$_.Exception.Message } -Origin $Origin
    return $true
  }
}
