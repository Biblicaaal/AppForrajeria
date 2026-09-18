(function () {
  "use strict";

  var bridge = null;
  var activeView = "summary";
  var candidates = [];
  var listings = [];
  var researchRows = [];
  var products = [];
  var productById = {};
  var activeCandidate = null;
  var connectionStatus = { configured: false, connected: false };
  var renderSequence = 0;

  var WORKFLOW = {
    DISCOVERED: "Descubierto",
    RESEARCHING: "Investigando",
    NEEDS_REVIEW: "Necesita revision",
    APPROVED: "Aprobado",
    PREPARING: "Preparando",
    READY: "Listo",
    PUBLISHED: "Publicado",
    REJECTED: "Rechazado",
    PAUSED: "Pausado",
    ERROR: "Error"
  };

  function $(id) { return document.getElementById(id); }
  function safe(value) {
    if (bridge && bridge.escapeHtml) return bridge.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character];
    });
  }
  function notify(message) { if (bridge && bridge.toast) bridge.toast(message); }
  function nowIso() { return bridge && bridge.nowIso ? bridge.nowIso() : new Date().toISOString(); }
  function uid() { return bridge && bridge.uid ? bridge.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function money(value) {
    if (bridge && bridge.money) return bridge.money(value);
    return "$ " + Math.round(Number(value || 0)).toLocaleString("es-AR");
  }
  function decimal(value, maximum) {
    var number = Number(value);
    return isFinite(number) ? number.toLocaleString("es-AR", { maximumFractionDigits: maximum == null ? 2 : maximum }) : "—";
  }
  function normalize(value) {
    return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }
  function clampNumber(value, minimum, maximum) {
    var number = Number(value);
    if (!isFinite(number)) number = minimum;
    return Math.max(minimum, maximum == null ? number : Math.min(maximum, number));
  }
  function parseLocalizedNumber(value) {
    var text = String(value == null ? "" : value).replace(/\s/g, "").replace("$", "");
    if (text.indexOf(",") >= 0 && text.indexOf(".") >= 0) text = text.replace(/\./g, "").replace(",", ".");
    else if (text.indexOf(",") >= 0) text = text.replace(",", ".");
    var number = Number(text);
    return isFinite(number) ? number : 0;
  }
  function firstDefined() {
    for (var index = 0; index < arguments.length; index += 1) {
      if (arguments[index] !== null && arguments[index] !== undefined && arguments[index] !== "") return arguments[index];
    }
    return null;
  }
  function productName(product) {
    if (!product) return "Producto eliminado del POS";
    return String(product.name || [product.brand, product.product, product.variant].filter(Boolean).join(" ") || "Producto sin nombre").trim();
  }
  function productBrand(product) { return String(product && product.brand || "").trim(); }
  function productCategory(product) { return String(product && product.category || "Sin categoria").trim(); }
  function productSaleUnit(product) { return String(product && (product.unitType || product.priceUnit) || "unidad").trim(); }
  function isFractionalUnit(unit) {
    var value = normalize(unit).replace(/[.\s]/g, "");
    return ["kg", "kilo", "kilos", "kilogramo", "kilogramos", "g", "gr", "gramo", "gramos", "l", "lt", "lts", "ltr", "litro", "litros", "ml", "mililitro", "mililitros"].indexOf(value) >= 0;
  }
  function inferPackaging(product) {
    var unit = productSaleUnit(product);
    var label = normalize(productName(product) + " " + (product && product.variant || ""));
    if (isFractionalUnit(unit)) {
      return {
        status: "fractional",
        confidence: "high",
        reason: "El stock se vende por " + unit + "; no representa paquetes cerrados."
      };
    }
    var packageCue = /(bolsa|paquete|pack|sachet|botella|bidon|frasco|lata|caja|unidad|x\s?\d+|\d+\s?(kg|g|gr|ml|l|lt))/.test(label);
    if (packageCue && String(product && product.barcode || "").trim()) {
      return {
        status: "sealed",
        confidence: "medium",
        reason: "Parece una unidad cerrada y tiene codigo, pero debe verificarse fisicamente."
      };
    }
    return {
      status: "unknown",
      confidence: "low",
      reason: "No hay informacion suficiente para confirmar si es un paquete cerrado."
    };
  }
  function knownUnitCost(product) {
    if (!product) return null;
    var average = Number(product.weightedAverageCostPerSaleUnit);
    var coverage = Number(product.costCoveragePct || 0);
    var unknown = Number(product.unknownCostQuantity || 0);
    var explicitlyKnown = String(product.costState || "").toUpperCase() === "KNOWN";
    if (average > 0 && isFinite(average) && (explicitlyKnown || (coverage >= 99.99 && unknown <= 0.0001))) return average;
    return null;
  }
  function physicalStock(candidate) {
    var product = productById[candidate.productId];
    return Math.max(0, Number(product ? product.stock : candidate.physicalStock || 0));
  }
  function mlAvailableStock(candidate) {
    var physical = physicalStock(candidate);
    var maximum = Math.max(0, Math.floor(Number(candidate.mlMaxStock || 0)));
    var reserved = Math.max(0, Math.floor(Number(candidate.mlReservedStock || 0)));
    return Math.max(0, Math.floor(Math.min(physical, maximum) - reserved));
  }
  function candidateCost(candidate) {
    var product = productById[candidate.productId];
    var cost = knownUnitCost(product);
    if (cost == null && candidate.knownUnitCost != null && Number(candidate.knownUnitCost) > 0 && candidate.costReliability === "KNOWN") cost = Number(candidate.knownUnitCost);
    return cost;
  }
  function scoreCandidate(product, packaging) {
    var score = 20;
    var stock = Math.max(0, Number(product.stock || 0));
    if (stock >= 10) score += 20;
    else if (stock >= 3) score += 12;
    else if (stock > 0) score += 4;
    else score -= 35;
    if (Number(product.price || 0) > 0) score += 12;
    else score -= 20;
    if (String(product.barcode || "").trim()) score += 8;
    if (knownUnitCost(product) != null) score += 15;
    if (packaging.status === "sealed") score += 10;
    if (packaging.status === "fractional") score -= 28;
    if (packaging.status === "unknown") score -= 12;
    if (/alimento|mascota|limpieza|accesorio|juguete|ferreteria/.test(normalize(productCategory(product)))) score += 8;
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  function initialIssues(product, packaging) {
    var issues = [];
    if (!(Number(product.stock || 0) > 0)) issues.push("Sin stock fisico disponible.");
    if (!(Number(product.price || 0) > 0)) issues.push("Sin precio local; no se puede sugerir precio ML.");
    if (!String(product.barcode || "").trim()) issues.push("Sin GTIN/codigo de barras.");
    if (knownUnitCost(product) == null) issues.push("COSTO DESCONOCIDO: la rentabilidad no puede considerarse confiable.");
    if (packaging.status === "fractional") issues.push("Stock fraccionado: no equivale a envases cerrados.");
    if (packaging.status === "unknown") issues.push("Debe confirmarse el estado del envase.");
    return issues;
  }
  function buildCandidate(product) {
    var packaging = inferPackaging(product);
    var cost = knownUnitCost(product);
    return {
      id: "mlc_" + product.id,
      productId: product.id,
      sourceName: productName(product),
      sourceBrand: productBrand(product),
      sourceCategory: productCategory(product),
      sourceBarcode: String(product.barcode || "").trim(),
      sourceUnit: productSaleUnit(product),
      localPrice: Number(product.price || 0),
      physicalStock: Number(product.stock || 0),
      mlMaxStock: 0,
      mlReservedStock: 0,
      packagingStatus: packaging.status,
      packagingConfirmed: false,
      packagingInference: packaging.reason,
      offerType: "individual",
      packUnits: 1,
      state: "DISCOVERED",
      score: scoreCandidate(product, packaging),
      knownUnitCost: cost,
      costReliability: cost == null ? "UNKNOWN" : "KNOWN",
      issues: initialIssues(product, packaging),
      listingTypeId: "gold_special",
      currencyId: "ARS",
      siteId: "MLA",
      attributeValues: {},
      requiredAttributes: [],
      imageRefs: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: bridge.getCurrentUser() && bridge.getCurrentUser().id
    };
  }
  function researchFor(candidateId) {
    return researchRows.filter(function (row) { return row.candidateId === candidateId; }).sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    })[0] || null;
  }
  function listingFor(candidateId) {
    return listings.filter(function (row) { return row.candidateId === candidateId; }).sort(function (a, b) {
      return String(b.updatedAt || b.publishedAt || "").localeCompare(String(a.updatedAt || a.publishedAt || ""));
    })[0] || null;
  }
  function statusTone(state) {
    if (state === "PUBLISHED" || state === "READY") return "good";
    if (state === "ERROR" || state === "REJECTED") return "bad";
    if (state === "NEEDS_REVIEW" || state === "PAUSED") return "warn";
    return "neutral";
  }
  function viewStates(view) {
    if (view === "candidates") return ["DISCOVERED", "RESEARCHING"];
    if (view === "review") return ["NEEDS_REVIEW", "APPROVED", "PREPARING"];
    if (view === "ready") return ["READY"];
    if (view === "published") return ["PUBLISHED"];
    if (view === "problems") return ["REJECTED", "PAUSED", "ERROR"];
    return [];
  }
  function viewCopy(view) {
    return ({
      candidates: ["Candidatos", "Productos del POS detectados para investigar y decidir."],
      review: ["En revision", "Propuestas que necesitan una decision o completar datos confiables."],
      ready: ["Listos para publicar", "Publicaciones completas que esperan la accion final PUBLICAR."],
      published: ["Publicados", "Items vinculados con su ID y estado de sincronizacion."],
      problems: ["Problemas", "Candidatos rechazados, pausados o con errores que requieren atencion."]
    })[view] || ["Mercado Libre", ""];
  }
  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.originalLabel = button.textContent;
      button.textContent = label || "Procesando...";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalLabel || button.textContent;
      button.disabled = false;
    }
  }
  function request(path, options) {
    if (!bridge || !bridge.request) return Promise.reject(new Error("El servicio local no esta disponible"));
    return bridge.request(path, options || {}).then(function (response) {
      return response.text().then(function (text) {
        var body = {};
        try { body = text ? JSON.parse(text) : {}; } catch (error) { body = { error: text || "Respuesta invalida" }; }
        if (!response.ok) throw new Error(body.error || body.message || "Mercado Libre respondio con error");
        return body;
      });
    });
  }
  function jsonOptions(body) {
    return { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body || {}) };
  }

  function refreshConnectionStatus(showToast) {
    return request("/status").then(function (status) {
      connectionStatus = status || { configured: false, connected: false };
      renderConnectionStatus();
      if ($("mlAppId") && status.appId) $("mlAppId").value = status.appId;
      if ($("mlRedirectUri") && status.redirectUri) $("mlRedirectUri").value = status.redirectUri;
      if ($("mlGeminiModel") && status.aiModel) $("mlGeminiModel").value = status.aiModel;
      if (showToast) notify(status.connected ? "Cuenta de Mercado Libre conectada" : "Estado de conexion actualizado");
      return status;
    }).catch(function (error) {
      connectionStatus = { configured: false, connected: false, error: error.message };
      renderConnectionStatus();
      if (showToast) notify(error.message);
      return connectionStatus;
    });
  }
  function renderConnectionStatus() {
    var node = $("mlConnectionStatus");
    if (!node) return;
    var label = "Sin configurar";
    var tone = "is-offline";
    if (connectionStatus.connected) {
      label = "Conectado" + (connectionStatus.nickname ? " · " + connectionStatus.nickname : "");
      tone = "is-online";
    } else if (connectionStatus.configured) {
      label = "Configurado · falta autorizar";
      tone = "is-pending";
    } else if (connectionStatus.error) {
      label = "Reinicie la app para habilitar la integracion";
      tone = "is-error";
    }
    node.className = "ml-connection-status " + tone;
    node.innerHTML = "<span></span><b>" + safe(label) + "</b>";
    if ($("mlAiStatus")) $("mlAiStatus").textContent = connectionStatus.aiConfigured ? "Configurado · " + (connectionStatus.aiModel || "Gemini") : "No configurado · se usa preparacion local";
  }
  function openConfig() {
    if (!bridge.isAdmin()) return;
    $("mlConfigFeedback").classList.add("hidden");
    $("mlConfigModal").classList.remove("hidden");
    refreshConnectionStatus(false);
  }
  function closeConfig() { $("mlConfigModal").classList.add("hidden"); }
  function saveConfig(event) {
    event.preventDefault();
    var button = event.submitter || $("mlConfigForm").querySelector("button[type='submit']");
    var body = {
      appId: $("mlAppId").value.trim(),
      clientSecret: $("mlClientSecret").value,
      redirectUri: $("mlRedirectUri").value.trim(),
      siteId: "MLA",
      aiApiKey: $("mlGeminiApiKey").value,
      aiModel: $("mlGeminiModel").value.trim() || "gemini-2.5-flash"
    };
    setBusy(button, true, "Guardando...");
    request("/config", jsonOptions(body)).then(function (status) {
      connectionStatus = status;
      $("mlClientSecret").value = "";
      $("mlGeminiApiKey").value = "";
      $("mlConfigFeedback").className = "msg good";
      $("mlConfigFeedback").textContent = "Credenciales cifradas localmente. Ya puede autorizar la cuenta.";
      renderConnectionStatus();
    }).catch(function (error) {
      $("mlConfigFeedback").className = "msg error";
      $("mlConfigFeedback").textContent = error.message;
    }).then(function () { setBusy(button, false); });
  }
  function connectAccount() {
    var popup = window.open("about:blank", "mercadoLibreOAuth", "width=980,height=760");
    setBusy($("mlConnectBtn"), true, "Preparando...");
    request("/oauth-url", jsonOptions({})).then(function (result) {
      if (popup) popup.location.href = result.authorizationUrl;
      else window.open(result.authorizationUrl, "_blank", "noopener");
      $("mlConfigFeedback").className = "msg good";
      $("mlConfigFeedback").textContent = "Complete la autorizacion en Mercado Libre y luego pulse Actualizar estado.";
    }).catch(function (error) {
      if (popup) popup.close();
      $("mlConfigFeedback").className = "msg error";
      $("mlConfigFeedback").textContent = error.message;
    }).then(function () { setBusy($("mlConnectBtn"), false); });
  }

  function discoverProducts() {
    if (!bridge.isAdmin()) return;
    var button = $("mlDiscoverBtn");
    setBusy(button, true, "Evaluando...");
    Promise.all([bridge.all("products"), bridge.all("mlCandidates")]).then(function (sets) {
      var active = sets[0].filter(function (product) { return product.active !== false; });
      var existing = {};
      sets[1].forEach(function (candidate) { existing[candidate.productId] = candidate; });
      var created = [];
      var refreshed = [];
      active.forEach(function (product) {
        if (!existing[product.id]) {
          created.push(buildCandidate(product));
          return;
        }
        var candidate = Object.assign({}, existing[product.id]);
        var inferredPackaging = inferPackaging(product);
        var currentCost = knownUnitCost(product);
        candidate.sourceName = productName(product);
        candidate.sourceBrand = productBrand(product);
        candidate.sourceCategory = productCategory(product);
        candidate.sourceBarcode = String(product.barcode || "").trim();
        candidate.sourceUnit = productSaleUnit(product);
        candidate.localPrice = Number(product.price || 0);
        candidate.physicalStock = Number(product.stock || 0);
        candidate.knownUnitCost = currentCost;
        candidate.costReliability = currentCost == null ? "UNKNOWN" : "KNOWN";
        if (!candidate.packagingConfirmed) {
          candidate.packagingStatus = inferredPackaging.status;
          candidate.packagingInference = inferredPackaging.reason;
        }
        var demandAdjustment = ({ Alta: 12, Media: 8, Baja: 3, "Sin evidencia": -4 })[candidate.demandLabel] || 0;
        candidate.score = Math.max(0, Math.min(100, scoreCandidate(product, { status: candidate.packagingStatus }) + demandAdjustment));
        candidate.issues = initialIssues(product, { status: candidate.packagingStatus });
        candidate.updatedAt = nowIso();
        refreshed.push(candidate);
      });
      return bridge.addMany("mlCandidates", created.concat(refreshed)).then(function () {
        return bridge.audit("ML_CANDIDATES_DISCOVERED", created.length + " nuevos; " + refreshed.length + " actualizados", "normal");
      }).then(function () {
        notify(created.length ? created.length + " candidatos nuevos creados" : "Candidatos actualizados sin duplicados");
        return render();
      });
    }).catch(function (error) { notify(error.message); }).then(function () { setBusy(button, false); });
  }

  function render() {
    if (!bridge || !bridge.isAdmin()) return Promise.resolve();
    var sequence = ++renderSequence;
    return Promise.all([
      bridge.all("products"),
      bridge.all("mlCandidates"),
      bridge.all("mlListings"),
      bridge.all("mlResearch")
    ]).then(function (sets) {
      if (sequence !== renderSequence) return;
      products = sets[0];
      candidates = sets[1];
      listings = sets[2];
      researchRows = sets[3];
      productById = {};
      products.forEach(function (product) { productById[product.id] = product; });
      renderWorkflowTabs();
      renderSummary();
      renderCandidateList();
      if (activeCandidate) {
        activeCandidate = candidates.filter(function (candidate) { return candidate.id === activeCandidate.id; })[0] || null;
        if (activeCandidate && !$("mlReviewModal").classList.contains("hidden")) populateReview(activeCandidate);
      }
    });
  }
  function counts() {
    return {
      candidates: candidates.filter(function (candidate) { return ["DISCOVERED", "RESEARCHING"].indexOf(candidate.state) >= 0; }).length,
      review: candidates.filter(function (candidate) { return ["NEEDS_REVIEW", "APPROVED", "PREPARING"].indexOf(candidate.state) >= 0; }).length,
      ready: candidates.filter(function (candidate) { return candidate.state === "READY"; }).length,
      published: candidates.filter(function (candidate) { return candidate.state === "PUBLISHED"; }).length,
      problems: candidates.filter(function (candidate) { return ["REJECTED", "PAUSED", "ERROR"].indexOf(candidate.state) >= 0; }).length
    };
  }
  function renderWorkflowTabs() {
    var totals = counts();
    Object.keys(totals).forEach(function (key) {
      var id = "mlCount" + key.charAt(0).toUpperCase() + key.slice(1);
      if ($(id)) $(id).textContent = totals[key];
    });
    document.querySelectorAll("#mlWorkflowTabs [data-ml-view]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.mlView === activeView);
    });
    $("mlSummaryPanel").classList.toggle("hidden", activeView !== "summary");
    $("mlListPanel").classList.toggle("hidden", activeView === "summary");
    if (activeView !== "summary") {
      var copy = viewCopy(activeView);
      $("mlListTitle").textContent = copy[0];
      $("mlListSubtitle").textContent = copy[1];
    }
  }
  function renderSummary() {
    var totals = counts();
    var unknownCost = candidates.filter(function (candidate) { return candidateCost(candidate) == null; }).length;
    var fractional = candidates.filter(function (candidate) { return candidate.packagingStatus === "fractional" || candidate.packagingStatus === "unknown"; }).length;
    var drift = candidates.filter(function (candidate) {
      var listing = listingFor(candidate.id);
      return listing && Number(listing.remoteAvailableQuantity) !== mlAvailableStock(candidate);
    }).length;
    $("mlSummaryCards").innerHTML = [
      ["Candidatos totales", candidates.length, "Productos evaluados sin afectar el POS", "neutral"],
      ["Necesitan revision", totals.review, "Decisiones o datos pendientes", totals.review ? "warn" : "good"],
      ["Listos", totals.ready, "Esperan aprobacion PUBLICAR", totals.ready ? "good" : "neutral"],
      ["Publicados", totals.published, "Items con ID de Mercado Libre", "good"],
      ["Costo desconocido", unknownCost, "Margen no confiable", unknownCost ? "warn" : "good"],
      ["Stock para revisar", fractional, "Fraccionado o envase incierto", fractional ? "warn" : "good"],
      ["Diferencias de stock", drift, "Nunca se sincronizan automaticamente", drift ? "bad" : "good"]
    ].map(function (item) {
      return "<article class='ml-summary-card " + item[3] + "'><span>" + safe(item[0]) + "</span><b>" + safe(item[1]) + "</b><small>" + safe(item[2]) + "</small></article>";
    }).join("");
    var attention = candidates.filter(function (candidate) {
      return ["NEEDS_REVIEW", "ERROR"].indexOf(candidate.state) >= 0 || candidateCost(candidate) == null || candidate.packagingStatus === "fractional" || candidate.packagingStatus === "unknown";
    }).sort(function (a, b) { return Number(a.score || 0) - Number(b.score || 0); }).slice(0, 8);
    $("mlAttentionList").innerHTML = attention.length ? attention.map(function (candidate) {
      var problem = (candidate.blockingIssues || candidate.issues || [])[0] || "Revisar propuesta";
      return "<button type='button' data-ml-open='" + safe(candidate.id) + "'><span><b>" + safe(candidate.sourceName) + "</b><small>" + safe(problem) + "</small></span><strong>Revisar</strong></button>";
    }).join("") : "<div class='empty'>No hay alertas pendientes. Use Evaluar productos para actualizar candidatos.</div>";
  }
  function filteredCandidates() {
    var states = viewStates(activeView);
    var query = normalize($("mlSearchInput") && $("mlSearchInput").value || "");
    var rows = candidates.filter(function (candidate) {
      if (states.indexOf(candidate.state) < 0) return false;
      if (!query) return true;
      var listing = listingFor(candidate.id);
      return normalize([candidate.sourceName, candidate.sourceBrand, candidate.sourceCategory, candidate.sourceBarcode, candidate.categoryId, candidate.categoryName, listing && listing.mlItemId].join(" ")).indexOf(query) >= 0;
    });
    var sort = $("mlSortSelect") ? $("mlSortSelect").value : "priority";
    rows.sort(function (a, b) {
      if (sort === "score") return Number(b.score || 0) - Number(a.score || 0);
      if (sort === "stock") return physicalStock(b) - physicalStock(a);
      if (sort === "price") return Number(b.sellingPrice || b.localPrice || 0) - Number(a.sellingPrice || a.localPrice || 0);
      if (sort === "updated") return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      var priority = { ERROR: 0, NEEDS_REVIEW: 1, READY: 2, RESEARCHING: 3, DISCOVERED: 4, APPROVED: 5, PREPARING: 6, PAUSED: 7, REJECTED: 8, PUBLISHED: 9 };
      return Number(priority[a.state] == null ? 99 : priority[a.state]) - Number(priority[b.state] == null ? 99 : priority[b.state]) || Number(b.score || 0) - Number(a.score || 0);
    });
    return rows;
  }
  function renderCandidateList() {
    if (activeView === "summary") return;
    var rows = filteredCandidates();
    $("mlCandidateList").innerHTML = rows.length ? rows.map(function (candidate) {
      var product = productById[candidate.productId];
      var listing = listingFor(candidate.id);
      var available = mlAvailableStock(candidate);
      var cost = candidateCost(candidate);
      var issueCount = (candidate.blockingIssues || candidate.issues || []).length;
      var packagingLabel = ({ sealed: "Sellado", fractional: "Fraccionado", mixed: "Mixto", unknown: "Sin confirmar" })[candidate.packagingStatus] || "Sin confirmar";
      var actions = "<button type='button' data-ml-open='" + safe(candidate.id) + "'>Abrir</button>";
      if (["DISCOVERED", "NEEDS_REVIEW", "ERROR"].indexOf(candidate.state) >= 0) actions += "<button type='button' class='primary' data-ml-research='" + safe(candidate.id) + "'>Investigar</button>";
      if (candidate.state === "READY") actions += "<button type='button' class='success' data-ml-preview='" + safe(candidate.id) + "'>Vista final</button>";
      if (listing && listing.mlItemId) actions += "<button type='button' data-ml-sync='" + safe(candidate.id) + "'>Consultar ML</button><button type='button' data-ml-stock-sync='" + safe(candidate.id) + "'>Sincronizar stock</button>";
      return "<article class='ml-candidate-row " + statusTone(candidate.state) + "'>"
        + "<div class='ml-product-cell'><b>" + safe(candidate.sourceName) + "</b><span>" + safe([candidate.sourceBrand, candidate.sourceCategory].filter(Boolean).join(" · ")) + "</span><small>" + safe(candidate.sourceBarcode || "Sin codigo") + " · " + safe(candidate.sourceUnit || "unidad") + "</small></div>"
        + "<div class='ml-evaluation-cell'><strong>" + safe(candidate.score || 0) + "/100</strong><span>" + safe(packagingLabel) + (candidate.packagingConfirmed ? " · confirmado" : " · revisar") + "</span><small>" + (cost == null ? "COSTO DESCONOCIDO" : "Costo " + money(cost)) + (issueCount ? " · " + issueCount + " alerta(s)" : "") + "</small></div>"
        + "<div class='ml-stock-cell'><span><b>" + decimal(physicalStock(candidate), 3) + "</b> fisico</span><span><b>" + Math.max(0, Math.floor(Number(candidate.mlMaxStock || 0))) + "</b> maximo ML</span><span><b>" + available + "</b> disponible ML</span></div>"
        + "<div class='ml-state-cell'><span class='ml-state-pill " + statusTone(candidate.state) + "'>" + safe(WORKFLOW[candidate.state] || candidate.state) + "</span>" + (listing && listing.mlItemId ? "<small>" + safe(listing.mlItemId) + "</small>" : "") + "</div>"
        + "<div class='ml-row-actions'>" + actions + "</div></article>";
    }).join("") : "<div class='empty'>No hay registros en esta etapa.</div>";
  }
  function setView(view) {
    activeView = view || "summary";
    renderWorkflowTabs();
    renderCandidateList();
  }

  function findCandidate(id) { return candidates.filter(function (candidate) { return candidate.id === id; })[0] || null; }
  function openReview(id) {
    var candidate = findCandidate(id);
    if (!candidate) return;
    activeCandidate = Object.assign({}, candidate);
    populateReview(activeCandidate);
    $("mlReviewModal").classList.remove("hidden");
  }
  function closeReview() {
    $("mlReviewModal").classList.add("hidden");
    activeCandidate = null;
  }
  function reviewDecision(candidate) {
    if (candidate.state === "REJECTED") return "REJECT";
    if (candidate.state === "PAUSED") return "PAUSE";
    if (["APPROVED", "PREPARING", "READY", "PUBLISHED"].indexOf(candidate.state) >= 0) return "APPROVE";
    return "PENDING";
  }
  function calculateCandidateIssues(candidate) {
    var issues = [];
    var product = productById[candidate.productId];
    if (!product || product.active === false) issues.push("El producto ya no esta activo en el POS.");
    if (!(physicalStock(candidate) > 0)) issues.push("No hay stock fisico disponible.");
    if (!(Number(candidate.sellingPrice || 0) > 0)) issues.push("Falta decidir el precio de venta ML.");
    if (!(Number(candidate.mlMaxStock || 0) > 0)) issues.push("El limite de stock ML esta en cero.");
    if (Number(candidate.mlReservedStock || 0) > Number(candidate.mlMaxStock || 0)) issues.push("El stock reservado supera el maximo ML.");
    if (!candidate.packagingConfirmed) issues.push("El envase no fue confirmado fisicamente.");
    if (candidate.packagingStatus === "fractional") issues.push("No se puede publicar stock fraccionado como si fuera un paquete cerrado.");
    if (candidate.packagingStatus === "unknown") issues.push("El estado del envase es desconocido.");
    if (!candidate.categoryId) issues.push("Falta la categoria de Mercado Libre.");
    if (!String(candidate.listingTitle || "").trim()) issues.push("Falta el titulo de la publicacion.");
    if (!String(candidate.description || "").trim()) issues.push("Falta la descripcion.");
    if (!(candidate.imageRefs || []).length) issues.push("Falta al menos una foto propia o autorizada.");
    if (!(Number(candidate.billableWeightGrams || 0) > 0)) issues.push("Falta el peso facturable real para estimar costos de venta.");
    if (candidate.conditionalAttributeWarning) issues.push("No se pudieron validar los atributos condicionales: " + candidate.conditionalAttributeWarning);
    (candidate.requiredAttributes || []).forEach(function (attribute) {
      if (!attribute.required) return;
      var value = candidate.attributeValues && candidate.attributeValues[attribute.id];
      if (value === null || value === undefined || String(value).trim() === "") issues.push("Falta atributo obligatorio: " + attribute.name + ".");
    });
    return issues.filter(function (message, index, rows) { return rows.indexOf(message) === index; });
  }
  function populateReview(candidate) {
    var product = productById[candidate.productId];
    var research = researchFor(candidate.id);
    $("mlReviewTitle").textContent = candidate.sourceName || productName(product);
    $("mlReviewMeta").textContent = [candidate.sourceBrand, candidate.sourceCategory, candidate.sourceBarcode || "Sin codigo"].filter(Boolean).join(" · ");
    $("mlReviewState").textContent = WORKFLOW[candidate.state] || candidate.state;
    $("mlReviewState").className = "ml-state-pill " + statusTone(candidate.state);
    $("mlReviewScore").textContent = String(candidate.score || 0);
    $("mlDecision").value = reviewDecision(candidate);
    $("mlSellingPrice").value = candidate.sellingPrice || candidate.suggestedPrice || "";
    $("mlOfferType").value = candidate.offerType || "individual";
    $("mlPackUnits").value = Math.max(1, Math.floor(Number(candidate.packUnits || 1)));
    $("mlPackagingStatus").value = candidate.packagingStatus || "unknown";
    $("mlPackagingConfirmed").checked = candidate.packagingConfirmed === true;
    $("mlMaxStock").value = Math.max(0, Math.floor(Number(candidate.mlMaxStock || 0)));
    $("mlReservedStock").value = Math.max(0, Math.floor(Number(candidate.mlReservedStock || 0)));
    $("mlListingTitle").value = candidate.listingTitle || buildListingTitle(candidate);
    $("mlCategoryId").value = candidate.categoryId || "";
    $("mlCategoryName").textContent = candidate.categoryName || "Sin categoria confirmada";
    $("mlListingType").value = candidate.listingTypeId || "gold_special";
    $("mlBillableWeight").value = candidate.billableWeightGrams || "";
    $("mlMinimumPrice").value = candidate.minimumViablePrice ? money(candidate.minimumViablePrice) : "";
    $("mlDescription").value = candidate.description || buildDescription(candidate);
    updatePackUi();
    updateStockEquation();
    renderResearchSummary(candidate, research);
    renderIssues(candidate);
    renderAttributes(candidate);
    renderImages(candidate);
    renderPackageChecklist(candidate);
    $("mlOpenPreviewBtn").disabled = candidate.state !== "READY";
  }
  function updatePackUi() {
    var multipack = $("mlOfferType").value === "multipack";
    $("mlPackUnitsLabel").classList.toggle("hidden", !multipack);
    if (!multipack) $("mlPackUnits").value = "1";
  }
  function updateStockEquation() {
    if (!activeCandidate) return;
    var draft = Object.assign({}, activeCandidate, {
      mlMaxStock: Math.max(0, Math.floor(Number($("mlMaxStock").value || 0))),
      mlReservedStock: Math.max(0, Math.floor(Number($("mlReservedStock").value || 0)))
    });
    var physical = physicalStock(draft);
    var available = mlAvailableStock(draft);
    $("mlStockEquation").innerHTML = "<span>Stock fisico <b>" + decimal(physical, 3) + "</b></span><i>min</i><span>Tope ML <b>" + draft.mlMaxStock + "</b></span><i>−</i><span>Reservado <b>" + draft.mlReservedStock + "</b></span><i>=</i><strong>Disponible ML " + available + "</strong>";
  }
  function buildListingTitle(candidate) {
    var name = String(candidate.sourceName || "").trim();
    var brand = String(candidate.sourceBrand || "").trim();
    var title = name;
    if (brand && normalize(name).indexOf(normalize(brand)) !== 0) title = brand + " " + name;
    if (candidate.offerType === "multipack" && Number(candidate.packUnits || 1) > 1) title += " Pack X" + Math.floor(Number(candidate.packUnits));
    return title.replace(/\s+/g, " ").trim().slice(0, 60);
  }
  function buildDescription(candidate) {
    var lines = ["Producto: " + candidate.sourceName];
    if (candidate.sourceBrand) lines.push("Marca: " + candidate.sourceBrand);
    if (candidate.sourceBarcode) lines.push("Codigo universal: " + candidate.sourceBarcode);
    if (candidate.offerType === "multipack" && Number(candidate.packUnits || 1) > 1) lines.push("Contenido de la publicacion: " + Math.floor(Number(candidate.packUnits)) + " unidades.");
    lines.push("Producto nuevo. La publicacion corresponde exactamente a la cantidad indicada.");
    lines.push("Consulte cualquier duda antes de comprar.");
    return lines.join("\n");
  }
  function readFormCandidate() {
    var candidate = Object.assign({}, activeCandidate);
    var price = parseLocalizedNumber($("mlSellingPrice").value);
    if (!isFinite(price)) price = 0;
    candidate.sellingPrice = Math.max(0, Math.round(price * 100) / 100);
    candidate.offerType = $("mlOfferType").value;
    candidate.packUnits = candidate.offerType === "multipack" ? Math.max(1, Math.floor(Number($("mlPackUnits").value || 1))) : 1;
    candidate.packagingStatus = $("mlPackagingStatus").value;
    candidate.packagingConfirmed = $("mlPackagingConfirmed").checked;
    candidate.mlMaxStock = Math.max(0, Math.floor(Number($("mlMaxStock").value || 0)));
    candidate.mlReservedStock = Math.max(0, Math.floor(Number($("mlReservedStock").value || 0)));
    candidate.listingTitle = $("mlListingTitle").value.trim().slice(0, 60);
    candidate.categoryId = $("mlCategoryId").value.trim().toUpperCase();
    candidate.listingTypeId = $("mlListingType").value;
    candidate.billableWeightGrams = Math.max(0, Math.floor(Number($("mlBillableWeight").value || 0)));
    candidate.description = $("mlDescription").value.trim();
    candidate.attributeValues = Object.assign({}, candidate.attributeValues || {});
    document.querySelectorAll("#mlAttributesList [data-ml-attribute]").forEach(function (field) {
      candidate.attributeValues[field.dataset.mlAttribute] = field.value;
    });
    candidate.physicalStock = physicalStock(candidate);
    candidate.updatedAt = nowIso();
    candidate.updatedBy = bridge.getCurrentUser() && bridge.getCurrentUser().id;
    return candidate;
  }
  function persistReview(options) {
    options = options || {};
    if (!activeCandidate) return Promise.reject(new Error("No hay candidato abierto"));
    var candidate = readFormCandidate();
    var decision = options.decision || $("mlDecision").value;
    if (decision === "REJECT") candidate.state = "REJECTED";
    else if (decision === "PAUSE") candidate.state = "PAUSED";
    else if (options.approve || decision === "APPROVE") candidate.state = "APPROVED";
    else if (["REJECTED", "PAUSED"].indexOf(candidate.state) >= 0) candidate.state = "NEEDS_REVIEW";
    candidate.blockingIssues = calculateCandidateIssues(candidate);
    return bridge.add("mlCandidates", candidate).then(function () {
      activeCandidate = candidate;
      return bridge.audit(options.auditAction || "ML_CANDIDATE_REVIEWED", candidate.id + " · " + candidate.state, options.approve ? "important" : "normal");
    }).then(function () {
      if (!options.quiet) notify("Revision guardada");
      return render();
    }).then(function () { return candidate; });
  }
  function approveCandidate() {
    var candidate = readFormCandidate();
    var basics = [];
    if (!candidate.packagingConfirmed || ["sealed", "mixed"].indexOf(candidate.packagingStatus) < 0) basics.push("Confirme un envase cerrado o mixto preparado como paquete.");
    if (!(candidate.sellingPrice > 0)) basics.push("Defina el precio ML.");
    if (!(candidate.mlMaxStock > 0)) basics.push("Defina una cantidad maxima para ML.");
    if (!candidate.categoryId) basics.push("Confirme una categoria.");
    if (basics.length) { notify(basics[0]); renderIssues(Object.assign(candidate, { blockingIssues: basics })); return; }
    $("mlDecision").value = "APPROVE";
    persistReview({ approve: true, auditAction: "ML_CANDIDATE_APPROVED" });
  }
  function renderResearchSummary(candidate, research) {
    var ai = candidate.aiSuggestion || null;
    if (!research) {
      $("mlResearchSummary").innerHTML = "<div class='empty'>Todavia no se investigo este producto en Mercado Libre.</div>" + renderAiInsights(ai);
      return;
    }
    $("mlResearchSummary").innerHTML = "<div><span>Demanda probable</span><b>" + safe(research.demandLabel || "Sin determinar") + "</b></div>"
      + "<div><span>Resultados comparables</span><b>" + Number(research.sampleSize || 0) + "</b></div>"
      + "<div><span>Precio mediano</span><b>" + (research.medianPrice ? money(research.medianPrice) : "Sin dato") + "</b></div>"
      + "<div><span>Ventas visibles en muestra</span><b>" + decimal(research.visibleSoldQuantity || 0, 0) + "</b></div>"
      + "<p>Estimacion orientativa basada en publicaciones comparables; no garantiza demanda ni rentabilidad.</p>" + renderAiInsights(ai);
  }
  function renderAiInsights(ai) {
    if (!ai) return "";
    var bundles = ai.virtualBundleIdeas || [];
    var images = ai.imageChecklist || [];
    return "<section class='ml-ai-insights'><div><span>Evaluacion IA</span><b>" + safe(ai.worthListing === false ? "Candidato debil" : "Potencial para revisar") + " · " + safe(ai.confidence || "confianza baja") + "</b></div>"
      + "<p>" + safe(ai.reasoningSummary || "Borrador preparado para revision.") + "</p>"
      + (Number(ai.recommendedOnlineQuantity) > 0 ? "<p><b>Cantidad sugerida:</b> " + Math.floor(Number(ai.recommendedOnlineQuantity)) + " (el administrador debe decidirla)</p>" : "")
      + (bundles.length ? "<p><b>Ideas de kits:</b> " + safe(bundles.join(" · ")) + "</p>" : "")
      + (images.length ? "<p><b>Fotos a preparar:</b> " + safe(images.join(" · ")) + "</p>" : "") + "</section>";
  }
  function renderIssues(candidate) {
    var issues = candidate.blockingIssues && candidate.blockingIssues.length ? candidate.blockingIssues : candidate.issues || [];
    $("mlIssuesList").innerHTML = issues.length ? "<h3>Falta revisar</h3>" + issues.map(function (issue) { return "<div><span>!</span>" + safe(issue) + "</div>"; }).join("") : "<div class='ml-no-issues'>Sin alertas detectadas en esta etapa.</div>";
  }
  function summarizeResearch(candidate, result) {
    var prices = (result.results || []).map(function (row) { return Number(row.price || 0); }).filter(function (price) { return price > 0; }).sort(function (a, b) { return a - b; });
    var median = prices.length ? (prices.length % 2 ? prices[(prices.length - 1) / 2] : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2) : 0;
    var sold = (result.results || []).reduce(function (total, row) { return total + Math.max(0, Number(row.soldQuantity || 0)); }, 0);
    var demand = sold >= 80 ? "Alta" : sold >= 20 ? "Media" : sold > 0 ? "Baja" : "Sin evidencia";
    return {
      id: uid(), candidateId: candidate.id, query: result.query || candidate.sourceName,
      categoryPredictions: result.predictions || [], sampleSize: prices.length,
      minimumPrice: prices.length ? prices[0] : null,
      maximumPrice: prices.length ? prices[prices.length - 1] : null,
      medianPrice: median || null, visibleSoldQuantity: sold, demandLabel: demand,
      comparableListings: (result.results || []).slice(0, 12).map(function (row) {
        return { id: row.id, title: row.title, price: row.price, soldQuantity: row.soldQuantity, categoryId: row.categoryId, listingTypeId: row.listingTypeId, permalink: row.permalink };
      }),
      createdAt: nowIso()
    };
  }
  function researchCandidate(id) {
    var original = findCandidate(id || activeCandidate && activeCandidate.id);
    if (!original) return;
    var button = activeCandidate && original.id === activeCandidate.id ? $("mlResearchBtn") : null;
    setBusy(button, true, "Investigando...");
    var candidate = Object.assign({}, original, { state: "RESEARCHING", updatedAt: nowIso() });
    bridge.add("mlCandidates", candidate).then(function () {
      return request("/research", jsonOptions({ query: buildListingTitle(candidate) || candidate.sourceName, categoryId: candidate.categoryId || "" }));
    }).then(function (result) {
      var research = summarizeResearch(candidate, result);
      var prediction = (result.predictions || [])[0] || null;
      if (prediction) {
        candidate.categoryId = candidate.categoryId || prediction.categoryId;
        candidate.categoryName = candidate.categoryName || prediction.categoryName;
        candidate.domainId = prediction.domainId || candidate.domainId;
      }
      candidate.researchId = research.id;
      candidate.demandLabel = research.demandLabel;
      candidate.competitionMedianPrice = research.medianPrice;
      candidate.score = Math.max(0, Math.min(100, Number(candidate.score || 0) + (research.visibleSoldQuantity >= 20 ? 12 : research.visibleSoldQuantity > 0 ? 5 : -4)));
      if (!(candidate.sellingPrice > 0)) candidate.suggestedPrice = research.medianPrice || candidate.localPrice || null;
      if (candidate.offerType !== "multipack" && research.medianPrice && candidate.localPrice > 0 && candidate.localPrice < research.medianPrice * 0.45 && candidate.packagingStatus === "sealed") {
        candidate.offerType = "multipack";
        candidate.packUnits = Math.max(2, Math.min(6, Math.round(research.medianPrice / candidate.localPrice)));
        candidate.suggestedPrice = Math.round(candidate.localPrice * candidate.packUnits);
      }
      candidate.listingTitle = buildListingTitle(candidate);
      candidate.description = buildDescription(candidate);
      candidate.state = "NEEDS_REVIEW";
      candidate.updatedAt = nowIso();
      candidate.issues = initialIssues(productById[candidate.productId] || candidate, { status: candidate.packagingStatus });
      return Promise.all([bridge.add("mlResearch", research), bridge.add("mlCandidates", candidate)]).then(function () {
        return bridge.audit("ML_CANDIDATE_RESEARCHED", candidate.id + " · " + research.sampleSize + " comparables", "normal");
      });
    }).then(function () {
      notify("Investigacion completada; revise la propuesta");
      return render();
    }).then(function () {
      openReview(candidate.id);
    }).catch(function (error) {
      candidate.state = "ERROR";
      candidate.lastError = error.message;
      candidate.blockingIssues = [error.message];
      candidate.updatedAt = nowIso();
      bridge.add("mlCandidates", candidate).then(render);
      notify(error.message);
    }).then(function () { setBusy(button, false); });
  }
  function predictCategory() {
    if (!activeCandidate) return;
    var title = $("mlListingTitle").value.trim() || activeCandidate.sourceName;
    setBusy($("mlPredictCategoryBtn"), true, "Buscando...");
    request("/research", jsonOptions({ query: title, categoryOnly: true })).then(function (result) {
      var prediction = (result.predictions || [])[0];
      if (!prediction) throw new Error("Mercado Libre no devolvio una categoria sugerida");
      $("mlCategoryId").value = prediction.categoryId || "";
      $("mlCategoryName").textContent = prediction.categoryName || prediction.categoryId || "Categoria sugerida";
      activeCandidate.categoryId = prediction.categoryId;
      activeCandidate.categoryName = prediction.categoryName;
      activeCandidate.domainId = prediction.domainId;
      notify("Categoria sugerida; confirme que sea correcta");
    }).catch(function (error) { notify(error.message); }).then(function () { setBusy($("mlPredictCategoryBtn"), false); });
  }
  function assistCandidateWithAi() {
    if (!activeCandidate) return;
    var button = $("mlAiAssistBtn");
    setBusy(button, true, "Analizando...");
    persistReview({ quiet: true }).then(function (candidate) {
      var research = researchFor(candidate.id);
      return request("/assist", jsonOptions({
        candidate: {
          name: candidate.sourceName,
          brand: candidate.sourceBrand || null,
          posCategory: candidate.sourceCategory || null,
          barcode: candidate.sourceBarcode || null,
          saleUnit: candidate.sourceUnit,
          localPrice: candidate.localPrice > 0 ? candidate.localPrice : null,
          physicalStock: physicalStock(candidate),
          packagingStatus: candidate.packagingStatus,
          packagingConfirmed: candidate.packagingConfirmed,
          knownUnitCost: candidateCost(candidate),
          costState: candidateCost(candidate) == null ? "UNKNOWN" : "KNOWN",
          currentOfferType: candidate.offerType,
          currentPackUnits: candidate.packUnits
        },
        mercadoLibreResearch: research ? {
          categoryPredictions: research.categoryPredictions || [],
          sampleSize: research.sampleSize,
          minimumPrice: research.minimumPrice,
          maximumPrice: research.maximumPrice,
          medianPrice: research.medianPrice,
          visibleSoldQuantity: research.visibleSoldQuantity,
          demandLabel: research.demandLabel,
          comparableListings: research.comparableListings || []
        } : null
      })).then(function (result) { return { candidate: candidate, result: result }; });
    }).then(function (outcome) {
      var candidate = outcome.candidate;
      var suggestion = outcome.result && outcome.result.suggestion;
      if (!suggestion) throw new Error("El asistente no devolvio una propuesta valida");
      candidate.aiSuggestion = suggestion;
      candidate.aiModel = outcome.result.model || "";
      candidate.aiPreparedAt = nowIso();
      if (suggestion.title) candidate.listingTitle = String(suggestion.title).slice(0, 60);
      if (suggestion.description) candidate.description = String(suggestion.description);
      if (!(candidate.sellingPrice > 0) && Number(suggestion.suggestedPrice) > 0) candidate.suggestedPrice = Number(suggestion.suggestedPrice);
      if (suggestion.offerType === "multipack" || suggestion.offerType === "individual") candidate.offerType = suggestion.offerType;
      if (candidate.offerType === "multipack" && Number(suggestion.packUnits) >= 2) candidate.packUnits = Math.floor(Number(suggestion.packUnits));
      candidate.aiWarnings = [].concat(suggestion.warnings || [], suggestion.missingInformation || []);
      candidate.issues = (candidate.issues || []).concat(candidate.aiWarnings).filter(function (message, index, rows) { return message && rows.indexOf(message) === index; });
      if (["DISCOVERED", "RESEARCHING", "ERROR"].indexOf(candidate.state) >= 0) candidate.state = "NEEDS_REVIEW";
      candidate.updatedAt = nowIso();
      return bridge.add("mlCandidates", candidate).then(function () {
        activeCandidate = candidate;
        return bridge.audit("ML_AI_DRAFT_PREPARED", candidate.id + " · " + (candidate.aiModel || "modelo configurado"), "normal");
      });
    }).then(function () {
      populateReview(activeCandidate);
      notify("Borrador de IA preparado; revise cada dato antes de aprobar");
      return render();
    }).catch(function (error) { notify(error.message); }).then(function () { setBusy(button, false); });
  }
  function simplifyAttribute(attribute, technicalRequired) {
    var tags = attribute.tags || {};
    return {
      id: attribute.id,
      name: attribute.name || attribute.id,
      valueType: attribute.value_type || "string",
      values: (attribute.values || []).slice(0, 250).map(function (value) { return { id: value.id || "", name: value.name || value.id || "" }; }),
      required: tags.required === true || tags.new_required === true || tags.catalog_listing_required === true || technicalRequired === true,
      conditional: tags.conditional_required === true,
      readOnly: tags.read_only === true || tags.fixed === true,
      defaultUnit: attribute.default_unit || "",
      allowedUnits: attribute.allowed_units || []
    };
  }
  function loadRequirements() {
    if (!activeCandidate) return Promise.reject(new Error("No hay candidato abierto"));
    return persistReview({ quiet: true }).then(function (candidate) {
      if (!candidate.categoryId) throw new Error("Primero seleccione una categoria de Mercado Libre");
      candidate.state = "PREPARING";
      return bridge.add("mlCandidates", candidate).then(function () {
        return request("/categories/" + encodeURIComponent(candidate.categoryId) + "/attributes");
      }).then(function (response) {
        var technicalRequired = {};
        (response.technicalRequiredIds || []).forEach(function (id) { technicalRequired[id] = true; });
        var definitions = (response.attributes || []).map(function (attribute) { return simplifyAttribute(attribute, technicalRequired[attribute.id]); });
        var byId = {};
        definitions.forEach(function (definition) { byId[definition.id] = definition; });
        (response.technicalAttributes || []).forEach(function (attribute) {
          if (!byId[attribute.id]) definitions.push(simplifyAttribute(attribute, technicalRequired[attribute.id]));
        });
        candidate.requiredAttributes = definitions.filter(function (definition) { return definition.required || definition.conditional; });
        candidate.attributeValues = Object.assign({}, candidate.attributeValues || {});
        candidate.requiredAttributes.forEach(function (attribute) {
          if (candidate.attributeValues[attribute.id]) return;
          if (attribute.id === "BRAND" && candidate.sourceBrand) candidate.attributeValues[attribute.id] = candidate.sourceBrand;
          else if (/^GTIN/.test(attribute.id) && candidate.sourceBarcode) candidate.attributeValues[attribute.id] = candidate.sourceBarcode;
        });
        candidate.updatedAt = nowIso();
        return bridge.add("mlCandidates", candidate);
      }).then(function () {
        activeCandidate = candidate;
        populateReview(candidate);
        notify("Requisitos de la categoria cargados en vivo");
        return candidate;
      });
    });
  }
  function renderAttributes(candidate) {
    var definitions = candidate.requiredAttributes || [];
    if (!definitions.length) {
      $("mlAttributesList").innerHTML = "<div class='empty'>Cargue los requisitos despues de confirmar la categoria.</div>";
      return;
    }
    $("mlAttributesList").innerHTML = definitions.map(function (attribute) {
      var value = candidate.attributeValues && candidate.attributeValues[attribute.id] || "";
      var control;
      if (attribute.values && attribute.values.length) {
        var matched = attribute.values.filter(function (option) { return String(option.id) === String(value) || normalize(option.name) === normalize(value); })[0];
        control = "<select data-ml-attribute='" + safe(attribute.id) + "'><option value=''>Seleccionar...</option>" + attribute.values.map(function (option) {
          return "<option value='" + safe(option.id || option.name) + "'" + (matched && matched.id === option.id ? " selected" : "") + ">" + safe(option.name) + "</option>";
        }).join("") + "</select>";
      } else {
        control = "<input data-ml-attribute='" + safe(attribute.id) + "' value='" + safe(value) + "' placeholder='Dato verificable'>";
      }
      return "<label class='" + (attribute.required ? "required" : "") + "'><span>" + safe(attribute.name) + (attribute.required ? " *" : "") + "</span>" + control + "<small>" + safe(attribute.id) + (attribute.conditional ? " · condicional" : "") + "</small></label>";
    }).join("");
  }
  function feeBody(candidate) {
    return {
      categoryId: candidate.categoryId,
      price: candidate.sellingPrice,
      currencyId: "ARS",
      listingTypeId: candidate.listingTypeId || "gold_special",
      shippingMode: "me2",
      logisticType: "drop_off",
      billableWeight: candidate.billableWeightGrams
    };
  }
  function loadConditionalRequirements(candidate) {
    var body = {
      title: candidate.listingTitle,
      category_id: candidate.categoryId,
      price: Number(candidate.sellingPrice),
      currency_id: "ARS",
      available_quantity: Math.max(1, mlAvailableStock(candidate)),
      buying_mode: "buy_it_now",
      condition: "new",
      listing_type_id: candidate.listingTypeId || "gold_special",
      attributes: attributePayload(candidate)
    };
    return request("/categories/" + encodeURIComponent(candidate.categoryId) + "/conditional", jsonOptions(body)).then(function (result) {
      var required = result.required_attributes || result.requiredAttributes || [];
      var definitions = (candidate.requiredAttributes || []).slice();
      required.forEach(function (attribute) {
        var existing = definitions.filter(function (definition) { return definition.id === attribute.id; })[0];
        if (existing) existing.required = true;
        else definitions.push({ id: attribute.id, name: attribute.name || attribute.id, valueType: "string", values: [], required: true, conditional: true, readOnly: false });
      });
      candidate.requiredAttributes = definitions;
      candidate.conditionalAttributeWarning = "";
      return candidate;
    });
  }
  function prepareFinal() {
    var button = $("mlPrepareBtn");
    setBusy(button, true, "Preparando...");
    var promise = (activeCandidate.requiredAttributes || []).length ? persistReview({ quiet: true }) : loadRequirements();
    promise.then(function () { return persistReview({ quiet: true }); }).then(function (candidate) {
      activeCandidate = candidate;
      if (!(candidate.billableWeightGrams > 0)) throw new Error("Ingrese el peso facturable real; no se puede inventar para calcular los cargos.");
      return loadConditionalRequirements(candidate).catch(function (error) {
        candidate.conditionalAttributeWarning = error.message;
        return candidate;
      }).then(function () { return request("/fees", jsonOptions(feeBody(candidate))); }).then(function (fees) {
        candidate.feeEstimate = fees.selected || null;
        candidate.feeEstimatedAt = nowIso();
        candidate.feeEstimateInputs = feeBody(candidate);
        var cost = candidateCost(candidate);
        if (cost != null && candidate.feeEstimate) {
          var packCost = cost * Math.max(1, Number(candidate.packUnits || 1));
          candidate.minimumViablePrice = Math.ceil((packCost * 1.15 + Number(candidate.feeEstimate.saleFeeAmount || 0)) / 10) * 10;
        } else {
          candidate.minimumViablePrice = null;
        }
        candidate.blockingIssues = calculateCandidateIssues(candidate);
        candidate.state = candidate.blockingIssues.length ? "NEEDS_REVIEW" : "READY";
        candidate.updatedAt = nowIso();
        return bridge.add("mlCandidates", candidate);
      });
    }).then(function () {
      return bridge.audit("ML_LISTING_PREPARED", activeCandidate.id, "important");
    }).then(function () {
      notify(activeCandidate.state === "READY" ? "Publicacion lista para la vista final" : "La preparacion encontro datos pendientes");
      return render();
    }).then(function () {
      openReview(activeCandidate.id);
    }).catch(function (error) {
      if (activeCandidate) {
        activeCandidate.blockingIssues = calculateCandidateIssues(activeCandidate).concat([error.message]).filter(function (message, index, rows) { return rows.indexOf(message) === index; });
        activeCandidate.state = "NEEDS_REVIEW";
        bridge.add("mlCandidates", activeCandidate).then(render);
        renderIssues(activeCandidate);
      }
      notify(error.message);
    }).then(function () { setBusy(button, false); });
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type || "")) { reject(new Error("Solo se aceptan imagenes JPEG, PNG o WebP")); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("No se pudo leer la imagen")); };
      reader.onload = function () {
        var image = new Image();
        image.onerror = function () { reject(new Error("La imagen no es valida")); };
        image.onload = function () {
          var maximum = 1800;
          var scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          var context = canvas.getContext("2d");
          context.fillStyle = "#fff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.9), fileName: String(file.name || "producto.jpg").replace(/[^A-Za-z0-9._-]+/g, "-") });
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function addImages(event) {
    if (!activeCandidate) return;
    var files = Array.prototype.slice.call(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if ((activeCandidate.imageRefs || []).length + files.length > 8) { notify("Mercado Libre admite una cantidad limitada; cargue hasta 8 fotos propias."); return; }
    var chain = Promise.resolve();
    files.forEach(function (file) {
      chain = chain.then(function () { return compressImage(file); }).then(function (image) {
        var imageId = "mli_" + uid();
        return request("/images/" + encodeURIComponent(activeCandidate.id) + "/" + encodeURIComponent(imageId), jsonOptions(image)).then(function (saved) {
          activeCandidate.imageRefs = (activeCandidate.imageRefs || []).concat([{ id: saved.id, fileName: saved.fileName, source: "ADMIN_UPLOAD", createdAt: saved.createdAt }]);
          activeCandidate.updatedAt = nowIso();
          return bridge.add("mlCandidates", activeCandidate);
        });
      });
    });
    chain.then(function () { renderImages(activeCandidate); renderPackageChecklist(activeCandidate); notify("Fotos propias guardadas localmente"); }).catch(function (error) { notify(error.message); });
  }
  function renderImages(candidate) {
    var refs = candidate.imageRefs || [];
    $("mlImagesList").innerHTML = refs.length ? refs.map(function (ref, index) {
      return "<article data-ml-image='" + safe(ref.id) + "'><div class='ml-image-preview' data-ml-image-preview='" + safe(ref.id) + "'><span>Cargando...</span></div><b>" + (index + 1) + ". " + safe(ref.fileName || "Foto propia") + "</b><div><button type='button' data-ml-image-up='" + safe(ref.id) + "'" + (index === 0 ? " disabled" : "") + ">↑</button><button type='button' data-ml-image-down='" + safe(ref.id) + "'" + (index === refs.length - 1 ? " disabled" : "") + ">↓</button><button type='button' class='danger-text' data-ml-image-remove='" + safe(ref.id) + "'>Quitar</button></div></article>";
    }).join("") : "<div class='empty'>Sin fotos. La publicacion no puede quedar lista.</div>";
    refs.forEach(function (ref) {
      request("/images/" + encodeURIComponent(ref.id)).then(function (response) {
        var preview = document.querySelector("[data-ml-image-preview='" + CSS.escape(ref.id) + "']");
        if (preview) preview.innerHTML = "<img src='" + safe(response.dataUrl) + "' alt='Foto propia del producto'>";
      }).catch(function () {});
    });
  }
  function changeImageOrder(id, direction) {
    if (!activeCandidate) return;
    var refs = (activeCandidate.imageRefs || []).slice();
    var index = refs.findIndex(function (ref) { return ref.id === id; });
    var target = index + direction;
    if (index < 0 || target < 0 || target >= refs.length) return;
    var moved = refs.splice(index, 1)[0];
    refs.splice(target, 0, moved);
    activeCandidate.imageRefs = refs;
    activeCandidate.updatedAt = nowIso();
    bridge.add("mlCandidates", activeCandidate).then(function () { renderImages(activeCandidate); });
  }
  function removeImage(id) {
    if (!activeCandidate) return;
    activeCandidate.imageRefs = (activeCandidate.imageRefs || []).filter(function (ref) { return ref.id !== id; });
    activeCandidate.updatedAt = nowIso();
    bridge.add("mlCandidates", activeCandidate).then(function () { renderImages(activeCandidate); renderPackageChecklist(activeCandidate); });
  }
  function renderPackageChecklist(candidate) {
    var checks = [
      [candidate.packagingConfirmed && ["sealed", "mixed"].indexOf(candidate.packagingStatus) >= 0, "Envase fisico confirmado"],
      [Number(candidate.mlMaxStock || 0) > 0, "Tope de stock online definido"],
      [Number(candidate.sellingPrice || 0) > 0, "Precio ML aprobado"],
      [Boolean(candidate.categoryId), "Categoria confirmada"],
      [(candidate.imageRefs || []).length > 0, "Fotos propias cargadas y ordenadas"],
      [Number(candidate.billableWeightGrams || 0) > 0, "Peso facturable real cargado"],
      [(candidate.requiredAttributes || []).length > 0, "Requisitos consultados en Mercado Libre"],
      [candidateCost(candidate) != null, "Costo conocido para margen confiable"]
    ];
    $("mlPackageChecklist").innerHTML = checks.map(function (check) {
      return "<div class='" + (check[0] ? "done" : "pending") + "'><span>" + (check[0] ? "✓" : "·") + "</span>" + safe(check[1]) + "</div>";
    }).join("");
  }

  function openFinalPreview(id) {
    var candidate = findCandidate(id || activeCandidate && activeCandidate.id);
    if (!candidate) return;
    candidate.blockingIssues = calculateCandidateIssues(candidate);
    if (candidate.state !== "READY" || candidate.blockingIssues.length) {
      notify(candidate.blockingIssues[0] || "La publicacion todavia no esta lista");
      if (activeCandidate) renderIssues(candidate);
      return;
    }
    activeCandidate = Object.assign({}, candidate);
    var fee = candidate.feeEstimate;
    var cost = candidateCost(candidate);
    var packCost = cost == null ? null : cost * Math.max(1, Number(candidate.packUnits || 1));
    var feeAmount = fee ? Number(fee.saleFeeAmount || 0) : null;
    var net = feeAmount == null ? null : Number(candidate.sellingPrice || 0) - feeAmount;
    var profit = packCost == null || net == null ? null : net - packCost;
    var margin = profit == null || !(Number(candidate.sellingPrice) > 0) ? null : profit / Number(candidate.sellingPrice) * 100;
    var attributes = (candidate.requiredAttributes || []).filter(function (attribute) { return candidate.attributeValues && candidate.attributeValues[attribute.id]; });
    $("mlFinalPreview").innerHTML = "<section class='ml-preview-main'><div id='mlPreviewImages' class='ml-preview-images'></div><div><span class='ml-state-pill good'>LISTO PARA PUBLICAR</span><h3>" + safe(candidate.listingTitle) + "</h3><p>" + safe(candidate.description).replace(/\n/g, "<br>") + "</p></div></section>"
      + "<section class='ml-preview-facts'><div><span>Categoria</span><b>" + safe(candidate.categoryName || candidate.categoryId) + "</b></div><div><span>Precio ML</span><b>" + money(candidate.sellingPrice) + "</b></div><div><span>Cantidad disponible</span><b>" + mlAvailableStock(candidate) + "</b></div><div><span>Formato</span><b>" + safe(candidate.offerType === "multipack" ? "Pack x" + candidate.packUnits : "Individual") + "</b></div><div><span>Cargos ML estimados</span><b>" + (feeAmount == null ? "Sin calcular" : money(feeAmount)) + "</b></div><div><span>Ingreso neto estimado</span><b>" + (net == null ? "Sin calcular" : money(net)) + "</b></div><div><span>Costo conocido</span><b>" + (packCost == null ? "COSTO DESCONOCIDO" : money(packCost)) + "</b></div><div><span>Ganancia bruta esperada</span><b>" + (profit == null ? "NO CONFIABLE" : money(profit)) + "</b></div><div><span>Margen esperado</span><b>" + (margin == null ? "NO CONFIABLE" : decimal(margin, 1) + "%") + "</b></div></section>"
      + "<section class='ml-preview-attributes'><h3>Atributos enviados</h3>" + (attributes.length ? attributes.map(function (attribute) { return "<div><span>" + safe(attribute.name) + "</span><b>" + safe(candidate.attributeValues[attribute.id]) + "</b></div>"; }).join("") : "<div class='empty'>Sin atributos cargados.</div>") + "</section>"
      + (packCost == null ? "<div class='msg warn'>El costo del producto es desconocido o parcial. La ganancia y el margen no pueden considerarse confiables.</div>" : "");
    $("mlPublishReviewed").checked = false;
    $("mlPublishPhrase").value = "";
    updatePublishButton();
    $("mlPreviewModal").classList.remove("hidden");
    renderPreviewImages(candidate);
  }
  function renderPreviewImages(candidate) {
    var target = $("mlPreviewImages");
    target.innerHTML = (candidate.imageRefs || []).map(function (ref) { return "<div data-ml-final-image='" + safe(ref.id) + "'><span>Cargando...</span></div>"; }).join("");
    (candidate.imageRefs || []).forEach(function (ref) {
      request("/images/" + encodeURIComponent(ref.id)).then(function (response) {
        var node = document.querySelector("[data-ml-final-image='" + CSS.escape(ref.id) + "']");
        if (node) node.innerHTML = "<img src='" + safe(response.dataUrl) + "' alt='Foto de publicacion'>";
      }).catch(function () {});
    });
  }
  function closePreview() { $("mlPreviewModal").classList.add("hidden"); }
  function updatePublishButton() {
    $("mlPublishBtn").disabled = !($("mlPublishReviewed").checked && $("mlPublishPhrase").value.trim().toUpperCase() === "PUBLICAR");
  }
  function attributePayload(candidate) {
    return (candidate.requiredAttributes || []).map(function (attribute) {
      var value = candidate.attributeValues && candidate.attributeValues[attribute.id];
      if (!value) return null;
      var option = (attribute.values || []).filter(function (candidateValue) { return String(candidateValue.id) === String(value); })[0];
      return option && option.id ? { id: attribute.id, value_id: option.id } : { id: attribute.id, value_name: String(value) };
    }).filter(Boolean);
  }
  function publishCandidate() {
    if (!activeCandidate || activeCandidate.state !== "READY") return;
    if (!($("mlPublishReviewed").checked && $("mlPublishPhrase").value.trim().toUpperCase() === "PUBLICAR")) return;
    var candidate = Object.assign({}, activeCandidate);
    candidate.physicalStock = physicalStock(candidate);
    var available = mlAvailableStock(candidate);
    var blocking = calculateCandidateIssues(candidate);
    if (!available || blocking.length) { notify(blocking[0] || "No hay stock online disponible"); return; }
    var button = $("mlPublishBtn");
    setBusy(button, true, "PUBLICANDO...");
    request("/publish", jsonOptions({
      approval: "PUBLICAR",
      candidateId: candidate.id,
      title: candidate.listingTitle,
      categoryId: candidate.categoryId,
      price: candidate.sellingPrice,
      currencyId: "ARS",
      availableQuantity: available,
      physicalStock: candidate.physicalStock,
      mlMaxStock: candidate.mlMaxStock,
      packagingStatus: candidate.packagingStatus,
      packagingConfirmed: candidate.packagingConfirmed,
      listingTypeId: candidate.listingTypeId || "gold_special",
      condition: "new",
      attributes: attributePayload(candidate),
      description: candidate.description,
      imageRefs: (candidate.imageRefs || []).map(function (ref) { return ref.id; })
    })).then(function (result) {
      if (!result.item || !result.item.id) throw new Error("Mercado Libre no devolvio el ID del item");
      var stamp = nowIso();
      var listing = {
        id: "mll_" + result.item.id,
        candidateId: candidate.id,
        productId: candidate.productId,
        mlItemId: result.item.id,
        permalink: result.item.permalink || "",
        userProductId: result.item.userProductId || "",
        remoteStatus: result.item.status || "active",
        remoteAvailableQuantity: Number(result.item.availableQuantity == null ? available : result.item.availableQuantity),
        publishedPrice: Number(result.item.price == null ? candidate.sellingPrice : result.item.price),
        descriptionSaved: result.descriptionSaved === true,
        syncMode: result.item.userProductId ? "user-product" : "item",
        publishedAt: stamp,
        updatedAt: stamp,
        lastSyncedAt: stamp
      };
      candidate.mlItemId = listing.mlItemId;
      candidate.mlListingId = listing.id;
      candidate.publishedAt = stamp;
      candidate.updatedAt = stamp;
      candidate.lastError = result.descriptionError || "";
      candidate.state = result.descriptionSaved === false ? "ERROR" : "PUBLISHED";
      return bridge.commitPublication(candidate, listing, result.descriptionError || "");
    }).then(function () {
      var finalState = candidate.state;
      closePreview();
      closeReview();
      setView(finalState === "ERROR" ? "problems" : "published");
      notify(finalState === "ERROR" ? "El item se creo, pero la descripcion requiere revision" : "Publicacion creada y vinculada con el POS");
      return render();
    }).catch(function (error) {
      candidate.state = "ERROR";
      candidate.lastError = error.message;
      candidate.blockingIssues = [error.message];
      candidate.updatedAt = nowIso();
      bridge.add("mlCandidates", candidate).then(render);
      notify(error.message);
    }).then(function () { setBusy(button, false); updatePublishButton(); });
  }

  function refreshPublished(id) {
    var candidate = findCandidate(id);
    var listing = candidate && listingFor(candidate.id);
    if (!candidate || !listing || !listing.mlItemId) return;
    request("/items/" + encodeURIComponent(listing.mlItemId)).then(function (result) {
      listing.remoteStatus = result.status || listing.remoteStatus;
      listing.remoteAvailableQuantity = Number(result.availableQuantity == null ? listing.remoteAvailableQuantity : result.availableQuantity);
      listing.publishedPrice = Number(result.price == null ? listing.publishedPrice : result.price);
      listing.userProductId = result.userProductId || listing.userProductId || "";
      listing.lastSyncedAt = nowIso();
      listing.updatedAt = nowIso();
      return Promise.all([
        bridge.add("mlListings", listing),
        bridge.add("mlSyncEvents", { id: uid(), candidateId: candidate.id, listingId: listing.id, mlItemId: listing.mlItemId, type: "REMOTE_STATUS_READ", detail: "Consulta manual sin cambios", createdAt: nowIso(), createdBy: bridge.getCurrentUser() && bridge.getCurrentUser().id })
      ]);
    }).then(function () { notify("Estado remoto actualizado; no se modifico la publicacion"); return render(); }).catch(function (error) { notify(error.message); });
  }
  function syncPublishedStock(id) {
    var candidate = findCandidate(id);
    var listing = candidate && listingFor(candidate.id);
    if (!candidate || !listing || !listing.mlItemId) return;
    var target = mlAvailableStock(candidate);
    var phrase = window.prompt("Esto cambiara el stock visible en Mercado Libre a " + target + ". Escriba SINCRONIZAR para continuar.", "");
    if (String(phrase || "").trim().toUpperCase() !== "SINCRONIZAR") return;
    request("/items/" + encodeURIComponent(listing.mlItemId) + "/sync-stock", jsonOptions({
      approval: "SINCRONIZAR",
      availableQuantity: target,
      userProductId: listing.userProductId || ""
    })).then(function (result) {
      listing.remoteAvailableQuantity = Number(result.availableQuantity == null ? target : result.availableQuantity);
      listing.userProductId = result.userProductId || listing.userProductId || "";
      listing.lastSyncedAt = nowIso();
      listing.updatedAt = nowIso();
      return Promise.all([
        bridge.add("mlListings", listing),
        bridge.add("mlSyncEvents", { id: uid(), candidateId: candidate.id, listingId: listing.id, mlItemId: listing.mlItemId, type: "STOCK_SYNCED", detail: "Stock remoto -> " + target, availableQuantity: target, createdAt: nowIso(), createdBy: bridge.getCurrentUser() && bridge.getCurrentUser().id })
      ]);
    }).then(function () { return bridge.audit("ML_STOCK_SYNCED", listing.mlItemId + " -> " + target, "important"); }).then(function () {
      notify("Stock de Mercado Libre actualizado manualmente");
      return render();
    }).catch(function (error) { notify(error.message); });
  }

  function handleDelegatedClick(event) {
    var target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.mlView) setView(target.dataset.mlView);
    else if (target.dataset.mlOpen) openReview(target.dataset.mlOpen);
    else if (target.dataset.mlResearch) researchCandidate(target.dataset.mlResearch);
    else if (target.dataset.mlPreview) openFinalPreview(target.dataset.mlPreview);
    else if (target.dataset.mlSync) refreshPublished(target.dataset.mlSync);
    else if (target.dataset.mlStockSync) syncPublishedStock(target.dataset.mlStockSync);
    else if (target.dataset.mlImageUp) changeImageOrder(target.dataset.mlImageUp, -1);
    else if (target.dataset.mlImageDown) changeImageOrder(target.dataset.mlImageDown, 1);
    else if (target.dataset.mlImageRemove) removeImage(target.dataset.mlImageRemove);
  }
  function bind() {
    if (!$("tabMercadoLibre") || $("tabMercadoLibre").dataset.bound === "1") return;
    $("tabMercadoLibre").dataset.bound = "1";
    $("tabMercadoLibre").addEventListener("click", handleDelegatedClick);
    $("mlConfigureBtn").onclick = openConfig;
    $("mlCloseConfigBtn").onclick = closeConfig;
    $("mlConfigForm").onsubmit = saveConfig;
    $("mlConnectBtn").onclick = connectAccount;
    $("mlRefreshConnectionBtn").onclick = function () { refreshConnectionStatus(true); };
    $("mlDiscoverBtn").onclick = discoverProducts;
    $("mlSearchInput").oninput = renderCandidateList;
    $("mlSortSelect").onchange = renderCandidateList;
    $("mlCloseReviewBtn").onclick = closeReview;
    $("mlOfferType").onchange = function () { updatePackUi(); };
    $("mlMaxStock").oninput = updateStockEquation;
    $("mlReservedStock").oninput = updateStockEquation;
    $("mlSaveReviewBtn").onclick = function () { persistReview(); };
    $("mlResearchBtn").onclick = function () { researchCandidate(); };
    $("mlApproveBtn").onclick = approveCandidate;
    $("mlPredictCategoryBtn").onclick = predictCategory;
    $("mlAiAssistBtn").onclick = assistCandidateWithAi;
    $("mlLoadRequirementsBtn").onclick = function () { setBusy($("mlLoadRequirementsBtn"), true, "Cargando..."); loadRequirements().catch(function (error) { notify(error.message); }).then(function () { setBusy($("mlLoadRequirementsBtn"), false); }); };
    $("mlPrepareBtn").onclick = prepareFinal;
    $("mlOpenPreviewBtn").onclick = function () { openFinalPreview(); };
    $("mlImageInput").onchange = addImages;
    $("mlClosePreviewBtn").onclick = closePreview;
    $("mlPublishReviewed").onchange = updatePublishButton;
    $("mlPublishPhrase").oninput = updatePublishButton;
    $("mlPublishBtn").onclick = publishCandidate;
  }
  function configure(context) {
    bridge = context;
    bind();
    refreshConnectionStatus(false);
  }

  window.MercadoLibreModule = {
    configure: configure,
    render: render,
    onActivate: function () { refreshConnectionStatus(false); return render(); }
  };
})();
