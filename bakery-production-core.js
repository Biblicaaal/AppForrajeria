(function (root) {
  'use strict';
  var units = { kg: ['mass', 1], g: ['mass', .001], gr: ['mass', .001], litro: ['volume', 1], lt: ['volume', 1], l: ['volume', 1], ml: ['volume', .001], unidad: ['count', 1] };
  function unit(value) { return String(value || 'unidad').toLowerCase(); }
  function round(n) { return Math.round(n * 1000000) / 1000000; }
  function positive(value, name) { var n = Number(value); if (!Number.isFinite(n) || n <= 0) throw new Error(name + ': ingrese una cantidad mayor a cero'); return n; }
  function convert(value, from, to) {
    var a = units[unit(from)], b = units[unit(to)];
    if (!a || !b || a[0] !== b[0]) throw new Error('Unidades incompatibles: ' + from + ' / ' + to);
    var converted = round(positive(value, 'Cantidad') * a[1] / b[1]);
    if (!Number.isFinite(converted) || converted <= 0) throw new Error('Cantidad fuera de precision permitida');
    return converted;
  }
  function pools(p) {
    var stock = Math.max(0, Number(p.stock || 0)), rawKnown = Math.max(0, Number(p.knownCostQuantity || 0)), value = Math.max(0, Number(p.knownCostValue || 0));
    if (![stock, rawKnown, value].every(Number.isFinite)) throw new Error('Stock o costo invalido: ' + p.name);
    var known = value > 0 ? Math.min(stock, rawKnown) : 0;
    return { known: known, unknown: round(stock - known), value: rawKnown > 0 ? value * known / rawKnown : 0 };
  }
  function apply(p, pool) {
    p.knownCostQuantity = round(pool.known); p.unknownCostQuantity = round(pool.unknown); p.knownCostValue = round(pool.value);
    p.weightedAverageCostPerSaleUnit = pool.known > 0 ? round(pool.value / pool.known) : null;
    p.costCoveragePct = p.stock > 0 ? Math.min(100, pool.known / p.stock * 100) : 0;
    p.costState = pool.unknown > .000001 ? 'UNKNOWN' : pool.known > 0 ? 'KNOWN' : 'UNKNOWN';
    return p;
  }
  function plan(recipe, batch, products) {
    if (!recipe || recipe.status !== 'APPROVED') throw new Error('Seleccione una receta aprobada');
    var output = products.find(function (p) { return p.id === recipe.outputProductId && p.active !== false; });
    if (!output) throw new Error('La receta necesita un producto terminado activo');
    if (!Number.isFinite(Number(output.stock || 0)) || Number(output.stock || 0) < 0) throw new Error('Revise el stock del producto terminado');
    var multiplier = positive(batch.multiplier, 'Tandas'), actual = positive(batch.actualOutput, 'Produccion obtenida');
    var expected = positive(recipe.yield, 'Rendimiento') * multiplier;
    if (Math.abs(actual - expected) > .000001 && !String(batch.note || '').trim()) throw new Error('Explique la diferencia de rendimiento');
    var outputUnit = output.unitType || output.priceUnit || 'unidad', received = convert(actual, recipe.unit, outputUnit);
    if (unit(outputUnit) === 'unidad' && !Number.isInteger(received)) throw new Error('El producto terminado requiere unidades enteras');
    if (!recipe.ingredients || !recipe.ingredients.length) throw new Error('La receta no tiene ingredientes');
    var requirements = {};
    recipe.ingredients.forEach(function (line) {
      var p = products.find(function (candidate) { return candidate.id === line.productId && candidate.active !== false; });
      if (!p) throw new Error('Ingrediente inactivo o inexistente: ' + line.name);
      if (p.id === output.id) throw new Error('El producto terminado no puede ser ingrediente de si mismo');
      var amount = convert(positive(line.quantity, 'Ingrediente') * multiplier, line.unit, p.unitType || p.priceUnit || 'unidad');
      requirements[p.id] = round((requirements[p.id] || 0) + amount);
    });
    var changes = [], knownCost = 0, completeCost = true;
    Object.keys(requirements).forEach(function (id) {
      var original = products.find(function (p) { return p.id === id; }), quantity = requirements[id];
      if (unit(original.unitType || original.priceUnit) === 'unidad' && !Number.isInteger(quantity)) throw new Error('Ingrediente por unidad requiere cantidades enteras: ' + original.name);
      if (!Number.isFinite(Number(original.stock)) || Number(original.stock) + .0000001 < quantity) throw new Error('Stock insuficiente: ' + original.name);
      var pool = pools(original), unknownUsed = Math.min(quantity, pool.unknown), knownUsed = Math.min(pool.known, quantity - unknownUsed);
      var cost = pool.known > 0 ? pool.value / pool.known * knownUsed : 0;
      knownCost += cost; if (unknownUsed > .0000001) completeCost = false;
      var next = Object.assign({}, original, { stock: round(Number(original.stock) - quantity) });
      apply(next, { known: pool.known - knownUsed, unknown: pool.unknown - unknownUsed, value: pool.value - cost });
      changes.push({ before: original, after: next, quantity: -quantity, knownCostValue: -cost, knownCostQuantity: -knownUsed, unknownCostQuantity: -unknownUsed });
    });
    var outputPool = pools(output), nextOutput = Object.assign({}, output, { stock: round(Number(output.stock || 0) + received) });
    if (completeCost) { outputPool.known += received; outputPool.value += knownCost; } else outputPool.unknown += received;
    apply(nextOutput, outputPool);
    changes.push({ before: output, after: nextOutput, quantity: received, knownCostValue: completeCost ? knownCost : 0, knownCostQuantity: completeCost ? received : 0, unknownCostQuantity: completeCost ? 0 : received });
    return { changes: changes, outputQuantity: received, outputUnit: outputUnit, expectedOutput: expected, knownMaterialCost: round(knownCost), costComplete: completeCost, unitMaterialCost: completeCost ? round(knownCost / received) : null };
  }
  var api = { convert: convert, plan: plan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BakeryProductionCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
