(function () {
  "use strict";

  var DB_NAME = "forrajeria_caja_static_v1";
  var DB_VERSION = 6;
  var APP_VERSION = "2026.09.17.2";
  var APP_REPO = "Biblicaaal/AppForrajeria";
  var APP_BRANCH = "main";
  var UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/" + APP_REPO + "/" + APP_BRANCH + "/update.json";
  var UPDATE_ZIP_URL = "https://github.com/" + APP_REPO + "/archive/refs/heads/" + APP_BRANCH + ".zip";
  var UPDATE_REPO_URL = "https://github.com/" + APP_REPO;
  var CORE_STORES = ["users", "sessions", "transactions", "closures", "monthlyEntries", "productionItems", "products", "masterProducts", "baskets", "basketItems", "settings", "auditLog"];
  var PURCHASING_STORES = ["suppliers", "purchases", "purchaseLines", "inventoryMovements", "purchaseCostHistory", "priceReviews", "priceHistory"];
  var MERCADO_LIBRE_STORES = ["mlCandidates", "mlResearch", "mlListings", "mlSyncEvents"];
  var CONTEXT_STORES = ["weatherDaily"];
  var STOCK_COUNT_STORES = ["stockCountMissions", "stockCountResults", "stockCountCampaigns"];
  var STORES = CORE_STORES.concat(PURCHASING_STORES, MERCADO_LIBRE_STORES, CONTEXT_STORES, STOCK_COUNT_STORES);
  var CLEAN_SLATE_VERSION = "2026-08-07-production-clean-1";
  var CLEAN_SLATE_STORAGE_KEY = "forrajeriaCleanSlateVersion";
  var LOCAL_DATA_ENDPOINT = "http://127.0.0.1:4174/api/data-snapshot";
  var MONTHLY_REPORT_ENDPOINT = "http://127.0.0.1:4174/api/monthly-report";
  var localDataToken = "";
  var diskSnapshotServiceReady = false;
  var diskSnapshotWritesEnabled = false;
  var diskSnapshotPaused = false;
  var diskSnapshotTimer = null;
  var diskSnapshotWriting = false;
  var diskSnapshotQueued = false;
  var diskSnapshotCurrentPromise = null;
  var startupPersistenceMessage = "Guardado local activo";
  var startupPersistenceTone = "local";
  var PAYMENT = "Efectivo";
  var currentUser = null;
  var currentSession = null;
  var currentTab = "Caja";
  var isSubmittingSale = false;
  var isLoggingIn = false;
  var devAutoLoginTimer = null;
  var isGeneratingTestData = false;
  var saleMode = "quick";
  var basket = [];
  var ticketDiscount = { type: "percent", value: 0 };
  var calcItems = [];
  var selectedProduct = null;
  var productEntryMode = "quantity";
  var lastReceipt = null;
  var scannerBuffer = "";
  var scannerLastKeyAt = 0;
  var scannerTypingTarget = null;
  var scannerTypingStartValue = "";
  var scannerBurstMode = false;
  var scannerGlobalTimer = null;
  var scannerStartAt = 0;
  var barcodeAutoTimer = null;
  var stockBarcodeAutoTimer = null;
  var lastProcessedScanCode = "";
  var lastProcessedScanAt = 0;
  var stockSearchStats = {};
  var stockViewMode = localStorage.getItem("forrajeriaStockViewMode") || "store";
  var productSearchCache = null;
  var productPopularityCache = null;
  var productSearchSequence = 0;
  var activeProductCategory = localStorage.getItem("bakeryActiveProductCategory") || "Todos";
  var autoSaleTimer = null;
  var autoTicketTimer = null;
  var lastSaleAt = 0;
  var lastSalesWindowKey = "";
  var editorProducts = [];
  var editingProductDraft = null;
  var editImageData = "";
  var pendingUndoSale = null;
  var pendingSaleDetail = null;
  var stockSoldStats = {};
  var stockQuickFilter = "";
  var selectedStockProducts = {};
  var pendingManualReviewItem = null;
  var manualReviewGroups = [];
  var priceReviewRows = [];
  var activePriceReview = null;
  var pendingStockImport = null;
  var metricsProductRankMode = "units";
  var metricsProductLimit = 10;
  var metricsProductTrendFilter = "all";
  var metricsDeadStockSort = "days";
  var metricsStockRiskCategory = "Alimentos";
  var metricsTrendMode = "revenue";
  var metricsDashboardModel = null;
  var metricsRenderSequence = 0;
  var latestMonthlyReport = null;
  var cropImage = null;
  var cropImageData = "";
  var cropDrag = null;
  var mpSyncTimer = null;
  var closureSnapshot = null;
  var partialClosureSnapshot = null;
  var closureDate = "";
  var closureShift = "";
  var closurePaymentDetailKind = "digital";
  var closureHistoryRows = [];
  var closureHistoryRenderCount = 8;
  var splitDrag = null;
  var shelfDrag = null;
  var selectedMovements = {};
  var visibleMovementIds = [];
  var expandedMovements = {};
  var movementDragSelect = null;
  var lastMovementSelectIndex = -1;
  var movementFilteredRows = [];
  var movementItemsByBasket = {};
  var movementRenderCount = 0;
  var movementRenderTimer = null;
  var movementQuickFilter = "";
  var movementEditDraft = null;
  var MOVEMENT_BATCH_SIZE = 80;
  var monthlyPhotoData = "";
  var dateSyncTimer = null;
  var weatherSyncTimer = null;
  var stockCountRenderSequence = 0;
  var activeStockCountMission = null;
  var isRequestingStockCountMission = false;
  var selectedBalanceDay = "";
  var balanceEntryFilter = "all";
  var expandedBalanceEntries = {};
  var expandedMissingClosures = {};
  var draggedTab = "";
  var tabJustDragged = false;
  var supplierDirectory = [];
  var purchaseHistory = [];
  var purchaseLinesCache = [];
  var supplierProductsCache = [];
  var purchaseEditorDraft = null;
  var purchaseInvoiceData = "";
  var purchaseInvoiceFileName = "factura.jpg";
  var purchaseInvoiceDirty = false;
  var purchaseAttachmentRef = null;
  var purchasePendingProductCreation = false;
  var purchaseSelectedDetail = null;
  var supplierSelectedProfile = null;
  var quickButtons = [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 8000, 10000];
  var monthlyCategories = ["Proveedores", "Perdida", "Sueldos", "Alquiler", "Servicios", "Arreglos", "Equipamiento", "Insumos", "Otro"];
  var catalogProducts = Array.isArray(window.FORRAJERIA_CATALOG) ? window.FORRAJERIA_CATALOG : [];
  var catalogVersion = window.FORRAJERIA_CATALOG_VERSION || "catalog-missing";

  function $(id) { return document.getElementById(id); }
  function nowIso() { return new Date().toISOString(); }
  function localTimeLabel(value) {
    var date = new Date(value || "");
    if (isNaN(date.getTime())) return "--:--";
    return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  function localDateKey(date) {
    date = date || new Date();
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  function today() { return localDateKey(new Date()); }
  function currentWorkShift(date) {
    var h = (date || new Date()).getHours();
    return h >= 14 ? "PM" : "AM";
  }
  function currentWorkClock() {
    var now = new Date();
    return { businessDate: localDateKey(now), shiftType: currentWorkShift(now) };
  }
  function monthKey(d) { return (d || today()).slice(0, 7); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function money(n) {
    return "$ " + Math.round(Number(n || 0)).toLocaleString("es-AR", { maximumFractionDigits: 0 });
  }
  function moneyCost(n) {
    if (n === null || n === undefined || n === "") return "Sin costo";
    var value = Number(n);
    if (!isFinite(value)) return "Sin costo";
    return "$ " + value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function percentValue(n) {
    var value = Number(n);
    return isFinite(value) ? (Math.round(value * 100) / 100).toLocaleString("es-AR", { maximumFractionDigits: 2 }) + "%" : "—";
  }
  function formatQuantity(n) {
    return Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 3 });
  }
  function isCashPayment(method) { return String(method || "") === "Efectivo"; }
  function isSplitPayment(method) { return String(method || "") === "Mixto"; }
  function isDigitalPayment(method) {
    return ["QR", "Debito", "Credito", "Transferencia"].indexOf(String(method || "")) >= 0;
  }
  function paymentReportingGroup(method) {
    return isCashPayment(method) ? "Efectivo" : (isSplitPayment(method) ? "Mixto" : "QR");
  }
  function paymentDisplayName(method) {
    return ({ Mixto: "Efectivo + QR", Debito: "QR (historico: debito)", Credito: "QR (historico: credito)", Transferencia: "QR (historico: transferencia)" })[method] || method || "Sin especificar";
  }
  function salePaymentParts(sale) {
    sale = sale || {};
    var total = Math.max(0, Number(sale && sale.amount || 0));
    if (isCashPayment(sale && sale.paymentMethod)) return { cash: total, qr: 0 };
    if (!isSplitPayment(sale && sale.paymentMethod)) return { cash: 0, qr: total };
    var cash = Number(sale.cashAmount != null ? sale.cashAmount : sale.paymentBreakdown && sale.paymentBreakdown.cash || 0);
    cash = Math.max(0, Math.min(total, isFinite(cash) ? cash : 0));
    var qr = Number(sale.qrAmount != null ? sale.qrAmount : sale.paymentBreakdown && sale.paymentBreakdown.qr);
    if (!isFinite(qr)) qr = Math.max(0, total - cash);
    return { cash: cash, qr: Math.max(0, Math.min(total - cash, qr)) };
  }
  function digitalPaymentSettled(sale) {
    if (!isDigitalPayment(sale && sale.paymentMethod)) return true;
    var status = String(sale.paymentStatus || sale.transferStatus || "MANUAL").toUpperCase();
    return ["APPROVED", "PAID", "RECEIVED", "PROCESSED", "MANUAL"].indexOf(status) >= 0;
  }
  function unitLabel(unit, quantity) {
    unit = String(unit || "unidad").trim();
    var qty = Math.abs(Number(quantity || 0));
    if (!unit || qty === 1) return unit || "unidad";
    var fixed = {
      unidad: "unidades",
      cantidad: "cantidades",
      paquete: "paquetes",
      pack: "packs",
      bolsa: "bolsas",
      caja: "cajas",
      lata: "latas",
      botella: "botellas",
      litro: "litros",
      m: "metros",
      fardo: "fardos",
      docena: "docenas",
      kg: "kg",
      gr: "gr",
      gramos: "gramos"
    };
    var lower = unit.toLowerCase();
    if (fixed[lower]) return fixed[lower];
    if (/[aeiou]$/i.test(unit)) return unit + "s";
    return unit + "es";
  }
  function normalizeBarcode(code) {
    return String(code || "").trim().replace(/\s+/g, "").toUpperCase();
  }
  function loadStockSearchStats() {
    try { stockSearchStats = JSON.parse(localStorage.getItem("forrajeriaStockSearchStats") || "{}"); }
    catch (e) { stockSearchStats = {}; }
  }
  function saveStockSearchStats() {
    localStorage.setItem("forrajeriaStockSearchStats", JSON.stringify(stockSearchStats || {}));
  }
  function updateAppHeight() {
    var h = window.visualViewport && window.visualViewport.height ? window.visualViewport.height : window.innerHeight;
    var w = window.visualViewport && window.visualViewport.width ? window.visualViewport.width : window.innerWidth;
    document.documentElement.style.setProperty("--app-height", Math.max(420, Math.floor(h || 720)) + "px");
    document.body.classList.toggle("small-laptop", Number(w || 0) <= 1400 && Number(h || 0) <= 820);
  }
  function parseMoney(v) {
    v = String(v || "").replace("$", "").replace(/\s/g, "");
    if (v.indexOf(",") >= 0 && v.indexOf(".") >= 0) v = v.replace(/\./g, "").replace(",", ".");
    else v = v.replace(",", ".");
    var n = Number(v);
    return isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }
  function moneyPrecision(value) {
    var number = Number(value || 0);
    return isFinite(number) ? Math.round(number * 100) / 100 : 0;
  }
  function saleAmounts(value) {
    var unroundedAmount = Math.max(0, moneyPrecision(value));
    var total = unroundedAmount < 100 ? unroundedAmount : Math.floor((unroundedAmount + 0.000001) / 100) * 100;
    total = moneyPrecision(total);
    return {
      unroundedAmount: unroundedAmount,
      total: total,
      roundingAdjustment: moneyPrecision(total - unroundedAmount)
    };
  }
  function basketSaleAmounts(items, discountOverride) {
    var grossSubtotal = moneyPrecision((items || []).reduce(function (total, item) {
      return total + Number(item.subtotal || 0);
    }, 0));
    var effectiveDiscount = arguments.length > 1 ? (discountOverride || {}) : ticketDiscount;
    var discountType = effectiveDiscount && effectiveDiscount.type === "fixed" ? "fixed" : "percent";
    var discountValue = Math.max(0, Number(effectiveDiscount && effectiveDiscount.value || 0));
    if (!isFinite(discountValue)) discountValue = 0;
    if (discountType === "percent") discountValue = Math.min(100, discountValue);
    var discountAmount = discountType === "fixed" ? discountValue : grossSubtotal * discountValue / 100;
    discountAmount = moneyPrecision(Math.min(grossSubtotal, Math.max(0, discountAmount)));
    var amounts = saleAmounts(Math.max(0, grossSubtotal - discountAmount));
    amounts.grossSubtotal = grossSubtotal;
    amounts.discountType = discountType;
    amounts.discountValue = moneyPrecision(discountValue);
    amounts.discountAmount = discountAmount;
    return amounts;
  }
  function resetTicketDiscount() {
    ticketDiscount = { type: "percent", value: 0 };
    if ($("ticketDiscountValue")) $("ticketDiscountValue").value = "";
  }
  function escapeHtml(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }
  function toast(msg) {
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    $("toastHost").appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2800);
  }
  function integrationSettings() {
    try {
      return JSON.parse(localStorage.getItem("bakeryIntegrationSettings") || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveIntegrationSettings(e) {
    e.preventDefault();
    localStorage.setItem("bakeryIntegrationSettings", JSON.stringify({
      supabaseUrl: $("supabaseUrl").value.trim().replace(/\/$/, ""),
      supabaseAnonKey: $("supabaseAnonKey").value.trim(),
      mpTerminalId: $("mpTerminalId") ? $("mpTerminalId").value.trim() : "",
      mpExternalPosId: $("mpExternalPosId") ? $("mpExternalPosId").value.trim() : ""
    }));
    toast("Integracion guardada");
  }
  function loadIntegrationSettings() {
    var s = integrationSettings();
    if ($("supabaseUrl")) $("supabaseUrl").value = s.supabaseUrl || "";
    if ($("supabaseAnonKey")) $("supabaseAnonKey").value = s.supabaseAnonKey || "";
    if ($("mpTerminalId")) $("mpTerminalId").value = s.mpTerminalId || "";
    if ($("mpExternalPosId")) $("mpExternalPosId").value = s.mpExternalPosId || "";
  }
  function defaultTicketSettings() {
    return {
      printerName: "",
      businessName: "FORRAJERIA LA VIEJA ESQUINA",
      cuit: "",
      address: "",
      iva: "Comprobante no fiscal"
    };
  }
  function ticketSettings() {
    var defaults = defaultTicketSettings();
    try {
      var saved = JSON.parse(localStorage.getItem("forrajeriaTicketSettings") || "{}");
      Object.keys(defaults).forEach(function (k) { if (saved[k] === undefined) saved[k] = defaults[k]; });
      if (String(saved.businessName || "").toUpperCase() === "FORRAJERIA LA NUEVA FE") {
        saved.businessName = defaults.businessName;
        localStorage.setItem("forrajeriaTicketSettings", JSON.stringify(saved));
      }
      return saved;
    } catch (e) {
      return defaults;
    }
  }
  function loadTicketSettings() {
    var s = ticketSettings();
    loadPrinterOptions(s.printerName || "");
    if ($("ticketBusinessName")) $("ticketBusinessName").value = s.businessName || "";
    if ($("ticketCuit")) $("ticketCuit").value = s.cuit || "";
    if ($("ticketAddress")) $("ticketAddress").value = s.address || "";
    if ($("ticketIva")) $("ticketIva").value = s.iva || "";
  }
  function populatePrinterSelect(printers, selected) {
    var select = $("ticketPrinterName");
    if (!select) return;
    var rows = Array.isArray(printers) ? printers : [];
    var current = selected || select.value || "";
    var seen = {};
    var html = "<option value=''>Predeterminada de Windows</option>";
    rows.forEach(function (printer) {
      var name = typeof printer === "string" ? printer : (printer.name || printer.Name || "");
      if (!name || seen[name]) return;
      seen[name] = true;
      var isDefault = !!(printer.default || printer.Default);
      var label = name + (isDefault ? " (predeterminada)" : "");
      html += "<option value='" + escapeHtml(name) + "'>" + escapeHtml(label) + "</option>";
    });
    if (current && !seen[current]) {
      html += "<option value='" + escapeHtml(current) + "'>" + escapeHtml(current + " (guardada)") + "</option>";
    }
    select.innerHTML = html;
    select.value = current;
  }
  function loadPrinterOptions(selected) {
    var localPrinters = window.FORRAJERIA_PRINTERS || [];
    populatePrinterSelect(localPrinters, selected || "");
    if (typeof fetch !== "function") return;
    fetch("printers.json?ts=" + Date.now(), { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("No printer list");
      return res.json();
    }).then(function (data) {
      populatePrinterSelect(data.printers || data || [], selected || "");
    }).catch(function () {
      populatePrinterSelect([], selected || "");
    });
  }
  function saveTicketSettings(e) {
    if (e) e.preventDefault();
    localStorage.setItem("forrajeriaTicketSettings", JSON.stringify({
      printerName: $("ticketPrinterName") ? $("ticketPrinterName").value.trim() : "",
      businessName: $("ticketBusinessName") ? $("ticketBusinessName").value.trim() : "FORRAJERIA LA VIEJA ESQUINA",
      cuit: $("ticketCuit") ? $("ticketCuit").value.trim() : "",
      address: $("ticketAddress") ? $("ticketAddress").value.trim() : "",
      iva: $("ticketIva") ? $("ticketIva").value.trim() : "Comprobante no fiscal"
    }));
    toast("Configuracion de ticket guardada");
  }
  function updateSettings() {
    try {
      var saved = JSON.parse(localStorage.getItem("bakeryUpdateSettings") || "{}");
      if (saved.autoCheck === undefined) saved.autoCheck = true;
      return saved;
    } catch (e) {
      return { autoCheck: true };
    }
  }
  function saveUpdateSettings() {
    localStorage.setItem("bakeryUpdateSettings", JSON.stringify({
      autoCheck: $("autoUpdateCheck") ? $("autoUpdateCheck").value === "true" : true
    }));
    toast("Preferencia de updates guardada");
  }
  function loadUpdateSettings() {
    var s = updateSettings();
    if ($("autoUpdateCheck")) $("autoUpdateCheck").value = String(s.autoCheck !== false);
    if ($("localVersionLabel")) $("localVersionLabel").textContent = APP_VERSION;
    renderUpdateStatus(JSON.parse(localStorage.getItem("bakeryLastUpdateCheck") || "null"));
  }
  function renderUpdateStatus(info) {
    if ($("localVersionLabel")) $("localVersionLabel").textContent = APP_VERSION;
    if (!info) {
      if ($("updateStatusLabel")) $("updateStatusLabel").textContent = "Sin revisar";
      if ($("updateDetailText")) $("updateDetailText").textContent = "Abrir con LaViejaEsquina.exe para instalar updates automaticamente antes de entrar.";
      return;
    }
    if ($("updateStatusLabel")) $("updateStatusLabel").textContent = info.available ? "Update disponible" : (info.error ? "Error de conexion" : "Al dia");
    if ($("updateDetailText")) $("updateDetailText").textContent = info.message || "";
  }
  function compareVersions(a, b) {
    var aa = String(a || "0").split(".").map(Number);
    var bb = String(b || "0").split(".").map(Number);
    for (var i = 0; i < Math.max(aa.length, bb.length); i++) {
      var x = aa[i] || 0;
      var y = bb[i] || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }
  function checkForUpdates(silent) {
    var url = UPDATE_MANIFEST_URL + "?t=" + Date.now();
    if (!silent) toast("Buscando updates...");
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("No se encontro update.json en el repo");
      return res.json();
    }).then(function (remote) {
      var remoteVersion = remote.version || "0";
      var available = compareVersions(remoteVersion, APP_VERSION) > 0;
      var message = available
        ? "Version " + remoteVersion + " disponible. Local: " + APP_VERSION + ". " + (remote.notes || "")
        : "Version local " + APP_VERSION + " al dia. Ultima remota: " + remoteVersion + ".";
      var info = {
        checkedAt: nowIso(), available: available, version: remoteVersion, localVersion: APP_VERSION,
        downloadUrl: remote.downloadUrl || UPDATE_ZIP_URL, repoUrl: remote.repoUrl || UPDATE_REPO_URL,
        message: message
      };
      localStorage.setItem("bakeryLastUpdateCheck", JSON.stringify(info));
      renderUpdateStatus(info);
      if (available) openUpdateModal(info);
      else if (!silent) toast("App al dia");
      return info;
    }).catch(function (err) {
      var info = {
        checkedAt: nowIso(), available: false, error: true, localVersion: APP_VERSION,
        downloadUrl: UPDATE_ZIP_URL, repoUrl: UPDATE_REPO_URL,
        message: "No se pudo revisar GitHub: " + (err.message || "sin conexion")
      };
      localStorage.setItem("bakeryLastUpdateCheck", JSON.stringify(info));
      renderUpdateStatus(info);
      if (!silent) toast("No se pudo revisar updates");
      return info;
    });
  }
  function openUpdateModal(info) {
    info = info || JSON.parse(localStorage.getItem("bakeryLastUpdateCheck") || "null");
    if (!info || !info.available || !$("updateModal")) return;
    $("updateModalDetail").textContent = (info.message || "Hay una version nueva disponible.") + " Cerrar y volver a abrir con LaViejaEsquina.exe para instalarla automaticamente.";
    $("updateModal").classList.remove("hidden");
  }
  function closeUpdateModal() {
    if ($("updateModal")) $("updateModal").classList.add("hidden");
  }
  function downloadUpdate() {
    var info = JSON.parse(localStorage.getItem("bakeryLastUpdateCheck") || "null") || {};
    window.open(info.downloadUrl || UPDATE_ZIP_URL, "_blank");
  }
  function openUpdateRepo() {
    var info = JSON.parse(localStorage.getItem("bakeryLastUpdateCheck") || "null") || {};
    window.open(info.repoUrl || UPDATE_REPO_URL, "_blank");
  }
  function updaterCommand() {
    return ".\\Update-AppCajaPana.bat";
  }
  function copyUpdaterCommand() {
    var text = updaterCommand();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast("Comando de updater copiado");
    }).catch(function () {
        toast("Abrir LaViejaEsquina.exe para actualizar automaticamente");
      });
      return;
    }
    toast("Abrir LaViejaEsquina.exe para actualizar automaticamente");
  }
  function defaultDevUiSettings() {
    return { density: "normal", theme: "green", motion: "on", performance: "normal", saleWidth: 380, shelfHeight: 180 };
  }
  function devUiSettings() {
    var defaults = defaultDevUiSettings();
    try {
      var saved = JSON.parse(localStorage.getItem("bakeryDevUiSettings") || "{}");
      Object.keys(defaults).forEach(function (k) { if (saved[k] === undefined || saved[k] === "") saved[k] = defaults[k]; });
      saved.saleWidth = Math.max(360, Math.min(760, Number(saved.saleWidth || defaults.saleWidth)));
      saved.shelfHeight = Math.max(120, Math.min(520, Number(saved.shelfHeight || defaults.shelfHeight)));
      return saved;
    } catch (e) {
      return defaults;
    }
  }
  function persistDevUiSettings(settings) {
    localStorage.setItem("bakeryDevUiSettings", JSON.stringify(settings));
  }
  function applyDevUiSettings(settings) {
    settings = settings || devUiSettings();
    document.body.classList.remove("ui-compact", "ui-roomy", "theme-green", "theme-warm", "theme-amber", "reduce-motion", "perf-legacy");
    document.body.classList.add("theme-" + (settings.theme || "green"));
    if (settings.density === "compact") document.body.classList.add("ui-compact");
    if (settings.density === "roomy") document.body.classList.add("ui-roomy");
    if (settings.motion === "reduced" || settings.performance === "legacy") document.body.classList.add("reduce-motion");
    if (settings.performance === "legacy") document.body.classList.add("perf-legacy");
    document.documentElement.style.setProperty("--sale-width", Number(settings.saleWidth || 520) + "px");
    document.documentElement.style.setProperty("--product-shelf-height", Number(settings.shelfHeight || 180) + "px");
    var layout = $("cashierLayout");
    if (layout) layout.style.setProperty("--sale-width", Number(settings.saleWidth || 520) + "px");
  }
  function isLegacyPerformance() {
    return devUiSettings().performance === "legacy";
  }
  function updateDevUiOutputs() {
    if ($("devSaleWidthValue")) $("devSaleWidthValue").textContent = ($("devSaleWidth").value || devUiSettings().saleWidth) + " px";
    if ($("devShelfHeightValue")) $("devShelfHeightValue").textContent = ($("devShelfHeight").value || devUiSettings().shelfHeight) + " px";
  }
  function loadDevUiSettings() {
    var s = devUiSettings();
    applyDevUiSettings(s);
    if ($("devDensity")) $("devDensity").value = s.density;
    if ($("devTheme")) $("devTheme").value = s.theme;
    if ($("devMotion")) $("devMotion").value = s.motion;
    if ($("devPerformance")) $("devPerformance").value = s.performance || "normal";
    if ($("devSaleWidth")) $("devSaleWidth").value = s.saleWidth;
    if ($("devShelfHeight")) $("devShelfHeight").value = s.shelfHeight;
    updateDevUiOutputs();
  }
  function collectDevUiSettings() {
    return {
      density: $("devDensity") ? $("devDensity").value : devUiSettings().density,
      theme: $("devTheme") ? $("devTheme").value : devUiSettings().theme,
      motion: $("devMotion") ? $("devMotion").value : devUiSettings().motion,
      performance: $("devPerformance") ? $("devPerformance").value : devUiSettings().performance,
      saleWidth: $("devSaleWidth") ? Number($("devSaleWidth").value) : devUiSettings().saleWidth,
      shelfHeight: $("devShelfHeight") ? Number($("devShelfHeight").value) : devUiSettings().shelfHeight
    };
  }
  function saveDevUiSettings(e) {
    if (e) e.preventDefault();
    var s = collectDevUiSettings();
    persistDevUiSettings(s);
    applyDevUiSettings(s);
    updateDevUiOutputs();
    toast("Configuracion UI guardada");
  }
  function previewDevUiSettings() {
    var s = collectDevUiSettings();
    applyDevUiSettings(s);
    updateDevUiOutputs();
  }
  function resetDevUiSettings() {
    var s = defaultDevUiSettings();
    persistDevUiSettings(s);
    loadDevUiSettings();
    toast("UI reseteada");
  }
  function resetTabOrder() {
    localStorage.removeItem("bakeryTabOrder");
    buildTabs();
    toast("Orden de tabs reseteado");
  }
  function callSupabaseFunction(name, body) {
    var s = integrationSettings();
    if (!s.supabaseUrl || !s.supabaseAnonKey) {
      toast("Configure Supabase en Dev");
      return Promise.reject(new Error("Supabase no configurado"));
    }
    return fetch(s.supabaseUrl + "/functions/v1/" + name, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + s.supabaseAnonKey
      },
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || "Error de integracion");
        return data;
      });
    });
  }
  function playSound() {
    var snd = $("cashSound");
    if (!snd) return;
    try {
      snd.pause();
      snd.currentTime = 0;
      var p = snd.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function playTicketSound() {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var ctx = new AudioCtx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      setTimeout(function () { ctx.close(); }, 180);
    } catch (e) {}
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        STORES.forEach(function (name) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  var dbPromise = openDb();
  function updatePersistenceStatus(message, tone) {
    startupPersistenceMessage = message || startupPersistenceMessage;
    startupPersistenceTone = tone || startupPersistenceTone;
    ["loginDataStatus", "dataSafetyStatus"].forEach(function (id) {
      var node = $(id);
      if (!node) return;
      node.textContent = startupPersistenceMessage;
      node.className = "data-safety-status " + startupPersistenceTone;
    });
  }
  function readLocalDataToken() {
    try {
      var token = new URLSearchParams(location.search).get("localToken") || "";
      return /^[a-f0-9]{32}$/i.test(token) ? token : "";
    } catch (e) { return ""; }
  }
  function waitMilliseconds(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function snapshotRequest(path, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {}, { "X-App-Token": localDataToken });
    return fetch(LOCAL_DATA_ENDPOINT + (path || ""), Object.assign({}, options, { headers: headers, cache: "no-store" }));
  }
  function mercadoLibreRequest(path, options) {
    path = String(path || "");
    if (!/^\/[A-Za-z0-9_?&=.%\/-]*$/.test(path)) return Promise.reject(new Error("Ruta de Mercado Libre invalida"));
    options = options || {};
    var headers = Object.assign({}, options.headers || {}, { "X-App-Token": localDataToken });
    return fetch("http://127.0.0.1:4174/api/ml" + path, Object.assign({}, options, { headers: headers, cache: "no-store" }));
  }
  function weatherSettings() {
    try { return JSON.parse(localStorage.getItem("forrajeriaWeatherSettings") || "{}"); }
    catch (error) { return {}; }
  }
  function weatherHourlyCondition(code, precipitation) {
    code = Number(code);
    precipitation = Math.max(0, Number(precipitation || 0));
    if ([95, 96, 99].indexOf(code) >= 0) return { group: "Tormenta", label: "Tormenta" };
    if ([71, 73, 75, 77, 85, 86].indexOf(code) >= 0) return { group: "Nieve", label: "Nieve" };
    if (precipitation >= .1 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].indexOf(code) >= 0) return { group: "Lluvioso", label: "Lluvia" };
    if (code === 45 || code === 48) return { group: "Niebla", label: "Niebla" };
    if (code === 0 || code === 1) return { group: "Soleado", label: code === 0 ? "Despejado" : "Mayormente soleado" };
    if (code === 2 || code === 3) return { group: "Nublado", label: code === 2 ? "Parcialmente nublado" : "Nublado" };
    return { group: "Variable", label: "Clima variable" };
  }
  function weatherDescription(code) {
    return weatherHourlyCondition(code, 0).label;
  }
  function weatherConditionGroup(code, precipitation) {
    return weatherHourlyCondition(code, precipitation).group;
  }
  function weatherFiniteValues(values) {
    return (values || []).map(Number).filter(function (value) { return isFinite(value); });
  }
  function weatherAverage(values) {
    values = weatherFiniteValues(values);
    return values.length ? values.reduce(function (sumValue, value) { return sumValue + value; }, 0) / values.length : null;
  }
  function weatherMedian(values) {
    values = weatherFiniteValues(values).sort(function (a, b) { return a - b; });
    if (!values.length) return null;
    var middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  }
  function weatherTemperatureBand(average, median) {
    average = Number(average); median = Number(median);
    if (!isFinite(average)) average = median;
    if (!isFinite(median)) median = average;
    if (!isFinite(average) || !isFinite(median)) return "Sin clasificar";
    var center = (average + median) / 2;
    if (center < 7) return "Muy frio";
    if (center < 14) return "Frio";
    if (center >= 32) return "Muy caluroso";
    if (center >= 25) return "Caluroso";
    return "Normal";
  }
  function weatherCodeSeverity(code) {
    var group = weatherConditionGroup(code, 0);
    return { Variable: 0, Soleado: 1, Nublado: 2, Niebla: 3, Lluvioso: 4, Nieve: 5, Tormenta: 6 }[group] || 0;
  }
  function weatherDaySummary(observations, fallbackCode, fallbackPrecipitation) {
    var rows = observations && observations.length ? observations : [{
      weatherCode: Number(fallbackCode || 0),
      precipitation: Number(fallbackPrecipitation || 0),
      conditionGroup: weatherConditionGroup(fallbackCode, fallbackPrecipitation)
    }];
    var counts = { Soleado: 0, Nublado: 0, Niebla: 0, Lluvioso: 0, Nieve: 0, Tormenta: 0, Variable: 0 };
    var exactCodes = {};
    rows.forEach(function (row) {
      var group = row.conditionGroup || weatherConditionGroup(row.weatherCode, row.precipitation);
      counts[group] = Number(counts[group] || 0) + 1;
      var codeKey = String(Number(row.weatherCode || 0));
      exactCodes[codeKey] = Number(exactCodes[codeKey] || 0) + 1;
    });
    var total = rows.length;
    var priority = { Tormenta: 7, Lluvioso: 6, Nieve: 5, Niebla: 4, Nublado: 3, Soleado: 2, Variable: 1 };
    var dominant = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || priority[b] - priority[a]; })[0];
    var wetHours = counts.Lluvioso + counts.Nieve;
    var stormThreshold = Math.max(2, Math.ceil(total * .2));
    var rainThreshold = Math.max(3, Math.ceil(total * .3));
    var group = dominant;
    if (counts.Tormenta >= stormThreshold) group = "Tormenta";
    else if (wetHours >= rainThreshold) group = counts.Nieve > counts.Lluvioso ? "Nieve" : "Lluvioso";
    else if (counts.Soleado / total >= .55) group = "Soleado";
    else if ((counts.Nublado + counts.Niebla) / total >= .5) group = "Nublado";
    var descriptions = { Soleado: "Soleado", Nublado: "Nublado", Niebla: "Con niebla", Lluvioso: "Lluvioso", Nieve: "Con nieve", Tormenta: "Tormentas", Variable: "Clima variable" };
    var description = descriptions[group] || group;
    if (group === "Lluvioso" && counts.Tormenta) description = "Lluvioso con tormentas";
    else if (group !== "Tormenta" && counts.Tormenta) description += " con tormenta aislada";
    else if (["Lluvioso", "Nieve"].indexOf(group) < 0 && wetHours) description += " con lluvia aislada";
    var representativeCode = Number(Object.keys(exactCodes).sort(function (a, b) {
      return exactCodes[b] - exactCodes[a] || weatherCodeSeverity(Number(b)) - weatherCodeSeverity(Number(a));
    })[0] || fallbackCode || 0);
    var severeCode = rows.reduce(function (selected, row) {
      return weatherCodeSeverity(row.weatherCode) > weatherCodeSeverity(selected) ? Number(row.weatherCode) : selected;
    }, representativeCode);
    return {
      conditionGroup: group,
      description: description,
      conditionCounts: counts,
      dominantShare: total ? Number((counts[dominant] / total).toFixed(3)) : 0,
      representativeWeatherCode: representativeCode,
      mostSevereWeatherCode: severeCode
    };
  }
  function weatherSymbol(group) {
    if (group === "Tormenta") return "⚡";
    if (group === "Lluvioso") return "☂";
    if (group === "Soleado") return "☀";
    if (group === "Nieve") return "❄";
    if (group === "Niebla") return "≋";
    return "☁";
  }
  function saveWeatherPayload(payload, settings) {
    var daily = payload && payload.daily || {}, hourly = payload && payload.hourly || {}, current = payload && payload.current || {};
    var date = String(daily.time && daily.time[0] || current.time || hourly.time && hourly.time[0] || today()).slice(0, 10);
    var currentLocalTime = String(current.time || "");
    var currentLocalDate = currentLocalTime.slice(0, 10) || date;
    var currentLocalHour = Number(currentLocalTime.slice(11, 13));
    if (!isFinite(currentLocalHour)) currentLocalHour = date === today() ? new Date().getHours() : 23;
    var observations = (hourly.time || []).map(function (timeValue, index) {
      var time = String(timeValue || ""), hour = Number(time.slice(11, 13));
      var weatherCode = Number(hourly.weather_code && hourly.weather_code[index]);
      var precipitation = Math.max(0, Number(hourly.precipitation && hourly.precipitation[index] || 0));
      var condition = weatherHourlyCondition(weatherCode, precipitation);
      return {
        time: time,
        hour: hour,
        temperature: Number(hourly.temperature_2m && hourly.temperature_2m[index]),
        apparentTemperature: Number(hourly.apparent_temperature && hourly.apparent_temperature[index]),
        weatherCode: weatherCode,
        precipitation: precipitation,
        conditionGroup: condition.group,
        description: condition.label
      };
    }).filter(function (row) {
      var rowDate = row.time.slice(0, 10);
      return rowDate === date && row.hour >= 6 && row.hour <= 22 && (rowDate < currentLocalDate || rowDate === currentLocalDate && row.hour <= currentLocalHour);
    });
    var temperatures = weatherFiniteValues(observations.map(function (row) { return row.temperature; }));
    var apparentTemperatures = weatherFiniteValues(observations.map(function (row) { return row.apparentTemperature; }));
    var average = weatherAverage(temperatures);
    var median = weatherMedian(temperatures);
    var apparentAverage = weatherAverage(apparentTemperatures);
    var apparentMedian = weatherMedian(apparentTemperatures);
    var dailyMaximum = Number(daily.temperature_2m_max && daily.temperature_2m_max[0]);
    var dailyMinimum = Number(daily.temperature_2m_min && daily.temperature_2m_min[0]);
    var maximum = temperatures.length ? Math.max.apply(Math, temperatures) : dailyMaximum;
    var minimum = temperatures.length ? Math.min.apply(Math, temperatures) : dailyMinimum;
    if (!isFinite(average)) average = isFinite(maximum) && isFinite(minimum) ? (maximum + minimum) / 2 : Number(current.temperature_2m);
    if (!isFinite(median)) median = average;
    if (!isFinite(apparentAverage)) apparentAverage = Number(current.apparent_temperature);
    if (!isFinite(apparentMedian)) apparentMedian = apparentAverage;
    var hourlyPrecipitation = observations.reduce(function (total, row) { return total + Number(row.precipitation || 0); }, 0);
    var precipitation = observations.length ? hourlyPrecipitation : Number(daily.precipitation_sum && daily.precipitation_sum[0] || current.precipitation || 0);
    var fallbackCode = Number(daily.weather_code && daily.weather_code[0]);
    if (!isFinite(fallbackCode)) fallbackCode = Number(current.weather_code || 0);
    var summary = weatherDaySummary(observations, fallbackCode, precipitation);
    var rainRows = observations.filter(function (row) { return row.conditionGroup === "Lluvioso" || row.conditionGroup === "Tormenta"; });
    var stormRows = observations.filter(function (row) { return row.conditionGroup === "Tormenta"; });
    var record = {
      id: "weather-" + date, date: date, weatherCode: summary.representativeWeatherCode, mostSevereWeatherCode: summary.mostSevereWeatherCode,
      description: summary.description, conditionGroup: summary.conditionGroup, conditionCounts: summary.conditionCounts, dominantShare: summary.dominantShare,
      temperatureBand: weatherTemperatureBand(average, median), temperatureAverage: moneyPrecision(average), temperatureMedian: moneyPrecision(median),
      apparentTemperatureAverage: moneyPrecision(apparentAverage), apparentTemperatureMedian: moneyPrecision(apparentMedian),
      temperatureCurrent: Number(current.temperature_2m), apparentTemperature: Number(current.apparent_temperature),
      temperatureMax: maximum, temperatureMin: minimum, forecastTemperatureMax: dailyMaximum, forecastTemperatureMin: dailyMinimum,
      precipitation: moneyPrecision(precipitation), rainHours: rainRows.map(function (row) { return row.time; }), stormHours: stormRows.map(function (row) { return row.time; }),
      hoursObserved: observations.length, hourWindow: "06:00-22:00", hourlyObservations: observations,
      latitude: Number(settings.latitude), longitude: Number(settings.longitude), timezone: payload.timezone || "",
      provider: "Open-Meteo", attributionUrl: "https://open-meteo.com/", analysisMethod: "Moda horaria con umbrales de lluvia/tormenta; temperatura por promedio y mediana",
      observedAt: payload.fetchedAt || nowIso(), updatedAt: nowIso()
    };
    return add("weatherDaily", record).then(function () { scheduleDiskSnapshot(); return record; });
  }
  function syncTodayWeather(silent) {
    var settings = weatherSettings();
    if (!isFinite(Number(settings.latitude)) || !isFinite(Number(settings.longitude))) return Promise.resolve(null);
    return all("weatherDaily").then(function (rows) {
      var existing = rows.filter(function (row) { return row.date === today(); })[0];
      if (existing && Array.isArray(existing.hourlyObservations) && existing.hourlyObservations.length && Date.now() - new Date(existing.updatedAt || existing.observedAt || 0).getTime() < 55 * 60 * 1000) return existing;
      if (!localDataToken || !diskSnapshotServiceReady) throw new Error("El servicio local no esta listo");
      var url = "http://127.0.0.1:4174/api/weather?latitude=" + encodeURIComponent(Number(settings.latitude).toFixed(3)) + "&longitude=" + encodeURIComponent(Number(settings.longitude).toFixed(3));
      return fetch(url, { cache: "no-store", headers: { "X-App-Token": localDataToken } }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) { if (!response.ok) throw new Error(body.error || "No se pudo consultar el clima"); return body; });
      }).then(function (payload) { return saveWeatherPayload(payload, settings); });
    }).then(function (record) {
      if (!silent && record) toast("Clima del dia guardado: " + record.description);
      if (currentTab === "Metricas") renderMetrics();
      if (currentTab === "Balance") renderMonthly();
      return record;
    }).catch(function (error) {
      if (!silent) toast(error && error.message || "No se pudo guardar el clima");
      return null;
    });
  }
  function startWeatherSync() {
    clearInterval(weatherSyncTimer);
    weatherSyncTimer = setInterval(function () { syncTodayWeather(true); }, 60 * 60 * 1000);
  }
  function requestPcWeatherLocation() {
    if (!isAdmin()) return;
    if (!navigator.geolocation) { toast("Esta PC no permite obtener ubicacion"); return; }
    var button = $("weatherLocationBtn");
    if (button) { button.disabled = true; button.textContent = "Obteniendo ubicacion..."; }
    navigator.geolocation.getCurrentPosition(function (position) {
      var settings = { latitude: Math.round(position.coords.latitude * 1000) / 1000, longitude: Math.round(position.coords.longitude * 1000) / 1000, configuredAt: nowIso() };
      localStorage.setItem("forrajeriaWeatherSettings", JSON.stringify(settings));
      syncTodayWeather(false).then(function () { if (button) { button.disabled = false; button.textContent = "Actualizar ubicacion"; } });
    }, function () {
      if (button) { button.disabled = false; button.textContent = "Usar ubicacion de esta PC"; }
      toast("No se autorizo la ubicacion de esta PC");
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 86400000 });
  }
  function purchaseStoreAttachment(id, attachment) {
    id = String(id || "");
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return Promise.reject(new Error("Identificador unico de factura invalido"));
    var dataUrl = typeof attachment === "string" ? attachment : attachment && (attachment.dataUrl || attachment.invoicePhoto || "");
    var fileName = attachment && attachment.fileName || "factura.jpg";
    if (!dataUrl) return Promise.resolve(null);
    if (!localDataToken || !diskSnapshotServiceReady) return Promise.resolve({ id: id, storage: "inline-preview", dataUrl: dataUrl, fileName: fileName, mimeType: String(dataUrl).split(/[;:]/)[1] || "image/jpeg" });
    return fetch("http://127.0.0.1:4174/api/invoice-attachment/" + encodeURIComponent(id), { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json; charset=utf-8", "X-App-Token": localDataToken }, body: JSON.stringify({ dataUrl: dataUrl, fileName: fileName }) }).then(function (response) { if (!response.ok) return response.json().catch(function(){return {};}).then(function(body){throw new Error(body.error || "No se pudo guardar la factura");}); return response.json(); });
  }
  function purchaseLoadAttachment(ref) {
    if (!ref) return Promise.resolve(null); if (ref.storage === "inline-preview" || ref.dataUrl) return Promise.resolve(ref.dataUrl || null);
    return fetch("http://127.0.0.1:4174/api/invoice-attachment/" + encodeURIComponent(ref.id), { method: "GET", cache: "no-store", headers: { "X-App-Token": localDataToken } }).then(function(response){if(!response.ok)throw new Error("No se encontro la factura adjunta");return response.json();}).then(function(body){return body.dataUrl;});
  }
  function purchaseRemoveAttachment(ref) {
    if (!ref) return Promise.resolve(true);
    return Promise.reject(new Error("Las facturas guardadas son evidencia permanente y no se eliminan"));
  }
  function validSnapshot(snapshot) {
    if (!snapshot || snapshot.format !== "AppCajaPanaSnapshot" || Number(snapshot.schemaVersion) !== 1 || !snapshot.stores) return false;
    var legacyRequiredStores = CORE_STORES.filter(function (store) { return store !== "masterProducts"; });
    return legacyRequiredStores.every(function (store) {
      return Array.isArray(snapshot.stores[store]) && snapshot.stores[store].every(function (record) { return record && record.id != null; });
    }) && ["masterProducts"].concat(PURCHASING_STORES, MERCADO_LIBRE_STORES, CONTEXT_STORES, STOCK_COUNT_STORES).every(function (store) {
      return snapshot.stores[store] == null || (Array.isArray(snapshot.stores[store]) && snapshot.stores[store].every(function (record) { return record && record.id != null; }));
    });
  }
  function buildSnapshotEnvelope() {
    return dbPromise.then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(STORES, "readonly");
        var stores = {};
        STORES.forEach(function (store) {
          var request = transaction.objectStore(store).getAll();
          request.onsuccess = function () { stores[store] = request.result || []; };
        });
        transaction.oncomplete = function () {
          resolve({
            format: "AppCajaPanaSnapshot",
            schemaVersion: 1,
            dbName: DB_NAME,
            dbVersion: DB_VERSION,
            appVersion: APP_VERSION,
            savedAt: new Date().toISOString(),
            stores: stores
          });
        };
        transaction.onerror = function () { reject(transaction.error || new Error("No se pudo leer una copia consistente")); };
        transaction.onabort = function () { reject(transaction.error || new Error("La copia consistente fue cancelada")); };
      });
    });
  }
  function writeDiskSnapshot(force) {
    if (!diskSnapshotServiceReady || !diskSnapshotWritesEnabled || diskSnapshotPaused || !localDataToken) return Promise.resolve(false);
    if (diskSnapshotWriting) { diskSnapshotQueued = true; return diskSnapshotCurrentPromise || Promise.resolve(false); }
    if (!force) {
      clearTimeout(diskSnapshotTimer);
      diskSnapshotTimer = setTimeout(function () { writeDiskSnapshot(true); }, 650);
      return Promise.resolve(true);
    }
    clearTimeout(diskSnapshotTimer);
    diskSnapshotWriting = true;
    diskSnapshotQueued = false;
    diskSnapshotCurrentPromise = buildSnapshotEnvelope().then(function (snapshot) {
      return snapshotRequest("", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(snapshot)
      });
    }).then(function (response) {
      if (!response.ok) throw new Error("No se pudo escribir el respaldo local");
      updatePersistenceStatus("Datos guardados y respaldados en este equipo", "safe");
      return true;
    }).catch(function () {
      updatePersistenceStatus("Guardado local activo; copia en disco pendiente", "warning");
      return false;
    }).then(function (result) {
      diskSnapshotWriting = false;
      var needsAnotherWrite = diskSnapshotQueued;
      diskSnapshotQueued = false;
      if (needsAnotherWrite) return writeDiskSnapshot(true).then(function () { return result; });
      return result;
    });
    return diskSnapshotCurrentPromise;
  }
  function scheduleDiskSnapshot() { return writeDiskSnapshot(false); }
  function databaseIsCompletelyEmpty() {
    return Promise.all(STORES.map(all)).then(function (sets) { return sets.every(function (rows) { return rows.length === 0; }); });
  }
  function replaceDatabaseFromSnapshot(snapshot) {
    return dbPromise.then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(STORES, "readwrite");
        STORES.forEach(function (store) {
          var objectStore = transaction.objectStore(store);
          objectStore.clear();
          (snapshot.stores[store] || []).forEach(function (record) { objectStore.put(record); });
        });
        transaction.oncomplete = function () { resolve(true); };
        transaction.onerror = function () { reject(transaction.error || new Error("No se pudo restaurar la base local")); };
        transaction.onabort = function () { reject(transaction.error || new Error("Restauracion cancelada")); };
      });
    });
  }
  function clearStoresAtomic(storeNames) {
    return dbPromise.then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(storeNames, "readwrite");
        storeNames.forEach(function (store) { transaction.objectStore(store).clear(); });
        transaction.oncomplete = function () { resolve(true); };
        transaction.onerror = function () { reject(transaction.error || new Error("No se pudo limpiar la base local")); };
        transaction.onabort = function () { reject(transaction.error || new Error("Limpieza cancelada")); };
      });
    });
  }
  function loadDiskSnapshotWithRetry() {
    var attempts = 0;
    function attempt() {
      attempts += 1;
      return snapshotRequest("").then(function (response) {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Servicio de respaldo no disponible");
        return response.json().then(function (snapshot) {
          if (!validSnapshot(snapshot)) throw new Error("Respaldo local invalido");
          return snapshot;
        });
      }).catch(function (error) {
        if (attempts >= 12) throw error;
        return waitMilliseconds(250).then(attempt);
      });
    }
    return attempt();
  }
  function initializeDataPersistence() {
    localDataToken = readLocalDataToken();
    if (!localDataToken) {
      diskSnapshotServiceReady = false;
      diskSnapshotWritesEnabled = false;
      if (location.protocol === "file:") updatePersistenceStatus("Abra LaViejaEsquina.exe para activar la copia de seguridad", "warning");
      else updatePersistenceStatus("MODO PREVIEW: no cargar ventas reales aqui", "preview");
      return Promise.resolve();
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    return loadDiskSnapshotWithRetry().then(function (snapshot) {
      diskSnapshotServiceReady = true;
      return databaseIsCompletelyEmpty().then(function (emptyDatabase) {
        if (emptyDatabase && snapshot) {
          diskSnapshotPaused = true;
          return replaceDatabaseFromSnapshot(snapshot).then(function () {
            diskSnapshotPaused = false;
            updatePersistenceStatus("Datos recuperados y respaldados en este equipo", "safe");
          });
        }
      }).then(function () {
        diskSnapshotPaused = false;
        diskSnapshotWritesEnabled = true;
        updatePersistenceStatus("Datos guardados y respaldados en este equipo", "safe");
      });
    }).catch(function () {
      diskSnapshotServiceReady = false;
      diskSnapshotWritesEnabled = false;
      updatePersistenceStatus("Guardado local activo; reinicie para activar la copia en disco", "warning");
    });
  }
  function archiveCurrentSnapshot() {
    if (!diskSnapshotServiceReady || !localDataToken) return Promise.resolve(false);
    return buildSnapshotEnvelope().then(function (snapshot) {
      return snapshotRequest("/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(snapshot)
      });
    }).then(function (response) {
      if (!response.ok) throw new Error("No se pudo archivar la base actual");
      return true;
    });
  }
  function applyRequestedCleanSlateOnce() {
    // Legacy migration intentionally disabled: startup must never erase a live store.
    return Promise.resolve(false);
  }
  function tx(store, mode, fn) {
    return dbPromise.then(function (db) {
      return new Promise(function (resolve, reject) {
        var tr = db.transaction(store, mode);
        var os = tr.objectStore(store);
        var out = fn(os);
        tr.oncomplete = function () {
          resolve(out);
          if (mode === "readwrite" && diskSnapshotWritesEnabled && !diskSnapshotPaused) scheduleDiskSnapshot();
        };
        tr.onerror = function () { reject(tr.error); };
      });
    });
  }
  function add(store, record) { return tx(store, "readwrite", function (os) { os.put(record); return record; }); }
  function addMany(store, records) {
    records = records || [];
    if (!records.length) return Promise.resolve([]);
    return tx(store, "readwrite", function (os) {
      records.forEach(function (record) { os.put(record); });
      return records;
    });
  }
  function del(store, id) { return tx(store, "readwrite", function (os) { os.delete(id); return id; }); }
  function clearStore(store) { return tx(store, "readwrite", function (os) { os.clear(); return true; }); }
  function all(store) {
    return dbPromise.then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(store).objectStore(store).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function audit(action, detail, severity) {
    return add("auditLog", {
      id: uid(), createdAt: nowIso(), userId: currentUser && currentUser.id,
      username: currentUser && currentUser.username, action: action, detail: detail || "",
      severity: severity || "normal"
    });
  }
  function commitMercadoLibrePublication(candidate, listing, warning) {
    if (!isAdmin()) return Promise.reject(new Error("Solo admin/dev"));
    return dbPromise.then(function (db) {
      return new Promise(function (resolve, reject) {
        var stamp = nowIso();
        var transaction = db.transaction(["mlCandidates", "mlListings", "mlSyncEvents", "auditLog"], "readwrite");
        transaction.objectStore("mlCandidates").put(candidate);
        transaction.objectStore("mlListings").put(listing);
        transaction.objectStore("mlSyncEvents").put({
          id: uid(), candidateId: candidate.id, listingId: listing.id, mlItemId: listing.mlItemId,
          type: warning ? "PUBLISH_PARTIAL" : "PUBLISHED", detail: warning || "Publicacion creada",
          createdAt: stamp, createdBy: currentUser && currentUser.id
        });
        transaction.objectStore("auditLog").put({
          id: uid(), createdAt: stamp, userId: currentUser && currentUser.id,
          username: currentUser && currentUser.username, action: warning ? "ML_PUBLISH_PARTIAL" : "ML_PUBLISHED",
          detail: listing.mlItemId + (warning ? " · " + warning : ""), severity: warning ? "critical" : "important"
        });
        transaction.oncomplete = function () { scheduleDiskSnapshot(); resolve({ candidate: candidate, listing: listing }); };
        transaction.onerror = function () { reject(transaction.error); };
        transaction.onabort = function () { reject(transaction.error || new Error("No se pudo guardar el ID de Mercado Libre")); };
      });
    });
  }

  function productCostPools(product) {
    var stock = Math.max(0, Number(product.stock || 0));
    var known = Math.max(0, Number(product.knownCostQuantity || 0));
    var unknown = product.unknownCostQuantity == null ? Math.max(0, stock - known) : Math.max(0, Number(product.unknownCostQuantity || 0));
    if (known + unknown < stock) unknown += stock - known - unknown;
    return { known: moneyPrecision(known), unknown: moneyPrecision(unknown), value: Math.max(0, Number(product.knownCostValue || 0)) };
  }
  function applyCostPools(product, pools) {
    product.knownCostQuantity = moneyPrecision(pools.known);
    product.unknownCostQuantity = moneyPrecision(pools.unknown);
    product.knownCostValue = moneyPrecision(pools.value);
    product.weightedAverageCostPerSaleUnit = pools.known > 0 ? moneyPrecision(pools.value / pools.known) : null;
    product.costCoveragePct = product.stock > 0 ? Math.min(100, moneyPrecision(pools.known / product.stock * 100)) : 0;
    product.costState = pools.unknown > 0 ? (product.latestCostPerSaleUnit != null ? "REPLACEMENT_ONLY" : "UNKNOWN") : (pools.known > 0 ? "KNOWN" : (product.latestCostPerSaleUnit != null ? "REPLACEMENT_ONLY" : "UNKNOWN"));
    return product;
  }
  function supplierSave(record) {
    if (!isAdmin()) return Promise.reject(new Error("Solo admin/dev"));
    return all("suppliers").then(function (rows) {
      var prior = rows.filter(function (row) { return row.id === record.id; })[0] || null;
      var saved = Object.assign({}, prior || {}, record, { id: record.id || uid(), active: record.active !== false, updatedAt: nowIso(), updatedBy: currentUser && currentUser.id });
      saved.createdAt = saved.createdAt || saved.updatedAt; saved.createdBy = saved.createdBy || saved.updatedBy;
      var before = prior ? JSON.stringify({name:prior.name,contactName:prior.contactName,phones:prior.phones,email:prior.email,paymentTerms:prior.paymentTerms,active:prior.active}) : "nuevo";
      var after = JSON.stringify({name:saved.name,contactName:saved.contactName,phones:saved.phones,email:saved.email,paymentTerms:saved.paymentTerms,active:saved.active});
      return dbPromise.then(function (db) { return new Promise(function (resolve, reject) { var tr=db.transaction(["suppliers","auditLog"],"readwrite");tr.objectStore("suppliers").put(saved);tr.objectStore("auditLog").put({id:uid(),createdAt:nowIso(),userId:currentUser.id,username:currentUser.username,action:prior?"SUPPLIER_EDITED":"SUPPLIER_CREATED",detail:"Antes: "+before+" | Despues: "+after,severity:"normal"});tr.oncomplete=function(){scheduleDiskSnapshot();resolve(saved);};tr.onerror=function(){reject(tr.error);};tr.onabort=function(){reject(tr.error||new Error("Guardado cancelado"));}; }); });
    });
  }
  function normalizeInvoiceNumber(value) { return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, ""); }
  function purchaseFindDuplicateInvoice(supplierId, invoiceNumber, excludeId) {
    var normalized = normalizeInvoiceNumber(invoiceNumber); if (!normalized) return Promise.resolve(null);
    return all("purchases").then(function (rows) { return rows.filter(function (p) { return p.id !== excludeId && p.supplierId === supplierId && p.status !== "VOIDED" && normalizeInvoiceNumber(p.invoiceNumber) === normalized; })[0] || null; });
  }
  function recalculatePurchase(purchase, lines) {
    ["discounts","freight","taxes","otherCosts"].forEach(function (field) { var value=Number(purchase[field]||0);if(!isFinite(value)||value<0)throw new Error("Importe invalido en "+field);purchase[field]=moneyPrecision(value); });
    lines.forEach(function (line) { ["packagesReceived","bonusPackages","packageSize","costPerPackage","lineDiscount"].forEach(function(field){var value=Number(line[field]||0);if(!isFinite(value)||value<0)throw new Error("Cantidad o costo invalido en "+(line.productNameSnapshot||"una linea"));line[field]=moneyPrecision(value);});if(line.packageSize<=0||line.packagesReceived+line.bonusPackages<=0)throw new Error("Complete cantidad y contenido en "+(line.productNameSnapshot||"una linea"));if(line.lineDiscount>line.costPerPackage*line.packagesReceived)throw new Error("El descuento de linea supera su costo"); });
    var paid = lines.reduce(function (s, l) { return s + Math.max(0, Number(l.costPerPackage || 0) * Number(l.packagesReceived || 0) - Number(l.lineDiscount || 0)); }, 0);
    var adjustment = -Number(purchase.discounts || 0) + Number(purchase.freight || 0) + Number(purchase.taxes || 0) + Number(purchase.otherCosts || 0);
    lines.forEach(function (l) {
      l.totalSaleQuantity = moneyPrecision((Number(l.packagesReceived || 0) + Number(l.bonusPackages || 0)) * Number(l.packageSize || 0));
      l.grossSubtotal = moneyPrecision(Number(l.costPerPackage || 0) * Number(l.packagesReceived || 0));
      var base = Math.max(0, l.grossSubtotal - Number(l.lineDiscount || 0)); var ratio = paid > 0 ? base / paid : 0;
      l.allocatedDiscount = moneyPrecision(Number(purchase.discounts || 0) * ratio); l.allocatedFreight = moneyPrecision(Number(purchase.freight || 0) * ratio);
      l.allocatedTaxes = moneyPrecision(Number(purchase.taxes || 0) * ratio); l.allocatedOther = moneyPrecision(Number(purchase.otherCosts || 0) * ratio);
      l.baseCostPerSaleUnit = l.totalSaleQuantity > 0 ? moneyPrecision(base / l.totalSaleQuantity) : 0;
      l.landedLineCost = moneyPrecision(base + adjustment * ratio); if(l.landedLineCost<0)throw new Error("El costo final de una linea no puede ser negativo"); l.costPerSaleUnit = l.totalSaleQuantity > 0 ? moneyPrecision(l.landedLineCost / l.totalSaleQuantity) : 0;
    });
    purchase.subtotal = moneyPrecision(lines.reduce(function (s,l) { return s + l.grossSubtotal; }, 0));
    purchase.lineDiscountTotal = moneyPrecision(lines.reduce(function (s,l) { return s + Number(l.lineDiscount || 0); }, 0));
    purchase.netProductsTotal = moneyPrecision(purchase.subtotal - purchase.lineDiscountTotal);
    purchase.total = moneyPrecision(purchase.netProductsTotal - Number(purchase.discounts || 0) + Number(purchase.freight || 0) + Number(purchase.taxes || 0) + Number(purchase.otherCosts || 0));
    if (purchase.total < 0) throw new Error("El total final de factura no puede ser negativo");
    if (paid <= 0 && Math.abs(purchase.total) > .009) {
      var quantityTotal=lines.reduce(function(sum,line){return sum+Number(line.totalSaleQuantity||0);},0);if(quantityTotal<=0)throw new Error("No se pueden distribuir costos sin cantidades");
      lines.forEach(function(line){var ratio=Number(line.totalSaleQuantity||0)/quantityTotal;line.allocatedDiscount=moneyPrecision(Number(purchase.discounts||0)*ratio);line.allocatedFreight=moneyPrecision(Number(purchase.freight||0)*ratio);line.allocatedTaxes=moneyPrecision(Number(purchase.taxes||0)*ratio);line.allocatedOther=moneyPrecision(Number(purchase.otherCosts||0)*ratio);line.landedLineCost=moneyPrecision(purchase.total*ratio);line.costPerSaleUnit=line.totalSaleQuantity>0?moneyPrecision(line.landedLineCost/line.totalSaleQuantity):0;});
    }
    var landedTotal = moneyPrecision(lines.reduce(function (sum, line) { return sum + Number(line.landedLineCost || 0); }, 0));
    var residual = moneyPrecision(purchase.total - landedTotal);
    var residualLine = lines.slice().reverse().filter(function (line) { return Number(line.grossSubtotal || 0) - Number(line.lineDiscount || 0) > 0; })[0] || lines.slice().reverse().filter(function(line){return Number(line.totalSaleQuantity||0)>0;})[0];
    if (residualLine && Math.abs(residual) > .001) { residualLine.landedLineCost = moneyPrecision(residualLine.landedLineCost + residual); residualLine.costPerSaleUnit = residualLine.totalSaleQuantity > 0 ? moneyPrecision(residualLine.landedLineCost / residualLine.totalSaleQuantity) : 0; }
    return { purchase: purchase, lines: lines };
  }
  function purchaseSaveDraft(purchase, lines) {
    if (!isAdmin()) return Promise.reject(new Error("Solo admin/dev"));
    purchase = Object.assign({}, purchase || {});
    var requestedId = purchase.id || uid();
    var explicitExpectedUpdatedAt = purchase.expectedUpdatedAt == null ? null : String(purchase.expectedUpdatedAt);
    delete purchase.expectedUpdatedAt;
    return Promise.all([all("purchases"), all("purchaseLines")]).then(function (sets) {
      var prior = sets[0].filter(function (row) { return row.id === requestedId; })[0];
      if (prior && prior.status !== "DRAFT") throw new Error("Solo se puede editar un pedido en borrador");
      if (prior && explicitExpectedUpdatedAt != null && String(prior.updatedAt || "") !== explicitExpectedUpdatedAt) throw new Error("El borrador cambio en otra ventana; vuelva a abrirlo antes de guardar");
      var expectedUpdatedAt = explicitExpectedUpdatedAt != null ? explicitExpectedUpdatedAt : (prior ? String(prior.updatedAt || "") : null);
      purchase = Object.assign({}, prior || {}, purchase, { id: requestedId, status: "DRAFT", updatedAt: nowIso(), updatedBy: currentUser && currentUser.id });
      purchase.createdAt = purchase.createdAt || purchase.updatedAt; purchase.createdBy = purchase.createdBy || purchase.updatedBy;
      lines = (lines || []).map(function (line) { return Object.assign({}, line, { id: line.id || uid(), purchaseId: purchase.id }); });
      recalculatePurchase(purchase, lines);
      var stale = sets[1].filter(function (line) { return line.purchaseId === purchase.id && !lines.some(function (next) { return next.id === line.id; }); });
      return dbPromise.then(function (db) { return new Promise(function (resolve, reject) {
        var tr = db.transaction(["purchases", "purchaseLines", "auditLog"], "readwrite"), purchaseStore = tr.objectStore("purchases"), lineStore = tr.objectStore("purchaseLines"), abortMessage = "";
        var currentRequest = purchaseStore.get(purchase.id);
        currentRequest.onsuccess = function () {
          var current = currentRequest.result || null;
          if (prior) {
            if (!current || current.status !== "DRAFT") abortMessage = "El pedido ya fue confirmado o anulado";
            else if (String(current.updatedAt || "") !== String(expectedUpdatedAt || "")) abortMessage = "El borrador cambio en otra ventana; vuelva a abrirlo antes de guardar";
          } else if (current) abortMessage = "Ya existe otro pedido con este identificador";
          if (abortMessage) { tr.abort(); return; }
          purchaseStore.put(purchase); stale.forEach(function (line) { lineStore.delete(line.id); }); lines.forEach(function (line) { lineStore.put(line); });
          tr.objectStore("auditLog").put({ id: uid(), createdAt: nowIso(), userId: currentUser.id, username: currentUser.username, action: "PURCHASE_DRAFT_SAVED", detail: purchase.id, severity: "normal" });
        };
        tr.oncomplete = function () { scheduleDiskSnapshot(); resolve({ purchase: purchase, lines: lines }); };
        tr.onerror = function () { reject(tr.error); }; tr.onabort = function () { reject(abortMessage ? new Error(abortMessage) : (tr.error || new Error("Guardado cancelado"))); };
      }); });
    });
  }
  function purchaseProductState(product) {
    var pools = productCostPools(product);
    return {
      updatedAt: product.updatedAt || "", active: product.active !== false,
      name: product.name || "", category: product.category || "", unitType: product.unitType || "", priceUnit: product.priceUnit || "", barcode: product.barcode || "",
      price: moneyPrecision(product.price), targetMarkupPct: product.targetMarkupPct == null || product.targetMarkupPct === "" ? null : Number(product.targetMarkupPct),
      stock: moneyPrecision(product.stock), knownCostQuantity: pools.known, unknownCostQuantity: pools.unknown,
      knownCostValue: moneyPrecision(pools.value), weightedAverageCostPerSaleUnit: product.weightedAverageCostPerSaleUnit == null ? null : moneyPrecision(product.weightedAverageCostPerSaleUnit),
      costState: product.costState || "UNKNOWN", costCoveragePct: moneyPrecision(product.costCoveragePct),
      latestCostPerSaleUnit: product.latestCostPerSaleUnit == null ? null : moneyPrecision(product.latestCostPerSaleUnit),
      previousCostPerSaleUnit: product.previousCostPerSaleUnit == null ? null : moneyPrecision(product.previousCostPerSaleUnit),
      suggestedPrice: product.suggestedPrice == null ? null : moneyPrecision(product.suggestedPrice),
      latestPurchaseId: product.latestPurchaseId || "", latestPurchaseAt: product.latestPurchaseAt || "",
      latestCostSupplierId: product.latestCostSupplierId || "", latestCostSupplierName: product.latestCostSupplierName || "",
      purchaseUnit: product.purchaseUnit || "", purchaseUnitQuantity: product.purchaseUnitQuantity == null ? null : Number(product.purchaseUnitQuantity)
    };
  }
  function restorePurchaseProductState(product, state) {
    if (!state) throw new Error("Falta el estado historico exacto del producto");
    purchaseManagedProductFields().forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(state, key)) product[key] = state[key];
    });
    return product;
  }
  function purchaseManagedProductFields() {
    return [
      "stock", "knownCostQuantity", "unknownCostQuantity", "knownCostValue", "weightedAverageCostPerSaleUnit", "costState", "costCoveragePct",
      "latestCostPerSaleUnit", "previousCostPerSaleUnit", "latestPurchaseId", "latestPurchaseAt", "latestCostSupplierId", "latestCostSupplierName",
      "purchaseUnit", "purchaseUnitQuantity"
    ];
  }
  function purchaseProductStateMatches(product, expected) {
    if (!expected) return false;
    var actual = purchaseProductState(product), numeric = ["price","targetMarkupPct","stock","knownCostQuantity","unknownCostQuantity","knownCostValue","weightedAverageCostPerSaleUnit","costCoveragePct","latestCostPerSaleUnit","previousCostPerSaleUnit","suggestedPrice","purchaseUnitQuantity"];
    return Object.keys(expected).every(function (key) {
      if (numeric.indexOf(key) >= 0) {
        if (actual[key] == null || expected[key] == null) return actual[key] == null && expected[key] == null;
        return Math.abs(Number(actual[key]) - Number(expected[key])) < .000001;
      }
      return String(actual[key] == null ? "" : actual[key]) === String(expected[key] == null ? "" : expected[key]);
    });
  }
  function purchaseHistoricalStateMatches(product, expected) {
    if (!expected) return false;
    var historical = {};
    purchaseManagedProductFields().forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(expected, key)) historical[key] = expected[key];
    });
    return purchaseProductStateMatches(product, historical);
  }
  function purchaseProcurementMetadataFields() {
    return ["latestCostPerSaleUnit", "previousCostPerSaleUnit", "latestPurchaseId", "latestPurchaseAt", "latestCostSupplierId", "latestCostSupplierName", "purchaseUnit", "purchaseUnitQuantity"];
  }
  function purchaseProcurementMetadataMatches(actual, expected) {
    if (!actual || !expected) return false;
    var expectedMetadata = {};
    purchaseProcurementMetadataFields().forEach(function (key) { if (Object.prototype.hasOwnProperty.call(expected, key)) expectedMetadata[key] = expected[key]; });
    var numeric = ["latestCostPerSaleUnit", "previousCostPerSaleUnit", "purchaseUnitQuantity"];
    return Object.keys(expectedMetadata).every(function (key) {
      if (numeric.indexOf(key) >= 0) {
        if (actual[key] == null || expectedMetadata[key] == null) return actual[key] == null && expectedMetadata[key] == null;
        return Math.abs(Number(actual[key]) - Number(expectedMetadata[key])) < .000001;
      }
      return String(actual[key] == null ? "" : actual[key]) === String(expectedMetadata[key] == null ? "" : expectedMetadata[key]);
    });
  }
  function restorePurchaseProcurementMetadata(product, state) {
    purchaseProcurementMetadataFields().forEach(function (key) { if (state && Object.prototype.hasOwnProperty.call(state, key)) product[key] = state[key]; });
    return product;
  }
  function purchaseCompensatingDecrease(product, quantity, stamp) {
    quantity = moneyPrecision(quantity);
    var currentStock = moneyPrecision(product.stock), pools = productCostPools(product);
    if (!(quantity > 0) || currentStock + .000001 < quantity) throw new Error("Stock insuficiente para revertir " + product.name + ". Ajuste primero el stock fisico y vuelva a intentar");
    var unknownRemoved = Math.min(quantity, pools.unknown), remaining = moneyPrecision(quantity - unknownRemoved);
    var knownRemoved = Math.min(remaining, pools.known), weightedCost = pools.known > 0 ? pools.value / pools.known : 0, valueRemoved = moneyPrecision(knownRemoved * weightedCost);
    if (remaining - knownRemoved > .000001) throw new Error("Las capas de costo de " + product.name + " no cubren el stock a revertir; concilie el stock antes de continuar");
    pools.unknown = moneyPrecision(pools.unknown - unknownRemoved); pools.known = moneyPrecision(pools.known - knownRemoved); pools.value = moneyPrecision(Math.max(0, pools.value - valueRemoved));
    product.stock = moneyPrecision(currentStock - quantity); applyCostPools(product, pools); product.updatedAt = stamp;
    return { knownCostQuantity: -moneyPrecision(knownRemoved), unknownCostQuantity: -moneyPrecision(unknownRemoved), knownCostValue: -valueRemoved };
  }
  function purchaseApplyReceipt(product, line, purchase, stamp) {
    var before = purchaseProductState(product), pools = productCostPools(product), oldCost = product.latestCostPerSaleUnit;
    var qty = Number(line.totalSaleQuantity || 0), value = Number(line.landedLineCost || 0);
    var paidLine = Number(line.grossSubtotal || 0) - Number(line.lineDiscount || 0) > 0 || value > 0;
    product.stock = moneyPrecision(Number(product.stock || 0) + qty); pools.known += qty; pools.value += value;
    if (paidLine) { product.previousCostPerSaleUnit = oldCost == null ? null : oldCost; product.latestCostPerSaleUnit = line.costPerSaleUnit; }
    var hasMarkup = product.targetMarkupPct !== null && product.targetMarkupPct !== undefined && product.targetMarkupPct !== "" && isFinite(Number(product.targetMarkupPct));
    if (paidLine) product.suggestedPrice = hasMarkup ? moneyPrecision(line.costPerSaleUnit * (1 + Number(product.targetMarkupPct) / 100)) : null;
    product.purchaseUnit = line.purchaseUnit || "unidad"; product.purchaseUnitQuantity = Number(line.packageSize || 0);
    product.latestPurchaseId = purchase.id; product.latestPurchaseAt = purchase.deliveryDate || stamp;
    product.latestCostSupplierId = purchase.supplierId; product.latestCostSupplierName = purchase.supplierSnapshot && purchase.supplierSnapshot.name || "";
    product.updatedAt = stamp; applyCostPools(product, pools);
    return { beforeState: before, afterState: purchaseProductState(product), oldCost: oldCost, paidLine: paidLine, hasMarkup: hasMarkup };
  }
  function purchasePriceReviewWrites(existingReviews, affected, products, beforeStates, purchase, latestLines, stamp, sourceType, note) {
    var writes = [];
    (existingReviews || []).filter(function (review) { return review.status === "PENDING" && affected[review.productId]; }).forEach(function (review) {
      writes.push(Object.assign({}, review, { status: "SUPERSEDED", actionAt: stamp, actionBy: currentUser.id, actionNote: note }));
    });
    Object.keys(affected).forEach(function (productId) {
      var product = products[productId], before = beforeStates[productId] || {}, line = latestLines[productId] || {};
      var hasMarkup = product.targetMarkupPct !== null && product.targetMarkupPct !== undefined && product.targetMarkupPct !== "" && isFinite(Number(product.targetMarkupPct));
      var costChanged = (before.latestCostPerSaleUnit == null) !== (product.latestCostPerSaleUnit == null) || (before.latestCostPerSaleUnit != null && Math.abs(Number(before.latestCostPerSaleUnit) - Number(product.latestCostPerSaleUnit)) > .009);
      var suggestion = hasMarkup && product.latestCostPerSaleUnit != null ? moneyPrecision(Number(product.latestCostPerSaleUnit) * (1 + Number(product.targetMarkupPct) / 100)) : null;
      if (!costChanged && (suggestion == null || Math.abs(Number(suggestion) - Number(product.price || 0)) <= .009)) return;
      writes.push({ id: uid(), productId: productId, productName: product.name, status: "PENDING", previousCostPerSaleUnit: before.latestCostPerSaleUnit == null ? null : before.latestCostPerSaleUnit, newCostPerSaleUnit: product.latestCostPerSaleUnit == null ? null : product.latestCostPerSaleUnit, currentPrice: Number(product.price || 0), suggestedPrice: suggestion, proposedPrice: suggestion, targetMarkupPct: hasMarkup ? Number(product.targetMarkupPct) : null, needsTargetMarkup: !hasMarkup, sourceType: sourceType, sourcePurchaseId: purchase.id, sourcePurchaseLineId: line.id || "", createdAt: stamp, createdBy: currentUser.id });
    });
    return writes;
  }
  function purchaseBalanceEntry(purchase, stamp, entryId) {
    var supplierName = purchase && purchase.supplierSnapshot && purchase.supplierSnapshot.name || "Proveedor";
    return {
      id: entryId || ("purchase-expense-" + purchase.id), type: "EXPENSE", date: localDateKey(new Date(stamp || nowIso())),
      amount: moneyPrecision(Number(purchase && purchase.total || 0)), category: "Compra a proveedor",
      description: supplierName + (purchase && purchase.invoiceNumber ? " · Factura " + purchase.invoiceNumber : ""),
      paymentMethod: purchase && purchase.paymentTerms || "Proveedor", recurring: false,
      sourceType: "PURCHASE", sourcePurchaseId: purchase.id, automatic: true,
      createdBy: currentUser && currentUser.id, createdAt: stamp || nowIso()
    };
  }
  function purchaseConfirm(purchaseId) {
    if (!isAdmin()) return Promise.reject(new Error("Solo admin/dev"));
    return Promise.all([all("purchases"), all("purchaseLines"), all("products"), all("suppliers"), all("priceReviews")]).then(function (sets) {
      var purchase = sets[0].filter(function (row) { return row.id === purchaseId; })[0];
      if (!purchase || purchase.status !== "DRAFT") throw new Error("El pedido no esta en borrador");
      var draftUpdatedAt = String(purchase.updatedAt || "");
      var supplier = sets[3].filter(function (row) { return row.id === purchase.supplierId && row.active !== false; })[0];
      if (!supplier) throw new Error("Seleccione un proveedor existente y activo");
      var duplicate = sets[0].filter(function (row) { return row.id !== purchase.id && row.supplierId === purchase.supplierId && row.status !== "VOIDED" && normalizeInvoiceNumber(purchase.invoiceNumber) && normalizeInvoiceNumber(row.invoiceNumber) === normalizeInvoiceNumber(purchase.invoiceNumber); })[0];
      if (duplicate) throw new Error("Ya existe un pedido de este proveedor con la misma factura");
      var lines = sets[1].filter(function (line) { return line.purchaseId === purchaseId; });
      if (!lines.length) throw new Error("Pedido sin productos");
      purchase.supplierSnapshot = { id: supplier.id, name: supplier.name || "", contactName: supplier.contactName || "" };
      recalculatePurchase(purchase, lines);
      var products = {}, affected = {}, beforeStates = {}, latestLines = {}, movements = [], history = [], stamp = nowIso();
      sets[2].forEach(function (product) { products[product.id] = Object.assign({}, product); });
      lines.forEach(function (line, sequence) {
        var product = products[line.productId];
        if (!product || product.active === false || Number(line.totalSaleQuantity || 0) <= 0) throw new Error("Producto inexistente/inactivo o cantidad invalida");
        line.productNameSnapshot = product.name; line.productCategorySnapshot = product.category || "General";
        line.purchaseUnit = line.purchaseUnit || "unidad"; line.saleUnit = line.saleUnit || product.unitType || "unidad";
        line.supplierNameSnapshot = purchase.supplierSnapshot.name; line.invoiceNumberSnapshot = purchase.invoiceNumber || ""; line.deliveryDateSnapshot = purchase.deliveryDate || "";
        line.operatorSnapshot = { id: currentUser.id, name: currentUser.displayName || currentUser.username };
        if (!affected[product.id]) beforeStates[product.id] = purchaseProductState(product);
        var applied = purchaseApplyReceipt(product, line, purchase, stamp);
        affected[product.id] = true; latestLines[product.id] = line;
        movements.push({ id: uid(), type: "PURCHASE_RECEIPT", lineSequence: sequence, productId: product.id, quantity: Number(line.totalSaleQuantity), knownCostQuantity: Number(line.totalSaleQuantity), knownCostValue: Number(line.landedLineCost || 0), unitCost: line.costPerSaleUnit, referenceType: "PURCHASE", referenceId: purchase.id, referenceLineId: line.id, beforeState: applied.beforeState, afterState: applied.afterState, createdAt: stamp, createdBy: currentUser.id });
        history.push({ id: uid(), type: "PURCHASE_CONFIRMED", purchaseId: purchase.id, purchaseLineId: line.id, productId: product.id, productName: product.name, supplierId: purchase.supplierId, supplierName: purchase.supplierSnapshot.name, quantity: line.totalSaleQuantity, purchaseUnit: line.purchaseUnit, saleUnit: line.saleUnit, baseCostPerSaleUnit: line.baseCostPerSaleUnit, costPerSaleUnit: line.costPerSaleUnit, landedLineCost: line.landedLineCost, invoiceNumber: purchase.invoiceNumber || "", deliveryDate: purchase.deliveryDate || "", operatorName: currentUser.displayName || currentUser.username, createdAt: stamp, createdBy: currentUser.id });
      });
      var reviewWrites = [];
      purchase.status = "CONFIRMED"; purchase.confirmedAt = stamp; purchase.confirmedBy = currentUser.id; purchase.updatedAt = stamp;
      var balanceEntry = null;
      if (Number(purchase.total || 0) > 0) {
        purchase.balanceEntryId = "purchase-expense-" + purchase.id;
        balanceEntry = purchaseBalanceEntry(purchase, stamp, purchase.balanceEntryId);
      } else {
        delete purchase.balanceEntryId;
      }
      return dbPromise.then(function (db) { return new Promise(function (resolve, reject) {
        var names = ["purchases","purchaseLines","products","suppliers","inventoryMovements","purchaseCostHistory","priceReviews","monthlyEntries","auditLog"], transaction = db.transaction(names, "readwrite"), purchaseStore = transaction.objectStore("purchases"), lineStore = transaction.objectStore("purchaseLines");
        var productIds = Object.keys(affected), pendingChecks = 4 + productIds.length, abortMessage = "";
        function finishCheck() {
          pendingChecks -= 1; if (pendingChecks > 0) return;
          if (abortMessage) { transaction.abort(); return; }
          purchaseStore.put(purchase); lines.forEach(function (line) { lineStore.put(line); });
          productIds.forEach(function (productId) { transaction.objectStore("products").put(products[productId]); });
          movements.forEach(function (movement) { transaction.objectStore("inventoryMovements").put(movement); }); history.forEach(function (row) { transaction.objectStore("purchaseCostHistory").put(row); }); reviewWrites.forEach(function (review) { transaction.objectStore("priceReviews").put(review); });
          if (balanceEntry) transaction.objectStore("monthlyEntries").put(balanceEntry);
          transaction.objectStore("auditLog").put({ id: uid(), createdAt: stamp, userId: currentUser.id, username: currentUser.username, action: "PURCHASE_CONFIRMED", detail: purchase.id, severity: "warning" });
        }
        var purchaseCheck = purchaseStore.get(purchase.id);
        purchaseCheck.onsuccess = function () { if (!purchaseCheck.result || purchaseCheck.result.status !== "DRAFT" || String(purchaseCheck.result.updatedAt || "") !== draftUpdatedAt) abortMessage = "El pedido cambio o ya fue procesado"; finishCheck(); };
        var duplicateCheck = purchaseStore.getAll();
        duplicateCheck.onsuccess = function () { var conflict=(duplicateCheck.result||[]).some(function(row){return row.id!==purchase.id&&row.status!=="VOIDED"&&row.supplierId===purchase.supplierId&&normalizeInvoiceNumber(purchase.invoiceNumber)&&normalizeInvoiceNumber(row.invoiceNumber)===normalizeInvoiceNumber(purchase.invoiceNumber);});if(conflict)abortMessage="La factura fue cargada por otro proceso";finishCheck(); };
        var supplierCheck = transaction.objectStore("suppliers").get(purchase.supplierId);
        supplierCheck.onsuccess = function () { if (!supplierCheck.result || supplierCheck.result.active === false) abortMessage = "El proveedor ya no esta activo"; finishCheck(); };
        var reviewCheck = transaction.objectStore("priceReviews").getAll();
        reviewCheck.onsuccess = function () { reviewWrites = purchasePriceReviewWrites(reviewCheck.result || [], affected, products, beforeStates, purchase, latestLines, stamp, "PURCHASE", "Reemplazada por el ingreso " + purchase.id); finishCheck(); };
        productIds.forEach(function (productId) { var productCheck=transaction.objectStore("products").get(productId);productCheck.onsuccess=function(){if(!productCheck.result||productCheck.result.active===false||!purchaseProductStateMatches(productCheck.result,beforeStates[productId]))abortMessage="El stock o costo de "+(products[productId]&&products[productId].name||productId)+" cambio mientras se confirmaba";finishCheck();}; });
        transaction.oncomplete = function () { invalidateProductSearchCache(); scheduleDiskSnapshot(); resolve({ purchase: purchase, lines: lines, products: products, movements: movements, costHistory: history, priceReviews: reviewWrites }); };
        transaction.onerror = function () { reject(transaction.error); }; transaction.onabort = function () { reject(abortMessage ? new Error(abortMessage) : (transaction.error || new Error("Confirmacion cancelada o pedido ya procesado"))); };
      }); });
    });
  }
  function purchaseVoid(id, reason) {
    if (!isAdmin()) return Promise.reject(new Error("Solo admin/dev"));
    reason = String(reason || "").trim();
    if (!reason) return Promise.reject(new Error("Indique el motivo"));
    return Promise.all([all("purchases"), all("purchaseLines"), all("products"), all("inventoryMovements"), all("priceReviews")]).then(function (sets) {
      var purchase = sets[0].filter(function (row) { return row.id === id; })[0];
      if (!purchase || ["DRAFT","CONFIRMED"].indexOf(purchase.status) < 0) throw new Error("Pedido inexistente, ya anulado o corregido");
      var priorStatus = purchase.status, purchaseUpdatedAt = String(purchase.updatedAt || ""), stamp = nowIso(), lines = sets[1].filter(function (line) { return line.purchaseId === id; });
      var products = {}, affected = {}, statesBeforeVoid = {}, latestLines = {}, reversals = [], histories = [];
      sets[2].forEach(function (product) { products[product.id] = Object.assign({}, product); });
      if (priorStatus === "CONFIRMED") {
        var lineById = {}; lines.forEach(function (line) { lineById[line.id] = line; });
        var receipts = sets[3].filter(function (movement) { return ["PURCHASE_RECEIPT","PURCHASE_CORRECTION_RECEIPT"].indexOf(movement.type) >= 0 && movement.referenceId === id; }).sort(function (a, b) { return Number(b.lineSequence || 0) - Number(a.lineSequence || 0); });
        if (receipts.length !== lines.length || receipts.some(function (movement) { return !movement.beforeState || !movement.afterState || !lineById[movement.referenceLineId]; })) throw new Error("El pedido no tiene estados historicos completos para una reversa segura");
        var receiptGroups = {}, compensatingProducts = {};
        receipts.forEach(function (receipt) { (receiptGroups[receipt.productId] = receiptGroups[receipt.productId] || []).push(receipt); });
        Object.keys(receiptGroups).forEach(function (productId) {
          var product = products[productId], group = receiptGroups[productId];
          if (!product) throw new Error("Falta un producto del pedido; no se puede revertir");
          statesBeforeVoid[productId] = purchaseProductState(product);
          var hasLaterMovement = sets[3].some(function (movement) { return movement.productId === productId && String(movement.createdAt || "") > String(purchase.confirmedAt || "") && movement.referenceId !== id; });
          compensatingProducts[productId] = hasLaterMovement || !purchaseHistoricalStateMatches(product, group[0].afterState);
        });
        receipts.forEach(function (receipt, reverseIndex) {
          var line = lineById[receipt.referenceLineId], product = products[receipt.productId];
          if (!product) throw new Error("Falta un producto del pedido; no se puede revertir");
          var reversalBefore = purchaseProductState(product);
          var compensated = compensatingProducts[product.id], poolDelta;
          if (compensated) poolDelta = purchaseCompensatingDecrease(product, Number(receipt.quantity || 0), stamp);
          else {
            if (!purchaseHistoricalStateMatches(product, receipt.afterState)) throw new Error("El stock/costo actual de " + product.name + " no coincide con el ingreso original");
            restorePurchaseProductState(product, receipt.beforeState);
            poolDelta = { knownCostQuantity: -Number(receipt.knownCostQuantity || 0), unknownCostQuantity: 0, knownCostValue: -Number(receipt.knownCostValue || 0) };
          }
          affected[product.id] = true; latestLines[product.id] = latestLines[product.id] || line;
          reversals.push({ id: uid(), type: "PURCHASE_VOID", reconciliationMode: compensated ? "COMPENSATING_UNKNOWN_FIRST" : "EXACT_STATE_RESTORE", lineSequence: reverseIndex, reversedLineSequence: receipt.lineSequence, reversedMovementId: receipt.id, productId: product.id, quantity: -Number(receipt.quantity || 0), knownCostQuantity: poolDelta.knownCostQuantity, unknownCostQuantity: poolDelta.unknownCostQuantity, knownCostValue: poolDelta.knownCostValue, originalReceiptKnownCostValue: Number(receipt.knownCostValue || 0), referenceType: "PURCHASE", referenceId: id, referenceLineId: line.id, beforeState: reversalBefore, afterState: purchaseProductState(product), reason: reason, createdAt: stamp, createdBy: currentUser.id });
          histories.push({ id: uid(), type: "PURCHASE_VOIDED", reconciliationMode: compensated ? "COMPENSATING_UNKNOWN_FIRST" : "EXACT_STATE_RESTORE", purchaseId: id, purchaseLineId: line.id, productId: product.id, quantity: -Number(receipt.quantity || 0), costPerSaleUnit: line.costPerSaleUnit, landedLineCost: poolDelta.knownCostValue, originalLandedLineCost: -Number(receipt.knownCostValue || 0), reason: reason, createdAt: stamp, createdBy: currentUser.id });
        });
        Object.keys(affected).forEach(function (productId) {
          var group = receiptGroups[productId];
          if (compensatingProducts[productId] && purchaseProcurementMetadataMatches(statesBeforeVoid[productId], group[0].afterState)) restorePurchaseProcurementMetadata(products[productId], group[group.length - 1].beforeState);
          products[productId].updatedAt = stamp;
          for (var movementIndex = reversals.length - 1; movementIndex >= 0; movementIndex -= 1) {
            if (reversals[movementIndex].productId === productId) { reversals[movementIndex].afterState = purchaseProductState(products[productId]); break; }
          }
        });
      }
      purchase.status = "VOIDED"; purchase.voidedAt = stamp; purchase.voidedBy = currentUser.id; purchase.voidReason = reason; purchase.updatedAt = stamp;
      var reviewWrites = [];
      return dbPromise.then(function (db) { return new Promise(function (resolve, reject) {
        var names = ["purchases","products","inventoryMovements","purchaseCostHistory","priceReviews","monthlyEntries","auditLog"], transaction = db.transaction(names,"readwrite"), purchaseStore = transaction.objectStore("purchases");
        var productIds = Object.keys(affected), pendingChecks = 2 + productIds.length, abortMessage = "";
        function finishCheck() {
          pendingChecks -= 1; if (pendingChecks > 0) return;
          if (abortMessage) { transaction.abort(); return; }
          purchaseStore.put(purchase); productIds.forEach(function (productId) { transaction.objectStore("products").put(products[productId]); });
          if (priorStatus === "CONFIRMED" && purchase.balanceEntryId) transaction.objectStore("monthlyEntries").delete(purchase.balanceEntryId);
          reversals.forEach(function (movement) { transaction.objectStore("inventoryMovements").put(movement); }); histories.forEach(function (row) { transaction.objectStore("purchaseCostHistory").put(row); }); reviewWrites.forEach(function (review) { transaction.objectStore("priceReviews").put(review); });
          transaction.objectStore("auditLog").put({ id: uid(), createdAt: stamp, userId: currentUser.id, username: currentUser.username, action: priorStatus === "CONFIRMED" ? "PURCHASE_VOIDED" : "PURCHASE_DRAFT_VOIDED", detail: id + " | " + reason, severity: "critical" });
        }
        var statusCheck = purchaseStore.get(id); statusCheck.onsuccess = function () { if (!statusCheck.result || statusCheck.result.status !== priorStatus || String(statusCheck.result.updatedAt || "") !== purchaseUpdatedAt) abortMessage = "El pedido cambio mientras se anulaba"; finishCheck(); };
        var reviewCheck = transaction.objectStore("priceReviews").getAll(); reviewCheck.onsuccess = function () { reviewWrites = purchasePriceReviewWrites(reviewCheck.result || [], affected, products, statesBeforeVoid, purchase, latestLines, stamp, "PURCHASE_VOID", "Pedido anulado " + id); finishCheck(); };
        productIds.forEach(function (productId) { var productCheck=transaction.objectStore("products").get(productId);productCheck.onsuccess=function(){if(!productCheck.result||!purchaseProductStateMatches(productCheck.result,statesBeforeVoid[productId]))abortMessage="El stock o costo de "+(products[productId]&&products[productId].name||productId)+" cambio mientras se anulaba";finishCheck();}; });
        transaction.oncomplete = function () { invalidateProductSearchCache(); scheduleDiskSnapshot(); resolve({ purchase: purchase, lines: lines, movements: reversals, priceReviews: reviewWrites }); };
        transaction.onerror = function () { reject(transaction.error); }; transaction.onabort = function () { reject(abortMessage ? new Error(abortMessage) : (transaction.error || new Error("Anulacion cancelada"))); };
      }); });
    });
  }
  function purchaseCorrect(id, purchase, lines, reason) {
    if (!isAdmin()) return Promise.reject(new Error("Solo admin/dev"));
    reason = String(reason || "").trim();
    if (!reason) return Promise.reject(new Error("Indique el motivo de la correccion"));
    return Promise.all([all("purchases"), all("purchaseLines"), all("products"), all("suppliers"), all("inventoryMovements"), all("priceReviews")]).then(function (sets) {
      var original = sets[0].filter(function (row) { return row.id === id; })[0];
      if (!original || original.status !== "CONFIRMED") throw new Error("Solo se puede corregir un pedido confirmado");
      var originalUpdatedAt = String(original.updatedAt || "");
      var originalLines = sets[1].filter(function (line) { return line.purchaseId === id; });
      var supplier = sets[3].filter(function (row) { return row.id === purchase.supplierId && row.active !== false; })[0];
      if (!supplier) throw new Error("Seleccione un proveedor existente y activo");
      purchase = Object.assign({}, purchase || {});
      var replacementId = purchase.id && purchase.id !== id ? purchase.id : uid();
      var replacementDraft = sets[0].filter(function (row) { return row.id === replacementId; })[0] || null;
      if (replacementDraft && (replacementDraft.status !== "DRAFT" || replacementDraft.correctionOf !== id)) throw new Error("El identificador de la correccion ya pertenece a otro pedido");
      var explicitReplacementExpectedAt = purchase.expectedUpdatedAt == null ? null : String(purchase.expectedUpdatedAt);
      delete purchase.expectedUpdatedAt;
      if (replacementDraft && explicitReplacementExpectedAt != null && String(replacementDraft.updatedAt || "") !== explicitReplacementExpectedAt) throw new Error("El borrador de correccion cambio en otra ventana");
      var replacementExpectedAt = explicitReplacementExpectedAt != null ? explicitReplacementExpectedAt : (replacementDraft ? String(replacementDraft.updatedAt || "") : null);
      var replacement = Object.assign({}, replacementDraft || {}, purchase, {
        id: replacementId, status: "CONFIRMED", correctionOf: id,
        revision: Number(original.revision || 1) + 1, confirmedAt: nowIso(), confirmedBy: currentUser.id,
        createdAt: purchase.createdAt || nowIso(), createdBy: purchase.createdBy || currentUser.id, updatedAt: nowIso(), updatedBy: currentUser.id
      });
      var correctedLines = (lines || []).map(function (line) { return Object.assign({}, line, { id: line.id || uid(), purchaseId: replacement.id }); });
      if (!correctedLines.length) throw new Error("La correccion debe conservar al menos una linea");
      recalculatePurchase(replacement, correctedLines);
      var duplicate = sets[0].filter(function (row) { return row.id !== id && row.id !== replacement.id && row.status !== "VOIDED" && row.supplierId === replacement.supplierId && normalizeInvoiceNumber(replacement.invoiceNumber) && normalizeInvoiceNumber(row.invoiceNumber) === normalizeInvoiceNumber(replacement.invoiceNumber); })[0];
      if (duplicate) throw new Error("Ya existe otro pedido con esta factura");
      replacement.supplierSnapshot = { id: supplier.id, name: supplier.name || "", contactName: supplier.contactName || "" };
      var products = {}, affected = {}, statesBeforeCorrection = {}, preOriginalStates = {}, latestLines = {}, movements = [], histories = [], stamp = replacement.confirmedAt;
      sets[2].forEach(function (product) { products[product.id] = Object.assign({}, product); });
      var originalLineById = {}; originalLines.forEach(function (line) { originalLineById[line.id] = line; });
      var staleReplacementLines = sets[1].filter(function (line) { return line.purchaseId === replacement.id && !correctedLines.some(function (next) { return next.id === line.id; }); });
      var originalReceipts = sets[4].filter(function (movement) { return ["PURCHASE_RECEIPT","PURCHASE_CORRECTION_RECEIPT"].indexOf(movement.type) >= 0 && movement.referenceId === id; }).sort(function (a, b) { return Number(b.lineSequence || 0) - Number(a.lineSequence || 0); });
      if (originalReceipts.length !== originalLines.length || originalReceipts.some(function (movement) { return !movement.beforeState || !movement.afterState || !originalLineById[movement.referenceLineId]; })) throw new Error("El pedido original no tiene estados historicos completos para corregirlo con seguridad");
      originalReceipts.forEach(function (receipt, reverseIndex) {
        var line = originalLineById[receipt.referenceLineId], product = products[receipt.productId];
        if (!product) throw new Error("Falta " + (line.productNameSnapshot || "un producto") + "; no se puede corregir");
        if (!affected[product.id]) {
          if (sets[4].some(function (movement) { return movement.productId === product.id && String(movement.createdAt || "") > String(original.confirmedAt || "") && movement.referenceId !== id; })) throw new Error("Hay movimientos posteriores en " + product.name + "; primero concilie su stock");
          statesBeforeCorrection[product.id] = purchaseProductState(product);
        }
        if (!purchaseHistoricalStateMatches(product, receipt.afterState)) throw new Error("El estado actual de " + product.name + " no coincide con el ingreso que se quiere corregir");
        var reversalBefore = purchaseProductState(product);
        restorePurchaseProductState(product, receipt.beforeState);
        affected[product.id] = true; latestLines[product.id] = latestLines[product.id] || line;
        movements.push({ id: uid(), type: "PURCHASE_CORRECTION_REVERSAL", lineSequence: reverseIndex, reversedLineSequence: receipt.lineSequence, reversedMovementId: receipt.id, productId: product.id, quantity: -Number(receipt.quantity || 0), knownCostQuantity: -Number(receipt.knownCostQuantity || 0), knownCostValue: -Number(receipt.knownCostValue || 0), referenceType: "PURCHASE_CORRECTION", referenceId: replacement.id, reversedReferenceId: id, referenceLineId: line.id, beforeState: reversalBefore, afterState: purchaseProductState(product), reason: reason, createdAt: stamp, createdBy: currentUser.id });
        histories.push({ id: uid(), type: "PURCHASE_CORRECTED_REVERSAL", purchaseId: id, correctedByPurchaseId: replacement.id, purchaseLineId: line.id, productId: product.id, quantity: -Number(receipt.quantity || 0), landedLineCost: -Number(receipt.knownCostValue || 0), reason: reason, createdAt: stamp, createdBy: currentUser.id });
      });
      var reversalMovementCount = movements.length;
      Object.keys(affected).forEach(function (productId) {
        products[productId].updatedAt = stamp;
        for (var movementIndex = reversalMovementCount - 1; movementIndex >= 0; movementIndex -= 1) {
          if (movements[movementIndex].productId === productId) { movements[movementIndex].afterState = purchaseProductState(products[productId]); break; }
        }
        preOriginalStates[productId] = purchaseProductState(products[productId]);
      });
      correctedLines.forEach(function (line, sequence) {
        var product = products[line.productId]; if (!product || product.active === false || Number(line.totalSaleQuantity || 0) <= 0) throw new Error("Producto inexistente/inactivo o cantidad invalida en la correccion");
        if (!affected[product.id]) { statesBeforeCorrection[product.id] = purchaseProductState(product); preOriginalStates[product.id] = purchaseProductState(product); }
        line.productNameSnapshot = product.name; line.productCategorySnapshot = product.category || "General"; line.saleUnit = line.saleUnit || product.unitType || "unidad"; line.purchaseUnit = line.purchaseUnit || "unidad";
        line.supplierNameSnapshot = replacement.supplierSnapshot.name; line.invoiceNumberSnapshot = replacement.invoiceNumber || ""; line.deliveryDateSnapshot = replacement.deliveryDate || ""; line.operatorSnapshot = { id: currentUser.id, name: currentUser.displayName || currentUser.username };
        var applied = purchaseApplyReceipt(product, line, replacement, stamp);
        affected[product.id] = true; latestLines[product.id] = line;
        movements.push({ id: uid(), type: "PURCHASE_CORRECTION_RECEIPT", lineSequence: sequence, productId: product.id, quantity: Number(line.totalSaleQuantity), knownCostQuantity: Number(line.totalSaleQuantity), knownCostValue: Number(line.landedLineCost || 0), unitCost: line.costPerSaleUnit, referenceType: "PURCHASE_CORRECTION", referenceId: replacement.id, referenceLineId: line.id, beforeState: applied.beforeState, afterState: applied.afterState, createdAt: stamp, createdBy: currentUser.id });
        histories.push({ id: uid(), type: "PURCHASE_CORRECTION_CONFIRMED", purchaseId: replacement.id, correctsPurchaseId: id, purchaseLineId: line.id, productId: product.id, productName: product.name, supplierId: replacement.supplierId, supplierName: replacement.supplierSnapshot.name, quantity: line.totalSaleQuantity, baseCostPerSaleUnit: line.baseCostPerSaleUnit, costPerSaleUnit: line.costPerSaleUnit, landedLineCost: line.landedLineCost, reason: reason, createdAt: stamp, createdBy: currentUser.id });
      });
      var correctedBalanceEntry = null;
      if (original.balanceEntryId) {
        replacement.balanceEntryId = original.balanceEntryId;
        correctedBalanceEntry = purchaseBalanceEntry(replacement, stamp, original.balanceEntryId);
        if (original.confirmedAt) correctedBalanceEntry.date = localDateKey(new Date(original.confirmedAt));
      }
      original.status = "VOIDED"; original.voidedAt = stamp; original.voidedBy = currentUser.id; original.voidReason = reason; original.correctedByPurchaseId = replacement.id; original.updatedAt = stamp;
      var reviewWrites = [];
      return dbPromise.then(function (db) { return new Promise(function (resolve, reject) {
        var names = ["purchases", "purchaseLines", "products", "suppliers", "inventoryMovements", "purchaseCostHistory", "priceReviews", "monthlyEntries", "auditLog"], transaction = db.transaction(names, "readwrite"), purchaseStore = transaction.objectStore("purchases");
        var productIds = Object.keys(affected), pendingChecks = 5 + productIds.length, abortMessage = "";
        function finishCheck() {
          pendingChecks -= 1; if (pendingChecks > 0) return;
          if (abortMessage) { transaction.abort(); return; }
          purchaseStore.put(original); purchaseStore.put(replacement); staleReplacementLines.forEach(function (line) { transaction.objectStore("purchaseLines").delete(line.id); }); correctedLines.forEach(function (line) { transaction.objectStore("purchaseLines").put(line); });
          productIds.forEach(function (productId) { transaction.objectStore("products").put(products[productId]); }); movements.forEach(function (movement) { transaction.objectStore("inventoryMovements").put(movement); }); histories.forEach(function (history) { transaction.objectStore("purchaseCostHistory").put(history); }); reviewWrites.forEach(function (review) { transaction.objectStore("priceReviews").put(review); });
          if (correctedBalanceEntry) transaction.objectStore("monthlyEntries").put(correctedBalanceEntry);
          transaction.objectStore("auditLog").put({ id: uid(), createdAt: stamp, userId: currentUser.id, username: currentUser.username, action: "PURCHASE_CORRECTED", detail: id + " -> " + replacement.id + " | " + reason, severity: "critical" });
        }
        var statusCheck = purchaseStore.get(id); statusCheck.onsuccess = function () { if (!statusCheck.result || statusCheck.result.status !== "CONFIRMED" || String(statusCheck.result.updatedAt || "") !== originalUpdatedAt) abortMessage = "El pedido original cambio o ya fue procesado"; finishCheck(); };
        var duplicateCheck = purchaseStore.getAll(); duplicateCheck.onsuccess = function () { var conflict=(duplicateCheck.result||[]).some(function(row){return row.id!==id&&row.id!==replacement.id&&row.status!=="VOIDED"&&row.supplierId===replacement.supplierId&&normalizeInvoiceNumber(replacement.invoiceNumber)&&normalizeInvoiceNumber(row.invoiceNumber)===normalizeInvoiceNumber(replacement.invoiceNumber);});if(conflict)abortMessage="La factura fue cargada por otro proceso";finishCheck(); };
        var supplierCheck = transaction.objectStore("suppliers").get(replacement.supplierId); supplierCheck.onsuccess = function () { if (!supplierCheck.result || supplierCheck.result.active === false) abortMessage = "El proveedor ya no esta activo"; finishCheck(); };
        var replacementCheck = purchaseStore.get(replacement.id); replacementCheck.onsuccess = function () { var currentReplacement=replacementCheck.result||null;if(replacementDraft){if(!currentReplacement||currentReplacement.status!=="DRAFT"||currentReplacement.correctionOf!==id||String(currentReplacement.updatedAt||"")!==String(replacementExpectedAt||""))abortMessage="El borrador de correccion cambio o ya fue procesado";}else if(currentReplacement)abortMessage="Ya existe otro pedido con el identificador de correccion";finishCheck(); };
        var reviewCheck = transaction.objectStore("priceReviews").getAll(); reviewCheck.onsuccess = function () { reviewWrites = purchasePriceReviewWrites(reviewCheck.result || [], affected, products, preOriginalStates, replacement, latestLines, stamp, "PURCHASE_CORRECTION", "Reemplazada por correccion " + replacement.id); finishCheck(); };
        productIds.forEach(function (productId) { var productCheck=transaction.objectStore("products").get(productId);productCheck.onsuccess=function(){if(!productCheck.result||!purchaseProductStateMatches(productCheck.result,statesBeforeCorrection[productId]))abortMessage="El stock, costo o precio de "+(products[productId]&&products[productId].name||productId)+" cambio mientras se corregia";finishCheck();}; });
        transaction.oncomplete = function () { invalidateProductSearchCache(); scheduleDiskSnapshot(); resolve({ purchase: replacement, originalPurchase: original, lines: correctedLines, products: products, movements: movements, costHistory: histories, priceReviews: reviewWrites }); };
        transaction.onerror = function () { reject(transaction.error); }; transaction.onabort = function () { reject(abortMessage ? new Error(abortMessage) : (transaction.error || new Error("Correccion cancelada; no se modifico ningun dato"))); };
      }); });
    });
  }
  function storeProductFromMaster(source) {
    var product = Object.assign({}, source);
    product.masterProductId = source.id;
    product.stock = Number(source.masterStock == null ? source.stock || 0 : source.masterStock);
    product.active = true;
    product.imageData = product.imageData || "";
    product.createdAt = product.createdAt || nowIso();
    product.updatedAt = nowIso();
    return product;
  }
  function invalidateProductSearchCache() {
    productSearchCache = null;
    productPopularityCache = null;
  }
  function seedMasterCatalog() {
    if (!catalogProducts.length) return Promise.resolve();
    var installedVersion = localStorage.getItem("forrajeriaMasterCatalogVersion");
    return all("masterProducts").then(function (existing) {
      if (installedVersion === catalogVersion && existing.length) return;
      var records = catalogProducts.map(function (source) {
        var record = Object.assign({}, source);
        record.masterStock = Number(source.masterStock == null ? source.stock || 0 : source.masterStock);
        record.updatedAt = nowIso();
        return record;
      });
      return clearStore("masterProducts").then(function () {
        return addMany("masterProducts", records);
      }).then(function () {
        localStorage.setItem("forrajeriaMasterCatalogVersion", catalogVersion);
      });
    });
  }
  function allIfAvailable(store) {
    return all(store).catch(function () { return []; });
  }
  function seedStoreInventory() {
    if (!catalogProducts.length) return Promise.resolve();
    var installedVersion = localStorage.getItem("forrajeriaStoreCatalogVersion");
    return all("products").then(function (products) {
      if (installedVersion === catalogVersion && products.length) return;
      var byMasterId = {};
      var byInventoryId = {};
      var byBarcode = {};
      var byId = {};
      var usedExistingIds = {};
      products.forEach(function (product) {
        if (product.masterProductId) byMasterId[product.masterProductId] = product;
        if (product.inventoryId) byInventoryId[product.inventoryId] = product;
        if (product.barcode) byBarcode[String(product.barcode)] = product;
        byId[product.id] = product;
      });
      function compatibleUnusedProduct(product, source) {
        if (!product || usedExistingIds[product.id]) return null;
        var sourceBarcode = String(source.barcode || "");
        var productBarcode = String(product.barcode || "");
        if (sourceBarcode && productBarcode && sourceBarcode !== productBarcode) return null;
        return product;
      }
      var records = [];
      catalogProducts.filter(function (source) { return source.inStoreDefault; }).forEach(function (source) {
        var existing = compatibleUnusedProduct(byBarcode[String(source.barcode || "")], source) ||
          compatibleUnusedProduct(byMasterId[source.id], source) ||
          compatibleUnusedProduct(byInventoryId[source.inventoryId], source) ||
          compatibleUnusedProduct(byId[source.id], source);
        if (existing) {
          usedExistingIds[existing.id] = true;
          existing.masterProductId = source.id;
          existing.inventoryId = existing.inventoryId || source.inventoryId;
          existing.brand = existing.brand || source.brand;
          existing.product = existing.product || source.product;
          existing.variant = existing.variant || source.variant;
          existing.location = existing.location || source.location;
          existing.minStock = existing.minStock == null ? Number(source.minStock || 0) : existing.minStock;
          existing.updatedAt = existing.updatedAt || nowIso();
          records.push(existing);
        } else {
          records.push(storeProductFromMaster(source));
        }
      });
      return addMany("products", records).then(function () {
        invalidateProductSearchCache();
        localStorage.setItem("forrajeriaStoreCatalogVersion", catalogVersion);
      });
    });
  }
  function seed() {
    return all("users").then(function (users) {
      var tasks = [];
      if (!users.length) {
        [
          ["admin", "Administrador", "admin"],
          ["dev", "Desarrollo", "dev", "AAurtenechea123"],
          ["turno_manana", "Turno Manana", "employee"],
          ["turno_tarde", "Turno Tarde", "employee"]
        ].forEach(function (u) {
          tasks.push(add("users", { id: uid(), username: u[0], displayName: u[1], role: u[2], password: u[3] || "", active: true, createdAt: nowIso() }));
        });
      }
      return Promise.all(tasks);
    }).then(function () {
      return all("users").then(function (users) {
        var dev = users.filter(function (u) { return u.username === "dev"; })[0];
        if (!dev) return Promise.resolve();
        if (String(dev.password || "") && String(dev.password || "") !== "hipopotomonstrosesquipedaliofobia") return Promise.resolve();
        dev.password = "AAurtenechea123";
        dev.updatedAt = nowIso();
        return add("users", dev);
      });
    });
  }
  function renderLoginUsers(preferredUsername) {
    var select = $("loginUser");
    if (!select) return Promise.resolve();
    var previous = preferredUsername || select.value || "turno_manana";
    return all("users").then(function (users) {
      users = users.filter(function (u) { return u.active !== false && u.role !== "dev" && u.username !== "dev"; });
      users.sort(function (a, b) {
        var order = { turno_manana: 0, turno_tarde: 1, admin: 2, dev: 3 };
        var ao = order[a.username] == null ? 10 : order[a.username];
        var bo = order[b.username] == null ? 10 : order[b.username];
        return ao - bo || String(a.displayName || a.username).localeCompare(String(b.displayName || b.username));
      });
      select.innerHTML = users.map(function (u) {
        return "<option value='" + escapeHtml(u.username) + "'>" + escapeHtml(u.displayName || u.username) + "</option>";
      }).join("");
      var hasPrevious = users.some(function (u) { return u.username === previous; });
      var hasMorning = users.some(function (u) { return u.username === "turno_manana"; });
      select.value = hasPrevious ? previous : hasMorning ? "turno_manana" : (users[0] && users[0].username) || "";
      updateLoginWorkClock();
    });
  }
  function loginShiftOpeningSession(sessions, date, shift) {
    return (sessions || []).filter(function (s) {
      return s.businessDate === date && s.shiftType === shift && (s.openingCashRecorded || Number(s.openingCash || 0) !== 0);
    }).sort(function (a, b) {
      return String(a.loginTime || "").localeCompare(String(b.loginTime || ""));
    })[0] || null;
  }
  function updateLoginWorkClock() {
    var clock = currentWorkClock();
    if ($("loginDate")) $("loginDate").value = clock.businessDate;
    if ($("loginShift")) $("loginShift").value = clock.shiftType;
    return all("sessions").then(function (sessions) {
      var existing = loginShiftOpeningSession(sessions, clock.businessDate, clock.shiftType);
      if ($("openingCashBlock")) $("openingCashBlock").classList.toggle("hidden", !!existing);
      if ($("openingCashLocked")) {
        $("openingCashLocked").classList.toggle("hidden", !existing);
        $("openingCashLocked").textContent = existing ? "Cambio en caja ya cargado para " + clock.shiftType + ": " + money(existing.openingCash) : "";
      }
      if (!existing && $("openingCash") && !$("openingCash").value) $("openingCash").value = "0";
      return existing;
    }).catch(function () { return null; });
  }

  function login(e, forcedUsername) {
    if (e && e.preventDefault) e.preventDefault();
    if (isLoggingIn) return;
    var username = String(forcedUsername || $("loginUser").value || "").trim();
    var pass = $("loginPass").value.trim();
    setLoginStatus("");
    if (!username) { setLoginStatus("Seleccione usuario", "warn"); return; }
    if (!pass) { setLoginStatus("Ingrese una clave", "warn"); $("loginPass").focus(); return; }
    isLoggingIn = true;
    setLoginStatus("Ingresando...", "ok");
    var loginTimeout = setTimeout(function () {
      if (isLoggingIn) {
        isLoggingIn = false;
        setLoginStatus("El inicio tardo demasiado. Intente de nuevo.", "error");
      }
    }, 7000);
    all("users").then(function (users) {
      if (!forcedUsername) {
        var hiddenDeveloper = users.filter(function (candidate) {
          return candidate.active !== false && (candidate.role === "dev" || candidate.username === "dev") && String(candidate.password || "") === pass;
        })[0];
        if (hiddenDeveloper) username = hiddenDeveloper.username;
      }
      var user = users.filter(function (u) { return u.username === username && u.active; })[0];
      if (!user || (String(user.password || "") && String(user.password || "") !== pass)) {
        clearTimeout(loginTimeout);
        isLoggingIn = false;
        setLoginStatus("Usuario o clave incorrectos", "error");
        return;
      }
      var firstPasswordSetup = !String(user.password || "");
      if (firstPasswordSetup) {
        user.password = pass;
        user.updatedAt = nowIso();
      }
      var clock = currentWorkClock();
      currentUser = user;
      return all("sessions").then(function (sessions) {
        var existingOpening = loginShiftOpeningSession(sessions, clock.businessDate, clock.shiftType);
        currentSession = {
          id: uid(), userId: user.id, username: user.username, displayName: user.displayName,
          role: user.role, loginTime: nowIso(),
          openingCash: existingOpening ? 0 : parseMoney($("openingCash").value),
          openingCashRecorded: !existingOpening,
          businessDate: clock.businessDate, shiftType: clock.shiftType
        };
        return firstPasswordSetup ? add("users", user) : Promise.resolve(user);
      }).then(function () {
        return add("sessions", currentSession);
      }).then(function () {
        sessionStorage.setItem("bakerySession", JSON.stringify({ user: currentUser, session: currentSession }));
        return audit(firstPasswordSetup ? "PASSWORD_INITIALIZED" : "LOGIN", currentSession.shiftType + " cambio en caja " + money(currentSession.openingCash));
      }).then(function () {
        clearTimeout(loginTimeout);
        showApp();
      });
    }).catch(function (err) {
      clearTimeout(loginTimeout);
      isLoggingIn = false;
      setLoginStatus("No se pudo iniciar sesion: " + (err && err.message ? err.message : "error local"), "error");
    });
  }
  function setLoginStatus(message, kind) {
    var node = $("loginStatus");
    if (!node) {
      if (message) toast(message);
      return;
    }
    node.textContent = message || "";
    node.className = "login-status " + (kind || "");
    if (message && kind !== "ok") toast(message);
  }
  function attachLoginHandlers() {
    var form = $("loginForm");
    if (form) form.onsubmit = login;
    if ($("loginPass")) $("loginPass").oninput = function () {
      clearTimeout(devAutoLoginTimer);
      var enteredPassword = $("loginPass").value;
      if (!enteredPassword || enteredPassword.length < 6 || isLoggingIn) return;
      devAutoLoginTimer = setTimeout(function () {
        all("users").then(function (users) {
          var developer = users.filter(function (user) {
            return user.active !== false && (user.role === "dev" || user.username === "dev") && String(user.password || "") === enteredPassword;
          })[0];
          if (developer && $("loginPass").value === enteredPassword && !isLoggingIn) login(null, developer.username);
        });
      }, 180);
    };
  }
  window.forceLogin = function (e) {
    login(e || { preventDefault: function () {} });
  };

  function showApp() {
    isLoggingIn = false;
    setLoginStatus("");
    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    syncSessionDateIfChanged();
    updateSessionInfo();
    $("workDateInput").value = currentSession.businessDate;
    $("workShiftInput").value = currentSession.shiftType;
    setClosureContext(currentSession.businessDate || today(), currentSession.shiftType || "AM", true);
    $("workShiftBar").style.display = "none";
    buildTabs();
    setDates();
    loadIntegrationSettings();
    loadDevUiSettings();
    loadUpdateSettings();
    loadTicketSettings();
    startMpSync();
    startDateSync();
    startWeatherSync();
    renderAll();
    setTimeout(maybeGenerateAutomaticMonthlyReport, 900);
    setTimeout(function () { syncTodayWeather(true); }, 1400);
    focusBarcodeInput(250);
  }
  function openLogoutConfirm() {
    if ($("logoutConfirmModal")) $("logoutConfirmModal").classList.remove("hidden");
  }
  function closeLogoutConfirm() {
    if ($("logoutConfirmModal")) $("logoutConfirmModal").classList.add("hidden");
  }
  function logout() {
    var save = Promise.resolve();
    if (currentSession && currentUser) {
      currentSession.logoutTime = nowIso();
      save = add("sessions", currentSession).then(function () { return audit("LOGOUT", currentUser.username); });
    }
    save.then(function () { return writeDiskSnapshot(true); }).then(function () {
      sessionStorage.removeItem("bakerySession");
      location.reload();
    }, function () {
      sessionStorage.removeItem("bakerySession");
      location.reload();
    });
  }
  function isAdmin() { return currentUser && (currentUser.role === "admin" || currentUser.role === "dev"); }
  function isDev() { return currentUser && currentUser.role === "dev"; }
  function visibleTabs() {
    var tabs = isAdmin() ? ["Caja", "Conteos", "Cierres", "Metricas", "Produccion", "Proveedores", "MercadoLibre", "Movimientos", "Balance", "Usuarios"] : ["Caja", "Conteos"];
    if (isDev()) tabs = tabs.concat(["Dev"]);
    return orderedTabs(tabs);
  }
  function tabOrder() {
    try {
      var saved = JSON.parse(localStorage.getItem("bakeryTabOrder") || "[]");
      if (!Array.isArray(saved)) return [];
      saved = saved.filter(function (name) { return String(name).indexOf("__divider_") !== 0; });
      return saved;
    } catch (e) {
      return [];
    }
  }
  function insertOrderAfter(order, item, anchor) {
    var i = order.indexOf(anchor);
    if (i >= 0) order.splice(i + 1, 0, item);
    else order.push(item);
  }
  function orderedTabs(tabs) {
    var saved = tabOrder();
    return tabs.slice().sort(function (a, b) {
      var ia = saved.indexOf(a);
      var ib = saved.indexOf(b);
      if (ia < 0) ia = 999 + tabs.indexOf(a);
      if (ib < 0) ib = 999 + tabs.indexOf(b);
      return ia - ib;
    });
  }
  function saveTabOrder(names) {
    localStorage.setItem("bakeryTabOrder", JSON.stringify(names));
  }
  function buildTabs() {
    var tabs = visibleTabs();
    if (tabs.indexOf(currentTab) < 0) currentTab = "Caja";
    var labels = {Metricas: "Metricas", Produccion: "Stock", MercadoLibre: "Mercado Libre"};
    $("tabs").innerHTML = "";
    tabs.forEach(function (name) {
      var btn = document.createElement("button");
      btn.textContent = labels[name] || name;
      btn.className = name === currentTab ? "active" : "";
      btn.dataset.tab = name;
      btn.draggable = isAdmin();
      btn.onclick = function () {
        if (tabJustDragged) {
          tabJustDragged = false;
          return;
        }
        switchTab(name);
      };
      if (isAdmin()) {
        btn.ondragstart = function (e) {
          draggedTab = name;
          btn.classList.add("dragging");
          if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        };
        btn.ondragend = function () {
          draggedTab = "";
          btn.classList.remove("dragging");
          tabJustDragged = true;
          setTimeout(function () { tabJustDragged = false; }, 120);
          document.querySelectorAll("#tabs [data-tab]").forEach(function (b) { b.classList.remove("drop-target"); });
        };
        btn.ondragover = function (e) {
          e.preventDefault();
          if (draggedTab && draggedTab !== name) btn.classList.add("drop-target");
        };
        btn.ondragleave = function () { btn.classList.remove("drop-target"); };
        btn.ondrop = function (e) {
          e.preventDefault();
          btn.classList.remove("drop-target");
          if (!draggedTab || draggedTab === name) return;
          reorderTabs(draggedTab, name);
        };
      }
      $("tabs").appendChild(btn);
    });
    document.querySelectorAll("#tabs [data-tab='Produccion']").forEach(function (btn) {
      btn.textContent = "Stock";
    });
  }
  function reorderTabs(from, to) {
    var visible = Array.prototype.slice.call(document.querySelectorAll("#tabs [data-tab]")).map(function (b) { return b.dataset.tab; });
    var allKnown = ["Caja", "Conteos", "Cierres", "Metricas", "Produccion", "Proveedores", "MercadoLibre", "Movimientos", "Balance", "Usuarios", "Dev"];
    var order = tabOrder().length ? tabOrder().filter(function (x) { return allKnown.indexOf(x) >= 0; }) : allKnown.slice();
    allKnown.forEach(function (x) { if (order.indexOf(x) < 0) order.push(x); });
    var scoped = visible.slice();
    var fromIndex = scoped.indexOf(from);
    var toIndex = scoped.indexOf(to);
    if (fromIndex < 0 || toIndex < 0) return;
    scoped.splice(fromIndex, 1);
    scoped.splice(toIndex, 0, from);
    order = scoped.concat(order.filter(function (x) { return scoped.indexOf(x) < 0; }));
    saveTabOrder(order);
    buildTabs();
    toast("Orden de tabs actualizado");
  }
  function clearTransientTabFields(tabName) {
    var page = $("tab" + tabName);
    if (!page) return;
    if (tabName === "Proveedores") purchaseAutosaveCurrentDraft(true);
    page.querySelectorAll("input, textarea").forEach(function (field) {
      var type = String(field.getAttribute("type") || "text").toLowerCase();
      if (["hidden", "checkbox", "radio", "file", "range", "color", "button", "submit", "reset", "date", "month", "time", "datetime-local", "week"].indexOf(type) >= 0) return;
      field.value = "";
      field.classList.remove("invalid", "error");
    });
    page.querySelectorAll("[contenteditable='true']").forEach(function (field) { field.textContent = ""; });
    page.querySelectorAll("details[open]").forEach(function (detail) { detail.open = false; });
    page.querySelectorAll(".modal:not(.hidden)").forEach(function (modal) { modal.classList.add("hidden"); });
    page.querySelectorAll(".product-search-results").forEach(function (results) {
      results.innerHTML = "";
      results.classList.add("hidden");
    });
    if (tabName === "Caja") {
      if ($("customItemModal")) $("customItemModal").classList.add("hidden");
      if ($("productModal")) $("productModal").classList.add("hidden");
      clearProductSearch();
      resetTicketDiscount();
      setBarcodeStatus("Escanee un producto para agregarlo automaticamente.", "");
    }
    if (tabName === "Movimientos") {
      expandedMovements = {};
      selectedMovements = {};
      if ($("movementEditModal") && !$("movementEditModal").classList.contains("hidden")) closeMovementEdit();
      if ($("movementDeleteModal") && !$("movementDeleteModal").classList.contains("hidden")) closeMovementDelete();
    }
    if (tabName === "Conteos") activeStockCountMission = null;
  }
  function switchTab(name) {
    if (visibleTabs().indexOf(name) < 0) name = "Caja";
    var previousTab = currentTab;
    if (previousTab !== name) clearTransientTabFields(previousTab);
    currentTab = name;
    if (name === "Movimientos" && previousTab !== name) {
      if ($("movementDateFrom")) $("movementDateFrom").value = today();
      if ($("movementDateTo")) $("movementDateTo").value = today();
      expandedMovements = {};
    }
    document.querySelectorAll(".tab-page").forEach(function (p) { p.classList.add("hidden"); });
    $("tab" + name).classList.remove("hidden");
    buildTabs();
    renderAll();
    if (name === "Caja") focusBarcodeInput(120);
  }
  function setDates() {
    updateLoginWorkClock();
    ["monthlyDate", "productionDate", "productionFilterDate", "purchaseDeliveryDate", "movementDateFrom", "movementDateTo"].forEach(function (id) { if ($(id)) $(id).value = today(); });
    $("monthPicker").value = monthKey(today());
  }
  function startDateSync() {
    clearInterval(dateSyncTimer);
    dateSyncTimer = setInterval(function () {
      syncSessionDateIfChanged();
      var mk = monthKey(today());
      if ($("monthPicker") && currentTab === "Balance" && !$("monthPicker").value) $("monthPicker").value = mk;
      if ($("monthlyDate") && !$("monthlyDate").value) $("monthlyDate").value = today();
      if (currentTab === "Caja" && recentSalesWindowStart().toISOString() !== lastSalesWindowKey) renderCaja();
      if (currentTab === "Balance" && $("monthPicker") && $("monthPicker").value !== mk && new Date().getHours() === 0) {
        $("monthPicker").value = mk;
        renderMonthly();
      }
    }, 60000);
  }
  function updateSessionInfo() {
    if (!$("sessionInfo") || !currentUser || !currentSession) return;
    $("sessionInfo").innerHTML = "Usuario: <b>" + currentUser.displayName + "</b> | Fecha: <b class='topbar-date'>" + currentSession.businessDate + "</b> | Turno: <b>" + currentSession.shiftType + "</b>";
  }
  function syncSessionDateIfChanged() {
    if (!currentSession || !currentUser) return false;
    var clock = currentWorkClock();
    var changed = currentSession.businessDate !== clock.businessDate || currentSession.shiftType !== clock.shiftType;
    if (!changed) return false;
    var oldDate = currentSession.businessDate;
    var oldShift = currentSession.shiftType;
    var oldSession = Object.assign({}, currentSession, { logoutTime: nowIso() });
    currentSession = {
      id: uid(),
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName,
      role: currentUser.role,
      loginTime: nowIso(),
      openingCash: 0,
      openingCashRecorded: false,
      businessDate: clock.businessDate,
      shiftType: clock.shiftType
    };
    sessionStorage.setItem("bakerySession", JSON.stringify({ user: currentUser, session: currentSession }));
    updateSessionInfo();
    if ($("workDateInput")) $("workDateInput").value = currentSession.businessDate;
    if ($("workShiftInput")) $("workShiftInput").value = currentSession.shiftType;
    setClosureContext(clock.businessDate, currentSession.shiftType || "AM", true);
    add("sessions", oldSession).then(function () {
      return add("sessions", currentSession);
    }).then(function () {
      return audit("WORK_CLOCK_AUTO_CHANGED", oldDate + " " + oldShift + " -> " + clock.businessDate + " " + clock.shiftType);
    });
    return true;
  }

  function setPayment(method) {
    PAYMENT = method;
    if ($("salePaymentSelect")) $("salePaymentSelect").value = method;
    document.querySelectorAll(".pay-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.payment === PAYMENT); });
    renderQuickSplitPayment();
  }
  function renderQuickSplitPayment() {
    var split = isSplitPayment(PAYMENT);
    if ($("quickSplitDetails")) $("quickSplitDetails").classList.toggle("hidden", !split);
    var total = parseMoney($("saleAmount") && $("saleAmount").value);
    var cash = parseMoney($("quickSplitCash") && $("quickSplitCash").value);
    if ($("quickSplitQr")) $("quickSplitQr").textContent = money(Math.max(0, total - cash));
    if (!split && $("quickSplitCash")) $("quickSplitCash").value = "";
  }
  function quickSalePaymentDetails(total) {
    if (!isSplitPayment(PAYMENT)) return {};
    var cash = parseMoney($("quickSplitCash") && $("quickSplitCash").value);
    if (cash <= 0 || cash >= total) {
      toast("Ingrese cuanto se paga en efectivo; debe ser menor al total");
      if ($("quickSplitCash")) $("quickSplitCash").focus();
      return null;
    }
    return { cashAmount: cash, qrAmount: moneyPrecision(total - cash), paymentBreakdown: { cash: cash, qr: moneyPrecision(total - cash) }, paidAmount: total, changeAmount: 0, paymentStatus: "MANUAL" };
  }
  function setSubmitting(on) {
    isSubmittingSale = on;
    if ($("saveSaleBtn")) $("saveSaleBtn").disabled = on;
    if ($("chargeBasketBtn")) $("chargeBasketBtn").disabled = on || !basket.length;
    if ($("saleAmount")) $("saleAmount").disabled = on;
    if ($("submitState")) $("submitState").textContent = on ? "Registrando..." : "Listo";
    if ($("submitState")) $("submitState").classList.toggle("busy", on);
  }
  function isManualBasketItem(item) {
    if (!item) return false;
    var productId = String(item.productId || "");
    var source = String(item.source || "").toLowerCase();
    return item.manualItem === true || item.unregistered === true || productId === "custom"
      || productId === "unregistered" || productId.indexOf("manual:") === 0
      || ["manual", "manual-item", "unregistered", "unregistered-barcode"].indexOf(source) >= 0;
  }
  function basketItemIdentityKey(item) {
    if (isManualBasketItem(item)) return "manual-line:" + String(item.manualItemId || item.id || ("name:" + normalizeProductSearch(item.productName || "Item manual")));
    return String(item && item.productId || "name:" + String(item && item.productName || "Producto"));
  }
  function saleBasketItemRecord(item, basketId) {
    return {
      id: uid(), basketId: basketId, productId: item.productId, productName: item.productName,
      quantity: item.quantity, unitType: item.unitType || "", unitPrice: item.unitPrice, subtotal: item.subtotal,
      barcode: item.barcode || "", source: item.source || "", scannedCode: item.scannedCode || "",
      reviewFlag: !!item.reviewFlag, manualItem: !!item.manualItem, manualItemId: item.manualItemId || "",
      reviewReason: item.reviewReason || "", stockAppliedQuantity: 0,
      quantityEntryMode: item.quantityEntryMode || "quantity", requestedAmount: Number(item.requestedAmount || 0)
    };
  }
  function commitSaleAtomic(sale, details, extra) {
    details = details || [];
    extra = extra || {};
    var basketId = details.length ? uid() : "";
    var items = details.map(function (item) { return saleBasketItemRecord(item, basketId); });
    if (basketId) sale.basketId = basketId;
    var stamp = sale.createdAt || nowIso();
    var action = Number(extra.manualItemCount || 0) > 0 ? "MANUAL_ITEM_SOLD_REVIEW_REQUIRED" : "SALE_CREATED";
    var detailText = money(sale.amount) + " " + sale.paymentMethod + " " + (sale.saleMode || "FAST") + (extra.reviewFlag ? " | revisar productos" : "");
    var auditRow = {
      id: uid(), createdAt: stamp, userId: currentUser && currentUser.id,
      username: currentUser && currentUser.username, action: action, detail: detailText,
      severity: extra.reviewFlag || Number(sale.amount || 0) > 60000 ? "warning" : "normal"
    };
    var productIds = [];
    items.forEach(function (item) {
      if (item.productId && !isManualBasketItem(item) && productIds.indexOf(item.productId) < 0) productIds.push(item.productId);
    });
    return dbPromise.then(function (db) {
      return new Promise(function (resolve, reject) {
        var names = ["transactions", "baskets", "basketItems", "products", "inventoryMovements", "auditLog"];
        var transaction = db.transaction(names, "readwrite");
        var productStore = transaction.objectStore("products");
        var products = {};
        var movements = [];
        var pending = productIds.length;
        var staged = false;
        var abortMessage = "";
        function stageWrites() {
          if (staged) return;
          staged = true;
          var unavailableId = productIds.filter(function (productId) { return !products[productId] || products[productId].active === false; })[0];
          if (unavailableId) {
            abortMessage = "Un producto ya no esta disponible; no se registro la venta";
            transaction.abort();
            return;
          }
          var invalidItem = items.filter(function (item) {
            return item.productId && !isManualBasketItem(item) && (!isFinite(Number(item.quantity)) || Number(item.quantity) <= 0);
          })[0];
          if (invalidItem) {
            abortMessage = "Hay una cantidad invalida; no se registro la venta";
            transaction.abort();
            return;
          }
          items.forEach(function (item) {
            if (!item.productId || isManualBasketItem(item)) return;
            var product = products[item.productId];
            var requested = Number(item.quantity);
            var available = Math.max(0, Number(product.stock || 0));
            var applied = Math.min(available, requested);
            item.stockBeforeSale = moneyPrecision(available);
            item.stockAppliedQuantity = moneyPrecision(applied);
            if (applied + 0.000001 < requested) {
              item.reviewFlag = true;
              item.reviewReason = appendMovementReviewReason(item.reviewReason, "Stock insuficiente: se descontaron " + moneyPrecision(applied) + " de " + moneyPrecision(requested));
              sale.reviewFlag = true;
              sale.reviewReason = appendMovementReviewReason(sale.reviewReason, "Venta con stock insuficiente; revisar reposicion");
              auditRow.severity = "critical";
              auditRow.detail += " | STOCK INSUFICIENTE";
            }
            var pools = productCostPools(product);
            var unknownUsed = Math.min(pools.unknown, applied);
            var remaining = applied - unknownUsed;
            var knownUsed = Math.min(pools.known, remaining);
            var weightedCost = pools.known > 0 ? pools.value / pools.known : 0;
            item.costUnknownQuantity = moneyPrecision(unknownUsed + Math.max(0, remaining - knownUsed));
            item.costKnownQuantity = moneyPrecision(knownUsed);
            item.unitCostSnapshot = knownUsed > 0 ? moneyPrecision(weightedCost) : null;
            item.knownCostAmount = moneyPrecision(knownUsed * weightedCost);
            item.costStateAtSale = knownUsed === applied ? "KNOWN" : (knownUsed > 0 ? "PARTIAL" : "UNKNOWN");
            item.costCoveragePct = applied > 0 ? moneyPrecision(knownUsed / applied * 100) : 0;
            pools.unknown -= unknownUsed;
            pools.known -= knownUsed;
            pools.value = Math.max(0, pools.value - item.knownCostAmount);
            product.stock = moneyPrecision(available - applied);
            product.updatedAt = stamp;
            applyCostPools(product, pools);
            movements.push({
              id: uid(), type: "SALE", productId: product.id, quantity: -applied,
              knownCostQuantity: -item.costKnownQuantity, unknownCostQuantity: -item.costUnknownQuantity,
              knownCostValue: -item.knownCostAmount, unitCost: item.unitCostSnapshot,
              referenceType: "SALE", referenceId: sale.id, referenceLineId: item.id,
              createdAt: stamp, createdBy: currentUser && currentUser.id
            });
          });
          transaction.objectStore("transactions").put(sale);
          if (basketId) transaction.objectStore("baskets").put({
            id: basketId, createdAt: stamp, userId: currentUser.id, total: sale.amount,
            grossSubtotal: Number(sale.grossSubtotal || sale.unroundedAmount || sale.amount || 0),
            discountType: sale.discountType || "", discountValue: Number(sale.discountValue || 0), discountAmount: Number(sale.discountAmount || 0),
            paymentMethod: sale.paymentMethod, transactionId: sale.id
          });
          items.forEach(function (item) { transaction.objectStore("basketItems").put(item); });
          productIds.forEach(function (productId) { if (products[productId]) productStore.put(products[productId]); });
          movements.forEach(function (movement) { transaction.objectStore("inventoryMovements").put(movement); });
          transaction.objectStore("auditLog").put(auditRow);
        }
        if (!pending) stageWrites();
        productIds.forEach(function (productId) {
          var request = productStore.get(productId);
          request.onsuccess = function () {
            products[productId] = request.result || null;
            pending -= 1;
            if (!pending) stageWrites();
          };
          request.onerror = function () { transaction.abort(); };
        });
        transaction.oncomplete = function () {
          invalidateProductSearchCache();
          scheduleDiskSnapshot();
          resolve({ transaction: sale, items: items });
        };
        transaction.onerror = function () { reject(transaction.error || new Error(abortMessage || "No se pudo registrar la venta")); };
        transaction.onabort = function () { reject(transaction.error || new Error(abortMessage || "La venta fue cancelada sin modificar stock")); };
      });
    });
  }
  function saveSale(amount, mode, details, extra) {
    if (isSubmittingSale) return Promise.resolve();
    if (Date.now() - lastSaleAt < 900) return Promise.resolve();
    extra = extra || {};
    var method = extra.paymentMethodOverride || PAYMENT;
    var amounts = saleAmounts(extra.unroundedAmount != null ? extra.unroundedAmount : amount);
    amount = amounts.total;
    extra.unroundedAmount = amounts.unroundedAmount;
    extra.roundingAdjustment = amounts.roundingAdjustment;
    if (amount <= 0) { toast("Ingrese un monto valido"); return Promise.resolve(); }
    setSubmitting(true);
    lastSaleAt = Date.now();
    clearTimeout(autoSaleTimer);
    clearTimeout(autoTicketTimer);
    playSound();
    var tr = {
      id: uid(), type: "SALE", amount: amount, paymentMethod: method, businessDate: currentSession.businessDate,
      shiftType: currentSession.shiftType, userId: currentUser.id, sessionId: currentSession.id,
      userName: currentUser.displayName || currentUser.username,
      createdAt: nowIso(), deleted: false, saleMode: mode || "FAST",
      paymentStatus: isDigitalPayment(method) ? (extra.paymentStatus || "MANUAL") : "PAID",
      transferStatus: method === "Transferencia" ? (extra.transferStatus || "RECEIVED") : ""
    };
    Object.keys(extra).forEach(function (k) {
      if (k !== "paymentMethodOverride" && k !== "printReceipt" && k !== "printWindow") tr[k] = extra[k];
    });
    var receipt = buildReceipt(tr, details || [], extra);
    return commitSaleAtomic(tr, details, extra).then(function () {
      if ($("saleAmount")) $("saleAmount").value = "";
      if ($("quickSplitCash")) $("quickSplitCash").value = "";
      basket = [];
      resetTicketDiscount();
      if ($("ticketPaid")) $("ticketPaid").value = "";
      if ($("ticketSplitCash")) $("ticketSplitCash").value = "";
      renderAll();
      toast(amounts.roundingAdjustment ? "Venta registrada con redondeo hacia abajo" : "Venta registrada");
      if (extra.printReceipt) printReceipt(receipt, extra.printWindow);
    }).finally(function () {
      setTimeout(function () {
        setSubmitting(false);
        if ($("saleAmount")) $("saleAmount").focus();
      }, 220);
    });
  }
  function saveExternalSale(amount, method, mode, details, extra) {
    extra = extra || {};
    var amounts = saleAmounts(extra.unroundedAmount != null ? extra.unroundedAmount : amount);
    amount = amounts.total;
    extra.unroundedAmount = amounts.unroundedAmount;
    extra.roundingAdjustment = amounts.roundingAdjustment;
    if (amount <= 0) { toast("Ticket vacio"); return Promise.reject(new Error("Ticket vacio")); }
    var tr = {
      id: uid(), type: "SALE", amount: amount, paymentMethod: method, businessDate: currentSession.businessDate,
      shiftType: currentSession.shiftType, userId: currentUser.id, sessionId: currentSession.id,
      userName: currentUser.displayName || currentUser.username,
      createdAt: nowIso(), deleted: false, saleMode: mode || "EXTERNAL"
    };
    Object.keys(extra).forEach(function (k) { tr[k] = extra[k]; });
    return commitSaleAtomic(tr, details, extra).then(function () {
      basket = [];
      resetTicketDiscount();
      if ($("ticketPaid")) $("ticketPaid").value = "";
      if ($("ticketSplitCash")) $("ticketSplitCash").value = "";
      renderAll();
      return tr;
    });
  }
  function saveQuickSale(e) {
    if (e) e.preventDefault();
    clearTimeout(autoSaleTimer);
    var total = parseMoney($("saleAmount").value);
    var paymentDetails = quickSalePaymentDetails(saleAmounts(total).total);
    if (paymentDetails === null) return;
    saveSale(total, "FAST", [], paymentDetails);
  }
  function undoLastSale() {
    all("transactions").then(function (trs) {
      var sales = trs.filter(function (t) {
        return t.type === "SALE" && t.sessionId === currentSession.id;
      }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
      if (!sales[0]) { toast("No hay venta para deshacer"); return; }
      if (sales[0].deleted) { toast("La ultima venta ya fue deshecha"); return; }
      openUndoModal(sales[0]);
    });
  }
  function openUndoModal(sale) {
    pendingUndoSale = sale;
    $("undoSaleSummary").textContent = new Date(sale.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + " | " + sale.paymentMethod + " | " + money(sale.amount);
    $("undoReason").value = "";
    $("undoModal").classList.remove("hidden");
    $("undoReason").focus();
  }
  function closeUndoModal() {
    $("undoModal").classList.add("hidden");
    pendingUndoSale = null;
  }
  function confirmUndoSale(e) {
    e.preventDefault();
    if (!pendingUndoSale) { closeUndoModal(); return; }
    var reason = $("undoReason").value.trim();
    if (!reason) { toast("Ingrese el motivo"); $("undoReason").focus(); return; }
    undoSaleById(pendingUndoSale.id, reason);
  }
  function appendMovementReviewReason(current, message) {
    current = String(current || "").trim();
    message = String(message || "").trim();
    if (!message || current.indexOf(message) >= 0) return current;
    return current ? current + " | " + message : message;
  }
  function deleteTransactionsWithStock(ids, reason, options) {
    options = options || {};
    var idMap = {};
    (ids || []).forEach(function (id) { if (id) idMap[id] = true; });
    var requestedIds = Object.keys(idMap);
    if (!requestedIds.length) return Promise.reject(new Error("Seleccione al menos un movimiento"));
    var expectedById = {};
    (options.expectedTransactions || []).forEach(function (row) { if (row && row.id) expectedById[row.id] = row; });
    return dbPromise.then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(["transactions", "basketItems", "products", "inventoryMovements", "auditLog"], "readwrite");
        var transactionStore = transaction.objectStore("transactions");
        var itemStore = transaction.objectStore("basketItems");
        var productStore = transaction.objectStore("products");
        var transactions = [], basketItems = [], products = [], pending = 3, staged = false, summary = null;
        var abortMessage = "";
        function cancel(message) {
          abortMessage = message;
          try { transaction.abort(); } catch (_error) {}
        }
        function stageWrites() {
          if (pending || staged) return;
          staged = true;
          try {
            var transactionsById = {}, productsById = {}, itemsByBasket = {};
            transactions.forEach(function (row) { transactionsById[row.id] = row; });
            products.forEach(function (product) { productsById[product.id] = Object.assign({}, product); });
            basketItems.forEach(function (item) {
              if (!itemsByBasket[item.basketId]) itemsByBasket[item.basketId] = [];
              itemsByBasket[item.basketId].push(item);
            });
            requestedIds.forEach(function (id) {
              var source = transactionsById[id];
              if (!source || source.deleted) throw new Error("Un movimiento ya no esta disponible o ya fue borrado");
              if (options.type && source.type !== options.type) throw new Error("El movimiento seleccionado ya no corresponde a esta accion");
              if (options.sessionId && source.sessionId !== options.sessionId) throw new Error("La venta ya no pertenece a esta sesion");
              if (options.requireExpected && !expectedById[id]) throw new Error("La lista cambio; recargue Movimientos antes de borrar");
              if (expectedById[id] && JSON.stringify(source) !== JSON.stringify(expectedById[id])) throw new Error("Un movimiento cambio en otra ventana; recargue antes de continuar");
            });
            var changedProducts = {}, changedItems = [], changedTransactions = [], inventoryMovements = [];
            var exactRestored = 0, legacyUnchanged = 0, missingProducts = 0, timestamp = nowIso();
            requestedIds.forEach(function (id) {
              var sourceTransaction = transactionsById[id];
              var row = Object.assign({}, sourceTransaction);
              var stockWarnings = [];
              if (row.type === "SALE" && row.basketId) {
                (itemsByBasket[row.basketId] || []).forEach(function (sourceItem) {
                  if (isManualBasketItem(sourceItem) || !sourceItem.productId) return;
                  var item = Object.assign({}, sourceItem);
                  var priorState = String(item.stockRestorationState || "");
                  var hasExactDelta = item.stockAppliedQuantity !== undefined && item.stockAppliedQuantity !== null && item.stockAppliedQuantity !== "";
                  if (priorState === "restored") {
                    stockWarnings.push("El stock de una linea ya figuraba restituido; no se sumo otra vez");
                  } else if (!hasExactDelta) {
                    item.stockRestorationState = "legacy-unchanged";
                    item.stockRestoredQuantity = 0;
                    item.stockRestoredAt = timestamp;
                    item.stockRestoredBy = currentUser && currentUser.username || "";
                    item.stockRestorationWarning = "Venta antigua sin delta exacto: stock sin cambios";
                    legacyUnchanged += 1;
                    stockWarnings.push("Venta antigua sin delta exacto; el stock quedo sin cambios");
                  } else {
                    var applied = Math.max(0, Number(item.stockAppliedQuantity || 0));
                    var product = productsById[item.productId];
                    if (applied > 0 && !product) {
                      item.stockRestorationState = "product-missing";
                      item.stockRestoredQuantity = 0;
                      item.stockRestoredAt = timestamp;
                      item.stockRestoredBy = currentUser && currentUser.username || "";
                      item.stockRestorationWarning = "Producto no encontrado: stock sin cambios";
                      missingProducts += 1;
                      stockWarnings.push("No se encontro un producto para restituir su stock");
                    } else {
                      if (product && applied > 0) {
                        var pools = productCostPools(product);
                        var knownRestore = Math.max(0, Number(item.costKnownQuantity || 0));
                        var unknownRestore = Math.max(0, Number(item.costUnknownQuantity || Math.max(0, applied - knownRestore)));
                        var valueRestore = Math.max(0, Number(item.knownCostAmount || 0));
                        pools.known += knownRestore; pools.unknown += unknownRestore; pools.value += valueRestore;
                        product.stock = moneyPrecision(Number(product.stock || 0) + applied);
                        applyCostPools(product, pools);
                        product.updatedAt = timestamp;
                        changedProducts[product.id] = product;
                        inventoryMovements.push({ id: uid(), type: "SALE_REVERSAL", productId: product.id, quantity: applied, knownCostQuantity: knownRestore, unknownCostQuantity: unknownRestore, knownCostValue: valueRestore, referenceType: "SALE", referenceId: row.id, referenceLineId: item.id, reason: reason, createdAt: timestamp, createdBy: currentUser && currentUser.id });
                      }
                      item.stockRestorationState = "restored";
                      item.stockRestoredQuantity = moneyPrecision(applied);
                      item.stockRestoredAt = timestamp;
                      item.stockRestoredBy = currentUser && currentUser.username || "";
                      item.stockRestorationWarning = "";
                      exactRestored += 1;
                    }
                  }
                  changedItems.push(item);
                });
              }
              if (stockWarnings.length) {
                var warning = stockWarnings.filter(function (message, index, rows) { return rows.indexOf(message) === index; }).join("; ");
                row.stockReviewRequired = true;
                row.stockReversalWarning = warning;
                row.reviewReason = appendMovementReviewReason(row.reviewReason, warning);
              } else {
                row.stockReviewRequired = false;
                row.stockReversalWarning = "";
              }
              row.stockRestorationState = stockWarnings.length ? "review-required" : (row.type === "SALE" && row.basketId ? "restored" : "not-applicable");
              row.deleted = true;
              row.deleteReason = reason;
              row.reviewRequired = true;
              row.deletedAt = timestamp;
              row.deletedBy = currentUser && currentUser.username;
              changedTransactions.push(row);
            });
            summary = {
              transactions: changedTransactions.length,
              exactRestored: exactRestored,
              legacyUnchanged: legacyUnchanged,
              missingProducts: missingProducts,
              warning: legacyUnchanged > 0 || missingProducts > 0
            };
            changedTransactions.forEach(function (row) { transactionStore.put(row); });
            changedItems.forEach(function (item) { itemStore.put(item); });
            Object.keys(changedProducts).forEach(function (id) { productStore.put(changedProducts[id]); });
            inventoryMovements.forEach(function (movement) { transaction.objectStore("inventoryMovements").put(movement); });
            var auditDetail = changedTransactions.length + " movimiento(s) | Motivo: " + reason
              + " | stock exacto restituido: " + exactRestored
              + (legacyUnchanged ? " | lineas antiguas sin cambio: " + legacyUnchanged : "")
              + (missingProducts ? " | productos faltantes: " + missingProducts : "");
            transaction.objectStore("auditLog").put({
              id: uid(), createdAt: timestamp, userId: currentUser && currentUser.id, username: currentUser && currentUser.username,
              action: options.auditAction || "MOVEMENTS_DELETED_REVIEW_REQUIRED", detail: auditDetail,
              severity: summary.warning ? "critical" : (options.auditSeverity || "warning")
            });
          } catch (error) {
            cancel(error && error.message || "No se pudo validar el movimiento");
          }
        }
        var transactionRequest = transactionStore.getAll();
        transactionRequest.onsuccess = function () { transactions = transactionRequest.result || []; pending -= 1; stageWrites(); };
        transactionRequest.onerror = function () { cancel("No se pudieron releer los movimientos"); };
        var itemRequest = itemStore.getAll();
        itemRequest.onsuccess = function () { basketItems = itemRequest.result || []; pending -= 1; stageWrites(); };
        itemRequest.onerror = function () { cancel("No se pudieron releer los items"); };
        var productRequest = productStore.getAll();
        productRequest.onsuccess = function () { products = productRequest.result || []; pending -= 1; stageWrites(); };
        productRequest.onerror = function () { cancel("No se pudo releer el stock"); };
        transaction.oncomplete = function () {
          invalidateProductSearchCache();
          if (diskSnapshotWritesEnabled && !diskSnapshotPaused) scheduleDiskSnapshot();
          resolve(summary);
        };
        transaction.onerror = function () { reject(transaction.error || new Error(abortMessage || "No se pudo borrar el movimiento")); };
        transaction.onabort = function () { reject(transaction.error || new Error(abortMessage || "Borrado cancelado")); };
      });
    });
  }
  function undoSaleById(id, reason) {
    var expectedSale = pendingUndoSale && pendingUndoSale.id === id ? Object.assign({}, pendingUndoSale) : null;
    deleteTransactionsWithStock([id], reason, {
      type: "SALE",
      sessionId: currentSession && currentSession.id,
      expectedTransactions: expectedSale ? [expectedSale] : [],
      requireExpected: true,
      auditAction: "SALE_UNDONE_REVIEW_REQUIRED",
      auditSeverity: "critical"
    }).then(function (summary) {
      closeUndoModal();
      renderAll();
      toast(summary.warning
        ? "Venta deshecha. El stock antiguo sin delta exacto quedo marcado para revisar."
        : "Venta deshecha y stock restituido");
    }).catch(function (error) {
      toast(error && error.message || "No se pudo deshacer la venta");
    });
  }
  function saveWithdrawal(e) {
    e.preventDefault();
    var amount = parseMoney($("withdrawAmount").value);
    if (amount <= 0) { toast("Ingrese monto de retiro"); return; }
    var who = $("withdrawBy") ? $("withdrawBy").value.trim() : "";
    if (!who) { toast("Indique quien retiro el dinero"); $("withdrawBy").focus(); return; }
    var note = $("withdrawDescription").value.trim();
    add("transactions", {
      id: uid(), type: "WITHDRAWAL", amount: amount, paymentMethod: "Efectivo",
      description: (who ? "Retiro: " + who : "Retiro") + (note ? " - " + note : ""), businessDate: currentSession.businessDate,
      shiftType: currentSession.shiftType, userId: currentUser.id, sessionId: currentSession.id,
      createdAt: nowIso(), deleted: false
    }).then(function () {
      $("withdrawAmount").value = "";
      if ($("withdrawBy")) $("withdrawBy").value = "";
      $("withdrawDescription").value = "";
      return audit("WITHDRAWAL_CREATED", money(amount));
    }).then(function () {
      closeWithdrawModal();
      renderAll();
      toast("Retiro registrado");
    });
  }

  function recentSalesWindowStart(referenceDate) {
    var now = referenceDate ? new Date(referenceDate) : new Date();
    var start = new Date(now.getTime());
    if (now.getHours() >= 22) start.setHours(22, 0, 0, 0);
    else if (now.getHours() >= 14) start.setHours(14, 0, 0, 0);
    else {
      start.setDate(start.getDate() - 1);
      start.setHours(22, 0, 0, 0);
    }
    return start;
  }
  function renderCaja() {
    syncSessionDateIfChanged();
    var lastSalesWindowStart = recentSalesWindowStart();
    lastSalesWindowKey = lastSalesWindowStart.toISOString();
    if ($("quickButtons")) $("quickButtons").innerHTML = quickButtons.map(function (v) {
      return "<button type='button' data-sale='" + v + "'>" + money(v) + "</button>";
    }).join("");
    Promise.all([all("transactions"), all("basketItems")]).then(function (data) {
      var trs = data[0];
      var itemsByBasket = {};
      data[1].forEach(function (it) {
        if (!it.basketId) return;
        if (!itemsByBasket[it.basketId]) itemsByBasket[it.basketId] = [];
        itemsByBasket[it.basketId].push(it);
      });
      var allSales = trs.filter(function (t) {
        var createdAt = new Date(t.createdAt).getTime();
        return t.type === "SALE" && !t.deleted && isFinite(createdAt) && createdAt >= lastSalesWindowStart.getTime();
      })
        .sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
      var sales = allSales.slice(0, 10);
      $("lastSales").innerHTML = sales.length ? sales.map(function (s) {
        var status = transferStatusHtml(s);
        return lastSaleHtml(s, itemsByBasket[s.basketId] || [], status);
      }).join("") : empty("Sin ventas todavia");
      document.querySelectorAll("[data-sale-detail]").forEach(function (button) {
        button.onclick = function () { openSaleDetail(button.dataset.saleDetail); };
      });
      document.querySelectorAll("[data-transfer-received]").forEach(function (btn) {
        btn.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          markTransferReceived(btn.dataset.transferReceived);
        };
      });
    });
    renderBasket();
    renderProducts();
  }
  function lastSaleHtml(sale, items, status) {
    var time = new Date(sale.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
    var itemCount = items.length || Number(sale.itemCount || 0);
    return "<button type='button' class='last-sale-card' data-sale-detail='" + escapeHtml(sale.id) + "'>"
      + "<b>" + time + "</b><span>" + escapeHtml(paymentDisplayName(sale.paymentMethod)) + "</span>"
      + "<small>" + itemCount + (itemCount === 1 ? " item" : " items") + "</small>" + status
      + "<strong>" + money(sale.amount) + "</strong></button>";
  }
  function openSaleDetail(id) {
    Promise.all([all("transactions"), all("basketItems"), all("users")]).then(function (data) {
      var sale = data[0].filter(function (row) { return row.id === id && row.type === "SALE" && !row.deleted; })[0];
      if (!sale) { toast("Venta no encontrada"); return; }
      var items = data[1].filter(function (item) { return sale.basketId && item.basketId === sale.basketId; });
      var user = data[2].filter(function (row) { return row.id === sale.userId; })[0];
      var paid = isCashPayment(sale.paymentMethod) ? Number(sale.paidAmount || 0) : Number(sale.amount || 0);
      var change = isCashPayment(sale.paymentMethod) ? Number(sale.changeAmount != null ? sale.changeAmount : Math.max(0, paid - Number(sale.amount || 0))) : 0;
      var paymentParts = salePaymentParts(sale);
      var unroundedAmount = Number(sale.unroundedAmount != null ? sale.unroundedAmount : sale.amount || 0);
      var roundingAdjustment = Number(sale.roundingAdjustment != null ? sale.roundingAdjustment : Number(sale.amount || 0) - unroundedAmount);
      var grossSubtotal = Number(sale.grossSubtotal != null ? sale.grossSubtotal : unroundedAmount + Number(sale.discountAmount || 0));
      var discountAmount = Math.max(0, Number(sale.discountAmount || 0));
      sale.userName = sale.userName || (user && (user.displayName || user.username)) || "";
      pendingSaleDetail = { sale: sale, items: items, paidAmount: paid, changeAmount: change };
      $("saleDetailTitle").textContent = "Venta " + String(sale.id).slice(-8).toUpperCase();
      $("saleDetailContent").innerHTML = "<div class='sale-detail-summary'>"
        + "<div><span>Fecha</span><b>" + escapeHtml(new Date(sale.createdAt).toLocaleString("es-AR")) + "</b></div>"
        + "<div><span>Empleado</span><b>" + escapeHtml(sale.userName || "Sin dato") + "</b></div>"
        + "<div><span>Metodo</span><b>" + escapeHtml(paymentDisplayName(sale.paymentMethod)) + "</b></div>"
        + "<div><span>Estado</span><b>" + escapeHtml(isDigitalPayment(sale.paymentMethod) ? (sale.paymentStatus || sale.transferStatus || "Manual") : "Pagado") + "</b></div>"
        + (isSplitPayment(sale.paymentMethod) ? "<div><span>Parte en efectivo</span><b>" + money(paymentParts.cash) + "</b></div><div><span>Parte por QR</span><b>" + money(paymentParts.qr) + "</b></div>" : "")
        + "<div><span>Monto recibido</span><b>" + money(paid) + "</b></div>"
        + "<div><span>Vuelto</span><b>" + money(change) + "</b></div></div>"
        + "<div class='sale-detail-items'>" + (items.length ? items.map(function (item) {
          return "<div><span><b>" + escapeHtml(item.productName || "Producto") + "</b><small>" + escapeHtml(String(item.quantity || 1)) + " " + escapeHtml(unitLabel(item.unitType, item.quantity)) + " x " + money(item.unitPrice) + "</small></span><strong>" + money(item.subtotal) + "</strong></div>";
        }).join("") : "<p class='last-sale-empty'>Venta general sin detalle de productos.</p>") + "</div>"
        + (discountAmount >= 0.01 || Math.abs(roundingAdjustment) >= 0.01 ? "<div class='sale-detail-rounding'>"
          + (discountAmount >= 0.01 ? "<div><span>Subtotal de productos</span><b>" + money(grossSubtotal) + "</b></div><div><span>Descuento" + (sale.discountType === "percent" && sale.discountValue ? " " + formatQuantity(sale.discountValue) + "%" : "") + "</span><b>- " + money(discountAmount) + "</b></div>" : "")
          + (Math.abs(roundingAdjustment) >= 0.01 ? "<div><span>Subtotal luego del descuento</span><b>" + money(unroundedAmount) + "</b></div><div><span>Redondeo hacia abajo</span><b>" + money(roundingAdjustment) + "</b></div>" : "") + "</div>" : "")
        + "<div class='sale-detail-total'><span>Total</span><b>" + money(sale.amount) + "</b></div>";
      $("saleDetailModal").classList.remove("hidden");
    });
  }
  function closeSaleDetail() {
    if ($("saleDetailModal")) $("saleDetailModal").classList.add("hidden");
    pendingSaleDetail = null;
  }
  function reprintSelectedSale() {
    if (!pendingSaleDetail) return;
    var detail = pendingSaleDetail;
    var win = openReceiptPrintWindow();
    printReceipt(buildReceipt(detail.sale, detail.items, {
      paidAmount: detail.paidAmount,
      changeAmount: detail.changeAmount
    }), win);
    detail.sale.reprintCount = Number(detail.sale.reprintCount || 0) + 1;
    detail.sale.lastReprintedAt = nowIso();
    add("transactions", detail.sale).then(function () {
      return audit("SALE_TICKET_REPRINTED", money(detail.sale.amount) + " | " + detail.sale.id, "normal");
    });
    toast("Ticket enviado a impresion");
  }
  function transferStatusHtml(sale) {
    if (!isDigitalPayment(sale.paymentMethod)) return "<i class='transfer-status empty-status'></i>";
    var status = String(sale.paymentStatus || sale.transferStatus || "MANUAL").toUpperCase();
    if (["APPROVED", "PAID", "RECEIVED", "PROCESSED"].indexOf(status) >= 0) return "<i class='transfer-status received'>Aprobado</i>";
    if (status === "MANUAL") return "<i class='transfer-status manual'>Manual</i>";
    if (status === "REVIEW") return "<i class='transfer-status review'>Revisar</i>";
    return "<i class='transfer-status pending'>Pendiente</i>";
  }
  function markTransferReceived(id) {
    all("transactions").then(function (trs) {
      var sale = trs.filter(function (t) {
        return t.id === id && t.type === "SALE" && !t.deleted && isDigitalPayment(t.paymentMethod);
      })[0];
      if (!sale) { toast("Pago digital no encontrado"); return; }
      sale.transferStatus = "RECEIVED";
      sale.paymentStatus = "APPROVED";
      sale.transferReceivedAt = nowIso();
      sale.transferReceivedBy = currentUser && currentUser.username;
      add("transactions", sale).then(function () {
        return audit("DIGITAL_PAYMENT_APPROVED", money(sale.amount) + " confirmado por " + (currentUser && currentUser.username), "normal");
      }).then(function () {
        renderAll();
        if (!$("reviewTransfersModal").classList.contains("hidden")) renderReviewTransfersList();
        toast("Pago marcado como aprobado");
      });
    });
  }
  function openClosurePaymentsModal(kind) {
    closurePaymentDetailKind = kind === "cash" ? "cash" : "digital";
    $("reviewTransfersModal").classList.remove("hidden");
    renderReviewTransfersList();
  }
  function openReviewTransfersModal() {
    openClosurePaymentsModal("digital");
  }
  function closeReviewTransfersModal() {
    $("reviewTransfersModal").classList.add("hidden");
  }
  function renderReviewTransfersList() {
    activeTransactions().then(function (trs) {
      var isCashList = closurePaymentDetailKind === "cash";
      var rows = trs.filter(function (t) {
        return t.type === "SALE"
          && inferredBusinessDate(t) === activeClosureDate()
          && (isCashList ? salePaymentParts(t).cash > 0 : salePaymentParts(t).qr > 0);
      }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
      if ($("closurePaymentsModalTitle")) $("closurePaymentsModalTitle").textContent = isCashList ? "Efectivo del dia" : "QR del dia";
      if ($("closurePaymentsModalNote")) $("closurePaymentsModalNote").textContent = isCashList
        ? "Ventas en efectivo registradas para el cierre seleccionado."
        : "Pagos QR registrados para el cierre seleccionado.";
      $("reviewTransfersList").innerHTML = rows.length ? rows.map(function (t) {
        var status = isCashList ? "Efectivo" : (isSplitPayment(t.paymentMethod) ? "<i class='transfer-status manual'>Parte QR</i>" : transferStatusHtml(t));
        return "<div class='review-transfer-row'>"
          + "<div><b>" + new Date(t.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + "</b><span>" + escapeHtml(paymentDisplayName(t.paymentMethod)) + " · " + escapeHtml(t.saleMode || "Venta") + "</span></div>"
          + "<strong>" + money(isCashList ? salePaymentParts(t).cash : salePaymentParts(t).qr) + "</strong>"
          + (isCashList ? "<i class='transfer-status received'>Efectivo</i>" : status)
          + "</div>";
      }).join("") : empty(isCashList ? "No hay ventas en efectivo ese dia" : "No hay pagos QR ese dia");
    });
  }
  function startMpSync() {
    clearInterval(mpSyncTimer);
    syncMercadoPagoStatuses();
    mpSyncTimer = setInterval(syncMercadoPagoStatuses, isLegacyPerformance() ? 30000 : 8000);
  }
  function syncMercadoPagoStatuses() {
    var s = integrationSettings();
    if (!s.supabaseUrl || !s.supabaseAnonKey || !currentUser) return;
    all("transactions").then(function (trs) {
      var refs = trs.filter(function (t) {
        return t.type === "SALE" && !t.deleted && t.mpExternalReference && String(t.paymentStatus || t.transferStatus || "").toUpperCase() === "PENDING";
      }).map(function (t) { return t.mpExternalReference; });
      if (!refs.length) return;
      return callSupabaseFunction("mp-status", { externalReferences: refs }).then(function (data) {
        var byRef = {};
        (data.sales || []).forEach(function (row) { byRef[row.external_reference] = row; });
        return Promise.all(trs.map(function (t) {
          var row = byRef[t.mpExternalReference];
          if (!row || String(t.paymentStatus || t.transferStatus || "").toUpperCase() !== "PENDING") return Promise.resolve();
          var rowStatus = String(row.status || "").toLowerCase();
          if (["approved", "processed", "paid"].indexOf(rowStatus) >= 0) {
            t.paymentStatus = "APPROVED";
            t.transferStatus = "RECEIVED";
          } else if (["rejected", "cancelled", "canceled", "expired"].indexOf(rowStatus) >= 0) {
            t.paymentStatus = "REVIEW";
            t.transferStatus = "REVIEW";
          }
          else return Promise.resolve();
          t.mpPaymentId = row.payment_id || t.mpPaymentId;
          t.mpOrderId = row.order_id || t.mpOrderId;
          t.transferReceivedAt = row.approved_at || t.transferReceivedAt;
          return add("transactions", t).then(function () {
            return audit("MP_STATUS_SYNCED", money(t.amount) + " " + t.paymentStatus, t.paymentStatus === "REVIEW" ? "warning" : "normal");
          });
        })).then(renderAll);
      }).catch(function () {});
    });
  }
  function hasMercadoPagoConfig(method) {
    var settings = integrationSettings();
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return false;
    return method === "QR" ? !!settings.mpExternalPosId : !!settings.mpTerminalId;
  }
  function checkoutMercadoPago(method, shouldPrint, printWindow) {
    var amounts = basketSaleAmounts(basket);
    var total = amounts.total;
    if (total <= 0) { toast("Ticket vacio"); return Promise.resolve(); }
    var settings = integrationSettings();
    var externalReference = uid();
    var details = basket.slice();
    var manualItemCount = details.filter(function (item) { return item.manualItem || item.source === "manual-item"; }).length;
    var hasReviewItems = details.some(function (item) { return item.reviewFlag; });
    setSubmitting(true);
    return callSupabaseFunction("create-mp-order", {
      externalReference: externalReference,
      amount: total,
      grossSubtotal: amounts.grossSubtotal,
      discountType: amounts.discountType,
      discountValue: amounts.discountValue,
      discountAmount: amounts.discountAmount,
      unroundedAmount: amounts.unroundedAmount,
      roundingAdjustment: amounts.roundingAdjustment,
      mode: method === "QR" ? "qr" : "point",
      paymentMethod: method,
      terminalId: settings.mpTerminalId || "",
      externalPosId: settings.mpExternalPosId || "",
      businessDate: currentSession.businessDate,
      shiftType: currentSession.shiftType,
      items: amounts.discountAmount > 0 || Math.abs(amounts.roundingAdjustment) >= 0.01
        ? [{ title: "Ticket La Vieja Esquina (ajustado)", quantity: 1, unit_price: total }]
        : details.map(function (it) {
          return { title: it.productName, quantity: Number(it.quantity || 1), unit_price: Number(it.unitPrice || it.subtotal || 0) };
        })
    }).then(function (order) {
      return saveExternalSale(amounts.unroundedAmount, method, method === "QR" ? "MERCADO_PAGO_QR" : "MERCADO_PAGO_POINT", details, {
        paymentStatus: "PENDING",
        transferStatus: "PENDING",
        mpExternalReference: externalReference,
        mpOrderId: order.orderId || "",
        mpPaymentId: order.paymentId || "",
        paidAmount: total,
        changeAmount: 0,
        itemCount: details.length,
        grossSubtotal: amounts.grossSubtotal,
        discountType: amounts.discountType,
        discountValue: amounts.discountValue,
        discountAmount: amounts.discountAmount,
        unroundedAmount: amounts.unroundedAmount,
        roundingAdjustment: amounts.roundingAdjustment,
        reviewFlag: hasReviewItems,
        manualItemCount: manualItemCount,
        reviewReason: manualItemCount ? "Ticket con item manual sin registrar" : (hasReviewItems ? "Ticket con producto escaneado no registrado" : "")
      }).then(function (sale) {
        if (shouldPrint) printReceipt(buildReceipt(sale, details, { paidAmount: total, changeAmount: 0 }), printWindow);
        toast(method === "QR" ? "Importe enviado al QR de Mercado Pago" : "Cobro enviado al Point Smart");
        startMpSync();
      });
    }).catch(function (err) {
      toast(err.message || "No se pudo crear pago Mercado Pago");
      if (printWindow && !printWindow.closed) printWindow.close();
    }).catch(function (error) {
      toast(error && error.message || "No se pudo registrar la venta; el ticket sigue abierto");
      return null;
    }).finally(function () {
      setSubmitting(false);
    });
  }
  function basketItemAllowsWholeQuantity(item) {
    return item && !isManualBasketItem(item) && !isVariableQuantityProduct(item);
  }
  function setBasketItemQuantity(index, nextQuantity) {
    var item = basket[index];
    if (!basketItemAllowsWholeQuantity(item)) return;
    var quantity = Math.max(1, Math.round(Number(nextQuantity || 1)));
    item.quantity = quantity;
    item.subtotal = moneyPrecision(quantity * Number(item.unitPrice || 0));
    renderBasket();
  }
  function renderBasket() {
    var amounts = basketSaleAmounts(basket);
    var total = amounts.total;
    var method = $("ticketPaymentSelect") ? $("ticketPaymentSelect").value : "Efectivo";
    var cash = isCashPayment(method);
    var split = isSplitPayment(method);
    if ($("ticketCashDetails")) {
      $("ticketCashDetails").classList.toggle("hidden", !cash);
      $("ticketCashDetails").classList.toggle("cash-active", cash);
    }
    if ($("ticketSplitDetails")) $("ticketSplitDetails").classList.toggle("hidden", !split);
    document.querySelectorAll("[data-ticket-payment]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.ticketPayment === method);
    });
    if ($("ticketPaymentHint")) {
      $("ticketPaymentHint").textContent = cash ? "Ingrese el monto recibido para calcular el vuelto."
        : (split ? "Ingrese la parte en efectivo; el resto se calcula para QR."
          : (hasMercadoPagoConfig(method) ? "El importe exacto se enviara a Mercado Pago y se verificara automaticamente." : "Se registrara como pago manual hasta conectar Mercado Pago."));
    }
    if (!cash && $("ticketPaid")) $("ticketPaid").value = "";
    if (!split && $("ticketSplitCash")) $("ticketSplitCash").value = "";
    document.querySelectorAll("[data-ticket-discount-type]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.ticketDiscountType === amounts.discountType);
    });
    if ($("ticketDiscountAmount")) $("ticketDiscountAmount").textContent = "- " + money(amounts.discountAmount);
    if ($("clearTicketDiscountBtn")) $("clearTicketDiscountBtn").disabled = !(amounts.discountAmount > 0 || ticketDiscount.value > 0);
    if ($("basketRoundingSummary")) $("basketRoundingSummary").classList.toggle("hidden", Math.abs(amounts.roundingAdjustment) < 0.01);
    if ($("basketSubtotal")) $("basketSubtotal").textContent = money(amounts.unroundedAmount);
    if ($("basketRoundingAdjustment")) $("basketRoundingAdjustment").textContent = money(amounts.roundingAdjustment);
    if ($("basketTotal")) $("basketTotal").textContent = money(total);
    if ($("ticketChange")) $("ticketChange").textContent = cash ? money(Math.max(0, parseMoney($("ticketPaid") && $("ticketPaid").value) - total)) : money(0);
    if ($("ticketSplitQr")) $("ticketSplitQr").textContent = money(Math.max(0, total - parseMoney($("ticketSplitCash") && $("ticketSplitCash").value)));
    $("basketItems").innerHTML = basket.length ? basket.map(function (it, i) {
      var quantityControl = basketItemAllowsWholeQuantity(it)
        ? "<span class='ticket-quantity-control'><button type='button' data-basket-minus='" + i + "' aria-label='Restar una unidad'>−</button><input data-basket-quantity='" + i + "' inputmode='numeric' value='" + Math.max(1, Math.round(Number(it.quantity || 1))) + "' aria-label='Cantidad de " + escapeHtml(it.productName) + "'><button type='button' data-basket-plus='" + i + "' aria-label='Sumar una unidad'>+</button></span>"
        : "<b class='ticket-line-quantity'>" + escapeHtml(formatQuantity(it.quantity)) + " " + escapeHtml(unitLabel(it.unitType, it.quantity)) + "</b>";
      return "<div class='compact-row ticket-line " + (it.reviewFlag ? "review-line" : "") + "'><span><b>" + escapeHtml(it.productName) + "</b><small>" + quantityControl + "<em>x " + money(it.unitPrice) + (it.reviewFlag && !isManualBasketItem(it) ? " | revisar" : "") + "</em></small></span><strong>" + money(it.subtotal) + "</strong><button class='small danger' data-remove-basket='" + i + "'>x</button></div>";
    }).join("") : empty("Ticket vacio");
    document.querySelectorAll("[data-basket-minus]").forEach(function (button) {
      button.onclick = function () { var index = Number(button.dataset.basketMinus); setBasketItemQuantity(index, Number(basket[index] && basket[index].quantity || 1) - 1); };
    });
    document.querySelectorAll("[data-basket-plus]").forEach(function (button) {
      button.onclick = function () { var index = Number(button.dataset.basketPlus); setBasketItemQuantity(index, Number(basket[index] && basket[index].quantity || 1) + 1); };
    });
    document.querySelectorAll("[data-basket-quantity]").forEach(function (input) {
      input.onchange = function () { setBasketItemQuantity(Number(input.dataset.basketQuantity), input.value); };
      input.onkeydown = function (event) { if (event.key === "Enter") { event.preventDefault(); input.blur(); } };
    });
    document.querySelectorAll("[data-remove-basket]").forEach(function (b) {
      b.onclick = function () { basket.splice(Number(b.dataset.removeBasket), 1); renderBasket(); };
    });
    if ($("clearBasketBtn")) $("clearBasketBtn").disabled = !basket.length;
    if ($("chargeBasketBtn")) $("chargeBasketBtn").disabled = !basket.length;
    clearTimeout(autoTicketTimer);
  }
  function clearBasketContents() {
    if (!basket.length) {
      toast("El carrito ya esta vacio");
      return;
    }
    basket = [];
    resetTicketDiscount();
    if ($("ticketPaid")) $("ticketPaid").value = "";
    if ($("ticketSplitCash")) $("ticketSplitCash").value = "";
    clearProductSearch();
    renderBasket();
    toast("Carrito vaciado");
  }
  function buildReceipt(transaction, items, extra) {
    items = (items || []).slice();
    extra = extra || {};
    var itemSubtotal = items.reduce(function (a, b) { return a + Number(b.subtotal || 0); }, 0);
    var total = transaction && transaction.amount != null ? Number(transaction.amount) : saleAmounts(itemSubtotal).total;
    var unroundedAmount = extra.unroundedAmount != null ? Number(extra.unroundedAmount)
      : transaction && transaction.unroundedAmount != null ? Number(transaction.unroundedAmount) : itemSubtotal || total;
    var roundingAdjustment = extra.roundingAdjustment != null ? Number(extra.roundingAdjustment)
      : transaction && transaction.roundingAdjustment != null ? Number(transaction.roundingAdjustment) : moneyPrecision(total - unroundedAmount);
    var grossSubtotal = extra.grossSubtotal != null ? Number(extra.grossSubtotal)
      : transaction && transaction.grossSubtotal != null ? Number(transaction.grossSubtotal) : itemSubtotal || unroundedAmount;
    var discountAmount = extra.discountAmount != null ? Number(extra.discountAmount)
      : transaction && transaction.discountAmount != null ? Number(transaction.discountAmount) : Math.max(0, grossSubtotal - unroundedAmount);
    return {
      id: transaction && transaction.id || "SIN-REGISTRAR",
      createdAt: transaction && transaction.createdAt || nowIso(),
      businessDate: transaction && transaction.businessDate || (currentSession && currentSession.businessDate) || today(),
      shiftType: transaction && transaction.shiftType || (currentSession && currentSession.shiftType) || "",
      user: transaction && (transaction.userName || transaction.userDisplayName) || currentUser && (currentUser.displayName || currentUser.username) || "",
      paymentMethod: transaction && transaction.paymentMethod || ($("ticketPaymentSelect") && $("ticketPaymentSelect").value) || PAYMENT,
      total: total,
      grossSubtotal: grossSubtotal,
      discountType: extra.discountType || transaction && transaction.discountType || "",
      discountValue: Number(extra.discountValue != null ? extra.discountValue : transaction && transaction.discountValue || 0),
      discountAmount: discountAmount,
      unroundedAmount: unroundedAmount,
      roundingAdjustment: roundingAdjustment,
      paidAmount: extra.paidAmount != null ? Number(extra.paidAmount) : Number(transaction && transaction.paidAmount || 0),
      changeAmount: extra.changeAmount != null ? Number(extra.changeAmount) : Number(transaction && transaction.changeAmount || 0),
      cashAmount: extra.cashAmount != null ? Number(extra.cashAmount) : Number(transaction && transaction.cashAmount || 0),
      qrAmount: extra.qrAmount != null ? Number(extra.qrAmount) : Number(transaction && transaction.qrAmount || 0),
      items: items,
      settings: ticketSettings()
    };
  }
  function receiptHtml(receipt) {
    var date = new Date(receipt.createdAt);
    var paid = Number(receipt.paidAmount || 0);
    var change = Number(receipt.changeAmount || 0);
    var unroundedAmount = Number(receipt.unroundedAmount != null ? receipt.unroundedAmount : receipt.total || 0);
    var roundingAdjustment = Number(receipt.roundingAdjustment != null ? receipt.roundingAdjustment : Number(receipt.total || 0) - unroundedAmount);
    var grossSubtotal = Number(receipt.grossSubtotal != null ? receipt.grossSubtotal : unroundedAmount + Number(receipt.discountAmount || 0));
    var discountAmount = Math.max(0, Number(receipt.discountAmount || 0));
    var settings = receipt.settings || ticketSettings();
    var businessName = settings.businessName || "FORRAJERIA LA VIEJA ESQUINA";
    var legal = [settings.cuit ? "CUIT: " + settings.cuit : "", settings.address || "", settings.iva || "Comprobante no fiscal"].filter(Boolean);
    return "<!doctype html><html><head><meta charset='utf-8'><title>Ticket</title><style>"
      + "@page{size:58mm auto;margin:0}*{box-sizing:border-box}body{margin:0;padding:8px;width:58mm;font-family:Consolas,'Courier New',monospace;color:#000;background:#fff;font-size:11px}.center{text-align:center}.brand{font-weight:900;font-size:15px;text-transform:uppercase}.line{border-top:1px dashed #000;margin:7px 0}.row{display:flex;justify-content:space-between;gap:6px}.item{margin:5px 0}.item b{display:block;font-size:11px}.item small{display:block}.total{font-size:15px;font-weight:900}.muted{font-size:10px}p{margin:3px 0}.legal{font-size:10px;line-height:1.25}</style></head><body>"
      + "<div class='center'><div class='brand'>" + escapeHtml(businessName) + "</div><p>Ticket de venta</p>" + legal.map(function (x) { return "<p class='legal'>" + escapeHtml(x) + "</p>"; }).join("") + "<p class='muted'>" + escapeHtml(receipt.businessDate) + " " + escapeHtml(receipt.shiftType || "") + "</p></div>"
      + "<div class='line'></div><p>Fecha: " + escapeHtml(date.toLocaleString("es-AR")) + "</p><p>Usuario: " + escapeHtml(receipt.user || "") + "</p><p>Pago: " + escapeHtml(receipt.paymentMethod || "") + "</p><p>Nro: " + escapeHtml(String(receipt.id).slice(-8).toUpperCase()) + "</p>"
      + "<div class='line'></div>"
      + (receipt.items.length ? receipt.items.map(function (it) {
        return "<div class='item'><b>" + escapeHtml(it.productName) + "</b><div class='row'><small>" + escapeHtml(String(it.quantity)) + " " + escapeHtml(unitLabel(it.unitType, it.quantity)) + " x " + money(it.unitPrice) + "</small><span>" + money(it.subtotal) + "</span></div>" + (it.reviewFlag ? "<small class='muted'>Pendiente revision admin</small>" : "") + "</div>";
      }).join("") : "<p>Venta general</p>")
      + "<div class='line'></div>"
      + (discountAmount >= 0.01 ? "<div class='row'><span>Subtotal</span><span>" + money(grossSubtotal) + "</span></div><div class='row'><span>Descuento" + (receipt.discountType === "percent" && receipt.discountValue ? " " + formatQuantity(receipt.discountValue) + "%" : "") + "</span><span>- " + money(discountAmount) + "</span></div>" : "")
      + (Math.abs(roundingAdjustment) >= 0.01 ? "<div class='row'><span>Luego del descuento</span><span>" + money(unroundedAmount) + "</span></div><div class='row'><span>Redondeo</span><span>" + money(roundingAdjustment) + "</span></div>" : "")
      + "<div class='row total'><span>Total</span><span>" + money(receipt.total) + "</span></div>"
      + (isSplitPayment(receipt.paymentMethod) ? "<div class='row'><span>Efectivo</span><span>" + money(receipt.cashAmount) + "</span></div><div class='row'><span>QR</span><span>" + money(receipt.qrAmount) + "</span></div>" : "")
      + (paid && !isSplitPayment(receipt.paymentMethod) ? "<div class='row'><span>Paga</span><span>" + money(paid) + "</span></div><div class='row'><span>Vuelto</span><span>" + money(change) + "</span></div>" : "")
      + "<div class='line'></div><p class='center'>Gracias por su compra</p></body></html>";
  }
  function openReceiptPrintWindow() {
    var win = null;
    try {
      win = window.open("", "forrajeria_ticket_print", "width=340,height=680");
    } catch (e) {
      win = null;
    }
    if (win) {
      try {
        win.document.open();
        win.document.write("<!doctype html><html><head><title>Ticket</title></head><body style='font-family:monospace;padding:12px'>Preparando ticket...</body></html>");
        win.document.close();
      } catch (e2) {
        win = null;
      }
    }
    return win;
  }
  function printReceiptWindow(receipt, win) {
    if (!win || win.closed) return false;
    try {
      win.document.open();
      win.document.write(receiptHtml(receipt));
      win.document.close();
      setTimeout(function () {
        try {
          win.focus();
          win.print();
        } catch (e) {
          toast("No se pudo abrir impresion");
        }
      }, 120);
      return true;
    } catch (e2) {
      return false;
    }
  }
  function printReceipt(receipt, targetWindow) {
    lastReceipt = receipt;
    if (printReceiptWindow(receipt, targetWindow)) return;
    var win = openReceiptPrintWindow();
    if (printReceiptWindow(receipt, win)) return;
    var frame = document.createElement("iframe");
    frame.className = "receipt-print-frame";
    frame.setAttribute("aria-hidden", "true");
    document.body.appendChild(frame);
    var doc = frame.contentWindow.document;
    doc.open();
    doc.write(receiptHtml(receipt));
    doc.close();
    setTimeout(function () {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (e) {
        toast("No se pudo abrir impresion");
      }
      setTimeout(function () {
        if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
      }, 1200);
    }, 220);
  }
  function printCurrentBasket() {
    if (!basket.length && !lastReceipt) { toast("No hay ticket para imprimir"); return; }
    if (basket.length) {
      var amounts = basketSaleAmounts(basket);
      var total = amounts.total;
      var previewMethod = $("ticketPaymentSelect") && $("ticketPaymentSelect").value || PAYMENT;
      var paid = isCashPayment(previewMethod) ? parseMoney($("ticketPaid") && $("ticketPaid").value) : total;
      var previewCash = isSplitPayment(previewMethod) ? parseMoney($("ticketSplitCash") && $("ticketSplitCash").value) : 0;
      printReceipt(buildReceipt({
        id: "PREVIEW", amount: total, grossSubtotal: amounts.grossSubtotal, discountType: amounts.discountType, discountValue: amounts.discountValue, discountAmount: amounts.discountAmount, unroundedAmount: amounts.unroundedAmount, roundingAdjustment: amounts.roundingAdjustment, paymentMethod: previewMethod,
        createdAt: nowIso(), businessDate: currentSession && currentSession.businessDate || today(),
        shiftType: currentSession && currentSession.shiftType || ""
      }, basket.slice(), { paidAmount: paid || 0, changeAmount: isCashPayment(previewMethod) && paid ? Math.max(0, paid - total) : 0, cashAmount: previewCash, qrAmount: isSplitPayment(previewMethod) ? Math.max(0, total - previewCash) : 0, grossSubtotal: amounts.grossSubtotal, discountType: amounts.discountType, discountValue: amounts.discountValue, discountAmount: amounts.discountAmount, unroundedAmount: amounts.unroundedAmount, roundingAdjustment: amounts.roundingAdjustment }));
    } else {
      printReceipt(lastReceipt);
    }
  }
  function chargeBasket() {
    var amounts = basketSaleAmounts(basket);
    var total = amounts.total;
    if (total <= 0) { toast("Ticket vacio"); return; }
    var ticketMethod = $("ticketPaymentSelect") ? $("ticketPaymentSelect").value : PAYMENT;
    var cash = isCashPayment(ticketMethod);
    var split = isSplitPayment(ticketMethod);
    var paid = cash ? parseMoney($("ticketPaid") && $("ticketPaid").value) : total;
    if (cash && paid < total) {
      toast("Ingrese un monto recibido igual o mayor al total");
      if ($("ticketPaid")) $("ticketPaid").focus();
      return;
    }
    var splitCash = split ? parseMoney($("ticketSplitCash") && $("ticketSplitCash").value) : 0;
    if (split && (splitCash <= 0 || splitCash >= total)) {
      toast("Ingrese la parte en efectivo; debe ser mayor a cero y menor al total");
      if ($("ticketSplitCash")) $("ticketSplitCash").focus();
      return;
    }
    var splitQr = split ? moneyPrecision(total - splitCash) : 0;
    var hasReviewItems = basket.some(function (it) { return it.reviewFlag; });
    var manualItemCount = basket.filter(function (it) { return it.manualItem || it.source === "manual-item"; }).length;
    var shouldPrint = $("ticketPrintToggle") && $("ticketPrintToggle").checked;
    var printWindow = shouldPrint ? openReceiptPrintWindow() : null;
    if (shouldPrint && !printWindow) toast("El navegador bloqueo la ventana de impresion");
    if (!cash && hasMercadoPagoConfig(ticketMethod)) {
      checkoutMercadoPago(ticketMethod, shouldPrint, printWindow);
      return;
    }
    saveSale(amounts.unroundedAmount, "PRODUCT_BASKET", basket.slice(), {
      paymentMethodOverride: ticketMethod,
      paidAmount: paid || 0,
      changeAmount: cash && paid ? Math.max(0, paid - total) : 0,
      cashAmount: splitCash,
      qrAmount: splitQr,
      paymentBreakdown: split ? { cash: splitCash, qr: splitQr } : undefined,
      paymentStatus: cash ? "PAID" : "MANUAL",
      itemCount: basket.length,
      printReceipt: shouldPrint,
      printWindow: printWindow,
      grossSubtotal: amounts.grossSubtotal,
      discountType: amounts.discountType,
      discountValue: amounts.discountValue,
      discountAmount: amounts.discountAmount,
      unroundedAmount: amounts.unroundedAmount,
      roundingAdjustment: amounts.roundingAdjustment,
      reviewFlag: hasReviewItems,
      manualItemCount: manualItemCount,
      reviewReason: manualItemCount ? "Ticket con item manual sin registrar" : (hasReviewItems ? "Ticket con producto escaneado no registrado" : "")
    });
  }
  function setSaleMode(mode) {
    saleMode = mode;
    if ($("quickModeBtn")) $("quickModeBtn").classList.toggle("active", mode === "quick");
    if ($("basketModeBtn")) $("basketModeBtn").classList.toggle("active", mode === "basket");
    if ($("saleForm")) $("saleForm").classList.toggle("hidden", false);
    if ($("basketPanel")) $("basketPanel").classList.toggle("hidden", true);
  }

  function renderCalc() {
    var total = calcItems.reduce(function (a, b) { return a + b; }, 0);
    $("calcTotal").textContent = money(total);
    $("calcChange").textContent = money(parseMoney($("calcPaid").value) - total);
    $("calcList").innerHTML = calcItems.length ? calcItems.map(function (v, i) {
      return "<div class='compact-row'><span>" + money(v) + "</span><button class='small danger' data-calc-remove='" + i + "'>x</button></div>";
    }).join("") : empty("Sin importes sumados");
    document.querySelectorAll("[data-calc-remove]").forEach(function (b) {
      b.onclick = function () { calcItems.splice(Number(b.dataset.calcRemove), 1); renderCalc(); };
    });
  }
  function addCalc(v) {
    v = Number(v || 0);
    if (v > 0) calcItems.push(v);
    $("calcAmount").value = "";
    renderCalc();
  }
  function unitSize(unit) {
    unit = String(unit || "unidad").toLowerCase();
    if (unit === "kg") return { group: "weight", size: 1000 };
    if (unit === "gr") return { group: "weight", size: 1 };
    if (unit === "docena") return { group: "count", size: 12 };
    if (unit === "unidad" || unit === "cantidad") return { group: "count", size: 1 };
    if (unit === "litro") return { group: "volume", size: 1000 };
    return { group: unit, size: 1 };
  }
  function priceForSaleUnit(price, priceUnit, saleUnit) {
    var from = unitSize(priceUnit);
    var to = unitSize(saleUnit);
    if (from.group !== to.group) return Number(price || 0);
    return Number(price || 0) * to.size / from.size;
  }
  function setBarcodeStatus(message, kind) {
    if (!$("barcodeStatus")) return;
    $("barcodeStatus").textContent = message || "Escanee un producto para agregarlo automaticamente.";
    $("barcodeStatus").className = kind || "";
  }
  function setStockBarcodeStatus(message, kind) {
    if (!$("stockBarcodeStatus")) return;
    $("stockBarcodeStatus").textContent = message || "Escanee para cargar o editar productos.";
    $("stockBarcodeStatus").className = kind || "";
  }
  function focusBarcodeInput(delay) {
    if (!$("barcodeInput") || currentTab !== "Caja") return;
    setTimeout(function () {
      if (!$("barcodeInput")) return;
      if (document.querySelector(".modal:not(.hidden)")) return;
      $("barcodeInput").focus();
      $("barcodeInput").select();
    }, delay || 0);
  }
  function focusStockBarcodeInput(delay) {
    if (!$("stockBarcodeInput") || currentTab !== "Produccion") return;
    setTimeout(function () {
      if (!$("stockBarcodeInput")) return;
      if (document.querySelector(".modal:not(.hidden)")) return;
      $("stockBarcodeInput").focus();
      $("stockBarcodeInput").select();
    }, delay || 0);
  }
  function productUnitPrice(product) {
    return priceForSaleUnit(product.price, product.priceUnit || product.unitType, product.unitType || product.priceUnit || "unidad");
  }
  function closureTicketHtml(closure) {
    var settings = ticketSettings();
    var businessName = settings.businessName || "FORRAJERIA LA VIEJA ESQUINA";
    var created = new Date(closure.createdAt || nowIso());
    var isPartial = closure.closureKind === "PARTIAL";
    var ticketTitle = isPartial ? "CONTROL DE CAMBIO AM -> PM" : "CIERRE DIARIO";
    var handoff = closure.handoffControl && closure.handoffControl.performed !== false ? closure.handoffControl : null;
    var totalDifference = Number(closure.differenceCash || 0) + Number(closure.differenceTransfer || 0);
    var closureStatus = Math.abs(Number(closure.differenceCash || 0)) < 0.01 && Math.abs(Number(closure.differenceTransfer || 0)) < 0.01
      ? "SIN DIFERENCIAS"
      : "REVISAR DIFERENCIAS";
    function ticketRow(label, value, strong) {
      return "<div class='row" + (strong ? " total" : "") + "'><span>" + escapeHtml(label) + "</span><b>" + escapeHtml(String(value)) + "</b></div>";
    }
    function ticketSection(label) {
      return "<div class='line'></div><p class='section'><b>" + escapeHtml(label) + "</b></p>";
    }
    var identity = "<div class='center'><div class='brand'>" + escapeHtml(businessName) + "</div><p class='title'><b>" + escapeHtml(ticketTitle) + "</b></p><p class='date'>" + escapeHtml(closure.businessDate || "") + "</p></div>"
      + "<div class='line'></div><div class='meta'><p>Realizado: " + escapeHtml(created.toLocaleString("es-AR")) + "</p><p>Responsable: " + escapeHtml(closure.createdByName || closure.createdBy || "-") + "</p><p>Comprobante: " + escapeHtml(String(closure.id || "").slice(-8).toUpperCase()) + "</p></div>";
    var body;
    if (isPartial) {
      body = ticketSection("RESUMEN TURNO AM")
        + ticketRow("Venta AM", money(closure.totalSales), true)
        + ticketRow("Tickets", Number(closure.ticketCount || 0), false)
        + ticketRow("Items", Math.round(Number(closure.itemsSold || 0)), false)
        + ticketSection("EFECTIVO RECIBIDO")
        + ticketRow("Esperado", money(closure.expectedCash), false)
        + ticketRow("Recibido", money(closure.countedCash), false)
        + ticketRow("Diferencia", money(closure.differenceCash), true)
        + ticketSection("QR / MERCADO PAGO")
        + ticketRow("Esperado", money(closure.expectedTransfer), false)
        + ticketRow("Controlado", money(closure.countedTransfer), false)
        + ticketRow("Diferencia", money(closure.differenceTransfer), true)
        + (closure.notes ? ticketSection("OBSERVACION") + "<p>" + escapeHtml(closure.notes) + "</p>" : "");
    } else {
      body = ticketSection("VENTAS DEL DIA")
        + ticketRow("Venta total", money(closure.totalSales), true)
        + ticketRow("Tickets / clientes", Number(closure.ticketCount || 0), false)
        + ticketRow("Items vendidos", Math.round(Number(closure.itemsSold || 0)), false)
        + ticketRow("Ticket promedio", money(closure.averageTicket || 0), false)
        + ticketRow("Ticket mayor", money(closure.largestTicket || 0), false)
        + ticketSection("CONTROL DE EFECTIVO")
        + ticketRow("Ventas efectivo", money(closure.cashSales != null ? closure.cashSales : Math.max(0, Number(closure.totalSales || 0) - Number(closure.expectedTransfer || 0))), false)
        + ticketRow("Caja inicial", money(closure.openingCash || 0), false)
        + ticketRow("Retiros", money(closure.totalWithdrawals || 0), false)
        + ticketRow("Esperado", money(closure.expectedCash), false)
        + ticketRow("Contado", money(closure.countedCash), false)
        + ticketRow("Diferencia", money(closure.differenceCash), true)
        + ticketSection("CONTROL QR / MERCADO PAGO")
        + ticketRow("Ventas confirmadas", money(closure.qrSales != null ? closure.qrSales : closure.expectedTransfer), false)
        + ticketRow("Esperado", money(closure.expectedTransfer), false)
        + ticketRow("Contado", money(closure.countedTransfer), false)
        + ticketRow("Diferencia", money(closure.differenceTransfer), true)
        + ticketSection("CONTROL CAMBIO AM -> PM")
        + (handoff
          ? "<p class='status ok'><b>REALIZADO</b> - " + escapeHtml(localTimeLabel(handoff.createdAt)) + "</p>"
            + ticketRow("Responsable", handoff.createdByName || handoff.createdBy || "-", false)
            + ticketRow("Venta AM", money(handoff.totalSales || 0), false)
            + ticketRow("Dif. efectivo", money(handoff.differenceCash || 0), false)
            + ticketRow("Dif. QR", money(handoff.differenceTransfer || 0), false)
            + (handoff.notes ? "<p class='muted'>Nota AM/PM: " + escapeHtml(handoff.notes) + "</p>" : "")
          : "<p class='status missing'><b>NO REALIZADO</b></p>")
        + (closure.notes ? ticketSection("OBSERVACION FINAL") + "<p>" + escapeHtml(closure.notes) + "</p>" : "")
        + ticketSection("RESULTADO")
        + "<p class='status " + (closureStatus === "SIN DIFERENCIAS" ? "ok" : "missing") + "'><b>" + closureStatus + "</b></p>"
        + ticketRow("Diferencia neta", money(totalDifference), true);
    }
    return "<!doctype html><html><head><meta charset='utf-8'><title>" + escapeHtml(ticketTitle) + "</title><style>"
      + "@page{size:58mm auto;margin:0}*{box-sizing:border-box}body{margin:0;padding:6px 7px 10px;width:58mm;font-family:Consolas,'Courier New',monospace;color:#000;background:#fff;font-size:9.5px;line-height:1.22}.center{text-align:center}.brand{font-weight:900;font-size:13px;text-transform:uppercase}.title{margin:3px 0 1px;font-size:11px}.date{margin:0;font-size:12px;font-weight:900}.line{border-top:1px dashed #000;margin:5px 0}.section{margin:0 0 3px;font-size:9px;letter-spacing:.04em}.meta p{font-size:8.5px}.row{display:flex;justify-content:space-between;align-items:baseline;gap:6px;margin:1.5px 0}.row span{max-width:61%}.row b{text-align:right}.total{font-size:11px;border-top:1px solid #000;padding-top:2px;margin-top:3px}.muted{font-size:8px}.status{padding:3px 4px;border:1px solid #000;text-align:center;letter-spacing:.035em}.status.ok{border-style:double}.status.missing{font-weight:900}p{margin:2px 0}.signature{margin-top:14px;padding-top:3px;border-top:1px solid #000;text-align:center;font-size:8px}</style></head><body>"
      + identity + body
      + "<div class='line'></div><p class='signature'>Firma / control responsable</p><p class='center muted'>Documento interno - conservar con caja</p></body></html>";
  }
  function printClosureTicket(closure, targetWindow) {
    var win = targetWindow && !targetWindow.closed ? targetWindow : openReceiptPrintWindow();
    if (!win || win.closed) { toast("No se pudo abrir impresion"); return false; }
    try {
      win.document.open();
      win.document.write(closureTicketHtml(closure));
      win.document.close();
      setTimeout(function () {
        try { win.focus(); win.print(); } catch (e) { toast("No se pudo abrir impresion"); }
      }, 120);
      return true;
    } catch (e2) {
      toast("No se pudo abrir impresion");
      return false;
    }
  }
  function isVariableQuantityProduct(product) {
    var unit = String(product && (product.unitType || product.priceUnit) || "").toLowerCase();
    return unit === "kg" || unit === "gr" || unit === "m" || unit === "litro";
  }
  function pushBasketItem(item) {
    if (isManualBasketItem(item) || item.reviewFlag) {
      basket.push(item);
      return;
    }
    var match = basket.filter(function (it) {
      return !it.reviewFlag && it.productId === item.productId && it.unitPrice === item.unitPrice && it.unitType === item.unitType;
    })[0];
    if (match) {
      match.quantity = Math.round((Number(match.quantity || 0) + Number(item.quantity || 0)) * 1000) / 1000;
      match.subtotal = moneyPrecision(Number(match.subtotal || 0) + Number(item.subtotal || 0));
      if (item.quantityEntryMode === "money") {
        match.quantityEntryMode = "mixed";
        match.requestedAmount = moneyPrecision(Number(match.requestedAmount || 0) + Number(item.requestedAmount || item.subtotal || 0));
      }
      if (item.barcode) match.barcode = item.barcode;
      if (item.source) match.source = item.source;
    } else {
      basket.push(item);
    }
  }
  function productToBasketItem(product, quantity, source) {
    var q = Number(quantity || 1);
    var unitPrice = productUnitPrice(product);
    return {
      productId: product.id,
      productName: product.name,
      quantity: q,
      unitType: product.unitType || product.priceUnit || "unidad",
      unitPrice: unitPrice,
      subtotal: Math.round(q * unitPrice * 100) / 100,
      priceUnit: product.priceUnit || product.unitType || "unidad",
      baseUnitPrice: product.price,
      barcode: normalizeBarcode(product.barcode),
      source: source || ""
    };
  }
  function addProductDirectToTicket(product, quantity, source) {
    if (!product) return;
    if (Number(product.price || 0) <= 0) {
      toast("Este producto no tiene precio de venta");
      return;
    }
    pushBasketItem(productToBasketItem(product, quantity || 1, source));
    playTicketSound();
    renderBasket();
    renderProducts();
    setBarcodeStatus("Agregado: " + product.name, "ok");
    toast("Agregado al ticket: " + product.name);
    focusBarcodeInput(80);
  }
  function selectProductForTicket(product, source) {
    if (!product) return;
    clearProductSearch();
    if (Number(product.price || 0) <= 0) {
      toast("Este producto no tiene precio. Un admin o dev debe completarlo en Stock.");
      return;
    }
    if (isVariableQuantityProduct(product)) {
      openProductModal(product);
      return;
    }
    addProductDirectToTicket(product, 1, source || "text-search");
  }
  function activeStoreProducts() {
    if (productSearchCache) return Promise.resolve(productSearchCache.slice());
    return all("products").then(function (products) {
      productSearchCache = products.filter(function (p) { return p.active !== false; });
      return productSearchCache.slice();
    });
  }
  function productSalesPopularity() {
    if (productPopularityCache) return Promise.resolve(productPopularityCache);
    return Promise.all([all("transactions"), all("basketItems")]).then(function (data) {
      var saleBaskets = {};
      data[0].forEach(function (sale) {
        if (sale.type === "SALE" && !sale.deleted && sale.basketId) saleBaskets[sale.basketId] = true;
      });
      var stats = {};
      data[1].forEach(function (item) {
        if (!saleBaskets[item.basketId] || !item.productId || isManualBasketItem(item)) return;
        if (!stats[item.productId]) stats[item.productId] = { lines: 0, quantity: 0 };
        stats[item.productId].lines += 1;
        stats[item.productId].quantity += Math.max(0, Number(item.quantity || 0));
      });
      productPopularityCache = stats;
      return stats;
    });
  }
  function findProductByBarcode(code) {
    var normalized = normalizeBarcode(code);
    if (!normalized) return Promise.resolve(null);
    return all("products").then(function (products) {
      return products.filter(function (p) {
        return p.active !== false && normalizeBarcode(p.barcode) === normalized;
      })[0] || null;
    });
  }
  function findMasterProductByBarcode(code) {
    var normalized = normalizeBarcode(code);
    if (!normalized) return Promise.resolve(null);
    return all("masterProducts").then(function (products) {
      return products.filter(function (p) { return normalizeBarcode(p.barcode) === normalized; })[0] || null;
    });
  }
  function normalizeProductSearch(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function productSearchText(product) {
    return normalizeProductSearch([
      product.name, product.brand, product.product, product.variant, product.category,
      product.inventoryId, product.location, product.barcode
    ].join(" "));
  }
  function productSearchRelevance(product, query, terms) {
    var name = normalizeProductSearch(product && product.name);
    if (name === query) return 5;
    if (name.indexOf(query) === 0) return 4;
    var words = name.split(/\s+/).filter(Boolean);
    if (terms.every(function (term) { return words.some(function (word) { return word.indexOf(term) === 0; }); })) return 3;
    if (terms.every(function (term) { return name.indexOf(term) >= 0; })) return 2;
    return 1;
  }
  function clearProductSearch() {
    productSearchSequence++;
    if ($("productTextSearch")) $("productTextSearch").value = "";
    if ($("productSearchResults")) {
      $("productSearchResults").innerHTML = "";
      $("productSearchResults").classList.add("hidden");
    }
  }
  function renderProductSearch() {
    var input = $("productTextSearch");
    var results = $("productSearchResults");
    if (!input || !results) return;
    var query = normalizeProductSearch(input.value);
    if (!query) {
      results.innerHTML = "";
      results.classList.add("hidden");
      return;
    }
    var terms = query.split(/\s+/).filter(Boolean);
    var sequence = ++productSearchSequence;
    Promise.all([activeStoreProducts(), productSalesPopularity()]).then(function (data) {
      var products = data[0];
      var popularity = data[1];
      if (sequence !== productSearchSequence || normalizeProductSearch(input.value) !== query) return;
      var matches = products.filter(function (p) {
        var haystack = productSearchText(p);
        return terms.every(function (term) { return haystack.indexOf(term) >= 0; });
      }).sort(function (a, b) {
        var relevance = productSearchRelevance(b, query, terms) - productSearchRelevance(a, query, terms);
        var aSales = popularity[a.id] || { lines: 0, quantity: 0 };
        var bSales = popularity[b.id] || { lines: 0, quantity: 0 };
        return relevance || bSales.lines - aSales.lines || bSales.quantity - aSales.quantity || String(a.name).localeCompare(String(b.name));
      }).slice(0, 12);
      results.classList.remove("hidden");
      results.innerHTML = matches.length ? matches.map(function (p) {
        var noPrice = Number(p.price || 0) <= 0;
        var sold = popularity[p.id] && popularity[p.id].lines || 0;
        var flags = (sold ? " &middot; " + sold + " venta" + (sold === 1 ? "" : "s") : "") + (p.location ? " &middot; " + escapeHtml(p.location) : "") + (p.barcode ? " &middot; " + escapeHtml(p.barcode) : " &middot; sin codigo");
        return "<button type='button' class='product-search-result " + (noPrice ? "missing-price" : "") + "' data-search-product='" + escapeHtml(p.id) + "'><span><b>" + escapeHtml(p.name) + "</b><small>" + escapeHtml(productCategory(p)) + flags + "</small></span><strong>" + (noPrice ? "SIN PRECIO" : money(p.price)) + "</strong></button>";
      }).join("") : "<p class='product-search-empty'>No se encontraron productos.</p>";
      document.querySelectorAll("[data-search-product]").forEach(function (button) {
        button.onclick = function () {
          var product = matches.filter(function (p) { return p.id === button.dataset.searchProduct; })[0];
          if (!product) return;
          selectProductForTicket(product, "text-search");
        };
      });
    });
  }
  function handleBarcodeScan(rawCode) {
    var code = normalizeBarcode(rawCode);
    if (!code) return;
    if ($("barcodeInput")) $("barcodeInput").value = "";
    if ($("stockBarcodeInput")) $("stockBarcodeInput").value = "";
    if (currentTab === "Produccion") setStockBarcodeStatus("Buscando " + code + "...", "busy");
    else if (currentTab !== "Proveedores") setBarcodeStatus("Buscando " + code + "...", "busy");
    findProductByBarcode(code).then(function (product) {
      if (currentTab === "Proveedores") {
        purchaseAddScannedProduct(product, code);
      } else if (currentTab === "Produccion") {
        if (product) {
          rememberStockSearch(product.id, code);
          setStockBarcodeStatus("Producto encontrado: " + product.name, "ok");
          openProductForm(product);
        } else {
          return findMasterProductByBarcode(code).then(function (master) {
            if (master) {
              setStockBarcodeStatus("Encontrado en stock total: " + master.name, "ok");
              openProductForm(storeProductFromMaster(master));
            } else {
              setStockBarcodeStatus("Codigo nuevo: " + code, "warn");
              openProductForm(null, code);
            }
          });
        }
      } else if (product) {
        selectProductForTicket(product, "barcode");
      } else {
        setBarcodeStatus("Codigo no encontrado. Use + Item manual.", "warn");
        toast("Producto no encontrado. Agreguelo con Item manual.");
        focusBarcodeInput(120);
      }
    }).catch(function () {
      if (currentTab === "Produccion") setStockBarcodeStatus("No se pudo leer el codigo", "warn");
      else if (currentTab !== "Proveedores") setBarcodeStatus("No se pudo leer el codigo", "warn");
      toast("Error leyendo codigo");
    });
  }
  function processBarcodeOnce(rawCode) {
    var code = normalizeBarcode(rawCode);
    if (!code || code.length < 4) return;
    var now = Date.now();
    if (code === lastProcessedScanCode && now - lastProcessedScanAt < 900) return;
    lastProcessedScanCode = code;
    lastProcessedScanAt = now;
    handleBarcodeScan(code);
  }
  function scheduleBarcodeAutoRead(inputId) {
    var input = $(inputId);
    if (!input) return;
    var code = normalizeBarcode(input.value);
    var isStock = inputId === "stockBarcodeInput";
    clearTimeout(isStock ? stockBarcodeAutoTimer : barcodeAutoTimer);
    if (code.length < 4) return;
    var timer = setTimeout(function () {
      var fresh = normalizeBarcode(input.value);
      if (fresh && fresh === code) processBarcodeOnce(fresh);
    }, 180);
    if (isStock) stockBarcodeAutoTimer = timer;
    else barcodeAutoTimer = timer;
  }
  function handleBarcodeInputKey(e) {
    if (e.key !== "Enter" && e.key !== "Tab") return;
    var code = $("barcodeInput").value;
    e.preventDefault();
    processBarcodeOnce(code);
  }
  function handleStockBarcodeInputKey(e) {
    if (e.key !== "Enter" && e.key !== "Tab") return;
    var code = $("stockBarcodeInput").value;
    e.preventDefault();
    processBarcodeOnce(code);
  }
  function handleGlobalScannerKey(e) {
    if (!currentUser || (currentTab !== "Caja" && currentTab !== "Produccion" && currentTab !== "Proveedores")) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var active = document.activeElement;
    var tag = active && active.tagName ? active.tagName.toLowerCase() : "";
    if (active && active.id === "barcodeInput") return;
    if (active && active.id === "stockBarcodeInput") return;
    var isTypingTarget = tag === "input" || tag === "textarea";
    var hasValue = isTypingTarget && active && typeof active.value === "string";
    var now = Date.now();
    var rapid = now - scannerLastKeyAt <= 75;
    if (now - scannerLastKeyAt > 120) {
      scannerBuffer = "";
      scannerBurstMode = false;
      scannerStartAt = now;
      scannerTypingTarget = hasValue ? active : null;
      scannerTypingStartValue = hasValue ? active.value : "";
    }
    scannerLastKeyAt = now;
    if (e.key === "Enter" || e.key === "Tab") {
      var scannerElapsed = now - (scannerStartAt || now);
      var looksLikeScan = scannerBurstMode || (scannerBuffer.length >= 6 && scannerElapsed <= 700);
      if (scannerBuffer.length >= 4 && looksLikeScan) {
        e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        restoreScannerTypingTarget();
        processBarcodeOnce(scannerBuffer);
      }
      scannerBuffer = "";
      scannerBurstMode = false;
      return;
    }
    if (e.key && e.key.length === 1) {
      if (!scannerBuffer && hasValue) {
        scannerStartAt = now;
        scannerTypingTarget = active;
        scannerTypingStartValue = active.value;
      }
      if (!scannerBuffer) scannerStartAt = now;
      scannerBuffer += e.key;
      if (scannerBuffer.length > 64) scannerBuffer = scannerBuffer.slice(-64);
      if (rapid && scannerBuffer.length >= 2) scannerBurstMode = true;
      if (scannerBurstMode) {
        e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
      }
      clearTimeout(scannerGlobalTimer);
      scannerGlobalTimer = setTimeout(function () {
        if (scannerBuffer.length >= 4 && scannerBurstMode) {
          var code = scannerBuffer;
          restoreScannerTypingTarget();
          scannerBuffer = "";
          scannerBurstMode = false;
          processBarcodeOnce(code);
        }
      }, 140);
    }
  }
  function restoreScannerTypingTarget() {
    if (scannerTypingTarget && typeof scannerTypingTarget.value === "string") {
      scannerTypingTarget.value = scannerTypingStartValue || "";
      try {
        scannerTypingTarget.dispatchEvent(new Event("input", { bubbles: true }));
      } catch (e) {}
    }
    scannerTypingTarget = null;
    scannerTypingStartValue = "";
  }

  function productIcon(name) {
    var n = String(name || "").toLowerCase();
    if (n.indexOf("pan") >= 0) return "PAN";
    if (n.indexOf("fact") >= 0) return "DOC";
    if (n.indexOf("biz") >= 0) return "KG";
    if (n.indexOf("emp") >= 0) return "EMP";
    if (n.indexOf("miga") >= 0 || n.indexOf("sand") >= 0) return "SM";
    if (n.indexOf("masa") >= 0) return "MS";
    if (n.indexOf("pizza") >= 0) return "PZ";
    if (n.indexOf("drink") >= 0 || n.indexOf("soda") >= 0) return "DR";
    return "PR";
  }
  function productImage(product) {
    if (product && product.imageData) {
      return "<span class='product-img has-photo'><img src='" + escapeHtml(product.imageData) + "' alt=''></span>";
    }
    return "<span class='product-img'>" + productIcon(product && product.name) + "</span>";
  }
  function productCategory(product) {
    return String(product && product.category || "General").trim() || "General";
  }
  function productCategories(products) {
    var seen = {};
    products.forEach(function (p) { seen[productCategory(p)] = true; });
    return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b); });
  }
  function setProductCategory(category) {
    activeProductCategory = category || "Todos";
    localStorage.setItem("bakeryActiveProductCategory", activeProductCategory);
    renderProducts();
  }
  function renderProductCategories(products) {
    if (!$("productCategoryBar")) return;
    var categories = productCategories(products);
    if (activeProductCategory !== "Todos" && categories.indexOf(activeProductCategory) < 0) activeProductCategory = "Todos";
    var items = ["Todos"].concat(categories);
    $("productCategoryBar").innerHTML = items.map(function (cat) {
      var count = cat === "Todos" ? products.length : products.filter(function (p) { return productCategory(p) === cat; }).length;
      return "<button type='button' class='" + (activeProductCategory === cat ? "active" : "") + "' data-product-category='" + escapeHtml(cat) + "'><b>" + escapeHtml(cat) + "</b><small>" + count + "</small></button>";
    }).join("");
    document.querySelectorAll("[data-product-category]").forEach(function (btn) {
      btn.onclick = function () { setProductCategory(btn.dataset.productCategory || "Todos"); };
    });
  }
  function renderProducts() {
    if ($("productGrid")) $("productGrid").innerHTML = "";
    if ($("productCategoryBar")) $("productCategoryBar").innerHTML = "";
    return;
    all("products").then(function (products) {
      products = products.filter(function (p) { return p.active; }).sort(function (a, b) {
        return Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name).localeCompare(String(b.name));
      });
      renderProductCategories(products);
      var visibleProducts = activeProductCategory === "Todos" ? products : products.filter(function (p) {
        return productCategory(p) === activeProductCategory;
      });
      $("productGrid").innerHTML = visibleProducts.map(function (p) {
        return "<button class='product-card' type='button' draggable='true' data-product='" + p.id + "'>" + productImage(p) + "<b>" + escapeHtml(p.name) + "</b><small>" + money(p.price) + " / " + escapeHtml(p.priceUnit || p.unitType) + "</small></button>";
      }).join("") + (isAdmin() ? "<button class='product-card product-edit-card' id='openProductEditorBtn' type='button'><span class='product-img'>EDIT</span><b>Editar</b><small>Categorias y productos</small></button>" : "");
      document.querySelectorAll("[data-product]").forEach(function (btn) {
        btn.onclick = function () {
          if (btn.dataset.dragging === "1") { btn.dataset.dragging = "0"; return; }
          var p = visibleProducts.filter(function (x) { return x.id === btn.dataset.product; })[0];
          openProductModal(p);
        };
        btn.oncontextmenu = function (e) {
          if (!isAdmin()) return;
          e.preventDefault();
          var p = visibleProducts.filter(function (x) { return x.id === btn.dataset.product; })[0];
          if (p) openProductContextMenu(e, p);
        };
      });
      bindProductDrag(visibleProducts);
      if ($("openProductEditorBtn")) $("openProductEditorBtn").onclick = openProductEditor;
    });
  }
  function openProductContextMenu(e, product) {
    closeProductContextMenu();
    var menu = document.createElement("div");
    menu.id = "productContextMenu";
    menu.className = "product-context-menu";
    menu.innerHTML = "<button type='button' data-action='edit'>Editar</button><button type='button' class='danger' data-action='delete'>Borrar</button>";
    document.body.appendChild(menu);
    var x = Math.min(e.clientX || 0, window.innerWidth - 150);
    var y = Math.min(e.clientY || 0, window.innerHeight - 92);
    menu.style.left = Math.max(6, x) + "px";
    menu.style.top = Math.max(6, y) + "px";
    menu.querySelector("[data-action='edit']").onclick = function () {
      closeProductContextMenu();
      openProductForm(product);
    };
    menu.querySelector("[data-action='delete']").onclick = function () {
      closeProductContextMenu();
      deleteProduct(product);
    };
  }
  function closeProductContextMenu() {
    var menu = $("productContextMenu");
    if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
  }
  function bindProductDrag(products) {
    var draggedId = "";
    document.querySelectorAll("[data-product]").forEach(function (btn) {
      btn.ondragstart = function (e) {
        draggedId = btn.dataset.product;
        btn.classList.add("dragging");
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      };
      btn.ondragend = function () {
        btn.classList.remove("dragging");
        btn.dataset.dragging = "1";
        setTimeout(function () { btn.dataset.dragging = "0"; }, 80);
      };
      btn.ondragover = function (e) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        btn.classList.add("drop-target");
      };
      btn.ondragleave = function () { btn.classList.remove("drop-target"); };
      btn.ondrop = function (e) {
        e.preventDefault();
        btn.classList.remove("drop-target");
        if (!draggedId || draggedId === btn.dataset.product) return;
        reorderProducts(products, draggedId, btn.dataset.product);
      };
    });
  }
  function reorderProducts(products, draggedId, targetId) {
    var list = products.slice();
    var from = list.findIndex(function (p) { return p.id === draggedId; });
    var to = list.findIndex(function (p) { return p.id === targetId; });
    if (from < 0 || to < 0) return;
    var moved = list.splice(from, 1)[0];
    list.splice(to, 0, moved);
    Promise.all(list.map(function (p, i) {
      p.sortOrder = i;
      return add("products", p);
    })).then(function () {
      renderProducts();
      toast("Orden actualizado");
    });
  }
  function openProductModal(product) {
    selectedProduct = product;
    productEntryMode = "quantity";
    $("productModalTitle").textContent = product.name;
    $("productModalIcon").innerHTML = product.imageData ? "<img src='" + escapeHtml(product.imageData) + "' alt=''>" : productIcon(product.name);
    $("productPriceInput").value = String(product.price || "");
    $("productQuantityInput").value = "";
    $("productQuantityInput").placeholder = String(product.unitType || "").toLowerCase() === "kg" ? "Ej: 0,5 o 500 g" : "Ingrese cantidad";
    if ($("productEntryMode")) $("productEntryMode").classList.toggle("hidden", !isVariableQuantityProduct(product));
    renderProductQuantityOptions();
    $("productQuantityLabel").firstChild.nodeValue = "Cantidad en " + (product.unitType || "unidad") + " ";
    if ($("productQuantityHelp")) {
      $("productQuantityHelp").textContent = productQuantityHelpText(product);
    }
    $("productModal").classList.remove("hidden");
    updateProductModalTotal();
    setTimeout(function () {
      $("productQuantityInput").focus();
      $("productQuantityInput").select();
    }, 0);
  }
  function closeProductModal() {
    $("productModal").classList.add("hidden");
    selectedProduct = null;
    productEntryMode = "quantity";
  }
  function productQuickQuantities(product) {
    var unit = String(product && product.unitType || "").toLowerCase();
    if (unit === "litro") return [{ value: .5, label: "0,5 L" }, { value: 1, label: "1 L" }, { value: 1.5, label: "1,5 L" }, { value: 2, label: "2 L" }];
    if (unit === "kg") return [{ value: .25, label: "250 g" }, { value: .5, label: "500 g" }, { value: .75, label: "750 g" }, { value: 1, label: "1 kg" }];
    return [];
  }
  function renderProductQuantityOptions() {
    if (!selectedProduct) return;
    document.querySelectorAll("[data-product-entry-mode]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.productEntryMode === productEntryMode);
    });
    var moneyMode = productEntryMode === "money";
    var quickRows = moneyMode ? [] : productQuickQuantities(selectedProduct);
    if ($("productWeightQuick")) {
      $("productWeightQuick").innerHTML = quickRows.map(function (row) { return "<button type='button' data-product-weight='" + row.value + "'>" + row.label + "</button>"; }).join("");
      $("productWeightQuick").classList.toggle("hidden", !quickRows.length);
    }
    if ($("productQuantityLabel")) $("productQuantityLabel").firstChild.nodeValue = moneyMode ? "Importe solicitado " : "Cantidad en " + (selectedProduct.unitType || "unidad") + " ";
    if ($("productQuantityInput")) $("productQuantityInput").placeholder = moneyMode ? "Ej: $ 1.000" : (String(selectedProduct.unitType || "").toLowerCase() === "kg" ? "Ej: 0,5 o 500 g" : "Ingrese cantidad");
    updateProductModalTotal();
  }
  function saleQuantityFromInput(product, rawValue) {
    var raw = String(rawValue == null ? "" : rawValue).trim();
    var quantity = parseMoney(raw);
    var unit = String(product && product.unitType || "").toLowerCase();
    var interpretedAsGrams = unit === "kg" && quantity >= 100 && !/[,.]/.test(raw);
    if (interpretedAsGrams) quantity = moneyPrecision(quantity / 1000);
    return { quantity: quantity, interpretedAsGrams: interpretedAsGrams, raw: raw };
  }
  function confirmUnusuallyLargeWeight(product, parsedQuantity) {
    var unit = String(product && product.unitType || "").toLowerCase();
    var quantity = Number(parsedQuantity && parsedQuantity.quantity || 0);
    if (unit !== "kg" || quantity < 20) return true;
    return confirm("Se ingresaron " + formatQuantity(quantity) + " kg. Confirme solo si ese peso es correcto.\n\nSi queria cargar gramos, cancele y escriba por ejemplo 500 para 0,5 kg.");
  }
  function productQuantityHelpText(product) {
    var unit = String(product && product.unitType || "").toLowerCase();
    if (unit === "kg") return "Precio " + money(product.price) + " por " + (product.priceUnit || product.unitType) + ". Use 0,5 kg o escriba 500 para 500 g.";
    if (unit === "litro") return "Precio " + money(product.price) + " por litro. Elija 0,5; 1; 1,5 o 2 litros.";
    return isVariableQuantityProduct(product) ? "Precio " + money(product.price) + " por " + (product.priceUnit || product.unitType) + "." : "Indique la cantidad que desea agregar al carrito.";
  }
  function updateProductModalTotal() {
    if (!selectedProduct) return;
    var price = parseMoney($("productPriceInput").value);
    var unitPrice = priceForSaleUnit(price, selectedProduct.priceUnit || selectedProduct.unitType, selectedProduct.unitType);
    var parsedQuantity = saleQuantityFromInput(selectedProduct, $("productQuantityInput").value);
    var requestedMoney = Math.max(0, parseMoney($("productQuantityInput").value));
    var quantity = productEntryMode === "money" && unitPrice > 0 ? requestedMoney / unitPrice : parsedQuantity.quantity;
    var total = productEntryMode === "money" ? requestedMoney : unitPrice * quantity;
    $("productModalTotal").textContent = money(total);
    if ($("productQuantityHelp") && productEntryMode === "money") {
      $("productQuantityHelp").textContent = requestedMoney > 0 && unitPrice > 0
        ? "Se descontaran " + formatQuantity(quantity) + " " + unitLabel(selectedProduct.unitType, quantity) + " del stock."
        : "Ingrese el importe que pide el cliente; el peso se calcula automaticamente.";
      $("productQuantityHelp").classList.remove("weight-guard");
    } else if ($("productQuantityHelp") && parsedQuantity.interpretedAsGrams) {
      $("productQuantityHelp").textContent = parsedQuantity.raw + " sin coma se tomara como " + formatQuantity(parsedQuantity.quantity) + " kg.";
      $("productQuantityHelp").classList.add("weight-guard");
    } else if ($("productQuantityHelp")) {
      $("productQuantityHelp").textContent = productQuantityHelpText(selectedProduct);
      $("productQuantityHelp").classList.remove("weight-guard");
    }
  }
  function productLineFromModal() {
    if (!selectedProduct) return null;
    var price = parseMoney($("productPriceInput").value);
    var parsedQuantity = saleQuantityFromInput(selectedProduct, $("productQuantityInput").value);
    var selectedPriceUnit = selectedProduct.priceUnit || selectedProduct.unitType;
    var unitPrice = priceForSaleUnit(price, selectedPriceUnit, selectedProduct.unitType);
    var requestedMoney = productEntryMode === "money" ? Math.max(0, parseMoney($("productQuantityInput").value)) : 0;
    var q = productEntryMode === "money" && unitPrice > 0 ? moneyPrecision(requestedMoney / unitPrice) : parsedQuantity.quantity;
    if (price <= 0 || q <= 0 || productEntryMode === "money" && requestedMoney <= 0) {
      toast("Cargue precio y cantidad");
      return null;
    }
    if (productEntryMode !== "money" && !confirmUnusuallyLargeWeight(selectedProduct, parsedQuantity)) {
      $("productQuantityInput").focus();
      $("productQuantityInput").select();
      return null;
    }
    if (productEntryMode !== "money" && parsedQuantity.interpretedAsGrams) toast(parsedQuantity.raw + " g interpretados como " + formatQuantity(q) + " kg");
    return {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: q,
      unitType: selectedProduct.unitType,
      unitPrice: unitPrice,
      subtotal: productEntryMode === "money" ? moneyPrecision(requestedMoney) : Math.round(q * unitPrice * 100) / 100,
      priceUnit: selectedPriceUnit,
      baseUnitPrice: price,
      barcode: normalizeBarcode(selectedProduct.barcode),
      source: "",
      quantityEntryMode: productEntryMode,
      requestedAmount: productEntryMode === "money" ? moneyPrecision(requestedMoney) : 0
    };
  }
  function registerProductSale(e) {
    e.preventDefault();
    var item = productLineFromModal();
    if (!item) return;
    closeProductModal();
    saveSale(item.subtotal, "PRODUCT_QUICK", [item]);
  }
  function addProductToTicket() {
    var item = productLineFromModal();
    if (!item) return;
    pushBasketItem(item);
    playTicketSound();
    closeProductModal();
    renderBasket();
    renderProducts();
    toast("Agregado al ticket");
    focusBarcodeInput(80);
  }
  function openWithdrawModal() {
    $("withdrawModal").classList.remove("hidden");
    $("withdrawAmount").focus();
  }
  function closeWithdrawModal() {
    $("withdrawModal").classList.add("hidden");
  }
  function scheduleSaleAutoSave() {
    clearTimeout(autoSaleTimer);
    renderQuickSplitPayment();
    if (isSplitPayment(PAYMENT)) return;
    if (!$("saleAmount") || parseMoney($("saleAmount").value) <= 0) return;
    autoSaleTimer = setTimeout(function () {
      if (!isSubmittingSale && parseMoney($("saleAmount").value) > 0) {
        saveSale(parseMoney($("saleAmount").value), "FAST_AUTO");
        toast("Venta pendiente registrada automaticamente");
      }
    }, 60000);
  }
  function scheduleTicketAutoSave() {
    clearTimeout(autoTicketTimer);
  }
  function openProductEditor() {
    $("productEditorModal").classList.remove("hidden");
    renderProductEditor();
  }
  function closeProductEditor() {
    $("productEditorModal").classList.add("hidden");
  }
  function normalizedProductCostState(product) {
    var state = String(product && product.costState || "UNKNOWN").toUpperCase();
    return ["KNOWN", "REPLACEMENT_ONLY", "UNKNOWN"].indexOf(state) >= 0 ? state : "UNKNOWN";
  }
  function productCostCoverage(product) {
    var explicit = Number(product && product.costCoveragePct);
    if (isFinite(explicit) && explicit >= 0) return Math.min(100, explicit);
    var known = Math.max(0, Number(product && product.knownCostQuantity || 0));
    var unknown = Math.max(0, Number(product && product.unknownCostQuantity || 0));
    if (known + unknown > 0) return known / (known + unknown) * 100;
    return normalizedProductCostState(product) === "KNOWN" ? 100 : 0;
  }
  function productCostStateLabel(state) {
    return state === "KNOWN" ? "Costo conocido" : state === "REPLACEMENT_ONLY" ? "Solo costo de reposicion" : "Costo desconocido";
  }
  function currentProductLatestCost(product) {
    var value = Number(product && product.latestCostPerSaleUnit);
    return isFinite(value) && value > 0 ? value : null;
  }
  function updateProductCostPreview() {
    if (!$("editProductCostState")) return;
    var existing = editingProductDraft || {};
    var quantity = parseMoney($("editProductPurchaseUnitQuantity") && $("editProductPurchaseUnitQuantity").value);
    var purchaseCost = parseMoney($("editProductPurchaseCost") && $("editProductPurchaseCost").value);
    var latestCost = quantity > 0 && purchaseCost > 0 ? purchaseCost / quantity : currentProductLatestCost(existing);
    var markupText = $("editProductTargetMarkup") ? $("editProductTargetMarkup").value.trim() : "";
    var markup = parseMoney(markupText);
    var price = parseMoney($("editProductPrice") && $("editProductPrice").value);
    var saleUnit = $("editProductUnit") ? $("editProductUnit").value : (existing.unitType || "unidad");
    var state = normalizedProductCostState(existing);
    if (latestCost && state === "UNKNOWN") state = "REPLACEMENT_ONLY";
    var suggested = latestCost && markupText !== "" ? latestCost * (1 + markup / 100) : null;
    var suggestedMargin = suggested && suggested > 0 ? (suggested - latestCost) / suggested * 100 : null;
    var currentMargin = latestCost && price > 0 ? (price - latestCost) / price * 100 : null;
    var weighted = Number(existing.weightedAverageCostPerSaleUnit);
    var coverage = productCostCoverage(existing);
    $("editProductCostState").textContent = productCostStateLabel(state);
    $("editProductCostState").className = "cost-state-pill " + (state === "KNOWN" ? "known" : state === "REPLACEMENT_ONLY" ? "estimated" : "unknown");
    $("editProductCostUnitLabel").textContent = saleUnit || "unidad";
    $("editProductCostPerUnit").textContent = latestCost ? moneyCost(latestCost) : "Sin costo";
    var hasKnownWeightedCost = isFinite(weighted) && weighted >= 0 && Number(existing.knownCostQuantity || 0) > 0;
    $("editProductWeightedCost").textContent = hasKnownWeightedCost ? moneyCost(weighted) + " / " + saleUnit : "Sin costo conocido";
    $("editProductCostCoverage").textContent = percentValue(coverage) + " del stock cubierto con costo real";
    $("editProductSuggestedPrice").textContent = suggested ? moneyCost(suggested) + " / " + saleUnit : "Sin sugerencia";
    $("editProductMarkupExplanation").textContent = suggested
      ? "Markup " + percentValue(markup) + " · margen resultante " + percentValue(suggestedMargin)
      : "Ingrese costo y markup para calcular";
    $("editProductGrossMargin").textContent = currentMargin == null ? "Sin costo" : percentValue(currentMargin);
    $("editProductMarginExplanation").textContent = latestCost ? "Sobre ultimo costo de reposicion; no sobre costo historico" : "No se inventan costos faltantes";
  }
  function purchaseLineUnitCost(line) {
    var value = Number(line && (line.landedCostPerSaleUnit != null ? line.landedCostPerSaleUnit : line.costPerSaleUnit != null ? line.costPerSaleUnit : line.unitCost));
    return isFinite(value) && value >= 0 ? value : null;
  }
  function renderProductCostHistory(product) {
    if (!$("productCostHistoryList")) return;
    if (!product || !product.id) {
      $("productCostHistoryList").innerHTML = "<p class='product-cost-empty'>El historial comienza al confirmar el primer pedido.</p>";
      return;
    }
    $("productCostHistoryList").innerHTML = "<p class='product-cost-empty'>Cargando historial...</p>";
    Promise.all([allIfAvailable("purchaseLines"), allIfAvailable("purchases"), allIfAvailable("suppliers"), allIfAvailable("priceHistory")]).then(function (sets) {
      if (!editingProductDraft || editingProductDraft.id !== product.id || !$("productCostHistoryList")) return;
      var purchases = {};
      var suppliers = {};
      sets[1].forEach(function (row) { purchases[row.id] = row; });
      sets[2].forEach(function (row) { suppliers[row.id] = row; });
      var purchaseRows = sets[0].filter(function (line) {
        if (line.productId !== product.id) return false;
        var purchase = purchases[line.purchaseId] || {};
        var status = String(purchase.status || line.purchaseStatus || "").toUpperCase();
        return status === "CONFIRMED" || !!line.confirmedAt || !!purchase.confirmedAt;
      }).map(function (line) {
        var purchase = purchases[line.purchaseId] || {};
        var supplier = suppliers[purchase.supplierId || line.supplierId] || {};
        return {
          kind: "cost",
          date: purchase.deliveryDate || line.deliveryDateSnapshot || line.deliveryDate || purchase.confirmedAt || line.confirmedAt || line.createdAt || "",
          supplier: line.supplierNameSnapshot || line.supplierName || purchase.supplierName || purchase.supplierSnapshot && purchase.supplierSnapshot.name || supplier.companyName || supplier.name || "Proveedor sin nombre",
          quantity: Number(line.totalSaleQuantity != null ? line.totalSaleQuantity : line.totalReceivedSaleUnits != null ? line.totalReceivedSaleUnits : line.totalQuantityReceived != null ? line.totalQuantityReceived : line.receivedSaleQuantity || 0),
          unitType: line.saleUnit || product.unitType || "unidad",
          cost: purchaseLineUnitCost(line),
          invoice: purchase.invoiceNumber || line.invoiceNumberSnapshot || line.invoiceNumber || ""
        };
      });
      var priceRows = sets[3].filter(function (row) { return row.productId === product.id; }).map(function (row) {
        return {
          kind: "price",
          date: row.createdAt || row.changedAt || row.actionAt || "",
          previousPrice: Number(row.previousPrice != null ? row.previousPrice : row.oldPrice || 0),
          newPrice: Number(row.newPrice != null ? row.newPrice : row.approvedPrice || 0),
          reason: row.reason || row.source || "Cambio de precio",
          user: row.userName || row.actionByName || row.changedByName || ""
        };
      });
      var rows = purchaseRows.concat(priceRows).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      $("productCostHistoryList").innerHTML = rows.length ? rows.slice(0, 40).map(function (row) {
        if (row.kind === "price") {
          return "<article class='product-history-row price'><span><b>Cambio de precio</b><small>" + escapeHtml(String(row.date).slice(0, 10) || "Sin fecha") + (row.user ? " · " + escapeHtml(row.user) : "") + "</small></span><strong>" + moneyCost(row.previousPrice) + " → " + moneyCost(row.newPrice) + "</strong><em>" + escapeHtml(row.reason) + "</em></article>";
        }
        return "<article class='product-history-row cost'><span><b>" + escapeHtml(row.supplier) + "</b><small>" + escapeHtml(String(row.date).slice(0, 10) || "Sin fecha") + (row.invoice ? " · Fact. " + escapeHtml(row.invoice) : "") + "</small></span><strong>" + (row.cost != null ? moneyCost(row.cost) + " / " + escapeHtml(row.unitType) : "Costo no disponible") + "</strong><em>" + formatQuantity(row.quantity) + " " + escapeHtml(unitLabel(row.unitType, row.quantity)) + "</em></article>";
      }).join("") : "<p class='product-cost-empty'>Todavia no hay compras confirmadas ni cambios de precio para este producto.</p>";
    });
  }
  function resetProductEditorForm() {
    editingProductDraft = null;
    $("editProductId").value = "";
    $("editProductName").value = "";
    $("editProductUnit").value = "unidad";
    $("editProductPrice").value = "";
    $("editProductPriceUnit").value = "unidad";
    $("editProductCategory").value = "";
    if ($("editProductBarcode")) $("editProductBarcode").value = "";
    if ($("editProductStock")) $("editProductStock").value = "";
    if ($("editProductMinStock")) $("editProductMinStock").value = "";
    if ($("editProductLocation")) $("editProductLocation").value = "";
    if ($("editProductPurchaseUnit")) $("editProductPurchaseUnit").value = "";
    if ($("editProductPurchaseUnitQuantity")) $("editProductPurchaseUnitQuantity").value = "";
    if ($("editProductPurchaseCost")) $("editProductPurchaseCost").value = "";
    if ($("editProductTargetMarkup")) $("editProductTargetMarkup").value = "";
    $("editProductImage").value = "";
    editImageData = "";
    cropImage = null;
    cropImageData = "";
    $("cropEditor").classList.add("hidden");
    $("cropPreview").innerHTML = "";
    $("cropZoom").value = "1";
    $("cropX").value = "50";
    $("cropY").value = "50";
    $("productFormTitle").textContent = "Nuevo producto";
    renderProductCostHistory(null);
    updateProductCostPreview();
  }
  function openProductForm(product, barcodePreset) {
    if (!isAdmin()) return;
    if ($("productFormModal") && $("productFormModal").parentNode !== document.body) {
      document.body.appendChild($("productFormModal"));
    }
    resetProductEditorForm();
    populateProductCategorySelects(editorProducts, product && product.category);
    if (product) {
      editingProductDraft = Object.assign({}, product);
      $("editProductId").value = product.id;
      $("editProductName").value = product.name || "";
      $("editProductUnit").value = product.unitType || product.priceUnit || "unidad";
      $("editProductPrice").value = String(product.price || "");
      $("editProductPriceUnit").value = product.priceUnit || product.unitType || "unidad";
      $("editProductCategory").value = product.category || "";
      if ($("editProductBarcode")) $("editProductBarcode").value = product.barcode || "";
      if ($("editProductStock")) $("editProductStock").value = String(product.stock || "");
      if ($("editProductMinStock")) $("editProductMinStock").value = String(product.minStock || "");
      if ($("editProductLocation")) $("editProductLocation").value = product.location || "";
      if ($("editProductPurchaseUnit")) $("editProductPurchaseUnit").value = product.purchaseUnit || "";
      if ($("editProductPurchaseUnitQuantity")) $("editProductPurchaseUnitQuantity").value = product.purchaseUnitQuantity > 0 ? String(product.purchaseUnitQuantity) : "";
      if ($("editProductPurchaseCost")) {
        var latestCost = currentProductLatestCost(product);
        var purchaseQuantity = Number(product.purchaseUnitQuantity || 0);
        $("editProductPurchaseCost").value = latestCost && purchaseQuantity > 0 ? String(moneyPrecision(latestCost * purchaseQuantity)) : "";
      }
      if ($("editProductTargetMarkup")) $("editProductTargetMarkup").value = product.targetMarkupPct == null ? "" : String(product.targetMarkupPct);
      editImageData = product.imageData || "";
      $("productFormTitle").textContent = "Editar producto";
    } else if (barcodePreset && $("editProductBarcode")) {
      $("editProductBarcode").value = normalizeBarcode(barcodePreset);
      $("productFormTitle").textContent = "Product Registration";
    }
    $("productFormModal").classList.remove("hidden");
    $("productFormModal").removeAttribute("aria-hidden");
    updateProductCostPreview();
    renderProductCostHistory(product || null);
    setTimeout(function () {
      if ($("editProductName")) $("editProductName").focus();
    }, 0);
  }
  function closeProductForm() {
    $("productFormModal").classList.add("hidden");
    pendingManualReviewItem = null;
    purchasePendingProductCreation = false;
  }
  function renderProductEditor() {
    all("products").then(function (products) {
      editorProducts = products.filter(function (p) { return p.active; });
      $("productEditorList").innerHTML = editorProducts.length ? editorProducts.map(function (p) {
        return "<div class='editor-product-row'><div>" + productImage(p) + "</div><span><b>" + escapeHtml(p.name) + "</b><small><i>" + escapeHtml(productCategory(p)) + "</i> | " + money(p.price) + " / " + escapeHtml(p.priceUnit || p.unitType) + " | stock " + escapeHtml(String(p.stock || 0)) + " | vendido por " + escapeHtml(p.unitType) + (p.barcode ? " | cod. " + escapeHtml(p.barcode) : "") + "</small></span><button type='button' data-edit-product='" + p.id + "'>Editar</button><button class='danger' type='button' data-delete-product='" + p.id + "'>Dar de baja</button></div>";
      }).join("") : empty("Sin productos");
      document.querySelectorAll("[data-edit-product]").forEach(function (btn) {
        btn.onclick = function () {
          var p = editorProducts.filter(function (x) { return x.id === btn.dataset.editProduct; })[0];
          if (!p) return;
          openProductForm(p);
        };
      });
      document.querySelectorAll("[data-delete-product]").forEach(function (btn) {
        btn.onclick = function () {
          var p = editorProducts.filter(function (x) { return x.id === btn.dataset.deleteProduct; })[0];
          deleteProduct(p);
        };
      });
    });
  }
  function deleteProduct(product) {
    if (!product || !confirm("Dar de baja " + product.name + " de la tienda?")) return;
    product.active = false;
    product.updatedAt = nowIso();
    add("products", product).then(function () {
      invalidateProductSearchCache();
      renderProducts();
      renderProductEditor();
      renderProduction();
      audit("PRODUCT_DELETED", product.name, "warning");
      toast("Producto dado de baja");
    });
  }
  function saveProductCostAndPriceAtomic(product, existing, purchaseUnitCost, purchaseUnitQuantity) {
    var stamp = nowIso();
    var oldStock = Math.max(0, Number(existing.stock || 0));
    var newStock = Math.max(0, Number(product.stock || 0));
    var stockDelta = moneyPrecision(newStock - oldStock);
    var stockKnownDelta = 0, stockUnknownDelta = 0, stockKnownValueDelta = 0;
    if (Math.abs(stockDelta) > .000001) {
      var pools = productCostPools(existing);
      if (stockDelta > 0) {
        pools.unknown += stockDelta;
        stockUnknownDelta = stockDelta;
      } else {
        var quantityToRemove = -stockDelta;
        var unknownRemoved = Math.min(quantityToRemove, pools.unknown);
        pools.unknown -= unknownRemoved;
        quantityToRemove -= unknownRemoved;
        stockUnknownDelta = -unknownRemoved;
        if (quantityToRemove > 0) {
          var knownRemoved = Math.min(quantityToRemove, pools.known);
          var wac = pools.known > 0 ? pools.value / pools.known : 0;
          var valueRemoved = knownRemoved * wac;
          pools.known -= knownRemoved;
          pools.value = Math.max(0, pools.value - valueRemoved);
          stockKnownDelta = -knownRemoved;
          stockKnownValueDelta = -valueRemoved;
        }
      }
      applyCostPools(product, pools);
    }
    var oldPrice = Number(existing.price || 0);
    var oldLatestCost = currentProductLatestCost(existing);
    var newLatestCost = purchaseUnitCost > 0 && purchaseUnitQuantity > 0 ? moneyPrecision(purchaseUnitCost / purchaseUnitQuantity) : oldLatestCost;
    var costChanged = newLatestCost != null && (oldLatestCost == null || Math.abs(newLatestCost - oldLatestCost) > .009);
    var priceChanged = existing.id && Math.abs(Number(product.price || 0) - oldPrice) > .009;
    if (costChanged) {
      product.previousCostPerSaleUnit = oldLatestCost == null ? null : oldLatestCost;
      product.latestCostPerSaleUnit = newLatestCost;
      product.suggestedPrice = product.targetMarkupPct == null ? null : moneyPrecision(newLatestCost * (1 + Number(product.targetMarkupPct) / 100));
      product.costUpdatedAt = stamp;
      product.costState = Number(product.unknownCostQuantity || 0) > 0 || Number(product.knownCostQuantity || 0) <= 0 ? "REPLACEMENT_ONLY" : normalizedProductCostState(product);
    } else if (newLatestCost != null) {
      product.suggestedPrice = product.targetMarkupPct == null ? null : moneyPrecision(newLatestCost * (1 + Number(product.targetMarkupPct) / 100));
    }
    var markupChanged = (product.targetMarkupPct == null) !== (existing.targetMarkupPct == null) || (product.targetMarkupPct != null && Math.abs(Number(product.targetMarkupPct) - Number(existing.targetMarkupPct || 0)) > .009);
    var suggestedChanged = (product.suggestedPrice == null) !== (existing.suggestedPrice == null) || (product.suggestedPrice != null && Math.abs(Number(product.suggestedPrice) - Number(existing.suggestedPrice || 0)) > .009);
    return dbPromise.then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(["products", "priceReviews", "priceHistory", "inventoryMovements", "auditLog"], "readwrite");
        var productStore = transaction.objectStore("products");
        var reviewStore = transaction.objectStore("priceReviews");
        var storedProduct = null, storedProducts = [], storedReviews = [], pending = 3, staged = false;
        var abortMessage = "";
        function cancel(message) {
          abortMessage = message;
          try { transaction.abort(); } catch (_error) {}
        }
        function stageWrites() {
          if (pending || staged) return;
          staged = true;
          var isExisting = !!existing.id;
          if (isExisting && !storedProduct) { cancel("El producto ya no existe; vuelva a abrir el editor"); return; }
          if (!isExisting && storedProduct) { cancel("El producto ya fue creado en otra ventana"); return; }
          if (isExisting && JSON.stringify(storedProduct) !== JSON.stringify(existing)) {
            cancel("El producto cambio en otra ventana. Vuelva a abrirlo antes de guardar para no perder stock ni costos");
            return;
          }
          var duplicateBarcode = normalizeBarcode(product.barcode) && storedProducts.some(function (row) {
            return row.id !== product.id && normalizeBarcode(row.barcode) === normalizeBarcode(product.barcode);
          });
          if (duplicateBarcode) { cancel("Ese codigo ya pertenece a otro producto"); return; }
          var review = null;
          var supersededReviews = [];
          if (priceChanged || costChanged || markupChanged || suggestedChanged) {
            supersededReviews = storedReviews.filter(function (row) { return row.productId === product.id && priceReviewStatus(row) === "PENDING"; }).map(function (row) {
              var superseded = Object.assign({}, row, { status: "SUPERSEDED", actionAt: stamp, actionBy: currentUser && currentUser.id || "", actionNote: priceChanged ? "Precio modificado manualmente desde Stock" : "Reemplazada por nueva informacion de costo o markup" });
              delete superseded.product;
              return superseded;
            });
          }
          if ((costChanged || markupChanged || suggestedChanged) && newLatestCost != null && (product.suggestedPrice == null || Math.abs(Number(product.suggestedPrice) - Number(product.price || 0)) > .009)) {
            review = {
              id: uid(), createdAt: stamp, createdBy: currentUser && currentUser.id || "",
              productId: product.id, productName: product.name, status: "PENDING",
              previousCostPerSaleUnit: oldLatestCost, newCostPerSaleUnit: newLatestCost,
              currentPrice: Number(product.price || 0), suggestedPrice: product.suggestedPrice == null ? null : Number(product.suggestedPrice),
              proposedPrice: product.suggestedPrice == null ? null : Number(product.suggestedPrice), targetMarkupPct: product.targetMarkupPct == null ? null : Number(product.targetMarkupPct),
              needsTargetMarkup: product.targetMarkupPct == null,
              sourceType: "MANUAL_COST", sourcePurchaseId: "", sourcePurchaseLineId: "",
              updatedAt: stamp
            };
          }
          var history = priceChanged ? {
            id: uid(), productId: product.id, productName: product.name,
            previousPrice: oldPrice, newPrice: Number(product.price || 0), changeType: "MANUAL_EDIT",
            sourcePriceReviewId: "", sourcePurchaseId: "", reason: "Edicion manual desde Stock",
            createdAt: stamp, createdBy: currentUser && currentUser.id || ""
          } : null;
          var details = [product.name];
          if (costChanged) details.push("costo " + (oldLatestCost == null ? "desconocido" : moneyCost(oldLatestCost)) + " -> " + moneyCost(newLatestCost));
          if (markupChanged) details.push("markup " + (product.targetMarkupPct == null ? "sin objetivo" : percentValue(product.targetMarkupPct)));
          if (priceChanged) details.push("precio " + money(oldPrice) + " -> " + money(product.price));
          var stockMovement = Math.abs(stockDelta) > .000001 ? {
            id: uid(), type: "MANUAL_STOCK_ADJUSTMENT", productId: product.id, quantity: stockDelta,
            knownCostQuantity: moneyPrecision(stockKnownDelta), unknownCostQuantity: moneyPrecision(stockUnknownDelta),
            knownCostValue: moneyPrecision(stockKnownValueDelta), unitCost: stockKnownDelta ? moneyPrecision(stockKnownValueDelta / stockKnownDelta) : null,
            referenceType: "PRODUCT_EDIT", referenceId: product.id, referenceLineId: "", createdAt: stamp,
            createdBy: currentUser && currentUser.id || "", note: "Correccion manual desde Stock"
          } : null;
          productStore.put(product);
          if (review) reviewStore.put(review);
          supersededReviews.forEach(function (row) { reviewStore.put(row); });
          if (history) transaction.objectStore("priceHistory").put(history);
          if (stockMovement) transaction.objectStore("inventoryMovements").put(stockMovement);
          transaction.objectStore("auditLog").put({
            id: uid(), createdAt: stamp, userId: currentUser && currentUser.id, username: currentUser && currentUser.username,
            action: costChanged ? "PRODUCT_MANUAL_COST_UPDATED" : priceChanged ? "PRODUCT_MANUAL_PRICE_UPDATED" : "PRODUCT_SAVED",
            detail: details.join(" | "), severity: costChanged || priceChanged ? "warning" : "normal"
          });
        }
        var storedRequest = productStore.get(product.id);
        storedRequest.onsuccess = function () { storedProduct = storedRequest.result || null; pending -= 1; stageWrites(); };
        storedRequest.onerror = function () { cancel("No se pudo releer el producto"); };
        var productsRequest = productStore.getAll();
        productsRequest.onsuccess = function () { storedProducts = productsRequest.result || []; pending -= 1; stageWrites(); };
        productsRequest.onerror = function () { cancel("No se pudo validar el codigo de barras"); };
        var reviewsRequest = reviewStore.getAll();
        reviewsRequest.onsuccess = function () { storedReviews = reviewsRequest.result || []; pending -= 1; stageWrites(); };
        reviewsRequest.onerror = function () { cancel("No se pudieron releer las revisiones de precio"); };
        transaction.oncomplete = function () { if (diskSnapshotWritesEnabled && !diskSnapshotPaused) scheduleDiskSnapshot(); resolve(product); };
        transaction.onerror = function () { reject(transaction.error || new Error(abortMessage || "No se pudo guardar el producto")); };
        transaction.onabort = function () { reject(transaction.error || new Error(abortMessage || "Guardado cancelado")); };
      });
    });
  }
  function saveProductEditor(e) {
    e.preventDefault();
    if (!isAdmin()) return;
    var name = $("editProductName").value.trim();
    var price = parseMoney($("editProductPrice").value);
    if (!name) { toast("Complete el nombre"); return; }
    if (cropImage) editImageData = buildCroppedImage();
    var id = $("editProductId").value || uid();
    var existing = editingProductDraft && editingProductDraft.id === id
      ? editingProductDraft
      : editorProducts.filter(function (p) { return p.id === id; })[0] || {};
    var priceUnit = $("editProductPriceUnit").value;
    var unitType = $("editProductUnit").value;
    var barcode = normalizeBarcode($("editProductBarcode") && $("editProductBarcode").value);
    var stockRaw = $("editProductStock") && $("editProductStock").value;
    var stock = stockRaw === "" || stockRaw == null ? Number(existing.stock || 0) : parseMoney(stockRaw);
    var purchaseUnit = $("editProductPurchaseUnit") ? $("editProductPurchaseUnit").value.trim() : (existing.purchaseUnit || "");
    var purchaseUnitQuantity = parseMoney($("editProductPurchaseUnitQuantity") && $("editProductPurchaseUnitQuantity").value);
    var purchaseUnitCost = parseMoney($("editProductPurchaseCost") && $("editProductPurchaseCost").value);
    var targetMarkupRaw = $("editProductTargetMarkup") ? $("editProductTargetMarkup").value.trim() : "";
    var targetMarkupPct = targetMarkupRaw === "" ? null : parseMoney(targetMarkupRaw);
    if ((purchaseUnitQuantity > 0 && purchaseUnitCost <= 0) || (purchaseUnitCost > 0 && purchaseUnitQuantity <= 0)) {
      toast("Para calcular el costo complete contenido y costo de la unidad de compra");
      return;
    }
    if (barcode && editorProducts.some(function (p) { return p.id !== id && normalizeBarcode(p.barcode) === barcode; })) {
      toast("Ese codigo ya pertenece a otro producto");
      return;
    }
    var product = Object.assign({}, existing, {
      id: id,
      name: name,
      price: Math.max(0, price),
      unitType: unitType,
      priceUnit: priceUnit,
      category: $("editProductCategory").value.trim() || "General",
      barcode: barcode,
      stock: Math.max(0, stock || 0),
      minStock: Math.max(0, parseMoney($("editProductMinStock") && $("editProductMinStock").value)),
      location: $("editProductLocation") ? $("editProductLocation").value.trim() : (existing.location || ""),
      purchaseUnit: purchaseUnit,
      purchaseUnitQuantity: Math.max(0, purchaseUnitQuantity || 0),
      targetMarkupPct: targetMarkupPct == null ? null : Math.max(0, targetMarkupPct),
      imageData: editImageData || existing.imageData || "",
      active: true,
      sortOrder: existing.sortOrder == null ? editorProducts.length : existing.sortOrder,
      createdAt: existing.createdAt || nowIso(),
      updatedAt: nowIso()
    });
    var manualGroupToResolve = pendingManualReviewItem;
    var returnToPurchase = purchasePendingProductCreation;
    saveProductCostAndPriceAtomic(product, existing, purchaseUnitCost, purchaseUnitQuantity).then(function () {
      return manualGroupToResolve ? resolveManualReviewGroup(manualGroupToResolve, product) : Promise.resolve();
    }).then(function () {
      invalidateProductSearchCache();
      resetProductEditorForm();
      closeProductForm();
      renderProducts();
      renderProductEditor();
      renderProduction();
    }).then(function () {
      document.dispatchEvent(new CustomEvent("forrajeria:product-saved", { detail: { product: product, returnToPurchase: returnToPurchase } }));
      toast(manualGroupToResolve ? "Producto creado; items manuales marcados como registrados" : "Producto guardado");
    }).catch(function (error) { toast(error && error.message || "No se pudo guardar el producto"); });
  }
  function openCustomItemModal() {
    $("customItemModal").classList.remove("hidden");
    $("customItemName").focus();
    updateCustomItemTotal();
  }
  function closeCustomItemModal() {
    $("customItemModal").classList.add("hidden");
    $("customItemForm").reset();
    updateCustomItemTotal();
  }
  function updateCustomItemTotal() {
    $("customItemTotal").textContent = money(parseMoney($("customItemAmount").value));
  }
  function saveCustomItem(e) {
    e.preventDefault();
    var name = $("customItemName").value.trim();
    var amount = parseMoney($("customItemAmount").value);
    if (!name || amount <= 0) { toast("Complete la descripcion y el importe"); return; }
    var manualItemId = uid();
    pushBasketItem({
      productId: "manual:" + manualItemId,
      manualItemId: manualItemId,
      productName: name,
      quantity: 1,
      unitType: "unidad",
      unitPrice: amount,
      subtotal: amount,
      barcode: "",
      scannedCode: "",
      source: "manual-item",
      reviewFlag: true,
      manualItem: true,
      reviewReason: "Item manual sin registrar"
    });
    playTicketSound();
    closeCustomItemModal();
    renderBasket();
    toast("Item manual agregado");
  }
  function handleProductImage(file) {
    if (!file) { editImageData = ""; return; }
    var reader = new FileReader();
    reader.onload = function () { showCropImage(String(reader.result || "")); };
    reader.readAsDataURL(file);
  }
  function showCropImage(dataUrl) {
    cropImageData = dataUrl;
    cropImage = new Image();
    cropImage.onload = function () {
      $("cropZoom").value = "1";
      $("cropX").value = "50";
      $("cropY").value = "50";
      $("cropEditor").classList.remove("hidden");
      updateCropPreview();
    };
    cropImage.src = dataUrl;
  }
  function updateCropPreview() {
    if (!cropImage) return;
    $("cropPreview").innerHTML = "<img src='" + escapeHtml(buildCroppedImage(360)) + "' alt=''><span>Arrastre para elegir el corte</span>";
  }
  function buildCroppedImage(outputSize) {
    if (!cropImage) return editImageData;
    var canvas = document.createElement("canvas");
    var size = outputSize || 480;
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    var zoom = Number($("cropZoom").value || 1);
    var shiftX = Number($("cropX").value || 50) / 100;
    var shiftY = Number($("cropY").value || 50) / 100;
    var base = Math.min(cropImage.naturalWidth, cropImage.naturalHeight) / zoom;
    var sx = (cropImage.naturalWidth - base) * shiftX;
    var sy = (cropImage.naturalHeight - base) * shiftY;
    sx = Math.max(0, Math.min(cropImage.naturalWidth - base, sx));
    sy = Math.max(0, Math.min(cropImage.naturalHeight - base, sy));
    ctx.drawImage(cropImage, sx, sy, base, base, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.86);
  }
  function startCropDrag(e) {
    if (!cropImage || !$("cropPreview")) return;
    if (e && e.preventDefault) e.preventDefault();
    var p = eventPoint(e);
    cropDrag = {
      startX: p.x,
      startY: p.y,
      valueX: Number($("cropX").value || 50),
      valueY: Number($("cropY").value || 50),
      width: Math.max(1, $("cropPreview").clientWidth || 240),
      height: Math.max(1, $("cropPreview").clientHeight || 240)
    };
    document.body.classList.add("cropping-image");
  }
  function moveCropDrag(e) {
    if (!cropDrag) return;
    if (e && e.preventDefault) e.preventDefault();
    var p = eventPoint(e);
    var nextX = cropDrag.valueX - ((p.x - cropDrag.startX) / cropDrag.width) * 100;
    var nextY = cropDrag.valueY - ((p.y - cropDrag.startY) / cropDrag.height) * 100;
    $("cropX").value = String(Math.max(0, Math.min(100, Math.round(nextX))));
    $("cropY").value = String(Math.max(0, Math.min(100, Math.round(nextY))));
    updateCropPreview();
  }
  function stopCropDrag() {
    cropDrag = null;
    document.body.classList.remove("cropping-image");
  }

  function activeTransactions() {
    return all("transactions").then(function (trs) { return trs.filter(function (t) { return !t.deleted; }); });
  }
  function inferredBusinessDate(t) {
    return t.businessDate || String(t.createdAt || nowIso()).slice(0, 10);
  }
  function inferredShift(t) {
    if (t.shiftType === "AM" || t.shiftType === "PM") return t.shiftType;
    var u = String(t.username || t.userName || "").toLowerCase();
    if (u.indexOf("tarde") >= 0 || u.indexOf("pm") >= 0) return "PM";
    if (u.indexOf("manana") >= 0 || u.indexOf("mañana") >= 0 || u.indexOf("am") >= 0) return "AM";
    var d = new Date(t.createdAt || nowIso());
    var minutes = d.getHours() * 60 + d.getMinutes();
    if (minutes >= 390 && minutes < 840) return "AM";
    if (minutes >= 840 && minutes <= 1260) return "PM";
    return "AM";
  }
  function shiftTimeLabel(shift) {
    if (shift === "AMBOS") return "06:30 - 21:00";
    return shift === "PM" ? "14:00 - 21:00" : "06:30 - 14:00";
  }
  function activeClosureDate() {
    return closureDate || today();
  }
  function activeClosureShift() {
    return "DAY";
  }
  function zeroClosureTotals() {
    return {
      shift: [], sales: [], cashSales: 0, receivedTransfers: 0, expectedTransfer: 0,
      pendingTransfers: 0, reviewTransfers: 0, reviewTotal: 0, withdrawals: 0,
      openingCash: 0, expectedCash: 0, totalSales: 0
    };
  }
  function closureIsComplete(closures, date, shift) {
    var complete = (closures || []).filter(function (c) {
      return (c.closureKind || "COMPLETE") === "COMPLETE" && c.businessDate === date;
    });
    if (complete.some(function (c) { return c.shiftType === "DAY" || c.shiftType === "AMBOS" || !c.shiftType; })) return true;
    return complete.some(function (c) { return c.shiftType === "AM"; })
      && complete.some(function (c) { return c.shiftType === "PM"; });
  }
  function partialClosureIsSaved(closures, date) {
    return (closures || []).some(function (c) {
      return c.closureKind === "PARTIAL" && c.businessDate === date && c.shiftType === "AM";
    });
  }
  function relatedPartialClosure(closures, date) {
    return (closures || []).filter(function (c) {
      return c.closureKind === "PARTIAL" && c.businessDate === date && c.shiftType === "AM";
    }).sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    })[0] || null;
  }
  function closureHandoffSnapshot(partial) {
    if (!partial) return { performed: false };
    return {
      performed: true,
      id: partial.id || "",
      createdAt: partial.createdAt || "",
      createdBy: partial.createdBy || "",
      createdByName: partial.createdByName || "",
      totalSales: Number(partial.totalSales || 0),
      ticketCount: Number(partial.ticketCount || 0),
      expectedCash: Number(partial.expectedCash || 0),
      countedCash: Number(partial.countedCash || 0),
      differenceCash: Number(partial.differenceCash || 0),
      expectedTransfer: Number(partial.expectedTransfer || 0),
      countedTransfer: Number(partial.countedTransfer || 0),
      differenceTransfer: Number(partial.differenceTransfer || 0),
      notes: partial.notes || ""
    };
  }
  function canSavePartialClosure(date) {
    return Boolean(isAdmin() && currentSession && date);
  }
  function closureOpeningCash(sessions, date, selectedShift) {
    sessions = sessions || [];
    var daySessions = sessions.filter(function (s) { return s.businessDate === date; }).sort(function (a, b) {
      return String(a.loginTime || a.createdAt || "").localeCompare(String(b.loginTime || b.createdAt || ""));
    });
    var relevantSessions = selectedShift === "AM" || selectedShift === "PM"
      ? daySessions.filter(function (s) { return s.shiftType === selectedShift; })
      : daySessions;
    var recorded = relevantSessions.filter(function (s) { return s.openingCashRecorded !== false; })[0] || relevantSessions[0];
    if (recorded) return Number(recorded.openingCash || 0);
    if (currentSession && currentSession.businessDate === date
      && (selectedShift === "DAY" || !selectedShift || currentSession.shiftType === selectedShift)) {
      return Number(currentSession.openingCash || 0);
    }
    return 0;
  }
  function pendingClosureMap(trs, closures) {
    var map = {};
    missingClosureRows(trs, closures).forEach(function (r) {
      if (!map[r.date]) map[r.date] = [];
      if (map[r.date].indexOf(r.shift) < 0) map[r.date].push(r.shift);
    });
    Object.keys(map).forEach(function (date) {
      map[date].sort();
    });
    return map;
  }
  function setClosureContext(date, shift, resetForm) {
    closureDate = date || today();
    closureShift = "DAY";
    if ($("closureDateSelect")) $("closureDateSelect").value = closureDate;
    if (resetForm && $("closureForm")) {
      $("closureForm").reset();
      $("countedCash").value = "";
      $("countedTransfer").value = "";
    }
  }
  function renderClosureSelectors(trs, closures) {
    var dateSelect = $("closureDateSelect");
    if (!dateSelect) return { hasPending: false, dates: [] };
    var pendingRows = missingClosureRows(trs, closures);
    var pending = {};
    pendingRows.forEach(function (row) { pending[row.date] = row; });
    closureShift = "DAY";
    var dates = Object.keys(pending).sort(function (a, b) {
      if (a === today()) return -1;
      if (b === today()) return 1;
      return b.localeCompare(a);
    });
    if (!dates.length) {
      closureDate = "";
      dateSelect.disabled = true;
      dateSelect.innerHTML = "<option value=''>Sin cierres pendientes</option>";
      if ($("closureTaskHint")) $("closureTaskHint").textContent = "No hay tareas de cierre pendientes.";
      return { hasPending: false, dates: [], pending: pending };
    }
    dateSelect.disabled = false;
    if (dates.indexOf(closureDate) < 0) closureDate = dates[0];
    dateSelect.innerHTML = dates.map(function (date) {
      var row = pending[date];
      var label = date === today() ? date + " (hoy)" : date;
      label += " - pendiente";
      if (row && row.count) label += " - " + row.count + " movimientos";
      return "<option value='" + escapeHtml(date) + "'>" + escapeHtml(label) + "</option>";
    }).join("");
    dateSelect.value = closureDate;
    if ($("closureTaskHint")) $("closureTaskHint").textContent = closureDate === today()
      ? "Tarea pendiente - recomendado entre las 19:30 y las 21:00"
      : "Cierre anterior pendiente de completar";
    return { hasPending: true, dates: dates, pending: pending };
  }
  function closureTotals(trs, date, selectedShift, closures, sessions) {
    date = date || activeClosureDate();
    selectedShift = selectedShift === "AM" || selectedShift === "PM" ? selectedShift : "DAY";
    var rows = trs.filter(function (t) {
      return inferredBusinessDate(t) === date && (selectedShift === "DAY" || inferredShift(t) === selectedShift);
    });
    var sales = rows.filter(function (t) { return t.type === "SALE"; });
    var cashSales = sales.reduce(function (total, sale) { return total + salePaymentParts(sale).cash; }, 0);
    var receivedTransfers = sales.reduce(function (total, sale) {
      if (isSplitPayment(sale.paymentMethod)) return total + salePaymentParts(sale).qr;
      return total + (isDigitalPayment(sale.paymentMethod) && digitalPaymentSettled(sale) ? Number(sale.amount || 0) : 0);
    }, 0);
    var pendingTransfers = sum(rows, function (t) {
      return t.type === "SALE" && isDigitalPayment(t.paymentMethod) && String(t.paymentStatus || t.transferStatus || "").toUpperCase() === "PENDING";
    });
    var reviewTransfers = sum(rows, function (t) {
      return t.type === "SALE" && isDigitalPayment(t.paymentMethod) && String(t.paymentStatus || t.transferStatus || "").toUpperCase() === "REVIEW";
    });
    var withdrawals = sum(rows, function (t) { return t.type === "WITHDRAWAL"; });
    var openingCash = closureOpeningCash(sessions, date, selectedShift);
    var expectedCash = openingCash + cashSales - withdrawals;
    var totalSales = sum(sales, function () { return true; });
    var largestTicket = sales.reduce(function (largest, sale) { return Math.max(largest, Number(sale.amount || 0)); }, 0);
    return {
      shift: rows,
      sales: sales,
      cashSales: cashSales,
      receivedTransfers: receivedTransfers,
      expectedTransfer: receivedTransfers,
      pendingTransfers: pendingTransfers,
      reviewTransfers: reviewTransfers,
      reviewTotal: pendingTransfers + reviewTransfers,
      withdrawals: withdrawals,
      openingCash: openingCash,
      expectedCash: expectedCash,
      totalSales: totalSales,
      largestTicket: largestTicket,
      ticketCount: sales.length,
      averageTicket: sales.length ? totalSales / sales.length : 0
    };
  }
  function updateClosureDiffs() {
    if (!closureSnapshot || !$("cashDiff")) return;
    var hasCash = String($("countedCash").value || "").trim() !== "";
    var hasTransfer = String($("countedTransfer").value || "").trim() !== "";
    var cashDiff = parseMoney($("countedCash").value) - closureSnapshot.expectedCash;
    var transferDiff = parseMoney($("countedTransfer").value) - closureSnapshot.expectedTransfer;
    $("cashDiff").textContent = hasCash ? money(cashDiff) : "—";
    $("transferDiff").textContent = hasTransfer ? money(transferDiff) : "—";
    $("cashDiff").parentNode.classList.toggle("negative", hasCash && cashDiff < 0);
    $("cashDiff").parentNode.classList.toggle("positive", hasCash && cashDiff > 0);
    $("transferDiff").parentNode.classList.toggle("negative", hasTransfer && transferDiff < 0);
    $("transferDiff").parentNode.classList.toggle("positive", hasTransfer && transferDiff > 0);
  }
  function closureItemStats(totals, basketItems) {
    var saleBasketIds = {};
    (totals.sales || []).forEach(function (sale) { if (sale.basketId) saleBasketIds[sale.basketId] = true; });
    return (basketItems || []).reduce(function (stats, item) {
      if (!saleBasketIds[item.basketId]) return stats;
      var quantity = Math.max(0, Number(item.quantity || 0));
      if (isVariableQuantityProduct(item)) {
        stats.items += 1;
        stats.variableLines += 1;
        if (String(item.unitType || item.priceUnit || "").toLowerCase() === "kg") stats.kg += quantity;
      } else {
        stats.items += Math.max(1, Math.round(quantity));
        stats.units += Math.max(1, Math.round(quantity));
      }
      return stats;
    }, { items: 0, units: 0, variableLines: 0, kg: 0 });
  }
  function closureItemsSold(totals, basketItems) {
    return Math.round(closureItemStats(totals, basketItems).items);
  }
  function setClosurePendingState(hasPending) {
    if ($("closurePendingContent")) $("closurePendingContent").classList.toggle("hidden", !hasPending);
    if ($("closureNoPending")) $("closureNoPending").classList.toggle("hidden", hasPending);
  }
  function renderPartialClosureLaunch(closures, date) {
    var button = $("openPartialClosureBtn");
    if (!button) return;
    var partial = relatedPartialClosure(closures, date);
    var saved = Boolean(partial);
    var allowed = canSavePartialClosure(date);
    button.classList.toggle("is-saved", saved);
    button.disabled = saved || !allowed;
    button.innerHTML = saved
      ? "<strong>Control AM -> PM realizado</strong><small>Dif. efectivo " + money(partial.differenceCash || 0) + " · Dif. QR " + money(partial.differenceTransfer || 0) + "</small>"
      : "<strong>Control AM -> PM</strong><small>Registrar control del cambio de turno</small>";
    button.title = saved
      ? "El control de este cambio de turno ya fue guardado"
      : allowed ? "Controlar el turno manana recibido" : "Disponible solo para admin/dev";
  }
  function renderClosures() {
    if (!isAdmin()) {
      switchTab("Caja");
      return;
    }
    Promise.all([activeTransactions(), all("closures"), all("sessions"), all("basketItems")]).then(function (data) {
      var trs = data[0];
      var allClosures = data[1];
      var sessions = data[2];
      var basketItems = data[3];
      var selectorState = renderClosureSelectors(trs, allClosures);
      setClosurePendingState(selectorState.hasPending);
      if ($("dailyClosureFormBox")) $("dailyClosureFormBox").classList.toggle("hidden", !isAdmin());
      if ($("dailyCloseWorkspace")) $("dailyCloseWorkspace").classList.toggle("staff-closure-view", !isAdmin());
      if (!selectorState.hasPending) {
        closureSnapshot = null;
        partialClosureSnapshot = null;
        return;
      }
      var selectedDate = activeClosureDate();
      var alreadyComplete = closureIsComplete(allClosures, selectedDate, "DAY");
      var totals = closureTotals(trs, selectedDate, "DAY", allClosures, sessions);
      totals.itemStats = closureItemStats(totals, basketItems);
      totals.itemsSold = totals.itemStats.items;
      closureSnapshot = totals;
      renderPartialClosureLaunch(allClosures, selectedDate);
      if ($("dayTotalSalesCard")) $("dayTotalSalesCard").textContent = money(totals.totalSales);
      if ($("dayTotalSalesNote")) $("dayTotalSalesNote").textContent = selectedDate === today()
        ? "Solo ventas de hoy; no incluye la caja inicial"
        : "Solo ventas del " + selectedDate + "; no incluye la caja inicial";
      if ($("expectedCashCard")) $("expectedCashCard").textContent = money(totals.expectedCash);
      if ($("expectedCashBreakdown")) $("expectedCashBreakdown").textContent = "Caja inicial " + money(totals.openingCash) + " + ventas " + money(totals.cashSales) + " - retiros " + money(totals.withdrawals);
      if ($("expectedTransferCard")) $("expectedTransferCard").textContent = money(totals.expectedTransfer);
      if ($("closureExpectedMoney")) $("closureExpectedMoney").textContent = money(totals.expectedCash + totals.expectedTransfer);
      if ($("closureExpectedMoneyBreakdown")) $("closureExpectedMoneyBreakdown").textContent = "Efectivo " + money(totals.expectedCash) + " + QR " + money(totals.expectedTransfer);
      $("closureExpected").innerHTML = summary([
        ["Caja inicial", money(totals.openingCash)],
        ["Total vendido (sin caja inicial)", money(totals.totalSales)],
        ["Clientes / tickets", totals.ticketCount],
        ["Ventas en efectivo", money(totals.cashSales)],
        ["Ventas por QR", money(totals.receivedTransfers)],
        ["Retiros", money(totals.withdrawals)],
        ["Efectivo esperado al cierre", money(totals.expectedCash)],
        ["Dinero que deberia haber", money(totals.expectedCash + totals.expectedTransfer)]
      ]);
      $("closureWarnings").innerHTML = alreadyComplete
        ? "<div class='closure-ok'>El cierre de este dia ya fue guardado. Puede reimprimir su ticket desde Ultimos cierres.</div>"
        : totals.reviewTotal > 0
        ? "<div class='closure-warning'>Hay " + money(totals.reviewTotal) + " en pagos digitales pendientes o para revisar. Las observaciones siguen siendo opcionales.</div>"
        : !isAdmin()
        ? "<div class='closure-ok'>Resumen disponible. El cierre final del dia lo completa un administrador.</div>"
        : "<div class='closure-ok'>Resumen diario listo para controlar y cerrar.</div>";
      updateClosureDiffs();
    });
    all("closures").then(renderClosureHistoryList);
  }
  function renderClosureHistoryList(rows) {
      rows.sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); });
      closureHistoryRows = rows.slice();
      var dailyRows = rows.filter(function (c) { return (c.closureKind || "COMPLETE") === "COMPLETE"; });
      var visibleRows = dailyRows.slice(0, closureHistoryRenderCount);
      $("closuresList").innerHTML = dailyRows.length ? visibleRows.map(function (storedClosure) {
        var c = Object.assign({}, storedClosure, {
          handoffControl: storedClosure.handoffControl && storedClosure.handoffControl.performed
            ? storedClosure.handoffControl
            : closureHandoffSnapshot(relatedPartialClosure(rows, storedClosure.businessDate))
        });
        var cashTone = Number(c.differenceCash || 0) === 0 ? "ok" : "warn";
        var transferTone = Number(c.differenceTransfer || 0) === 0 ? "ok" : "warn";
        var handoff = c.handoffControl && c.handoffControl.performed ? c.handoffControl : null;
        var handoffDiff = handoff ? Number(handoff.differenceCash || 0) + Number(handoff.differenceTransfer || 0) : 0;
        var handoffTone = !handoff ? "missing" : Math.abs(handoffDiff) < 0.01 ? "ok" : "warn";
        return "<article class='closure-row'>"
          + "<div class='closure-main'><b>" + c.businessDate + "</b><span>Cierre diario | " + localTimeLabel(c.createdAt) + " | " + escapeHtml(c.createdByName || "Admin") + "</span></div>"
          + "<div class='closure-sales-total'><span>Venta total</span><b>" + money(c.totalSales) + "</b><small>" + Number(c.ticketCount || 0) + " tickets</small></div>"
          + "<div class='" + cashTone + "'><span>Efectivo contado</span><b>" + money(c.countedCash) + "</b><small>Dif. " + money(c.differenceCash) + "</small></div>"
          + "<div class='" + transferTone + "'><span>QR contado</span><b>" + money(c.countedTransfer) + "</b><small>Dif. " + money(c.differenceTransfer) + "</small></div>"
          + "<div class='closure-handoff-status " + handoffTone + "'><span>Control AM -> PM</span><b>" + (handoff ? "Realizado" : "No realizado") + "</b><small>" + (handoff ? localTimeLabel(handoff.createdAt) + " | Dif. " + money(handoffDiff) : "Sin control previo") + "</small></div>"
          + "<button type='button' class='closure-print-button' data-print-closure='" + c.id + "'>Reimprimir ticket</button>"
          + (c.notes || handoff && handoff.notes ? "<p>" + (c.notes ? "Cierre: " + escapeHtml(c.notes) : "") + (c.notes && handoff && handoff.notes ? " | " : "") + (handoff && handoff.notes ? "AM/PM: " + escapeHtml(handoff.notes) : "") + "</p>" : "")
          + "</article>";
      }).join("") + (visibleRows.length < dailyRows.length ? "<div class='closure-load-status'>Deslice para cargar mas · " + visibleRows.length + " de " + dailyRows.length + "</div>" : "<div class='closure-load-status complete'>Todos los cierres cargados</div>") : empty("Sin cierres guardados");
      document.querySelectorAll("[data-print-closure]").forEach(function (button) {
        button.onclick = function () {
          var closure = dailyRows.filter(function (row) { return row.id === button.dataset.printClosure; })[0];
          if (!closure) return;
          var printable = Object.assign({}, closure, {
            handoffControl: closure.handoffControl && closure.handoffControl.performed
              ? closure.handoffControl
              : closureHandoffSnapshot(relatedPartialClosure(rows, closure.businessDate))
          });
          printClosureTicket(printable);
          audit("CLOSURE_TICKET_REPRINTED", closure.businessDate + " " + closure.id, "normal");
        };
      });
  }
  function loadMoreClosureHistory() {
    var total = closureHistoryRows.filter(function (c) { return (c.closureKind || "COMPLETE") === "COMPLETE"; }).length;
    if (closureHistoryRenderCount >= total) return;
    closureHistoryRenderCount = Math.min(total, closureHistoryRenderCount + 8);
    renderClosureHistoryList(closureHistoryRows);
  }
  function missingClosureRows(trs, closures, month) {
    var activity = {};
    trs.forEach(function (t) {
      var date = inferredBusinessDate(t);
      if (month && monthKey(date) !== month) return;
      if (t.type !== "SALE" && t.type !== "WITHDRAWAL") return;
      if (!activity[date]) activity[date] = { date: date, shift: "DAY", total: 0, count: 0 };
      activity[date].total += Number(t.amount || 0);
      activity[date].count += 1;
    });
    Object.keys(activity).forEach(function (date) {
      if (closureIsComplete(closures, date, "DAY")) delete activity[date];
    });
    return Object.keys(activity).map(function (k) { return activity[k]; }).sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
  }
  function groupMissingClosures(rows) {
    var grouped = {};
    rows.forEach(function (r) {
      if (!grouped[r.date]) grouped[r.date] = { date: r.date, total: 0, count: 0, shifts: [] };
      grouped[r.date].total += r.total;
      grouped[r.date].count += r.count;
      grouped[r.date].shifts.push(r);
    });
    return Object.keys(grouped).sort(function (a, b) { return b.localeCompare(a); }).map(function (date) {
      grouped[date].shifts.sort(function (a, b) { return a.shift.localeCompare(b.shift); });
      return grouped[date];
    });
  }
  function renderMissedClosures(trs, closures) {
    var groups = groupMissingClosures(missingClosureRows(trs, closures, monthKey(today()))).slice(0, 20);
    $("missedClosuresList").innerHTML = groups.length ? groups.map(function (g) {
      return "<article class='missed-closure-row grouped'>"
        + "<button type='button' class='missed-toggle' data-toggle-missed-closure='" + g.date + "'><b>" + g.date + "</b><span>" + g.shifts.length + " turno(s) pendiente(s) | " + money(g.total) + "</span></button>"
        + (expandedMissingClosures[g.date] ? "<div class='missed-shifts'>" + g.shifts.map(function (r) {
          return "<div class='missed-shift-row'><div><b>" + r.shift + "</b><span>" + shiftTimeLabel(r.shift) + " | " + r.count + " movimiento(s) | " + money(r.total) + "</span></div><button type='button' data-open-missed-closure='" + r.date + "|" + r.shift + "'>Abrir cierre</button></div>";
        }).join("") + "<div class='missed-shift-row combined'><div><b>AM + PM</b><span>Cierre combinado | " + shiftTimeLabel("AMBOS") + " | " + g.count + " movimiento(s) detectado(s) | " + money(g.total) + "</span></div><button type='button' data-open-missed-closure='" + g.date + "|AMBOS'>Cierre combinado</button></div></div>" : "")
        + "</article>";
    }).join("") : empty("No hay cierres completos pendientes este mes");
    document.querySelectorAll("[data-toggle-missed-closure]").forEach(function (btn) {
      btn.onclick = function () {
        expandedMissingClosures[btn.dataset.toggleMissedClosure] = !expandedMissingClosures[btn.dataset.toggleMissedClosure];
        renderMissedClosures(trs, closures);
      };
    });
    document.querySelectorAll("[data-open-missed-closure]").forEach(function (btn) {
      btn.onclick = function () {
        var parts = btn.dataset.openMissedClosure.split("|");
        openClosureFor(parts[0], parts[1] || currentSession.shiftType);
      };
    });
  }
  function openClosureFor(date, shift) {
    if (!isAdmin()) {
      toast("Solo admin/dev puede abrir cierres");
      return;
    }
    setClosureContext(date || today(), "DAY", true);
    audit("CLOSURE_CONTEXT_OPENED", activeClosureDate() + " DAY").then(function () {
      switchTab("Cierres");
      setTimeout(function () { $("closureForm").scrollIntoView({ behavior: isLegacyPerformance() ? "auto" : "smooth", block: "center" }); }, 80);
    });
  }
  function openMissingClosureDay(date) {
    openClosureFor(date, "DAY");
  }
  function updatePartialClosureDiffs() {
    if (!partialClosureSnapshot || !$("partialCashDiff")) return;
    var hasCash = String($("partialCountedCash").value || "").trim() !== "";
    var hasTransfer = String($("partialCountedTransfer").value || "").trim() !== "";
    var cashDiff = parseMoney($("partialCountedCash").value) - partialClosureSnapshot.expectedCash;
    var transferDiff = parseMoney($("partialCountedTransfer").value) - partialClosureSnapshot.expectedTransfer;
    $("partialCashDiff").textContent = hasCash ? money(cashDiff) : "—";
    $("partialTransferDiff").textContent = hasTransfer ? money(transferDiff) : "—";
    $("partialCashDiff").parentNode.classList.toggle("negative", hasCash && cashDiff < 0);
    $("partialCashDiff").parentNode.classList.toggle("positive", hasCash && cashDiff > 0);
    $("partialTransferDiff").parentNode.classList.toggle("negative", hasTransfer && transferDiff < 0);
    $("partialTransferDiff").parentNode.classList.toggle("positive", hasTransfer && transferDiff > 0);
  }
  function closePartialClosureModal() {
    if ($("partialClosureModal")) $("partialClosureModal").classList.add("hidden");
    partialClosureSnapshot = null;
  }
  function openPartialClosureModal() {
    var selectedDate = activeClosureDate();
    if (!selectedDate) { toast("No hay un cierre pendiente seleccionado"); return; }
    if (!canSavePartialClosure(selectedDate)) {
      toast("El control AM -> PM corresponde al turno PM o a un administrador");
      return;
    }
    Promise.all([activeTransactions(), all("closures"), all("sessions"), all("basketItems")]).then(function (data) {
      var trs = data[0];
      var closures = data[1];
      var sessions = data[2];
      var basketItems = data[3];
      if (closureIsComplete(closures, selectedDate, "DAY")) throw new Error("El cierre final de ese dia ya fue guardado");
      if (partialClosureIsSaved(closures, selectedDate)) throw new Error("El control AM -> PM de ese dia ya fue guardado");
      var totals = closureTotals(trs, selectedDate, "AM", closures, sessions);
      totals.itemsSold = closureItemsSold(totals, basketItems);
      totals.businessDate = selectedDate;
      partialClosureSnapshot = totals;
      $("partialClosureForm").reset();
      $("partialCountedCash").value = "";
      $("partialCountedTransfer").value = "";
      $("partialClosureTitle").textContent = "Control de cambio AM -> PM - " + selectedDate;
      $("partialClosureNote").textContent = totals.ticketCount + " venta(s) del turno AM. Registre lo que recibio al comenzar el turno PM.";
      $("partialTotalSales").textContent = money(totals.totalSales);
      $("partialExpectedCash").textContent = money(totals.expectedCash);
      $("partialExpectedTransfer").textContent = money(totals.expectedTransfer);
      $("partialClosureModal").classList.remove("hidden");
      updatePartialClosureDiffs();
      setTimeout(function () { if ($("partialCountedCash")) $("partialCountedCash").focus(); }, 60);
    }).catch(function (err) {
      toast(err && err.message ? err.message : "No se pudo preparar el control de turno");
    });
  }
  function savePartialClosure(e) {
    e.preventDefault();
    if (!partialClosureSnapshot || !partialClosureSnapshot.businessDate) {
      toast("Vuelva a abrir el control AM -> PM");
      return;
    }
    var selectedDate = partialClosureSnapshot.businessDate;
    if (!String($("partialCountedCash").value || "").trim() || !String($("partialCountedTransfer").value || "").trim()) {
      toast("Ingrese el efectivo y el QR controlados");
      return;
    }
    if (!canSavePartialClosure(selectedDate)) {
      toast("El control AM -> PM corresponde al turno PM o a un administrador");
      return;
    }
    var shouldPrint = $("partialClosurePrintToggle") && $("partialClosurePrintToggle").checked;
    var printWindow = shouldPrint ? openReceiptPrintWindow() : null;
    var savedClosure = null;
    Promise.all([activeTransactions(), all("closures"), all("sessions"), all("basketItems")]).then(function (data) {
      var trs = data[0];
      var closures = data[1];
      var sessions = data[2];
      var basketItems = data[3];
      if (closureIsComplete(closures, selectedDate, "DAY")) throw new Error("El cierre final de ese dia ya fue guardado");
      if (partialClosureIsSaved(closures, selectedDate)) throw new Error("El control AM -> PM de ese dia ya fue guardado");
      var totals = closureTotals(trs, selectedDate, "AM", closures, sessions);
      var countedCash = parseMoney($("partialCountedCash").value);
      var countedTransfer = parseMoney($("partialCountedTransfer").value);
      savedClosure = {
        id: uid(), businessDate: selectedDate, shiftType: "AM", handoffToShift: "PM", closureKind: "PARTIAL",
        expectedCash: totals.expectedCash, countedCash: countedCash, differenceCash: countedCash - totals.expectedCash,
        expectedTransfer: totals.expectedTransfer, countedTransfer: countedTransfer, differenceTransfer: countedTransfer - totals.expectedTransfer,
        pendingTransfers: totals.pendingTransfers, reviewTransfers: totals.reviewTransfers,
        totalSales: totals.totalSales, totalWithdrawals: totals.withdrawals,
        ticketCount: totals.ticketCount, itemsSold: closureItemsSold(totals, basketItems),
        largestTicket: totals.largestTicket, averageTicket: totals.averageTicket,
        notes: $("partialClosureNotes").value.trim(),
        createdBy: currentUser.id, createdByName: currentUser.displayName || currentUser.username, createdAt: nowIso()
      };
      return add("closures", savedClosure);
    }).then(function () {
      if (shouldPrint) printClosureTicket(savedClosure, printWindow);
      return audit("SHIFT_HANDOFF_CLOSED", selectedDate + " AM -> PM");
    }).then(function () {
      closePartialClosureModal();
      renderAll();
      toast("Control AM -> PM guardado");
    }).catch(function (err) {
      if (printWindow && !printWindow.closed) printWindow.close();
      toast(err && err.message ? err.message : "No se pudo guardar el control de turno");
    });
  }
  function saveClosure(e) {
    e.preventDefault();
    if (!isAdmin()) {
      toast("El cierre final solo puede ser completado por un administrador");
      return;
    }
    if (!closureDate) {
      toast("No hay cierres pendientes");
      return;
    }
    var selectedDate = activeClosureDate();
    if (!String($("countedCash").value || "").trim() || !String($("countedTransfer").value || "").trim()) {
      toast("Ingrese el efectivo y el QR controlados");
      return;
    }
    var shouldPrint = $("closurePrintToggle") && $("closurePrintToggle").checked;
    var printWindow = shouldPrint ? openReceiptPrintWindow() : null;
    var savedClosure = null;
    Promise.all([activeTransactions(), all("closures"), all("sessions"), all("basketItems")]).then(function (data) {
      var trs = data[0];
      var closures = data[1];
      var sessions = data[2];
      var basketItems = data[3];
      if (closureIsComplete(closures, selectedDate, "DAY")) {
        if (printWindow && !printWindow.closed) printWindow.close();
        toast("El cierre de ese dia ya fue guardado");
        return Promise.reject(new Error("Cierre duplicado"));
      }
      var totals = closureTotals(trs, selectedDate, "DAY", closures, sessions);
      var itemsSold = closureItemsSold(totals, basketItems);
      var countedCash = parseMoney($("countedCash").value);
      var countedTransfer = parseMoney($("countedTransfer").value);
      var differenceCash = countedCash - totals.expectedCash;
      var differenceTransfer = countedTransfer - totals.expectedTransfer;
      var notes = $("closureNotes").value.trim();
      var handoffControl = closureHandoffSnapshot(relatedPartialClosure(closures, selectedDate));
      savedClosure = {
        id: uid(), businessDate: selectedDate, shiftType: "DAY",
        expectedCash: totals.expectedCash, countedCash: countedCash, differenceCash: differenceCash,
        expectedTransfer: totals.expectedTransfer, countedTransfer: countedTransfer, differenceTransfer: differenceTransfer,
        pendingTransfers: totals.pendingTransfers, reviewTransfers: totals.reviewTransfers,
        totalSales: totals.totalSales, totalWithdrawals: totals.withdrawals, notes: notes, closureKind: "COMPLETE",
        ticketCount: totals.ticketCount, itemsSold: itemsSold, largestTicket: totals.largestTicket, averageTicket: totals.averageTicket,
        openingCash: closureOpeningCash(sessions, selectedDate, "DAY"), cashSales: totals.cashSales, qrSales: totals.receivedTransfers,
        handoffControl: handoffControl,
        createdBy: currentUser.id, createdByName: currentUser.displayName || currentUser.username, createdAt: nowIso()
      };
      return add("closures", savedClosure);
    }).then(function (saved) {
      if (!saved) return;
      if (shouldPrint) printClosureTicket(savedClosure, printWindow);
      return audit("DAY_CLOSED", selectedDate + " DAY");
    }).then(function () {
      setClosureContext(today(), "DAY", true);
      renderAll();
      toast("Cierre diario guardado");
    }).catch(function (err) {
      if (printWindow && !printWindow.closed && err && err.message !== "Cierre duplicado") printWindow.close();
      if (err && err.message !== "Cierre duplicado") toast("No se pudo guardar el cierre");
    });
  }

  function balanceMonthLabel(m) {
    var parts = String(m || monthKey(today())).split("-").map(Number);
    var date = new Date(parts[0], Math.max(0, parts[1] - 1), 1);
    return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  }
  function shiftBalanceMonth(delta) {
    if (!isAdmin() || !$("monthPicker")) return;
    var parts = String($("monthPicker").value || monthKey(today())).split("-").map(Number);
    var date = new Date(parts[0], parts[1] - 1 + Number(delta || 0), 1);
    $("monthPicker").value = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
    selectedBalanceDay = "";
    expandedBalanceEntries = {};
    renderMonthly();
  }
  function renderMonthly() {
    if (!isAdmin()) {
      switchTab("Caja");
      return;
    }
    var m = $("monthPicker").value || monthKey(today());
    if ($("monthPicker").value !== m) $("monthPicker").value = m;
    if (monthKey(selectedBalanceDay) !== m) selectedBalanceDay = "";
    Promise.all([activeTransactions(), all("closures"), all("monthlyEntries"), all("basketItems"), all("weatherDaily")]).then(function (data) {
      var trs = data[0].filter(function (t) { return monthKey(inferredBusinessDate(t)) === m; });
      var closures = data[1].filter(function (c) { return monthKey(c.businessDate) === m; });
      var entries = monthlyEntriesForMonth(data[2], m).sort(function (a, b) { return b.date.localeCompare(a.date); });
      var completedClosures = closures.filter(function (c) { return (c.closureKind || "COMPLETE") === "COMPLETE"; });
      var missingClosures = missingClosureRows(trs, closures, m);
      var scopedTrs = selectedBalanceDay ? trs.filter(function (t) { return inferredBusinessDate(t) === selectedBalanceDay; }) : trs;
      var scopedEntries = selectedBalanceDay ? entries.filter(function (e) { return e.date === selectedBalanceDay; }) : entries;
      var scopedClosures = selectedBalanceDay ? completedClosures.filter(function (c) { return c.businessDate === selectedBalanceDay; }) : completedClosures;
      var scopedMissing = selectedBalanceDay ? missingClosures.filter(function (c) { return c.date === selectedBalanceDay; }) : missingClosures;
      var sales = scopedTrs.filter(function (t) { return t.type === "SALE"; });
      var totalSales = sum(sales, function () { return true; });
      var cash = sales.reduce(function (total, sale) { return total + salePaymentParts(sale).cash; }, 0);
      var qr = sales.reduce(function (total, sale) { return total + (isSplitPayment(sale.paymentMethod) || digitalPaymentSettled(sale) ? salePaymentParts(sale).qr : 0); }, 0);
      var withdrawals = sum(scopedTrs, function (t) { return t.type === "WITHDRAWAL"; });
      var expenses = sum(scopedEntries, function (e) { return e.type !== "RECURRING_RULE"; });
      var operatingResult = totalSales - expenses - withdrawals;
      var discrepancyNet = scopedClosures.reduce(function (total, c) {
        return total + Number(c.differenceCash || 0) + Number(c.differenceTransfer || 0);
      }, 0);
      var discrepancyCount = scopedClosures.filter(function (c) {
        return Math.abs(Number(c.differenceCash || 0)) >= 0.01 || Math.abs(Number(c.differenceTransfer || 0)) >= 0.01;
      }).length;
      var salesDays = {};
      sales.forEach(function (sale) { salesDays[inferredBusinessDate(sale)] = true; });
      var scopeTitle = selectedBalanceDay ? "Dia " + selectedBalanceDay : balanceMonthLabel(m);
      if ($("balanceScopeLabel")) $("balanceScopeLabel").textContent = selectedBalanceDay ? "Viendo " + selectedBalanceDay : "Resumen de " + balanceMonthLabel(m);
      if ($("clearBalanceDayBtn")) $("clearBalanceDayBtn").classList.toggle("hidden", !selectedBalanceDay);
      if ($("balanceHistoryTitle")) $("balanceHistoryTitle").textContent = selectedBalanceDay ? "Movimientos del " + selectedBalanceDay : "Movimientos de " + balanceMonthLabel(m);
      if ($("balanceHistoryNote")) $("balanceHistoryNote").textContent = selectedBalanceDay
        ? "Detalle del dia seleccionado."
        : "Gastos, cierres y controles que requieren atencion.";
      $("monthlySummary").innerHTML = "<article class='balance-kpi primary'><span>Ventas · " + escapeHtml(scopeTitle) + "</span><b>" + money(totalSales) + "</b><small>" + sales.length + " tickets registrados</small></article>"
        + "<article class='balance-kpi " + (operatingResult < 0 ? "danger" : "positive") + "'><span>Resultado operativo</span><b>" + money(operatingResult) + "</b><small>Ventas - gastos - retiros</small></article>"
        + "<article class='balance-kpi expense'><span>Gastos</span><b>" + money(expenses) + "</b><small>" + scopedEntries.length + " movimientos</small></article>"
        + "<article class='balance-kpi " + (discrepancyCount || scopedMissing.length ? "danger" : "neutral") + "'><span>Diferencia de cierres</span><b>" + money(discrepancyNet) + "</b><small>" + discrepancyCount + " con diferencia · " + scopedMissing.length + " pendientes</small></article>";
      $("monthlyReport").innerHTML = "<div><span>Efectivo</span><b>" + money(cash) + "</b></div>"
        + "<div><span>QR</span><b>" + money(qr) + "</b></div>"
        + "<div><span>Ticket promedio</span><b>" + money(sales.length ? totalSales / sales.length : 0) + "</b></div>"
        + "<div><span>Dias con ventas</span><b>" + Object.keys(salesDays).length + "</b></div>"
        + "<div><span>Cierres completos</span><b>" + scopedClosures.length + "</b></div>"
        + "<div class='" + (scopedMissing.length ? "attention" : "") + "'><span>Cierres pendientes</span><b>" + scopedMissing.length + "</b></div>";
      renderBalanceCalendar(m, trs, entries, completedClosures, missingClosures, data[4]);
      renderMonthlyEntryList(entries, completedClosures, missingClosures, closures);
      renderBalanceRecurringRules(data[2]);
      renderBalanceWeeklyInsights(data[0], data[2], data[3], m);
    });
  }
  function uniqueDays(entries) {
    var seen = {};
    entries.forEach(function (e) { seen[e.date] = true; });
    return Object.keys(seen);
  }
  function monthlyEntriesForMonth(entries, m) {
    var out = entries.filter(function (e) { return e.type !== "RECURRING_RULE" && monthKey(e.date) === m; }).slice();
    entries.filter(function (e) { return e.type === "RECURRING_RULE"; }).forEach(function (rule) {
      var start = rule.date || m + "-01";
      var days = daysInMonth(m);
      for (var d = 1; d <= days; d++) {
        var date = m + "-" + String(d).padStart(2, "0");
        if (date < start) continue;
        if (new Date(date + "T12:00:00").getDay() !== Number(rule.weekday)) continue;
        out.push({
          id: rule.id + "-" + date, sourceId: rule.id, generated: true, type: "EXPENSE", date: date,
          amount: rule.amount, category: rule.category, description: rule.description || "Gasto fijo",
          paymentMethod: rule.paymentMethod, photoData: rule.photoData
        });
      }
    });
    return out;
  }
  function daysInMonth(m) {
    var parts = m.split("-").map(Number);
    return new Date(parts[0], parts[1], 0).getDate();
  }
  function renderBalanceCalendar(m, trs, entries, closures, missingClosures, weatherRows) {
    var days = daysInMonth(m);
    var html = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map(function (d) {
      return "<div class='balance-weekday'>" + d + "</div>";
    }).join("");
    var currentDate = today();
    var firstDay = new Date(m + "-01T12:00:00").getDay();
    var blanks = firstDay === 0 ? 6 : firstDay - 1;
    for (var blank = 0; blank < blanks; blank++) html += "<div class='balance-day blank'></div>";
    for (var d = 1; d <= days; d++) {
      var date = m + "-" + String(d).padStart(2, "0");
      var dayTrs = trs.filter(function (t) { return inferredBusinessDate(t) === date; });
      var dayEntries = entries.filter(function (e) { return e.date === date; });
      var dayClosures = closures.filter(function (c) { return c.businessDate === date; });
      var dayWeather = (weatherRows || []).filter(function (row) { return row.date === date; })[0] || null;
      var dayMissing = (missingClosures || []).filter(function (r) { return r.date === date; });
      var sales = sum(dayTrs, function (t) { return t.type === "SALE"; });
      var withdrawals = sum(dayTrs, function (t) { return t.type === "WITHDRAWAL"; });
      var expenses = sum(dayEntries, function () { return true; });
      var balance = sales - expenses - withdrawals;
      var hasInput = sales || expenses || withdrawals || dayClosures.length;
      var closureBadge = dayClosures.length
        ? "<i class='closed' title='Cierre completo'>OK</i>"
        : dayMissing.length ? "<i class='pending' title='Cierre pendiente'>!</i>" : "";
      var weatherBadge = dayWeather ? "<i class='balance-weather-badge' title='" + escapeHtml(dayWeather.description + " · " + (dayWeather.temperatureBand || "") + " · promedio " + formatQuantity(dayWeather.temperatureAverage != null ? dayWeather.temperatureAverage : (Number(dayWeather.temperatureMin || 0) + Number(dayWeather.temperatureMax || 0)) / 2) + "° · mediana " + formatQuantity(dayWeather.temperatureMedian != null ? dayWeather.temperatureMedian : (Number(dayWeather.temperatureMin || 0) + Number(dayWeather.temperatureMax || 0)) / 2) + "° · " + Number(dayWeather.rainHours && dayWeather.rainHours.length || 0) + " h con lluvia") + "'>" + weatherSymbol(dayWeather.conditionGroup) + "</i>" : "";
      html += "<article class='balance-day " + (hasInput ? (balance >= 0 ? "positive" : "negative") : "empty-day") + (date === currentDate ? " today" : "") + (selectedBalanceDay === date ? " selected" : "") + (dayMissing.length ? " missing-closure" : "") + "' data-balance-day='" + date + "' tabindex='0' role='button' aria-label='Ver balance del " + date + "'>"
        + "<b><span>" + d + "</span>" + (date === currentDate ? " <em>Hoy</em>" : "") + weatherBadge + closureBadge + "</b>"
        + "<span>Ventas <strong>" + money(sales) + "</strong></span>"
        + "<span>Gastos " + money(expenses) + (withdrawals ? " · Retiros " + money(withdrawals) : "") + "</span>"
        + "<strong class='balance-day-result'>" + (hasInput ? money(balance) : "Sin actividad") + "</strong>"
        + "</article>";
    }
    $("balanceCalendar").innerHTML = html;
    document.querySelectorAll("[data-balance-day]").forEach(function (day) {
      function selectDay() {
        selectedBalanceDay = selectedBalanceDay === day.dataset.balanceDay ? "" : day.dataset.balanceDay;
        expandedBalanceEntries = {};
        renderMonthly();
        setTimeout(function () { $("monthlyEntries").scrollIntoView({ behavior: isLegacyPerformance() ? "auto" : "smooth", block: "center" }); }, 80);
      }
      day.onclick = selectDay;
      day.onkeydown = function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectDay();
        }
      };
      day.oncontextmenu = function (e) {
        e.preventDefault();
        selectedBalanceDay = "";
        expandedBalanceEntries = {};
        renderMonthly();
        setTimeout(function () { $("monthlyEntries").scrollIntoView({ behavior: isLegacyPerformance() ? "auto" : "smooth", block: "center" }); }, 80);
      };
    });
  }
  function renderMonthlyEntryList(entries, closures, missingClosures, allMonthClosures) {
    var filter = $("balanceEntryFilter") ? $("balanceEntryFilter").value || balanceEntryFilter : balanceEntryFilter;
    balanceEntryFilter = filter;
    var visibleEntries = selectedBalanceDay ? entries.filter(function (e) { return e.date === selectedBalanceDay; }) : entries;
    var visibleClosures = selectedBalanceDay ? closures.filter(function (c) { return c.businessDate === selectedBalanceDay; }) : closures;
    var visibleMissing = selectedBalanceDay ? (missingClosures || []).filter(function (c) { return c.date === selectedBalanceDay; }) : (missingClosures || []);
    var expenseItems = visibleEntries.map(function (e) {
      var key = "expense-" + (e.id || e.sourceId || e.date) + "-" + e.date;
      var expanded = Boolean(expandedBalanceEntries[key]);
      var detail = expanded ? "<div class='balance-entry-detail'><div><span>Fecha</span><b>" + e.date + "</b></div><div><span>Metodo</span><b>" + escapeHtml(e.paymentMethod || "-") + "</b></div><div><span>Tipo</span><b>" + (e.generated ? "Gasto fijo" : "Gasto cargado") + "</b></div>"
        + "<p>" + escapeHtml(e.description || "Sin descripcion") + "</p>"
        + (e.photoData ? "<img src='" + escapeHtml(e.photoData) + "' alt='Comprobante del gasto'>" : "<small>Sin comprobante adjunto</small>") + "</div>" : "";
      return {
        kind: "expense", mismatch: false, date: e.date, key: key,
        html: "<article class='balance-entry expense-row " + (e.generated ? "generated" : "") + "'>"
          + "<div class='balance-entry-date'><b>" + e.date.slice(8, 10) + "</b><span>" + e.date.slice(5, 7) + "/" + e.date.slice(0, 4) + "</span></div>"
          + "<div class='balance-entry-main'><b>" + escapeHtml(e.category || "Gasto general") + "</b><span>" + escapeHtml(e.paymentMethod || "-") + (e.generated ? " · Fijo automatico" : "") + "</span></div>"
          + "<strong class='balance-entry-amount negative'>- " + money(e.amount) + "</strong>"
          + "<div class='balance-entry-actions'><button type='button' class='balance-detail-button' data-balance-detail='" + escapeHtml(key) + "'>" + (expanded ? "Ocultar" : "Detalle") + "</button><button type='button' class='balance-delete-button' data-balance-delete='" + escapeHtml(e.sourceId || e.id) + "'>Borrar</button></div>"
          + detail + "</article>"
      };
    });
    var closureItems = visibleClosures.map(function (c) {
      var key = "closure-" + (c.id || c.businessDate);
      var expanded = Boolean(expandedBalanceEntries[key]);
      var mismatch = Math.abs(Number(c.differenceCash || 0)) >= 0.01 || Math.abs(Number(c.differenceTransfer || 0)) >= 0.01;
      var handoff = c.handoffControl && c.handoffControl.performed
        ? c.handoffControl
        : closureHandoffSnapshot(relatedPartialClosure(allMonthClosures, c.businessDate));
      var printable = Object.assign({}, c, { handoffControl: handoff });
      var detail = expanded ? "<div class='balance-entry-detail closure-detail'>"
        + "<div><span>Efectivo esperado</span><b>" + money(c.expectedCash) + "</b></div><div><span>Efectivo contado</span><b>" + money(c.countedCash) + "</b></div><div class='" + (Number(c.differenceCash || 0) ? "attention" : "") + "'><span>Diferencia efectivo</span><b>" + money(c.differenceCash) + "</b></div>"
        + "<div><span>QR esperado</span><b>" + money(c.expectedTransfer) + "</b></div><div><span>QR contado</span><b>" + money(c.countedTransfer) + "</b></div><div class='" + (Number(c.differenceTransfer || 0) ? "attention" : "") + "'><span>Diferencia QR</span><b>" + money(c.differenceTransfer) + "</b></div>"
        + "<div><span>Control AM -> PM</span><b>" + (handoff.performed ? "Realizado" : "No realizado") + "</b></div><div><span>Tickets</span><b>" + Number(c.ticketCount || 0) + "</b></div><div><span>Retiros</span><b>" + money(c.totalWithdrawals || 0) + "</b></div>"
        + (c.notes ? "<p>Observacion: " + escapeHtml(c.notes) + "</p>" : "") + "</div>" : "";
      return {
        kind: "closure", mismatch: mismatch, date: c.businessDate, key: key, printable: printable,
        html: "<article class='balance-entry closure-complete " + (mismatch ? "has-discrepancy" : "") + "'>"
          + "<div class='balance-entry-date'><b>" + c.businessDate.slice(8, 10) + "</b><span>" + c.businessDate.slice(5, 7) + "/" + c.businessDate.slice(0, 4) + "</span></div>"
          + "<div class='balance-entry-main'><b>Cierre diario</b><span>" + (mismatch ? "Revisar diferencia" : "Sin diferencias") + " · AM/PM " + (handoff.performed ? "realizado" : "no realizado") + "</span></div>"
          + "<strong class='balance-entry-amount'>" + money(c.totalSales) + "</strong>"
          + "<div class='balance-entry-actions'><button type='button' class='balance-detail-button' data-balance-detail='" + escapeHtml(key) + "'>" + (expanded ? "Ocultar" : "Detalle") + "</button><button type='button' data-balance-print-closure='" + escapeHtml(c.id) + "'>Ticket</button></div>"
          + detail + "</article>"
      };
    });
    var pendingItems = visibleMissing.map(function (row) {
      return {
        kind: "pending", mismatch: true, date: row.date, key: "pending-" + row.date,
        html: "<article class='balance-entry pending-closure-entry'><div class='balance-entry-date'><b>" + row.date.slice(8, 10) + "</b><span>" + row.date.slice(5, 7) + "/" + row.date.slice(0, 4) + "</span></div><div class='balance-entry-main'><b>Cierre pendiente</b><span>" + Number(row.count || 0) + " movimientos · " + money(row.total || 0) + "</span></div><strong class='balance-entry-alert'>ATENCION</strong><button type='button' data-balance-open-closure='" + row.date + "'>Abrir cierre</button></article>"
      };
    });
    var items = expenseItems.concat(closureItems, pendingItems).filter(function (item) {
      if (filter === "expenses") return item.kind === "expense";
      if (filter === "closures") return item.kind === "closure" || item.kind === "pending";
      if (filter === "discrepancies") return item.mismatch;
      return true;
    }).sort(function (a, b) {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      var priority = { pending: 0, closure: 1, expense: 2 };
      return priority[a.kind] - priority[b.kind];
    });
    $("monthlyEntries").innerHTML = items.length ? items.map(function (x) { return x.html; }).join("") : empty(selectedBalanceDay ? "Sin movimientos para este dia y filtro" : "Sin movimientos para este filtro");
    document.querySelectorAll("[data-balance-detail]").forEach(function (button) {
      button.onclick = function () {
        var key = button.dataset.balanceDetail;
        expandedBalanceEntries[key] = !expandedBalanceEntries[key];
        renderMonthly();
      };
    });
    document.querySelectorAll("[data-balance-open-closure]").forEach(function (button) {
      button.onclick = function () { openClosureFor(button.dataset.balanceOpenClosure, "DAY"); };
    });
    document.querySelectorAll("[data-balance-print-closure]").forEach(function (button) {
      button.onclick = function () {
        var item = closureItems.filter(function (row) { return row.printable && row.printable.id === button.dataset.balancePrintClosure; })[0];
        if (item) printClosureTicket(item.printable);
      };
    });
    document.querySelectorAll("[data-balance-delete]").forEach(function (button) {
      button.onclick = function () { deleteBalanceEntry(button.dataset.balanceDelete); };
    });
  }
  function deleteBalanceEntry(id) {
    if (!isAdmin() || !id) return;
    all("monthlyEntries").then(function (entries) {
      var entry = entries.filter(function (row) { return row.id === id; })[0];
      if (!entry) { toast("El gasto ya no existe"); return; }
      var recurring = entry.type === "RECURRING_RULE";
      var automatic = entry.sourceType === "PURCHASE";
      var message = recurring
        ? "¿Borrar este gasto recurrente y todas sus apariciones futuras?"
        : automatic ? "¿Borrar el gasto asociado a esta compra? La compra y el stock no se modificaran."
          : "¿Borrar este gasto de " + money(entry.amount) + "?";
      if (!confirm(message)) return;
      del("monthlyEntries", entry.id).then(function () {
        return audit("BALANCE_EXPENSE_DELETED", (recurring ? "Regla recurrente | " : automatic ? "Compra vinculada | " : "") + (entry.category || "Gasto") + " | " + money(entry.amount), automatic ? "warning" : "normal");
      }).then(function () {
        renderMonthly();
        toast(recurring ? "Gasto recurrente eliminado" : "Gasto eliminado");
      });
    });
  }
  function renderBalanceRecurringRules(entries) {
    if (!$("balanceRecurringRules")) return;
    var rules = (entries || []).filter(function (entry) { return entry.type === "RECURRING_RULE"; }).sort(function (a, b) { return String(a.category || "").localeCompare(String(b.category || "")); });
    $("balanceRecurringRules").innerHTML = rules.length
      ? "<h3>Gastos recurrentes activos</h3>" + rules.map(function (rule) {
        return "<div><span><b>" + escapeHtml(rule.category || "Gasto fijo") + "</b><small>" + money(rule.amount) + " · " + escapeHtml(rule.description || "Semanal") + "</small></span><button type='button' data-balance-delete='" + escapeHtml(rule.id) + "'>Borrar</button></div>";
      }).join("") : "";
    $("balanceRecurringRules").querySelectorAll("[data-balance-delete]").forEach(function (button) { button.onclick = function () { deleteBalanceEntry(button.dataset.balanceDelete); }; });
  }
  function balanceWeekStart(dateKey) {
    var date = metricsDateFromKey(dateKey);
    return localDateKey(metricsShiftDate(date, -((date.getDay() + 6) % 7)));
  }
  function balanceWeekLabel(startKey) {
    return startKey.slice(8, 10) + "/" + startKey.slice(5, 7) + " al " + localDateKey(metricsShiftDate(metricsDateFromKey(startKey), 6)).slice(8, 10) + "/" + localDateKey(metricsShiftDate(metricsDateFromKey(startKey), 6)).slice(5, 7);
  }
  function renderBalanceWeeklyInsights(transactions, rawEntries, basketItems, selectedMonth) {
    var host = $("balanceWeeklyInsights");
    if (!host) return;
    var itemByBasket = {};
    (basketItems || []).forEach(function (item) { (itemByBasket[item.basketId] = itemByBasket[item.basketId] || []).push(item); });
    var weeks = {};
    function week(key) { return weeks[key] || (weeks[key] = { key: key, sales: 0, tickets: 0, withdrawals: 0, expenses: 0, knownRevenue: 0, knownCost: 0 }); }
    (transactions || []).forEach(function (transaction) {
      var date = inferredBusinessDate(transaction);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      var row = week(balanceWeekStart(date));
      if (transaction.type === "SALE") {
        row.sales += Number(transaction.amount || 0); row.tickets += 1;
        (itemByBasket[transaction.basketId] || []).forEach(function (item) {
          var snapshot = metricsBasketCostSnapshot(item), quantity = Math.max(0, Number(item.quantity || 0));
          var ratio = quantity > 0 ? Math.min(1, snapshot.knownQuantity / quantity) : 0;
          var itemSubtotal = (itemByBasket[transaction.basketId] || []).reduce(function (total, line) { return total + Number(line.subtotal || 0); }, 0);
          var revenue = itemSubtotal > 0 ? Number(transaction.amount || 0) * Number(item.subtotal || 0) / itemSubtotal : 0;
          row.knownRevenue += revenue * ratio; row.knownCost += snapshot.knownCostAmount;
        });
      } else if (transaction.type === "WITHDRAWAL") row.withdrawals += Number(transaction.amount || 0);
    });
    (rawEntries || []).filter(function (entry) { return entry.type !== "RECURRING_RULE"; }).forEach(function (entry) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(entry.date || "")) week(balanceWeekStart(entry.date)).expenses += Number(entry.amount || 0);
    });
    var recurringRules = (rawEntries || []).filter(function (entry) { return entry.type === "RECURRING_RULE"; });
    var earliest = Object.keys(weeks).sort()[0] || selectedMonth + "-01";
    var cursor = metricsDateFromKey(earliest), last = metricsDateFromKey(today()), safety = 0;
    recurringRules.forEach(function (rule) {
      cursor = metricsDateFromKey(rule.date || earliest); safety = 0;
      while (cursor <= last && safety++ < 1100) {
        if (cursor.getDay() === Number(rule.weekday)) week(balanceWeekStart(localDateKey(cursor))).expenses += Number(rule.amount || 0);
        cursor = metricsShiftDate(cursor, 1);
      }
    });
    var referenceDate = selectedBalanceDay || (selectedMonth === monthKey(today()) ? today() : selectedMonth + "-" + String(daysInMonth(selectedMonth)).padStart(2, "0"));
    var referenceKey = balanceWeekStart(referenceDate);
    var current = week(referenceKey);
    var history = Object.keys(weeks).map(function (key) { var row = weeks[key]; row.profit = row.knownRevenue - row.knownCost; row.result = row.sales - row.expenses - row.withdrawals; return row; }).filter(function (row) { return row.sales || row.expenses || row.withdrawals; }).sort(function (a, b) { return a.key.localeCompare(b.key); });
    var prior = history.filter(function (row) { return row.key < referenceKey; }).pop() || null;
    function best(field, lowest) { return history.slice().sort(function (a, b) { return lowest ? a[field] - b[field] : b[field] - a[field]; })[0] || null; }
    var currentResult = current.sales - current.expenses - current.withdrawals;
    var delta = prior ? metricGrowth(currentResult, prior.result) : metricNoComparison("Sin semana anterior");
    function recordCard(title, row, field, formatter) { return "<div><span>" + title + "</span><b>" + (row ? formatter(row[field]) : "—") + "</b><small>" + (row ? balanceWeekLabel(row.key) : "Sin historial") + "</small></div>"; }
    host.innerHTML = "<div class='balance-weekly-head'><div><h2>Balance semanal</h2><p>" + balanceWeekLabel(referenceKey) + " · compara contra semanas guardadas</p></div><strong class='" + delta.tone + "'>" + money(currentResult) + " <small>" + escapeHtml(delta.label) + "</small></strong></div>"
      + "<div class='balance-weekly-current'><span>Ventas <b>" + money(current.sales) + "</b></span><span>Gastos <b>" + money(current.expenses) + "</b></span><span>Retiros <b>" + money(current.withdrawals) + "</b></span><span>Tickets <b>" + current.tickets + "</b></span><span>Ganancia cubierta <b>" + (current.knownRevenue ? money(current.knownRevenue - current.knownCost) : "Sin costos") + "</b></span></div>"
      + "<div class='balance-weekly-records'>"
      + recordCard("Mayor venta", best("sales", false), "sales", money)
      + recordCard("Menor venta", best("sales", true), "sales", money)
      + recordCard("Mayor ganancia cubierta", best("profit", false), "profit", money)
      + recordCard("Mas tickets", best("tickets", false), "tickets", function (value) { return String(value); }) + "</div>";
  }
  function saveMonthly(e) {
    e.preventDefault();
    var amount = parseMoney($("monthlyAmount").value);
    if (amount <= 0) { toast("Ingrese monto"); return; }
    var recurring = $("monthlyRecurring").checked;
    add("monthlyEntries", {
      id: uid(), type: recurring ? "RECURRING_RULE" : "EXPENSE", date: $("monthlyDate").value || today(), amount: amount,
      category: $("monthlyCategory").value.trim() || "General", description: $("monthlyDescription").value.trim(),
      paymentMethod: $("monthlyPayment").value, recurring: recurring, weekday: Number($("monthlyWeekday").value),
      photoData: monthlyPhotoData, productionItemId: $("monthlyProductionId").value || "", productionGroupKey: $("monthlyProductionId").dataset.groupKey || "", createdBy: currentUser.id, createdAt: nowIso()
    }).then(function () {
      return audit("BALANCE_EXPENSE_CREATED", (recurring ? "Fijo " : "") + money(amount) + " " + $("monthlyCategory").value);
    }).then(function () {
      $("monthlyForm").reset();
      $("monthlyProductionId").value = "";
      $("monthlyProductionId").dataset.groupKey = "";
      monthlyPhotoData = "";
      $("monthlyDate").value = today();
      if ($("monthlyWeekdayWrap")) $("monthlyWeekdayWrap").classList.add("hidden");
      if ($("balanceExpensePanel")) $("balanceExpensePanel").open = false;
      renderMonthly();
      toast("Gasto guardado");
    });
  }

  function isManualSaleItem(item) {
    var productId = String(item && item.productId || "");
    return !!(item && (item.manualItem || item.source === "manual-item" || productId === "custom" || productId.indexOf("manual:") === 0));
  }
  function buildManualReviewGroups(items, transactions) {
    var saleByBasket = {};
    (transactions || []).forEach(function (transaction) {
      if (transaction.type === "SALE" && !transaction.deleted && transaction.basketId) saleByBasket[transaction.basketId] = transaction;
    });
    var groupsByDescription = {};
    (items || []).forEach(function (item) {
      var sale = saleByBasket[item.basketId];
      var status = String(item.manualReviewStatus || "pending").toLowerCase();
      if (!sale || !isManualSaleItem(item) || status === "registered" || status === "dismissed") return;
      var description = String(item.productName || item.description || "Item manual").trim() || "Item manual";
      var key = normalizeProductSearch(description) || ("manual-" + item.id);
      if (!groupsByDescription[key]) groupsByDescription[key] = {
        key: key,
        name: description,
        items: [],
        saleCount: 0,
        units: 0,
        total: 0,
        latestAt: "",
        latestBusinessDate: "",
        suggestedPrice: 0
      };
      var group = groupsByDescription[key];
      group.items.push(item);
      group.saleCount += 1;
      group.units += Number(item.quantity || 1);
      group.total += Number(item.subtotal == null ? item.unitPrice || 0 : item.subtotal);
      if (!group.latestAt || String(sale.createdAt || "") > group.latestAt) {
        group.name = description;
        group.latestAt = sale.createdAt || "";
        group.latestBusinessDate = sale.businessDate || inferredBusinessDate(sale);
        group.suggestedPrice = Number(item.unitPrice || item.subtotal || 0);
      }
    });
    return Object.keys(groupsByDescription).map(function (key) { return groupsByDescription[key]; }).sort(function (a, b) {
      return String(b.latestAt || "").localeCompare(String(a.latestAt || ""));
    });
  }
  function filteredManualReviewGroups(groups) {
    var query = normalizeProductSearch($("stockSearchInput") && $("stockSearchInput").value);
    return (groups || []).filter(function (group) {
      return !query || normalizeProductSearch(group.name).indexOf(query) >= 0;
    });
  }
  function renderManualReviewRow(group, index) {
    var latest = group.latestBusinessDate || (group.latestAt ? localDateKey(new Date(group.latestAt)) : "Sin fecha");
    var saleLabel = group.saleCount === 1 ? "1 registro manual" : group.saleCount + " registros manuales";
    return "<article class='manual-review-row'>"
      + "<div class='manual-review-icon' aria-hidden='true'>!</div>"
      + "<div class='manual-review-main'><b>" + escapeHtml(group.name) + "</b><small>" + escapeHtml(saleLabel) + " &middot; " + escapeHtml(String(group.units)) + " unidades &middot; ultima: " + escapeHtml(latest) + "</small><span>Item vendido sin ficha de stock</span></div>"
      + "<strong>" + money(group.total) + "<small>total vendido</small></strong>"
      + "<button type='button' class='success' data-manual-review-register='" + index + "'>Crear producto</button>"
      + "</article>";
  }
  function openManualReviewRegistration(index) {
    var group = manualReviewGroups[Number(index)];
    if (!group || !group.items.length) return;
    pendingManualReviewItem = group;
    openProductForm(null);
    if ($("productFormTitle")) $("productFormTitle").textContent = "Registrar item manual";
    if ($("editProductName")) $("editProductName").value = group.name;
    if ($("editProductPrice") && group.suggestedPrice > 0) $("editProductPrice").value = String(group.suggestedPrice);
    if ($("editProductStock")) $("editProductStock").value = "0";
  }
  function resolveManualReviewGroup(group, product) {
    if (!group || !product) return Promise.resolve();
    return Promise.all(group.items.map(function (source) {
      var item = Object.assign({}, source, {
        manualReviewStatus: "registered",
        manualReviewProductId: product.id,
        resolvedProductId: product.id,
        stockAppliedQuantity: 0,
        manualItem: true,
        source: source.source || "manual-item",
        manualReviewedAt: nowIso(),
        manualReviewedBy: currentUser && currentUser.id || ""
      });
      return add("basketItems", item);
    })).then(function () {
      return audit("MANUAL_ITEM_REGISTERED", group.name + " | " + group.items.length + " registro(s) | producto " + product.id, "normal");
    });
  }

  function priceReviewNumber(review, names) {
    for (var i = 0; i < names.length; i++) {
      var value = Number(review && review[names[i]]);
      if (isFinite(value)) return value;
    }
    return 0;
  }
  function priceReviewNullableNumber(review, names) {
    for (var i = 0; i < names.length; i++) {
      var raw = review && review[names[i]];
      if (raw === undefined || raw === null || raw === "") continue;
      var value = Number(raw);
      if (isFinite(value)) return value;
    }
    return null;
  }
  function priceReviewStatus(review) {
    var status = String(review && review.status || "PENDING").toUpperCase();
    return ["PENDING", "APPROVED", "KEPT", "SUPERSEDED", "CANCELLED"].indexOf(status) >= 0 ? status : "CANCELLED";
  }
  function priceReviewStatusLabel(status) {
    return status === "APPROVED" ? "Precio aprobado" : status === "KEPT" ? "Precio mantenido" : status === "SUPERSEDED" ? "Reemplazada" : status === "CANCELLED" ? "Cancelada" : "Pendiente";
  }
  function enrichPriceReviews(reviews, products) {
    var productById = {};
    (products || []).forEach(function (product) { productById[product.id] = product; });
    return (reviews || []).map(function (source) {
      var review = Object.assign({}, source);
      review.product = productById[review.productId] || null;
      review.productName = review.productName || review.product && review.product.name || "Producto sin nombre";
      return review;
    }).sort(function (a, b) {
      var pendingOrder = (priceReviewStatus(a) === "PENDING" ? 0 : 1) - (priceReviewStatus(b) === "PENDING" ? 0 : 1);
      return pendingOrder || String(b.createdAt || b.actionAt || "").localeCompare(String(a.createdAt || a.actionAt || ""));
    });
  }
  function filteredPriceReviewRows(rows) {
    var query = normalizeProductSearch($("stockSearchInput") && $("stockSearchInput").value);
    var requestedStatus = String(stockQuickFilter || "PENDING").toUpperCase();
    return (rows || []).filter(function (review) {
      var status = priceReviewStatus(review);
      if (requestedStatus === "CANCELLED_GROUP" && ["SUPERSEDED", "CANCELLED"].indexOf(status) < 0) return false;
      if (requestedStatus !== "ALL" && requestedStatus !== "CANCELLED_GROUP" && status !== requestedStatus) return false;
      return !query || normalizeProductSearch([review.productName, review.supplierName, review.invoiceNumber].join(" ")).indexOf(query) >= 0;
    });
  }
  function renderPriceReviewRow(review, index) {
    var status = priceReviewStatus(review);
    var oldCost = priceReviewNullableNumber(review, ["previousCostPerSaleUnit", "oldCostPerSaleUnit"]);
    var newCost = priceReviewNullableNumber(review, ["newCostPerSaleUnit", "latestCostPerSaleUnit"]);
    var currentPrice = priceReviewNumber(review, ["currentPrice", "previousPrice"]);
    if (!currentPrice && review.product) currentPrice = Number(review.product.price || 0);
    var suggested = priceReviewNullableNumber(review, ["suggestedPrice", "proposedPrice"]);
    var markup = priceReviewNullableNumber(review, ["targetMarkupPct", "markupPct"]);
    var costChange = oldCost != null && oldCost > 0 && newCost != null ? (newCost - oldCost) / oldCost * 100 : null;
    var priceDifference = suggested == null ? null : suggested - currentPrice;
    var margin = suggested != null && suggested > 0 && newCost != null ? (suggested - newCost) / suggested * 100 : null;
    var unit = review.product && (review.product.unitType || review.product.priceUnit) || review.saleUnit || "unidad";
    var action = status === "PENDING"
      ? "<div class='price-review-actions'><button type='button' class='success' data-price-review-approve='" + index + "' " + (suggested != null && suggested > 0 ? "" : "disabled title='Defina un markup o edite el precio'") + ">Aprobar sugerido</button><button type='button' data-price-review-edit='" + index + "'>Editar precio</button><button type='button' data-price-review-keep='" + index + "'>Mantener actual</button></div>"
      : "<div class='price-review-resolution'><b>" + escapeHtml(priceReviewStatusLabel(status)) + "</b><small>" + escapeHtml(String(review.actionAt || review.approvedAt || review.keptAt || review.cancelledAt || "").slice(0, 16).replace("T", " ")) + (review.actionNote ? " · " + escapeHtml(review.actionNote) : "") + "</small></div>";
    return "<article class='price-review-row " + status.toLowerCase() + "'>"
      + "<div class='price-review-main'><span class='price-review-status " + status.toLowerCase() + "'>" + escapeHtml(priceReviewStatusLabel(status)) + "</span><b>" + escapeHtml(review.productName) + "</b><small>" + escapeHtml(review.supplierName || "Actualizacion de costo") + (review.invoiceNumber ? " · Fact. " + escapeHtml(review.invoiceNumber) : "") + "</small></div>"
      + "<div class='price-review-cost'><span>Costo anterior</span><b>" + (oldCost != null ? moneyCost(oldCost) : "Desconocido") + "</b><small>Nuevo: " + (newCost != null ? moneyCost(newCost) + " / " + escapeHtml(unit) : "desconocido") + (costChange == null ? " · sin base" : " · " + (costChange >= 0 ? "+" : "") + percentValue(costChange)) + "</small></div>"
      + "<div class='price-review-price'><span>Venta actual</span><b>" + moneyCost(currentPrice) + "</b><small>" + (suggested == null ? "Definir markup o precio" : "Sugerido: " + moneyCost(suggested) + " · " + (priceDifference >= 0 ? "+" : "−") + moneyCost(Math.abs(priceDifference)).replace("$ ", "$")) + "</small></div>"
      + "<div class='price-review-rates'><span>Markup objetivo <b>" + (markup == null ? "Sin objetivo" : percentValue(markup)) + "</b></span><span>Margen sugerido <b>" + percentValue(margin) + "</b></span></div>"
      + action + "</article>";
  }
  function priceReviewSummaryHtml(review) {
    var oldCost = priceReviewNullableNumber(review, ["previousCostPerSaleUnit", "oldCostPerSaleUnit"]);
    var newCost = priceReviewNullableNumber(review, ["newCostPerSaleUnit", "latestCostPerSaleUnit"]);
    var currentPrice = priceReviewNumber(review, ["currentPrice", "previousPrice"]);
    if (!currentPrice && review.product) currentPrice = Number(review.product.price || 0);
    var suggested = priceReviewNullableNumber(review, ["suggestedPrice", "proposedPrice"]);
    var markup = priceReviewNullableNumber(review, ["targetMarkupPct", "markupPct"]);
    return "<div class='price-review-modal-product'><b>" + escapeHtml(review.productName || review.product && review.product.name || "Producto") + "</b><small>" + escapeHtml(review.supplierName || "Actualizacion de costo") + "</small></div>"
      + "<div class='price-review-modal-grid'><div><span>Costo anterior</span><b>" + (oldCost != null ? moneyCost(oldCost) : "Desconocido") + "</b></div><div><span>Nuevo costo</span><b>" + (newCost != null ? moneyCost(newCost) : "Desconocido") + "</b></div><div><span>Precio actual</span><b>" + moneyCost(currentPrice) + "</b></div><div><span>Sugerido</span><b>" + (suggested == null ? "Definir markup o precio" : moneyCost(suggested)) + "</b></div><div><span>Markup objetivo</span><b>" + (markup == null ? "Sin objetivo" : percentValue(markup)) + "</b></div><div><span>Margen sugerido</span><b>" + (suggested != null && suggested > 0 && newCost != null ? percentValue((suggested - newCost) / suggested * 100) : "—") + "</b></div></div>";
  }
  function openPriceReviewModal(review, useSuggested) {
    if (!isAdmin() || !review || priceReviewStatus(review) !== "PENDING") return;
    activePriceReview = review;
    $("priceReviewId").value = review.id;
    $("priceReviewTitle").textContent = "Revisar precio · " + (review.productName || "Producto");
    $("priceReviewSummary").innerHTML = priceReviewSummaryHtml(review);
    var value = priceReviewNullableNumber(review, useSuggested ? ["suggestedPrice", "proposedPrice", "currentPrice"] : ["proposedPrice", "suggestedPrice", "currentPrice"]);
    $("priceReviewProposedPrice").value = value > 0 ? String(moneyPrecision(value)) : "";
    $("priceReviewModal").classList.remove("hidden");
    setTimeout(function () { $("priceReviewProposedPrice").focus(); $("priceReviewProposedPrice").select(); }, 0);
  }
  function closePriceReviewModal() {
    if ($("priceReviewModal")) $("priceReviewModal").classList.add("hidden");
    activePriceReview = null;
  }
  function commitPriceReviewAction(review, status, approvedPrice) {
    if (!isAdmin() || !review || priceReviewStatus(review) !== "PENDING") return Promise.reject(new Error("La revision ya fue resuelta"));
    status = String(status || "").toUpperCase();
    approvedPrice = moneyPrecision(Number(approvedPrice || 0));
    if (["APPROVED", "KEPT"].indexOf(status) < 0) return Promise.reject(new Error("Accion de revision invalida"));
    if (status === "APPROVED" && (!isFinite(approvedPrice) || approvedPrice <= 0)) return Promise.reject(new Error("Ingrese un precio valido"));
    return dbPromise.then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(["products", "priceReviews", "priceHistory", "auditLog"], "readwrite");
        var productStore = transaction.objectStore("products");
        var reviewStore = transaction.objectStore("priceReviews");
        var storedReview = null, product = null, pending = 2, updatedReview = null;
        var abortMessage = "";
        function cancel(message) {
          abortMessage = message;
          try { transaction.abort(); } catch (_error) {}
        }
        function stageWrites() {
          if (pending || updatedReview) return;
          if (!storedReview || priceReviewStatus(storedReview) !== "PENDING") { cancel("La revision ya fue resuelta en otra ventana"); return; }
          if (!product || product.active === false) { cancel("El producto ya no esta disponible"); return; }
          var previousPrice = Number(product.price || 0);
          var actionAt = nowIso();
          updatedReview = Object.assign({}, storedReview, {
            status: status,
            proposedPrice: status === "APPROVED" ? approvedPrice : previousPrice,
            approvedPrice: status === "APPROVED" ? approvedPrice : null,
            actionAt: actionAt,
            actionBy: currentUser && currentUser.id || "",
            actionNote: status === "APPROVED" ? "Precio aprobado por administrador" : "Se mantiene el precio actual"
          });
          delete updatedReview.product;
          if (status === "APPROVED") {
            updatedReview.approvedAt = actionAt;
            updatedReview.approvedBy = updatedReview.actionBy;
            product.price = approvedPrice;
            product.updatedAt = actionAt;
            productStore.put(product);
            transaction.objectStore("priceHistory").put({
              id: uid(), productId: product.id, productName: product.name || storedReview.productName || "Producto",
              previousPrice: previousPrice, newPrice: approvedPrice, changeType: "REVIEW_APPROVED",
              sourcePriceReviewId: storedReview.id, sourcePurchaseId: storedReview.sourcePurchaseId || "", reason: "Aprobacion de revision de precio",
              createdAt: actionAt, createdBy: updatedReview.actionBy
            });
          } else {
            updatedReview.keptAt = actionAt;
            updatedReview.keptBy = updatedReview.actionBy;
          }
          reviewStore.put(updatedReview);
          transaction.objectStore("auditLog").put({
            id: uid(), createdAt: actionAt, userId: currentUser && currentUser.id, username: currentUser && currentUser.username,
            action: status === "APPROVED" ? "PRICE_REVIEW_APPROVED" : "PRICE_REVIEW_KEPT",
            detail: (product.name || storedReview.productName || "Producto") + " | " + (status === "APPROVED" ? money(previousPrice) + " -> " + money(approvedPrice) : "se mantiene " + money(previousPrice)),
            severity: "warning"
          });
        }
        var reviewRequest = reviewStore.get(review.id);
        reviewRequest.onsuccess = function () { storedReview = reviewRequest.result || null; pending -= 1; stageWrites(); };
        reviewRequest.onerror = function () { cancel("No se pudo releer la revision"); };
        var productRequest = productStore.get(review.productId);
        productRequest.onsuccess = function () { product = productRequest.result || null; pending -= 1; stageWrites(); };
        productRequest.onerror = function () { cancel("No se pudo releer el producto"); };
        transaction.oncomplete = function () {
          invalidateProductSearchCache();
          if (diskSnapshotWritesEnabled && !diskSnapshotPaused) scheduleDiskSnapshot();
          resolve(updatedReview);
        };
        transaction.onerror = function () { reject(transaction.error || new Error(abortMessage || "No se pudo guardar la revision")); };
        transaction.onabort = function () { reject(transaction.error || new Error(abortMessage || "La revision fue cancelada")); };
      });
    });
  }
  function approvePriceReview(review, price) {
    price = Number(price || 0);
    if (!review || price <= 0) { toast("Ingrese un precio valido"); return; }
    if (!confirm("Aprobar " + moneyCost(price) + " como nuevo precio de venta? El cambio se vera inmediatamente en Caja.")) return;
    commitPriceReviewAction(review, "APPROVED", price).then(function () {
      closePriceReviewModal();
      renderProducts();
      renderProduction();
      toast("Precio aprobado y actualizado en Caja");
    }).catch(function (error) { toast(error.message || "No se pudo aprobar el precio"); });
  }
  function keepPriceReview(review) {
    if (!review || !confirm("Mantener el precio actual y cerrar esta revision?")) return;
    commitPriceReviewAction(review, "KEPT", 0).then(function () {
      closePriceReviewModal();
      renderProduction();
      toast("Precio actual mantenido");
    }).catch(function (error) { toast(error.message || "No se pudo cerrar la revision"); });
  }

  function stockInventoryValues(products) {
    var stockedProducts = (products || []).filter(function (product) {
      return product.active !== false && Number(product.stock || 0) > 0;
    });
    return stockedProducts.reduce(function (summary, product) {
      var stock = Math.max(0, Number(product.stock || 0));
      var pools = productCostPools(product);
      var knownQuantity = Math.min(stock, Math.max(0, Number(pools.known || 0)));
      var knownValue = Math.max(0, Number(pools.value || 0));
      if (knownQuantity > 0 && pools.known > 0 && knownValue > 0) {
        summary.knownCostValue += knownValue * (knownQuantity / pools.known);
        summary.costedProducts += 1;
      }
      var price = Math.max(0, Number(product.price || 0));
      if (price > 0) {
        summary.retailValue += stock * price;
        summary.pricedProducts += 1;
      }
      return summary;
    }, { totalProducts: stockedProducts.length, knownCostValue: 0, retailValue: 0, costedProducts: 0, pricedProducts: 0 });
  }
  function renderStockValueDashboard(products) {
    if (!$('stockValueDashboard')) return;
    var values = stockInventoryValues(products);
    $('stockKnownCostValue').textContent = money(values.knownCostValue);
    $('stockRetailValue').textContent = money(values.retailValue);
    $('stockKnownCostCoverage').textContent = values.totalProducts
      ? values.costedProducts + ' de ' + values.totalProducts + ' productos con costo real'
      : 'Sin productos con stock';
    $('stockRetailCoverage').textContent = values.totalProducts
      ? values.pricedProducts + ' de ' + values.totalProducts + ' productos con precio'
      : 'Sin productos con stock';
  }

  function renderProduction() {
    if (!isAdmin()) return;
    if (stockViewMode === "prices" && !stockQuickFilter) stockQuickFilter = "PENDING";
    Promise.all([all("products"), all("masterProducts"), all("basketItems"), all("transactions"), allIfAvailable("priceReviews"), allIfAvailable("priceHistory")]).then(function (sets) {
      var products = sets[0];
      var masterProducts = sets[1];
      var validBasketIds = {};
      sets[3].forEach(function (transaction) {
        if (transaction.type === "SALE" && !transaction.deleted && transaction.basketId) validBasketIds[transaction.basketId] = true;
      });
      stockSoldStats = {};
      sets[2].forEach(function (item) {
        if (!validBasketIds[item.basketId] || !item.productId) return;
        stockSoldStats[item.productId] = Number(stockSoldStats[item.productId] || 0) + Number(item.quantity || 0);
      });
      products.forEach(function (product) {
        if (product.masterProductId) stockSoldStats[product.masterProductId] = Number(stockSoldStats[product.masterProductId] || 0) + Number(stockSoldStats[product.id] || 0);
      });
      manualReviewGroups = buildManualReviewGroups(sets[2], sets[3]);
      if ($("manualReviewCount")) $("manualReviewCount").textContent = manualReviewGroups.length ? String(manualReviewGroups.length) : "";
      priceReviewRows = enrichPriceReviews(sets[4], products);
      var pendingPriceReviewCount = priceReviewRows.filter(function (review) { return priceReviewStatus(review) === "PENDING"; }).length;
      if ($("priceReviewCount")) $("priceReviewCount").textContent = pendingPriceReviewCount ? String(pendingPriceReviewCount) : "";
      loadStockSearchStats();
      editorProducts = products.slice();
      var sourceRows = stockViewMode === "master" ? masterProducts : products;
      renderStockCategoryOptions(sourceRows);
      populateProductCategorySelects(products.concat(masterProducts));
      var filtered = stockViewMode === "manual" ? filteredManualReviewGroups(manualReviewGroups) : stockViewMode === "prices" ? filteredPriceReviewRows(priceReviewRows) : filteredStockProducts(sourceRows, stockViewMode);
      var activeProducts = products.filter(function (p) { return p.active !== false; });
      renderStockValueDashboard(activeProducts);
      var summaryProducts = stockViewMode === "deleted" ? products.filter(function (p) { return p.active === false; }) : activeProducts;
      var lowStock = summaryProducts.filter(isLowStockProduct).length;
      var noPrice = summaryProducts.filter(function (p) { return Number(p.price || 0) <= 0; }).length;
      var noCode = summaryProducts.filter(function (p) { return !normalizeBarcode(p.barcode); }).length;
      if ($("stockSummary")) {
        if (stockViewMode === "prices") {
          var approvedReviews = priceReviewRows.filter(function (review) { return priceReviewStatus(review) === "APPROVED"; }).length;
          var keptReviews = priceReviewRows.filter(function (review) { return priceReviewStatus(review) === "KEPT"; }).length;
          var cancelledReviews = priceReviewRows.filter(function (review) { return ["SUPERSEDED", "CANCELLED"].indexOf(priceReviewStatus(review)) >= 0; }).length;
          $("stockSummary").innerHTML = stockSummaryButtons([
            ["Pendientes", pendingPriceReviewCount],
            ["Aprobados", approvedReviews],
            ["Precio mantenido", keptReviews],
            ["Canceladas/reemplazadas", cancelledReviews],
            ["Historial total", priceReviewRows.length]
          ], ["PENDING", "APPROVED", "KEPT", "CANCELLED_GROUP", "ALL"]);
        } else if (stockViewMode === "manual") {
          var manualSales = manualReviewGroups.reduce(function (sum, group) { return sum + group.saleCount; }, 0);
          var manualTotal = manualReviewGroups.reduce(function (sum, group) { return sum + group.total; }, 0);
          var manualToday = manualReviewGroups.filter(function (group) { return group.latestBusinessDate === today(); }).length;
          $("stockSummary").innerHTML = [
            ["Por registrar", manualReviewGroups.length],
            ["Registros detectados", manualSales],
            ["Aparecieron hoy", manualToday],
            ["Importe registrado", money(manualTotal)]
          ].map(function (item) { return "<div class='summary-item stock-static-summary'><span>" + escapeHtml(item[0]) + "</span><b>" + escapeHtml(String(item[1])) + "</b></div>"; }).join("");
        } else if (stockViewMode === "master") {
          $("stockSummary").innerHTML = stockSummaryButtons([
            ["Total planilla", masterProducts.length],
            ["Con existencia", masterProducts.filter(function (p) { return Number(p.masterStock || 0) > 0; }).length],
            ["Sin precio", masterProducts.filter(function (p) { return Number(p.price || 0) <= 0; }).length],
            ["Sin codigo", masterProducts.filter(function (p) { return !normalizeBarcode(p.barcode); }).length]
          ], ["", "inStock", "noPrice", "noCode"]);
        } else {
          $("stockSummary").innerHTML = stockSummaryButtons([
            [stockViewMode === "deleted" ? "Bajas" : "En tienda", summaryProducts.length],
            ["Stock bajo", lowStock],
            ["Sin precio", noPrice],
            ["Sin codigo", noCode]
          ], ["", "low", "noPrice", "noCode"]);
        }
        document.querySelectorAll("[data-stock-summary-filter]").forEach(function (button) {
          button.onclick = function () {
            stockQuickFilter = button.dataset.stockSummaryFilter || "";
            renderProduction();
          };
        });
      }
      updateStockViewUi();
      if (stockViewMode === "prices") {
        $("productionList").innerHTML = filtered.length ? filtered.map(function (review) {
          return renderPriceReviewRow(review, priceReviewRows.indexOf(review));
        }).join("") : empty(priceReviewRows.length ? "No hay revisiones con este filtro" : "No hay revisiones de precios todavia");
      } else if (stockViewMode === "manual") {
        $("productionList").innerHTML = filtered.length ? filtered.map(function (group) {
          return renderManualReviewRow(group, manualReviewGroups.indexOf(group));
        }).join("") : empty(manualReviewGroups.length ? "Ningun item manual coincide con la busqueda" : "No hay items manuales pendientes de registrar");
      } else {
        $("productionList").innerHTML = filtered.length ? filtered.map(function (product) {
          var storeMatch = stockViewMode === "master" ? products.filter(function (p) {
            return p.masterProductId === product.id || (p.inventoryId && p.inventoryId === product.inventoryId);
          })[0] : null;
          return renderStockProductRow(product, stockViewMode, storeMatch);
        }).join("") : empty("No hay productos para esos filtros");
      }
      document.querySelectorAll("[data-manual-review-register]").forEach(function (btn) {
        btn.onclick = function () { openManualReviewRegistration(btn.dataset.manualReviewRegister); };
      });
      document.querySelectorAll("[data-price-review-approve]").forEach(function (button) {
        button.onclick = function () {
          var review = priceReviewRows[Number(button.dataset.priceReviewApprove)];
          var suggested = priceReviewNullableNumber(review, ["suggestedPrice", "proposedPrice"]);
          if (suggested == null || suggested <= 0) { toast("Defina un markup o edite el precio"); return; }
          approvePriceReview(review, suggested);
        };
      });
      document.querySelectorAll("[data-price-review-edit]").forEach(function (button) {
        button.onclick = function () { openPriceReviewModal(priceReviewRows[Number(button.dataset.priceReviewEdit)], false); };
      });
      document.querySelectorAll("[data-price-review-keep]").forEach(function (button) {
        button.onclick = function () { keepPriceReview(priceReviewRows[Number(button.dataset.priceReviewKeep)]); };
      });
      document.querySelectorAll("[data-stock-select]").forEach(function (checkbox) {
        checkbox.onchange = function () {
          var key = checkbox.dataset.stockSelect;
          if (checkbox.checked) selectedStockProducts[key] = true;
          else delete selectedStockProducts[key];
          syncStockLabelSelectionUi();
        };
      });
      syncStockLabelSelectionUi();
      document.querySelectorAll("[data-stock-edit]").forEach(function (btn) {
        btn.onclick = function () {
          var p = products.filter(function (x) { return x.id === btn.dataset.stockEdit; })[0];
          if (!p) return;
          rememberStockSearch(p.id, $("stockSearchInput") && $("stockSearchInput").value);
          openProductForm(p);
        };
      });
      document.querySelectorAll("[data-stock-delete]").forEach(function (btn) {
        btn.onclick = function () {
          var p = products.filter(function (x) { return x.id === btn.dataset.stockDelete; })[0];
          deleteProduct(p);
        };
      });
      document.querySelectorAll("[data-stock-restore]").forEach(function (btn) {
        btn.onclick = function () {
          var p = products.filter(function (x) { return x.id === btn.dataset.stockRestore; })[0];
          if (!p) return;
          p.active = true;
          p.updatedAt = nowIso();
          add("products", p).then(function () {
            invalidateProductSearchCache();
            audit("PRODUCT_RESTORED", p.name, "normal");
            renderProduction();
            toast("Producto restaurado");
          });
        };
      });
      document.querySelectorAll("[data-master-load]").forEach(function (btn) {
        btn.onclick = function () {
          var source = masterProducts.filter(function (p) { return p.id === btn.dataset.masterLoad; })[0];
          if (source) loadMasterProductIntoStore(source);
        };
      });
      document.querySelectorAll("[data-master-edit]").forEach(function (btn) {
        btn.onclick = function () {
          var product = products.filter(function (p) { return p.id === btn.dataset.masterEdit; })[0];
          if (product) openProductForm(product);
        };
      });
    });
  }
  function normalizeSpreadsheetHeader(value) {
    return String(value == null ? "" : value).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }
  function spreadsheetText(value) {
    if (value == null) return "";
    if (typeof value === "number") {
      if (!isFinite(value)) return "";
      return Number.isInteger(value) ? String(value) : String(value);
    }
    return String(value).trim();
  }
  function spreadsheetNumber(value) {
    if (typeof value === "number") return isFinite(value) ? value : 0;
    return parseMoney(value);
  }
  function spreadsheetBoolean(value, defaultValue) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    var normalized = normalizeSpreadsheetHeader(value);
    if (!normalized) return defaultValue;
    if (["false", "falso", "no", "inactivo", "baja", "0"].indexOf(normalized) >= 0) return false;
    if (["true", "verdadero", "si", "activo", "1"].indexOf(normalized) >= 0) return true;
    return defaultValue;
  }
  function normalizeSpreadsheetUnit(value) {
    var unit = normalizeSpreadsheetHeader(value);
    if (!unit) return "unidad";
    if (["m", "mtr", "mtrs", "metro", "metros"].indexOf(unit) >= 0) return "m";
    if (["kg", "kilo", "kilos", "kilogramo", "kilogramos"].indexOf(unit) >= 0) return "kg";
    if (["gr", "g", "gramo", "gramos"].indexOf(unit) >= 0) return "gr";
    if (["u", "un", "unidad", "unidades"].indexOf(unit) >= 0) return "unidad";
    if (["paq", "paquete", "paquetes", "pack"].indexOf(unit) >= 0) return "paquete";
    return unit;
  }
  function spreadsheetHeaderIndex(headerRow) {
    var aliases = {
      inventoryId: ["id", "sku", "codigo interno", "cod interno", "id producto"],
      category: ["categoria", "rubro", "familia"],
      brand: ["marca", "fabricante"],
      name: ["nombre", "nombre completo", "descripcion"],
      product: ["producto", "articulo"],
      variant: ["variante", "presentacion"],
      stock: ["stock", "existencia", "cantidad", "stock total"],
      minStock: ["stock min", "stock minimo", "minimo", "punto reposicion"],
      unitType: ["unidad", "unidad venta", "unidad de venta", "tipo unidad"],
      price: ["precio", "precio venta", "precio unitario", "pvp"],
      priceUnit: ["unidad precio", "precio por"],
      barcode: ["codigo", "codigo de barras", "cod barras", "barcode", "ean", "upc"],
      location: ["ubicacion", "estante", "pasillo"],
      active: ["activo", "activa", "habilitado", "en venta"],
      notes: ["notas", "observaciones", "comentarios"],
      modified: ["ult modificacion", "ultima modificacion", "modificado", "fecha modificacion"],
      cost: ["costo", "precio costo", "costo unitario"],
      appId: ["id app"]
    };
    var normalized = (headerRow || []).map(normalizeSpreadsheetHeader);
    var result = {};
    Object.keys(aliases).forEach(function (field) {
      result[field] = -1;
      aliases[field].some(function (alias) {
        var index = normalized.indexOf(alias);
        if (index >= 0) { result[field] = index; return true; }
        return false;
      });
    });
    return result;
  }
  function spreadsheetValue(row, header, field) {
    var index = header[field];
    return index == null || index < 0 ? "" : row[index];
  }
  function deterministicProductId(prefix, record) {
    var seed = [record.inventoryId, record.barcode, record.brand, record.product, record.variant, record.unitType].join("|").toLowerCase();
    var hash = 2166136261;
    for (var i = 0; i < seed.length; i++) { hash ^= seed.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    var readable = normalizeSpreadsheetHeader(record.inventoryId || record.product || record.name).replace(/\s+/g, "-").slice(0, 32) || "item";
    return prefix + "-" + readable + "-" + (hash >>> 0).toString(36);
  }
  function findImportSheet(workbook, target) {
    var sheets = workbook && workbook.sheets || [];
    var preferred = target === "store" ? ["en tienda", "en la tienda", "inventario"] : ["en la planilla", "inventario", "stock total"];
    for (var p = 0; p < preferred.length; p++) {
      for (var s = 0; s < sheets.length; s++) if (normalizeSpreadsheetHeader(sheets[s].name) === preferred[p]) return sheets[s];
    }
    for (var i = 0; i < sheets.length; i++) {
      var firstMeaningful = (sheets[i].rows || []).filter(function (row) { return row && row.some(function (cell) { return spreadsheetText(cell); }); })[0];
      var header = spreadsheetHeaderIndex(firstMeaningful || []);
      if (header.stock >= 0 && (header.product >= 0 || header.name >= 0)) return sheets[i];
    }
    return null;
  }
  function parseStockImport(workbook, target) {
    var sheet = findImportSheet(workbook, target);
    if (!sheet) return { sheetName: "", records: [], errors: ["No se encontro una hoja con columnas de inventario."], warnings: [] };
    var rows = sheet.rows || [];
    var headerRowIndex = -1;
    var header = null;
    for (var r = 0; r < Math.min(rows.length, 20); r++) {
      var candidate = spreadsheetHeaderIndex(rows[r] || []);
      if (candidate.stock >= 0 && (candidate.product >= 0 || candidate.name >= 0)) { headerRowIndex = r; header = candidate; break; }
    }
    if (headerRowIndex < 0) return { sheetName: sheet.name, records: [], errors: ["Faltan las columnas Producto (o Nombre) y Stock."], warnings: [] };
    var records = [];
    var errors = [];
    var warnings = [];
    var barcodeRows = {};
    for (var index = headerRowIndex + 1; index < rows.length; index++) {
      var row = rows[index] || [];
      var brand = spreadsheetText(spreadsheetValue(row, header, "brand"));
      var productPart = spreadsheetText(spreadsheetValue(row, header, "product"));
      var variant = spreadsheetText(spreadsheetValue(row, header, "variant"));
      var fullName = spreadsheetText(spreadsheetValue(row, header, "name"));
      if (!fullName) fullName = [brand, productPart, variant].filter(Boolean).join(" ").trim();
      if (!fullName) continue;
      if (!productPart) productPart = fullName;
      var barcode = normalizeBarcode(spreadsheetText(spreadsheetValue(row, header, "barcode")));
      if (barcode) {
        if (barcodeRows[barcode]) errors.push("Codigo repetido " + barcode + " en filas " + barcodeRows[barcode] + " y " + (index + 1) + ".");
        else barcodeRows[barcode] = index + 1;
      }
      var unitType = normalizeSpreadsheetUnit(spreadsheetValue(row, header, "unitType"));
      var priceUnitValue = spreadsheetText(spreadsheetValue(row, header, "priceUnit"));
      var inventoryId = spreadsheetText(spreadsheetValue(row, header, "inventoryId"));
      var record = {
        inventoryId: inventoryId,
        name: fullName,
        brand: brand,
        product: productPart,
        variant: variant,
        category: spreadsheetText(spreadsheetValue(row, header, "category")) || "General",
        stock: Math.max(0, spreadsheetNumber(spreadsheetValue(row, header, "stock")) || 0),
        minStock: Math.max(0, spreadsheetNumber(spreadsheetValue(row, header, "minStock")) || 0),
        unitType: unitType,
        priceUnit: normalizeSpreadsheetUnit(priceUnitValue || unitType),
        price: Math.max(0, spreadsheetNumber(spreadsheetValue(row, header, "price")) || 0),
        cost: Math.max(0, spreadsheetNumber(spreadsheetValue(row, header, "cost")) || 0),
        barcode: barcode,
        location: spreadsheetText(spreadsheetValue(row, header, "location")),
        active: spreadsheetBoolean(spreadsheetValue(row, header, "active"), true),
        notes: spreadsheetText(spreadsheetValue(row, header, "notes")),
        sourceModifiedAt: spreadsheetValue(row, header, "modified") || "",
        importedAppId: spreadsheetText(spreadsheetValue(row, header, "appId")),
        sourceRow: index + 1
      };
      records.push(record);
    }
    if (!records.length) errors.push("La hoja no contiene productos cargados.");
    var idCounts = {};
    records.forEach(function (record) { if (record.inventoryId) idCounts[record.inventoryId] = Number(idCounts[record.inventoryId] || 0) + 1; });
    var duplicateIds = Object.keys(idCounts).filter(function (id) { return idCounts[id] > 1; });
    if (duplicateIds.length) warnings.push("Hay IDs internos repetidos (" + duplicateIds.slice(0, 6).join(", ") + "). Se distinguiran por codigo y nombre.");
    return { sheetName: sheet.name, records: records, errors: errors, warnings: warnings };
  }
  function uniqueRecordMap(records, keyFn) {
    var map = {};
    (records || []).forEach(function (record) {
      var key = keyFn(record);
      if (!key) return;
      if (map[key]) map[key] = null;
      else if (map[key] !== null) map[key] = record;
    });
    return map;
  }
  function productIdentityKey(product) {
    return normalizeProductSearch([product.brand, product.product || product.name, product.variant, product.unitType].join("|"));
  }
  function mergeImportedRecords(importRows, existingRows, target, masterRows) {
    var byBarcode = uniqueRecordMap(existingRows, function (row) { return normalizeBarcode(row.barcode); });
    var byInventoryId = uniqueRecordMap(existingRows, function (row) { return normalizeProductSearch(row.inventoryId); });
    var byIdentity = uniqueRecordMap(existingRows, productIdentityKey);
    var masterByBarcode = uniqueRecordMap(masterRows || [], function (row) { return normalizeBarcode(row.barcode); });
    var masterByInventoryId = uniqueRecordMap(masterRows || [], function (row) { return normalizeProductSearch(row.inventoryId); });
    var created = 0;
    var updated = 0;
    var inventoryMovements = [];
    var records = importRows.map(function (source, index) {
      var existing = (source.barcode && byBarcode[source.barcode]) || (source.inventoryId && byInventoryId[normalizeProductSearch(source.inventoryId)]) || byIdentity[productIdentityKey(source)] || null;
      var appIdMatch = source.importedAppId && existingRows.filter(function (row) { return row.id === source.importedAppId; })[0];
      if (appIdMatch) existing = appIdMatch;
      if (existing) updated += 1; else created += 1;
      var now = nowIso();
      var output = Object.assign({}, existing || {}, source);
      delete output.sourceRow;
      delete output.importedAppId;
      output.id = existing && existing.id || deterministicProductId(target === "master" ? "master" : "store", source);
      output.sortOrder = existing && existing.sortOrder != null ? existing.sortOrder : index;
      output.createdAt = existing && existing.createdAt || now;
      output.updatedAt = now;
      output.imageData = existing && existing.imageData || "";
      if (target === "master") {
        output.masterStock = source.stock;
        output.stock = source.stock;
        output.inStoreDefault = existing ? !!existing.inStoreDefault : false;
      } else {
        var master = (source.barcode && masterByBarcode[source.barcode]) || (source.inventoryId && masterByInventoryId[normalizeProductSearch(source.inventoryId)]) || null;
        output.stock = source.stock;
        output.masterProductId = existing && existing.masterProductId || master && master.id || "";
        var importPools = productCostPools(existing || {}), importDelta = moneyPrecision(Number(source.stock || 0) - Number(existing && existing.stock || 0)), unknownDelta = 0, knownDelta = 0, valueDelta = 0;
        if (importDelta > 0) { importPools.unknown += importDelta; unknownDelta = importDelta; }
        else if (importDelta < 0) { var remove=-importDelta,unknownRemove=Math.min(importPools.unknown,remove);importPools.unknown-=unknownRemove;remove-=unknownRemove;var knownRemove=Math.min(importPools.known,remove),importWac=importPools.known>0?importPools.value/importPools.known:0,valueRemove=knownRemove*importWac;importPools.known-=knownRemove;importPools.value=Math.max(0,importPools.value-valueRemove);unknownDelta=-unknownRemove;knownDelta=-knownRemove;valueDelta=-valueRemove; }
        applyCostPools(output, importPools);
        if (Math.abs(importDelta) > .001) inventoryMovements.push({ id: uid(), type: "STOCK_XLSX_ADJUSTMENT", productId: output.id, quantity: importDelta, knownCostQuantity: moneyPrecision(knownDelta), unknownCostQuantity: moneyPrecision(unknownDelta), knownCostValue: moneyPrecision(valueDelta), referenceType: "STOCK_IMPORT", referenceId: pendingStockImport && pendingStockImport.fileName || "xlsx", createdAt: now, createdBy: currentUser && currentUser.id });
      }
      return output;
    });
    return { records: records, created: created, updated: updated, inventoryMovements: inventoryMovements };
  }
  function writeStoreImportAtomic(records, movements, detail) {
    return dbPromise.then(function (db) { return new Promise(function (resolve, reject) { var transaction=db.transaction(["products","inventoryMovements","auditLog"],"readwrite");records.forEach(function(record){transaction.objectStore("products").put(record);});(movements||[]).forEach(function(movement){transaction.objectStore("inventoryMovements").put(movement);});transaction.objectStore("auditLog").put({id:uid(),createdAt:nowIso(),userId:currentUser&&currentUser.id,username:currentUser&&currentUser.username,action:"STOCK_XLSX_IMPORTED",detail:detail,severity:"warning"});transaction.oncomplete=function(){scheduleDiskSnapshot();resolve(records);};transaction.onerror=function(){reject(transaction.error);};transaction.onabort=function(){reject(transaction.error||new Error("Importacion cancelada"));}; }); });
  }
  function replaceStoreRecordsAtomic(store, records) {
    return dbPromise.then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction([store], "readwrite");
        var objectStore = transaction.objectStore(store);
        objectStore.clear();
        records.forEach(function (record) { objectStore.put(record); });
        transaction.oncomplete = function () { resolve(records); scheduleDiskSnapshot(); };
        transaction.onerror = function () { reject(transaction.error || new Error("No se pudo actualizar el inventario")); };
        transaction.onabort = function () { reject(transaction.error || new Error("Importacion cancelada")); };
      });
    });
  }
  function updateStockImportPreview() {
    if (!pendingStockImport || !$('stockImportPreview')) return;
    var target = $('stockImportTarget').value || "master";
    var parsed = parseStockImport(pendingStockImport.workbook, target);
    pendingStockImport.parsed = parsed;
    var tone = parsed.errors.length ? "error" : "ready";
    var targetText = target === "master" ? "En la planilla" : "En la tienda";
    var note = target === "master" ? "Reemplaza solamente el stock de la planilla. No modifica lo que esta cargado en la tienda." : "Actualiza o agrega productos en la tienda. No borra productos que falten en el archivo.";
    $('stockImportPreview').className = "stock-import-preview " + tone;
    $('stockImportPreview').innerHTML = "<b>" + escapeHtml(pendingStockImport.fileName) + "</b><span>Hoja: " + escapeHtml(parsed.sheetName || "No encontrada") + "</span><strong>" + parsed.records.length + " productos para " + targetText + "</strong><p>" + note + "</p>"
      + parsed.errors.map(function (message) { return "<small class='import-error'>" + escapeHtml(message) + "</small>"; }).join("")
      + parsed.warnings.map(function (message) { return "<small class='import-warning'>" + escapeHtml(message) + "</small>"; }).join("");
    $('applyStockImportBtn').disabled = !!parsed.errors.length;
  }
  function chooseStockWorkbook() {
    if (!isAdmin()) return;
    if (!window.XlsxLite) { toast("El lector XLSX no esta disponible"); return; }
    $('stockXlsxFile').value = "";
    $('stockXlsxFile').click();
  }
  function handleStockWorkbookFile(file) {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name || "")) { toast("Seleccione un archivo .xlsx"); return; }
    toast("Leyendo planilla...");
    window.XlsxLite.read(file).then(function (workbook) {
      pendingStockImport = { fileName: file.name, workbook: workbook, parsed: null };
      $('stockImportTarget').value = "master";
      updateStockImportPreview();
      $('stockImportModal').classList.remove("hidden");
    }).catch(function (error) {
      toast("No se pudo leer el .xlsx: " + (error && error.message || "archivo invalido"));
    });
  }
  function closeStockImportModal() {
    $('stockImportModal').classList.add("hidden");
    pendingStockImport = null;
  }
  function applyStockImport() {
    if (!isAdmin() || !pendingStockImport) return;
    var target = $('stockImportTarget').value || "master";
    var parsed = parseStockImport(pendingStockImport.workbook, target);
    if (parsed.errors.length) { updateStockImportPreview(); return; }
    $('applyStockImportBtn').disabled = true;
    toast("Actualizando stock...");
    Promise.all([all(target === "master" ? "masterProducts" : "products"), all("masterProducts")]).then(function (sets) {
      var merged = mergeImportedRecords(parsed.records, sets[0], target, sets[1]);
      var write = target === "master" ? replaceStoreRecordsAtomic("masterProducts", merged.records) : writeStoreImportAtomic(merged.records, merged.inventoryMovements, "Tienda | " + parsed.records.length + " productos | " + pendingStockImport.fileName);
      return write.then(function () { return merged; });
    }).then(function (merged) {
      invalidateProductSearchCache();
      return (target === "master" ? audit("STOCK_XLSX_IMPORTED", "Planilla | " + parsed.records.length + " productos | " + pendingStockImport.fileName, "normal") : Promise.resolve()).then(function () { return merged; });
    }).then(function (merged) {
      closeStockImportModal();
      stockViewMode = target;
      localStorage.setItem("forrajeriaStockViewMode", target);
      renderProducts();
      renderProduction();
      toast("Planilla cargada: " + merged.created + " nuevos, " + merged.updated + " actualizados");
      writeDiskSnapshot(true);
    }).catch(function (error) {
      $('applyStockImportBtn').disabled = false;
      toast("No se pudo importar: " + (error && error.message || "error local"));
    });
  }
  function stockExportRow(product, master) {
    var productPart = product.product || (!product.brand && !product.variant ? product.name : "");
    return [
      String(product.inventoryId || ""), product.category || "General", product.brand || "", productPart || product.name || "", product.variant || "",
      Number(master ? product.masterStock || 0 : product.stock || 0), Number(product.minStock || 0), product.unitType || "unidad", Number(product.price || 0),
      String(product.barcode || ""), product.location || "", product.active !== false, product.notes || "", product.sourceModifiedAt || product.updatedAt || "",
      product.name || "", product.priceUnit || product.unitType || "unidad", Number(product.cost || 0), String(product.id || "")
    ];
  }
  function exportStockWorkbook() {
    if (!isAdmin()) return;
    if (!window.XlsxLite) { toast("El exportador XLSX no esta disponible"); return; }
    Promise.all([all("products"), all("masterProducts")]).then(function (sets) {
      var products = sets[0].slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
      var masterProducts = sets[1].slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
      var headers = ["ID", "Categoria", "Marca", "Producto", "Variante", "Stock", "Stock Min", "Unidad", "Precio", "Codigo", "Ubicacion", "Activo", "Notas", "Ult. Modificacion", "Nombre", "Unidad Precio", "Costo", "ID App"];
      var summaryRows = [
        ["Stock de La Vieja Esquina", ""],
        ["Exportado", new Date().toLocaleString("es-AR")],
        ["Productos activos en tienda", products.filter(function (p) { return p.active !== false; }).length],
        ["Productos dados de baja", products.filter(function (p) { return p.active === false; }).length],
        ["Productos en la planilla", masterProducts.length],
        ["Uso", "Puede volver a importar este archivo desde la pestana STOCK. La planilla y la tienda se mantienen separadas."]
      ];
      var blob = window.XlsxLite.write([
        { name: "Resumen", rows: summaryRows, widths: [30, 92], decimalColumns: [1] },
        { name: "En tienda", rows: [headers].concat(products.map(function (p) { return stockExportRow(p, false); })), widths: [14, 18, 18, 28, 22, 12, 12, 14, 15, 20, 14, 11, 26, 22, 34, 15, 15, 24], textColumns: [0, 9, 17], currencyColumns: [8, 16], decimalColumns: [5, 6] },
        { name: "En la planilla", rows: [headers].concat(masterProducts.map(function (p) { return stockExportRow(p, true); })), widths: [14, 18, 18, 28, 22, 12, 12, 14, 15, 20, 14, 11, 26, 22, 34, 15, 15, 24], textColumns: [0, 9, 17], currencyColumns: [8, 16], decimalColumns: [5, 6] }
      ]);
      var stamp = new Date();
      var fileName = "Stock-La-Vieja-Esquina-" + localDateKey(stamp) + "-" + String(stamp.getHours()).padStart(2, "0") + String(stamp.getMinutes()).padStart(2, "0") + ".xlsx";
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      audit("STOCK_XLSX_EXPORTED", products.length + " tienda | " + masterProducts.length + " planilla", "normal");
      toast("Stock exportado a " + fileName);
    }).catch(function (error) {
      toast("No se pudo exportar: " + (error && error.message || "error local"));
    });
  }
  function barcodeLabelValidation(value) {
    if (window.ForrajeriaBarcodeLabels && window.ForrajeriaBarcodeLabels.validate) return window.ForrajeriaBarcodeLabels.validate(value);
    var code = normalizeBarcode(value);
    return code ? { ok: true, missing: false, code: code, error: "" } : { ok: false, missing: true, code: "", error: "Sin codigo" };
  }
  function selectedStockCount() {
    return Object.keys(selectedStockProducts).filter(function (key) { return selectedStockProducts[key]; }).length;
  }
  function syncStockLabelSelectionUi() {
    var count = selectedStockCount();
    var selectionMode = stockViewMode === "store" || stockViewMode === "master";
    if ($("stockSelectionStatus")) $("stockSelectionStatus").textContent = count ? count + " seleccionado" + (count === 1 ? "" : "s") : "Seleccione productos";
    if ($("stockSelectionStatus")) $("stockSelectionStatus").classList.toggle("hidden", !selectionMode);
    if ($("stockSelectVisibleBtn")) $("stockSelectVisibleBtn").classList.toggle("hidden", !selectionMode);
    if ($("stockLabelsBtn")) {
      $("stockLabelsBtn").disabled = count === 0;
      $("stockLabelsBtn").textContent = count ? "Etiquetas (" + count + ")" : "Etiquetas";
      $("stockLabelsBtn").classList.toggle("hidden", !selectionMode);
    }
    if ($("stockClearSelectionBtn")) $("stockClearSelectionBtn").classList.toggle("hidden", !selectionMode || count === 0);
  }
  function selectVisibleStockProducts() {
    document.querySelectorAll("[data-stock-select]:not(:disabled)").forEach(function (checkbox) {
      checkbox.checked = true;
      selectedStockProducts[checkbox.dataset.stockSelect] = true;
    });
    syncStockLabelSelectionUi();
  }
  function clearStockProductSelection() {
    selectedStockProducts = {};
    document.querySelectorAll("[data-stock-select]").forEach(function (checkbox) { checkbox.checked = false; });
    syncStockLabelSelectionUi();
  }
  function stockSelectionRecords(products, masterProducts) {
    var storeById = {};
    var masterById = {};
    (products || []).forEach(function (product) { storeById[product.id] = product; });
    (masterProducts || []).forEach(function (product) { masterById[product.id] = product; });
    return Object.keys(selectedStockProducts).filter(function (key) { return selectedStockProducts[key]; }).map(function (key) {
      var divider = key.indexOf("|");
      var store = divider >= 0 ? key.slice(0, divider) : "store";
      var id = divider >= 0 ? key.slice(divider + 1) : key;
      var product = store === "master" ? masterById[id] : storeById[id];
      return product ? { key: key, store: store, product: product } : null;
    }).filter(Boolean);
  }
  function internalBarcodeSeed(product) {
    var source = String(product && (product.inventoryId || product.id || product.name) || uid());
    var hash = 2166136261;
    for (var i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function nextInternalBarcode(product, usedCodes) {
    var seed = internalBarcodeSeed(product);
    var code = "";
    do {
      code = "LVE" + (seed >>> 0).toString(36).toUpperCase().padStart(8, "0").slice(-8);
      seed = (seed + 1) >>> 0;
    } while (usedCodes[code]);
    usedCodes[code] = true;
    return code;
  }
  function linkedMasterForStoreProduct(product, masterProducts) {
    if (!product) return null;
    return (masterProducts || []).filter(function (master) {
      return (product.masterProductId && master.id === product.masterProductId)
        || (!product.masterProductId && product.inventoryId && master.inventoryId === product.inventoryId);
    })[0] || null;
  }
  function linkedStoreForMasterProduct(master, products) {
    if (!master) return null;
    return (products || []).filter(function (product) {
      return product.masterProductId === master.id || (master.inventoryId && product.inventoryId === master.inventoryId);
    })[0] || null;
  }
  function prepareSelectedStockLabels(printWindow) {
    if (!window.ForrajeriaBarcodeLabels) return Promise.reject(new Error("El generador de codigos no esta disponible"));
    return Promise.all([all("products"), all("masterProducts")]).then(function (sets) {
      var products = sets[0];
      var masterProducts = sets[1];
      var records = stockSelectionRecords(products, masterProducts);
      if (!records.length) throw new Error("Seleccione al menos un producto");
      var missing = records.filter(function (record) { return barcodeLabelValidation(record.product.barcode).missing; });
      if (missing.length && !confirm("Se asignaran " + missing.length + " codigo" + (missing.length === 1 ? "" : "s") + " interno" + (missing.length === 1 ? "" : "s") + " LVE de forma permanente. Los codigos existentes no se modificaran. Continuar?")) {
        if (printWindow && !printWindow.closed) printWindow.close();
        throw new Error("Asignacion cancelada");
      }
      var usedCodes = {};
      products.concat(masterProducts).forEach(function (product) {
        var code = normalizeBarcode(product.barcode);
        if (code) usedCodes[code] = true;
      });
      var writes = [];
      var assigned = 0;
      missing.forEach(function (record) {
        var product = record.product;
        var linked = record.store === "master" ? linkedStoreForMasterProduct(product, products) : linkedMasterForStoreProduct(product, masterProducts);
        var linkedCode = linked && normalizeBarcode(linked.barcode);
        var newCode = linkedCode && barcodeLabelValidation(linkedCode).ok ? linkedCode : nextInternalBarcode(product, usedCodes);
        product.barcode = newCode;
        product.updatedAt = nowIso();
        writes.push(add(record.store === "master" ? "masterProducts" : "products", product));
        assigned += 1;
        if (linked && !normalizeBarcode(linked.barcode)) {
          linked.barcode = newCode;
          linked.updatedAt = nowIso();
          writes.push(add(record.store === "master" ? "products" : "masterProducts", linked));
        }
      });
      return Promise.all(writes).then(function () {
        var ready = [];
        var skipped = [];
        records.forEach(function (record) {
          var validation = barcodeLabelValidation(record.product.barcode);
          if (validation.ok) ready.push({ name: record.product.name || "Producto", barcode: validation.code, sourceKey: record.key });
          else skipped.push({ name: record.product.name || "Producto", reason: validation.error || "Codigo invalido" });
        });
        if (!ready.length) throw new Error("Los productos seleccionados no tienen codigos imprimibles");
        var auditPromise = assigned ? audit("STOCK_INTERNAL_BARCODES_ASSIGNED", assigned + " codigo(s) LVE | " + ready.length + " etiqueta(s)", "normal") : Promise.resolve();
        return auditPromise.then(function () {
          if (assigned) {
            invalidateProductSearchCache();
            renderProduction();
          }
          return { ready: ready, skipped: skipped, assigned: assigned };
        });
      });
    });
  }
  function stockLabelPrinterName() {
    var preferred = ticketSettings().printerName;
    if (preferred) return preferred;
    var defaultPrinter = (window.FORRAJERIA_PRINTERS || []).filter(function (printer) { return printer && printer.default; })[0];
    return defaultPrinter && defaultPrinter.name || "Predeterminada de Windows";
  }
  function openStockLabelsModal() {
    if (!isAdmin()) return;
    Promise.all([all("products"), all("masterProducts")]).then(function (sets) {
      var records = stockSelectionRecords(sets[0], sets[1]);
      if (!records.length) { toast("Seleccione al menos un producto"); return; }
      var ready = 0;
      var missing = 0;
      var skipped = [];
      records.forEach(function (record) {
        var validation = barcodeLabelValidation(record.product.barcode);
        if (validation.ok) ready += 1;
        else if (validation.missing) missing += 1;
        else skipped.push(record.product.name + ": " + validation.error);
      });
      if ($("stockLabelsReadyCount")) $("stockLabelsReadyCount").textContent = String(ready);
      if ($("stockLabelsAssignCount")) $("stockLabelsAssignCount").textContent = String(missing);
      if ($("stockLabelsSkippedCount")) $("stockLabelsSkippedCount").textContent = String(skipped.length);
      if ($("stockLabelsPrinter")) $("stockLabelsPrinter").textContent = stockLabelPrinterName();
      if ($("stockLabelsPreview")) {
        $("stockLabelsPreview").innerHTML = records.map(function (record) {
          var validation = barcodeLabelValidation(record.product.barcode);
          var state = validation.ok ? validation.code : validation.missing ? "Se asignara codigo LVE" : validation.error;
          return "<div class='stock-label-preview-row " + (validation.ok || validation.missing ? "ready" : "skipped") + "'><b>" + escapeHtml(record.product.name || "Producto") + "</b><span>" + escapeHtml(state) + "</span></div>";
        }).join("");
      }
      if ($("stockLabelsIssueNote")) {
        $("stockLabelsIssueNote").textContent = skipped.length ? skipped.length + " producto(s) se omitiran por codigo invalido." : missing ? "Los codigos LVE se guardaran en el stock antes de imprimir." : "Todos los codigos estan listos.";
        $("stockLabelsIssueNote").className = "stock-label-issue " + (skipped.length ? "warn" : "ok");
      }
      $("stockLabelsModal").classList.remove("hidden");
    });
  }
  function closeStockLabelsModal() {
    if ($("stockLabelsModal")) $("stockLabelsModal").classList.add("hidden");
  }
  function downloadSelectedStockLabels() {
    prepareSelectedStockLabels().then(function (result) {
      var blob = window.ForrajeriaBarcodeLabels.buildPdf(result.ready);
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "Etiquetas-La-Vieja-Esquina-" + today() + ".pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      audit("STOCK_BARCODE_PDF_CREATED", result.ready.length + " etiqueta(s) | " + result.skipped.length + " omitida(s)", result.skipped.length ? "warning" : "normal");
      closeStockLabelsModal();
      toast(result.ready.length + " etiquetas listas en PDF" + (result.skipped.length ? " (" + result.skipped.length + " omitidas)" : ""));
    }).catch(function (error) {
      if (error && error.message !== "Asignacion cancelada") toast(error && error.message || "No se pudo generar el PDF");
    });
  }
  function printSelectedStockLabels() {
    var printWindow = window.open("", "_blank", "width=500,height=760");
    if (!printWindow) { toast("Permita ventanas emergentes para imprimir"); return; }
    prepareSelectedStockLabels(printWindow).then(function (result) {
      var html = window.ForrajeriaBarcodeLabels.printDocument(result.ready, ticketSettings().businessName || "LA VIEJA ESQUINA");
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(function () { if (!printWindow.closed) { printWindow.focus(); printWindow.print(); } }, 220);
      audit("STOCK_BARCODE_LABELS_PRINT_OPENED", result.ready.length + " etiqueta(s) | " + stockLabelPrinterName() + " | " + result.skipped.length + " omitida(s)", result.skipped.length ? "warning" : "normal");
      closeStockLabelsModal();
      toast("Etiquetas listas para imprimir en " + stockLabelPrinterName() + (result.skipped.length ? "; " + result.skipped.length + " omitidas" : ""));
    }).catch(function (error) {
      if (printWindow && !printWindow.closed) printWindow.close();
      if (error && error.message !== "Asignacion cancelada") toast(error && error.message || "No se pudo imprimir");
    });
  }
  function stockSummaryButtons(items, filters) {
    return items.map(function (item, index) {
      var filter = filters[index] || "";
      var active = stockQuickFilter === filter;
      return "<button type='button' class='summary-item stock-summary-filter" + (active ? " active" : "") + "' data-stock-summary-filter='" + filter + "' aria-pressed='" + (active ? "true" : "false") + "'><span>" + escapeHtml(item[0]) + "</span><b>" + item[1] + "</b></button>";
    }).join("");
  }
  function setStockViewMode(mode) {
    if (["store", "master", "manual", "prices", "deleted"].indexOf(mode) < 0) mode = "store";
    stockViewMode = mode;
    stockQuickFilter = mode === "prices" ? "PENDING" : "";
    localStorage.setItem("forrajeriaStockViewMode", mode);
    renderProduction();
  }
  function updateStockViewUi() {
    document.querySelectorAll("[data-stock-view]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.stockView === stockViewMode);
    });
    if ($("stockAddProductBtn")) $("stockAddProductBtn").classList.toggle("hidden", stockViewMode !== "store");
    if ($("stockBarcodeInput")) $("stockBarcodeInput").disabled = stockViewMode === "master" || stockViewMode === "manual" || stockViewMode === "prices";
    if ($("stockCategoryFilter")) $("stockCategoryFilter").disabled = stockViewMode === "manual" || stockViewMode === "prices";
    if ($("stockSortSelect")) $("stockSortSelect").disabled = stockViewMode === "manual" || stockViewMode === "prices";
    ["stockSelectionStatus", "stockSelectVisibleBtn", "stockClearSelectionBtn", "stockLabelsBtn"].forEach(function (id) {
      if ($(id)) $(id).classList.toggle("hidden", stockViewMode !== "store" && stockViewMode !== "master");
    });
    if ($("stockListTitle")) {
      $("stockListTitle").textContent = stockViewMode === "master" ? "Stock total de la planilla" : stockViewMode === "manual" ? "Items manuales por registrar" : stockViewMode === "prices" ? "Revision de precios" : stockViewMode === "deleted" ? "Items dados de baja" : "Productos en la tienda";
    }
    if ($("stockListDescription")) {
      $("stockListDescription").textContent = stockViewMode === "master"
        ? "Catalogo maestro de la planilla. Cargue aqui solo los articulos que realmente se venden en la tienda."
        : stockViewMode === "manual"
          ? "Descripciones vendidas como item manual que todavia no tienen una ficha de producto."
        : stockViewMode === "prices"
          ? "Los costos nuevos sugieren precios, pero Caja cambia solamente despues de la aprobacion de un admin."
        : stockViewMode === "deleted"
          ? "Items retirados de la venta. Se pueden restaurar sin perder sus datos."
          : "Inventario operativo de la caja. Admin y dev pueden corregir precio, stock, unidad y codigo.";
    }
  }
  function isLowStockProduct(product) {
    var stock = Number(product.stock == null ? product.masterStock || 0 : product.stock);
    var threshold = Number(product.minStock || 0);
    if (threshold <= 0) threshold = 2;
    return stock <= threshold;
  }
  function loadMasterProductIntoStore(source) {
    if (!isAdmin() || !source) return;
    var product = storeProductFromMaster(source);
    all("products").then(function (products) {
      var existing = products.filter(function (p) {
        return p.masterProductId === source.id || (p.inventoryId && p.inventoryId === source.inventoryId);
      })[0];
      if (existing) {
        existing.active = true;
        existing.updatedAt = nowIso();
        return add("products", existing).then(function () { return existing; });
      }
      return add("products", product).then(function () { return product; });
    }).then(function (loaded) {
      invalidateProductSearchCache();
      audit("MASTER_PRODUCT_LOADED", loaded.name, "normal");
      renderProduction();
      toast("Producto cargado en la tienda");
    });
  }
  function renderStockCategoryOptions(products) {
    if (!$("stockCategoryFilter")) return;
    var current = $("stockCategoryFilter").value;
    var seen = {};
    products.forEach(function (p) {
      if (p.category) seen[productCategory(p)] = true;
    });
    $("stockCategoryFilter").innerHTML = "<option value=''>Todas</option>" + Object.keys(seen).sort(function (a, b) { return a.localeCompare(b); }).map(function (cat) {
      return "<option value='" + escapeHtml(cat) + "'>" + escapeHtml(cat) + "</option>";
    }).join("");
    $("stockCategoryFilter").value = current;
  }
  function populateProductCategorySelects(products, preferredCategory) {
    var categories = {};
    (products || []).forEach(function (product) {
      var category = productCategory(product);
      if (category) categories[category] = true;
    });
    if (preferredCategory) categories[preferredCategory] = true;
    if (!Object.keys(categories).length) categories.General = true;
    ["editProductCategory"].forEach(function (id) {
      var select = $(id);
      if (!select) return;
      var current = preferredCategory || select.value || "General";
      if (current) categories[current] = true;
      select.innerHTML = Object.keys(categories).sort(function (a, b) { return a.localeCompare(b); }).map(function (category) {
        return "<option value='" + escapeHtml(category) + "'>" + escapeHtml(category) + "</option>";
      }).join("");
      select.value = current;
      if (!select.value && select.options.length) select.selectedIndex = 0;
    });
  }
  function stockSearchText(product) {
    return normalizeProductSearch([product.name, product.brand, product.product, product.variant, product.category, product.barcode, product.inventoryId, product.location, product.priceUnit, product.unitType].join(" "));
  }
  function productSearchScore(product, query) {
    if (!query) return Number(stockSearchStats[product.id] || 0);
    var q = query.toLowerCase();
    var name = String(product.name || "").toLowerCase();
    var barcode = String(product.barcode || "").toLowerCase();
    var category = String(product.category || "").toLowerCase();
    var score = Number(stockSearchStats[product.id] || 0);
    if (barcode === q) score += 1000;
    if (name === q) score += 800;
    if (name.indexOf(q) === 0) score += 500;
    if (barcode.indexOf(q) === 0) score += 420;
    if (category.indexOf(q) === 0) score += 250;
    if (stockSearchText(product).indexOf(q) >= 0) score += 120;
    return score;
  }
  function filteredStockProducts(products, mode) {
    var query = $("stockSearchInput") ? $("stockSearchInput").value.trim() : "";
    var category = $("stockCategoryFilter") ? $("stockCategoryFilter").value : "";
    var sort = $("stockSortSelect") ? $("stockSortSelect").value : "relevance";
    var rows = products.filter(function (p) {
      if (mode === "store" && p.active === false) return false;
      if (mode === "deleted" && p.active !== false) return false;
      if (category && productCategory(p) !== category) return false;
      if (query && stockSearchText(p).indexOf(normalizeProductSearch(query)) < 0) return false;
      if (stockQuickFilter === "low" && !isLowStockProduct(p)) return false;
      if (stockQuickFilter === "inStock" && Number(p.masterStock || p.stock || 0) <= 0) return false;
      if (stockQuickFilter === "noPrice" && Number(p.price || 0) > 0) return false;
      if (stockQuickFilter === "noCode" && normalizeBarcode(p.barcode)) return false;
      return true;
    });
    rows.sort(function (a, b) {
      if (sort === "name") return String(a.name).localeCompare(String(b.name));
      if (sort === "stockLow") return Number(a.stock || 0) - Number(b.stock || 0) || String(a.name).localeCompare(String(b.name));
      if (sort === "stockHigh") return Number(b.stock || 0) - Number(a.stock || 0) || String(a.name).localeCompare(String(b.name));
      if (sort === "priceHigh") return Number(b.price || 0) - Number(a.price || 0) || String(a.name).localeCompare(String(b.name));
      if (sort === "priceLow") return Number(a.price || 0) - Number(b.price || 0) || String(a.name).localeCompare(String(b.name));
      if (sort === "soldHigh") return Number(stockSoldStats[b.id] || 0) - Number(stockSoldStats[a.id] || 0) || String(a.name).localeCompare(String(b.name));
      if (sort === "soldLow") return Number(stockSoldStats[a.id] || 0) - Number(stockSoldStats[b.id] || 0) || String(a.name).localeCompare(String(b.name));
      return productSearchScore(b, query) - productSearchScore(a, query) || String(a.name).localeCompare(String(b.name));
    });
    return rows;
  }
  function renderStockProductRow(product, mode, storeMatch) {
    var deleted = mode === "deleted" || product.active === false;
    var stock = Number(mode === "master" ? product.masterStock || 0 : product.stock || 0);
    var low = isLowStockProduct(mode === "master" ? Object.assign({}, product, { stock: stock }) : product);
    var noPrice = Number(product.price || 0) <= 0;
    var noCode = !normalizeBarcode(product.barcode);
    var costState = normalizedProductCostState(product);
    var classes = [deleted ? "deleted" : "", low ? "warning-low" : "", noPrice ? "warning-price" : "", noCode ? "warning-code" : ""].filter(Boolean).join(" ");
    var warnings = (low ? "<span class='stock-flag low'>STOCK BAJO</span>" : "")
      + (noPrice ? "<span class='stock-flag price'>SIN PRECIO</span>" : "")
      + (noCode ? "<span class='stock-flag code'>SIN CODIGO</span>" : "")
      + (costState === "UNKNOWN" ? "<span class='stock-flag cost-unknown'>COSTO DESCONOCIDO</span>" : costState === "REPLACEMENT_ONLY" ? "<span class='stock-flag cost-estimated'>COSTO DE REPOSICION</span>" : "");
    var details = escapeHtml(productCategory(product))
      + (product.inventoryId ? " &middot; " + escapeHtml(product.inventoryId) : "")
      + (product.location ? " &middot; " + escapeHtml(product.location) : "")
      + (product.barcode ? " &middot; " + escapeHtml(product.barcode) : "");
    var actions = "";
    if (mode === "master") {
      if (storeMatch && storeMatch.active !== false) actions = "<button type='button' data-master-edit='" + storeMatch.id + "'>Editar en tienda</button>";
      else actions = "<button type='button' class='success' data-master-load='" + product.id + "'>Cargar a tienda</button>";
    } else {
      actions = "<button type='button' data-stock-edit='" + product.id + "'>Editar</button>"
        + (deleted ? "<button type='button' class='success' data-stock-restore='" + product.id + "'>Restaurar</button>" : "<button type='button' class='danger' data-stock-delete='" + product.id + "'>Dar de baja</button>");
    }
    var selectionKey = (mode === "master" ? "master" : "store") + "|" + product.id;
    var labelCode = barcodeLabelValidation(product.barcode);
    var selectableForLabel = labelCode.ok || labelCode.missing;
    var selectionTitle = labelCode.ok ? "Seleccionar para imprimir etiqueta" : labelCode.missing ? "Seleccionar y asignar un codigo interno LVE" : labelCode.error;
    var selection = mode === "deleted" ? "" : "<label class='stock-select-check" + (selectableForLabel ? "" : " disabled") + "' title='" + escapeHtml(selectionTitle) + "'><input type='checkbox' data-stock-select='" + escapeHtml(selectionKey) + "' " + (selectedStockProducts[selectionKey] ? "checked " : "") + (selectableForLabel ? "" : "disabled ") + "aria-label='Seleccionar " + escapeHtml(product.name || "producto") + " para etiquetas'><span></span></label>";
    return "<div class='stock-product-row " + classes + "'>"
      + selection
      + "<div class='stock-product-main'>" + productImage(product) + "<span><b>" + escapeHtml(product.name || "Sin nombre") + "</b><small>" + details + "</small><span class='stock-flags'>" + warnings + "</span></span></div>"
      + "<strong>" + (noPrice ? "Sin precio" : money(product.price)) + "<small>/" + escapeHtml(product.priceUnit || product.unitType || "unidad") + "</small></strong>"
      + "<em class='" + (low ? "warn" : "ok") + "'>" + stock + " " + escapeHtml(unitLabel(product.unitType || "u", stock)) + "</em>"
      + "<div class='stock-row-actions'>" + actions + "</div></div>";
  }
  function rememberStockSearch(productId, query) {
    if (!productId) return;
    loadStockSearchStats();
    stockSearchStats[productId] = Number(stockSearchStats[productId] || 0) + 1;
    if (query) stockSearchStats["q:" + String(query).toLowerCase()] = Number(stockSearchStats["q:" + String(query).toLowerCase()] || 0) + 1;
    saveStockSearchStats();
  }
  function productionDisplayRows(items, productById, soldByProduct, expenses) {
    var juanjoItems = [];
    var normalGroups = {};
    var rows = [];
    items.forEach(function (i) {
      var product = productById[i.productId] || {};
      var payGroup = productionPayGroup(i, product);
      if (payGroup.grouped) juanjoItems.push(i);
      else {
        var key = i.productId || i.productName;
        if (!normalGroups[key]) normalGroups[key] = {
          id: i.id, productId: i.productId, productName: i.productName, unitType: i.unitType,
          date: i.date, enteredAmount: 0, entries: []
        };
        normalGroups[key].enteredAmount += Number(i.enteredAmount || 0);
        normalGroups[key].entries.push(i);
      }
    });
    Object.keys(normalGroups).sort(function (a, b) {
      return normalGroups[a].productName.localeCompare(normalGroups[b].productName);
    }).forEach(function (key) {
      rows.push(renderStockEntry(normalGroups[key], productById[normalGroups[key].productId] || {}, soldByProduct, expenses));
    });
    if (juanjoItems.length) rows.unshift(renderJuanjoStockGroup(juanjoItems, productById, soldByProduct, expenses));
    return rows;
  }
  function renderStockEntry(i, product, soldByProduct, expenses) {
    var sold = soldByProduct[i.productId] || soldByProduct[i.productName] || 0;
    var remaining = Math.max(0, Number(i.enteredAmount || 0) - sold);
    var movements = (i.entries || [i]).map(function (entry) {
      var amount = Number(entry.enteredAmount || 0);
      return "<small class='" + (amount < 0 ? "stock-subtract" : "stock-add") + "'>" + (amount < 0 ? "Quita " : "Suma ") + Math.abs(amount) + " " + escapeHtml(entry.unitType || i.unitType || "") + (entry.reason ? " | " + escapeHtml(entry.reason) : "") + "</small>";
    }).join("");
    return "<details class='stock-entry' open><summary><span><b>" + escapeHtml(i.productName) + "</b><small>" + i.date + " | " + escapeHtml(i.unitType || "") + "</small></span><strong>" + remaining + " " + escapeHtml(i.unitType || "") + "</strong></summary>"
      + "<div class='stock-detail'><div><span>Neto cargado</span><b>" + i.enteredAmount + "</b></div><div><span>Vendido ticket</span><b>" + sold + "</b></div><div><span>Restante</span><b>" + remaining + "</b></div><div class='stock-movements'><span>Movimientos</span>" + movements + "</div>"
      + "</div></details>";
  }
  function renderJuanjoStockGroup(items, productById, soldByProduct, expenses) {
    var date = items[0].date;
    var groupKey = date + "|Juanjo";
    var paid = expenses.some(function (e) { return e.productionGroupKey === groupKey; });
    var byProduct = {};
    items.forEach(function (i) {
      var key = i.productId || i.productName;
      if (!byProduct[key]) byProduct[key] = {
        id: i.id, productId: i.productId, productName: i.productName, unitType: i.unitType,
        entered: 0, sold: 0, entries: []
      };
      byProduct[key].entered += Number(i.enteredAmount || 0);
      byProduct[key].entries.push(i);
    });
    Object.keys(byProduct).forEach(function (key) {
      byProduct[key].sold = soldByProduct[byProduct[key].productId] || soldByProduct[byProduct[key].productName] || 0;
    });
    var details = Object.keys(byProduct).sort(function (a, b) {
      return byProduct[a].productName.localeCompare(byProduct[b].productName);
    }).map(function (key) {
      var row = byProduct[key];
      var remaining = Math.max(0, row.entered - row.sold);
      return "<div class='stock-group-item'><span>" + escapeHtml(row.productName) + "</span><b>Neto " + row.entered + " " + escapeHtml(row.unitType || "") + "</b><b>Vend. " + row.sold + "</b><strong>Resta " + remaining + "</strong></div>";
    }).join("");
    return "<details class='stock-entry stock-grouped stock-juanjo-group' open><summary><span><b>Juanjo</b><small>" + date + " | " + items.length + " ingreso(s) agrupado(s)</small></span><strong>" + Object.keys(byProduct).length + " productos</strong></summary>"
      + "<div class='stock-detail stock-group-detail'>" + details
      + "<button type='button' class='" + (paid ? "stock-paid" : "stock-unpaid") + "' data-production-expense='" + items[0].id + "'>" + (paid ? "Pagado" : "Impago") + "</button></div></details>";
  }
  function renderProductionProductOptions(products) {
    var current = $("productionProduct").value;
    $("productionProduct").innerHTML = products.map(function (p) {
      return "<option value='" + p.id + "' data-unit='" + escapeHtml(p.unitType || "unidad") + "' data-name='" + escapeHtml(p.name) + "' data-category='" + escapeHtml(p.category || "") + "'>" + escapeHtml(p.name) + " (" + escapeHtml(p.unitType || "unidad") + ")</option>";
    }).join("");
    if (current) $("productionProduct").value = current;
    updateProductionProductFields();
  }
  function updateProductionProductFields() {
    var opt = $("productionProduct").selectedOptions[0];
    if (!opt) return;
    $("productionName").value = opt.dataset.name || opt.textContent;
    $("productionUnit").value = opt.dataset.unit || "unidad";
  }
  function updateProductionActionUi() {
    var removing = $("productionAction") && $("productionAction").value === "remove";
    if ($("productionReasonWrap")) $("productionReasonWrap").classList.toggle("hidden", !removing);
    if ($("productionSubmitBtn")) {
      $("productionSubmitBtn").textContent = removing ? "Quitar stock" : "Agregar stock";
      $("productionSubmitBtn").className = removing ? "big danger" : "big success";
    }
  }
  function saveProduction(e) {
    e.preventDefault();
    var entered = parseMoney($("productionEntered").value);
    var productId = $("productionProduct").value;
    var name = $("productionName").value.trim();
    if (!productId || !name || entered <= 0) { toast("Complete producto y cantidad"); return; }
    var removing = $("productionAction") && $("productionAction").value === "remove";
    var reason = $("productionReason") ? $("productionReason").value.trim() : "";
    if (removing && !reason) { toast("Motivo requerido para quitar stock"); return; }
    add("productionItems", {
      id: uid(), date: $("productionDate").value || today(), productId: productId, productName: name, unitType: $("productionUnit").value,
      enteredAmount: removing ? -entered : entered, category: $("productionProduct").selectedOptions[0] && $("productionProduct").selectedOptions[0].dataset.category || "",
      movementType: removing ? "REMOVE" : "ADD", reason: reason,
      createdBy: currentUser.id, createdAt: nowIso()
    }).then(function () {
      return removing
        ? audit("PRODUCTION_STOCK_REMOVED_REVIEW_REQUIRED", name + " -" + entered + " " + $("productionUnit").value + " | Motivo: " + reason, "warning")
        : audit("PRODUCTION_ITEM_CREATED", name);
    }).then(function () {
    $("productionEntered").value = "";
      if ($("productionReason")) $("productionReason").value = "";
      if ($("productionAction")) $("productionAction").value = "add";
      updateProductionActionUi();
      $("productionFilterDate").value = $("productionDate").value;
      renderProduction();
    });
  }
  function openBalanceExpenseForProduction(id) {
    if (!isAdmin()) { toast("Solo admin/dev puede cargar gasto en Balance"); return; }
    Promise.all([all("productionItems"), all("products")]).then(function (data) {
      var items = data[0];
      var products = data[1];
      var productById = {};
      products.forEach(function (p) { productById[p.id] = p; });
      var item = items.filter(function (i) { return i.id === id; })[0];
      if (!item) { toast("Stock no encontrado"); return; }
      var group = productionPayGroup(item, productById[item.productId] || {});
      switchTab("Balance");
      if ($("balanceExpensePanel")) $("balanceExpensePanel").open = true;
      $("monthlyProductionId").value = item.id;
      $("monthlyProductionId").dataset.groupKey = group.key;
      $("monthlyDate").value = item.date;
      $("monthlyCategory").value = group.grouped ? "Juanjo" : "Produccion";
      $("monthlyDescription").value = group.grouped ? "Pago grupo Juanjo del " + item.date : "Pago stock: " + item.productName + " (" + item.enteredAmount + " " + item.unitType + ")";
      $("monthlyAmount").focus();
      setTimeout(function () { $("monthlyForm").scrollIntoView({ behavior: isLegacyPerformance() ? "auto" : "smooth", block: "center" }); }, 80);
    });
  }
  function productionPayGroup(item, product) {
    var category = String(item.category || product.category || "").trim().toLowerCase();
    if (category === "juanjo") return { grouped: true, key: item.date + "|Juanjo" };
    return { grouped: false, key: item.id };
  }

  function renderMetricsLegacy() {
    var days = Number($("metricsRange").value || 30);
    var start = new Date();
    start.setDate(start.getDate() - days + 1);
    Promise.all([all("transactions"), all("baskets"), all("basketItems"), all("monthlyEntries"), all("productionItems"), all("closures")]).then(function (data) {
      var allTrs = data[0];
      var baskets = data[1];
      var basketItems = data[2];
      var monthly = data[3];
      var production = data[4];
      var closures = data[5];
      var trs = allTrs.filter(function (t) { return !t.deleted; });
      var scoped = trs.filter(function (t) { return new Date(t.createdAt) >= start; });
      var deletedScoped = allTrs.filter(function (t) { return t.deleted && new Date(t.createdAt || t.deletedAt || nowIso()) >= start; });
      var sales = scoped.filter(function (t) { return t.type === "SALE"; });
      var cash = sales.reduce(function (total, sale) { return total + salePaymentParts(sale).cash; }, 0);
      var transferReceived = sales.reduce(function (total, sale) { return total + (isSplitPayment(sale.paymentMethod) || digitalPaymentSettled(sale) ? salePaymentParts(sale).qr : 0); }, 0);
      var transferPending = sum(sales, function (t) { return isDigitalPayment(t.paymentMethod) && String(t.paymentStatus || t.transferStatus || "").toUpperCase() === "PENDING"; });
      var transferReview = sum(sales, function (t) { return isDigitalPayment(t.paymentMethod) && String(t.paymentStatus || t.transferStatus || "").toUpperCase() === "REVIEW"; });
      var withdrawals = sum(scoped, function (t) { return t.type === "WITHDRAWAL"; });
      var expenses = monthly.filter(function (e) { return e.type !== "RECURRING_RULE" && new Date(e.date || e.createdAt) >= start; });
      var expenseTotal = sum(expenses, function () { return true; });
      var completeClosures = closures.filter(function (c) { return (c.closureKind || "COMPLETE") === "COMPLETE" && new Date(c.createdAt || c.businessDate) >= start; });
      var partialClosures = closures.filter(function (c) { return c.closureKind === "PARTIAL" && new Date(c.createdAt || c.businessDate) >= start; });
      var productionScoped = production.filter(function (p) { return !p.deleted && new Date(p.date || p.createdAt) >= start; });
      var ticketSales = sales.filter(function (t) { return t.saleMode === "PRODUCT_BASKET" || t.basketId; });
      var manualSales = sales.length - ticketSales.length;
      var avg = sales.length ? sum(sales, function () { return true; }) / sales.length : 0;
      var confirmedResult = cash + transferReceived - withdrawals - expenseTotal;
      var bestDay = bestMetricDay(sales, days);
      var basketById = {};
      baskets.forEach(function (b) { basketById[b.id] = b; });
      var txById = {};
      sales.forEach(function (t) { txById[t.id] = t; });
      var productStats = productMetricStats(basketItems, basketById, txById, start);
      $("metricsCards").innerHTML = summary([
        ["Ventas totales", money(sum(sales, function () { return true; }))],
        ["Ventas registradas", sales.length],
        ["Ticket promedio", money(avg)],
        ["Efectivo", money(cash)],
        ["Pagos digitales aprobados", money(transferReceived)],
        ["Pagos por revisar", money(transferPending + transferReview)],
        ["Gastos cargados", money(expenseTotal)],
        ["Resultado confirmado", money(confirmedResult)],
        ["Ventas ticket", ticketSales.length],
        ["Productos vendidos", productStats.totalItems],
        ["Cierres completos", completeClosures.length],
        ["Dia mas fuerte", bestDay.label + " " + money(bestDay.total)]
      ]);
      if ($("metricsBreakdown")) $("metricsBreakdown").innerHTML = [
        ["Retiros", money(withdrawals)],
        ["Ventas manuales", manualSales],
        ["Ventas por ticket", ticketSales.length],
        ["Mayor venta", money(maxAmount(sales))],
        ["Ventas bajas (< $1000)", sales.filter(function (t) { return Number(t.amount || 0) > 0 && Number(t.amount || 0) < 1000; }).length],
        ["Ventas grandes (> $99.999)", sales.filter(function (t) { return Number(t.amount || 0) > 99999; }).length],
        ["Pagos digitales pendientes", money(transferPending)],
        ["Pagos digitales en revision", money(transferReview)],
        ["Resultado confirmado", money(confirmedResult)]
      ].map(metricLine).join("");
      if ($("metricsProducts")) $("metricsProducts").innerHTML = productStats.rows.length ? productStats.rows.slice(0, 8).map(function (p, i) {
        return "<div><span>" + (i + 1) + ". " + escapeHtml(p.name) + "<small>" + p.qty + " vendido(s)</small></span><b>" + money(p.subtotal) + "</b></div>";
      }).join("") : empty("Sin productos vendidos por ticket en este rango.");
      if ($("metricsOps")) $("metricsOps").innerHTML = [
        ["Cierres completos", completeClosures.length],
        ["Cierres parciales", partialClosures.length],
        ["Movimientos borrados", deletedScoped.length],
        ["Stock cargado", productionScoped.length + " entrada(s)"],
        ["Categorias de gasto", uniqueCount(expenses.map(function (e) { return e.category || "General"; }))],
        ["Pagos digitales sin confirmar", sales.filter(function (t) { return isDigitalPayment(t.paymentMethod) && !digitalPaymentSettled(t); }).length]
      ].map(metricLine).join("");
      if ($("metricsCash")) $("metricsCash").innerHTML = [
        ["Ingresos confirmados", money(cash + transferReceived)],
        ["Efectivo vs digital", percent(cash, cash + transferReceived) + " / " + percent(transferReceived, cash + transferReceived)],
        ["Gastos", money(expenseTotal)],
        ["Retiros", money(withdrawals)],
        ["Balance operativo", money(confirmedResult)],
        ["Promedio por dia", money((cash + transferReceived) / Math.max(1, days))]
      ].map(metricLine).join("");
      drawChart(sales, days);
      drawSalesCountChart(sales, days);
      drawPaymentMixChart(cash, transferReceived, transferPending + transferReview);
      drawProductRevenueChart(productStats.rows);
    });
  }
  function clearMetricCanvases() {
    ["salesChart", "salesCountChart", "paymentMixChart", "productRevenueChart"].forEach(function (id) {
      var canvas = $(id);
      if (!canvas) return;
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width || 1, canvas.height || 1);
    });
  }
  function metricLine(row) {
    return "<div><span>" + row[0] + "</span><b>" + row[1] + "</b></div>";
  }
  function maxAmount(rows) {
    return rows.reduce(function (m, r) { return Math.max(m, Number(r.amount || 0)); }, 0);
  }
  function uniqueCount(rows) {
    var seen = {};
    rows.forEach(function (r) { seen[r] = true; });
    return Object.keys(seen).length;
  }
  function percent(value, total) {
    total = Number(total || 0);
    if (!total) return "0%";
    return Math.round((Number(value || 0) / total) * 100) + "%";
  }
  function bestMetricDay(sales, days) {
    var best = { label: "-", total: 0 };
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var key = d.toISOString().slice(0, 10);
      var total = sum(sales.filter(function (s) { return (s.businessDate || "").slice(0, 10) === key; }), function () { return true; });
      if (total > best.total) best = { label: key.slice(5), total: total };
    }
    return best;
  }
  function productMetricStats(items, basketById, txById, start) {
    var byProduct = {};
    var totalItems = 0;
    items.forEach(function (it) {
      var basket = basketById[it.basketId];
      var tx = basket && txById[basket.transactionId];
      if (!tx || new Date(tx.createdAt) < start) return;
      var key = basketItemIdentityKey(it);
      if (!byProduct[key]) byProduct[key] = { name: it.productName || "Producto", qty: 0, subtotal: 0 };
      byProduct[key].qty += Number(it.quantity || 0);
      byProduct[key].subtotal += Number(it.subtotal || 0);
      totalItems += Number(it.quantity || 0);
    });
    var rows = Object.keys(byProduct).map(function (k) { return byProduct[k]; }).sort(function (a, b) {
      return b.subtotal - a.subtotal || b.qty - a.qty;
    });
    return { rows: rows, totalItems: Math.round(totalItems * 100) / 100 };
  }
  function renderMovements() {
    clearTimeout(movementRenderTimer);
    expandedMovements = {};
    Promise.all([all("transactions"), all("basketItems")]).then(function (data) {
      var rows = data[0];
      var basketItems = data[1];
      movementItemsByBasket = {};
      basketItems.forEach(function (it) {
        if (!movementItemsByBasket[it.basketId]) movementItemsByBasket[it.basketId] = [];
        movementItemsByBasket[it.basketId].push(it);
      });
      rows.sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
      var filteredBeforeQuickFilter = filterMovements(rows, true);
      var filtered = filteredBeforeQuickFilter.filter(movementMatchesQuickFilter);
      movementFilteredRows = filtered;
      movementRenderCount = Math.min(MOVEMENT_BATCH_SIZE, filtered.length);
      visibleMovementIds = filtered.map(function (r) { return r.id; });
      Object.keys(selectedMovements).forEach(function (id) {
        if (visibleMovementIds.indexOf(id) < 0) delete selectedMovements[id];
      });
      renderMovementSummary(filteredBeforeQuickFilter);
      $("movementSelectionPill").textContent = Object.keys(selectedMovements).length + " seleccionados";
      renderMovementRows();
    });
  }
  function scheduleRenderMovements() {
    clearTimeout(movementRenderTimer);
    movementRenderTimer = setTimeout(renderMovements, 160);
  }
  function renderMovementRows() {
    var list = $("movementsList");
    if (!list) return;
    updateMovementSelectionUi();
    var scrollTop = list.scrollTop || 0;
    if (!movementFilteredRows.length) {
      list.innerHTML = empty("Sin movimientos para estos filtros");
      return;
    }
    var visible = movementFilteredRows.slice(0, movementRenderCount);
    list.innerHTML = visible.map(function (r, i) {
      return movementRowHtml(r, i, movementItemsByBasket[r.basketId] || []);
    }).join("") + movementLoadMoreHtml();
    list.scrollTop = scrollTop;
    bindMovementRowEvents();
  }
  function movementLoadMoreHtml() {
    if (movementRenderCount >= movementFilteredRows.length) return "";
    return "<button id='movementLoadMore' class='movement-load-more' type='button'>Cargar mas (" + movementRenderCount + " / " + movementFilteredRows.length + ")</button>";
  }
  function loadMoreMovements() {
    if (movementRenderCount >= movementFilteredRows.length) return;
    movementRenderCount = Math.min(movementRenderCount + MOVEMENT_BATCH_SIZE, movementFilteredRows.length);
    renderMovementRows();
  }
  function bindMovementRowEvents() {
    document.querySelectorAll("[data-movement-select]").forEach(function (box) {
      box.onclick = function (e) {
        e.stopPropagation();
        var idx = Number(box.dataset.movementIndex);
        if (e.shiftKey && lastMovementSelectIndex >= 0) {
          e.preventDefault();
          selectMovementRange(lastMovementSelectIndex, idx, true);
          return;
        }
        setMovementSelected(box.dataset.movementSelect, box.checked);
        lastMovementSelectIndex = idx;
        renderMovementRows();
      };
    });
    document.querySelectorAll("[data-movement-row]").forEach(function (row) {
      row.onclick = function (e) {
        if (e.target.closest("button,input,label,a,select,textarea")) return;
        selectedMovements = {};
        selectedMovements[row.dataset.movementRow] = true;
        renderMovementRows();
      };
    });
    document.querySelectorAll("[data-movement-expand]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.dataset.movementExpand;
        expandedMovements[id] = !expandedMovements[id];
        renderMovementRows();
      };
    });
    if ($("movementLoadMore")) $("movementLoadMore").onclick = loadMoreMovements;
  }
  function setMovementSelected(id, checked) {
    if (checked) selectedMovements[id] = true;
    else delete selectedMovements[id];
    updateMovementSelectionUi();
  }
  function updateMovementSelectionUi() {
    var count = Object.keys(selectedMovements).length;
    if ($("movementSelectionPill")) $("movementSelectionPill").textContent = count + " seleccionado" + (count === 1 ? "" : "s");
    if ($("editMovementBtn")) $("editMovementBtn").disabled = count !== 1;
    if ($("deleteMovementBtn")) $("deleteMovementBtn").disabled = count < 1;
  }
  function selectMovementRange(from, to, checked) {
    var a = Math.min(from, to);
    var b = Math.max(from, to);
    for (var i = a; i <= b; i++) {
      if (visibleMovementIds[i]) setMovementSelected(visibleMovementIds[i], checked);
    }
    lastMovementSelectIndex = to;
    renderMovementRows();
  }
  function movementTypeLabel(type) {
    if (type === "SALE") return "Venta";
    if (type === "WITHDRAWAL") return "Retiro";
    return type || "Movimiento";
  }
  function movementItems(r) {
    return movementItemsByBasket[r && r.basketId] || [];
  }
  function movementManualItems(items) {
    return (items || []).filter(isManualBasketItem);
  }
  function movementHasManualItems(r, items) {
    return Number(r && r.manualItemCount || 0) > 0 || movementManualItems(items).length > 0;
  }
  function movementNeedsPaymentReview(r) {
    return r.type === "SALE" && isDigitalPayment(r.paymentMethod) && !digitalPaymentSettled(r);
  }
  function movementSearchText(r, items) {
    return normalizeProductSearch([
      r.id, r.businessDate, r.createdAt, movementTypeLabel(r.type), r.paymentMethod,
      r.shiftType, r.userName, r.username, r.createdByName, r.reviewReason,
      r.adminNote, r.deleteReason, r.amount
    ].concat((items || []).map(function (item) {
      return [item.productName, item.barcode, item.scannedCode, item.source, item.reviewReason].join(" ");
    })).join(" "));
  }
  function movementMatchesQuickFilter(r) {
    if (!movementQuickFilter) return true;
    var items = movementItems(r);
    if (movementQuickFilter === "review") return movementFlags(r, items).length > 0;
    if (movementQuickFilter === "manual") return movementHasManualItems(r, items);
    if (movementQuickFilter === "changed") return !!(r.editedAt || r.deleted || r.reviewRequired);
    if (movementQuickFilter === "pending") return movementNeedsPaymentReview(r);
    return true;
  }
  function filterMovements(rows, ignoreQuickFilter) {
    var from = $("movementDateFrom").value;
    var to = $("movementDateTo").value;
    var query = normalizeProductSearch($("movementSearch").value);
    var kind = $("movementKindFilter").value;
    var payment = $("movementPaymentFilter").value;
    var shift = $("movementShiftFilter").value;
    var state = $("movementStateFilter").value;
    return rows.filter(function (r) {
      var d = r.businessDate || (r.createdAt || "").slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (query && movementSearchText(r, movementItems(r)).indexOf(query) < 0) return false;
      if (kind && r.type !== kind) return false;
      if (payment && paymentReportingGroup(r.paymentMethod) !== payment) return false;
      if (shift && r.shiftType !== shift) return false;
      if (state === "ACTIVE" && r.deleted) return false;
      if (state === "DELETED" && !r.deleted) return false;
      if (!ignoreQuickFilter && !movementMatchesQuickFilter(r)) return false;
      return true;
    });
  }
  function movementFlags(r, items) {
    var flags = [];
    function push(key, label, tone, reason, priority) {
      flags.push({ key: key, label: label, tone: tone, reason: reason || "", priority: priority || 0 });
    }
    var itemReview = (items || []).some(function (item) { return item.reviewFlag; });
    var manualItems = movementManualItems(items);
    if (r.deleted) push("deleted", "Borrado", "critical", r.deleteReason || "Movimiento borrado", 100);
    if (r.reviewFlag || r.reviewRequired || itemReview) push("review", "Requiere revision", "critical", r.reviewReason || r.deleteReason || "Marcado para control", 90);
    if (manualItems.length || Number(r.manualItemCount || 0) > 0) {
      var manualNames = manualItems.slice(0, 3).map(function (item) { return item.productName || "Item sin registrar"; }).join(", ");
      push("manual", "Item manual / sin registrar", "warning", manualNames || r.reviewReason || "Ticket con item manual", 80);
    }
    if (movementNeedsPaymentReview(r)) push("pending", "Pago pendiente", "warning", "El pago digital no figura confirmado", 70);
    if (r.editedAt) push("edited", "Editado", "changed", r.adminNote || "Movimiento modificado", 60);
    return flags.sort(function (a, b) { return b.priority - a.priority; });
  }
  function movementRowHtml(r, index, items) {
    var flags = movementFlags(r, items);
    var tone = flags.length ? flags[0].tone : "normal";
    var isSelected = !!selectedMovements[r.id];
    var checked = isSelected ? " checked" : "";
    var expandable = r.basketId ? "<button type='button' class='movement-expand' data-movement-expand='" + r.id + "'>" + (expandedMovements[r.id] ? "Ocultar" : "Detalle") + "</button>" : "";
    var flagHtml = flags.length ? flags.map(function (f) {
      return "<i class='movement-flag " + f.key + "' title='" + escapeHtml(f.reason) + "'>" + escapeHtml(f.label) + "</i>";
    }).join("") : "";
    var createdTime = localTimeLabel(r.createdAt);
    var employee = r.userName || r.username || r.createdByName || "Sin dato";
    return "<article class='movement-row " + tone + (isSelected ? " selected" : "") + "' data-movement-row='" + r.id + "'>"
      + "<label class='movement-check'><input type='checkbox' data-movement-select='" + r.id + "' data-movement-index='" + index + "'" + checked + "></label>"
      + "<div class='movement-date'><b>" + escapeHtml(r.businessDate || (r.createdAt || "").slice(0, 10)) + "</b><small>" + escapeHtml(createdTime) + " · " + escapeHtml(r.shiftType || "-") + "</small></div>"
      + "<div class='movement-kind'><b>" + escapeHtml(movementTypeLabel(r.type)) + "</b><small>" + escapeHtml(employee) + (r.basketId ? " · #" + escapeHtml(String(r.id || "").slice(-6).toUpperCase()) : "") + "</small></div>"
      + "<div class='movement-payment'><b>" + escapeHtml(paymentDisplayName(r.paymentMethod)) + "</b></div>"
      + "<strong class='movement-amount'>" + money(r.amount) + "</strong>"
      + "<div class='movement-flags'>" + flagHtml + expandable + "</div>"
      + movementTicketDetailHtml(r, items, flags)
      + "</article>";
  }
  function movementTicketDetailHtml(r, items, flags) {
    if (!expandedMovements[r.id] || !r.basketId) return "";
    var paid = Number(r.paidAmount || 0);
    var hasPaid = r.paidAmount !== undefined && r.paidAmount !== null && r.paidAmount !== "";
    var change = r.changeAmount !== undefined && r.changeAmount !== null ? Number(r.changeAmount || 0) : paid - Number(r.amount || 0);
    var totalQuantity = (items || []).reduce(function (total, item) { return total + Number(item.quantity || 0); }, 0);
    var reasonRows = (flags || []).filter(function (flag) { return flag.reason; });
    return "<div class='movement-ticket-detail'>"
      + "<div class='movement-ticket-stats'><span>Items <b>" + formatQuantity(totalQuantity) + "</b></span><span>Pago cliente <b>" + (hasPaid ? money(paid) : "Sin dato") + "</b></span><span>Vuelto <b>" + (hasPaid ? money(change) : "Sin dato") + "</b></span></div>"
      + (reasonRows.length ? "<div class='movement-review-reasons'>" + reasonRows.map(function (flag) { return "<p><b>" + escapeHtml(flag.label) + ":</b> " + escapeHtml(flag.reason) + "</p>"; }).join("") + "</div>" : "")
      + (items.length ? items.map(function (it) {
        var manual = movementManualItems([it]).length > 0;
        return "<div class='movement-ticket-item" + (manual ? " manual" : "") + "'><span>" + escapeHtml(it.productName || "Item sin registrar") + (manual ? "<small>Item manual / sin registrar</small>" : "") + "</span><b>" + formatQuantity(it.quantity) + " " + escapeHtml(unitLabel(it.unitType, it.quantity)) + " x " + money(it.unitPrice) + "</b><strong>" + money(it.subtotal) + "</strong></div>";
      }).join("") : empty("Sin detalle de items guardado"))
      + "</div>";
  }
  function renderMovementSummary(rows) {
    var reviewed = rows.filter(function (r) { return movementFlags(r, movementItems(r)).length > 0; }).length;
    var manual = rows.filter(function (r) { return movementHasManualItems(r, movementItems(r)); }).length;
    var changed = rows.filter(function (r) { return r.editedAt || r.deleted || r.reviewRequired; }).length;
    var pending = rows.filter(movementNeedsPaymentReview).length;
    var cards = [
      ["", "Todos", rows.length, "neutral"],
      ["review", "Requieren revision", reviewed, reviewed ? "danger" : "neutral"],
      ["manual", "Items manuales", manual, manual ? "warning" : "neutral"],
      ["changed", "Editados / borrados", changed, changed ? "danger" : "neutral"],
      ["pending", "Pagos pendientes", pending, pending ? "warning" : "neutral"]
    ];
    $("movementSummary").innerHTML = cards.map(function (card) {
      return "<button type='button' class='summary-item movement-summary-filter " + card[3] + (movementQuickFilter === card[0] ? " active" : "") + "' data-movement-quick='" + card[0] + "'><span>" + card[1] + "</span><b>" + card[2] + "</b></button>";
    }).join("");
    document.querySelectorAll("[data-movement-quick]").forEach(function (button) {
      button.onclick = function () {
        movementQuickFilter = button.dataset.movementQuick || "";
        selectedMovements = {};
        renderMovements();
      };
    });
  }
  function selectVisibleMovements() {
    visibleMovementIds.slice(0, movementRenderCount).forEach(function (id) { selectedMovements[id] = true; });
    renderMovementRows();
  }
  function clearMovementSelection() {
    selectedMovements = {};
    renderMovementRows();
  }
  function openMovementEdit() {
    if (!isAdmin()) return;
    var ids = Object.keys(selectedMovements);
    if (ids.length !== 1) { toast("Seleccione un solo movimiento para editar"); return; }
    Promise.all([all("transactions"), all("basketItems"), all("products"), all("baskets")]).then(function (data) {
      var r = data[0].filter(function (x) { return x.id === ids[0]; })[0];
      if (!r) { toast("Movimiento no encontrado"); return; }
      var originalItems = data[1].filter(function (item) { return r.basketId && item.basketId === r.basketId; });
      var stockProducts = data[2];
      var products = stockProducts.filter(function (product) { return product.active !== false; });
      var productById = {};
      stockProducts.forEach(function (product) { productById[product.id] = product; });
      var legacyStockProducts = {};
      if (r.type === "SALE") originalItems.forEach(function (item) {
        if (isManualBasketItem(item) || !item.productId) return;
        var restorationState = String(item.stockRestorationState || "");
        var missingExactDelta = item.stockAppliedQuantity === undefined || item.stockAppliedQuantity === null || item.stockAppliedQuantity === "";
        if (!missingExactDelta && restorationState !== "legacy-unchanged" && restorationState !== "product-missing") return;
        var product = productById[item.productId];
        legacyStockProducts[item.productId] = {
          id: item.productId,
          name: item.productName || (product && product.name) || "Producto",
          currentStock: Number(product && product.stock || 0)
        };
      });
      movementEditDraft = {
        transaction: Object.assign({}, r),
        originalItems: originalItems.map(function (item) { return Object.assign({}, item); }),
        items: originalItems.map(function (item) {
          var next = Object.assign({}, item);
          if (isManualBasketItem(next)) {
            next.manualItemId = next.manualItemId || next.id || uid();
            next.productId = "manual:" + next.manualItemId;
            next.manualItem = true;
            next.source = "manual-item";
          }
          return next;
        }),
        products: products,
        stockProducts: stockProducts,
        productById: productById,
        basket: data[3].filter(function (entry) { return entry.id === r.basketId; })[0] || null,
        legacyStockProducts: legacyStockProducts
      };
      $("movementEditId").value = r.id;
      $("movementEditAmount").value = String(Math.round(Number(r.amount || 0)));
      $("movementEditType").value = r.type || "SALE";
      var paymentSelect = $("movementEditPayment");
      Array.from(paymentSelect.options).filter(function (option) { return option.dataset.historical === "1"; }).forEach(function (option) { option.remove(); });
      if (["Efectivo", "QR"].indexOf(r.paymentMethod || "") >= 0) paymentSelect.value = r.paymentMethod || "Efectivo";
      else {
        var historicalOption = document.createElement("option");
        historicalOption.value = "__KEEP__";
        historicalOption.dataset.historical = "1";
        historicalOption.textContent = "Mantener medio historico";
        paymentSelect.appendChild(historicalOption);
        paymentSelect.value = "__KEEP__";
      }
      $("movementEditBusinessDate").value = r.businessDate || today();
      $("movementEditShift").value = r.shiftType || "AM";
      $("movementEditDeleted").value = r.deleted ? "true" : "false";
      $("movementEditReason").value = "";
      var hasEditableItems = r.type === "SALE" && !!r.basketId;
      $("movementEditType").disabled = hasEditableItems;
      $("movementEditItemsSection").classList.toggle("hidden", !hasEditableItems);
      $("movementEditAmountWrap").classList.toggle("hidden", hasEditableItems);
      renderMovementEditItems();
      $("movementEditModal").classList.remove("hidden");
      (hasEditableItems ? $("movementEditItems") : $("movementEditAmount")).focus();
    });
  }
  function movementEditProductOptions(item) {
    var selectedId = isManualBasketItem(item) ? "__manual__" : String(item.productId || "");
    var html = "<option value='__manual__'" + (selectedId === "__manual__" ? " selected" : "") + ">Item manual</option>";
    if (selectedId && selectedId !== "__manual__" && !movementEditDraft.products.some(function (product) { return product.id === selectedId; })) {
      html += "<option value='" + escapeHtml(selectedId) + "' selected>" + escapeHtml(item.productName || "Producto no disponible") + "</option>";
    }
    return html + movementEditDraft.products.map(function (product) {
      return "<option value='" + escapeHtml(product.id) + "'" + (selectedId === product.id ? " selected" : "") + ">" + escapeHtml(product.name) + "</option>";
    }).join("");
  }
  function movementEditLegacyStockHtml() {
    if (!movementEditDraft) return "";
    var requiresConfirmation = !$("movementEditDeleted") || $("movementEditDeleted").value !== "true";
    var rows = Object.keys(movementEditDraft.legacyStockProducts || {}).map(function (productId) {
      var product = movementEditDraft.legacyStockProducts[productId];
      return "<label class='movement-legacy-stock'><span><b>" + escapeHtml(product.name) + "</b><small>" + (requiresConfirmation
        ? "Venta antigua: confirme el stock real que debe quedar despues de esta correccion."
        : "Al dejarla borrada, el stock antiguo no se modifica ni se adivina.") + "</small></span>"
        + "<input data-movement-stock-final='" + escapeHtml(productId) + "' inputmode='decimal' value='" + escapeHtml(formatQuantity(product.currentStock)) + "' aria-label='Stock final de " + escapeHtml(product.name) + "'>"
        + "<i><input type='checkbox' data-movement-stock-confirm='" + escapeHtml(productId) + "'> Confirmado</i></label>";
    });
    return rows.length ? "<div class='movement-legacy-stock-box'><strong>" + (requiresConfirmation ? "Confirmacion de stock obligatoria" : "Stock antiguo sin cambios") + "</strong>" + rows.join("") + "</div>" : "";
  }
  function renderMovementEditItems() {
    if (!movementEditDraft || !$("movementEditItems")) return;
    $("movementEditItems").innerHTML = movementEditDraft.items.length ? movementEditDraft.items.map(function (item, index) {
      return "<div class='movement-edit-item' data-movement-edit-line='" + index + "'>"
        + "<label>Producto<select data-movement-item-product='" + index + "'>" + movementEditProductOptions(item) + "</select></label>"
        + "<label class='movement-edit-description'>Descripcion<input data-movement-item-name='" + index + "' value='" + escapeHtml(item.productName || "") + "' maxlength='100'></label>"
        + "<label>Cantidad (" + escapeHtml(item.unitType || "unidad") + ")<input data-movement-item-quantity='" + index + "' inputmode='decimal' value='" + escapeHtml(formatQuantity(item.quantity)) + "'></label>"
        + "<label>Precio unitario<input data-movement-item-price='" + index + "' inputmode='decimal' value='" + escapeHtml(String(Number(item.unitPrice || 0))) + "'></label>"
        + "<button class='small danger' type='button' data-movement-item-remove='" + index + "' aria-label='Quitar item'>Quitar</button></div>";
    }).join("") + movementEditLegacyStockHtml() : empty("La venta no tiene items. Agregue al menos uno.") + movementEditLegacyStockHtml();
    bindMovementEditItemEvents();
    refreshMovementEditCalculation();
  }
  function syncMovementEditItem(index) {
    if (!movementEditDraft || !movementEditDraft.items[index]) return;
    var item = movementEditDraft.items[index];
    var nameInput = document.querySelector("[data-movement-item-name='" + index + "']");
    var quantityInput = document.querySelector("[data-movement-item-quantity='" + index + "']");
    var priceInput = document.querySelector("[data-movement-item-price='" + index + "']");
    if (nameInput) item.productName = nameInput.value.trim();
    if (quantityInput) item.quantity = parseMoney(quantityInput.value);
    if (priceInput) item.unitPrice = parseMoney(priceInput.value);
    item.subtotal = moneyPrecision(Number(item.quantity || 0) * Number(item.unitPrice || 0));
  }
  function bindMovementEditItemEvents() {
    document.querySelectorAll("[data-movement-item-name],[data-movement-item-quantity],[data-movement-item-price]").forEach(function (input) {
      input.oninput = function () { syncMovementEditItem(Number(input.dataset.movementItemName || input.dataset.movementItemQuantity || input.dataset.movementItemPrice)); refreshMovementEditCalculation(); };
    });
    document.querySelectorAll("[data-movement-item-product]").forEach(function (select) {
      select.onchange = function () {
        var index = Number(select.dataset.movementItemProduct);
        syncMovementEditItem(index);
        var item = movementEditDraft.items[index];
        var product = movementEditDraft.productById[select.value];
        if (select.value === "__manual__") {
          var manualId = item.manualItemId || uid();
          item.productId = "manual:" + manualId;
          item.manualItemId = manualId;
          item.manualItem = true;
          item.reviewFlag = true;
          item.source = "manual-item";
          item.unitType = "unidad";
        } else if (product) {
          item.productId = product.id;
          item.productName = product.name;
          item.quantity = 1;
          item.unitType = product.unitType || product.priceUnit || "unidad";
          item.unitPrice = productUnitPrice(product);
          item.barcode = normalizeBarcode(product.barcode);
          item.manualItemId = "";
          item.manualItem = false;
          item.reviewFlag = false;
          item.reviewReason = "";
          item.source = "movement-edit";
        }
        renderMovementEditItems();
      };
    });
    document.querySelectorAll("[data-movement-item-remove]").forEach(function (button) {
      button.onclick = function () {
        movementEditDraft.items.splice(Number(button.dataset.movementItemRemove), 1);
        renderMovementEditItems();
      };
    });
  }
  function addMovementEditItem() {
    if (!movementEditDraft) return;
    var manualId = uid();
    movementEditDraft.items.push({
      id: uid(), basketId: movementEditDraft.transaction.basketId, productId: "manual:" + manualId,
      manualItemId: manualId, productName: "", quantity: 1, unitType: "unidad", unitPrice: 0,
      subtotal: 0, source: "manual-item", manualItem: true, reviewFlag: true, reviewReason: "Item manual sin registrar"
    });
    renderMovementEditItems();
  }
  function refreshMovementEditCalculation() {
    if (!movementEditDraft) return;
    var original = movementEditDraft.transaction || {};
    var amounts = basketSaleAmounts(movementEditDraft.items, { type: original.discountType, value: original.discountValue });
    $("movementEditSubtotal").textContent = money(amounts.unroundedAmount);
    $("movementEditRounding").textContent = money(amounts.roundingAdjustment);
    $("movementEditRoundingLine").classList.toggle("hidden", Math.abs(amounts.roundingAdjustment) < 0.01);
    $("movementEditTotal").textContent = money(amounts.total);
    $("movementEditAmount").value = String(amounts.total);
  }
  function closeMovementEdit() {
    $("movementEditModal").classList.add("hidden");
    movementEditDraft = null;
  }
  function movementEditConfirmedLegacyStock(required) {
    if (!required) return {};
    var confirmed = {};
    var legacy = movementEditDraft && movementEditDraft.legacyStockProducts || {};
    var valid = true;
    Object.keys(legacy).forEach(function (productId) {
      var valueInput = document.querySelector("[data-movement-stock-final='" + productId + "']");
      var confirmation = document.querySelector("[data-movement-stock-confirm='" + productId + "']");
      var value = parseMoney(valueInput && valueInput.value);
      if (!confirmation || !confirmation.checked || !valueInput || value < 0) valid = false;
      confirmed[productId] = value;
    });
    if (!valid) toast("Confirme el stock final de cada producto antiguo");
    return valid ? confirmed : null;
  }
  function commitMovementEditAtomic(payload) {
    return dbPromise.then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(["transactions", "basketItems", "baskets", "products", "inventoryMovements", "auditLog"], "readwrite");
        payload.originalItems.forEach(function (item) { transaction.objectStore("basketItems").delete(item.id); });
        payload.items.forEach(function (item) { transaction.objectStore("basketItems").put(item); });
        payload.products.forEach(function (product) { transaction.objectStore("products").put(product); });
        (payload.inventoryMovements || []).forEach(function (movement) { transaction.objectStore("inventoryMovements").put(movement); });
        transaction.objectStore("transactions").put(payload.transaction);
        if (payload.basket) transaction.objectStore("baskets").put(payload.basket);
        transaction.objectStore("auditLog").put(payload.audit);
        transaction.oncomplete = function () {
          invalidateProductSearchCache();
          if (diskSnapshotWritesEnabled && !diskSnapshotPaused) scheduleDiskSnapshot();
          resolve(true);
        };
        transaction.onerror = function () { reject(transaction.error || new Error("No se pudo guardar la correccion")); };
        transaction.onabort = function () { reject(transaction.error || new Error("Correccion cancelada")); };
      });
    });
  }
  function saveMovementEdit(e) {
    e.preventDefault();
    if (!isAdmin() || !movementEditDraft) return;
    var id = $("movementEditId").value;
    var reason = $("movementEditReason").value.trim();
    if (!reason) { toast("Ingrese motivo o nota"); $("movementEditReason").focus(); return; }
    movementEditDraft.items.forEach(function (_item, index) { syncMovementEditItem(index); });
    var r = Object.assign({}, movementEditDraft.transaction);
    var hasItems = r.type === "SALE" && !!r.basketId;
    if (hasItems && !movementEditDraft.items.length) { toast("La venta debe conservar al menos un item"); return; }
    if (hasItems && movementEditDraft.items.some(function (item) { return !String(item.productName || "").trim() || Number(item.quantity || 0) <= 0 || Number(item.unitPrice || 0) < 0; })) {
      toast("Complete descripcion, cantidad y precio de todos los items");
      return;
    }
    var oldActive = movementEditDraft.transaction.type === "SALE" && !movementEditDraft.transaction.deleted;
    var nextType = $("movementEditType").value;
    var nextDeleted = $("movementEditDeleted").value === "true";
    var legacyStockProducts = movementEditDraft.legacyStockProducts || {};
    var legacyFinalStock = movementEditConfirmedLegacyStock(nextType === "SALE" && !nextDeleted);
    if (legacyFinalStock === null) return;
    var productById = {};
    var editInventoryMovements = [], editStamp = nowIso();
    movementEditDraft.stockProducts.forEach(function (product) { productById[product.id] = Object.assign({}, product); });
    if (oldActive) movementEditDraft.originalItems.forEach(function (item) {
      if (isManualBasketItem(item) || !productById[item.productId] || Object.prototype.hasOwnProperty.call(legacyStockProducts, item.productId)) return;
      var applied = Math.max(0, Number(item.stockAppliedQuantity || 0));
      var restorePools = productCostPools(productById[item.productId]);
      restorePools.known += Math.max(0, Number(item.costKnownQuantity || 0)); restorePools.unknown += Math.max(0, Number(item.costUnknownQuantity || Math.max(0, applied - Number(item.costKnownQuantity || 0)))); restorePools.value += Math.max(0, Number(item.knownCostAmount || 0));
      productById[item.productId].stock = moneyPrecision(Number(productById[item.productId].stock || 0) + applied);
      applyCostPools(productById[item.productId], restorePools);
      editInventoryMovements.push({id:uid(),type:"SALE_EDIT_RESTORE",productId:item.productId,quantity:applied,knownCostQuantity:Number(item.costKnownQuantity||0),unknownCostQuantity:Number(item.costUnknownQuantity||0),knownCostValue:Number(item.knownCostAmount||0),referenceType:"SALE",referenceId:r.id,referenceLineId:item.id,createdAt:editStamp,createdBy:currentUser&&currentUser.id});
    });
    var originalItemsById = {};
    movementEditDraft.originalItems.forEach(function (item) { if (item.id) originalItemsById[item.id] = item; });
    var nextItems = movementEditDraft.items.map(function (item) {
      var next = Object.assign({}, item, { id: item.id || uid(), basketId: r.basketId });
      var originalItem = originalItemsById[next.id] || null;
      next.quantity = moneyPrecision(Number(next.quantity || 0));
      next.unitPrice = moneyPrecision(Number(next.unitPrice || 0));
      next.subtotal = moneyPrecision(next.quantity * next.unitPrice);
      next.stockAppliedQuantity = 0;
      if (nextType === "SALE" && !nextDeleted && !isManualBasketItem(next) && productById[next.productId]) {
        if (Object.prototype.hasOwnProperty.call(legacyFinalStock, next.productId)) next.stockAppliedQuantity = next.quantity;
        else {
          var available = Math.max(0, Number(productById[next.productId].stock || 0));
          next.stockAppliedQuantity = moneyPrecision(Math.min(available, next.quantity));
          var salePools=productCostPools(productById[next.productId]),unknownUsed=Math.min(salePools.unknown,next.stockAppliedQuantity),remaining=next.stockAppliedQuantity-unknownUsed,knownUsed=Math.min(salePools.known,remaining),wac=salePools.known>0?salePools.value/salePools.known:0;
          next.costUnknownQuantity=moneyPrecision(unknownUsed+Math.max(0,remaining-knownUsed));next.costKnownQuantity=moneyPrecision(knownUsed);next.unitCostSnapshot=knownUsed>0?moneyPrecision(wac):null;next.knownCostAmount=moneyPrecision(knownUsed*wac);next.costStateAtSale=knownUsed===next.stockAppliedQuantity?"KNOWN":(knownUsed>0?"PARTIAL":"UNKNOWN");next.costCoveragePct=next.stockAppliedQuantity>0?moneyPrecision(knownUsed/next.stockAppliedQuantity*100):0;
          salePools.unknown-=unknownUsed;salePools.known-=knownUsed;salePools.value=Math.max(0,salePools.value-next.knownCostAmount);
          productById[next.productId].stock = moneyPrecision(available - next.stockAppliedQuantity);
          applyCostPools(productById[next.productId],salePools);
          editInventoryMovements.push({id:uid(),type:"SALE_EDIT_APPLY",productId:next.productId,quantity:-next.stockAppliedQuantity,knownCostQuantity:-next.costKnownQuantity,unknownCostQuantity:-next.costUnknownQuantity,knownCostValue:-next.knownCostAmount,referenceType:"SALE",referenceId:r.id,referenceLineId:next.id,createdAt:editStamp,createdBy:currentUser&&currentUser.id});
        }
        delete next.stockRestorationState;
        delete next.stockRestoredQuantity;
        delete next.stockRestoredAt;
        delete next.stockRestoredBy;
        delete next.stockRestorationWarning;
      } else if (nextType === "SALE" && nextDeleted && !isManualBasketItem(next)) {
        if (Object.prototype.hasOwnProperty.call(legacyStockProducts, next.productId)) {
          next.stockRestorationState = "legacy-unchanged";
          next.stockRestoredQuantity = 0;
          next.stockRestoredAt = next.stockRestoredAt || nowIso();
          next.stockRestoredBy = next.stockRestoredBy || currentUser && currentUser.username || "";
          next.stockRestorationWarning = "Venta antigua sin delta exacto: stock sin cambios";
        } else if (oldActive && originalItem) {
          next.stockRestorationState = "restored";
          next.stockRestoredQuantity = moneyPrecision(Math.max(0, Number(originalItem.stockAppliedQuantity || 0)));
          next.stockRestoredAt = nowIso();
          next.stockRestoredBy = currentUser && currentUser.username || "";
          next.stockRestorationWarning = "";
        }
      }
      return next;
    });
    Object.keys(legacyFinalStock).forEach(function (productId) {
      if (productById[productId]) productById[productId].stock = moneyPrecision(legacyFinalStock[productId]);
    });
    var affectedProductIds = {};
    movementEditDraft.originalItems.concat(nextItems).forEach(function (item) { if (!isManualBasketItem(item) && item.productId) affectedProductIds[item.productId] = true; });
    var updatedProducts = Object.keys(affectedProductIds).map(function (productId) {
      var product = productById[productId];
      if (!product) return null;
      product.updatedAt = nowIso();
      return product;
    }).filter(Boolean);
    var amounts = hasItems ? basketSaleAmounts(nextItems, { type: r.discountType, value: r.discountValue }) : saleAmounts(parseMoney($("movementEditAmount").value));
    var manualCount = nextItems.filter(isManualBasketItem).length;
    r.amount = amounts.total;
    if (hasItems) {
      r.grossSubtotal = amounts.grossSubtotal;
      r.discountType = amounts.discountType;
      r.discountValue = amounts.discountValue;
      r.discountAmount = amounts.discountAmount;
    }
    r.unroundedAmount = amounts.unroundedAmount;
    r.roundingAdjustment = amounts.roundingAdjustment;
    r.type = nextType;
    r.paymentMethod = $("movementEditPayment").value === "__KEEP__" ? movementEditDraft.transaction.paymentMethod : $("movementEditPayment").value;
    r.businessDate = $("movementEditBusinessDate").value || r.businessDate;
    r.shiftType = $("movementEditShift").value;
    r.deleted = nextDeleted;
    r.itemCount = nextItems.length;
    r.manualItemCount = manualCount;
    r.reviewFlag = manualCount > 0;
    r.reviewReason = manualCount ? "Ticket con item manual sin registrar" : "";
    var legacyDeletionWarning = nextType === "SALE" && nextDeleted && Object.keys(legacyStockProducts).length > 0;
    if (legacyDeletionWarning) {
      r.stockReviewRequired = true;
      r.stockReversalWarning = "Venta antigua sin delta exacto; el stock quedo sin cambios";
      r.reviewReason = appendMovementReviewReason(r.reviewReason, r.stockReversalWarning);
    } else {
      r.stockReviewRequired = false;
      r.stockReversalWarning = "";
    }
    r.stockRestorationState = nextDeleted ? (legacyDeletionWarning ? "review-required" : "restored") : "applied";
    r.reviewRequired = nextDeleted || manualCount > 0;
    if (r.paymentMethod === "QR") { r.paidAmount = r.amount; r.changeAmount = 0; }
    else if (r.paidAmount !== undefined && r.paidAmount !== null) r.changeAmount = Math.max(0, Number(r.paidAmount || 0) - r.amount);
    r.adminNote = reason;
    r.editedAt = nowIso();
    r.editedBy = currentUser && currentUser.username;
    var basketRecord = movementEditDraft.basket ? Object.assign({}, movementEditDraft.basket, {
      total: r.amount, grossSubtotal: r.grossSubtotal, discountType: r.discountType,
      discountValue: r.discountValue, discountAmount: r.discountAmount,
      paymentMethod: r.paymentMethod, updatedAt: nowIso()
    }) : null;
    var auditRecord = {
      id: uid(), createdAt: nowIso(), userId: currentUser && currentUser.id, username: currentUser && currentUser.username,
      action: "MOVEMENT_ITEMS_EDITED", detail: r.id + " | " + nextItems.length + " item(s) | " + money(r.amount) + " | " + reason,
      severity: "warning"
    };
    commitMovementEditAtomic({
      transaction: r, basket: basketRecord, originalItems: movementEditDraft.originalItems,
      items: nextItems, products: updatedProducts, audit: auditRecord
      ,inventoryMovements: editInventoryMovements
    }).then(function () {
      closeMovementEdit();
      selectedMovements = {};
      expandedMovements = {};
      renderAll();
      toast("Venta e inventario actualizados");
    }).catch(function (error) { toast(error.message || "No se pudo actualizar la venta"); });
  }
  function openMovementDelete() {
    var ids = Object.keys(selectedMovements);
    if (!ids.length) { toast("Seleccione movimientos"); return; }
    $("movementDeleteSummary").textContent = "Se borraran " + ids.length + " movimiento(s). La accion queda marcada para revision admin.";
    $("movementDeleteReason").value = "";
    $("movementDeleteModal").classList.remove("hidden");
    $("movementDeleteReason").focus();
  }
  function closeMovementDelete() {
    $("movementDeleteModal").classList.add("hidden");
  }
  function deleteSelectedMovements(e) {
    if (e) e.preventDefault();
    var ids = Object.keys(selectedMovements);
    if (!ids.length) { closeMovementDelete(); toast("Seleccione movimientos"); return; }
    var reason = $("movementDeleteReason").value.trim();
    if (!reason) { toast("Motivo obligatorio"); $("movementDeleteReason").focus(); return; }
    var expectedTransactions = movementFilteredRows.filter(function (row) { return !!selectedMovements[row.id]; }).map(function (row) { return Object.assign({}, row); });
    deleteTransactionsWithStock(ids, reason, {
      expectedTransactions: expectedTransactions,
      requireExpected: true,
      auditAction: "MOVEMENTS_DELETED_REVIEW_REQUIRED",
      auditSeverity: "critical"
    }).then(function (summary) {
      selectedMovements = {};
      closeMovementDelete();
      renderAll();
      toast(summary.warning
        ? "Movimientos borrados. El stock antiguo sin delta exacto quedo marcado para revisar."
        : "Movimientos borrados y stock restituido");
    }).catch(function (error) {
      toast(error && error.message || "No se pudieron borrar los movimientos");
    });
  }
  function metricTooltip() {
    var tip = $("metricChartTooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "metricChartTooltip";
      tip.className = "metric-chart-tooltip hidden";
      document.body.appendChild(tip);
    }
    return tip;
  }
  function bindMetricCanvasHover(canvas) {
    if (!canvas || canvas.dataset.metricHoverBound === "1") return;
    canvas.dataset.metricHoverBound = "1";
    canvas.onmousemove = function (e) {
      var hit = metricCanvasHit(canvas, e);
      if (!hit) { hideMetricTooltip(); return; }
      showMetricTooltip(hit.label, e.clientX, e.clientY);
    };
    canvas.onmouseleave = hideMetricTooltip;
  }
  function showMetricTooltip(label, x, y) {
    var tip = metricTooltip();
    tip.innerHTML = label;
    tip.classList.remove("hidden");
    tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, x + 14) + "px";
    tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 8, y + 14) + "px";
  }
  function hideMetricTooltip() {
    var tip = $("metricChartTooltip");
    if (tip) tip.classList.add("hidden");
  }
  function metricCanvasPoint(canvas, e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / Math.max(1, rect.width)),
      y: (e.clientY - rect.top) * (canvas.height / Math.max(1, rect.height))
    };
  }
  function metricCanvasHit(canvas, e) {
    var p = metricCanvasPoint(canvas, e);
    var targets = canvas._metricTargets || [];
    var best = null;
    targets.forEach(function (t) {
      var d = 999999;
      if (t.type === "point") {
        d = Math.sqrt(Math.pow(p.x - t.x, 2) + Math.pow(p.y - t.y, 2));
        if (d > (t.r || 12)) return;
      } else if (t.type === "rect") {
        if (p.x < t.x || p.x > t.x + t.w || p.y < t.y || p.y > t.y + t.h) return;
        d = Math.abs((t.x + t.w / 2) - p.x);
      } else if (t.type === "slice") {
        var angle = Math.atan2(p.y - t.cy, p.x - t.cx);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;
        var dist = Math.sqrt(Math.pow(p.x - t.cx, 2) + Math.pow(p.y - t.cy, 2));
        if (dist > t.r || angle < t.start || angle > t.end) return;
        d = dist;
      }
      if (!best || d < best.d) best = { d: d, label: t.label };
    });
    return best;
  }
  function drawChart(sales, days) {
    var canvas = $("salesChart");
    var ctx = canvas.getContext("2d");
    bindMetricCanvasHover(canvas);
    canvas._metricTargets = [];
    canvas.width = Math.max(640, canvas.parentNode.clientWidth - 40);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var labels = [];
    var values = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var key = d.toISOString().slice(0, 10);
      labels.push(key.slice(5));
      values.push(sum(sales.filter(function (s) { return s.businessDate === key; }), function () { return true; }));
    }
    var max = Math.max.apply(Math, values.concat([1]));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#dcebe2";
    ctx.lineWidth = 1;
    for (var g = 0; g < 5; g++) {
      var gy = 56 + g * ((canvas.height - 82) / 4);
      ctx.beginPath();
      ctx.moveTo(34, gy);
      ctx.lineTo(canvas.width - 18, gy);
      ctx.stroke();
    }
    ctx.strokeStyle = "#24784c";
    ctx.lineWidth = 4;
    ctx.beginPath();
    values.forEach(function (v, i) {
      var x = 42 + i * ((canvas.width - 74) / Math.max(1, values.length - 1));
      var y = canvas.height - 34 - (v / max) * (canvas.height - 90);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = "#24784c";
    values.forEach(function (v, i) {
      if (!v) return;
      var x = 42 + i * ((canvas.width - 74) / Math.max(1, values.length - 1));
      var y = canvas.height - 34 - (v / max) * (canvas.height - 90);
      canvas._metricTargets.push({ type: "point", x: x, y: y, r: 14, label: "<b>" + labels[i] + "</b><span>" + money(v) + "</span>" });
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#24211d";
    ctx.font = "700 14px Arial";
    ctx.fillText("Max " + money(max), 42, 30);
  }
  function dailyMetricValues(sales, days, mode) {
    var values = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var key = d.toISOString().slice(0, 10);
      var rows = sales.filter(function (s) { return s.businessDate === key; });
      values.push(mode === "count" ? rows.length : sum(rows, function () { return true; }));
    }
    return values;
  }
  function prepareCanvas(id) {
    var canvas = $(id);
    if (!canvas) return null;
    bindMetricCanvasHover(canvas);
    canvas._metricTargets = [];
    canvas.width = Math.max(360, canvas.parentNode.clientWidth - 40);
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return { canvas: canvas, ctx: ctx };
  }
  function drawSalesCountChart(sales, days) {
    var c = prepareCanvas("salesCountChart");
    if (!c) return;
    var values = dailyMetricValues(sales, days, "count");
    var labels = [];
    for (var li = days - 1; li >= 0; li--) {
      var ld = new Date();
      ld.setDate(ld.getDate() - li);
      labels.push(ld.toISOString().slice(5, 10));
    }
    var max = Math.max.apply(Math, values.concat([1]));
    var barW = Math.max(3, (c.canvas.width - 70) / Math.max(1, values.length));
    c.ctx.fillStyle = "#eef6f1";
    c.ctx.fillRect(34, 28, c.canvas.width - 54, c.canvas.height - 58);
    c.ctx.fillStyle = "#295f9d";
    values.forEach(function (v, i) {
      var h = (v / max) * (c.canvas.height - 82);
      var x = 42 + i * barW;
      var y = c.canvas.height - 34 - h;
      var w = Math.max(2, barW - 2);
      c.ctx.fillRect(x, y, w, h);
      c.canvas._metricTargets.push({ type: "rect", x: x, y: Math.min(y, c.canvas.height - 34), w: w, h: Math.max(6, h), label: "<b>" + labels[i] + "</b><span>" + v + " venta(s)</span>" });
    });
    c.ctx.fillStyle = "#24211d";
    c.ctx.font = "700 14px Arial";
    c.ctx.fillText("Max " + max + " venta(s)", 42, 22);
  }
  function drawPaymentMixChart(cash, received, pending) {
    var c = prepareCanvas("paymentMixChart");
    if (!c) return;
    var values = [
      { label: "Efectivo", value: cash, color: "#24784c" },
      { label: "QR y tarjetas", value: received, color: "#295f9d" },
      { label: "Por revisar", value: pending, color: "#d79b30" }
    ];
    var total = values.reduce(function (a, b) { return a + Number(b.value || 0); }, 0);
    var cx = 100, cy = c.canvas.height / 2, r = 58, start = -Math.PI / 2;
    values.forEach(function (v) {
      var slice = total ? (v.value / total) * Math.PI * 2 : 0;
      c.ctx.beginPath();
      c.ctx.moveTo(cx, cy);
      c.ctx.arc(cx, cy, r, start, start + slice);
      c.ctx.closePath();
      c.ctx.fillStyle = v.color;
      c.ctx.fill();
      if (slice > 0) c.canvas._metricTargets.push({
        type: "slice", cx: cx, cy: cy, r: r, start: start, end: start + slice,
        label: "<b>" + v.label + "</b><span>" + money(v.value) + " · " + percent(v.value, total) + "</span>"
      });
      start += slice;
    });
    if (!total) {
      c.ctx.beginPath();
      c.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      c.ctx.fillStyle = "#eef0ee";
      c.ctx.fill();
    }
    values.forEach(function (v, i) {
      var y = 58 + i * 38;
      c.ctx.fillStyle = v.color;
      c.ctx.fillRect(190, y - 12, 18, 18);
      c.ctx.fillStyle = "#24211d";
      c.ctx.font = "700 13px Arial";
      c.ctx.fillText(v.label + " " + percent(v.value, total), 218, y + 2);
    });
  }
  function drawProductRevenueChart(rows) {
    var c = prepareCanvas("productRevenueChart");
    if (!c) return;
    rows = rows.slice(0, 6);
    var max = Math.max.apply(Math, rows.map(function (r) { return r.subtotal; }).concat([1]));
    c.ctx.font = "700 12px Arial";
    rows.forEach(function (r, i) {
      var y = 34 + i * 30;
      var w = (Number(r.subtotal || 0) / max) * (c.canvas.width - 190);
      c.ctx.fillStyle = "#eaf4ee";
      c.ctx.fillRect(132, y - 15, c.canvas.width - 162, 20);
      c.ctx.fillStyle = "#24784c";
      c.ctx.fillRect(132, y - 15, w, 20);
      c.canvas._metricTargets.push({
        type: "rect", x: 132, y: y - 15, w: Math.max(8, w), h: 20,
        label: "<b>" + escapeHtml(r.name || "Producto") + "</b><span>" + money(r.subtotal) + " · " + r.qty + " vendido(s)</span>"
      });
      c.ctx.fillStyle = "#24211d";
      c.ctx.fillText(String(r.name || "Producto").slice(0, 17), 12, y);
      c.ctx.fillText(money(r.subtotal), 140 + w, y);
    });
    if (!rows.length) {
      c.ctx.fillStyle = "#6f675d";
      c.ctx.font = "700 15px Arial";
      c.ctx.fillText("Sin ventas por producto", 28, 42);
    }
  }

  /* Metrics dashboard v2: every view is derived from one filtered aggregate model. */
  function metricsDateFromKey(key) {
    var parts = String(key || "").split("-").map(Number);
    return new Date(parts[0], Math.max(0, parts[1] - 1), parts[2] || 1, 12, 0, 0, 0);
  }
  function metricsShiftDate(date, days) {
    var next = new Date(date.getTime());
    next.setDate(next.getDate() + days);
    return next;
  }
  function metricsDaysBetween(from, to) {
    return Math.max(0, Math.round((metricsDateFromKey(localDateKey(to)) - metricsDateFromKey(localDateKey(from))) / 86400000));
  }
  function metricsRangeKeys(from, to) {
    var keys = [];
    var cursor = metricsDateFromKey(localDateKey(from));
    var end = localDateKey(to);
    while (localDateKey(cursor) <= end) {
      keys.push(localDateKey(cursor));
      cursor = metricsShiftDate(cursor, 1);
    }
    return keys;
  }
  function metricsMonthRangeKeys(from, to) {
    var keys = [];
    var cursor = new Date(from.getFullYear(), from.getMonth(), 1, 12, 0, 0, 0);
    var endKey = localDateKey(to).slice(0, 7);
    while (localDateKey(cursor).slice(0, 7) <= endKey) {
      keys.push(localDateKey(cursor).slice(0, 7));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return keys;
  }
  function metricsLatestCompleteClosureDate(closures, beforeDate) {
    var candidates = {};
    (closures || []).forEach(function (closure) {
      var date = String(closure.businessDate || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= beforeDate) return;
      if ((closure.closureKind || "COMPLETE") !== "COMPLETE") return;
      candidates[date] = true;
    });
    return Object.keys(candidates).filter(function (date) {
      return closureIsComplete(closures, date, "DAY");
    }).sort().pop() || "";
  }
  function metricsLatestPriorSaleDate(activeSales, beforeDate) {
    var dates = {};
    (activeSales || []).forEach(function (sale) {
      var date = inferredBusinessDate(sale);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date < beforeDate) dates[date] = true;
    });
    return Object.keys(dates).sort().pop() || "";
  }
  function metricsComparablePriorYearDate(now) {
    var priorYear = now.getFullYear() - 1;
    var lastDay = new Date(priorYear, now.getMonth() + 1, 0).getDate();
    return new Date(priorYear, now.getMonth(), Math.min(now.getDate(), lastDay), 12, 0, 0, 0);
  }
  function metricsPeriodSpec(mode, closures, activeSales) {
    var now = metricsDateFromKey(today());
    var currentStart = new Date(now.getTime());
    var previousStart = null;
    var previousEnd = null;
    var label;
    var compareLabel;
    var hasComparison = true;
    var seriesGranularity = "day";
    if (mode === "today") {
      var todayKey = localDateKey(now);
      var previousDate = metricsLatestCompleteClosureDate(closures, todayKey);
      compareLabel = "Ultimo cierre terminado";
      if (!previousDate) {
        previousDate = metricsLatestPriorSaleDate(activeSales, todayKey);
        compareLabel = previousDate ? "Ultimo dia anterior con ventas" : "Dia anterior";
      }
      previousStart = metricsDateFromKey(previousDate || localDateKey(metricsShiftDate(now, -1)));
      previousEnd = new Date(previousStart.getTime());
      label = "Hoy";
    } else if (mode === "week") {
      var mondayOffset = (now.getDay() + 6) % 7;
      currentStart = metricsShiftDate(now, -mondayOffset);
      previousStart = metricsShiftDate(currentStart, -7);
      previousEnd = metricsShiftDate(previousStart, mondayOffset);
      label = "Esta semana";
      compareLabel = "Mismos dias de la semana anterior";
    } else if (mode === "year") {
      currentStart = new Date(now.getFullYear(), 0, 1, 12, 0, 0, 0);
      previousStart = new Date(now.getFullYear() - 1, 0, 1, 12, 0, 0, 0);
      previousEnd = metricsComparablePriorYearDate(now);
      label = "Este ano";
      compareLabel = "Mismo tramo del ano anterior";
      seriesGranularity = "month";
    } else if (mode === "all") {
      var saleDates = (activeSales || []).map(inferredBusinessDate).filter(function (date) {
        return /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= localDateKey(now);
      }).sort();
      currentStart = metricsDateFromKey(saleDates[0] || localDateKey(now));
      label = "Todo el historial";
      compareLabel = "";
      hasComparison = false;
      seriesGranularity = "month";
    } else {
      mode = "month";
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 12, 0, 0, 0);
      var elapsed = now.getDate() - 1;
      var previousLastDay = new Date(previousStart.getFullYear(), previousStart.getMonth() + 1, 0).getDate();
      previousEnd = new Date(previousStart.getFullYear(), previousStart.getMonth(), Math.min(previousLastDay, elapsed + 1), 12, 0, 0, 0);
      label = "Este mes";
      compareLabel = "Mismo tramo del mes anterior";
    }
    var currentKeys = seriesGranularity === "month" ? metricsMonthRangeKeys(currentStart, now) : metricsRangeKeys(currentStart, now);
    var previousKeys = !hasComparison ? [] : seriesGranularity === "month" ? metricsMonthRangeKeys(previousStart, previousEnd) : metricsRangeKeys(previousStart, previousEnd);
    return {
      mode: mode,
      currentFrom: localDateKey(currentStart),
      currentTo: localDateKey(now),
      previousFrom: hasComparison ? localDateKey(previousStart) : "",
      previousTo: hasComparison ? localDateKey(previousEnd) : "",
      currentKeys: currentKeys,
      previousKeys: previousKeys,
      currentDayCount: metricsDaysBetween(currentStart, now) + 1,
      previousDayCount: hasComparison ? metricsDaysBetween(previousStart, previousEnd) + 1 : 0,
      seriesGranularity: seriesGranularity,
      hasComparison: hasComparison,
      label: label,
      compareLabel: compareLabel
    };
  }
  function metricsSelectedFilters() {
    return {
      period: $("metricsPeriod") ? $("metricsPeriod").value : "month",
      shift: $("metricsShift") ? $("metricsShift").value : "",
      employee: $("metricsEmployee") ? $("metricsEmployee").value : "",
      category: $("metricsCategory") ? $("metricsCategory").value : "",
      payment: $("metricsPayment") ? $("metricsPayment").value : ""
    };
  }
  function populateMetricsFilterOptions(products, users) {
    var employeeSelect = $("metricsEmployee");
    var categorySelect = $("metricsCategory");
    var riskCategorySelect = $("metricsStockRiskCategory");
    var categories = {};
    (products || []).forEach(function (p) { if (p.active !== false) categories[productCategory(p)] = true; });
    var categoryNames = Object.keys(categories).sort(function (a, b) { return a.localeCompare(b); });
    if (employeeSelect) {
      var employeeValue = employeeSelect.value;
      employeeSelect.innerHTML = "<option value=''>Todos</option>" + (users || []).filter(function (u) { return u.active !== false; }).map(function (u) {
        return "<option value='" + escapeHtml(u.id) + "'>" + escapeHtml(u.displayName || u.username) + "</option>";
      }).join("");
      employeeSelect.value = employeeValue;
    }
    if (categorySelect) {
      var categoryValue = categorySelect.value;
      categorySelect.innerHTML = "<option value=''>Todas</option>" + categoryNames.map(function (category) {
        return "<option value='" + escapeHtml(category) + "'>" + escapeHtml(category) + "</option>";
      }).join("");
      categorySelect.value = categoryValue;
    }
    if (riskCategorySelect) {
      var preferredRiskCategory = metricsStockRiskCategory;
      if (!categories[preferredRiskCategory]) preferredRiskCategory = categories.Alimentos ? "Alimentos" : "";
      riskCategorySelect.innerHTML = "<option value=''>Todas</option>" + categoryNames.map(function (category) {
        return "<option value='" + escapeHtml(category) + "'>" + escapeHtml(category) + "</option>";
      }).join("");
      riskCategorySelect.value = preferredRiskCategory;
      metricsStockRiskCategory = preferredRiskCategory;
    }
  }
  function metricGrowth(current, previous) {
    current = Number(current || 0);
    previous = Number(previous || 0);
    if (!previous) return { value: null, label: current ? "Sin base comparable" : "Sin cambios", tone: "neutral", arrow: "•" };
    var value = ((current - previous) / Math.abs(previous)) * 100;
    if (Math.abs(value) < 0.05) return { value: 0, label: "0% vs anterior", tone: "neutral", arrow: "→" };
    return {
      value: value,
      label: (value > 0 ? "+" : "") + Math.round(value * 10) / 10 + "% vs anterior",
      tone: value > 0 ? "positive" : "negative",
      arrow: value > 0 ? "↑" : "↓"
    };
  }
  function metricNoComparison(label) {
    return { value: null, label: label || "Sin periodo de comparacion", tone: "neutral", arrow: "-" };
  }
  function metricsSaleUserId(sale) {
    return String(sale.userId || sale.createdBy || "");
  }
  function metricsBuildBasketMaps(items, products) {
    var productById = {};
    var itemsByBasket = {};
    var categoriesByBasket = {};
    (products || []).forEach(function (product) { productById[product.id] = product; });
    (items || []).forEach(function (item) {
      if (!itemsByBasket[item.basketId]) itemsByBasket[item.basketId] = [];
      itemsByBasket[item.basketId].push(item);
      var product = productById[item.productId] || {};
      var category = productCategory(product);
      if (!categoriesByBasket[item.basketId]) categoriesByBasket[item.basketId] = {};
      categoriesByBasket[item.basketId][category] = true;
    });
    return { productById: productById, itemsByBasket: itemsByBasket, categoriesByBasket: categoriesByBasket };
  }
  function metricsSaleMatches(sale, filters, period, basketMaps) {
    var date = inferredBusinessDate(sale);
    if (date < period.currentFrom || date > period.currentTo) return false;
    if (filters.shift && inferredShift(sale) !== filters.shift) return false;
    if (filters.employee && metricsSaleUserId(sale) !== filters.employee) return false;
    if (filters.payment && paymentReportingGroup(sale.paymentMethod) !== filters.payment) return false;
    return true;
  }
  function metricsSaleMatchesPrevious(sale, filters, period, basketMaps) {
    if (!period.hasComparison) return false;
    var date = inferredBusinessDate(sale);
    if (date < period.previousFrom || date > period.previousTo) return false;
    if (filters.shift && inferredShift(sale) !== filters.shift) return false;
    if (filters.employee && metricsSaleUserId(sale) !== filters.employee) return false;
    if (filters.payment && paymentReportingGroup(sale.paymentMethod) !== filters.payment) return false;
    return true;
  }
  function metricsProjectSaleCategory(sale, filters, maps) {
    if (!filters.category) return sale;
    var basketRows = maps.itemsByBasket[sale.basketId] || [];
    var basketSubtotal = basketRows.reduce(function (total, item) { return total + Math.max(0, Number(item.subtotal || 0)); }, 0);
    var selectedSubtotal = basketRows.reduce(function (total, item) {
      var product = maps.productById[item.productId] || {};
      return productCategory(product) === filters.category ? total + Number(item.subtotal || 0) : total;
    }, 0);
    var amount = basketSubtotal > 0 ? Number(sale.amount || 0) * selectedSubtotal / basketSubtotal : 0;
    if (amount <= 0) return null;
    return Object.assign({}, sale, { amount: amount, metricsCategoryAmount: true, metricsCategory: filters.category, metricsCategorySubtotal: selectedSubtotal, metricsBasketSubtotal: basketSubtotal });
  }
  function metricsAllocatedItemRevenue(sale, item, basketItems, maps) {
    if (sale && sale.metricsCategory) {
      var product = maps && maps.productById[item && item.productId] || {};
      if (productCategory(product) !== sale.metricsCategory) return 0;
    }
    var rows = basketItems || [];
    var basketSubtotal = Number(sale && sale.metricsCategorySubtotal || 0);
    if (!(basketSubtotal > 0)) basketSubtotal = Number(sale && sale.metricsBasketSubtotal || 0);
    if (!(basketSubtotal > 0)) basketSubtotal = rows.reduce(function (total, row) { return total + Math.max(0, Number(row.subtotal || 0)); }, 0);
    if (!(basketSubtotal > 0)) return 0;
    return Math.max(0, Number(sale && sale.amount || 0)) * Math.max(0, Number(item && item.subtotal || 0)) / basketSubtotal;
  }
  function metricsBasketCostSnapshot(item) {
    if (!item || isManualBasketItem(item)) return { state: "UNKNOWN", knownQuantity: 0, unknownQuantity: Math.max(0, Number(item && item.quantity || 0)), knownCostAmount: 0 };
    var quantity = Math.max(0, Number(item.quantity || 0));
    var knownQuantity = Math.max(0, Math.min(quantity, Number(item.costKnownQuantity || 0)));
    var unknownQuantity = Math.max(0, Number(item.costUnknownQuantity));
    if (!isFinite(unknownQuantity)) unknownQuantity = Math.max(0, quantity - knownQuantity);
    var hasKnownCostAmount = item.knownCostAmount !== undefined && item.knownCostAmount !== null && item.knownCostAmount !== "" && isFinite(Number(item.knownCostAmount)) && Number(item.knownCostAmount) >= 0;
    var knownCostAmount = hasKnownCostAmount ? Number(item.knownCostAmount) : NaN;
    if (!hasKnownCostAmount) {
      var unitCost = Number(item.unitCostSnapshot);
      var hasUnitCost = item.unitCostSnapshot !== undefined && item.unitCostSnapshot !== null && item.unitCostSnapshot !== "" && isFinite(unitCost) && unitCost >= 0;
      if (hasUnitCost) { knownCostAmount = unitCost * knownQuantity; hasKnownCostAmount = true; }
    }
    var state = String(item.costStateAtSale || "").toUpperCase();
    if (!state) state = knownQuantity >= quantity && quantity > 0 ? "KNOWN" : knownQuantity > 0 ? "PARTIAL" : "UNKNOWN";
    if (["KNOWN", "PARTIAL", "UNKNOWN"].indexOf(state) < 0) state = "UNKNOWN";
    if (!knownQuantity || !hasKnownCostAmount || knownCostAmount < 0) { knownQuantity = 0; knownCostAmount = 0; state = "UNKNOWN"; }
    return { state: state, knownQuantity: knownQuantity, unknownQuantity: Math.max(unknownQuantity, quantity - knownQuantity), knownCostAmount: knownCostAmount };
  }
  function metricsDaysSince(dateKey) {
    if (!dateKey) return null;
    return metricsDaysBetween(metricsDateFromKey(dateKey), metricsDateFromKey(today()));
  }
  function metricsAggregateProducts(currentSales, previousSales, allSales, maps, period, filters) {
    var currentByBasket = {};
    var previousByBasket = {};
    var allByBasket = {};
    currentSales.forEach(function (sale) { if (sale.basketId) currentByBasket[sale.basketId] = sale; });
    previousSales.forEach(function (sale) { if (sale.basketId) previousByBasket[sale.basketId] = sale; });
    allSales.forEach(function (sale) { if (sale.basketId) allByBasket[sale.basketId] = sale; });
    var rowsByKey = {};
    var previousByKey = {};
    var lastSaleByKey = {};
    var totalItemRows = 0;
    var costedItemRows = 0;
    var itemizedRevenue = 0;
    var knownCostRevenue = 0;
    var knownCogs = 0;
    var coveredGrossProfit = 0;
    function keyFor(item) { return basketItemIdentityKey(item); }
    Object.keys(maps.itemsByBasket).forEach(function (basketId) {
      var sale = allByBasket[basketId];
      if (!sale) return;
      maps.itemsByBasket[basketId].forEach(function (item) {
        var key = keyFor(item);
        var date = inferredBusinessDate(sale);
        if (!lastSaleByKey[key] || date > lastSaleByKey[key]) lastSaleByKey[key] = date;
      });
    });
    Object.keys(currentByBasket).forEach(function (basketId) {
      var sale = currentByBasket[basketId];
      var basketRows = maps.itemsByBasket[basketId] || [];
      basketRows.forEach(function (item) {
        var key = keyFor(item);
        var product = maps.productById[item.productId] || {};
        if (filters.category && productCategory(product) !== filters.category) return;
        if (!rowsByKey[key]) rowsByKey[key] = {
          id: isManualBasketItem(item) ? key : (item.productId || key), name: item.productName || product.name || "Producto", category: productCategory(product),
          units: 0, revenue: 0, profit: 0, costComplete: true, knownCostRevenue: 0, knownCogs: 0, unknownRevenue: 0, currentStock: Number(product.stock || 0),
          unitType: product.unitType || item.unitType || "unidad", currentPrice: Number(product.price || item.unitPrice || 0),
          amRevenue: 0, pmRevenue: 0
        };
        var row = rowsByKey[key];
        var quantity = Number(item.quantity || 0);
        var revenue = metricsAllocatedItemRevenue(sale, item, basketRows, maps);
        var snapshot = metricsBasketCostSnapshot(item);
        var knownRatio = quantity > 0 ? Math.min(1, snapshot.knownQuantity / quantity) : 0;
        var coveredRevenue = revenue * knownRatio;
        row.units += quantity;
        row.revenue += revenue;
        row[inferredShift(sale) === "PM" ? "pmRevenue" : "amRevenue"] += revenue;
        totalItemRows++;
        itemizedRevenue += revenue;
        row.knownCostRevenue += coveredRevenue;
        row.knownCogs += snapshot.knownCostAmount;
        row.unknownRevenue += Math.max(0, revenue - coveredRevenue);
        knownCostRevenue += coveredRevenue;
        knownCogs += snapshot.knownCostAmount;
        coveredGrossProfit += coveredRevenue - snapshot.knownCostAmount;
        if (snapshot.state === "KNOWN" && knownRatio >= 0.999999) costedItemRows++;
        else row.costComplete = false;
      });
    });
    Object.keys(previousByBasket).forEach(function (basketId) {
      var previousSale = previousByBasket[basketId];
      var basketRows = maps.itemsByBasket[basketId] || [];
      basketRows.forEach(function (item) {
        var key = keyFor(item);
        var product = maps.productById[item.productId] || {};
        if (filters.category && productCategory(product) !== filters.category) return;
        if (!previousByKey[key]) previousByKey[key] = { units: 0, revenue: 0 };
        previousByKey[key].units += Number(item.quantity || 0);
        previousByKey[key].revenue += metricsAllocatedItemRevenue(previousSale, item, basketRows, maps);
      });
    });
    var rows = Object.keys(rowsByKey).map(function (key) {
      var row = rowsByKey[key];
      var previous = previousByKey[key] || { units: 0, revenue: 0 };
      row.previousUnits = previous.units;
      row.previousRevenue = previous.revenue;
      row.trend = period.hasComparison ? metricGrowth(row.units, previous.units) : metricNoComparison("Todo el historial");
      row.lastSale = lastSaleByKey[key] || "";
      row.daysSinceLastSale = metricsDaysSince(row.lastSale);
      row.profit = row.knownCostRevenue > 0 ? row.knownCostRevenue - row.knownCogs : null;
      row.margin = row.profit == null || !row.knownCostRevenue ? null : (row.profit / row.knownCostRevenue) * 100;
      row.costCoverage = row.revenue > 0 ? row.knownCostRevenue / row.revenue : 0;
      row.velocity = row.units / Math.max(1, period.currentDayCount);
      return row;
    });
    return {
      rows: rows,
      totalUnits: rows.reduce(function (total, row) { return total + row.units; }, 0),
      totalItemRows: totalItemRows,
      costedItemRows: costedItemRows,
      itemizedRevenue: itemizedRevenue,
      knownCostRevenue: knownCostRevenue,
      knownCogs: knownCogs,
      coveredGrossProfit: coveredGrossProfit,
      allCostsAvailable: totalItemRows > 0 && costedItemRows === totalItemRows
    };
  }
  function metricsAggregatePairs(currentSales, maps) {
    var saleBaskets = {};
    currentSales.forEach(function (sale) { if (sale.basketId) saleBaskets[sale.basketId] = true; });
    var pairs = {};
    var multiProductTickets = 0;
    Object.keys(saleBaskets).forEach(function (basketId) {
      var unique = {};
      (maps.itemsByBasket[basketId] || []).forEach(function (item) {
        var key = basketItemIdentityKey(item);
        if (!unique[key]) unique[key] = { id: key, name: item.productName || (maps.productById[item.productId] || {}).name || "Producto", product: maps.productById[item.productId] || {} };
      });
      var rows = Object.keys(unique).map(function (key) { return unique[key]; });
      if (rows.length > 1) multiProductTickets++;
      for (var i = 0; i < rows.length; i++) {
        for (var j = i + 1; j < rows.length; j++) {
          var ordered = [rows[i], rows[j]].sort(function (a, b) { return a.id.localeCompare(b.id); });
          var pairKey = ordered[0].id + "|" + ordered[1].id;
          if (!pairs[pairKey]) pairs[pairKey] = {
            first: ordered[0].name, second: ordered[1].name, count: 0,
            separatePrice: Number(ordered[0].product.price || 0) + Number(ordered[1].product.price || 0)
          };
          pairs[pairKey].count++;
        }
      }
    });
    return Object.keys(pairs).map(function (key) {
      pairs[key].ticketShare = currentSales.length ? pairs[key].count / currentSales.length : 0;
      pairs[key].multiTicketShare = multiProductTickets ? pairs[key].count / multiProductTickets : 0;
      return pairs[key];
    }).sort(function (a, b) {
      return b.count - a.count || (a.first + a.second).localeCompare(b.first + b.second);
    });
  }
  function metricsBuildInventory(products, productRows, allSales, maps, period, filters) {
    var statsById = {};
    productRows.forEach(function (row) { statsById[row.id] = row; });
    var lastById = {};
    allSales.forEach(function (sale) {
      (maps.itemsByBasket[sale.basketId] || []).forEach(function (item) {
        var id = basketItemIdentityKey(item);
        var date = inferredBusinessDate(sale);
        if (!lastById[id] || date > lastById[id]) lastById[id] = date;
      });
    });
    var risks = [];
    var dead = [];
    (products || []).filter(function (product) { return product.active !== false; }).forEach(function (product) {
      var category = productCategory(product);
      var stat = statsById[product.id];
      var stock = Number(product.stock || 0);
      var velocity = stat ? stat.velocity : 0;
      var remainingDays = stock <= 0 ? 0 : velocity > 0 ? stock / velocity : Infinity;
      var threshold = Number(product.minStock || 0) || 2;
      var riskTone = stock <= 0 || remainingDays < 3 ? "red" : remainingDays <= 7 || stock <= threshold ? "amber" : "normal";
      if (stock <= threshold || (velocity > 0 && remainingDays <= 7)) {
        risks.push({
          id: product.id, name: product.name || "Producto", category: category, stock: stock, unitType: product.unitType || "unidad",
          velocity: velocity, remainingDays: remainingDays, tone: riskTone
        });
      }
      var lastSale = lastById[product.id] || "";
      var daysSince = metricsDaysSince(lastSale);
      var createdDate = String(product.createdAt || product.addedAt || "").slice(0, 10);
      var ageDays = /^\d{4}-\d{2}-\d{2}$/.test(createdDate) ? metricsDaysSince(createdDate) : null;
      var retailValue = Math.max(0, stock) * Number(product.price || 0);
      var oldEnough = ageDays == null || ageDays >= 14;
      if (stock > 0 && oldEnough && (daysSince == null || daysSince >= 21 || velocity < 0.05)) {
        dead.push({
          id: product.id, name: product.name || "Producto", category: category, stock: stock, unitType: product.unitType || "unidad",
          velocity: velocity, lastSale: lastSale, daysSince: daysSince, retailValue: retailValue, ageDays: ageDays
        });
      }
    });
    risks.sort(function (a, b) { return a.remainingDays - b.remainingDays || a.stock - b.stock; });
    dead.sort(function (a, b) { return (b.daysSince == null ? 99999 : b.daysSince) - (a.daysSince == null ? 99999 : a.daysSince) || b.retailValue - a.retailValue; });
    return { risks: risks, dead: dead };
  }
  function metricsDateBucket(date, granularity) {
    date = String(date || "").slice(0, 10);
    return granularity === "month" ? date.slice(0, 7) : date;
  }
  function metricsSeriesForKeys(sales, keys, granularity, maps) {
    return keys.map(function (key) {
      var rows = sales.filter(function (sale) { return metricsDateBucket(inferredBusinessDate(sale), granularity) === key; });
      var revenue = sum(rows, function () { return true; });
      var knownRevenue = 0;
      var knownCost = 0;
      rows.forEach(function (sale) {
        var basketRows = maps && maps.itemsByBasket[sale.basketId] || [];
        basketRows.forEach(function (item) {
          var snapshot = metricsBasketCostSnapshot(item);
          var quantity = Math.max(0, Number(item.quantity || 0));
          var ratio = quantity > 0 ? Math.min(1, snapshot.knownQuantity / quantity) : 0;
          var allocatedRevenue = metricsAllocatedItemRevenue(sale, item, basketRows, maps);
          if (allocatedRevenue <= 0) return;
          knownRevenue += allocatedRevenue * ratio;
          knownCost += snapshot.knownCostAmount;
        });
      });
      return { key: key, revenue: revenue, transactions: rows.length, average: rows.length ? revenue / rows.length : 0, profit: knownRevenue > 0 ? knownRevenue - knownCost : 0, profitCoverage: revenue > 0 ? knownRevenue / revenue : 0 };
    });
  }
  function metricsBuildModel(data, filters) {
    var transactions = data[0] || [];
    var baskets = data[1] || [];
    var basketItems = data[2] || [];
    var products = data[3] || [];
    var users = data[4] || [];
    var closures = data[5] || [];
    var auditRows = data[6] || [];
    var weatherRows = data[7] || [];
    var maps = metricsBuildBasketMaps(basketItems, products);
    var activeSales = transactions.filter(function (transaction) { return transaction.type === "SALE" && !transaction.deleted; });
    var period = metricsPeriodSpec(filters.period, closures, activeSales);
    var currentSales = activeSales.filter(function (sale) { return metricsSaleMatches(sale, filters, period, maps); }).map(function (sale) { return metricsProjectSaleCategory(sale, filters, maps); }).filter(Boolean);
    var previousSales = activeSales.filter(function (sale) { return metricsSaleMatchesPrevious(sale, filters, period, maps); }).map(function (sale) { return metricsProjectSaleCategory(sale, filters, maps); }).filter(Boolean);
    var currentRevenue = sum(currentSales, function () { return true; });
    var previousRevenue = sum(previousSales, function () { return true; });
    var currentAverage = currentSales.length ? currentRevenue / currentSales.length : 0;
    var previousAverage = previousSales.length ? previousRevenue / previousSales.length : 0;
    var productsAggregate = metricsAggregateProducts(currentSales, previousSales, activeSales, maps, period, filters);
    var itemizedSales = currentSales.filter(function (sale) { return sale.basketId && (maps.itemsByBasket[sale.basketId] || []).length; });
    var itemizedRevenue = sum(itemizedSales, function () { return true; });
    var salesCostCoverage = currentRevenue > 0 ? Math.max(0, Math.min(1, productsAggregate.knownCostRevenue / currentRevenue)) : 0;
    var profitAvailable = productsAggregate.knownCostRevenue > 0;
    var profitComplete = currentSales.length > 0 && itemizedSales.length === currentSales.length && productsAggregate.allCostsAvailable && salesCostCoverage >= 0.999999;
    var grossProfit = profitAvailable ? productsAggregate.coveredGrossProfit : null;
    var grossMargin = profitAvailable && productsAggregate.knownCostRevenue ? (grossProfit / productsAggregate.knownCostRevenue) * 100 : null;
    var activeProductsForCoverage = products.filter(function (product) { return product.active !== false; });
    var knownSkuCount = activeProductsForCoverage.filter(function (product) { return normalizedProductCostState(product) === "KNOWN" && productCostCoverage(product) >= 99.999; }).length;
    var estimatedSkuCount = activeProductsForCoverage.filter(function (product) { return normalizedProductCostState(product) === "REPLACEMENT_ONLY" || (normalizedProductCostState(product) === "KNOWN" && productCostCoverage(product) < 99.999); }).length;
    var unknownSkuCount = Math.max(0, activeProductsForCoverage.length - knownSkuCount - estimatedSkuCount);
    var paymentTotals = { Efectivo: 0, QR: 0 };
    currentSales.forEach(function (sale) {
      var parts = salePaymentParts(sale);
      paymentTotals.Efectivo += parts.cash;
      paymentTotals.QR += parts.qr;
    });
    var weekday = [0, 0, 0, 0, 0, 0, 0];
    var heatmap = [];
    for (var wd = 0; wd < 7; wd++) heatmap.push(new Array(16).fill(0));
    currentSales.forEach(function (sale) {
      var businessDay = metricsDateFromKey(inferredBusinessDate(sale));
      var created = new Date(sale.createdAt || inferredBusinessDate(sale) + "T12:00:00");
      var mondayIndex = (businessDay.getDay() + 6) % 7;
      weekday[mondayIndex] += Number(sale.amount || 0);
      var hour = created.getHours();
      if (hour >= 6 && hour <= 21) heatmap[mondayIndex][hour - 6] += Number(sale.amount || 0);
    });
    var shiftByDay = period.currentKeys.map(function (key) {
      var rows = currentSales.filter(function (sale) { return metricsDateBucket(inferredBusinessDate(sale), period.seriesGranularity) === key; });
      return {
        key: key,
        AM: sum(rows, function (sale) { return inferredShift(sale) === "AM"; }),
        PM: sum(rows, function (sale) { return inferredShift(sale) === "PM"; })
      };
    });
    var categories = {};
    productsAggregate.rows.forEach(function (row) {
      var category = row.category || "General";
      if (!categories[category]) categories[category] = { name: category, AM: 0, PM: 0, revenue: 0 };
      categories[category].AM += row.amRevenue;
      categories[category].PM += row.pmRevenue;
      categories[category].revenue += row.revenue;
    });
    var categoryRows = Object.keys(categories).map(function (key) { return categories[key]; }).sort(function (a, b) { return b.revenue - a.revenue; });
    var inventory = metricsBuildInventory(products, productsAggregate.rows, activeSales, maps, period, filters);
    var currentClosures = closures.filter(function (closure) {
      return (closure.closureKind || "COMPLETE") === "COMPLETE" && closure.businessDate >= period.currentFrom && closure.businessDate <= period.currentTo;
    });
    var closureDifferences = currentClosures.filter(function (closure) {
      return Math.abs(Number(closure.differenceCash || 0)) > 0.009 || Math.abs(Number(closure.differenceTransfer || 0)) > 0.009;
    });
    var deletedSales = transactions.filter(function (transaction) {
      var date = inferredBusinessDate(transaction);
      return transaction.type === "SALE" && transaction.deleted && date >= period.currentFrom && date <= period.currentTo;
    });
    var suspiciousSales = currentSales.filter(function (sale) { return Number(sale.amount || 0) > Math.max(99999, currentAverage * 4); });
    var pairs = metricsAggregatePairs(currentSales, maps);
    var currentSeries = metricsSeriesForKeys(currentSales, period.currentKeys, period.seriesGranularity, maps);
    var previousSeries = metricsSeriesForKeys(previousSales, period.previousKeys, period.seriesGranularity, maps);
    var bestDay = currentSeries.reduce(function (best, row) { return row.revenue > best.revenue ? row : best; }, { key: "", revenue: 0 });
    var model = {
      filters: filters,
      period: period,
      products: products,
      users: users,
      currentSales: currentSales,
      previousSales: previousSales,
      currentRevenue: currentRevenue,
      previousRevenue: previousRevenue,
      currentAverage: currentAverage,
      previousAverage: previousAverage,
      revenueGrowth: period.hasComparison ? metricGrowth(currentRevenue, previousRevenue) : metricNoComparison("Todo el historial"),
      ticketGrowth: period.hasComparison ? metricGrowth(currentSales.length, previousSales.length) : metricNoComparison("Todo el historial"),
      averageGrowth: period.hasComparison ? metricGrowth(currentAverage, previousAverage) : metricNoComparison("Todo el historial"),
      profitAvailable: profitAvailable,
      profitComplete: profitComplete,
      grossProfit: grossProfit,
      grossMargin: grossMargin,
      knownCostRevenue: productsAggregate.knownCostRevenue,
      knownCogs: productsAggregate.knownCogs,
      salesCostCoverage: salesCostCoverage,
      skuCostCoverage: activeProductsForCoverage.length ? (knownSkuCount + estimatedSkuCount) / activeProductsForCoverage.length : 0,
      exactSkuCostCoverage: activeProductsForCoverage.length ? knownSkuCount / activeProductsForCoverage.length : 0,
      knownSkuCount: knownSkuCount,
      estimatedSkuCount: estimatedSkuCount,
      unknownSkuCount: unknownSkuCount,
      activeSkuCount: activeProductsForCoverage.length,
      itemizedCoverage: currentRevenue ? Math.max(0, Math.min(1, itemizedRevenue / currentRevenue)) : 0,
      productsAggregate: productsAggregate,
      pairs: pairs,
      inventory: inventory,
      paymentTotals: paymentTotals,
      weekday: weekday,
      heatmap: heatmap,
      shiftByDay: shiftByDay,
      categoryRows: categoryRows,
      currentSeries: currentSeries,
      previousSeries: previousSeries,
      bestDay: bestDay,
      closureDifferences: closureDifferences,
      deletedSales: deletedSales,
      suspiciousSales: suspiciousSales,
      auditRows: auditRows,
      weatherRows: weatherRows,
      signature: [period.currentFrom, period.currentTo, filters.shift, filters.employee, filters.category, filters.payment, currentSales.length, currentRevenue].join("|")
    };
    return model;
  }
  function metricsSparkline(values, tone) {
    values = (values || []).map(Number);
    if (!values.length) values = [0, 0];
    var max = Math.max.apply(Math, values.concat([1]));
    var min = Math.min.apply(Math, values.concat([0]));
    var points = values.map(function (value, index) {
      var x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      var y = 30 - ((value - min) / Math.max(1, max - min)) * 25;
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    return "<svg class='metric-sparkline " + (tone || "neutral") + "' viewBox='0 0 100 34' preserveAspectRatio='none' aria-hidden='true'><polyline points='" + points + "'></polyline></svg>";
  }
  function metricsTrendHtml(trend) {
    return "<span class='metric-trend " + trend.tone + "'><b>" + trend.arrow + "</b> " + escapeHtml(trend.label) + "</span>";
  }
  function renderMetricsOverview(model) {
    if ($("metricsPeriodCaption")) {
      $("metricsPeriodCaption").innerHTML = "<b>" + escapeHtml(model.period.label) + ":</b> " + model.period.currentFrom + " al " + model.period.currentTo
        + (model.period.hasComparison ? " <span>comparado con " + escapeHtml(model.period.compareLabel) + ": " + model.period.previousFrom + " al " + model.period.previousTo + "</span>" : " <span>sin periodo anterior: incluye todos los movimientos guardados</span>");
    }
    var revenueSeries = model.currentSeries.map(function (row) { return row.revenue; });
    var ticketSeries = model.currentSeries.map(function (row) { return row.transactions; });
    var avgSeries = model.currentSeries.map(function (row) { return row.average; });
    var profitValue = model.profitAvailable ? money(model.grossProfit) : "Sin costos conocidos";
    var marginValue = model.profitAvailable ? (Math.round(model.grossMargin * 10) / 10) + "%" : "Sin costos conocidos";
    var profitCaption = model.profitAvailable
      ? (model.profitComplete ? "Cobertura completa" : "Parcial · " + Math.round(model.salesCostCoverage * 100) + "% de ventas cubiertas")
      : "No se incluyen costos desconocidos";
    var comparisonCard = model.period.hasComparison
      ? "<article class='metric-kpi growth-kpi'><div class='metric-kpi-label'><span>Crecimiento de ventas</span><i title='Cambio de ventas contra el periodo anterior indicado arriba'>?</i></div><strong class='" + model.revenueGrowth.tone + "'>" + (model.revenueGrowth.value == null ? "Sin base" : (model.revenueGrowth.value > 0 ? "+" : "") + Math.round(model.revenueGrowth.value * 10) / 10 + "%") + "</strong>" + metricsTrendHtml(model.averageGrowth) + metricsSparkline(avgSeries, model.averageGrowth.tone) + "</article>"
      : "<article class='metric-kpi growth-kpi'><div class='metric-kpi-label'><span>Historial analizado</span><i title='Cantidad de dias entre la primera venta guardada y hoy'>?</i></div><strong>" + model.period.currentDayCount + (model.period.currentDayCount === 1 ? " dia" : " dias") + "</strong><span class='metric-trend neutral'>Desde " + model.period.currentFrom + "</span>" + metricsSparkline(avgSeries, "neutral") + "</article>";
    $("metricsKpis").innerHTML = ""
      + "<article class='metric-kpi primary-kpi'><div class='metric-kpi-label'><span>Ventas netas</span><i title='Ventas activas; no incluye movimientos borrados'>?</i></div><strong>" + money(model.currentRevenue) + "</strong>" + metricsTrendHtml(model.revenueGrowth) + metricsSparkline(revenueSeries, model.revenueGrowth.tone) + "</article>"
      + "<article class='metric-kpi'><div class='metric-kpi-label'><span>Ganancia bruta cubierta</span><i title='Ventas con costo conocido menos su costo guardado al vender. No inventa costos para ventas antiguas o desconocidas.'>?</i></div><strong class='" + (model.profitComplete ? "" : "metric-partial") + "'>" + profitValue + "</strong><span class='metric-trend neutral'>" + escapeHtml(profitCaption) + "</span>" + metricsSparkline([], "neutral") + "</article>"
      + "<article class='metric-kpi'><div class='metric-kpi-label'><span>Margen bruto cubierto</span><i title='Ganancia dividida solamente por la facturacion que tiene costo historico conocido'>?</i></div><strong class='" + (model.profitComplete ? "" : "metric-partial") + "'>" + marginValue + "</strong><span class='metric-trend neutral'>Sin estimar lo desconocido</span>" + metricsSparkline([], "neutral") + "</article>"
      + "<article class='metric-kpi split-kpi'><div class='metric-kpi-label'><span>Transacciones y gasto medio</span><i title='Cantidad de tickets y venta promedio por ticket'>?</i></div><div><strong>" + model.currentSales.length + "</strong><small>tickets</small><strong>" + money(model.currentAverage) + "</strong><small>promedio</small></div>" + metricsTrendHtml(model.ticketGrowth) + metricsSparkline(ticketSeries, model.ticketGrowth.tone) + "</article>"
      + comparisonCard;
    renderMetricsCostCoverage(model);
  }
  function renderMetricsCostCoverage(model) {
    if (!$("metricsCostCoverage")) return;
    var salesPct = Math.round(model.salesCostCoverage * 1000) / 10;
    var exactSkuPct = Math.round(model.exactSkuCostCoverage * 1000) / 10;
    var usableSkuCount = model.knownSkuCount + model.estimatedSkuCount;
    $("metricsCostCoverage").innerHTML = ""
      + "<article class='cost-coverage-card'><div><span>Cobertura de costos por SKU</span><b>" + usableSkuCount + " / " + model.activeSkuCount + "</b></div><strong>" + (model.activeSkuCount ? Math.round(model.skuCostCoverage * 1000) / 10 : 0) + "%</strong><div class='cost-coverage-track'><i style='width:" + Math.max(0, Math.min(100, model.skuCostCoverage * 100)) + "%'></i></div><small><em class='known'>" + model.knownSkuCount + " conocidos</em><em class='estimated'>" + model.estimatedSkuCount + " solo reposicion/parciales</em><em class='unknown'>" + model.unknownSkuCount + " desconocidos</em></small></article>"
      + "<article class='cost-coverage-card sales'><div><span>Cobertura de costos en ventas</span><b>" + salesPct + "%</b></div><strong>" + money(model.knownCostRevenue) + "</strong><div class='cost-coverage-track'><i style='width:" + Math.max(0, Math.min(100, salesPct)) + "%'></i></div><small>Facturacion del periodo con costo historico conocido. El " + Math.max(0, Math.round((100 - salesPct) * 10) / 10) + "% restante se excluye de ganancia y margen.</small></article>"
      + "<article class='cost-coverage-card legend'><span>Lectura honesta</span><p><b>Conocido:</b> costo real guardado al vender.</p><p><b>Estimado:</b> costo de reposicion disponible, sin atribuirlo al stock historico.</p><p><b>Desconocido:</b> no participa en rentabilidad.</p><small>SKU con cobertura exacta completa: " + exactSkuPct + "%</small></article>";
  }
  function metricsTableEmpty(message) {
    return "<div class='metrics-table-empty'>" + escapeHtml(message) + "</div>";
  }
  function metricsProductSort(rows) {
    rows = rows.slice();
    rows.sort(function (a, b) {
      if (metricsProductRankMode === "revenue") return b.revenue - a.revenue || b.units - a.units;
      if (metricsProductRankMode === "profit") {
        if (a.profit == null && b.profit != null) return 1;
        if (a.profit != null && b.profit == null) return -1;
        return Number(b.profit || 0) - Number(a.profit || 0) || b.revenue - a.revenue;
      }
      if (metricsProductRankMode === "trend") {
        var bTrend = b.trend && b.trend.value != null ? Number(b.trend.value) : -Infinity;
        var aTrend = a.trend && a.trend.value != null ? Number(a.trend.value) : -Infinity;
        return bTrend - aTrend || b.units - a.units;
      }
      return b.units - a.units || b.revenue - a.revenue;
    });
    return rows;
  }
  function renderMetricsProductSections(model) {
    document.querySelectorAll("[data-product-rank]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.productRank === metricsProductRankMode);
    });
    var rows = metricsProductSort(model.productsAggregate.rows).filter(function (row) {
      var value = row.trend && row.trend.value;
      if (metricsProductTrendFilter === "up") return value != null && value > 0;
      if (metricsProductTrendFilter === "down") return value != null && value < 0;
      if (metricsProductTrendFilter === "flat") return value == null || value === 0;
      return true;
    }).slice(0, metricsProductLimit);
    $("metricsProductTable").innerHTML = rows.length ? "<table><thead><tr><th>#</th><th>Producto</th><th>Unidades</th><th>Facturacion</th><th>Ganancia cubierta</th><th>Margen cubierto</th><th>Cobertura</th><th>Stock actual</th><th>Tendencia</th><th>Ultima venta</th></tr></thead><tbody>"
      + rows.map(function (row, index) {
        var coverage = Math.round(Number(row.costCoverage || 0) * 1000) / 10;
        return "<tr><td>" + (index + 1) + "</td><td><b>" + escapeHtml(row.name) + "</b><small>" + escapeHtml(row.category) + "</small></td><td>" + formatQuantity(row.units) + "</td><td>" + money(row.revenue) + "</td><td>" + (row.profit == null ? "<span class='not-available'>Sin costo historico</span>" : money(row.profit)) + "</td><td>" + (row.margin == null ? "—" : Math.round(row.margin * 10) / 10 + "%") + "</td><td><span class='cost-table-coverage " + (coverage >= 99.9 ? "known" : coverage > 0 ? "partial" : "unknown") + "'>" + coverage + "%</span></td><td>" + formatQuantity(row.currentStock) + " " + escapeHtml(unitLabel(row.unitType, row.currentStock)) + "</td><td>" + metricsTrendHtml(row.trend) + "</td><td>" + (row.daysSinceLastSale == null ? "Nunca" : row.daysSinceLastSale === 0 ? "Hoy" : row.daysSinceLastSale + " dias") + "</td></tr>";
      }).join("") + "</tbody></table>" : metricsTableEmpty("No hay productos vendidos por ticket con estos filtros.");
    var velocityRows = model.productsAggregate.rows.slice().sort(function (a, b) { return b.velocity - a.velocity; }).slice(0, 10);
    $("metricsVelocityTable").innerHTML = velocityRows.length ? "<table><thead><tr><th>Producto</th><th>Vendidas</th><th>Promedio diario</th><th>Ritmo 7 dias</th><th>Stock</th><th>Cobertura</th></tr></thead><tbody>"
      + velocityRows.map(function (row) {
        var coverage = row.velocity > 0 ? Math.max(0, row.currentStock / row.velocity) : Infinity;
        return "<tr><td><b>" + escapeHtml(row.name) + "</b><small>" + escapeHtml(row.category) + "</small></td><td>" + formatQuantity(row.units) + "</td><td><b>" + formatQuantity(row.velocity) + " / dia</b></td><td>" + formatQuantity(row.velocity * 7) + "</td><td>" + formatQuantity(row.currentStock) + "</td><td>" + (coverage === Infinity ? "Sin ritmo" : Math.round(coverage * 10) / 10 + " dias") + "</td></tr>";
      }).join("") + "</tbody></table>" : metricsTableEmpty("Sin velocidad calculable en el periodo.");
    var pairRows = model.pairs.slice(0, 8);
    $("metricsPairsTable").innerHTML = pairRows.length ? "<table><thead><tr><th>Productos</th><th>Tickets juntos</th><th>% de tickets</th><th>Valor combinado</th></tr></thead><tbody>"
      + pairRows.map(function (pair) {
        return "<tr><td><b>" + escapeHtml(pair.first) + "</b><small>+ " + escapeHtml(pair.second) + "</small></td><td><b>" + pair.count + "</b></td><td>" + Math.round(pair.ticketShare * 1000) / 10 + "%</td><td>" + (pair.separatePrice ? money(pair.separatePrice) : "Sin precio completo") + "</td></tr>";
      }).join("") + "</tbody></table>" : metricsTableEmpty("Aun no hay tickets con dos productos para detectar combinaciones.");
    drawMetricsCategoryChart(model.categoryRows);
  }
  function renderMetricsInventory(model) {
    var visibleRisks = model.inventory.risks.filter(function (row) {
      return !metricsStockRiskCategory || row.category === metricsStockRiskCategory;
    });
    var visibleDead = model.inventory.dead.filter(function (row) {
      return !model.filters.category || row.category === model.filters.category;
    });
    var red = visibleRisks.filter(function (row) { return row.tone === "red"; }).length;
    var amber = visibleRisks.filter(function (row) { return row.tone === "amber"; }).length;
    var riskScope = metricsStockRiskCategory || "Todas las categorias";
    $("metricsAlertStrip").innerHTML = "<article class='metric-alert " + (red ? "danger" : "neutral") + "'><span>Riesgo urgente</span><b>" + red + "</b><small>menos de 3 dias o sin stock</small></article>"
      + "<article class='metric-alert " + (amber ? "warning" : "neutral") + "'><span>Reponer pronto</span><b>" + amber + "</b><small>3 a 7 dias o debajo del minimo</small></article>"
      + "<article class='metric-alert neutral'><span>Stock lento</span><b>" + visibleDead.length + "</b><small>sin ventas o velocidad muy baja</small></article>"
      + "<article class='metric-alert neutral'><span>Categoria de reposicion</span><b class='metric-alert-text'>" + escapeHtml(riskScope) + "</b><small>cambie el selector para revisar otra</small></article>";
    var riskRows = visibleRisks.slice(0, 20);
    $("metricsStockRiskTable").innerHTML = riskRows.length ? "<table><thead><tr><th>Producto</th><th>Stock</th><th>Venta/dia</th><th>Dias restantes</th><th>Estado</th></tr></thead><tbody>"
      + riskRows.map(function (row) {
        var days = row.remainingDays === Infinity ? "Sin ventas recientes" : Math.round(row.remainingDays * 10) / 10;
        var label = row.tone === "red" ? (row.stock <= 0 ? "Sin stock" : "Urgente") : row.tone === "amber" ? (row.remainingDays === Infinity ? "Stock bajo" : "Reponer") : "Normal";
        return "<tr><td><b>" + escapeHtml(row.name) + "</b><small>" + escapeHtml(row.category) + "</small></td><td>" + formatQuantity(row.stock) + " " + escapeHtml(unitLabel(row.unitType, row.stock)) + "</td><td>" + formatQuantity(row.velocity) + "</td><td>" + days + "</td><td><span class='stock-risk-pill " + row.tone + "'>" + label + "</span></td></tr>";
      }).join("") + "</tbody></table>" : metricsTableEmpty("No hay alertas de reposicion para " + riskScope + ".");
    var deadRows = visibleDead.slice().sort(function (a, b) {
      if (metricsDeadStockSort === "stock") return b.stock - a.stock || b.retailValue - a.retailValue;
      if (metricsDeadStockSort === "value") return b.retailValue - a.retailValue || b.stock - a.stock;
      return (b.daysSince == null ? 99999 : b.daysSince) - (a.daysSince == null ? 99999 : a.daysSince) || b.retailValue - a.retailValue;
    }).slice(0, 20);
    $("metricsDeadStockTable").innerHTML = deadRows.length ? "<table><thead><tr><th>Producto</th><th>Stock</th><th>Unid./dia</th><th>Sin vender</th><th>Valor a precio de venta</th></tr></thead><tbody>"
      + deadRows.map(function (row) {
        return "<tr><td><b>" + escapeHtml(row.name) + "</b></td><td>" + formatQuantity(row.stock) + "</td><td>" + formatQuantity(row.velocity) + "</td><td>" + (row.daysSince == null ? "Nunca" : row.daysSince + " dias") + "</td><td>" + money(row.retailValue) + "</td></tr>";
      }).join("") + "</tbody></table>" : metricsTableEmpty("No hay stock lento detectado.");
  }
  function metricsPrepareCanvas(id, minWidth) {
    var canvas = $(id);
    if (!canvas) return null;
    bindMetricCanvasHover(canvas);
    canvas._metricTargets = [];
    var cssWidth = Math.max(minWidth || 360, (canvas.parentNode && canvas.parentNode.clientWidth || 500) - 30);
    canvas.width = cssWidth;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return { canvas: canvas, ctx: ctx, width: canvas.width, height: canvas.height };
  }
  function metricsCanvasEmpty(canvasContext, message) {
    canvasContext.ctx.fillStyle = "#60746e";
    canvasContext.ctx.font = "700 14px Arial";
    canvasContext.ctx.fillText(message, 22, 42);
  }
  function drawMetricsSalesTrend(model) {
    document.querySelectorAll("[data-metric-trend]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.metricTrend === metricsTrendMode);
    });
    var c = metricsPrepareCanvas("metricsSalesTrendChart", 640);
    if (!c) return;
    if (metricsTrendMode === "profit" && !model.profitAvailable) { metricsCanvasEmpty(c, "No hay ventas con costo historico conocido en este periodo."); return; }
    var field = metricsTrendMode === "transactions" ? "transactions" : metricsTrendMode === "average" ? "average" : metricsTrendMode === "profit" ? "profit" : "revenue";
    var current = model.currentSeries.map(function (row) { return Number(row[field] || 0); });
    var previous = model.previousSeries.map(function (row) { return Number(row[field] || 0); });
    var max = Math.max.apply(Math, current.concat(previous).concat([1]));
    var slotCount = Math.max(current.length, previous.length, 1);
    var left = 52, right = c.width - 20, top = 38, bottom = c.height - 48;
    c.ctx.strokeStyle = "#e1ebe7";
    c.ctx.lineWidth = 1;
    for (var grid = 0; grid < 5; grid++) {
      var gy = top + grid * ((bottom - top) / 4);
      c.ctx.beginPath(); c.ctx.moveTo(left, gy); c.ctx.lineTo(right, gy); c.ctx.stroke();
    }
    function pointX(index) { return slotCount === 1 ? (left + right) / 2 : left + index * ((right - left) / Math.max(1, slotCount - 1)); }
    function metricDisplay(value, row) {
      var coverageNote = field === "profit" && row && Number(row.profitCoverage) < .999999 ? " · cobertura " + Math.round(Number(row.profitCoverage || 0) * 100) + "%" : "";
      return field === "transactions" ? value + " ticket(s)" : money(value) + coverageNote;
    }
    function drawSeries(values, color, dashed) {
      c.ctx.strokeStyle = color;
      c.ctx.lineWidth = dashed ? 2 : 4;
      c.ctx.setLineDash(dashed ? [7, 6] : []);
      c.ctx.beginPath();
      values.forEach(function (value, index) {
        var x = pointX(index);
        var y = bottom - (value / max) * (bottom - top);
        if (!index) c.ctx.moveTo(x, y); else c.ctx.lineTo(x, y);
      });
      c.ctx.stroke();
      c.ctx.setLineDash([]);
      values.forEach(function (value, index) {
        var x = pointX(index);
        var y = bottom - (value / max) * (bottom - top);
        c.ctx.fillStyle = color;
        c.ctx.beginPath(); c.ctx.arc(x, y, dashed ? 3 : 4, 0, Math.PI * 2); c.ctx.fill();
      });
    }
    if (model.period.hasComparison) drawSeries(previous, "#9aa9a4", true);
    drawSeries(current, "#176f5b", false);
    var weekdayLabels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
    for (var pointIndex = 0; pointIndex < slotCount; pointIndex++) {
      var currentValue = Number(current[pointIndex] || 0), previousValue = Number(previous[pointIndex] || 0);
      var currentRow = model.currentSeries[pointIndex] || {}, previousRow = model.previousSeries[pointIndex] || {};
      var pointY = bottom - (currentValue / max) * (bottom - top);
      var change = model.period.hasComparison ? metricGrowth(currentValue, previousValue) : metricNoComparison("Sin comparacion");
      var slotLabel = model.period.mode === "week" ? weekdayLabels[pointIndex] : model.period.seriesGranularity === "month" ? String(currentRow.key || "").slice(0, 7) : String(currentRow.key || "").slice(8, 10);
      if (slotCount <= 12 || pointIndex % Math.ceil(slotCount / 10) === 0) {
        c.ctx.fillStyle = "#526a64"; c.ctx.font = "700 9px Arial"; c.ctx.textAlign = "center"; c.ctx.fillText(slotLabel, pointX(pointIndex), c.height - 12); c.ctx.textAlign = "left";
      }
      c.canvas._metricTargets.push({ type: "point", x: pointX(pointIndex), y: pointY, r: 15, label: "<b>" + escapeHtml(slotLabel + " · " + (currentRow.key || "")) + "</b><span>Actual: " + metricDisplay(currentValue, currentRow) + "</span>" + (model.period.hasComparison ? "<span>Anterior (" + escapeHtml(previousRow.key || "") + "): " + metricDisplay(previousValue, previousRow) + "</span><span class='" + change.tone + "'>Cambio: " + escapeHtml(change.label) + "</span>" : "") });
    }
    c.ctx.fillStyle = "#176f5b"; c.ctx.fillRect(left, 14, 18, 4);
    c.ctx.fillStyle = "#324e48"; c.ctx.font = "700 12px Arial"; c.ctx.fillText("Actual", left + 24, 20);
    if (model.period.hasComparison) {
      c.ctx.strokeStyle = "#9aa9a4"; c.ctx.setLineDash([6, 5]); c.ctx.beginPath(); c.ctx.moveTo(left + 92, 16); c.ctx.lineTo(left + 110, 16); c.ctx.stroke(); c.ctx.setLineDash([]);
      c.ctx.fillText("Anterior", left + 116, 20);
    }
  }
  function drawMetricsPaymentDonut(model) {
    var c = metricsPrepareCanvas("metricsPaymentDonut", 420);
    if (!c) return;
    var rows = [
      { label: "Efectivo", value: model.paymentTotals.Efectivo, color: "#176f5b" },
      { label: "QR", value: model.paymentTotals.QR, color: "#2d91ad" }
    ];
    var total = rows.reduce(function (sumValue, row) { return sumValue + row.value; }, 0);
    var cx = Math.min(115, c.width * .27), cy = c.height / 2, radius = Math.min(76, c.height * .32), start = -Math.PI / 2;
    rows.forEach(function (row) {
      var slice = total ? row.value / total * Math.PI * 2 : 0;
      if (slice > 0) {
        c.ctx.beginPath(); c.ctx.moveTo(cx, cy); c.ctx.arc(cx, cy, radius, start, start + slice); c.ctx.closePath(); c.ctx.fillStyle = row.color; c.ctx.fill();
        c.canvas._metricTargets.push({ type: "slice", cx: cx, cy: cy, r: radius, start: start, end: start + slice, label: "<b>" + row.label + "</b><span>" + money(row.value) + " · " + percent(row.value, total) + "</span>" });
      }
      start += slice;
    });
    c.ctx.beginPath(); c.ctx.arc(cx, cy, radius * .55, 0, Math.PI * 2); c.ctx.fillStyle = "#fff"; c.ctx.fill();
    c.ctx.fillStyle = "#173f38"; c.ctx.font = "800 14px Arial"; c.ctx.textAlign = "center"; c.ctx.fillText(total ? money(total) : "$ 0", cx, cy + 5); c.ctx.textAlign = "left";
    rows.forEach(function (row, index) {
      var x = Math.max(220, c.width * .52), y = 50 + index * 34;
      c.ctx.fillStyle = row.color; c.ctx.fillRect(x, y - 12, 15, 15);
      c.ctx.fillStyle = "#314f48"; c.ctx.font = "700 12px Arial"; c.ctx.fillText(row.label + " " + percent(row.value, total), x + 23, y);
    });
  }
  function drawMetricsWeekdayChart(model) {
    var c = metricsPrepareCanvas("metricsWeekdayChart", 420);
    if (!c) return;
    var labels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
    var max = Math.max.apply(Math, model.weekday.concat([1]));
    var barWidth = (c.width - 70) / 7;
    model.weekday.forEach(function (value, index) {
      var height = value / max * (c.height - 75);
      var x = 42 + index * barWidth, y = c.height - 34 - height;
      var alpha = .22 + .78 * (value / max);
      c.ctx.fillStyle = "rgba(23,111,91," + alpha.toFixed(2) + ")";
      c.ctx.fillRect(x, y, Math.max(15, barWidth - 10), height);
      c.ctx.fillStyle = "#425f58"; c.ctx.font = "700 11px Arial"; c.ctx.fillText(labels[index], x, c.height - 15);
      c.canvas._metricTargets.push({ type: "rect", x: x, y: Math.min(y, c.height - 34), w: Math.max(15, barWidth - 10), h: Math.max(7, height), label: "<b>" + labels[index] + "</b><span>" + money(value) + "</span>" });
    });
  }
  function drawMetricsShiftChart(model) {
    var c = metricsPrepareCanvas("metricsShiftChart", 420);
    if (!c) return;
    var rows = model.shiftByDay;
    var max = Math.max.apply(Math, rows.reduce(function (values, row) { return values.concat([row.AM, row.PM]); }, []).concat([1]));
    var groupWidth = (c.width - 62) / Math.max(1, rows.length);
    rows.forEach(function (row, index) {
      ["AM", "PM"].forEach(function (shift, shiftIndex) {
        var value = row[shift];
        var height = value / max * (c.height - 78);
        var width = Math.max(5, groupWidth * .34);
        var x = 38 + index * groupWidth + shiftIndex * (width + 2), y = c.height - 32 - height;
        c.ctx.fillStyle = shift === "AM" ? "#e3a72f" : "#237e99";
        c.ctx.fillRect(x, y, width, height);
        c.canvas._metricTargets.push({ type: "rect", x: x, y: Math.min(y, c.height - 32), w: width, h: Math.max(6, height), label: "<b>" + row.key + " · " + shift + "</b><span>" + money(value) + "</span>" });
      });
      if (rows.length <= 12 || index % Math.ceil(rows.length / 10) === 0) {
        c.ctx.fillStyle = "#526a64"; c.ctx.font = "700 9px Arial"; c.ctx.fillText(row.key.slice(5), 38 + index * groupWidth, c.height - 12);
      }
    });
    c.ctx.fillStyle = "#e3a72f"; c.ctx.fillRect(18, 13, 13, 13); c.ctx.fillStyle = "#3c5751"; c.ctx.font = "700 11px Arial"; c.ctx.fillText("AM", 36, 24);
    c.ctx.fillStyle = "#237e99"; c.ctx.fillRect(76, 13, 13, 13); c.ctx.fillStyle = "#3c5751"; c.ctx.fillText("PM", 94, 24);
  }
  function drawMetricsCategoryChart(rows) {
    var c = metricsPrepareCanvas("metricsCategoryChart", 520);
    if (!c) return;
    rows = (rows || []).slice(0, 8);
    if (!rows.length) { metricsCanvasEmpty(c, "Sin ventas categorizadas en el periodo."); return; }
    var max = Math.max.apply(Math, rows.map(function (row) { return row.revenue; }).concat([1]));
    rows.forEach(function (row, index) {
      var y = 34 + index * 29;
      var available = c.width - 185;
      var amWidth = row.AM / max * available;
      var pmWidth = row.PM / max * available;
      c.ctx.fillStyle = "#eef4f1"; c.ctx.fillRect(145, y - 15, available, 19);
      c.ctx.fillStyle = "#e3a72f"; c.ctx.fillRect(145, y - 15, amWidth, 19);
      c.ctx.fillStyle = "#237e99"; c.ctx.fillRect(145 + amWidth, y - 15, pmWidth, 19);
      c.ctx.fillStyle = "#314f48"; c.ctx.font = "700 11px Arial"; c.ctx.fillText(row.name.slice(0, 18), 10, y);
      c.canvas._metricTargets.push({ type: "rect", x: 145, y: y - 15, w: Math.max(8, amWidth + pmWidth), h: 19, label: "<b>" + escapeHtml(row.name) + "</b><span>AM " + money(row.AM) + " · PM " + money(row.PM) + "</span>" });
    });
  }
  function renderMetricsHeatmap(model) {
    var labels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
    var max = Math.max.apply(Math, model.heatmap.reduce(function (allValues, row) { return allValues.concat(row); }, []).concat([1]));
    var html = "<div class='heatmap-corner'></div>";
    for (var hour = 6; hour <= 21; hour++) html += "<div class='heatmap-hour'>" + hour + "</div>";
    model.heatmap.forEach(function (row, weekdayIndex) {
      html += "<div class='heatmap-day'>" + labels[weekdayIndex] + "</div>";
      row.forEach(function (value, hourIndex) {
        var ratio = value / max;
        var alpha = value ? .14 + ratio * .78 : .045;
        html += "<div class='heatmap-cell' style='background:rgba(19,112,82," + alpha.toFixed(3) + ")' title='" + labels[weekdayIndex] + " " + (hourIndex + 6) + ":00 · " + money(value) + "'><span>" + (value ? Math.round(ratio * 9) + 1 : "") + "</span></div>";
      });
    });
    $("metricsHourHeatmap").innerHTML = html;
  }
  function renderMetricsActivity(model) {
    renderMetricsHeatmap(model);
    drawMetricsSalesTrend(model);
    drawMetricsPaymentDonut(model);
    drawMetricsWeekdayChart(model);
    drawMetricsShiftChart(model);
    renderMetricsWeather(model);
  }
  function renderMetricsWeather(model) {
    if (!$("metricsWeatherStatus") || !$("metricsWeatherPerformance")) return;
    var rows = (model.weatherRows || []).filter(function (row) { return row.date >= model.period.currentFrom && row.date <= model.period.currentTo; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    var latest = rows[rows.length - 1] || null;
    var configured = weatherSettings();
    if (latest) {
      var hourlyRows = Array.isArray(latest.hourlyObservations) ? latest.hourlyObservations : [];
      var temperatureAverage = latest.temperatureAverage != null ? Number(latest.temperatureAverage) : (Number(latest.temperatureMin || 0) + Number(latest.temperatureMax || 0)) / 2;
      var temperatureMedian = latest.temperatureMedian != null ? Number(latest.temperatureMedian) : temperatureAverage;
      var rainHours = Array.isArray(latest.rainHours) ? latest.rainHours : [];
      var stormHours = Array.isArray(latest.stormHours) ? latest.stormHours : [];
      var rainLabel = rainHours.length ? rainHours.map(function (time) { return String(time).slice(11, 16); }).join(", ") : "ninguna";
      var stormLabel = stormHours.length ? stormHours.map(function (time) { return String(time).slice(11, 16); }).join(", ") : "ninguna";
      var hourlyStrip = hourlyRows.length ? "<div class='weather-hour-strip' aria-label='Clima por hora'>" + hourlyRows.map(function (hourRow) {
        var clock = String(hourRow.time || "").slice(11, 16);
        var groupClass = normalizeProductSearch(hourRow.conditionGroup || "variable").replace(/\s+/g, "-");
        return "<span class='" + escapeHtml(groupClass) + "' title='" + escapeHtml(clock + " · " + (hourRow.description || hourRow.conditionGroup) + " · " + formatQuantity(hourRow.temperature) + "° · " + formatQuantity(hourRow.precipitation) + " mm") + "'><b>" + escapeHtml(clock.slice(0, 2)) + "</b>" + weatherSymbol(hourRow.conditionGroup) + "</span>";
      }).join("") + "</div>" : "";
      $("metricsWeatherStatus").innerHTML = "<div class='weather-status-summary'><span class='weather-symbol'>" + weatherSymbol(latest.conditionGroup) + "</span><span><b>" + escapeHtml(latest.description || latest.conditionGroup) + " · " + escapeHtml(latest.temperatureBand || "") + "</b><small>" + escapeHtml(latest.date) + " · promedio " + formatQuantity(temperatureAverage) + "° · mediana " + formatQuantity(temperatureMedian) + "° · min/max " + formatQuantity(latest.temperatureMin) + "°/" + formatQuantity(latest.temperatureMax) + "°</small></span></div>"
        + "<strong>" + (latest.hoursObserved || hourlyRows.length || 1) + " h analizadas · " + rows.length + " dia(s)</strong>"
        + hourlyStrip
        + "<div class='weather-event-hours'><span><b>Lluvia:</b> " + escapeHtml(rainLabel) + "</span><span><b>Tormenta:</b> " + escapeHtml(stormLabel) + "</span><span><b>Acumulado:</b> " + formatQuantity(latest.precipitation) + " mm</span></div>";
    } else {
      $("metricsWeatherStatus").innerHTML = "<div class='weather-status-summary'><span class='weather-symbol'>○</span><span><b>Sin clima guardado en este periodo</b><small>" + (isFinite(Number(configured.latitude)) ? "Se registrara automaticamente cuando haya conexion." : "Autorice una vez la ubicacion de esta PC.") + "</small></span></div>";
    }
    var salesByDate = {};
    (model.currentSales || []).forEach(function (sale) { var date = inferredBusinessDate(sale); salesByDate[date] = (salesByDate[date] || 0) + Number(sale.amount || 0); });
    function aggregate(field) {
      var groups = {};
      rows.forEach(function (row) {
        var key = row[field] || "Sin clasificar";
        if (!groups[key]) groups[key] = { label: key, days: 0, sales: 0 };
        groups[key].days += 1; groups[key].sales += Number(salesByDate[row.date] || 0);
      });
      return Object.keys(groups).map(function (key) { groups[key].average = groups[key].days ? groups[key].sales / groups[key].days : 0; return groups[key]; }).sort(function (a, b) { return b.average - a.average; });
    }
    function table(title, values) {
      return "<section><h4>" + title + "</h4>" + (values.length ? "<table><thead><tr><th>Tipo</th><th>Dias</th><th>Ventas</th><th>Promedio/dia</th></tr></thead><tbody>" + values.map(function (row) { return "<tr><td><b>" + escapeHtml(row.label) + "</b></td><td>" + row.days + "</td><td>" + money(row.sales) + "</td><td>" + money(row.average) + "</td></tr>"; }).join("") + "</tbody></table>" : "<p>Faltan dias observados para comparar.</p>") + "</section>";
    }
    $("metricsWeatherPerformance").innerHTML = table("Por estado del tiempo", aggregate("conditionGroup")) + table("Por temperatura", aggregate("temperatureBand"));
  }
  function renderMetrics() {
    if (!isAdmin() || !$("metricsKpis")) return;
    var sequence = ++metricsRenderSequence;
    Promise.all([all("transactions"), all("baskets"), all("basketItems"), all("products"), all("users"), all("closures"), all("auditLog"), all("weatherDaily")]).then(function (data) {
      if (sequence !== metricsRenderSequence) return;
      populateMetricsFilterOptions(data[3], data[4]);
      var filters = metricsSelectedFilters();
      var model = metricsBuildModel(data, filters);
      metricsDashboardModel = model;
      renderMetricsOverview(model);
      renderMetricsActivity(model);
      renderMetricsProductSections(model);
      renderMetricsInventory(model);
    }).catch(function () {
      if ($("metricsKpis")) $("metricsKpis").innerHTML = metricsTableEmpty("No se pudieron calcular las metricas.");
    });
  }
  function metricsCsvCell(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  }
  function exportMetricsSnapshot() {
    var model = metricsDashboardModel;
    if (!model) { toast("Las metricas todavia no estan listas"); return; }
    var rows = [
      ["La Vieja Esquina · Resumen de metricas"],
      ["Periodo", model.period.currentFrom, model.period.currentTo],
      ["Ventas netas", model.currentRevenue],
      ["Tickets", model.currentSales.length],
      ["Ticket promedio", model.currentAverage],
      ["Crecimiento %", model.revenueGrowth.value == null ? "Sin base" : model.revenueGrowth.value],
      [],
      ["Producto", "Unidades", "Facturacion", "Stock", "Dias desde ultima venta"]
    ];
    metricsProductSort(model.productsAggregate.rows).slice(0, 50).forEach(function (row) {
      rows.push([row.name, row.units, row.revenue, row.currentStock, row.daysSinceLastSale == null ? "Nunca" : row.daysSinceLastSale]);
    });
    var csv = "\ufeff" + rows.map(function (row) { return row.map(metricsCsvCell).join(";"); }).join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "metricas-la-vieja-esquina-" + model.period.currentFrom + "-" + model.period.currentTo + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Resumen de metricas exportado");
  }
  function reportMonthBefore(date) {
    date = date || new Date();
    return localDateKey(new Date(date.getFullYear(), date.getMonth() - 1, 1)).slice(0, 7);
  }
  function reportMonthIsValid(value) {
    return /^20\d{2}-(0[1-9]|1[0-2])$/.test(String(value || ""));
  }
  function reportDateInMonth(value, month) {
    return String(value || "").slice(0, 7) === month;
  }
  function reportMd(value) {
    return String(value == null ? "" : value).replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ").trim();
  }
  function reportTable(headers, rows) {
    if (!rows.length) return "_Sin registros._\n";
    return "| " + headers.map(reportMd).join(" | ") + " |\n| " + headers.map(function () { return "---"; }).join(" | ") + " |\n"
      + rows.map(function (row) { return "| " + row.map(reportMd).join(" | ") + " |"; }).join("\n") + "\n";
  }
  function reportQuantity(value) {
    value = Number(value || 0);
    return Math.round(value * 1000) / 1000;
  }
  function reportMoney(value) {
    return Math.round(Number(value || 0));
  }
  function reportDownload(report) {
    if (!report || !report.content) return;
    var blob = new Blob([report.content], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = report.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function closeMonthlyReportModal() {
    if ($("monthlyReportModal")) $("monthlyReportModal").classList.add("hidden");
  }
  function showMonthlyReportModal(report, automatic) {
    latestMonthlyReport = report;
    if (!$("monthlyReportModal")) return;
    $("monthlyReportTitle").textContent = automatic ? "Informe mensual automatico generado" : "Informe mensual generado";
    $("monthlyReportMessage").textContent = "Periodo " + report.month + ". Incluye ventas, productos, medios de pago, stock, cambios de inventario, gastos, compras, cierres y movimientos para revision.";
    $("monthlyReportPath").textContent = report.path || ("Descargas\\" + report.fileName);
    $("monthlyReportModal").classList.remove("hidden");
  }
  function saveMonthlyReportToDisk(report) {
    if (!localDataToken) return Promise.reject(new Error("El servicio de archivos local no esta listo"));
    return fetch(MONTHLY_REPORT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", "X-App-Token": localDataToken },
      body: JSON.stringify({ month: report.month, content: report.content })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok) throw new Error(payload.error || "No se pudo guardar el informe");
        report.path = payload.path || payload.file || "";
        return report;
      });
    });
  }
  function buildMonthlyReport(month) {
    var data = {};
    return Promise.all(STORES.map(function (store) {
      return all(store).then(function (rows) { data[store] = rows || []; });
    })).then(function () {
      var products = data.products || [];
      var transactions = data.transactions || [];
      var basketItems = data.basketItems || [];
      var maps = metricsBuildBasketMaps(basketItems, products);
      var productById = maps.productById;
      var activeSales = transactions.filter(function (row) { return row.type === "SALE" && !row.deleted; });
      var sales = activeSales.filter(function (row) { return reportDateInMonth(inferredBusinessDate(row), month); });
      var deletedSales = transactions.filter(function (row) { return row.type === "SALE" && row.deleted && reportDateInMonth(inferredBusinessDate(row), month); });
      var withdrawals = transactions.filter(function (row) { return row.type === "WITHDRAWAL" && !row.deleted && reportDateInMonth(inferredBusinessDate(row), month); });
      var entries = (data.monthlyEntries || []).filter(function (row) { return row.type !== "RECURRING_RULE" && reportDateInMonth(row.date || row.createdAt, month); });
      var purchases = (data.purchases || []).filter(function (row) { return reportDateInMonth(row.deliveryDate || row.confirmedAt || row.createdAt, month); });
      var purchaseLines = data.purchaseLines || [];
      var movements = (data.inventoryMovements || []).filter(function (row) { return reportDateInMonth(row.createdAt, month); });
      var closures = (data.closures || []).filter(function (row) { return reportDateInMonth(row.businessDate || row.createdAt, month); });
      var production = (data.productionItems || []).filter(function (row) { return !row.deleted && reportDateInMonth(row.date || row.createdAt, month); });
      var audits = (data.auditLog || []).filter(function (row) { return reportDateInMonth(row.createdAt, month) && /DELET|UNDO|EDIT|VOID|REVIEW|ADJUST|CORRECT|MANUAL/i.test(String(row.action || "")); });
      var priceRows = (data.priceHistory || []).filter(function (row) { return reportDateInMonth(row.createdAt || row.changedAt || row.actionAt, month); });
      var weatherRows = (data.weatherDaily || []).filter(function (row) { return reportDateInMonth(row.date, month); }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      var year = Number(month.slice(0, 4));
      var monthNumber = Number(month.slice(5, 7));
      var daysInMonth = new Date(year, monthNumber, 0).getDate();
      var reportDayCount = month === monthKey(today()) ? Math.max(1, Number(today().slice(8, 10))) : daysInMonth;
      var paymentTotals = { cash: 0, qr: 0, splitTickets: 0 };
      var dayStats = {};
      var shiftStats = { AM: { tickets: 0, sales: 0 }, PM: { tickets: 0, sales: 0 } };
      var itemStats = {};
      var categoryStats = {};
      var itemizedRevenue = 0;
      var knownCostRevenue = 0;
      var knownCogs = 0;
      var manualRows = [];
      var lastSaleByProduct = {};
      activeSales.forEach(function (sale) {
        (maps.itemsByBasket[sale.basketId] || []).forEach(function (item) {
          if (isManualBasketItem(item) || !item.productId) return;
          var date = inferredBusinessDate(sale);
          if (!lastSaleByProduct[item.productId] || date > lastSaleByProduct[item.productId]) lastSaleByProduct[item.productId] = date;
        });
      });
      sales.forEach(function (sale) {
        var amount = Number(sale.amount || 0);
        var parts = salePaymentParts(sale);
        var date = inferredBusinessDate(sale);
        var shift = inferredShift(sale) === "PM" ? "PM" : "AM";
        paymentTotals.cash += parts.cash;
        paymentTotals.qr += parts.qr;
        if (isSplitPayment(sale.paymentMethod)) paymentTotals.splitTickets++;
        if (!dayStats[date]) dayStats[date] = { tickets: 0, sales: 0, cash: 0, qr: 0, articles: 0 };
        dayStats[date].tickets++;
        dayStats[date].sales += amount;
        dayStats[date].cash += parts.cash;
        dayStats[date].qr += parts.qr;
        shiftStats[shift].tickets++;
        shiftStats[shift].sales += amount;
        var basketRows = maps.itemsByBasket[sale.basketId] || [];
        basketRows.forEach(function (item) {
          var key = basketItemIdentityKey(item);
          var product = productById[item.productId] || {};
          var category = isManualBasketItem(item) ? "Item manual" : productCategory(product);
          if (!itemStats[key]) itemStats[key] = { id: item.productId || key, name: item.productName || product.name || "Producto", category: category, quantity: 0, revenue: 0, tickets: {}, knownCost: 0, knownRevenue: 0 };
          var quantity = Math.max(0, Number(item.quantity || 0));
          var revenue = metricsAllocatedItemRevenue(sale, item, basketRows, maps);
          var cost = metricsBasketCostSnapshot(item);
          var knownRatio = quantity > 0 ? Math.min(1, Number(cost.knownQuantity || 0) / quantity) : 0;
          itemStats[key].quantity += quantity;
          itemStats[key].revenue += revenue;
          itemStats[key].tickets[sale.id] = true;
          itemStats[key].knownCost += Number(cost.knownCostAmount || 0);
          itemStats[key].knownRevenue += revenue * knownRatio;
          itemizedRevenue += revenue;
          knownCogs += Number(cost.knownCostAmount || 0);
          knownCostRevenue += revenue * knownRatio;
          dayStats[date].articles += isVariableQuantityProduct(item) ? 1 : Math.max(1, Math.round(quantity));
          if (!categoryStats[category]) categoryStats[category] = { quantity: 0, revenue: 0 };
          categoryStats[category].quantity += quantity;
          categoryStats[category].revenue += revenue;
          if (isManualBasketItem(item)) manualRows.push([date, item.productName || "Item manual", reportQuantity(quantity), reportMoney(revenue), sale.id]);
        });
      });
      var productRows = Object.keys(itemStats).map(function (key) {
        var row = itemStats[key];
        var product = productById[row.id] || {};
        row.ticketCount = Object.keys(row.tickets).length;
        row.currentStock = Number(product.stock || 0);
        row.lastSale = lastSaleByProduct[row.id] || "";
        row.daysSince = metricsDaysSince(row.lastSale);
        return row;
      }).sort(function (a, b) { return b.revenue - a.revenue || b.quantity - a.quantity; });
      var activeProducts = products.filter(function (row) { return row.active !== false; });
      var risks = [];
      var slow = [];
      activeProducts.forEach(function (product) {
        var stats = itemStats[product.id];
        var velocity = stats ? stats.quantity / reportDayCount : 0;
        var stock = Number(product.stock || 0);
        var remaining = stock <= 0 ? 0 : velocity > 0 ? stock / velocity : Infinity;
        var minimum = Number(product.minStock || 0) || 2;
        var category = productCategory(product);
        if (stock <= minimum || (velocity > 0 && remaining <= 7)) risks.push({ name: product.name, category: category, stock: stock, velocity: velocity, remaining: remaining });
        var createdKey = String(product.createdAt || product.addedAt || "").slice(0, 10);
        var age = /^\d{4}-\d{2}-\d{2}$/.test(createdKey) ? metricsDaysSince(createdKey) : null;
        var last = lastSaleByProduct[product.id] || "";
        var daysSince = metricsDaysSince(last);
        if (stock > 0 && (age == null || age >= 14) && (daysSince == null || daysSince >= 21 || velocity < 0.05)) slow.push({ name: product.name, category: category, stock: stock, velocity: velocity, daysSince: daysSince, value: stock * Number(product.price || 0) });
      });
      risks.sort(function (a, b) { return a.remaining - b.remaining || a.stock - b.stock; });
      slow.sort(function (a, b) { return (b.daysSince == null ? 99999 : b.daysSince) - (a.daysSince == null ? 99999 : a.daysSince) || b.value - a.value; });
      var totalSales = sales.reduce(function (sumValue, row) { return sumValue + Number(row.amount || 0); }, 0);
      var expenseTotal = entries.reduce(function (sumValue, row) { return sumValue + Number(row.amount || 0); }, 0);
      var confirmedPurchases = purchases.filter(function (row) { return row.status === "CONFIRMED"; });
      var purchaseTotal = confirmedPurchases.reduce(function (sumValue, row) { return sumValue + Number(row.total || 0); }, 0);
      var withdrawalTotal = withdrawals.reduce(function (sumValue, row) { return sumValue + Number(row.amount || 0); }, 0);
      var completeClosures = closures.filter(function (row) { return (row.closureKind || "COMPLETE") === "COMPLETE"; });
      var report = [];
      report.push("# Informe mensual integral - La Vieja Esquina");
      report.push("");
      report.push("- Periodo: " + month);
      report.push("- Generado: " + new Date().toLocaleString("es-AR"));
      report.push("- Usuario: " + reportMd(currentUser && (currentUser.displayName || currentUser.username) || "Sistema"));
      report.push("- Archivo generado localmente para analisis manual. No contiene analisis de IA.");
      report.push("");
      report.push("## Resumen ejecutivo");
      report.push(reportTable(["Indicador", "Valor"], [
        ["Ventas", reportMoney(totalSales)], ["Tickets", sales.length], ["Ticket promedio", sales.length ? reportMoney(totalSales / sales.length) : 0],
        ["Efectivo cobrado", reportMoney(paymentTotals.cash)], ["QR cobrado", reportMoney(paymentTotals.qr)], ["Tickets con pago combinado", paymentTotals.splitTickets],
        ["Gastos cargados", reportMoney(expenseTotal)], ["Compras confirmadas a proveedores", reportMoney(purchaseTotal)], ["Retiros de caja", reportMoney(withdrawalTotal)],
        ["Facturacion con detalle de productos", reportMoney(itemizedRevenue)], ["Cobertura de costos sobre ventas detalladas", itemizedRevenue ? Math.round(knownCostRevenue / itemizedRevenue * 1000) / 10 + "%" : "Sin base"],
        ["Ganancia bruta sobre porcion con costo conocido", knownCostRevenue ? reportMoney(knownCostRevenue - knownCogs) : "Sin costos suficientes"], ["Productos activos", activeProducts.length]
      ]));
      report.push("## Ventas por dia");
      report.push(reportTable(["Fecha", "Tickets", "Ventas", "Efectivo", "QR", "Articulos/lineas"], Object.keys(dayStats).sort().map(function (date) { var row = dayStats[date]; return [date, row.tickets, reportMoney(row.sales), reportMoney(row.cash), reportMoney(row.qr), row.articles]; })));
      report.push("## Clima y ventas por dia");
      report.push(reportTable(["Fecha", "Estado", "Temperatura", "Promedio / mediana", "Min / Max", "Horas", "Horas con lluvia", "Lluvia mm", "Ventas"], weatherRows.map(function (row) {
        var fallbackTemperature = (Number(row.temperatureMin || 0) + Number(row.temperatureMax || 0)) / 2;
        var rainyHours = Array.isArray(row.rainHours) ? row.rainHours.map(function (time) { return String(time).slice(11, 16); }).join(", ") : "";
        return [row.date, row.description || row.conditionGroup, row.temperatureBand || "", reportQuantity(row.temperatureAverage != null ? row.temperatureAverage : fallbackTemperature) + " / " + reportQuantity(row.temperatureMedian != null ? row.temperatureMedian : fallbackTemperature), reportQuantity(row.temperatureMin) + " / " + reportQuantity(row.temperatureMax), row.hoursObserved || "Sin detalle", rainyHours || "Ninguna", reportQuantity(row.precipitation), reportMoney(dayStats[row.date] && dayStats[row.date].sales || 0)];
      })));
      report.push("## Ventas por turno y medio de pago");
      report.push(reportTable(["Segmento", "Tickets", "Importe"], [["Turno AM", shiftStats.AM.tickets, reportMoney(shiftStats.AM.sales)], ["Turno PM", shiftStats.PM.tickets, reportMoney(shiftStats.PM.sales)], ["Efectivo", "", reportMoney(paymentTotals.cash)], ["QR", "", reportMoney(paymentTotals.qr)]]));
      report.push("## Rendimiento de productos");
      report.push(reportTable(["Producto", "Categoria", "Cantidad", "Tickets", "Facturacion", "Costo conocido", "Ganancia conocida", "Stock actual", "Ultima venta"], productRows.map(function (row) { return [row.name, row.category, reportQuantity(row.quantity), row.ticketCount, reportMoney(row.revenue), reportMoney(row.knownCost), row.knownRevenue ? reportMoney(row.knownRevenue - row.knownCost) : "Sin costo", reportQuantity(row.currentStock), row.lastSale || "Nunca"]; })));
      report.push("## Rendimiento por categoria");
      report.push(reportTable(["Categoria", "Cantidad", "Facturacion"], Object.keys(categoryStats).map(function (category) { return [category, reportQuantity(categoryStats[category].quantity), reportMoney(categoryStats[category].revenue)]; }).sort(function (a, b) { return Number(b[2]) - Number(a[2]); })));
      report.push("## Reposicion y faltantes");
      report.push(reportTable(["Producto", "Categoria", "Stock", "Venta diaria", "Dias restantes"], risks.map(function (row) { return [row.name, row.category, reportQuantity(row.stock), reportQuantity(row.velocity), row.remaining === Infinity ? "Sin ritmo" : reportQuantity(row.remaining)]; })));
      report.push("## Stock lento o inmovilizado");
      report.push(reportTable(["Producto", "Categoria", "Stock", "Venta diaria", "Dias sin venta", "Valor a precio de venta"], slow.map(function (row) { return [row.name, row.category, reportQuantity(row.stock), reportQuantity(row.velocity), row.daysSince == null ? "Nunca" : row.daysSince, reportMoney(row.value)]; })));
      report.push("## Estado completo del stock al generar el informe");
      report.push(reportTable(["Producto", "Categoria", "Stock", "Minimo", "Unidad", "Precio", "Costo promedio", "Valor venta", "Codigo"], activeProducts.slice().sort(function (a, b) { return productCategory(a).localeCompare(productCategory(b)) || String(a.name || "").localeCompare(String(b.name || "")); }).map(function (product) { return [product.name, productCategory(product), reportQuantity(product.stock), reportQuantity(product.minStock), product.unitType || "unidad", reportMoney(product.price), product.weightedAverageCostPerSaleUnit == null ? "Sin costo" : reportQuantity(product.weightedAverageCostPerSaleUnit), reportMoney(Number(product.stock || 0) * Number(product.price || 0)), product.barcode || "Sin codigo"]; })));
      report.push("## Cambios de stock del mes");
      report.push(reportTable(["Fecha", "Tipo", "Producto", "Cantidad", "Costo conocido", "Referencia", "Nota"], movements.slice().sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); }).map(function (row) { var product = productById[row.productId] || {}; return [String(row.createdAt || "").slice(0, 19).replace("T", " "), row.type, product.name || row.productId, reportQuantity(row.quantity), reportMoney(row.knownCostValue), row.referenceType || "", row.note || row.reason || ""]; })));
      report.push("## Gastos e ingresos operativos");
      report.push(reportTable(["Fecha", "Tipo", "Categoria", "Descripcion", "Medio", "Importe"], entries.map(function (row) { return [row.date || String(row.createdAt || "").slice(0, 10), row.type || "GASTO", row.category || "General", row.description || "", row.paymentMethod || "", reportMoney(row.amount)]; })));
      report.push("## Compras a proveedores");
      report.push(reportTable(["Fecha", "Estado", "Proveedor", "Factura", "Condicion", "Total", "Productos"], purchases.map(function (purchase) { var lines = purchaseLines.filter(function (line) { return line.purchaseId === purchase.id; }); return [purchase.deliveryDate || String(purchase.createdAt || "").slice(0, 10), purchase.status, purchase.supplierSnapshot && purchase.supplierSnapshot.name || purchase.supplierId, purchase.invoiceNumber || "", purchase.paymentTerms || "", reportMoney(purchase.total), lines.map(function (line) { return (line.productName || (productById[line.productId] || {}).name || line.productId) + " x " + reportQuantity(line.totalSaleQuantity || line.purchaseQuantity); }).join(", ")]; })));
      report.push("## Cierres del mes");
      report.push(reportTable(["Fecha", "Caja inicial", "Ventas", "Efectivo esperado", "Efectivo contado", "Diferencia efectivo", "QR esperado", "QR contado", "Diferencia QR", "Tickets"], completeClosures.map(function (row) { return [row.businessDate, reportMoney(row.openingCash), reportMoney(row.totalSales), reportMoney(row.expectedCash), reportMoney(row.countedCash), reportMoney(row.differenceCash), reportMoney(row.expectedTransfer), reportMoney(row.countedTransfer), reportMoney(row.differenceTransfer), row.ticketCount || 0]; })));
      report.push("## Detalle de tickets");
      report.push(reportTable(["Fecha y hora", "Empleado", "Turno", "Pago", "Efectivo", "QR", "Total", "Productos"], sales.slice().sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); }).map(function (sale) { var parts = salePaymentParts(sale); return [String(sale.createdAt || "").slice(0, 19).replace("T", " "), sale.userName || sale.username || "", inferredShift(sale), paymentDisplayName(sale.paymentMethod), reportMoney(parts.cash), reportMoney(parts.qr), reportMoney(sale.amount), (maps.itemsByBasket[sale.basketId] || []).map(function (item) { return (item.productName || "Producto") + " x " + reportQuantity(item.quantity); }).join(", ") || "Venta rapida sin detalle"]; })));
      report.push("## Items manuales");
      report.push(reportTable(["Fecha", "Descripcion", "Cantidad", "Importe", "Ticket"], manualRows));
      report.push("## Ventas anuladas o borradas");
      report.push(reportTable(["Fecha", "Empleado", "Importe", "Pago", "Motivo"], deletedSales.map(function (row) { return [inferredBusinessDate(row), row.userName || row.username || "", reportMoney(row.amount), paymentDisplayName(row.paymentMethod), row.deletedReason || row.undoReason || row.reason || ""]; })));
      report.push("## Produccion y otras entradas registradas");
      report.push(reportTable(["Fecha", "Producto", "Cantidad", "Unidad", "Nota"], production.map(function (row) { return [row.date || String(row.createdAt || "").slice(0, 10), row.productName || row.name || row.productId, reportQuantity(row.enteredAmount || row.quantity), row.unitType || "", row.notes || row.note || ""]; })));
      report.push("## Cambios de precios");
      report.push(reportTable(["Fecha", "Producto", "Precio anterior", "Precio nuevo", "Motivo"], priceRows.map(function (row) { return [String(row.createdAt || row.changedAt || row.actionAt || "").slice(0, 19).replace("T", " "), row.productName || (productById[row.productId] || {}).name || row.productId, reportMoney(row.previousPrice), reportMoney(row.newPrice || row.price), row.reason || row.note || row.type || ""]; })));
      report.push("## Eventos que requieren revision");
      report.push(reportTable(["Fecha", "Accion", "Usuario", "Detalle", "Severidad"], audits.map(function (row) { return [String(row.createdAt || "").slice(0, 19).replace("T", " "), row.action, row.username || "", row.detail || "", row.severity || ""]; })));
      report.push("## Notas para interpretar el informe");
      report.push("- La venta total no incluye la caja inicial.");
      report.push("- Las compras a proveedores se informan aparte porque su condicion de pago puede no representar un egreso efectivo del mismo mes.");
      report.push("- Los retiros de caja no se consideran automaticamente gastos: se muestran por separado para evitar doble conteo.");
      report.push("- La ganancia bruta se calcula solo sobre productos con costo historico conocido.");
      report.push("- Stock lento excluye productos cargados hace menos de 14 dias.");
      return { month: month, fileName: "Informe-mensual-La-Vieja-Esquina-" + month + ".md", content: report.join("\n") };
    });
  }
  function generateMonthlyReport(month, automatic) {
    if (!reportMonthIsValid(month)) return Promise.reject(new Error("El mes debe tener formato AAAA-MM"));
    return buildMonthlyReport(month).then(function (report) {
      return saveMonthlyReportToDisk(report).then(function (saved) {
        if (!automatic) reportDownload(saved);
        showMonthlyReportModal(saved, automatic);
        return saved;
      });
    });
  }
  function requestMonthlyReport() {
    if (!isAdmin()) { toast("Solo admin/dev puede generar el informe mensual"); return; }
    var now = new Date();
    var suggested = now.getDate() === 1 ? reportMonthBefore(now) : monthKey(today());
    var chosen = window.prompt("Mes del informe completo (AAAA-MM)", suggested);
    if (chosen == null) return;
    chosen = String(chosen).trim();
    if (!reportMonthIsValid(chosen)) { toast("Use el formato AAAA-MM, por ejemplo 2026-08"); return; }
    var button = $("metricsMonthlyReportBtn");
    if (button) { button.disabled = true; button.textContent = "Generando..."; }
    generateMonthlyReport(chosen, false).then(function (report) {
      return audit("MONTHLY_REPORT_EXPORTED", report.month + " | " + (report.path || report.fileName));
    }).catch(function (error) {
      toast("No se pudo generar el informe: " + (error && error.message || "error local"));
    }).then(function () {
      if (button) { button.disabled = false; button.textContent = "Informe mensual"; }
    });
  }
  function maybeGenerateAutomaticMonthlyReport() {
    var now = new Date();
    if (!isAdmin() || now.getDate() !== 1) return;
    var reportMonth = reportMonthBefore(now);
    var settingId = "monthly-report:" + reportMonth;
    all("settings").then(function (settings) {
      if (settings.some(function (row) { return row.id === settingId && row.generated; })) return null;
      return generateMonthlyReport(reportMonth, true).then(function (report) {
        return add("settings", { id: settingId, generated: true, month: reportMonth, path: report.path || report.fileName, generatedAt: nowIso(), generatedBy: currentUser.id }).then(function () {
          return audit("MONTHLY_REPORT_AUTOMATIC", reportMonth + " | " + (report.path || report.fileName));
        });
      });
    }).catch(function (error) {
      toast("El informe mensual automatico no pudo guardarse: " + (error && error.message || "error local"));
    });
  }
  function bindMetricsDashboardControls() {
    ["metricsPeriod", "metricsShift", "metricsEmployee", "metricsCategory", "metricsPayment"].forEach(function (id) {
      if ($(id)) $(id).onchange = renderMetrics;
    });
    if ($("metricsRefreshBtn")) $("metricsRefreshBtn").onclick = renderMetrics;
    if ($("metricsExportBtn")) $("metricsExportBtn").onclick = exportMetricsSnapshot;
    if ($("metricsMonthlyReportBtn")) $("metricsMonthlyReportBtn").onclick = requestMonthlyReport;
    if ($("weatherLocationBtn")) $("weatherLocationBtn").onclick = requestPcWeatherLocation;
    if ($("metricsProductLimit")) $("metricsProductLimit").onchange = function () {
      metricsProductLimit = Math.max(1, Number($("metricsProductLimit").value || 10));
      if (metricsDashboardModel) renderMetricsProductSections(metricsDashboardModel);
    };
    if ($("metricsProductTrendFilter")) $("metricsProductTrendFilter").onchange = function () {
      metricsProductTrendFilter = $("metricsProductTrendFilter").value || "all";
      if (metricsDashboardModel) renderMetricsProductSections(metricsDashboardModel);
    };
    if ($("metricsDeadStockSort")) $("metricsDeadStockSort").onchange = function () {
      metricsDeadStockSort = $("metricsDeadStockSort").value || "days";
      if (metricsDashboardModel) renderMetricsInventory(metricsDashboardModel);
    };
    if ($("metricsStockRiskCategory")) $("metricsStockRiskCategory").onchange = function () {
      metricsStockRiskCategory = $("metricsStockRiskCategory").value || "";
      if (metricsDashboardModel) renderMetricsInventory(metricsDashboardModel);
    };
    document.querySelectorAll("[data-metric-trend]").forEach(function (button) {
      button.onclick = function () {
        metricsTrendMode = button.dataset.metricTrend || "revenue";
        if (metricsDashboardModel) drawMetricsSalesTrend(metricsDashboardModel);
      };
    });
    document.querySelectorAll("[data-product-rank]").forEach(function (button) {
      button.onclick = function () {
        metricsProductRankMode = button.dataset.productRank || "units";
        if (metricsDashboardModel) renderMetricsProductSections(metricsDashboardModel);
      };
    });
  }

  function stockCountDateValue(dateKey) {
    var value = new Date(String(dateKey || today()) + "T12:00:00");
    return isFinite(value.getTime()) ? value : new Date();
  }
  function stockCountDaysBetween(from, to) {
    return Math.floor((stockCountDateValue(to).getTime() - stockCountDateValue(from).getTime()) / 86400000);
  }
  function stockCountCampaignInfo(products, results) {
    var month = monthKey(today());
    var year = Number(month.slice(0, 4)), monthNumber = Number(month.slice(5, 7));
    var daysInMonth = new Date(year, monthNumber, 0).getDate();
    var durationDays = Math.min(daysInMonth, Math.max(14, Math.ceil(products.length / 16)));
    var deadline = month + "-" + String(durationDays).padStart(2, "0");
    var activeIds = {};
    products.forEach(function (product) { activeIds[product.id] = true; });
    var countedIds = {};
    (results || []).forEach(function (result) {
      var resultMonth = monthKey(String(result.submittedAt || result.createdAt || "").slice(0, 10));
      if (resultMonth === month && activeIds[result.productId]) countedIds[result.productId] = true;
    });
    var counted = Object.keys(countedIds).length;
    var remaining = Math.max(0, products.length - counted);
    var daysLeft = Math.max(1, stockCountDaysBetween(today(), deadline) + 1);
    var dailyTarget = remaining ? Math.min(30, Math.max(4, Math.ceil(remaining / daysLeft))) : 0;
    return {
      id: "stock-count-campaign-" + month,
      month: month,
      totalProducts: products.length,
      countedProducts: counted,
      remainingProducts: remaining,
      durationDays: durationDays,
      deadline: deadline,
      dailyTarget: dailyTarget,
      overdue: today() > deadline && remaining > 0,
      complete: remaining === 0
    };
  }
  function stockCountLastResultsByProduct(results) {
    var latest = {};
    (results || []).forEach(function (result) {
      var current = latest[result.productId];
      if (!current || String(result.submittedAt || "") > String(current.submittedAt || "")) latest[result.productId] = result;
    });
    return latest;
  }
  function saveGeneratedStockCountRows(rows, campaign, priorCampaign) {
    var campaignChanged = !priorCampaign || Number(priorCampaign.totalProducts || 0) !== campaign.totalProducts || Number(priorCampaign.countedProducts || 0) !== campaign.countedProducts || Number(priorCampaign.dailyTarget || 0) !== campaign.dailyTarget || String(priorCampaign.deadline || "") !== campaign.deadline || !!priorCampaign.complete !== campaign.complete;
    if (!rows.length && !campaignChanged) return Promise.resolve(false);
    return dbPromise.then(function (db) { return new Promise(function (resolve, reject) {
      var transaction = db.transaction(["stockCountMissions", "stockCountCampaigns"], "readwrite");
      rows.forEach(function (row) { transaction.objectStore("stockCountMissions").put(row); });
      if (campaignChanged) transaction.objectStore("stockCountCampaigns").put(Object.assign({}, priorCampaign || {}, campaign, { updatedAt: nowIso(), createdAt: priorCampaign && priorCampaign.createdAt || nowIso() }));
      transaction.oncomplete = function () { scheduleDiskSnapshot(); resolve(true); };
      transaction.onerror = function () { reject(transaction.error || new Error("No se pudieron preparar los conteos")); };
      transaction.onabort = function () { reject(transaction.error || new Error("Preparacion de conteos cancelada")); };
    }); });
  }
  function ensureStockCountMissions(products, missions, results, campaigns, users) {
    var campaign = stockCountCampaignInfo(products, results);
    var priorCampaign = (campaigns || []).filter(function (row) { return row.id === campaign.id; })[0] || null;
    var activeProductIds = {};
    products.forEach(function (product) { activeProductIds[product.id] = true; });
    var pendingByProduct = {}, pendingRows = [];
    (missions || []).forEach(function (mission) {
      if (mission.status !== "PENDING" || !activeProductIds[mission.productId] || pendingByProduct[mission.productId]) return;
      pendingByProduct[mission.productId] = true;
      pendingRows.push(mission);
    });
    var countedThisMonth = {};
    (results || []).forEach(function (result) {
      if (monthKey(String(result.submittedAt || result.createdAt || "").slice(0, 10)) === campaign.month) countedThisMonth[result.productId] = true;
    });
    var lastResults = stockCountLastResultsByProduct(results);
    var completedTodayByProduct = {};
    (results || []).forEach(function (result) {
      if (activeProductIds[result.productId] && String(result.submittedAt || result.createdAt || "").slice(0, 10) === today()) completedTodayByProduct[result.productId] = true;
    });
    var completedToday = Object.keys(completedTodayByProduct).length;
    var needed = Math.max(0, campaign.dailyTarget - pendingRows.length - completedToday);
    var employeeUsers = (users || []).filter(function (user) { return user.active !== false && user.role === "employee"; }).sort(function (a, b) { return String(a.username || "").localeCompare(String(b.username || "")); });
    var employeeLoad = {};
    employeeUsers.forEach(function (user) { employeeLoad[user.id] = 0; });
    pendingRows.forEach(function (mission) { if (employeeLoad[mission.assignedTo] != null) employeeLoad[mission.assignedTo] += 1; });
    var candidates = products.filter(function (product) { return !countedThisMonth[product.id] && !pendingByProduct[product.id]; }).sort(function (a, b) {
      var aLast = lastResults[a.id] && lastResults[a.id].submittedAt || "";
      var bLast = lastResults[b.id] && lastResults[b.id].submittedAt || "";
      return aLast.localeCompare(bLast) || Number(b.stock || 0) - Number(a.stock || 0) || String(a.name || "").localeCompare(String(b.name || ""));
    });
    var generated = candidates.slice(0, needed).map(function (product) {
      var lastResult = lastResults[product.id];
      var assignee = employeeUsers.slice().sort(function (a, b) { return employeeLoad[a.id] - employeeLoad[b.id] || String(a.username || "").localeCompare(String(b.username || "")); })[0] || null;
      if (assignee) employeeLoad[assignee.id] += 1;
      return {
        id: "stock-count-" + campaign.month + "-" + product.id,
        missionDate: today(), campaignMonth: campaign.month, campaignDueDate: campaign.deadline,
        type: "MONTHLY_DAILY", status: "PENDING", productId: product.id,
        assignedTo: assignee && assignee.id || "", assignedToName: assignee && (assignee.displayName || assignee.username) || "", assignedUsername: assignee && assignee.username || "",
        productNameSnapshot: product.name || "Producto", categorySnapshot: productCategory(product), unitTypeSnapshot: product.unitType || product.priceUnit || "unidad",
        expectedStockSnapshot: moneyPrecision(Number(product.stock || 0)), expectedPriceSnapshot: moneyPrecision(productUnitPrice(product)),
        productUpdatedAtSnapshot: product.updatedAt || "", lastCountAt: lastResult && lastResult.submittedAt || "",
        generatedAt: nowIso()
      };
    });
    return saveGeneratedStockCountRows(generated, campaign, priorCampaign);
  }
  function setStockCountRequestButtonState(waiting) {
    var button = $("stockCountRequestMissionBtn");
    if (!button) return;
    button.disabled = !!waiting;
    button.textContent = waiting ? "Preparando..." : "+ Otra mision";
  }
  function requestAdditionalStockCountMission() {
    if (!currentUser || isRequestingStockCountMission) return;
    isRequestingStockCountMission = true;
    setStockCountRequestButtonState(true);
    Promise.all([all("products"), all("stockCountMissions"), all("stockCountResults")]).then(function (sets) {
      var products = sets[0].filter(function (product) { return product.active !== false; });
      var productsById = {};
      products.forEach(function (product) { productsById[product.id] = product; });
      var pending = sets[1].filter(function (mission) { return mission.status === "PENDING" && productsById[mission.productId]; });
      var availableForUser = pending.filter(function (mission) {
        return !mission.assignedTo || mission.assignedTo === currentUser.id || mission.assignedUsername === currentUser.username;
      }).sort(function (a, b) {
        return String(a.missionDate || "").localeCompare(String(b.missionDate || "")) || String(a.generatedAt || "").localeCompare(String(b.generatedAt || ""));
      });
      if (availableForUser.length) return { id: availableForUser[0].id, existing: true };
      if (!products.length) throw new Error("No hay productos activos para contar");
      var pendingByProduct = {};
      pending.forEach(function (mission) { pendingByProduct[mission.productId] = true; });
      var lastResults = stockCountLastResultsByProduct(sets[2]);
      var countedThisMonth = {}, countedToday = {};
      sets[2].forEach(function (result) {
        if (!productsById[result.productId]) return;
        var resultDate = String(result.submittedAt || result.createdAt || "").slice(0, 10);
        if (monthKey(resultDate) === monthKey(today())) countedThisMonth[result.productId] = true;
        if (resultDate === today()) countedToday[result.productId] = true;
      });
      var candidates = products.filter(function (product) { return !pendingByProduct[product.id]; }).sort(function (a, b) {
        var aPriority = !countedThisMonth[a.id] ? 0 : !countedToday[a.id] ? 1 : 2;
        var bPriority = !countedThisMonth[b.id] ? 0 : !countedToday[b.id] ? 1 : 2;
        var aLast = lastResults[a.id] && lastResults[a.id].submittedAt || "";
        var bLast = lastResults[b.id] && lastResults[b.id].submittedAt || "";
        return aPriority - bPriority || aLast.localeCompare(bLast) || Number(b.stock || 0) - Number(a.stock || 0) || String(a.name || "").localeCompare(String(b.name || ""));
      });
      if (!candidates.length) throw new Error("Todas las misiones disponibles ya estan asignadas");
      var product = candidates[0], lastResult = lastResults[product.id], campaign = stockCountCampaignInfo(products, sets[2]), stamp = nowIso();
      var mission = {
        id: "stock-count-requested-" + uid(), missionDate: today(), campaignMonth: campaign.month, campaignDueDate: campaign.deadline,
        type: "EMPLOYEE_REQUESTED", status: "PENDING", productId: product.id,
        assignedTo: currentUser.id, assignedToName: currentUser.displayName || currentUser.username, assignedUsername: currentUser.username,
        requestedBy: currentUser.id, requestedAt: stamp,
        productNameSnapshot: product.name || "Producto", categorySnapshot: productCategory(product), unitTypeSnapshot: product.unitType || product.priceUnit || "unidad",
        expectedStockSnapshot: moneyPrecision(Number(product.stock || 0)), expectedPriceSnapshot: moneyPrecision(productUnitPrice(product)),
        productUpdatedAtSnapshot: product.updatedAt || "", lastCountAt: lastResult && lastResult.submittedAt || "", generatedAt: stamp
      };
      return dbPromise.then(function (db) { return new Promise(function (resolve, reject) {
        var transaction = db.transaction(["stockCountMissions", "auditLog"], "readwrite");
        transaction.objectStore("stockCountMissions").put(mission);
        transaction.objectStore("auditLog").put({ id: uid(), createdAt: stamp, userId: currentUser.id, username: currentUser.username, action: "STOCK_COUNT_MISSION_REQUESTED", detail: product.id + " | mision voluntaria", severity: "normal" });
        transaction.oncomplete = function () { scheduleDiskSnapshot(); resolve({ id: mission.id, existing: false }); };
        transaction.onerror = function () { reject(transaction.error || new Error("No se pudo preparar otra mision")); };
        transaction.onabort = function () { reject(transaction.error || new Error("La nueva mision fue cancelada")); };
      }); });
    }).then(function (mission) {
      isRequestingStockCountMission = false;
      setStockCountRequestButtonState(false);
      if (mission.existing) toast("Ya tiene una mision lista para continuar");
      renderStockCounts();
      openStockCountMission(mission.id);
    }).catch(function (error) {
      isRequestingStockCountMission = false;
      setStockCountRequestButtonState(false);
      toast(error.message || "No se pudo preparar otra mision");
    });
  }
  function stockCountMissionAgeLabel(mission) {
    if (!mission.lastCountAt) return "Nunca controlado";
    var days = Math.max(0, stockCountDaysBetween(String(mission.lastCountAt).slice(0, 10), today()));
    return days === 0 ? "Controlado hoy" : "Hace " + days + " dia" + (days === 1 ? "" : "s");
  }
  function stockCountResultIsReview(result) {
    return result.status === "PENDING_REVIEW";
  }
  function renderStockCountMissionRows(pending, productsById) {
    if (!$("stockCountMissionList")) return;
    $("stockCountMissionTotal").textContent = String(pending.length);
    $("stockCountMissionList").innerHTML = pending.length ? pending.slice(0, 60).map(function (mission) {
      var product = productsById[mission.productId];
      var stock = product ? Number(product.stock || 0) : Number(mission.expectedStockSnapshot || 0);
      var price = product ? productUnitPrice(product) : Number(mission.expectedPriceSnapshot || 0);
      var unit = product && (product.unitType || product.priceUnit) || mission.unitTypeSnapshot || "unidad";
      var overdue = String(mission.missionDate || "") < today();
      var assignment = isAdmin() && mission.assignedToName ? " · " + mission.assignedToName : "";
      return "<article class='stock-count-mission" + (overdue ? " overdue" : "") + "'><div><span>" + escapeHtml(mission.categorySnapshot || "General") + (overdue ? " · Pendiente anterior" : " · Mision de hoy") + escapeHtml(assignment) + "</span><h3>" + escapeHtml(product && product.name || mission.productNameSnapshot) + "</h3><small>" + escapeHtml(stockCountMissionAgeLabel(mission)) + "</small></div>"
        + "<div class='stock-count-expected-mini'><span>Deberia haber</span><b>" + formatQuantity(stock) + " " + escapeHtml(unitLabel(unit, stock)) + "</b><span>Precio POS</span><b>" + money(price) + " / " + escapeHtml(unit) + "</b></div>"
        + "<button type='button' data-stock-count-open='" + escapeHtml(mission.id) + "'>Contar ahora</button></article>";
    }).join("") : empty("No hay misiones pendientes. El inventario asignado esta al dia.");
    document.querySelectorAll("[data-stock-count-open]").forEach(function (button) { button.onclick = function () { openStockCountMission(button.dataset.stockCountOpen); }; });
  }
  function renderStockCountAdmin(results, missions, productsById, usersById, campaign) {
    var area = $("stockCountAdminArea");
    if (!area) return;
    area.classList.toggle("hidden", !isAdmin());
    if (!isAdmin()) return;
    var reviews = results.filter(stockCountResultIsReview).sort(function (a, b) { return String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")); });
    $("stockCountReviewTotal").textContent = String(reviews.length);
    $("stockCountReviewList").innerHTML = reviews.length ? reviews.map(function (result) {
      var product = productsById[result.productId];
      return "<article class='stock-count-review-row'><div><span>" + escapeHtml(result.productNameSnapshot || product && product.name || "Producto") + "</span><small>" + escapeHtml(result.employeeName || "Empleado") + " · " + escapeHtml(String(result.submittedAt || "").slice(0, 16).replace("T", " ")) + "</small></div>"
        + "<div><span>Stock sistema / contado</span><b>" + formatQuantity(result.expectedStock) + " → " + formatQuantity(result.actualStock) + "</b></div>"
        + "<div><span>Precio POS / exhibido</span><b>" + money(result.expectedPrice) + " → " + money(result.observedPrice) + "</b></div>"
        + "<button type='button' data-stock-count-review='" + escapeHtml(result.id) + "'>Revisar</button></article>";
    }).join("") : empty("No hay diferencias pendientes de revision.");
    document.querySelectorAll("[data-stock-count-review]").forEach(function (button) { button.onclick = function () { openStockCountReview(button.dataset.stockCountReview); }; });
    var overdue = missions.filter(function (mission) { return mission.status === "PENDING" && String(mission.missionDate || "") < today(); });
    var currentMonthResults = results.filter(function (result) { return monthKey(String(result.submittedAt || "").slice(0, 10)) === campaign.month; });
    var byUser = {};
    currentMonthResults.forEach(function (result) {
      var key = result.employeeId || "unknown";
      if (!byUser[key]) byUser[key] = { count: 0, late: 0, missed: 0, name: result.employeeName || usersById[key] && usersById[key].displayName || "Usuario" };
      byUser[key].count += 1;
      if (result.completedLate) byUser[key].late += 1;
    });
    overdue.forEach(function (mission) {
      var key = mission.assignedTo || "unassigned";
      if (!byUser[key]) byUser[key] = { count: 0, late: 0, missed: 0, name: mission.assignedToName || usersById[key] && usersById[key].displayName || "Sin asignar" };
      byUser[key].missed += 1;
    });
    $("stockCountComplianceList").innerHTML = "<div class='stock-count-deadline-status " + (campaign.overdue || overdue.length ? "late" : "") + "'><b>" + (campaign.complete ? "Ciclo mensual completo" : campaign.overdue ? "Ciclo mensual vencido" : "Fecha limite " + campaign.deadline) + "</b><span>" + overdue.length + " misiones diarias vencidas · " + campaign.remainingProducts + " productos restantes</span></div>"
      + (Object.keys(byUser).length ? "<div class='stock-count-user-compliance'>" + Object.keys(byUser).map(function (key) { var row = byUser[key]; return "<span><b>" + escapeHtml(row.name) + "</b><small>" + row.count + " conteos" + (row.late ? " · " + row.late + " completados tarde" : "") + (row.missed ? " · " + row.missed + " misiones vencidas" : row.late ? "" : " · en plazo") + "</small></span>"; }).join("") + "</div>" : "<p class='stock-count-empty-note'>Todavia no hay conteos completados este mes.</p>");
  }
  function renderStockCountDashboard(products, missions, results, users, campaign) {
    var productsById = {}, usersById = {};
    products.forEach(function (product) { productsById[product.id] = product; });
    users.forEach(function (user) { usersById[user.id] = user; });
    var allPending = missions.filter(function (mission) { return mission.status === "PENDING" && productsById[mission.productId]; });
    var pending = allPending.filter(function (mission) {
      var assignedUser = mission.assignedTo && usersById[mission.assignedTo];
      return isAdmin() || !mission.assignedTo || !assignedUser || assignedUser.active === false || mission.assignedTo === currentUser.id || mission.assignedUsername === currentUser.username;
    }).sort(function (a, b) {
      return String(a.missionDate || "").localeCompare(String(b.missionDate || "")) || String(a.lastCountAt || "").localeCompare(String(b.lastCountAt || ""));
    });
    var myToday = results.filter(function (result) { return result.employeeId === currentUser.id && String(result.submittedAt || "").slice(0, 10) === today(); });
    var reviewCount = results.filter(stockCountResultIsReview).length;
    $("stockCountSummary").innerHTML = "<article><span>Pendientes</span><b>" + pending.length + "</b><small>Misiones disponibles</small></article>"
      + "<article><span>Completadas hoy</span><b>" + myToday.length + "</b><small>Por " + escapeHtml(currentUser.displayName || currentUser.username) + "</small></article>"
      + "<article><span>Progreso mensual</span><b>" + campaign.countedProducts + " / " + campaign.totalProducts + "</b><small>" + (campaign.totalProducts ? Math.round(campaign.countedProducts / campaign.totalProducts * 100) : 100) + "% controlado</small></article>"
      + "<article class='" + (isAdmin() && reviewCount ? "attention" : "") + "'><span>" + (isAdmin() ? "Para revisar" : "Fecha limite") + "</span><b>" + (isAdmin() ? reviewCount : escapeHtml(campaign.deadline.slice(8, 10) + "/" + campaign.deadline.slice(5, 7))) + "</b><small>" + (isAdmin() ? "Solo administracion" : "Ciclo mensual") + "</small></article>";
    $("stockCountDeadlineBadge").textContent = campaign.complete ? "Ciclo mensual completo" : "Finaliza " + campaign.deadline + " · objetivo " + campaign.dailyTarget + " por dia";
    $("stockCountDeadlineBadge").className = campaign.overdue ? "late" : campaign.complete ? "complete" : "";
    var progress = campaign.totalProducts ? Math.min(100, campaign.countedProducts / campaign.totalProducts * 100) : 100;
    $("stockCountMonthlyProgress").innerHTML = "<div class='stock-count-progress-ring' style='--progress:" + progress.toFixed(2) + "'><strong>" + Math.round(progress) + "%</strong><span>del inventario</span></div><div class='stock-count-progress-track' title='" + campaign.countedProducts + " de " + campaign.totalProducts + " productos cubiertos'><i style='width:" + progress.toFixed(2) + "%'></i></div><div class='stock-count-progress-copy'><b>" + campaign.remainingProducts + " productos restantes</b><span>" + campaign.countedProducts + " de " + campaign.totalProducts + " productos cubiertos por misiones completadas.</span><span>Otra mision prioriza productos que aun no se contaron este mes.</span></div>";
    $("stockCountMyActivity").innerHTML = myToday.length ? "<h3>Tu trabajo de hoy</h3>" + myToday.slice(-6).reverse().map(function (result) { return "<span><b>" + escapeHtml(result.productNameSnapshot) + "</b><small>Mision completada · " + escapeHtml(String(result.submittedAt || "").slice(11, 16)) + "</small></span>"; }).join("") : "<p>Los conteos que completes hoy apareceran aqui.</p>";
    renderStockCountMissionRows(pending, productsById);
    renderStockCountAdmin(results, missions, productsById, usersById, campaign);
  }
  function renderStockCounts() {
    if (!currentUser || !$("stockCountMissionList")) return;
    var sequence = ++stockCountRenderSequence;
    Promise.all([all("products"), all("stockCountMissions"), all("stockCountResults"), all("users"), all("stockCountCampaigns")]).then(function (sets) {
      if (sequence !== stockCountRenderSequence) return;
      var products = sets[0].filter(function (product) { return product.active !== false; });
      return ensureStockCountMissions(products, sets[1], sets[2], sets[4], sets[3]).then(function (changed) {
        if (!changed) return { products: products, missions: sets[1], results: sets[2], users: sets[3] };
        return Promise.all([all("stockCountMissions"), all("stockCountCampaigns")]).then(function (fresh) { return { products: products, missions: fresh[0], results: sets[2], users: sets[3] }; });
      });
    }).then(function (data) {
      if (!data || sequence !== stockCountRenderSequence) return;
      renderStockCountDashboard(data.products, data.missions, data.results, data.users, stockCountCampaignInfo(data.products, data.results));
    }).catch(function (error) { if (sequence === stockCountRenderSequence) $("stockCountMissionList").innerHTML = empty(error.message || "No se pudieron cargar los conteos."); });
  }
  function openStockCountMission(missionId) {
    Promise.all([all("stockCountMissions"), all("products")]).then(function (sets) {
      var mission = sets[0].filter(function (row) { return row.id === missionId && row.status === "PENDING"; })[0];
      var product = mission && sets[1].filter(function (row) { return row.id === mission.productId && row.active !== false; })[0];
      if (!mission || !product) throw new Error("La mision ya no esta disponible");
      activeStockCountMission = {
        mission: mission, productId: product.id, productName: product.name,
        expectedStock: moneyPrecision(Number(product.stock || 0)), expectedPrice: moneyPrecision(productUnitPrice(product)),
        unitType: product.unitType || product.priceUnit || "unidad", productUpdatedAt: product.updatedAt || ""
      };
      $("stockCountModalTitle").textContent = product.name || "Producto";
      $("stockCountExpected").innerHTML = "<div><span>Deberia haber</span><b>" + formatQuantity(activeStockCountMission.expectedStock) + " " + escapeHtml(unitLabel(activeStockCountMission.unitType, activeStockCountMission.expectedStock)) + "</b></div><div><span>Precio en el sistema</span><b>" + money(activeStockCountMission.expectedPrice) + " / " + escapeHtml(activeStockCountMission.unitType) + "</b></div>";
      $("stockCountActual").value = "";
      $("stockCountObservedPrice").value = "";
      $("stockCountNote").value = "";
      $("stockCountModal").classList.remove("hidden");
      $("stockCountActual").focus();
    }).catch(function (error) { toast(error.message || "No se pudo abrir la mision"); renderStockCounts(); });
  }
  function closeStockCountMission() {
    $("stockCountModal").classList.add("hidden");
    activeStockCountMission = null;
  }
  function submitStockCountMission(event) {
    event.preventDefault();
    if (!activeStockCountMission || !currentUser) return;
    var actualText = $("stockCountActual").value.trim(), priceText = $("stockCountObservedPrice").value.trim();
    var actualStock = parseMoney(actualText), observedPrice = parseMoney(priceText);
    if (!actualText || actualStock < 0) { toast("Ingrese la cantidad fisica contada"); $("stockCountActual").focus(); return; }
    if (!priceText || observedPrice < 0) { toast("Ingrese el precio exhibido"); $("stockCountObservedPrice").focus(); return; }
    var draft = Object.assign({}, activeStockCountMission), stamp = nowIso();
    Promise.all([all("stockCountMissions"), all("products")]).then(function (sets) {
      var mission = sets[0].filter(function (row) { return row.id === draft.mission.id && row.status === "PENDING"; })[0];
      var product = mission && sets[1].filter(function (row) { return row.id === draft.productId && row.active !== false; })[0];
      if (!mission || !product) throw new Error("La mision ya fue completada o el producto cambio");
      var stockMismatch = Math.abs(actualStock - draft.expectedStock) > .009;
      var priceMismatch = Math.abs(observedPrice - draft.expectedPrice) > .009;
      var concurrentChange = String(product.updatedAt || "") !== String(draft.productUpdatedAt || "") || Math.abs(Number(product.stock || 0) - draft.expectedStock) > .009 || Math.abs(productUnitPrice(product) - draft.expectedPrice) > .009;
      var requiresReview = stockMismatch || priceMismatch || concurrentChange;
      var result = {
        id: uid(), missionId: mission.id, campaignMonth: monthKey(today()), productId: product.id,
        productNameSnapshot: product.name || mission.productNameSnapshot, categorySnapshot: productCategory(product), unitTypeSnapshot: draft.unitType,
        expectedStock: draft.expectedStock, actualStock: moneyPrecision(actualStock), stockDifference: moneyPrecision(actualStock - draft.expectedStock),
        expectedPrice: draft.expectedPrice, observedPrice: moneyPrecision(observedPrice), priceDifference: moneyPrecision(observedPrice - draft.expectedPrice),
        productUpdatedAtAtOpen: draft.productUpdatedAt, productUpdatedAtAtSubmit: product.updatedAt || "", concurrentChange: concurrentChange,
        status: requiresReview ? "PENDING_REVIEW" : "VERIFIED", employeeVisibleStatus: "COMPLETED",
        employeeId: currentUser.id, employeeName: currentUser.displayName || currentUser.username, employeeUsername: currentUser.username,
        note: $("stockCountNote").value.trim(), completedLate: String(mission.missionDate || "") < today(), submittedAt: stamp
      };
      mission = Object.assign({}, mission, { status: "COMPLETED", resultId: result.id, completedAt: stamp, completedBy: currentUser.id, completedByName: result.employeeName });
      return dbPromise.then(function (db) { return new Promise(function (resolve, reject) {
        var transaction = db.transaction(["stockCountMissions", "stockCountResults", "auditLog"], "readwrite");
        var check = transaction.objectStore("stockCountMissions").get(mission.id);
        check.onsuccess = function () {
          if (!check.result || check.result.status !== "PENDING") { transaction.abort(); return; }
          transaction.objectStore("stockCountMissions").put(mission);
          transaction.objectStore("stockCountResults").put(result);
          transaction.objectStore("auditLog").put({ id: uid(), createdAt: stamp, userId: currentUser.id, username: currentUser.username, action: "STOCK_COUNT_SUBMITTED", detail: product.id + " | mision " + mission.id, severity: "normal" });
        };
        transaction.oncomplete = function () { scheduleDiskSnapshot(); resolve(result); };
        transaction.onerror = function () { reject(transaction.error || new Error("No se pudo guardar el conteo")); };
        transaction.onabort = function () { reject(new Error("La mision ya fue procesada")); };
      }); });
    }).then(function () {
      closeStockCountMission();
      toast("Conteo enviado. Mision completada.");
      renderStockCounts();
    }).catch(function (error) { toast(error.message || "No se pudo enviar el conteo"); });
  }
  function stockCountKnownLossEstimate(product, finalStock) {
    var currentStock = Math.max(0, Number(product && product.stock || 0));
    var shortage = Math.max(0, currentStock - Number(finalStock || 0));
    var pools = productCostPools(product || {}), unknownRemoved = Math.min(pools.unknown, shortage), remaining = Math.max(0, shortage - unknownRemoved);
    var knownRemoved = Math.min(pools.known, remaining), averageCost = pools.known > 0 ? pools.value / pools.known : 0;
    return { shortage: shortage, knownQuantity: knownRemoved, unknownQuantity: moneyPrecision(unknownRemoved + Math.max(0, remaining - knownRemoved)), knownCost: moneyPrecision(knownRemoved * averageCost), averageCost: moneyPrecision(averageCost) };
  }
  function openStockCountReview(resultId) {
    if (!isAdmin()) return;
    Promise.all([all("stockCountResults"), all("products")]).then(function (sets) {
      var result = sets[0].filter(function (row) { return row.id === resultId && row.status === "PENDING_REVIEW"; })[0];
      var product = result && sets[1].filter(function (row) { return row.id === result.productId; })[0];
      if (!result || !product) throw new Error("La revision ya no esta disponible");
      var loss = stockCountKnownLossEstimate(product, result.actualStock);
      $("stockCountReviewId").value = result.id;
      $("stockCountReviewTitle").textContent = product.name || result.productNameSnapshot;
      $("stockCountFinalStock").value = String(result.actualStock).replace(".", ",");
      $("stockCountFinalPrice").value = String(result.observedPrice).replace(".", ",");
      $("stockCountAdminNote").value = "";
      $("stockCountReviewDetail").innerHTML = "<div><span>Informado por</span><b>" + escapeHtml(result.employeeName || "Empleado") + "</b></div><div><span>Stock esperado / contado</span><b>" + formatQuantity(result.expectedStock) + " → " + formatQuantity(result.actualStock) + "</b></div><div><span>Stock actual del sistema</span><b>" + formatQuantity(product.stock) + " " + escapeHtml(unitLabel(product.unitType || product.priceUnit, product.stock)) + "</b></div><div><span>Precio POS / exhibido</span><b>" + money(result.expectedPrice) + " → " + money(result.observedPrice) + "</b></div><div><span>Perdida conocida estimada</span><b>" + (loss.knownCost ? money(loss.knownCost) : loss.shortage ? "Costo desconocido" : "Sin faltante") + "</b></div>";
      $("stockCountReviewModal").classList.remove("hidden");
      $("stockCountFinalStock").focus();
    }).catch(function (error) { toast(error.message || "No se pudo abrir la revision"); renderStockCounts(); });
  }
  function closeStockCountReview() {
    $("stockCountReviewModal").classList.add("hidden");
    $("stockCountReviewId").value = "";
  }
  function resolveStockCountWithoutChange() {
    if (!isAdmin()) return;
    var resultId = $("stockCountReviewId").value;
    all("stockCountResults").then(function (results) {
      var result = results.filter(function (row) { return row.id === resultId && row.status === "PENDING_REVIEW"; })[0];
      if (!result) throw new Error("La revision ya fue resuelta");
      result.status = "RESOLVED_NO_CHANGE"; result.reviewedAt = nowIso(); result.reviewedBy = currentUser.id; result.reviewedByName = currentUser.displayName || currentUser.username; result.adminNote = $("stockCountAdminNote").value.trim();
      return add("stockCountResults", result).then(function () { return audit("STOCK_COUNT_RESOLVED_NO_CHANGE", result.productId, "warning"); });
    }).then(function () { closeStockCountReview(); renderStockCounts(); toast("Revision cerrada sin cambios"); }).catch(function (error) { toast(error.message || "No se pudo cerrar la revision"); });
  }
  function applyStockCountReview(event) {
    event.preventDefault();
    if (!isAdmin()) return;
    var resultId = $("stockCountReviewId").value;
    var stockText = $("stockCountFinalStock").value.trim(), priceText = $("stockCountFinalPrice").value.trim();
    var finalStock = parseMoney(stockText), finalPrice = parseMoney(priceText);
    if (!stockText || finalStock < 0) { toast("Ingrese el stock definitivo"); return; }
    if (!priceText || finalPrice < 0) { toast("Ingrese el precio definitivo"); return; }
    Promise.all([all("stockCountResults"), all("products")]).then(function (sets) {
      var result = sets[0].filter(function (row) { return row.id === resultId && row.status === "PENDING_REVIEW"; })[0];
      var product = result && sets[1].filter(function (row) { return row.id === result.productId; })[0];
      if (!result || !product) throw new Error("La revision ya fue resuelta o falta el producto");
      product = Object.assign({}, product);
      var beforeState = purchaseProductState(product), oldStock = Math.max(0, Number(product.stock || 0)), oldPrice = productUnitPrice(product), delta = moneyPrecision(finalStock - oldStock);
      var pools = productCostPools(product), knownLoss = 0, knownRemoved = 0, unknownRemoved = 0;
      if (delta < 0) {
        var shortage = Math.abs(delta);
        unknownRemoved = Math.min(pools.unknown, shortage);
        var remaining = Math.max(0, shortage - unknownRemoved);
        knownRemoved = Math.min(pools.known, remaining);
        var averageCost = pools.known > 0 ? pools.value / pools.known : 0;
        knownLoss = moneyPrecision(knownRemoved * averageCost);
        unknownRemoved = moneyPrecision(unknownRemoved + Math.max(0, remaining - knownRemoved));
        pools.unknown = Math.max(0, pools.unknown - Math.min(pools.unknown, shortage));
        pools.known = Math.max(0, pools.known - knownRemoved);
        pools.value = Math.max(0, pools.value - knownLoss);
      } else if (delta > 0) pools.unknown += delta;
      product.stock = moneyPrecision(finalStock);
      product.price = moneyPrecision(finalPrice);
      applyCostPools(product, pools);
      product.updatedAt = nowIso();
      var afterState = purchaseProductState(product), stamp = nowIso();
      var unknownLoss = delta < 0 ? unknownRemoved : 0;
      result.status = unknownLoss > .009 ? "RESOLVED_COST_PENDING" : "RESOLVED";
      result.reviewedAt = stamp; result.reviewedBy = currentUser.id; result.reviewedByName = currentUser.displayName || currentUser.username;
      result.finalStock = product.stock; result.finalPrice = product.price; result.appliedStockDifference = delta; result.knownLossAmount = knownLoss; result.unknownLossQuantity = unknownLoss; result.adminNote = $("stockCountAdminNote").value.trim();
      var movement = { id: uid(), type: "COUNT_ADJUSTMENT", productId: product.id, quantity: delta, knownCostQuantity: -knownRemoved, unknownCostQuantity: -unknownRemoved, knownCostValue: -knownLoss, referenceType: "STOCK_COUNT", referenceId: result.id, beforeState: beforeState, afterState: afterState, createdAt: stamp, createdBy: currentUser.id };
      var lossEntry = knownLoss > .009 ? { id: "stock-count-loss-" + result.id, type: "EXPENSE", date: today(), amount: knownLoss, category: "Perdida", description: "Faltante confirmado: " + product.name + " (" + formatQuantity(Math.abs(delta)) + " " + unitLabel(product.unitType || product.priceUnit, Math.abs(delta)) + ")", sourceType: "STOCK_COUNT", sourceId: result.id, createdAt: stamp, createdBy: currentUser.id } : null;
      if (lossEntry) result.lossEntryId = lossEntry.id;
      var priceRow = Math.abs(finalPrice - oldPrice) > .009 ? { id: uid(), productId: product.id, productName: product.name, previousPrice: oldPrice, newPrice: finalPrice, sourceType: "STOCK_COUNT", sourceId: result.id, createdAt: stamp, createdBy: currentUser.id } : null;
      return dbPromise.then(function (db) { return new Promise(function (resolve, reject) {
        var transaction = db.transaction(["stockCountResults", "products", "inventoryMovements", "monthlyEntries", "priceHistory", "auditLog"], "readwrite");
        var check = transaction.objectStore("stockCountResults").get(result.id);
        check.onsuccess = function () {
          if (!check.result || check.result.status !== "PENDING_REVIEW") { transaction.abort(); return; }
          transaction.objectStore("stockCountResults").put(result);
          transaction.objectStore("products").put(product);
          transaction.objectStore("inventoryMovements").put(movement);
          if (lossEntry) transaction.objectStore("monthlyEntries").put(lossEntry);
          if (priceRow) transaction.objectStore("priceHistory").put(priceRow);
          transaction.objectStore("auditLog").put({ id: uid(), createdAt: stamp, userId: currentUser.id, username: currentUser.username, action: "STOCK_COUNT_CORRECTION_APPLIED", detail: product.id + " | stock " + formatQuantity(oldStock) + " -> " + formatQuantity(finalStock) + " | precio " + money(oldPrice) + " -> " + money(finalPrice) + (unknownLoss ? " | costo desconocido" : ""), severity: "critical" });
        };
        transaction.oncomplete = function () { invalidateProductSearchCache(); scheduleDiskSnapshot(); resolve(result); };
        transaction.onerror = function () { reject(transaction.error || new Error("No se pudo aplicar la correccion")); };
        transaction.onabort = function () { reject(new Error("La revision ya fue procesada")); };
      }); });
    }).then(function (result) {
      closeStockCountReview(); renderAll();
      toast(result.unknownLossQuantity ? "Stock corregido; costo desconocido pendiente" : result.knownLossAmount ? "Stock corregido y perdida registrada" : "Stock y precio verificados");
    }).catch(function (error) { toast(error.message || "No se pudo aplicar la correccion"); });
  }

  function activityTone(a) {
    var action = String(a.action || "");
    if (a.severity === "critical" || /DELETED|UNDONE|REVIEW_REQUIRED/.test(action)) return "critical";
    if (a.severity === "warning" || /EDITED|SYNCED|WITHDRAWAL|EXPENSE|CLOSED/.test(action)) return "warning";
    if (/LOGIN|LOGOUT|CREATED|RECEIVED/.test(action)) return "normal";
    return "info";
  }
  function activityLabel(action) {
    return String(action || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function renderActivity() {
    if (!isDev() || !$("auditList")) return;
    all("auditLog").then(function (rows) {
      var counts = { critical: 0, warning: 0, normal: 0, info: 0 };
      rows.sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
      rows.forEach(function (a) { counts[activityTone(a)]++; });
      if ($("activitySummary")) {
        $("activitySummary").innerHTML = summary([
          ["Total", rows.length],
          ["Criticos", counts.critical],
          ["Advertencias", counts.warning],
          ["Normales", counts.normal]
        ]);
      }
      $("auditList").innerHTML = rows.slice(0, 180).map(function (a) {
        var tone = activityTone(a);
        var stamp = (a.createdAt || "").slice(0, 19).replace("T", " ");
        return "<article class='activity-row " + tone + "'>"
          + "<div class='activity-time'><b>" + escapeHtml(stamp || "sin fecha") + "</b><span>" + escapeHtml(a.username || "sistema") + "</span></div>"
          + "<div class='activity-main'><div><strong>" + escapeHtml(activityLabel(a.action)) + "</strong><small>" + escapeHtml(a.action || "") + "</small></div><p>" + escapeHtml(a.detail || "Sin detalle") + "</p></div>"
          + "<span class='activity-pill " + tone + "'>" + (tone === "critical" ? "Revisar" : tone === "warning" ? "Atencion" : tone === "info" ? "Info" : "OK") + "</span>"
          + "</article>";
      }).join("") || empty("Todavia no hay actividad registrada.");
    });
  }
  function renderAdmin() {
    if (!isAdmin()) return;
    all("users").then(function (users) {
      if ($("usersSummary")) {
        $("usersSummary").innerHTML = summary([
          ["Visibles", users.length],
          ["Empleados", users.filter(function (u) { return u.role === "employee"; }).length],
          ["Admins", users.filter(function (u) { return u.role === "admin"; }).length],
          ["Inactivos", users.filter(function (u) { return !u.active; }).length]
        ]);
      }
      $("usersList").innerHTML = users.length ? users.map(function (u) {
        var roleLabel = u.role === "admin" ? "Admin" : u.role === "dev" ? "Developer" : "Empleado";
        var initials = (u.displayName || u.username || "?").trim().slice(0, 2).toUpperCase();
        var locked = currentUser && currentUser.id === u.id;
        return "<article class='user-row " + (u.active ? "active" : "inactive") + "'>"
          + "<div class='user-avatar'>" + escapeHtml(initials) + "</div>"
          + "<div class='user-main'><strong>" + escapeHtml(u.displayName || u.username) + "</strong><span>@" + escapeHtml(u.username) + "</span></div>"
          + "<span class='user-role " + escapeHtml(u.role || "employee") + "'>" + roleLabel + "</span>"
          + "<span class='user-status " + (u.active ? "ok" : "off") + "'>" + (u.active ? "Activo" : "Inactivo") + "</span>"
          + "<small>" + escapeHtml((u.createdAt || "").slice(0, 10) || "Sin fecha") + "</small>"
          + "<div class='user-actions'><button type='button' data-user-edit='" + u.id + "'>Editar</button>"
          + "<button type='button' class='danger' data-user-delete='" + u.id + "'" + (locked ? " disabled" : "") + ">Borrar</button></div>"
          + "</article>";
      }).join("") : empty("No hay usuarios visibles.");
      document.querySelectorAll("[data-user-edit]").forEach(function (btn) {
        btn.onclick = function () { openUserEdit(btn.dataset.userEdit); };
      });
      document.querySelectorAll("[data-user-delete]").forEach(function (btn) {
        btn.onclick = function () { deleteUser(btn.dataset.userDelete); };
      });
    });
    renderActivity();
  }
  function openUserEdit(id) {
    if (!isAdmin()) return;
    all("users").then(function (users) {
      var user = users.filter(function (u) { return u.id === id; })[0];
      if (!user) { toast("Usuario no encontrado"); return; }
      $("editUserId").value = user.id;
      $("editUsername").value = user.username || "";
      $("editDisplayName").value = user.displayName || "";
      $("editRole").value = user.role || "employee";
      $("editPassword").value = "";
      $("editActive").value = String(user.active !== false);
      $("deleteUserBtn").disabled = currentUser && currentUser.id === user.id;
      $("userEditModal").classList.remove("hidden");
      $("editDisplayName").focus();
    });
  }
  function closeUserEdit() {
    if ($("userEditModal")) $("userEditModal").classList.add("hidden");
  }
  function saveUserEdit(e) {
    if (e) e.preventDefault();
    if (!isAdmin()) return;
    var id = $("editUserId").value;
    all("users").then(function (users) {
      var user = users.filter(function (u) { return u.id === id; })[0];
      if (!user) { toast("Usuario no encontrado"); return; }
      var username = $("editUsername").value.trim();
      if (!username) { toast("Usuario obligatorio"); $("editUsername").focus(); return; }
      var duplicate = users.filter(function (u) { return u.id !== id && u.username === username; })[0];
      if (duplicate) { toast("Ya existe ese usuario"); $("editUsername").focus(); return; }
      if (currentUser && currentUser.id === id && $("editActive").value !== "true") {
        toast("No puede desactivar el usuario actual");
        return;
      }
      user.username = username;
      user.displayName = $("editDisplayName").value.trim() || username;
      user.role = $("editRole").value;
      var editedPassword = $("editPassword").value.trim();
      if (editedPassword) user.password = editedPassword;
      user.active = $("editActive").value === "true";
      user.updatedAt = nowIso();
      add("users", user).then(function () {
        return audit("USER_EDITED", username, "warning");
      }).then(function () {
        if (currentUser && currentUser.id === id) {
          currentUser = user;
          currentSession.username = user.username;
          currentSession.displayName = user.displayName;
          currentSession.role = user.role;
          sessionStorage.setItem("bakerySession", JSON.stringify({ user: currentUser, session: currentSession }));
          updateSessionInfo();
          buildTabs();
        }
        closeUserEdit();
        renderAdmin();
        renderLoginUsers(username);
        toast("Usuario actualizado");
      });
    });
  }
  function deleteUser(id) {
    if (!isAdmin()) return;
    all("users").then(function (users) {
      var user = users.filter(function (u) { return u.id === id; })[0];
      if (!user) { toast("Usuario no encontrado"); return; }
      if (currentUser && currentUser.id === id) { toast("No puede borrar el usuario actual"); return; }
      if (!confirm("Borrar usuario " + (user.displayName || user.username) + "?")) return;
      del("users", id).then(function () {
        return audit("USER_DELETED", user.username, "critical");
      }).then(function () {
        renderAdmin();
        renderLoginUsers();
        toast("Usuario borrado");
      });
    });
  }
  function saveUser(e) {
    e.preventDefault();
    if (!isAdmin()) return;
    var username = $("newUsername").value.trim();
    var password = $("newPassword").value.trim();
    if (!username) { toast("Usuario obligatorio"); return; }
    if (!password) { toast("Clave obligatoria"); $("newPassword").focus(); return; }
    all("users").then(function (users) {
      var duplicate = users.filter(function (u) { return u.username === username; })[0];
      if (duplicate) { toast("Ya existe ese usuario"); return; }
      return add("users", {
        id: uid(), username: username, displayName: $("newDisplayName").value.trim() || username,
        role: $("newRole").value, password: password, active: true, createdAt: nowIso()
      }).then(function () { return audit("USER_CREATED", username); }).then(function () {
        $("userForm").reset();
        renderAdmin();
        renderLoginUsers(username);
      });
    });
  }
  function exportData() {
    Promise.all(STORES.map(all)).then(function (data) {
      var out = {};
      STORES.forEach(function (s, i) { out[s] = data[i]; });
      $("exportBox").textContent = JSON.stringify(out, null, 2);
      $("exportBox").classList.remove("hidden");
    });
  }
  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function isoAt(date, hour, minute) {
    var d = new Date(date + "T00:00:00");
    d.setHours(hour, minute || 0, rand(0, 59), 0);
    return d.toISOString();
  }
  function addDaysTo(date, offset) {
    var d = new Date(date);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  }
  function sample(arr) {
    return arr[rand(0, arr.length - 1)];
  }
  function generateTestData() {
    if (!isDev()) return;
    if (isGeneratingTestData) { toast("Ya se estan generando datos"); return; }
    isGeneratingTestData = true;
    var started = Date.now();
    if ($("generateTestDataBtn")) $("generateTestDataBtn").disabled = true;
    var months = Math.max(1, Math.min(6, Number($("testDataMonths").value || 6)));
    var days = months * 30;
    toast("Generando datos de prueba...");
    Promise.all([all("users"), all("products")]).then(function (data) {
      var users = data[0];
      var products = data[1].filter(function (p) { return p.active !== false; });
      var turnoAM = users.filter(function (u) { return u.username === "turno_manana"; })[0] || currentUser;
      var turnoPM = users.filter(function (u) { return u.username === "turno_tarde"; })[0] || currentUser;
      if (!products.length) {
        isGeneratingTestData = false;
        if ($("generateTestDataBtn")) $("generateTestDataBtn").disabled = false;
        return seed().then(generateTestData);
      }
      var todayDate = today();
      var batches = {
        transactions: [],
        baskets: [],
        basketItems: [],
        closures: [],
        productionItems: [],
        monthlyEntries: [],
        auditLog: []
      };
      for (var offset = days - 1; offset >= 0; offset--) {
        var date = addDaysTo(todayDate, -offset);
        var weekday = new Date(date + "T00:00:00").getDay();
        var dailySales = weekday === 0 ? rand(14, 24) : rand(26, 58);
        ["AM", "PM"].forEach(function (shift) {
          var user = shift === "AM" ? turnoAM : turnoPM;
          var shiftSales = Math.max(4, Math.round(dailySales * (shift === "AM" ? .48 : .52)));
          var shiftCash = 0;
          var shiftTransfer = 0;
          var shiftWithdrawals = 0;
          for (var i = 0; i < shiftSales; i++) {
            var isTicket = Math.random() > .38;
            var method = Math.random() > .32 ? "Efectivo" : "QR";
            var hour = shift === "AM" ? rand(7, 13) : rand(14, 20);
            var minute = rand(0, 59);
            var created = isoAt(date, hour, minute);
            var transactionId = uid();
            var basketId = isTicket ? uid() : "";
            var itemCount = isTicket ? rand(1, 4) : 0;
            var amount = 0;
            var items = [];
            if (isTicket) {
              for (var j = 0; j < itemCount; j++) {
                var p = sample(products);
                var qty = p.unitType === "kg" ? (rand(1, 12) / 10) : rand(1, 5);
                var subtotal = Math.max(300, Math.round(qty * Number(p.price || 1000)));
                amount += subtotal;
                items.push({ product: p, qty: qty, subtotal: subtotal });
              }
            } else {
              amount = [500, 800, 1000, 1500, 2000, 2500, 3000, 4500, 6000, 8500, 12000][rand(0, 10)];
              if (Math.random() > .97) amount = rand(100000, 180000);
            }
            if (method === "Efectivo") shiftCash += amount;
            else shiftTransfer += amount;
            var transferStatus = isDigitalPayment(method) ? (Math.random() > .12 ? "RECEIVED" : (Math.random() > .5 ? "PENDING" : "REVIEW")) : "";
            batches.transactions.push({
              id: transactionId, type: "SALE", amount: amount, paymentMethod: method, businessDate: date,
              shiftType: shift, userId: user && user.id, sessionId: "test-" + date + "-" + shift,
              createdAt: created, deleted: false, saleMode: isTicket ? "PRODUCT_BASKET" : "FAST",
              basketId: basketId, transferStatus: transferStatus, paymentStatus: isDigitalPayment(method) ? (transferStatus === "RECEIVED" ? "APPROVED" : transferStatus) : "PAID", paidAmount: isTicket ? (isDigitalPayment(method) ? amount : amount + [0, 500, 1000, 2000][rand(0, 3)]) : 0,
              changeAmount: 0, itemCount: itemCount
            });
            if (isTicket) {
              batches.baskets.push({ id: basketId, createdAt: created, userId: user && user.id, total: amount, paymentMethod: method, transactionId: transactionId });
              items.forEach(function (it) {
                batches.basketItems.push({ id: uid(), basketId: basketId, productId: it.product.id, productName: it.product.name, quantity: it.qty, unitPrice: Number(it.product.price || 0), subtotal: it.subtotal });
              });
            }
          }
          if (Math.random() > .35) {
            var withdrawal = [2000, 5000, 10000, 15000, 20000][rand(0, 4)];
            shiftWithdrawals += withdrawal;
            batches.transactions.push({
              id: uid(), type: "WITHDRAWAL", amount: withdrawal, paymentMethod: "Efectivo", businessDate: date,
              shiftType: shift, userId: user && user.id, sessionId: "test-" + date + "-" + shift,
              createdAt: isoAt(date, shift === "AM" ? 12 : 18, rand(0, 59)), deleted: false, withdrawnBy: "Encargado test"
            });
          }
          batches.closures.push({
            id: uid(), businessDate: date, shiftType: shift, closureKind: "COMPLETE",
            totalSales: shiftCash + shiftTransfer, expectedCash: shiftCash - shiftWithdrawals, expectedTransfer: shiftTransfer,
            countedCash: shiftCash - shiftWithdrawals + [-500, 0, 0, 0, 500][rand(0, 4)],
            countedTransfer: shiftTransfer, differenceCash: 0, differenceTransfer: 0,
            notes: "Cierre test", createdBy: user && user.id, createdAt: isoAt(date, shift === "AM" ? 14 : 21, 0)
          });
        });
        if (weekday !== 0) {
          products.slice(0, Math.min(products.length, rand(4, 8))).forEach(function (p) {
            batches.productionItems.push({
              id: uid(), date: date, productId: p.id, productName: p.name, unitType: p.unitType || "unidad",
              enteredAmount: p.unitType === "kg" ? rand(8, 95) : rand(12, 160), category: p.category || "",
              createdBy: currentUser && currentUser.id, createdAt: isoAt(date, 6, rand(20, 50))
            });
          });
        }
        if (weekday === 1 || Math.random() > .88) {
          batches.monthlyEntries.push({
            id: uid(), type: "EXPENSE", date: date, amount: [8000, 15000, 28000, 45000, 70000][rand(0, 4)],
            category: sample(monthlyCategories), description: "Gasto test", paymentMethod: Math.random() > .5 ? "Efectivo" : "QR",
            recurring: false, weekday: weekday, photoData: "", createdBy: currentUser && currentUser.id, createdAt: isoAt(date, 16, rand(0, 59))
          });
        }
      }
      batches.auditLog.push({
        id: uid(), createdAt: nowIso(), userId: currentUser && currentUser.id,
        username: currentUser && currentUser.username, action: "TEST_DATA_GENERATED",
        detail: months + " mes(es) de datos de prueba", severity: "warning"
      });
      return Promise.all(Object.keys(batches).map(function (store) {
        return addMany(store, batches[store]);
      }));
    }).then(function () {
      isGeneratingTestData = false;
      if ($("generateTestDataBtn")) $("generateTestDataBtn").disabled = false;
      renderAll();
      toast("Datos de prueba generados en " + ((Date.now() - started) / 1000).toFixed(1) + "s");
    }).catch(function (err) {
      isGeneratingTestData = false;
      if ($("generateTestDataBtn")) $("generateTestDataBtn").disabled = false;
      toast("No se pudieron generar datos: " + (err && err.message ? err.message : "error local"));
    });
  }
  function clearAllData() {
    if (!isDev()) return;
    $("clearDataConfirm").value = "";
    $("clearDataModal").classList.remove("hidden");
    $("clearDataConfirm").focus();
  }
  function closeClearDataModal() {
    $("clearDataModal").classList.add("hidden");
  }
  function confirmClearAllData(e) {
    if (e) e.preventDefault();
    if (!isDev()) return;
    var confirmation = $("clearDataConfirm").value.trim();
    if (confirmation !== "BORRAR") {
      toast("Escriba BORRAR para confirmar");
      $("clearDataConfirm").focus();
      return;
    }
    $("clearDataModal").classList.add("hidden");
    toast("Archivando copia y limpiando datos...");
    var operationalStores = STORES.filter(function (store) { return store !== "users"; });
    if (location.protocol === "file:" && !diskSnapshotServiceReady) {
      toast("No se pudo crear la copia. Reinicie LaViejaEsquina.exe e intente de nuevo.");
      return;
    }
    archiveCurrentSnapshot().then(function () {
      diskSnapshotPaused = true;
      return clearStoresAtomic(operationalStores);
    }).then(function () {
      sessionStorage.removeItem("bakerySession");
      localStorage.removeItem("bakeryTabOrder");
      localStorage.removeItem("forrajeriaMasterCatalogVersion");
      localStorage.removeItem("forrajeriaStoreCatalogVersion");
      localStorage.setItem(CLEAN_SLATE_STORAGE_KEY, CLEAN_SLATE_VERSION);
      diskSnapshotPaused = false;
      return writeDiskSnapshot(true);
    }).then(function () {
      toast("Base limpia. Usuarios conservados; copia anterior archivada.");
      setTimeout(function () { location.reload(); }, 600);
    }).catch(function () {
      diskSnapshotPaused = false;
      toast("No se pudo archivar y limpiar. No se borro ningun dato.");
    });
  }

  /* Proveedores UI. Persistence and stock mutations are delegated to the purchase engine. */
  function purchaseStatusLabel(status) {
    return ({ DRAFT: "Borrador", CONFIRMED: "Confirmado", VOIDED: "Anulado" })[String(status || "DRAFT").toUpperCase()] || String(status || "Borrador");
  }
  function purchaseStatusClass(status) {
    return ({ DRAFT: "draft", CONFIRMED: "confirmed", VOIDED: "voided" })[String(status || "DRAFT").toUpperCase()] || "draft";
  }
  function purchaseDateLabel(value) {
    var parts = String(value || "").slice(0, 10).split("-");
    return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : "Sin fecha";
  }
  function supplierNameById(id, snapshot) {
    var supplier = supplierDirectory.filter(function (row) { return row.id === id; })[0];
    return supplier && (supplier.name || supplier.companyName) || snapshot && (snapshot.name || snapshot.companyName) || "Proveedor sin nombre";
  }
  function purchaseLinesFor(id) {
    return purchaseLinesCache.filter(function (line) { return line.purchaseId === id && String(line.status || "ACTIVE") !== "VOIDED"; });
  }
  function purchaseProductName(line) {
    var product = supplierProductsCache.filter(function (row) { return row.id === line.productId; })[0];
    return line.productNameSnapshot || line.productName || product && product.name || "Producto";
  }
  function purchaseNormalizeInvoice(value) {
    return normalizeInvoiceNumber(value);
  }
  function purchaseEngineFunction(name) {
    if (window.ForrajeriaPurchases && typeof window.ForrajeriaPurchases[name] === "function") return window.ForrajeriaPurchases[name];
    var local = {
      supplierSave: typeof supplierSave === "function" ? supplierSave : null,
      purchaseSaveDraft: typeof purchaseSaveDraft === "function" ? purchaseSaveDraft : null,
      purchaseConfirm: typeof purchaseConfirm === "function" ? purchaseConfirm : null,
      purchaseVoid: typeof purchaseVoid === "function" ? purchaseVoid : null,
      purchaseCorrect: typeof purchaseCorrect === "function" ? purchaseCorrect : null
      ,purchaseStoreAttachment: typeof purchaseStoreAttachment === "function" ? purchaseStoreAttachment : null
      ,purchaseLoadAttachment: typeof purchaseLoadAttachment === "function" ? purchaseLoadAttachment : null
      ,purchaseRemoveAttachment: typeof purchaseRemoveAttachment === "function" ? purchaseRemoveAttachment : null
    };
    return local[name];
  }
  function purchaseRunEngine(name, args) {
    var fn = purchaseEngineFunction(name);
    if (!fn) return Promise.reject(new Error("El motor de compras no esta disponible. Cierre y vuelva a abrir la aplicacion."));
    try { return Promise.resolve(fn.apply(null, args || [])); }
    catch (error) { return Promise.reject(error); }
  }
  function purchaseShowError(error, fallback) {
    var message = error && error.message ? error.message : fallback || "No se pudo completar la accion.";
    if ($("purchaseEditorMessage")) {
      $("purchaseEditorMessage").textContent = message;
      $("purchaseEditorMessage").className = "purchase-editor-message error";
    }
    toast(message);
  }
  function purchaseLoadData() {
    return Promise.all([all("suppliers"), all("purchases"), all("purchaseLines"), all("products")]).then(function (sets) {
      supplierDirectory = sets[0].filter(function (row) { return row.active !== false; });
      purchaseHistory = sets[1];
      purchaseLinesCache = sets[2];
      supplierProductsCache = sets[3].filter(function (row) { return row.active !== false; });
      supplierDirectory.sort(function (a, b) { return String(a.name || a.companyName || "").localeCompare(String(b.name || b.companyName || "")); });
      purchaseHistory.sort(function (a, b) { return String(b.deliveryDate || b.createdAt || "").localeCompare(String(a.deliveryDate || a.createdAt || "")); });
      return sets;
    });
  }
  function purchasePopulateSelects(selectedSupplierId) {
    var supplierOptions = "<option value=''>Seleccionar proveedor</option>" + supplierDirectory.map(function (supplier) {
      return "<option value='" + escapeHtml(supplier.id) + "'>" + escapeHtml(supplier.name || supplier.companyName || "Proveedor") + "</option>";
    }).join("");
    if ($("purchaseSupplierId")) {
      $("purchaseSupplierId").innerHTML = supplierOptions;
      $("purchaseSupplierId").value = selectedSupplierId || "";
    }
    if ($("purchaseSupplierFilter")) {
      var filterValue = $("purchaseSupplierFilter").value;
      $("purchaseSupplierFilter").innerHTML = "<option value=''>Todos</option>" + supplierDirectory.map(function (supplier) {
        return "<option value='" + escapeHtml(supplier.id) + "'>" + escapeHtml(supplier.name || supplier.companyName || "Proveedor") + "</option>";
      }).join("");
      $("purchaseSupplierFilter").value = filterValue;
    }
    if ($("purchaseCategoryFilter")) {
      var categoryValue = $("purchaseCategoryFilter").value;
      var categories = {};
      supplierProductsCache.forEach(function (product) { categories[productCategory(product)] = true; });
      purchaseLinesCache.forEach(function (line) { if (line.productCategorySnapshot) categories[String(line.productCategorySnapshot)] = true; });
      $("purchaseCategoryFilter").innerHTML = "<option value=''>Todas</option>" + Object.keys(categories).sort().map(function (category) {
        return "<option value='" + escapeHtml(category) + "'>" + escapeHtml(category) + "</option>";
      }).join("");
      $("purchaseCategoryFilter").value = categoryValue;
    }
  }
  function purchaseMatchesFilters(purchase) {
    var query = normalizeProductSearch($("purchaseSearchInput") && $("purchaseSearchInput").value);
    var supplierId = $("purchaseSupplierFilter") ? $("purchaseSupplierFilter").value : "";
    var from = $("purchaseDateFrom") ? $("purchaseDateFrom").value : "";
    var to = $("purchaseDateTo") ? $("purchaseDateTo").value : "";
    var category = $("purchaseCategoryFilter") ? $("purchaseCategoryFilter").value : "";
    var status = $("purchaseStatusFilter") ? $("purchaseStatusFilter").value : "";
    var min = $("purchaseTotalMinFilter") && $("purchaseTotalMinFilter").value.trim() ? parseMoney($("purchaseTotalMinFilter").value) : null;
    var max = $("purchaseTotalMaxFilter") && $("purchaseTotalMaxFilter").value.trim() ? parseMoney($("purchaseTotalMaxFilter").value) : null;
    var lines = purchaseLinesFor(purchase.id);
    var haystack = normalizeProductSearch([
      supplierNameById(purchase.supplierId, purchase.supplierSnapshot), purchase.invoiceNumber,
      lines.map(purchaseProductName).join(" "), lines.map(function (line) { return line.supplierDescription || ""; }).join(" ")
    ].join(" "));
    if (query && haystack.indexOf(query) < 0) return false;
    if (supplierId && purchase.supplierId !== supplierId) return false;
    if (from && String(purchase.deliveryDate || "") < from) return false;
    if (to && String(purchase.deliveryDate || "") > to) return false;
    if (status && String(purchase.status || "DRAFT") !== status) return false;
    if (min != null && Number(purchase.total || 0) < min) return false;
    if (max != null && Number(purchase.total || 0) > max) return false;
    if (category && !lines.some(function (line) {
      var product = supplierProductsCache.filter(function (row) { return row.id === line.productId; })[0];
      return String(line.productCategorySnapshot || productCategory(product)) === category;
    })) return false;
    return true;
  }
  function purchaseRenderSummary() {
    var confirmed = purchaseHistory.filter(function (row) { return row.status === "CONFIRMED"; });
    var drafts = purchaseHistory.filter(function (row) { return row.status === "DRAFT"; });
    var voided = purchaseHistory.filter(function (row) { return row.status === "VOIDED"; });
    var currentMonth = monthKey(today());
    var monthRows = confirmed.filter(function (row) { return String(row.deliveryDate || "").slice(0, 7) === currentMonth; });
    var monthTotal = monthRows.reduce(function (sumValue, row) { return sumValue + Number(row.total || 0); }, 0);
    if ($("purchaseConfirmedCount")) $("purchaseConfirmedCount").textContent = confirmed.length;
    if ($("purchaseDraftCount")) $("purchaseDraftCount").textContent = drafts.length;
    if ($("purchaseVoidedCount")) $("purchaseVoidedCount").textContent = voided.length;
    if ($("purchaseAllCount")) $("purchaseAllCount").textContent = purchaseHistory.length;
    $("purchaseSummary").innerHTML = [
      ["Compras este mes", money(monthTotal), monthRows.length + " pedidos confirmados", "confirmed"],
      ["Borradores", String(drafts.length), drafts.length ? "Pendientes de confirmar" : "Sin tareas pendientes", "draft"],
      ["Proveedores activos", String(supplierDirectory.length), "Contactos disponibles", ""],
      ["Pedidos anulados", String(voided.length), "Conservados para auditoria", "voided"]
    ].map(function (item) {
      return "<article class='purchase-summary-card " + item[3] + "'><span>" + item[0] + "</span><b>" + item[1] + "</b><small>" + item[2] + "</small></article>";
    }).join("");
  }
  function purchaseRenderHistory() {
    var activeStatus = $("purchaseStatusFilter") ? $("purchaseStatusFilter").value : "";
    document.querySelectorAll("[data-purchase-status]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.purchaseStatus === activeStatus);
    });
    var rows = purchaseHistory.filter(purchaseMatchesFilters);
    $("purchaseResultCount").textContent = rows.length + (rows.length === 1 ? " pedido" : " pedidos");
    $("purchaseListNote").textContent = rows.length === purchaseHistory.length ? "Historial permanente de ingresos y borradores." : "Mostrando el resultado de los filtros activos.";
    $("purchaseList").innerHTML = rows.length ? rows.map(function (purchase) {
      var lines = purchaseLinesFor(purchase.id);
      var names = lines.slice(0, 2).map(purchaseProductName);
      var more = Math.max(0, lines.length - names.length);
      var statusClass = purchaseStatusClass(purchase.status);
      return "<article class='purchase-row " + statusClass + "' data-purchase-detail='" + escapeHtml(purchase.id) + "' tabindex='0'>"
        + "<div class='purchase-row-main'><span class='purchase-status " + statusClass + "'>" + purchaseStatusLabel(purchase.status) + "</span><small>" + purchaseDateLabel(purchase.deliveryDate || purchase.createdAt) + "</small></div>"
        + "<div class='purchase-row-supplier'><b>" + escapeHtml(supplierNameById(purchase.supplierId, purchase.supplierSnapshot)) + "</b><small>" + (purchase.invoiceNumber ? "Factura " + escapeHtml(purchase.invoiceNumber) : "Sin numero de factura") + "</small></div>"
        + "<div class='purchase-row-products'><b>" + lines.length + (lines.length === 1 ? " producto" : " productos") + "</b><small>" + escapeHtml(names.join(", ") + (more ? " y " + more + " mas" : "")) + "</small></div>"
        + "<strong class='purchase-row-total'>" + money(purchase.total) + "</strong>"
        + "<div class='purchase-row-actions'>" + (purchase.status === "DRAFT" ? "<button type='button' data-purchase-edit='" + escapeHtml(purchase.id) + "'>Continuar</button>" : "") + "<button type='button' data-purchase-view='" + escapeHtml(purchase.id) + "'>Ver detalle</button></div>"
        + "</article>";
    }).join("") : empty("No hay pedidos que coincidan con los filtros.");
    document.querySelectorAll("[data-purchase-detail],[data-purchase-view]").forEach(function (node) {
      node.onclick = function (event) {
        if (event.target && event.target.closest("[data-purchase-edit]")) return;
        purchaseOpenDetail(node.dataset.purchaseDetail || node.dataset.purchaseView);
      };
      node.onkeydown = function (event) { if (event.key === "Enter") purchaseOpenDetail(node.dataset.purchaseDetail || node.dataset.purchaseView); };
    });
    document.querySelectorAll("[data-purchase-edit]").forEach(function (button) {
      button.onclick = function (event) { event.stopPropagation(); purchaseOpenEditor(button.dataset.purchaseEdit); };
    });
  }
  function supplierPrimaryContact(supplier) {
    var contacts = Array.isArray(supplier.contacts) ? supplier.contacts : [];
    if (contacts.length) return contacts[0];
    return { name: supplier.contactName || "", phone: (supplier.phones || [])[0] || "", whatsapp: supplier.whatsapp || "", email: supplier.email || "" };
  }
  function supplierRenderDirectory() {
    var query = normalizeProductSearch($("supplierSearchInput") && $("supplierSearchInput").value);
    var rows = supplierDirectory.filter(function (supplier) {
      var contacts = Array.isArray(supplier.contacts) ? supplier.contacts : [];
      return !query || normalizeProductSearch([supplier.name || supplier.companyName, supplier.city, supplier.categories && supplier.categories.join(" "), contacts.map(function (c) { return [c.name, c.phone, c.whatsapp, c.email].join(" "); }).join(" ")].join(" ")).indexOf(query) >= 0;
    });
    $("supplierResultCount").textContent = String(rows.length);
    $("supplierList").innerHTML = rows.length ? rows.map(function (supplier) {
      var contact = supplierPrimaryContact(supplier);
      var count = purchaseHistory.filter(function (purchase) { return purchase.supplierId === supplier.id && purchase.status === "CONFIRMED"; }).length;
      return "<article class='supplier-card' data-supplier-profile='" + escapeHtml(supplier.id) + "' tabindex='0'><b>" + escapeHtml(supplier.name || supplier.companyName || "Proveedor") + "</b><span>" + escapeHtml(contact.name || supplier.city || "Sin contacto principal") + (contact.phone || contact.whatsapp ? " · " + escapeHtml(contact.whatsapp || contact.phone) : "") + "</span><strong>" + count + " compras</strong></article>";
    }).join("") : empty("Todavia no hay viajantes cargados.");
    document.querySelectorAll("[data-supplier-profile]").forEach(function (node) {
      node.onclick = function () { supplierOpenProfile(node.dataset.supplierProfile); };
      node.onkeydown = function (event) { if (event.key === "Enter") supplierOpenProfile(node.dataset.supplierProfile); };
    });
  }
  function renderSuppliers() {
    if (!isAdmin() || !$('tabProveedores')) return;
    purchaseLoadData().then(function () {
      purchasePopulateSelects(purchaseEditorDraft && purchaseEditorDraft.purchase && purchaseEditorDraft.purchase.supplierId);
      purchaseRenderSummary();
      purchaseRenderHistory();
      supplierRenderDirectory();
      purchaseResumeDraftAfterTabReturn();
    }).catch(function (error) { purchaseShowError(error, "No se pudo cargar Proveedores."); });
  }
  function purchaseRerenderFiltersOnly() {
    purchaseRenderHistory();
    supplierRenderDirectory();
  }
  function purchaseClearFilters() {
    ["purchaseSearchInput", "purchaseDateFrom", "purchaseDateTo", "purchaseTotalMinFilter", "purchaseTotalMaxFilter", "supplierSearchInput"].forEach(function (id) { if ($(id)) $(id).value = ""; });
    ["purchaseSupplierFilter", "purchaseCategoryFilter", "purchaseStatusFilter"].forEach(function (id) { if ($(id)) $(id).value = ""; });
    purchaseRerenderFiltersOnly();
  }
  function supplierContactRow(contact) {
    contact = contact || {};
    return "<div class='supplier-contact-row'>"
      + "<div class='supplier-contact-name'><input data-supplier-contact='name' maxlength='100' placeholder='Nombre' value='" + escapeHtml(contact.name || "") + "'><input data-supplier-contact='role' maxlength='80' placeholder='Funcion' value='" + escapeHtml(contact.role || "") + "'></div>"
      + "<input data-supplier-contact='phone' maxlength='60' placeholder='Telefono' value='" + escapeHtml(contact.phone || "") + "'>"
      + "<input data-supplier-contact='whatsapp' maxlength='60' placeholder='WhatsApp' value='" + escapeHtml(contact.whatsapp || "") + "'>"
      + "<input data-supplier-contact='email' type='email' maxlength='120' placeholder='Email' value='" + escapeHtml(contact.email || "") + "'>"
      + "<button type='button' data-remove-supplier-contact aria-label='Quitar contacto'>&times;</button></div>";
  }
  function supplierBindContactRows() {
    document.querySelectorAll("[data-remove-supplier-contact]").forEach(function (button) {
      button.onclick = function () {
        var rows = document.querySelectorAll("#supplierContactsEditor .supplier-contact-row");
        if (rows.length <= 1) {
          button.closest(".supplier-contact-row").querySelectorAll("input").forEach(function (input) { input.value = ""; });
          return;
        }
        button.closest(".supplier-contact-row").remove();
      };
    });
  }
  function supplierAddContact(contact) {
    $("supplierContactsEditor").insertAdjacentHTML("beforeend", supplierContactRow(contact));
    supplierBindContactRows();
  }
  function supplierOpenForm(supplier, returnToPurchase) {
    if (!isAdmin()) return;
    if ($("supplierFormModal").parentNode !== document.body) document.body.appendChild($("supplierFormModal"));
    supplier = supplier || null;
    $("supplierForm").reset();
    $("supplierEditId").value = supplier ? supplier.id : "";
    $("supplierCompanyName").value = supplier && (supplier.name || supplier.companyName) || "";
    $("supplierAddress").value = supplier && supplier.address || "";
    $("supplierCity").value = supplier && supplier.city || "";
    $("supplierCategories").value = supplier && Array.isArray(supplier.categories) ? supplier.categories.join(", ") : supplier && supplier.categories || "";
    $("supplierPaymentTerms").value = supplier && supplier.paymentTerms || "";
    $("supplierTaxId").value = supplier && supplier.taxId || "";
    $("supplierNotes").value = supplier && supplier.notes || "";
    $("supplierFormTitle").textContent = supplier ? "Editar viajante" : "Nuevo viajante";
    $("supplierForm").dataset.returnToPurchase = returnToPurchase ? "true" : "false";
    $("supplierContactsEditor").innerHTML = "";
    var contacts = supplier && Array.isArray(supplier.contacts) && supplier.contacts.length ? supplier.contacts : [supplierPrimaryContact(supplier || {})];
    contacts.forEach(supplierAddContact);
    $("supplierFormModal").classList.remove("hidden");
    setTimeout(function () { $("supplierCompanyName").focus(); }, 0);
  }
  function supplierCloseForm() {
    $("supplierFormModal").classList.add("hidden");
    $("supplierForm").removeAttribute("data-return-to-purchase");
  }
  function supplierCollectContacts() {
    return Array.prototype.slice.call(document.querySelectorAll("#supplierContactsEditor .supplier-contact-row")).map(function (row) {
      var contact = {};
      row.querySelectorAll("[data-supplier-contact]").forEach(function (input) { contact[input.dataset.supplierContact] = input.value.trim(); });
      return contact;
    }).filter(function (contact) { return contact.name || contact.phone || contact.whatsapp || contact.email; });
  }
  function supplierSaveFromForm(event) {
    event.preventDefault();
    if (!isAdmin()) return;
    var name = $("supplierCompanyName").value.trim();
    if (!name) { toast("Complete el nombre del proveedor."); return; }
    var existing = supplierDirectory.filter(function (row) { return row.id === $("supplierEditId").value; })[0] || {};
    var contacts = supplierCollectContacts();
    var record = Object.assign({}, existing, {
      id: existing.id || uid(), name: name, companyName: name,
      contactName: contacts[0] && contacts[0].name || "", address: $("supplierAddress").value.trim(), city: $("supplierCity").value.trim(),
      categories: $("supplierCategories").value.split(",").map(function (value) { return value.trim(); }).filter(Boolean),
      phones: contacts.map(function (contact) { return contact.phone; }).filter(Boolean),
      whatsapp: contacts[0] && contacts[0].whatsapp || "", email: contacts[0] && contacts[0].email || "", contacts: contacts,
      paymentTerms: $("supplierPaymentTerms").value.trim(), taxId: $("supplierTaxId").value.trim(), notes: $("supplierNotes").value.trim(), active: true,
      createdAt: existing.createdAt || nowIso(), createdBy: existing.createdBy || currentUser.id, updatedAt: nowIso(), updatedBy: currentUser.id
    });
    var returnToPurchase = $("supplierForm").dataset.returnToPurchase === "true";
    purchaseRunEngine("supplierSave", [record]).then(function (saved) {
      supplierCloseForm();
      return purchaseLoadData().then(function () {
        purchasePopulateSelects(saved && saved.id || record.id);
        if (returnToPurchase && $("purchaseSupplierId")) $("purchaseSupplierId").value = saved && saved.id || record.id;
        purchaseRenderSummary(); purchaseRenderHistory(); supplierRenderDirectory();
        toast("Viajante guardado");
      });
    }).catch(function (error) { purchaseShowError(error, "No se pudo guardar el viajante."); });
  }
  function supplierOpenProfile(id) {
    var supplier = supplierDirectory.filter(function (row) { return row.id === id; })[0];
    if (!supplier) return;
    supplierSelectedProfile = supplier;
    var purchases = purchaseHistory.filter(function (row) { return row.supplierId === id && row.status === "CONFIRMED"; });
    var total = purchases.reduce(function (sumValue, row) { return sumValue + Number(row.total || 0); }, 0);
    var lines = purchaseLinesCache.filter(function (line) { return purchases.some(function (purchase) { return purchase.id === line.purchaseId; }); });
    var latestByProduct = {};
    lines.slice().sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); }).forEach(function (line) { if (!latestByProduct[line.productId]) latestByProduct[line.productId] = line; });
    var contacts = Array.isArray(supplier.contacts) ? supplier.contacts : [];
    $("supplierProfileContent").innerHTML = "<header class='supplier-profile-header'><div><span class='suppliers-eyebrow'>Perfil del proveedor</span><h2 id='supplierProfileTitle'>" + escapeHtml(supplier.name || supplier.companyName) + "</h2><p>" + escapeHtml([supplier.address, supplier.city].filter(Boolean).join(", ") || "Sin direccion cargada") + "</p></div><span class='purchase-status confirmed'>Activo</span></header>"
      + "<section class='supplier-profile-stats'><div><span>Total comprado</span><b>" + money(total) + "</b></div><div><span>Entregas confirmadas</span><b>" + purchases.length + "</b></div><div><span>Productos comprados</span><b>" + Object.keys(latestByProduct).length + "</b></div><div><span>Ultima compra</span><b>" + (purchases[0] ? purchaseDateLabel(purchases[0].deliveryDate) : "Sin compras") + "</b></div></section>"
      + "<section class='supplier-profile-section'><h3>Contactos</h3><div class='supplier-profile-contact-grid'>" + (contacts.length ? contacts.map(function (contact) { return "<div><span>" + escapeHtml(contact.role || "Contacto") + "</span><b>" + escapeHtml(contact.name || "Sin nombre") + "</b><small>" + escapeHtml([contact.phone, contact.whatsapp, contact.email].filter(Boolean).join(" · ") || "Sin datos") + "</small></div>"; }).join("") : "<div><span>Contacto</span><b>Sin contactos cargados</b></div>") + "</div></section>"
      + "<section class='supplier-profile-section'><h3>Ultimos precios</h3><div class='supplier-profile-products'>" + (Object.keys(latestByProduct).length ? Object.keys(latestByProduct).slice(0, 12).map(function (key) { var line = latestByProduct[key]; return "<div class='supplier-profile-product'><b>" + escapeHtml(purchaseProductName(line)) + "</b><span>" + formatQuantity(line.totalSaleQuantity) + " " + escapeHtml(line.saleUnit || "unidad") + "</span><span>" + moneyCost(line.costPerSaleUnit) + " / " + escapeHtml(line.saleUnit || "unidad") + "</span><span>" + money(line.landedLineCost || line.grossSubtotal) + "</span></div>"; }).join("") : empty("Sin productos comprados todavia.")) + "</div></section>"
      + "<section class='supplier-profile-section'><h3>Entregas anteriores</h3><div class='supplier-profile-purchases'>" + (purchases.length ? purchases.slice(0, 8).map(function (purchase) { return "<div class='supplier-profile-purchase'><b>" + purchaseDateLabel(purchase.deliveryDate) + "</b><span>" + escapeHtml(purchase.invoiceNumber || "Sin factura") + "</span><span>" + purchaseLinesFor(purchase.id).length + " productos</span><strong>" + money(purchase.total) + "</strong></div>"; }).join("") : empty("Sin entregas confirmadas.")) + "</div></section>";
    $("supplierProfileModal").classList.remove("hidden");
  }
  function supplierCloseProfile() { $("supplierProfileModal").classList.add("hidden"); supplierSelectedProfile = null; }
  function purchaseEmptyDraft(supplierId) {
    var timestamp = nowIso();
    return { purchase: { id: uid(), supplierId: supplierId || "", status: "DRAFT", deliveryDate: today(), invoiceNumber: "", paymentTerms: "", dueDate: "", notes: "", attachment: "", discounts: 0, freight: 0, taxes: 0, otherCosts: 0, total: 0, revision: 1, createdAt: timestamp, createdBy: currentUser.id, updatedAt: timestamp, updatedBy: currentUser.id }, lines: [] };
  }
  function purchaseProductById(id) {
    return supplierProductsCache.filter(function (product) { return product.id === id; })[0] || null;
  }
  function purchaseProductSearchMatches(value) {
    var terms = normalizeProductSearch(value).split(/\s+/).filter(Boolean);
    return supplierProductsCache.filter(function (product) {
      if (!terms.length) return true;
      var haystack = normalizeProductSearch([product.name, productCategory(product), product.brand, product.barcode, product.inventoryId].join(" "));
      return terms.every(function (term) { return haystack.indexOf(term) >= 0; });
    }).sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); }).slice(0, 9);
  }
  function purchaseRenderProductMatches(input) {
    var picker = input && input.closest(".purchase-product-picker");
    if (!picker) return;
    var results = picker.querySelector(".purchase-product-results");
    var hidden = picker.querySelector("[data-purchase-line-field='productId']");
    var selected = purchaseProductById(hidden.value);
    if (selected && normalizeProductSearch(selected.name) !== normalizeProductSearch(input.value)) hidden.value = "";
    var matches = purchaseProductSearchMatches(input.value);
    var query = String(input.value || "").trim();
    results.innerHTML = matches.map(function (product) {
      return "<button type='button' data-purchase-pick-product='" + escapeHtml(product.id) + "'><span><b>" + escapeHtml(product.name) + "</b><small>" + escapeHtml(productCategory(product)) + (product.barcode ? " · " + escapeHtml(product.barcode) : " · sin codigo") + "</small></span><strong>Stock " + escapeHtml(formatQuantity(product.stock)) + "</strong></button>";
    }).join("") + (query && !matches.some(function (product) { return normalizeProductSearch(product.name) === normalizeProductSearch(query); }) ? "<button type='button' class='create-result' data-purchase-create-product='" + escapeHtml(query) + "'>+ Crear producto \"" + escapeHtml(query) + "\"</button>" : "");
    results.classList.remove("hidden");
    results.querySelectorAll("[data-purchase-pick-product]").forEach(function (button) {
      button.onmousedown = function (event) { event.preventDefault(); };
      button.onclick = function () {
        var product = purchaseProductById(button.dataset.purchasePickProduct);
        if (!product) return;
        hidden.value = product.id;
        input.value = product.name;
        results.classList.add("hidden");
        purchaseUpdateCalculations();
      };
    });
    var createButton = results.querySelector("[data-purchase-create-product]");
    if (createButton) {
      createButton.onmousedown = function (event) { event.preventDefault(); };
      createButton.onclick = function () { purchaseCreateProductFromSearch(createButton.dataset.purchaseCreateProduct, ""); };
    }
  }
  function purchaseNewLine(productId) {
    var product = supplierProductsCache.filter(function (row) { return row.id === productId; })[0] || {};
    return { id: uid(), productId: product.id || "", productNameSnapshot: product.name || "", productCategorySnapshot: productCategory(product), supplierDescription: "", supplierProductCode: "", packagesReceived: 1, bonusPackages: 0, packageSize: 1, purchaseUnit: "unidad", saleUnit: product.unitType || product.priceUnit || "unidad", costPerPackage: 0, lineDiscount: 0, grossSubtotal: 0, totalSaleQuantity: 1, costPerSaleUnit: 0, status: "ACTIVE" };
  }
  function purchaseLineRow(line, index) {
    var units = ["bolsa", "caja", "botella", "bidon", "unidad", "paquete", "fardo", "lata", "tambor", "rollo"];
    var product = purchaseProductById(line.productId);
    return "<div class='purchase-line-row' data-purchase-line='" + index + "'>"
      + "<div class='purchase-product-picker'><input type='hidden' data-purchase-line-field='productId' value='" + escapeHtml(line.productId || "") + "'><input data-purchase-product-search autocomplete='off' aria-label='Buscar producto' placeholder='Buscar nombre o escanear' value='" + escapeHtml(product && product.name || line.productNameSnapshot || "") + "'><div class='purchase-product-results hidden'></div></div>"
      + "<div class='purchase-supplier-ref'><input data-purchase-line-field='supplierDescription' maxlength='180' placeholder='Descripcion proveedor' value='" + escapeHtml(line.supplierDescription || "") + "'><input data-purchase-line-field='supplierProductCode' maxlength='80' placeholder='Codigo' value='" + escapeHtml(line.supplierProductCode || "") + "'></div>"
      + "<input data-purchase-line-field='packagesReceived' inputmode='decimal' aria-label='Paquetes recibidos' value='" + escapeHtml(formatQuantity(line.packagesReceived == null ? 1 : line.packagesReceived)) + "'>"
      + "<input data-purchase-line-field='packageSize' inputmode='decimal' aria-label='Contenido por paquete' value='" + escapeHtml(formatQuantity(line.packageSize == null ? 1 : line.packageSize)) + "'>"
      + "<select data-purchase-line-field='purchaseUnit' aria-label='Unidad de compra'>" + units.map(function (unit) { return "<option value='" + unit + "' " + (line.purchaseUnit === unit ? "selected" : "") + ">" + unit + "</option>"; }).join("") + "</select>"
      + "<input data-purchase-line-field='bonusPackages' inputmode='decimal' aria-label='Paquetes bonificados' value='" + escapeHtml(formatQuantity(line.bonusPackages || 0)) + "'>"
      + "<input data-purchase-line-field='costPerPackage' inputmode='decimal' aria-label='Costo por paquete' value='" + escapeHtml(line.costPerPackage ? String(line.costPerPackage).replace(".", ",") : "") + "' placeholder='$ 0'>"
      + "<input data-purchase-line-field='lineDiscount' inputmode='decimal' aria-label='Descuento individual del producto' value='" + escapeHtml(line.lineDiscount ? String(line.lineDiscount).replace(".", ",") : "") + "' placeholder='$ 0'>"
      + "<div class='purchase-line-calculated'><b data-purchase-line-total>" + money(line.grossSubtotal) + "</b><span data-purchase-line-unit-cost>" + moneyCost(line.costPerSaleUnit) + " / " + escapeHtml(line.saleUnit || "unidad") + "</span><span data-purchase-line-quantity>" + formatQuantity(line.totalSaleQuantity) + " " + escapeHtml(line.saleUnit || "unidad") + "</span></div>"
      + "<button type='button' data-remove-purchase-line='" + index + "' aria-label='Quitar linea'>&times;</button></div>";
  }
  function purchaseReadLineRow(row, line) {
    row.querySelectorAll("[data-purchase-line-field]").forEach(function (input) {
      var field = input.dataset.purchaseLineField;
      if (["packagesReceived", "packageSize", "bonusPackages", "costPerPackage", "lineDiscount"].indexOf(field) >= 0) line[field] = Math.max(0, parseMoney(input.value));
      else line[field] = input.value;
    });
    var product = supplierProductsCache.filter(function (entry) { return entry.id === line.productId; })[0] || {};
    line.productNameSnapshot = product.name || line.productNameSnapshot || "";
    line.productCategorySnapshot = line.productCategorySnapshot || productCategory(product);
    line.saleUnit = product.unitType || product.priceUnit || line.saleUnit || "unidad";
    line.totalSaleQuantity = moneyPrecision((Number(line.packagesReceived || 0) + Number(line.bonusPackages || 0)) * Number(line.packageSize || 0));
    line.grossSubtotal = moneyPrecision(Number(line.packagesReceived || 0) * Number(line.costPerPackage || 0));
    line.costPerSaleUnit = line.totalSaleQuantity > 0 ? moneyPrecision(Math.max(0, line.grossSubtotal - Number(line.lineDiscount || 0)) / line.totalSaleQuantity) : 0;
    line.lineSubtotal = line.grossSubtotal;
    line.updatedAt = nowIso();
    line.updatedBy = currentUser.id;
    return line;
  }
  function purchaseCaptureLines() {
    if (!purchaseEditorDraft) return [];
    Array.prototype.slice.call(document.querySelectorAll("#purchaseLinesEditor [data-purchase-line]")).forEach(function (row, index) {
      if (purchaseEditorDraft.lines[index]) purchaseReadLineRow(row, purchaseEditorDraft.lines[index]);
    });
    return purchaseEditorDraft.lines;
  }
  function purchaseRenderLines() {
    var lines = purchaseEditorDraft && purchaseEditorDraft.lines || [];
    $("purchaseLinesEditor").innerHTML = lines.length ? lines.map(purchaseLineRow).join("") : "<div class='purchase-line-empty'>Agregue el primer producto recibido.<br>Puede cargar todas las lineas de una misma factura.</div>";
    $("purchaseLinesEditor").querySelectorAll("input,select").forEach(function (input) { input.oninput = purchaseUpdateCalculations; input.onchange = purchaseUpdateCalculations; });
    $("purchaseLinesEditor").querySelectorAll("[data-purchase-product-search]").forEach(function (input) {
      input.onfocus = function () { purchaseRenderProductMatches(input); };
      input.oninput = function () { purchaseRenderProductMatches(input); purchaseUpdateCalculations(); };
      input.onkeydown = function (event) {
        if (event.key === "Escape") input.closest(".purchase-product-picker").querySelector(".purchase-product-results").classList.add("hidden");
      };
      input.onblur = function () { setTimeout(function () { var picker = input.closest(".purchase-product-picker"); if (picker) picker.querySelector(".purchase-product-results").classList.add("hidden"); }, 120); };
    });
    document.querySelectorAll("[data-remove-purchase-line]").forEach(function (button) {
      button.onclick = function () { purchaseCaptureLines(); purchaseEditorDraft.lines.splice(Number(button.dataset.removePurchaseLine), 1); purchaseRenderLines(); purchaseUpdateCalculations(); };
    });
    purchaseUpdateCalculations();
  }
  function purchaseTotalsFromForm() {
    var lines = purchaseCaptureLines();
    var subtotal = moneyPrecision(lines.reduce(function (sumValue, line) { return sumValue + Number(line.grossSubtotal || 0); }, 0));
    var lineDiscountTotal = moneyPrecision(lines.reduce(function (sumValue, line) { return sumValue + Math.min(Number(line.grossSubtotal || 0), Number(line.lineDiscount || 0)); }, 0));
    var discounts = Math.max(0, parseMoney($("purchaseDiscount").value));
    var freight = Math.max(0, parseMoney($("purchaseFreight").value));
    var taxes = Math.max(0, parseMoney($("purchaseTaxes").value));
    var otherCosts = Math.max(0, parseMoney($("purchaseOtherCosts").value));
    var netProductsTotal = moneyPrecision(Math.max(0, subtotal - lineDiscountTotal));
    var total = moneyPrecision(Math.max(0, netProductsTotal - discounts + freight + taxes + otherCosts));
    return { subtotal: subtotal, lineDiscountTotal: lineDiscountTotal, netProductsTotal: netProductsTotal, discounts: discounts, freight: freight, taxes: taxes, otherCosts: otherCosts, total: total };
  }
  function purchaseUpdateCalculations() {
    if (!purchaseEditorDraft) return;
    var totals = purchaseTotalsFromForm();
    var lines = purchaseEditorDraft.lines;
    Array.prototype.slice.call(document.querySelectorAll("#purchaseLinesEditor [data-purchase-line]")).forEach(function (row, index) {
      var line = lines[index];
      if (!line) return;
      var total = row.querySelector("[data-purchase-line-total]");
      var unitCost = row.querySelector("[data-purchase-line-unit-cost]");
      var quantity = row.querySelector("[data-purchase-line-quantity]");
      if (total) total.textContent = money(Math.max(0, Number(line.grossSubtotal || 0) - Number(line.lineDiscount || 0)));
      if (unitCost) unitCost.textContent = moneyCost(line.costPerSaleUnit) + " / " + line.saleUnit;
      if (quantity) quantity.textContent = formatQuantity(line.totalSaleQuantity) + " " + line.saleUnit;
    });
    $("purchaseSubtotal").textContent = money(totals.subtotal);
    if ($("purchaseLineDiscountTotal")) $("purchaseLineDiscountTotal").textContent = "- " + money(totals.lineDiscountTotal);
    $("purchaseAdjustmentsTotal").textContent = money(-totals.discounts + totals.freight + totals.taxes + totals.otherCosts);
    $("purchaseGrandTotal").textContent = money(totals.total);
    var declaredRaw = $("purchaseDeclaredTotal").value.trim();
    var varianceRow = $("purchaseInvoiceVarianceRow");
    if (!declaredRaw) varianceRow.classList.add("hidden");
    else {
      var variance = moneyPrecision(totals.total - parseMoney(declaredRaw));
      varianceRow.classList.remove("hidden", "warn", "ok");
      varianceRow.classList.add(Math.abs(variance) < .01 ? "ok" : "warn");
      $("purchaseInvoiceVariance").textContent = (variance > 0 ? "+" : "") + money(variance);
    }
    purchaseCheckDuplicate();
  }
  function purchaseCaptureDraftFromForm() {
    if (!purchaseEditorDraft) return null;
    var purchase = purchaseEditorDraft.purchase;
    var expectedUpdatedAt = purchase.expectedUpdatedAt != null ? purchase.expectedUpdatedAt : purchase.updatedAt;
    var supplier = supplierDirectory.filter(function (row) { return row.id === $("purchaseSupplierId").value; })[0];
    var totals = purchaseTotalsFromForm();
    Object.assign(purchase, totals, {
      supplierId: $("purchaseSupplierId").value,
      supplierSnapshot: supplier ? { id: supplier.id, name: supplier.name || supplier.companyName, contactName: supplier.contactName || "" } : purchase.supplierSnapshot,
      deliveryDate: $("purchaseDeliveryDate").value || today(), invoiceNumber: $("purchaseInvoiceNumber").value.trim(),
      invoiceNumberNormalized: purchaseNormalizeInvoice($("purchaseInvoiceNumber").value), paymentTerms: $("purchasePaymentTerms").value.trim(),
      dueDate: $("purchaseDueDate").value || "", notes: $("purchaseNotes").value.trim(), attachmentRef: purchaseAttachmentRef || null, attachment: "", invoicePhoto: "", attachmentData: "",
      declaredTotal: $("purchaseDeclaredTotal").value.trim() ? parseMoney($("purchaseDeclaredTotal").value) : null,
      expectedUpdatedAt: expectedUpdatedAt == null ? null : String(expectedUpdatedAt), updatedBy: currentUser.id
    });
    purchaseEditorDraft.lines.forEach(function (line) { line.purchaseId = purchase.id; line.createdAt = line.createdAt || nowIso(); line.createdBy = line.createdBy || currentUser.id; });
    return purchaseEditorDraft;
  }
  function purchaseCheckDuplicate() {
    if (!purchaseEditorDraft) return false;
    var supplierId = $("purchaseSupplierId").value;
    var normalized = purchaseNormalizeInvoice($("purchaseInvoiceNumber").value);
    var duplicate = supplierId && normalized && purchaseHistory.filter(function (purchase) {
      return purchase.id !== purchaseEditorDraft.purchase.id && purchase.supplierId === supplierId && String(purchase.status || "DRAFT") !== "VOIDED" && purchaseNormalizeInvoice(purchase.invoiceNumberNormalized || purchase.invoiceNumber) === normalized;
    })[0];
    $("purchaseDuplicateWarning").classList.toggle("hidden", !duplicate);
    $("purchaseDuplicateWarning").innerHTML = duplicate ? "Posible duplicado: este proveedor ya tiene la factura <b>" + escapeHtml(duplicate.invoiceNumber || normalized) + "</b> del " + purchaseDateLabel(duplicate.deliveryDate) + ". Revise el pedido antes de continuar." : "";
    return !!duplicate;
  }
  function purchaseDisplayAttachment() {
    var preview = $("purchaseInvoicePreview");
    if (!purchaseInvoiceData && !purchaseAttachmentRef) { preview.innerHTML = "<span>Sin imagen adjunta</span>"; return; }
    preview.innerHTML = (purchaseInvoiceData ? "<img src='" + escapeHtml(purchaseInvoiceData) + "' alt='Factura adjunta'>" : "<span>Factura guardada</span>") + "<button type='button' data-remove-purchase-invoice>Quitar</button>";
    preview.querySelector("[data-remove-purchase-invoice]").onclick = function () {
      purchaseAttachmentRef = null;
      purchaseInvoiceData = "";
      purchaseInvoiceDirty = false;
      $("purchaseInvoiceFile").value = "";
      purchaseDisplayAttachment();
    };
  }
  function purchaseCompressInvoice(file) {
    if (!file) return;
    if (!/^image\//i.test(file.type || "")) { purchaseShowError(null, "Seleccione una imagen valida."); return; }
    var reader = new FileReader();
    reader.onerror = function () { purchaseShowError(null, "No se pudo leer la imagen."); };
    reader.onload = function () {
      var image = new Image();
      image.onerror = function () { purchaseShowError(null, "La imagen no es valida."); };
      image.onload = function () {
        var maxDimension = 1800;
        var scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        var qualities = [.78, .68, .58, .48];
        var data = "";
        for (var q = 0; q < qualities.length; q += 1) {
          data = canvas.toDataURL("image/jpeg", qualities[q]);
          if (data.length <= 1500000) break;
        }
        if (data.length > 1500000) { purchaseShowError(null, "La foto sigue siendo demasiado grande. Recortela o tome otra mas cerca."); return; }
        purchaseInvoiceData = data;
        purchaseInvoiceDirty = true;
        purchaseInvoiceFileName = String(file.name || "factura.jpg").replace(/[^a-z0-9._-]+/gi, "-").slice(0, 120) || "factura.jpg";
        purchaseDisplayAttachment();
        $("purchaseEditorMessage").textContent = "Factura comprimida y lista para guardar (" + Math.round(data.length / 1024) + " KB).";
        $("purchaseEditorMessage").className = "purchase-editor-message ok";
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  }
  function purchaseFillEditor() {
    var purchase = purchaseEditorDraft.purchase;
    purchasePopulateSelects(purchase.supplierId);
    $("purchaseEditId").value = purchase.id;
    $("purchaseSupplierId").value = purchase.supplierId || "";
    $("purchaseDeliveryDate").value = purchase.deliveryDate || today();
    $("purchaseInvoiceNumber").value = purchase.invoiceNumber || "";
    $("purchasePaymentTerms").value = purchase.paymentTerms || purchase.paymentMethod || "";
    $("purchaseDueDate").value = purchase.dueDate || "";
    $("purchaseNotes").value = purchase.notes || "";
    $("purchaseDiscount").value = String(Number(purchase.discounts || 0)).replace(".", ",");
    $("purchaseFreight").value = String(Number(purchase.freight || 0)).replace(".", ",");
    $("purchaseTaxes").value = String(Number(purchase.taxes || 0)).replace(".", ",");
    $("purchaseOtherCosts").value = String(Number(purchase.otherCosts || 0)).replace(".", ",");
    $("purchaseDeclaredTotal").value = purchase.declaredTotal == null ? "" : String(purchase.declaredTotal).replace(".", ",");
    purchaseInvoiceData = purchase.attachment && (purchase.attachment.dataUrl || purchase.attachment) || "";
    purchaseAttachmentRef = purchase.attachmentRef || null;
    purchaseInvoiceDirty = !!(purchaseInvoiceData && !purchaseAttachmentRef);
    purchaseInvoiceFileName = purchaseAttachmentRef && purchaseAttachmentRef.fileName || "factura.jpg";
    purchaseDisplayAttachment();
    if (!purchaseInvoiceData && purchaseAttachmentRef) {
      purchaseRunEngine("purchaseLoadAttachment", [purchaseAttachmentRef]).then(function (dataUrl) {
        if (!purchaseEditorDraft || purchaseEditorDraft.purchase.id !== purchase.id || purchaseAttachmentRef !== purchase.attachmentRef) return;
        purchaseInvoiceData = dataUrl || "";
        purchaseDisplayAttachment();
      }).catch(function () {
        if ($("purchaseEditorMessage")) {
          $("purchaseEditorMessage").textContent = "La factura esta vinculada, pero no se pudo abrir la vista previa.";
          $("purchaseEditorMessage").className = "purchase-editor-message error";
        }
      });
    }
    $("purchaseEditorTitle").textContent = purchaseEditorDraft.correctionOf ? "Corregir pedido confirmado" : (purchaseHistory.some(function (row) { return row.id === purchase.id; }) ? "Editar pedido" : "Nuevo pedido");
    $("purchaseDraftStatus").textContent = purchaseEditorDraft.correctionOf ? "Correccion" : purchaseStatusLabel(purchase.status);
    $("purchaseDraftStatus").className = "purchase-status draft";
    $("purchaseEditorMessage").textContent = purchaseEditorDraft.correctionOf ? "La correccion generara movimientos reversos y conservara el original." : "El borrador puede guardarse y continuarse luego.";
    $("purchaseEditorMessage").className = "purchase-editor-message";
    purchaseRenderLines();
  }
  function purchaseOpenEditor(id, supplierId) {
    if (!isAdmin()) return Promise.resolve(false);
    return purchaseLoadData().then(function () {
      if (id) {
        var purchase = purchaseHistory.filter(function (row) { return row.id === id; })[0];
        if (!purchase || purchase.status !== "DRAFT") throw new Error("Solo se pueden editar pedidos en borrador.");
        purchaseEditorDraft = { purchase: Object.assign({}, purchase), lines: purchaseLinesFor(id).map(function (line) { return Object.assign({}, line); }) };
      } else purchaseEditorDraft = purchaseEmptyDraft(supplierId);
      purchaseFillEditor();
      $("purchaseEditorModal").classList.remove("hidden");
      return true;
    }).catch(function (error) { purchaseShowError(error); });
  }
  function purchaseCloseEditor() {
    $("purchaseEditorModal").classList.add("hidden");
    $("purchaseConfirmModal").classList.add("hidden");
    purchaseEditorDraft = null;
    purchaseInvoiceData = "";
    purchaseInvoiceFileName = "factura.jpg";
    purchaseInvoiceDirty = false;
    purchaseAttachmentRef = null;
    $("purchaseEditorForm").reset();
  }
  function purchaseAddLine(productId) {
    if (!purchaseEditorDraft) return;
    purchaseCaptureLines();
    purchaseEditorDraft.lines.push(purchaseNewLine(productId));
    purchaseRenderLines();
    setTimeout(function () { var rows = $("purchaseLinesEditor").querySelectorAll(".purchase-line-row"); if (rows.length) rows[rows.length - 1].querySelector("[data-purchase-product-search]").focus(); }, 0);
  }
  function purchasePrepareAttachmentForSave(draft) {
    if (!draft || !draft.purchase) return Promise.resolve(draft);
    if (!purchaseInvoiceData || !purchaseInvoiceDirty) {
      draft.purchase.attachmentRef = purchaseAttachmentRef || null;
      draft.purchase.attachment = "";
      draft.purchase.invoicePhoto = "";
      draft.purchase.attachmentData = "";
      return Promise.resolve(draft);
    }
    var purchaseKey = String(draft.purchase.id || "purchase").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "purchase";
    var attachmentId = "invoice-" + purchaseKey + "-" + uid();
    return purchaseRunEngine("purchaseStoreAttachment", [attachmentId, { dataUrl: purchaseInvoiceData, fileName: purchaseInvoiceFileName }]).then(function (ref) {
      purchaseAttachmentRef = ref || null;
      purchaseInvoiceDirty = false;
      draft.purchase.attachmentRef = ref || null;
      draft.purchase.attachment = "";
      draft.purchase.invoicePhoto = "";
      draft.purchase.attachmentData = "";
      return draft;
    });
  }
  function purchaseRemoveReplacedAttachment() {
    /* Invoice files are append-only audit evidence. Removing from a draft only detaches the reference. */
    return Promise.resolve(true);
  }
  function purchaseSaveDraftFromForm(event, keepOpen) {
    if (event) event.preventDefault();
    var draft = purchaseCaptureDraftFromForm();
    if (!draft || !draft.purchase.supplierId) { purchaseShowError(null, "Seleccione un proveedor antes de guardar."); return Promise.reject(new Error("Proveedor requerido")); }
    if (!draft.lines.length) { purchaseShowError(null, "Agregue al menos un producto al pedido."); return Promise.reject(new Error("Productos requeridos")); }
    if (draft.lines.some(function (line) { return !line.productId || Number(line.totalSaleQuantity || 0) <= 0 || Number(line.packageSize || 0) <= 0 || Number(line.packagesReceived || 0) < 0 || Number(line.bonusPackages || 0) < 0 || Number(line.costPerPackage || 0) < 0; })) {
      purchaseShowError(null, "Revise producto, paquetes, contenido y costo de cada linea."); return Promise.reject(new Error("Lineas incompletas"));
    }
    $("savePurchaseDraftBtn").disabled = true;
    return purchasePrepareAttachmentForSave(draft).then(function () {
      return purchaseRunEngine("purchaseSaveDraft", [draft.purchase, draft.lines]);
    }).then(function (saved) {
      $("savePurchaseDraftBtn").disabled = false;
      if (saved && saved.purchase) purchaseEditorDraft.purchase = Object.assign({}, saved.purchase);
      else if (saved && saved.id) purchaseEditorDraft.purchase = Object.assign({}, saved);
      if (keepOpen) {
        $("purchaseEditorMessage").textContent = "Borrador guardado de forma permanente.";
        $("purchaseEditorMessage").className = "purchase-editor-message ok";
      } else purchaseCloseEditor();
      renderSuppliers();
      toast("Borrador guardado");
      return purchaseRemoveReplacedAttachment().then(function () { return saved; });
    }).catch(function (error) {
      $("savePurchaseDraftBtn").disabled = false;
      purchaseShowError(error, "No se pudo guardar el borrador.");
      throw error;
    });
  }
  function purchaseRenderConfirmation() {
    var draft = purchaseCaptureDraftFromForm();
    var purchase = draft.purchase;
    var lines = draft.lines;
    $("purchaseConfirmSummary").innerHTML = "<header class='purchase-confirm-header'><div><h3>" + escapeHtml(supplierNameById(purchase.supplierId, purchase.supplierSnapshot)) + "</h3><p>" + purchaseDateLabel(purchase.deliveryDate) + (purchase.invoiceNumber ? " · Factura " + escapeHtml(purchase.invoiceNumber) : " · Sin numero de factura") + "</p></div><strong class='purchase-confirm-total'>" + money(purchase.total) + "</strong></header>"
      + "<div class='purchase-confirm-lines'>" + lines.map(function (line) { var pureBonus = Number(line.packagesReceived || 0) === 0 && Number(line.bonusPackages || 0) > 0; var adjustedBonus = pureBonus && Number(line.landedLineCost || 0) > .009; return "<div class='purchase-confirm-line'><b>" + escapeHtml(purchaseProductName(line)) + (pureBonus ? "<small>Producto bonificado" + (adjustedBonus ? " · con costos de factura asignados" : " · sin cargo") + "</small>" : Number(line.lineDiscount || 0) > 0 ? "<small>Descuento individual: - " + money(line.lineDiscount) + "</small>" : "") + "</b><span>" + (pureBonus ? "Bonificada: " + formatQuantity(line.bonusPackages) + " " + escapeHtml(unitLabel(line.purchaseUnit, line.bonusPackages)) : formatQuantity(line.packagesReceived) + " " + escapeHtml(unitLabel(line.purchaseUnit, line.packagesReceived)) + (line.bonusPackages ? " + " + formatQuantity(line.bonusPackages) + " bonif." : "")) + "</span><span>" + (pureBonus && !adjustedBonus ? "Sin cargo" : moneyCost(line.costPerSaleUnit) + " / " + escapeHtml(line.saleUnit)) + "</span><strong class='purchase-stock-change'>Stock +" + formatQuantity(line.totalSaleQuantity) + " " + escapeHtml(line.saleUnit) + "</strong></div>"; }).join("") + "</div>"
      + "<section class='purchase-detail-meta'><div><span>Subtotal</span><b>" + money(purchase.subtotal) + "</b></div><div><span>Descuentos por producto</span><b>" + money(purchase.lineDiscountTotal) + "</b></div><div><span>Descuento de factura</span><b>" + money(purchase.discounts) + "</b></div><div><span>Flete + recargos</span><b>" + money(Number(purchase.freight || 0) + Number(purchase.taxes || 0) + Number(purchase.otherCosts || 0)) + "</b></div><div><span>Factura adjunta</span><b>" + (purchaseInvoiceData || purchaseAttachmentRef || purchase.attachmentRef || purchase.attachment ? "Si" : "No") + "</b></div></section>";
  }
  function purchaseReviewConfirmation() {
    var draft = purchaseCaptureDraftFromForm();
    if (!draft || !draft.purchase.supplierId) { purchaseShowError(null, "Seleccione un proveedor."); return; }
    if (!draft.lines.length) { purchaseShowError(null, "Agregue al menos un producto."); return; }
    if (draft.lines.some(function (line) { return !line.productId || Number(line.totalSaleQuantity || 0) <= 0 || Number(line.packageSize || 0) <= 0 || Number(line.packagesReceived || 0) < 0 || Number(line.bonusPackages || 0) < 0 || Number(line.costPerPackage || 0) < 0; })) { purchaseShowError(null, "Revise producto, cantidad, contenido y costo. Las lineas totalmente bonificadas pueden tener costo cero."); return; }
    if (purchaseCheckDuplicate()) { purchaseShowError(null, "No se puede confirmar mientras exista una factura duplicada."); return; }
    purchaseRenderConfirmation();
    $("purchaseConfirmModal").classList.remove("hidden");
  }
  function purchaseExecuteConfirmation() {
    var draft = purchaseCaptureDraftFromForm();
    if (!draft) return;
    var isCorrection = !!purchaseEditorDraft.correctionOf;
    $("confirmPurchaseEntryBtn").disabled = true;
    var operation;
    if (purchaseEditorDraft.correctionOf) {
      operation = purchasePrepareAttachmentForSave(draft).then(function () {
        return purchaseRunEngine("purchaseCorrect", [purchaseEditorDraft.correctionOf, draft.purchase, draft.lines, purchaseEditorDraft.correctionReason || "Correccion administrativa"]);
      });
    } else {
      operation = purchasePrepareAttachmentForSave(draft).then(function () {
        return purchaseRunEngine("purchaseSaveDraft", [draft.purchase, draft.lines]);
      }).then(function (saved) {
        var id = saved && saved.purchase && saved.purchase.id || saved && saved.id || draft.purchase.id;
        return purchaseRunEngine("purchaseConfirm", [id]);
      });
    }
    operation.then(function (result) {
      $("confirmPurchaseEntryBtn").disabled = false;
      return purchaseRemoveReplacedAttachment().then(function () {
        purchaseCloseEditor();
        renderSuppliers();
        if (currentTab === "Produccion") renderProduction();
        toast(isCorrection ? "Correccion registrada" : "Ingreso confirmado y stock actualizado");
        return result;
      });
    }).catch(function (error) {
      $("confirmPurchaseEntryBtn").disabled = false;
      purchaseShowError(error, "No se pudo confirmar el ingreso. El stock no fue modificado.");
    });
  }
  function purchaseOpenDetail(id) {
    var purchase = purchaseHistory.filter(function (row) { return row.id === id; })[0];
    if (!purchase) return;
    purchaseSelectedDetail = purchase;
    var lines = purchaseLinesFor(id);
    var statusClass = purchaseStatusClass(purchase.status);
    $("purchaseDetailContent").innerHTML = "<header class='purchase-detail-header'><div><span class='suppliers-eyebrow'>Pedido recibido</span><h2 id='purchaseDetailTitle'>" + escapeHtml(supplierNameById(purchase.supplierId, purchase.supplierSnapshot)) + "</h2><p>" + purchaseDateLabel(purchase.deliveryDate) + (purchase.invoiceNumber ? " · Factura " + escapeHtml(purchase.invoiceNumber) : " · Sin factura") + "</p></div><div><span class='purchase-status " + statusClass + "'>" + purchaseStatusLabel(purchase.status) + "</span><strong class='purchase-confirm-total'>" + money(purchase.total) + "</strong></div></header>"
      + "<section class='purchase-detail-meta'><div><span>Condicion de pago</span><b>" + escapeHtml(purchase.paymentTerms || purchase.paymentMethod || "Sin indicar") + "</b></div><div><span>Vencimiento</span><b>" + (purchase.dueDate ? purchaseDateLabel(purchase.dueDate) : "Sin vencimiento") + "</b></div><div><span>Operador</span><b>" + escapeHtml(purchase.confirmedByName || purchase.updatedByName || purchase.createdByName || "Usuario registrado") + "</b></div><div><span>Revision</span><b>" + escapeHtml(String(purchase.revision || 1)) + "</b></div></section>"
      + "<section class='supplier-profile-section'><h3>Productos</h3><div class='purchase-detail-lines'>" + lines.map(function (line) { return "<div class='purchase-detail-line'><b>" + escapeHtml(purchaseProductName(line)) + "<small>" + escapeHtml([line.supplierDescription, line.supplierProductCode].filter(Boolean).join(" · ")) + (Number(line.lineDiscount || 0) > 0 ? " · Descuento " + money(line.lineDiscount) : "") + "</small></b><span>" + formatQuantity(line.packagesReceived) + " " + escapeHtml(unitLabel(line.purchaseUnit, line.packagesReceived)) + (line.bonusPackages ? " + " + formatQuantity(line.bonusPackages) + " bonif." : "") + "</span><span>" + formatQuantity(line.totalSaleQuantity) + " " + escapeHtml(line.saleUnit) + " · " + moneyCost(line.costPerSaleUnit) + "/" + escapeHtml(line.saleUnit) + "</span><strong>" + money(line.landedLineCost || line.grossSubtotal) + "</strong></div>"; }).join("") + "</div></section>"
      + "<section class='purchase-detail-meta'><div><span>Subtotal</span><b>" + money(purchase.subtotal) + "</b></div><div><span>Descuento</span><b>" + money(purchase.discounts) + "</b></div><div><span>Flete / impuestos / otros</span><b>" + money(Number(purchase.freight || 0) + Number(purchase.taxes || 0) + Number(purchase.otherCosts || 0)) + "</b></div><div><span>Total final</span><b>" + money(purchase.total) + "</b></div></section>"
      + (purchase.notes ? "<p class='modal-note'>" + escapeHtml(purchase.notes) + "</p>" : "")
      + (purchase.attachmentRef || purchase.attachment ? "<section class='purchase-invoice-image'><h3>Factura o remito adjunto</h3><div id='purchaseDetailInvoiceImage'><span>Cargando factura...</span></div></section>" : "");
    var actions = [];
    if (purchase.status === "DRAFT") {
      actions.push("<button type='button' data-detail-edit>Continuar editando</button>");
      actions.push("<button class='danger' type='button' data-detail-discard>Descartar borrador</button>");
    }
    if (purchase.status === "CONFIRMED") {
      actions.push("<button type='button' data-detail-correct>Corregir pedido</button>");
      actions.push("<button class='danger' type='button' data-detail-void>Anular con reversa</button>");
    }
    actions.push("<button type='button' data-detail-supplier>Ver proveedor</button>");
    $("purchaseDetailActions").innerHTML = actions.join("");
    var editButton = $("purchaseDetailActions").querySelector("[data-detail-edit]"); if (editButton) editButton.onclick = function () { purchaseCloseDetail(); purchaseOpenEditor(id); };
    var supplierButton = $("purchaseDetailActions").querySelector("[data-detail-supplier]"); if (supplierButton) supplierButton.onclick = function () { purchaseCloseDetail(); supplierOpenProfile(purchase.supplierId); };
    var correctButton = $("purchaseDetailActions").querySelector("[data-detail-correct]"); if (correctButton) correctButton.onclick = function () { purchaseStartCorrection(id); };
    var voidButton = $("purchaseDetailActions").querySelector("[data-detail-void]"); if (voidButton) voidButton.onclick = function () { purchaseVoidFromDetail(id); };
    var discardButton = $("purchaseDetailActions").querySelector("[data-detail-discard]"); if (discardButton) discardButton.onclick = function () { purchaseVoidFromDetail(id); };
    $("purchaseDetailModal").classList.remove("hidden");
    if (purchase.attachmentRef || purchase.attachment) {
      purchaseRunEngine("purchaseLoadAttachment", [purchase.attachmentRef || purchase.attachment]).then(function (dataUrl) {
        if (!purchaseSelectedDetail || purchaseSelectedDetail.id !== purchase.id || !$("purchaseDetailInvoiceImage")) return;
        $("purchaseDetailInvoiceImage").innerHTML = dataUrl ? "<img src='" + escapeHtml(dataUrl) + "' alt='Factura del pedido'>" : "<span>No se pudo mostrar la factura.</span>";
      }).catch(function () { if ($("purchaseDetailInvoiceImage")) $("purchaseDetailInvoiceImage").innerHTML = "<span>No se pudo abrir la factura adjunta.</span>"; });
    }
  }
  function purchaseCloseDetail() { $("purchaseDetailModal").classList.add("hidden"); purchaseSelectedDetail = null; }
  function purchaseStartCorrection(id) {
    var original = purchaseHistory.filter(function (row) { return row.id === id; })[0];
    if (!original || original.status !== "CONFIRMED") return;
    var reason = window.prompt("Motivo de la correccion (obligatorio):", "Correccion de cantidad o costo");
    if (!reason || !reason.trim()) return;
    purchaseEditorDraft = { correctionOf: id, correctionReason: reason.trim(), purchase: Object.assign({}, original, { id: uid(), status: "DRAFT", correctionOf: id, revision: Number(original.revision || 1) + 1, createdAt: nowIso(), createdBy: currentUser.id, updatedAt: nowIso(), updatedBy: currentUser.id }), lines: purchaseLinesFor(id).map(function (line) { return Object.assign({}, line, { id: uid(), purchaseId: "", supersedesLineId: line.id, createdAt: nowIso(), createdBy: currentUser.id }); }) };
    purchaseEditorDraft.lines.forEach(function (line) { line.purchaseId = purchaseEditorDraft.purchase.id; });
    purchaseCloseDetail();
    purchaseFillEditor();
    $("purchaseEditorModal").classList.remove("hidden");
  }
  function purchaseVoidFromDetail(id) {
    var purchase = purchaseHistory.filter(function (row) { return row.id === id; })[0];
    var isDraft = purchase && purchase.status === "DRAFT";
    var reason = window.prompt("Motivo de la anulacion (obligatorio):", "");
    if (!reason || !reason.trim()) return;
    if (!window.confirm(isDraft ? "El borrador quedara anulado y se conservara para auditoria. ¿Continuar?" : "Se intentara una reversa exacta y se conservara el pedido original. ¿Continuar?")) return;
    purchaseRunEngine("purchaseVoid", [id, reason.trim()]).then(function () {
      purchaseCloseDetail(); renderSuppliers(); if (currentTab === "Produccion") renderProduction(); toast("Pedido anulado con historial de reversa");
    }).catch(function (error) { purchaseShowError(error, "No se pudo anular el pedido."); });
  }
  function purchaseCreateProductWithoutLosingDraft() {
    purchaseCaptureDraftFromForm();
    purchasePendingProductCreation = true;
    openProductForm(null);
  }
  function purchaseCreateProductFromSearch(name, barcode) {
    if (purchaseEditorDraft) purchaseCaptureDraftFromForm();
    purchasePendingProductCreation = true;
    openProductForm(null, barcode || "");
    setTimeout(function () {
      if ($("editProductName") && name) $("editProductName").value = name;
      if ($("editProductName")) $("editProductName").focus();
    }, 40);
  }
  function purchaseAddScannedProduct(product, barcode) {
    function addToOpenEditor() {
      if (product) {
        purchaseCaptureLines();
        var emptyLine = purchaseEditorDraft.lines.filter(function (line) { return !line.productId; })[0];
        if (emptyLine) {
          emptyLine.productId = product.id;
          emptyLine.productNameSnapshot = product.name;
          emptyLine.saleUnit = product.unitType || product.priceUnit || "unidad";
          purchaseRenderLines();
        } else purchaseAddLine(product.id);
        toast("Producto agregado al pedido: " + product.name);
      } else {
        purchaseCreateProductFromSearch("", barcode);
        toast("Codigo nuevo: complete el producto para agregarlo al pedido");
      }
    }
    if (purchaseEditorDraft && !$("purchaseEditorModal").classList.contains("hidden")) {
      addToOpenEditor();
      return;
    }
    purchaseOpenEditor().then(function (opened) { if (opened !== false) addToOpenEditor(); });
  }
  function purchaseFinishCreatedProduct(product) {
    if (!purchasePendingProductCreation || !product) return;
    purchasePendingProductCreation = false;
    supplierProductsCache.push(product);
    purchaseCaptureLines();
    var emptyLine = purchaseEditorDraft && purchaseEditorDraft.lines.filter(function (line) { return !line.productId; })[0];
    if (emptyLine) {
      emptyLine.productId = product.id;
      emptyLine.productNameSnapshot = product.name;
      emptyLine.saleUnit = product.unitType || product.priceUnit || "unidad";
      purchaseRenderLines();
    } else purchaseAddLine(product.id);
    $("purchaseEditorModal").classList.remove("hidden");
    toast("Producto creado y agregado al pedido");
  }
  function purchaseDraftCanAutosave(draft) {
    return !!(draft && draft.purchase && draft.purchase.supplierId && draft.lines && draft.lines.length && draft.lines.some(function (line) {
      return line.productId && Number(line.totalSaleQuantity || 0) > 0 && Number(line.packageSize || 0) > 0;
    }));
  }
  function purchaseAutosaveCurrentDraft(reopenOnReturn) {
    if (!purchaseEditorDraft || !$('purchaseEditorModal') || $('purchaseEditorModal').classList.contains('hidden')) return Promise.resolve(false);
    try { purchaseCaptureDraftFromForm(); }
    catch (error) { return Promise.resolve(false); }
    purchaseEditorDraft.reopenOnReturn = reopenOnReturn !== false;
    if (!purchaseDraftCanAutosave(purchaseEditorDraft)) return Promise.resolve(false);
    var purchaseCopy = Object.assign({}, purchaseEditorDraft.purchase);
    var lineCopies = purchaseEditorDraft.lines.map(function (line) { return Object.assign({}, line); });
    var autosaveDraft = { purchase: purchaseCopy, lines: lineCopies };
    return purchasePrepareAttachmentForSave(autosaveDraft).then(function () {
      return purchaseRunEngine("purchaseSaveDraft", [autosaveDraft.purchase, autosaveDraft.lines]);
    }).then(function (saved) {
      if (saved && saved.purchase && purchaseEditorDraft && purchaseEditorDraft.purchase.id === saved.purchase.id) purchaseEditorDraft.purchase = Object.assign({}, saved.purchase);
      return true;
    }).catch(function (error) {
      purchaseShowError(error, "El borrador sigue abierto, pero no se pudo guardar automaticamente.");
      return false;
    });
  }
  function purchaseResumeDraftAfterTabReturn() {
    if (!purchaseEditorDraft || !purchaseEditorDraft.reopenOnReturn || currentTab !== "Proveedores") return;
    purchaseEditorDraft.reopenOnReturn = false;
    purchaseFillEditor();
    $("purchaseEditorModal").classList.remove("hidden");
    $("purchaseEditorMessage").textContent = "Borrador recuperado al volver a Proveedores.";
    $("purchaseEditorMessage").className = "purchase-editor-message ok";
  }
  function bindSuppliersUi() {
    if (!$('tabProveedores')) return;
    $("openSupplierFormBtn").onclick = function () { supplierOpenForm(null, false); };
    $("openPurchaseFormBtn").onclick = function () { purchaseOpenEditor(); };
    $("purchaseCreateSupplierBtn").onclick = function () { purchaseCaptureDraftFromForm(); supplierOpenForm(null, true); };
    $("addSupplierContactBtn").onclick = function () { supplierAddContact({}); };
    $("supplierForm").onsubmit = supplierSaveFromForm;
    $("closeSupplierFormModal").onclick = supplierCloseForm;
    $("cancelSupplierFormBtn").onclick = supplierCloseForm;
    $("purchaseEditorForm").onsubmit = function (event) { purchaseSaveDraftFromForm(event, false).catch(function () {}); };
    $("closePurchaseEditorModal").onclick = purchaseCloseEditor;
    $("cancelPurchaseEditBtn").onclick = purchaseCloseEditor;
    $("purchaseAddLineBtn").onclick = function () { purchaseAddLine(); };
    $("purchaseCreateProductBtn").onclick = purchaseCreateProductWithoutLosingDraft;
    $("reviewPurchaseConfirmBtn").onclick = purchaseReviewConfirmation;
    $("closePurchaseConfirmModal").onclick = function () { $("purchaseConfirmModal").classList.add("hidden"); };
    $("backToPurchaseEditBtn").onclick = function () { $("purchaseConfirmModal").classList.add("hidden"); };
    $("confirmPurchaseEntryBtn").onclick = purchaseExecuteConfirmation;
    $("purchaseInvoiceFile").onchange = function () { purchaseCompressInvoice($("purchaseInvoiceFile").files[0]); };
    ["purchaseSupplierId", "purchaseInvoiceNumber", "purchaseDiscount", "purchaseFreight", "purchaseTaxes", "purchaseOtherCosts", "purchaseDeclaredTotal"].forEach(function (id) { $(id).oninput = purchaseUpdateCalculations; $(id).onchange = purchaseUpdateCalculations; });
    $("clearPurchaseFiltersBtn").onclick = purchaseClearFilters;
    $("purchaseFilters").oninput = purchaseRerenderFiltersOnly;
    $("purchaseFilters").onchange = purchaseRerenderFiltersOnly;
    document.querySelectorAll("[data-purchase-status]").forEach(function (button) {
      button.onclick = function () {
        $("purchaseStatusFilter").value = button.dataset.purchaseStatus || "";
        purchaseRerenderFiltersOnly();
      };
    });
    $("supplierSearchInput").oninput = supplierRenderDirectory;
    $("closePurchaseDetailModal").onclick = purchaseCloseDetail;
    $("closeSupplierProfileModal").onclick = supplierCloseProfile;
    $("editSupplierFromProfileBtn").onclick = function () { var supplier = supplierSelectedProfile; supplierCloseProfile(); supplierOpenForm(supplier, false); };
    $("newPurchaseForSupplierBtn").onclick = function () { var id = supplierSelectedProfile && supplierSelectedProfile.id; supplierCloseProfile(); purchaseOpenEditor(null, id); };
    [["purchaseDetailModal", purchaseCloseDetail], ["supplierProfileModal", supplierCloseProfile]].forEach(function (entry) {
      $(entry[0]).onclick = function (event) { if (event.target === $(entry[0])) entry[1](); };
    });
  }

  function renderAll() {
    if (currentTab === "Caja") renderCaja();
    if (currentTab === "Cierres") renderClosures();
    if (currentTab === "Balance") renderMonthly();
    if (currentTab === "Produccion") renderProduction();
    if (currentTab === "Proveedores") renderSuppliers();
    if (currentTab === "MercadoLibre" && window.MercadoLibreModule) window.MercadoLibreModule.onActivate();
    if (currentTab === "Metricas") renderMetrics();
    if (currentTab === "Movimientos") renderMovements();
    if (currentTab === "Conteos") renderStockCounts();
    if (currentTab === "Usuarios" || currentTab === "Dev") renderAdmin();
    if (currentTab === "Dev") renderDev();
  }
  function configureMercadoLibreModule() {
    if (!window.MercadoLibreModule) return;
    window.MercadoLibreModule.configure({
      all: all,
      add: add,
      addMany: addMany,
      audit: audit,
      request: mercadoLibreRequest,
      commitPublication: commitMercadoLibrePublication,
      isAdmin: isAdmin,
      getCurrentUser: function () { return currentUser; },
      escapeHtml: escapeHtml,
      toast: toast,
      uid: uid,
      nowIso: nowIso,
      money: money
    });
  }
  function renderDev() {
    if (!isDev()) return;
    Promise.all(STORES.map(all)).then(function (sets) {
      var totals = {};
      STORES.forEach(function (s, i) { totals[s] = sets[i].length; });
      if ($("devSummary")) {
        $("devSummary").innerHTML = summary([
          ["Ventas", totals.transactions],
          ["Productos", totals.products],
          ["Usuarios", totals.users],
          ["Auditoria", totals.auditLog]
        ]);
      }
      if ($("devStoreList")) {
        $("devStoreList").innerHTML = STORES.map(function (name) {
          return "<div><span>" + escapeHtml(name) + "</span><b>" + totals[name] + "</b></div>";
        }).join("");
      }
      loadDevUiSettings();
      loadUpdateSettings();
      loadTicketSettings();
    });
  }
  function sum(rows, predicate, field) {
    field = field || "amount";
    return rows.reduce(function (acc, row) { return predicate(row) ? acc + Number(row[field] || 0) : acc; }, 0);
  }
  function card(html, tone) { return "<div class='entry-card " + (tone || "") + "'>" + html + "</div>"; }
  function empty(text) { return "<div class='empty'>" + text + "</div>"; }
  function summary(items) {
    return items.map(function (i) { return "<div class='summary-item'><span>" + i[0] + "</span><b>" + i[1] + "</b></div>"; }).join("");
  }
  function handleMonthlyPhoto(file) {
    if (!file) { monthlyPhotoData = ""; return; }
    var reader = new FileReader();
    reader.onload = function () {
      monthlyPhotoData = reader.result;
      toast("Foto adjuntada");
    };
    reader.readAsDataURL(file);
  }
  function renderMonthlyReasonOptions() {
    all("monthlyEntries").then(function (entries) {
      var seen = {};
      monthlyCategories.forEach(function (c) { seen[c] = true; });
      entries.forEach(function (e) { if (e.category) seen[e.category] = true; });
      $("monthlyReasonOptions").innerHTML = Object.keys(seen).sort().map(function (c) {
        return "<option value='" + escapeHtml(c) + "'></option>";
      }).join("");
    });
  }
  function startSplitResize(e) {
    e.preventDefault();
    var layout = $("cashierLayout");
    if (!layout || window.innerWidth < 981) return;
    var rect = layout.getBoundingClientRect();
    splitDrag = { layout: layout, left: rect.left, width: rect.width };
    document.body.classList.add("resizing-split");
    moveSplitResize(e);
  }
  function eventPoint(e) {
    var point = e && e.touches && e.touches.length ? e.touches[0] : e && e.changedTouches && e.changedTouches.length ? e.changedTouches[0] : e;
    return { x: Number(point && point.clientX || 0), y: Number(point && point.clientY || 0) };
  }
  function moveSplitResize(e) {
    if (!splitDrag) return;
    if (e && e.preventDefault) e.preventDefault();
    var point = eventPoint(e);
    var minLeft = 360;
    var minRight = 390;
    var handle = 14;
    var leftWidth = Math.max(minLeft, Math.min(splitDrag.width - minRight - handle, point.x - splitDrag.left));
    splitDrag.layout.style.setProperty("--sale-width", leftWidth + "px");
    document.documentElement.style.setProperty("--sale-width", leftWidth + "px");
    if ($("devSaleWidth")) {
      $("devSaleWidth").value = Math.round(leftWidth / 10) * 10;
      updateDevUiOutputs();
    }
  }
  function stopSplitResize() {
    if (!splitDrag) return;
    var s = devUiSettings();
    var value = parseInt(document.documentElement.style.getPropertyValue("--sale-width"), 10);
    if (value) {
      s.saleWidth = value;
      persistDevUiSettings(s);
    }
    splitDrag = null;
    document.body.classList.remove("resizing-split");
  }
  function startShelfResize(e) {
    e.preventDefault();
    var strip = $("productGrid");
    if (!strip) return;
    var rect = strip.getBoundingClientRect();
    shelfDrag = { strip: strip, top: rect.top };
    document.body.classList.add("resizing-shelf");
    moveShelfResize(e);
  }
  function moveShelfResize(e) {
    if (!shelfDrag) return;
    if (e && e.preventDefault) e.preventDefault();
    var point = eventPoint(e);
    var height = Math.max(96, Math.min(520, point.y - shelfDrag.top));
    document.documentElement.style.setProperty("--product-shelf-height", height + "px");
    if ($("devShelfHeight")) {
      $("devShelfHeight").value = Math.round(height / 10) * 10;
      updateDevUiOutputs();
    }
  }
  function stopShelfResize() {
    if (!shelfDrag) return;
    var s = devUiSettings();
    var value = parseInt(document.documentElement.style.getPropertyValue("--product-shelf-height"), 10);
    if (value) {
      s.shelfHeight = value;
      persistDevUiSettings(s);
    }
    shelfDrag = null;
    document.body.classList.remove("resizing-shelf");
  }
  function bindResizeHandle(handle, startFn) {
    if (!handle) return;
    handle.onpointerdown = startFn;
    handle.onmousedown = startFn;
    handle.ontouchstart = startFn;
  }
  function bind() {
    attachLoginHandlers();
    bindSuppliersUi();
    document.addEventListener("forrajeria:product-saved", function (event) {
      var product = event && event.detail && event.detail.product;
      if (event && event.detail && event.detail.returnToPurchase && product) {
        purchasePendingProductCreation = true;
        purchaseFinishCreatedProduct(product);
      }
    });
    $("logoutBtn").onclick = openLogoutConfirm;
    if ($("confirmLogoutBtn")) $("confirmLogoutBtn").onclick = logout;
    if ($("cancelLogoutBtn")) $("cancelLogoutBtn").onclick = closeLogoutConfirm;
    if ($("closeLogoutConfirmModal")) $("closeLogoutConfirmModal").onclick = closeLogoutConfirm;
    $("saleForm").onsubmit = saveQuickSale;
    $("withdrawForm").onsubmit = saveWithdrawal;
    $("undoBtn").onclick = undoLastSale;
    $("closureForm").onsubmit = saveClosure;
    if ($("openPartialClosureBtn")) $("openPartialClosureBtn").onclick = openPartialClosureModal;
    if ($("partialClosureForm")) $("partialClosureForm").onsubmit = savePartialClosure;
    if ($("closePartialClosureModal")) $("closePartialClosureModal").onclick = closePartialClosureModal;
    if ($("closureDateSelect")) $("closureDateSelect").onchange = function () { setClosureContext($("closureDateSelect").value, "DAY", true); renderClosures(); };
    $("countedCash").oninput = updateClosureDiffs;
    $("countedTransfer").oninput = updateClosureDiffs;
    if ($("partialCountedCash")) $("partialCountedCash").oninput = updatePartialClosureDiffs;
    if ($("partialCountedTransfer")) $("partialCountedTransfer").oninput = updatePartialClosureDiffs;
    $("monthlyForm").onsubmit = saveMonthly;
    if ($("productionForm")) $("productionForm").onsubmit = saveProduction;
    if ($("productionProduct")) $("productionProduct").onchange = updateProductionProductFields;
    if ($("productionAction")) $("productionAction").onchange = updateProductionActionUi;
    if ($("productionAction")) updateProductionActionUi();
    $("userForm").onsubmit = saveUser;
    if ($("userEditForm")) $("userEditForm").onsubmit = saveUserEdit;
    if ($("closeUserEditModal")) $("closeUserEditModal").onclick = closeUserEdit;
    if ($("deleteUserBtn")) $("deleteUserBtn").onclick = function () { deleteUser($("editUserId").value); };
    if ($("stockCountForm")) $("stockCountForm").onsubmit = submitStockCountMission;
    if ($("stockCountRequestMissionBtn")) $("stockCountRequestMissionBtn").onclick = requestAdditionalStockCountMission;
    if ($("closeStockCountModal")) $("closeStockCountModal").onclick = closeStockCountMission;
    if ($("stockCountReviewForm")) $("stockCountReviewForm").onsubmit = applyStockCountReview;
    if ($("closeStockCountReviewModal")) $("closeStockCountReviewModal").onclick = closeStockCountReview;
    if ($("resolveStockCountNoChangeBtn")) $("resolveStockCountNoChangeBtn").onclick = resolveStockCountWithoutChange;
    $("exportBtn").onclick = exportData;
    $("integrationForm").onsubmit = saveIntegrationSettings;
    if ($("ticketConfigForm")) $("ticketConfigForm").onsubmit = saveTicketSettings;
    if ($("devUiForm")) $("devUiForm").onsubmit = saveDevUiSettings;
    if ($("devDensity")) $("devDensity").onchange = previewDevUiSettings;
    if ($("devTheme")) $("devTheme").onchange = previewDevUiSettings;
    if ($("devMotion")) $("devMotion").onchange = previewDevUiSettings;
    if ($("devPerformance")) $("devPerformance").onchange = function () { previewDevUiSettings(); startMpSync(); };
    if ($("devSaleWidth")) $("devSaleWidth").oninput = previewDevUiSettings;
    if ($("devShelfHeight")) $("devShelfHeight").oninput = previewDevUiSettings;
    if ($("resetDevUiBtn")) $("resetDevUiBtn").onclick = resetDevUiSettings;
    if ($("resetTabOrderBtn")) $("resetTabOrderBtn").onclick = resetTabOrder;
    if ($("autoUpdateCheck")) $("autoUpdateCheck").onchange = saveUpdateSettings;
    if ($("checkUpdatesBtn")) $("checkUpdatesBtn").onclick = function () { checkForUpdates(false); };
    if ($("copyUpdaterCommandBtn")) $("copyUpdaterCommandBtn").onclick = copyUpdaterCommand;
    if ($("downloadUpdateBtn")) $("downloadUpdateBtn").onclick = downloadUpdate;
    if ($("openRepoBtn")) $("openRepoBtn").onclick = openUpdateRepo;
    if ($("closeUpdateModal")) $("closeUpdateModal").onclick = closeUpdateModal;
    if ($("copyUpdaterCommandModalBtn")) $("copyUpdaterCommandModalBtn").onclick = copyUpdaterCommand;
    if ($("downloadUpdateModalBtn")) $("downloadUpdateModalBtn").onclick = downloadUpdate;
    if ($("openRepoModalBtn")) $("openRepoModalBtn").onclick = openUpdateRepo;
    if ($("generateTestDataBtn")) $("generateTestDataBtn").onclick = generateTestData;
    if ($("clearAllDataBtn")) $("clearAllDataBtn").onclick = clearAllData;
    if ($("clearDataForm")) $("clearDataForm").onsubmit = confirmClearAllData;
    if ($("closeClearDataModal")) $("closeClearDataModal").onclick = closeClearDataModal;
    $("salePaymentSelect").onchange = function () { setPayment($("salePaymentSelect").value); };
    if ($("quickSplitCash")) $("quickSplitCash").oninput = renderQuickSplitPayment;
    $("applyWorkShift").onclick = function () {
      currentSession.businessDate = $("workDateInput").value || currentSession.businessDate;
      currentSession.shiftType = $("workShiftInput").value;
      sessionStorage.setItem("bakerySession", JSON.stringify({ user: currentUser, session: currentSession }));
      add("sessions", currentSession).then(function () { return audit("WORK_SHIFT_CHANGED", currentSession.businessDate + " " + currentSession.shiftType); }).then(showApp);
    };
    $("monthPicker").onchange = function () {
      selectedBalanceDay = "";
      expandedBalanceEntries = {};
      renderMonthly();
    };
    if ($("balancePrevMonth")) $("balancePrevMonth").onclick = function () { shiftBalanceMonth(-1); };
    if ($("balanceNextMonth")) $("balanceNextMonth").onclick = function () { shiftBalanceMonth(1); };
    if ($("balanceCurrentMonth")) $("balanceCurrentMonth").onclick = function () {
      $("monthPicker").value = monthKey(today());
      selectedBalanceDay = "";
      expandedBalanceEntries = {};
      renderMonthly();
    };
    if ($("clearBalanceDayBtn")) $("clearBalanceDayBtn").onclick = function () {
      selectedBalanceDay = "";
      expandedBalanceEntries = {};
      renderMonthly();
    };
    if ($("balanceEntryFilter")) $("balanceEntryFilter").onchange = function () {
      balanceEntryFilter = $("balanceEntryFilter").value || "all";
      expandedBalanceEntries = {};
      renderMonthly();
    };
    if ($("productionFilterDate")) $("productionFilterDate").onchange = renderProduction;
    if ($("stockSearchInput")) $("stockSearchInput").oninput = renderProduction;
    if ($("stockCategoryFilter")) $("stockCategoryFilter").onchange = renderProduction;
    if ($("stockSortSelect")) $("stockSortSelect").onchange = renderProduction;
    if ($("stockStatusFilter")) $("stockStatusFilter").onchange = renderProduction;
    document.querySelectorAll("[data-stock-view]").forEach(function (button) {
      button.onclick = function () { setStockViewMode(button.dataset.stockView); };
    });
    if ($("stockAddProductBtn")) $("stockAddProductBtn").onclick = function () { openProductForm(null); };
    if ($("stockSelectVisibleBtn")) $("stockSelectVisibleBtn").onclick = selectVisibleStockProducts;
    if ($("stockClearSelectionBtn")) $("stockClearSelectionBtn").onclick = clearStockProductSelection;
    if ($("stockLabelsBtn")) $("stockLabelsBtn").onclick = openStockLabelsModal;
    if ($("stockLabelsDownloadPdfBtn")) $("stockLabelsDownloadPdfBtn").onclick = downloadSelectedStockLabels;
    if ($("stockLabelsPrintBtn")) $("stockLabelsPrintBtn").onclick = printSelectedStockLabels;
    if ($("closeStockLabelsModal")) $("closeStockLabelsModal").onclick = closeStockLabelsModal;
    if ($("stockImportXlsxBtn")) $("stockImportXlsxBtn").onclick = chooseStockWorkbook;
    if ($("stockExportXlsxBtn")) $("stockExportXlsxBtn").onclick = exportStockWorkbook;
    if ($("stockXlsxFile")) $("stockXlsxFile").onchange = function () { handleStockWorkbookFile($("stockXlsxFile").files[0]); };
    if ($("stockImportTarget")) $("stockImportTarget").onchange = updateStockImportPreview;
    if ($("applyStockImportBtn")) $("applyStockImportBtn").onclick = applyStockImport;
    if ($("cancelStockImportBtn")) $("cancelStockImportBtn").onclick = closeStockImportModal;
    if ($("closeStockImportModal")) $("closeStockImportModal").onclick = closeStockImportModal;
    bindMetricsDashboardControls();
    if ($("closeMonthlyReportModal")) $("closeMonthlyReportModal").onclick = closeMonthlyReportModal;
    if ($("monthlyReportCloseBtn")) $("monthlyReportCloseBtn").onclick = closeMonthlyReportModal;
    if ($("monthlyReportDownloadBtn")) $("monthlyReportDownloadBtn").onclick = function () { reportDownload(latestMonthlyReport); };
    if ($("monthlyReportModal")) $("monthlyReportModal").onclick = function (event) { if (event.target === $("monthlyReportModal")) closeMonthlyReportModal(); };
    $("movementFilters").oninput = scheduleRenderMovements;
    $("movementFilters").onchange = renderMovements;
    $("movementsList").onscroll = function () {
      var list = $("movementsList");
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 180) loadMoreMovements();
    };
    $("selectVisibleMovements").onclick = selectVisibleMovements;
    $("clearMovementSelection").onclick = clearMovementSelection;
    $("editMovementBtn").onclick = openMovementEdit;
    $("deleteMovementBtn").onclick = openMovementDelete;
    $("movementEditForm").onsubmit = saveMovementEdit;
    $("closeMovementEditModal").onclick = closeMovementEdit;
    if ($("movementEditAddItem")) $("movementEditAddItem").onclick = addMovementEditItem;
    if ($("movementEditDeleted")) $("movementEditDeleted").onchange = renderMovementEditItems;
    $("movementDeleteForm").onsubmit = deleteSelectedMovements;
    $("closeMovementDeleteModal").onclick = closeMovementDelete;
    $("monthlyPhoto").onchange = function () { handleMonthlyPhoto($("monthlyPhoto").files[0]); };
    $("monthlyRecurring").onchange = function () { $("monthlyWeekdayWrap").classList.toggle("hidden", !$("monthlyRecurring").checked); };
    $("quickModeBtn").onclick = function () { setSaleMode("quick"); };
    $("basketModeBtn").onclick = function () { setSaleMode("basket"); };
    $("clearBasketBtn").onclick = clearBasketContents;
    $("chargeBasketBtn").onclick = chargeBasket;
    if ($("printBasketBtn")) $("printBasketBtn").onclick = printCurrentBasket;
    if ($("barcodeInput")) $("barcodeInput").onkeydown = handleBarcodeInputKey;
    if ($("barcodeInput")) $("barcodeInput").oninput = function () { scheduleBarcodeAutoRead("barcodeInput"); };
    if ($("productTextSearch")) $("productTextSearch").oninput = renderProductSearch;
    if ($("productTextSearch")) $("productTextSearch").onkeydown = function (e) {
      if (e.key === "Escape") clearProductSearch();
    };
    if ($("closuresList")) $("closuresList").onscroll = function () {
      var list = $("closuresList");
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 120) loadMoreClosureHistory();
    };
    if ($("stockBarcodeInput")) $("stockBarcodeInput").onkeydown = handleStockBarcodeInputKey;
    if ($("stockBarcodeInput")) $("stockBarcodeInput").oninput = function () { scheduleBarcodeAutoRead("stockBarcodeInput"); };
    if ($("mercadoPagoBtn")) $("mercadoPagoBtn").onclick = checkoutMercadoPago;
    $("openWithdrawBtn").onclick = openWithdrawModal;
    if ($("cashPaymentsCard")) $("cashPaymentsCard").onclick = function () { openClosurePaymentsModal("cash"); };
    $("reviewPaymentsCard").onclick = openReviewTransfersModal;
    $("closeReviewTransfersModal").onclick = closeReviewTransfersModal;
    bindResizeHandle($("splitResizeHandle"), startSplitResize);
    bindResizeHandle($("shelfResizeHandle"), startShelfResize);
    $("cropPreview").onpointerdown = startCropDrag;
    $("cropPreview").onmousedown = startCropDrag;
    $("cropPreview").ontouchstart = startCropDrag;
    document.addEventListener("pointermove", function (e) { moveSplitResize(e); moveShelfResize(e); moveCropDrag(e); });
    document.addEventListener("mousemove", function (e) { moveSplitResize(e); moveShelfResize(e); moveCropDrag(e); });
    document.addEventListener("touchmove", function (e) { moveSplitResize(e); moveShelfResize(e); moveCropDrag(e); }, { passive: false });
    document.addEventListener("pointerup", function () {
      stopSplitResize();
      stopShelfResize();
      stopCropDrag();
      if (movementDragSelect) {
        movementDragSelect = null;
        if (currentTab === "Movimientos") renderMovements();
      }
    });
    document.addEventListener("mouseup", function () {
      stopSplitResize();
      stopShelfResize();
      stopCropDrag();
    });
    document.addEventListener("touchend", function () {
      stopSplitResize();
      stopShelfResize();
      stopCropDrag();
    });
    document.addEventListener("keydown", handleGlobalScannerKey, true);
    $("closeWithdrawModal").onclick = closeWithdrawModal;
    $("closeUndoModal").onclick = closeUndoModal;
    $("undoForm").onsubmit = confirmUndoSale;
    if ($("closeSaleDetailModal")) $("closeSaleDetailModal").onclick = closeSaleDetail;
    if ($("reprintSaleBtn")) $("reprintSaleBtn").onclick = reprintSelectedSale;
    $("closeProductModal").onclick = closeProductModal;
    $("closeProductEditorModal").onclick = closeProductEditor;
    $("closeProductFormModal").onclick = closeProductForm;
    $("newProductBtn").onclick = function () { openProductForm(null); };
    $("productSaleForm").onsubmit = function (e) { e.preventDefault(); addProductToTicket(); };
    $("productEditorForm").onsubmit = saveProductEditor;
    ["editProductPurchaseUnitQuantity", "editProductPurchaseCost", "editProductTargetMarkup", "editProductPrice", "editProductUnit"].forEach(function (id) {
      if ($(id)) $(id).oninput = updateProductCostPreview;
      if ($(id) && $(id).tagName === "SELECT") $(id).onchange = updateProductCostPreview;
    });
    $("addProductToTicket").onclick = null;
    if ($("openCustomItemBtn")) $("openCustomItemBtn").onclick = openCustomItemModal;
    $("closeCustomItemModal").onclick = closeCustomItemModal;
    $("customItemForm").onsubmit = saveCustomItem;
    $("customItemAmount").oninput = updateCustomItemTotal;
    $("editProductImage").onchange = function () { handleProductImage($("editProductImage").files[0]); };
    $("cropZoom").oninput = updateCropPreview;
    $("cropX").oninput = updateCropPreview;
    $("cropY").oninput = updateCropPreview;
    $("productPriceInput").oninput = updateProductModalTotal;
    $("productQuantityInput").oninput = updateProductModalTotal;
    if ($("productWeightQuick")) $("productWeightQuick").onclick = function (event) {
      var button = event.target && event.target.closest && event.target.closest("[data-product-weight]");
      if (button) {
        productEntryMode = "quantity";
        $("productQuantityInput").value = String(button.dataset.productWeight).replace(".", ",");
        updateProductModalTotal();
        $("productQuantityInput").focus();
      }
    };
    document.querySelectorAll("[data-product-entry-mode]").forEach(function (button) {
      button.onclick = function () {
        productEntryMode = button.dataset.productEntryMode === "money" ? "money" : "quantity";
        $("productQuantityInput").value = "";
        renderProductQuantityOptions();
        $("productQuantityInput").focus();
      };
    });
    $("productQuantityInput").onkeydown = function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        addProductToTicket();
      }
    };
    $("saleAmount").oninput = scheduleSaleAutoSave;
    $("ticketPaid").oninput = renderBasket;
    if ($("ticketSplitCash")) $("ticketSplitCash").oninput = renderBasket;
    if ($("ticketPaymentSelect")) $("ticketPaymentSelect").onchange = renderBasket;
    if ($("ticketDiscountValue")) $("ticketDiscountValue").oninput = function () {
      ticketDiscount.value = Math.max(0, parseMoney($("ticketDiscountValue").value));
      renderBasket();
    };
    document.querySelectorAll("[data-ticket-discount-type]").forEach(function (button) {
      button.onclick = function () {
        ticketDiscount.type = button.dataset.ticketDiscountType === "fixed" ? "fixed" : "percent";
        renderBasket();
        if ($("ticketDiscountValue")) $("ticketDiscountValue").focus();
      };
    });
    if ($("clearTicketDiscountBtn")) $("clearTicketDiscountBtn").onclick = function () { resetTicketDiscount(); renderBasket(); };
    document.querySelectorAll("[data-ticket-payment]").forEach(function (button) {
      button.onclick = function () {
        if ($("ticketPaymentSelect")) $("ticketPaymentSelect").value = button.dataset.ticketPayment;
        renderBasket();
      };
    });
    $("productModal").onclick = function (e) { if (e.target === $("productModal") && selectedProduct) $("productQuantityInput").focus(); };
    $("productModal").oncontextmenu = function (e) { e.preventDefault(); if (selectedProduct) closeProductModal(); };
    $("withdrawModal").onclick = function (e) { if (e.target === $("withdrawModal")) closeWithdrawModal(); };
    $("undoModal").onclick = function (e) { if (e.target === $("undoModal")) closeUndoModal(); };
    if ($("saleDetailModal")) $("saleDetailModal").onclick = function (e) { if (e.target === $("saleDetailModal")) closeSaleDetail(); };
    if ($("logoutConfirmModal")) $("logoutConfirmModal").onclick = function (e) { if (e.target === $("logoutConfirmModal")) closeLogoutConfirm(); };
    $("customItemModal").onclick = function (e) { if (e.target === $("customItemModal")) closeCustomItemModal(); };
    if ($("stockLabelsModal")) $("stockLabelsModal").onclick = function (e) { if (e.target === $("stockLabelsModal")) closeStockLabelsModal(); };
    if ($("closePriceReviewModal")) $("closePriceReviewModal").onclick = closePriceReviewModal;
    if ($("priceReviewModal")) $("priceReviewModal").onclick = function (e) { if (e.target === $("priceReviewModal")) closePriceReviewModal(); };
    if ($("priceReviewForm")) $("priceReviewForm").onsubmit = function (event) {
      event.preventDefault();
      approvePriceReview(activePriceReview, parseMoney($("priceReviewProposedPrice").value));
    };
    if ($("keepCurrentPriceBtn")) $("keepCurrentPriceBtn").onclick = function () { keepPriceReview(activePriceReview); };
    $("reviewTransfersModal").onclick = function (e) { if (e.target === $("reviewTransfersModal")) closeReviewTransfersModal(); };
    if ($("partialClosureModal")) $("partialClosureModal").onclick = function (e) { if (e.target === $("partialClosureModal")) closePartialClosureModal(); };
    $("movementEditModal").onclick = function (e) { if (e.target === $("movementEditModal")) closeMovementEdit(); };
    $("movementDeleteModal").onclick = function (e) { if (e.target === $("movementDeleteModal")) closeMovementDelete(); };
    if ($("userEditModal")) $("userEditModal").onclick = function (e) { if (e.target === $("userEditModal")) closeUserEdit(); };
    if ($("clearDataModal")) $("clearDataModal").onclick = function (e) { if (e.target === $("clearDataModal")) closeClearDataModal(); };
    if ($("updateModal")) $("updateModal").onclick = function (e) { if (e.target === $("updateModal")) closeUpdateModal(); };
    document.querySelectorAll(".pay-btn").forEach(function (b) { b.onclick = function () { setPayment(b.dataset.payment); }; });
    $("calcAdd").onclick = function () { addCalc(parseMoney($("calcAmount").value)); };
    $("calcClear").onclick = function () { calcItems = []; $("calcPaid").value = ""; renderCalc(); };
    $("calcPaid").oninput = renderCalc;
    $("calcUse").onclick = function () { $("saleAmount").value = String(Math.round(calcItems.reduce(function (a, b) { return a + b; }, 0))); setSaleMode("quick"); $("saleAmount").focus(); };
    document.querySelectorAll("[data-calc]").forEach(function (b) { b.onclick = function () { addCalc(Number(b.dataset.calc)); }; });
    document.addEventListener("keydown", function (e) {
      if (!currentUser || e.ctrlKey || e.altKey || e.metaKey || isSubmittingSale) return;
      var tag = document.activeElement && document.activeElement.tagName.toLowerCase();
      if (tag === "textarea" || (tag === "input" && document.activeElement !== $("saleAmount"))) return;
      if (e.key === "Enter" && saleMode === "quick" && document.activeElement === $("saleAmount")) {
        e.preventDefault();
        clearTimeout(autoSaleTimer);
        saveQuickSale();
      }
      if ((e.key === "e" || e.key === "E") && saleMode === "quick" && $("saleAmount").value.trim()) {
        e.preventDefault();
        setPayment("Efectivo");
        clearTimeout(autoSaleTimer);
        saveSale(parseMoney($("saleAmount").value), "FAST");
      }
      if ((e.key === "q" || e.key === "Q") && saleMode === "quick" && $("saleAmount").value.trim()) {
        e.preventDefault();
        setPayment("QR");
        clearTimeout(autoSaleTimer);
        saveSale(parseMoney($("saleAmount").value), "FAST");
      }
    });
    document.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest("#stockAddProductBtn")) {
        e.preventDefault();
        openProductForm(null);
        return;
      }
      if (!e.target || !e.target.closest || !e.target.closest("#productContextMenu")) closeProductContextMenu();
    }, true);
  }
  function fillSelects() {
    renderMonthlyReasonOptions();
  }
  function restoreSession() {
    var raw = sessionStorage.getItem("bakerySession");
    if (!raw) return false;
    try {
      var s = JSON.parse(raw);
      currentUser = s.user;
      currentSession = s.session;
      showApp();
      return true;
    } catch (e) { return false; }
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateAppHeight();
    window.addEventListener("resize", updateAppHeight);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", updateAppHeight);
    attachLoginHandlers();
    if (!("indexedDB" in window)) {
      alert("Este navegador no soporta IndexedDB. Use Chrome, Edge o Firefox.");
      return;
    }
    configureMercadoLibreModule();
    bind();
    loadDevUiSettings();
    loadUpdateSettings();
    loadTicketSettings();
    fillSelects();
    setPayment("Efectivo");
    setSaleMode("quick");
    updatePersistenceStatus(startupPersistenceMessage, startupPersistenceTone);
    initializeDataPersistence().then(function () {
      return seed();
    }).then(function () {
      return writeDiskSnapshot(true);
    }).then(function () {
      return renderLoginUsers("turno_manana");
    }).then(function () {
      restoreSession();
      if (updateSettings().autoCheck !== false) checkForUpdates(true);
      // PWA registration is intentionally left off during local preview so UI changes are never hidden by cache.
    }).catch(function (error) {
      if ($("loginStatus")) $("loginStatus").textContent = error && error.message ? error.message : "No se pudo preparar la base local.";
      if ($("loginSubmitBtn")) $("loginSubmitBtn").disabled = true;
      updatePersistenceStatus("Inicio bloqueado para proteger los datos", "warning");
    });
    setInterval(function () { writeDiskSnapshot(true); }, 120000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") writeDiskSnapshot(true); });
  });
})();
