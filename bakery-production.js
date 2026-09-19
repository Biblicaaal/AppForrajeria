(function () {
  'use strict';
  var api, recipes = [], products = [], busy = false, submissionId = null;
  function el(id) { return document.getElementById(id); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function selected() { return recipes.find(function (r) { return r.id === el('batchRecipe').value; }); }
  function draft() { return { id: submissionId, recipeId: el('batchRecipe').value, multiplier: Number(el('batchMultiplier').value), actualOutput: Number(el('batchActual').value), date: el('batchDate').value, note: el('batchNote').value.trim() }; }
  function preview(resetActual) {
    var r = selected(); if (!r) { el('batchPreview').textContent = 'Primero cree y apruebe una receta vinculada a un producto terminado.'; return; }
    var expected = r.yield * Number(el('batchMultiplier').value);
    if (resetActual) el('batchActual').value = Number.isFinite(expected) && expected > 0 ? expected : '';
    el('batchExpected').textContent = 'Esperado: ' + expected + ' ' + r.unit + '. Indique la produccion obtenida en ' + r.unit + '.';
    try {
      var plan = window.BakeryProductionCore.plan(r, draft(), products);
      el('batchPreview').innerHTML = '<b>Al confirmar el ingreso:</b><ul>' + plan.changes.map(function (c) { return '<li>' + api.escape(c.after.name) + ': ' + (c.quantity > 0 ? '+' : '') + c.quantity + ' ' + api.escape(c.after.unitType || c.after.priceUnit || 'unidad') + '</li>'; }).join('') + '</ul><p>' + (plan.costComplete ? 'Costo de ingredientes: ' + api.money(plan.knownMaterialCost) : 'Costo incompleto. Parte conocida: ' + api.money(plan.knownMaterialCost) + '. No se calcula un margen confiable.') + '</p><small>No incluye mano de obra, energia ni gastos generales. Se descuenta la receta escalada por tandas; una sustitucion requiere otra version aprobada.</small>';
    } catch (e) { el('batchPreview').textContent = e.message; }
  }
  function persist(mode, input) {
    var actor = api.user(); if (!actor) return Promise.reject(new Error('Inicie sesion'));
    return api.db.then(function (db) { return new Promise(function (resolve, reject) {
      var tx = db.transaction(['bakeryBatches', 'recipes', 'products', 'inventoryMovements', 'auditLog', 'users'], 'readwrite');
      var stores = {}; ['bakeryBatches', 'recipes', 'products', 'inventoryMovements', 'auditLog', 'users'].forEach(function (s) { stores[s] = tx.objectStore(s); });
      var failure = '', result;
      function fail(e) { failure = e.message || String(e); tx.abort(); }
      var requests = [stores.users.get(actor.id), stores.bakeryBatches.get(input.id), stores.recipes.getAll(), stores.products.getAll()];
      var loaded = 0;
      requests.forEach(function (request) { request.onsuccess = function () {
        if (++loaded !== requests.length) return;
        try {
          var user = requests[0].result, existing = requests[1].result, allRecipes = requests[2].result, stock = requests[3].result;
          if (!user || user.active === false) throw new Error('Usuario inactivo');
          var admin = user.role === 'admin' || user.role === 'dev', stamp = new Date().toISOString();
          if (mode === 'submit' && existing) { result = existing; return; }
          if (mode !== 'submit' && !admin) throw new Error('Solo administracion puede confirmar o rechazar');
          if (mode === 'confirm' && existing && existing.status === 'POSTED') { result = existing; return; }
          if (mode !== 'submit' && (!existing || existing.status !== 'PENDING')) throw new Error('Este registro ya no esta pendiente');
          var batch = mode === 'submit' ? Object.assign({}, input) : Object.assign({}, existing);
          if (mode === 'reject') {
            batch.status = 'REJECTED'; batch.reviewedAt = stamp; batch.reviewedBy = user.id;
          } else {
            var recipe = allRecipes.find(function (r) { return r.id === batch.recipeId; });
            if (!/^\d{4}-\d{2}-\d{2}$/.test(batch.date || '') || !Number.isFinite(Date.parse(batch.date + 'T12:00:00')) || batch.date > today()) throw new Error('Seleccione una fecha valida, no futura');
            var plan = window.BakeryProductionCore.plan(recipe, batch, stock);
            batch.recipeSnapshot = recipe; batch.expectedOutput = plan.expectedOutput;
            if (mode === 'submit') {
              batch.status = 'PENDING'; batch.createdAt = stamp; batch.createdBy = user.id; batch.createdByName = user.displayName || user.username;
            } else {
              plan.changes.forEach(function (change) {
                change.after.updatedAt = stamp; stores.products.put(change.after);
                stores.inventoryMovements.add({ id: api.uid(), type: change.quantity > 0 ? 'BAKERY_OUTPUT' : 'BAKERY_CONSUMPTION', productId: change.after.id, quantity: change.quantity, knownCostValue: change.knownCostValue, knownCostQuantity: change.knownCostQuantity, unknownCostQuantity: change.unknownCostQuantity, beforeState: change.before, afterState: change.after, referenceType: 'BAKERY_BATCH', referenceId: batch.id, createdAt: stamp, createdBy: user.id });
              });
              batch.status = 'POSTED'; batch.postedAt = stamp; batch.postedBy = user.id; batch.postedByName = user.displayName || user.username;
              batch.knownMaterialCost = plan.knownMaterialCost; batch.costComplete = plan.costComplete; batch.unitMaterialCost = plan.unitMaterialCost;
              batch.outputQuantity = plan.outputQuantity; batch.outputUnit = plan.outputUnit;
              batch.consumption = plan.changes.filter(function (c) { return c.quantity < 0; }).map(function (c) { return { productId: c.before.id, name: c.before.name, quantity: -c.quantity, unit: c.before.unitType || c.before.priceUnit || 'unidad', knownCost: -c.knownCostValue }; });
            }
          }
          stores.bakeryBatches.put(batch);
          stores.auditLog.add({ id: api.uid(), action: 'BAKERY_BATCH_' + batch.status, detail: batch.id + ' | ' + (batch.recipeSnapshot && batch.recipeSnapshot.name || ''), userId: user.id, username: user.username, createdAt: stamp, severity: batch.status === 'REJECTED' ? 'warning' : 'normal' });
          result = batch;
        } catch (error) { fail(error); }
      }; });
      tx.oncomplete = function () { api.saved(); api.invalidate(); resolve(result); };
      tx.onerror = function () { reject(new Error(failure || (tx.error && tx.error.message) || 'No se pudo guardar')); };
      tx.onabort = function () { reject(new Error(failure || 'Operacion cancelada')); };
    }); });
  }
  function perform(mode, input) {
    if (busy) return; busy = true; el('batchSubmit').disabled = true;
    el('batchMessage').textContent = 'Guardando...';
    return persist(mode, input).then(function () {
      if (mode === 'submit') { submissionId = api.uid(); el('batchForm').reset(); el('batchDate').value = today(); }
      el('batchMessage').textContent = mode === 'confirm' ? 'Produccion ingresada. Ingredientes y producto terminado actualizados.' : mode === 'reject' ? 'Registro rechazado. No se modifico el stock.' : 'Produccion enviada. Pendiente de confirmacion administrativa; todavia no modifica stock.';
      return render();
    }).catch(function (error) { el('batchMessage').textContent = error.message; }).finally(function () { busy = false; el('batchSubmit').disabled = false; });
  }
  function render() {
    var previous = el('batchRecipe').value;
    if (!submissionId) submissionId = api.uid();
    if (!el('batchDate').value) el('batchDate').value = today();
    return Promise.all([api.all('recipes'), api.all('products'), api.all('bakeryBatches')]).then(function (sets) {
      var latest = {}; sets[0].filter(function (r) { return r.status === 'APPROVED' && r.outputProductId; }).forEach(function (r) { var k = r.familyId || r.id; if (!latest[k] || latest[k].version < r.version) latest[k] = r; });
      recipes = Object.values(latest); products = sets[1];
      el('batchRecipe').innerHTML = '<option value="">Elegir receta</option>' + recipes.map(function (r) { return '<option value="' + api.escape(r.id) + '">' + api.escape(r.name) + ' · v' + r.version + '</option>'; }).join('');
      if (recipes.some(function (r) { return r.id === previous; })) el('batchRecipe').value = previous;
      var rows = sets[2].filter(function (b) { return api.isAdmin() || b.createdBy === api.user().id; }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
      el('batchHistory').innerHTML = rows.length ? rows.map(function (b) {
        var r = b.recipeSnapshot || {}, status = { PENDING: 'Pendiente de ingreso', POSTED: 'Ingresada al stock', REJECTED: 'Rechazada' }[b.status] || b.status;
        return '<article class="recipe-card"><strong>' + api.escape(r.name || 'Receta') + ' · ' + api.escape(status) + '</strong><p>' + api.escape(b.date) + ' · ' + api.escape(b.createdByName) + ' · ' + b.multiplier + ' tandas · ' + b.actualOutput + ' ' + api.escape(r.unit) + '</p><details><summary>Detalle del lote</summary><p>Receta v' + r.version + ' · Esperado ' + b.expectedOutput + ' ' + api.escape(r.unit) + '</p><p>' + api.escape(b.note || 'Sin observaciones') + '</p>' + (b.consumption || []).map(function (c) { return '<p>' + api.escape(c.name) + ': ' + c.quantity + ' ' + api.escape(c.unit) + '</p>'; }).join('') + (b.status === 'POSTED' ? '<p>Confirmado por ' + api.escape(b.postedByName) + '. Costo de ingredientes ' + (b.costComplete ? api.money(b.knownMaterialCost) : 'incompleto; parte conocida ' + api.money(b.knownMaterialCost)) + '</p>' : '') + '</details>' + (api.isAdmin() && b.status === 'PENDING' ? '<button type="button" data-batch-confirm="' + api.escape(b.id) + '">Confirmar ingreso al stock</button> <button type="button" data-batch-reject="' + api.escape(b.id) + '">Rechazar</button>' : '') + '</article>';
      }).join('') : '<p>Aun no hay produccion registrada.</p>';
      el('batchHistory').querySelectorAll('[data-batch-confirm]').forEach(function (b) { b.onclick = function () { if (confirm('Confirmar produccion y descontar los ingredientes de la receta?')) perform('confirm', { id: b.dataset.batchConfirm }); }; });
      el('batchHistory').querySelectorAll('[data-batch-reject]').forEach(function (b) { b.onclick = function () { if (confirm('Rechazar este registro sin modificar stock?')) perform('reject', { id: b.dataset.batchReject }); }; });
      preview(false);
    }).catch(function (e) { el('batchMessage').textContent = e.message; });
  }
  window.BakeryProduction = { render: render, configure: function (context) {
    api = context; el('batchForm').onsubmit = function (e) { e.preventDefault(); perform('submit', draft()); };
    el('batchRecipe').onchange = function () { preview(true); }; el('batchMultiplier').oninput = function () { preview(true); };
    el('batchActual').oninput = el('batchNote').oninput = function () { preview(false); };
  } };
})();
