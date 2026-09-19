(function () {
  'use strict';
  var api, products = [], editing = null, busy = false;
  function el(id) { return document.getElementById(id); }
  function ingredientRow(line) {
    var row = document.createElement('div');
    row.className = 'recipe-ingredient';
    var select = document.createElement('select'); select.required = true;
    select.innerHTML = '<option value="">Elegir ingrediente</option>' + products.map(function (p) {
      return '<option value="' + api.escape(p.id) + '">' + api.escape(p.name) + ' (' + api.escape(p.unitType || p.priceUnit || 'unidad') + ')</option>';
    }).join('');
    select.value = line && line.productId || '';
    var measure = document.createElement('select'); measure.className = 'ingredient-unit'; measure.setAttribute('aria-label', 'Unidad del ingrediente');
    measure.innerHTML = ['kg', 'g', 'litro', 'ml', 'unidad'].map(function (u) { return '<option>' + u + '</option>'; }).join('');
    measure.value = line && line.unit || 'kg';
    var quantity = document.createElement('input'); quantity.type = 'number'; quantity.min = '0.001'; quantity.step = 'any'; quantity.required = true; quantity.placeholder = 'Cantidad por tanda'; quantity.setAttribute('aria-label', 'Cantidad del ingrediente');
    quantity.value = line ? line.quantity : '';
    var remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Quitar'; remove.onclick = function () { row.remove(); };
    row.append(select, quantity, measure, remove); el('recipeIngredients').appendChild(row);
  }
  function open(recipe) {
    if (!api.isAdmin()) return;
    editing = recipe || null; el('recipeForm').reset(); el('recipeIngredients').innerHTML = ''; el('recipeError').textContent = '';
    el('recipeName').value = recipe ? recipe.name : '';
    el('recipeOutput').innerHTML = '<option value="">Elegir producto terminado</option>' + products.map(function (p) { return '<option value="' + api.escape(p.id) + '">' + api.escape(p.name) + '</option>'; }).join('');
    el('recipeOutput').value = recipe ? recipe.outputProductId || '' : '';
    el('recipeYield').value = recipe ? recipe.yield : '';
    el('recipeUnit').value = recipe ? recipe.unit : 'unidad';
    el('recipeSteps').value = recipe ? recipe.steps : '';
    el('recipeNotes').value = recipe ? recipe.notes || '' : '';
    el('recipeStatus').value = 'DRAFT';
    (recipe ? recipe.ingredients : [null]).forEach(ingredientRow);
    el('recipeDialog').classList.remove('hidden');
  }
  function save(event) {
    event.preventDefault(); if (!api.isAdmin() || busy) return;
    var ingredients = Array.from(el('recipeIngredients').children).map(function (row) {
      var p = products.find(function (product) { return product.id === row.querySelector('select').value; });
      return { productId: p && p.id, name: p && p.name, unit: row.querySelector('.ingredient-unit').value, quantity: Number(row.querySelector('input').value) };
    });
    if (!ingredients.length || ingredients.some(function (i) { return !i.productId || !Number.isFinite(i.quantity) || i.quantity <= 0; })) { el('recipeError').textContent = 'Agregue ingredientes activos con cantidades mayores a cero.'; return; }
    var yieldValue = Number(el('recipeYield').value), name = el('recipeName').value.trim(), steps = el('recipeSteps').value.trim();
    if (!name || !steps || !Number.isFinite(yieldValue) || yieldValue <= 0) { el('recipeError').textContent = 'Complete nombre, rendimiento e instrucciones.'; return; }
    try {
      var output = products.find(function (p) { return p.id === el('recipeOutput').value; });
      if (!output) throw new Error('Seleccione el producto terminado');
      window.BakeryProductionCore.convert(yieldValue, el('recipeUnit').value, output.unitType || output.priceUnit || 'unidad');
      ingredients.forEach(function (i) {
        if (i.productId === output.id) throw new Error('El producto terminado no puede ser ingrediente');
        var p = products.find(function (p) { return p.id === i.productId; });
        window.BakeryProductionCore.convert(i.quantity, i.unit, p.unitType || p.priceUnit || 'unidad');
      });
    } catch (error) { el('recipeError').textContent = error.message; return; }
    busy = true;
    var user = api.user(), stamp = new Date().toISOString();
    var recipe = { id: api.uid(), familyId: editing ? editing.familyId || editing.id : api.uid(), name: name, yield: yieldValue, unit: el('recipeUnit').value, ingredients: ingredients, steps: steps, notes: el('recipeNotes').value.trim(), status: el('recipeStatus').value, createdAt: stamp, createdBy: user.id, createdByName: user.displayName || user.username };
    recipe.outputProductId = output.id; recipe.outputProductName = output.name;
    api.db.then(function (db) { return new Promise(function (resolve, reject) {
      var tx = db.transaction(['recipes', 'auditLog'], 'readwrite'), store = tx.objectStore('recipes');
      var request = store.getAll();
      request.onsuccess = function () {
        recipe.version = request.result.filter(function (r) { return (r.familyId || r.id) === recipe.familyId; }).reduce(function (n, r) { return Math.max(n, r.version || 1); }, 0) + 1;
        store.add(recipe);
        tx.objectStore('auditLog').add({ id: api.uid(), createdAt: stamp, userId: user.id, username: user.username, action: 'RECIPE_VERSION_SAVED', detail: recipe.name + ' v' + recipe.version + ' ' + recipe.status, severity: 'normal' });
      };
      tx.oncomplete = resolve; tx.onerror = function () { reject(tx.error); }; tx.onabort = function () { reject(tx.error || new Error('Guardado cancelado')); };
    }); }).then(function () { api.saved(); el('recipeDialog').classList.add('hidden'); return render(); }).catch(function (error) { el('recipeError').textContent = error.message; }).finally(function () { busy = false; });
  }
  function render() {
    el('recipeNew').hidden = !api.isAdmin();
    return Promise.all([api.all('recipes'), api.all('products')]).then(function (sets) {
      products = sets[1].filter(function (p) { return p.active !== false; });
      var latest = {};
      sets[0].filter(function (r) { return api.isAdmin() || r.status === 'APPROVED'; }).forEach(function (r) { var key = r.familyId || r.id; if (!latest[key] || latest[key].version < r.version) latest[key] = r; });
      var rows = Object.values(latest).sort(function (a, b) { return a.name.localeCompare(b.name); });
      el('recipeList').innerHTML = rows.length ? rows.map(function (r) {
        return '<article class="recipe-card"><h2>' + api.escape(r.name) + '</h2><p>Version ' + r.version + ' · ' + (r.status === 'APPROVED' ? 'Aprobada' : 'Borrador') + ' · Rinde ' + r.yield + ' ' + api.escape(r.unit) + '</p><ul>' + r.ingredients.map(function (i) { return '<li>' + api.escape(i.name) + ': ' + i.quantity + ' ' + api.escape(i.unit) + '</li>'; }).join('') + '</ul><h3>Preparacion</h3><p class="recipe-instructions">' + api.escape(r.steps) + '</p><p class="recipe-instructions">' + api.escape(r.notes || '') + '</p>' + (api.isAdmin() ? '<button type="button" data-recipe="' + api.escape(r.id) + '">Editar como nueva version</button>' : '') + '</article>';
      }).join('') : '<p>No hay recetas ' + (api.isAdmin() ? 'cargadas. Primero cargue los ingredientes en Stock.' : 'aprobadas todavia.') + '</p>';
      el('recipeList').querySelectorAll('[data-recipe]').forEach(function (button) { button.onclick = function () { open(rows.find(function (r) { return r.id === button.dataset.recipe; })); }; });
    }).catch(function (error) { el('recipeList').textContent = 'No se pudieron cargar las recetas: ' + error.message; });
  }
  window.BakeryRecipes = { render: render, configure: function (context) {
    api = context; el('recipeNew').onclick = function () { open(null); }; el('recipeAddIngredient').onclick = function () { ingredientRow(null); }; el('recipeClose').onclick = function () { if (!busy) el('recipeDialog').classList.add('hidden'); }; el('recipeForm').onsubmit = save;
  } };
})();
