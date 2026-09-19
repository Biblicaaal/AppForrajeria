const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../bakery-production-core');
function fixture() {
  return {
    recipe: { id: 'r', status: 'APPROVED', outputProductId: 'bread', yield: 10, unit: 'unidad', ingredients: [{ productId: 'flour', name: 'Harina', quantity: 500, unit: 'g' }] },
    batch: { multiplier: 2, actualOutput: 20 },
    products: [{ id: 'flour', name: 'Harina', unitType: 'kg', stock: 5, knownCostQuantity: 5, knownCostValue: 5000 }, { id: 'bread', name: 'Pan', unitType: 'unidad', stock: 0 }]
  };
}
test('grams and litres convert without converting mass to volume', () => {
  assert.equal(core.convert(500, 'g', 'kg'), .5);
  assert.equal(core.convert(250, 'ml', 'litro'), .25);
  assert.throws(() => core.convert(1, 'kg', 'litro'), /incompatibles/);
});
test('one kg consumed, twenty units produced, ingredient cost conserved', () => {
  const f = fixture(), before = structuredClone(f.products), p = core.plan(f.recipe, f.batch, f.products);
  assert.equal(p.changes[0].after.stock, 4); assert.equal(p.changes[1].after.stock, 20);
  assert.equal(p.knownMaterialCost, 1000); assert.equal(p.unitMaterialCost, 50);
  assert.equal(p.changes[0].after.knownCostValue + p.changes[1].after.knownCostValue, 5000);
  assert.deepEqual(f.products, before);
});
test('duplicate ingredient rows aggregate before stock validation', () => {
  const f = fixture(); f.recipe.ingredients.push({ productId: 'flour', quantity: 3000, unit: 'g' });
  assert.throws(() => core.plan(f.recipe, f.batch, f.products), /Stock insuficiente/);
});
test('unknown costs do not become a reliable finished cost', () => {
  const f = fixture(); f.products[0].knownCostQuantity = 4.5; f.products[0].knownCostValue = 4500;
  const p = core.plan(f.recipe, f.batch, f.products);
  assert.equal(p.costComplete, false); assert.equal(p.knownMaterialCost, 500); assert.equal(p.unitMaterialCost, null);
  assert.equal(p.changes[1].after.unknownCostQuantity, 20); assert.equal(p.changes[1].after.knownCostValue, 0);
});
test('yield differences require an explanation and whole items cannot be fractional', () => {
  const f = fixture(); f.batch.actualOutput = 19;
  assert.throws(() => core.plan(f.recipe, f.batch, f.products), /Explique/);
  f.batch.note = 'Una unidad descartada'; assert.equal(core.plan(f.recipe, f.batch, f.products).outputQuantity, 19);
  f.batch.actualOutput = 19.5; assert.throws(() => core.plan(f.recipe, f.batch, f.products), /enteras/);
});
test('inactive inputs, unapproved recipes, and self-consuming recipes fail', () => {
  const f = fixture(); f.recipe.status = 'DRAFT'; assert.throws(() => core.plan(f.recipe, f.batch, f.products), /aprobada/);
  f.recipe.status = 'APPROVED'; f.products[0].active = false; assert.throws(() => core.plan(f.recipe, f.batch, f.products), /inactivo/);
  f.products[0].active = true; f.recipe.outputProductId = 'flour'; assert.throws(() => core.plan(f.recipe, f.batch, f.products));
});
test('weighted output is received in kg from a recipe expressed in grams', () => {
  const f = fixture(); f.recipe.unit = 'g'; f.recipe.yield = 800; f.batch.actualOutput = 1600; f.products[1].unitType = 'kg';
  assert.equal(core.plan(f.recipe, f.batch, f.products).outputQuantity, 1.6);
});
