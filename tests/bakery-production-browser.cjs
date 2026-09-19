// Isolated browser/IndexedDB integration test; never connects to the POS data service.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = path.resolve(__dirname, '..');
(async () => {
  let browser;
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><html><body></body></html>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.BAKERY_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
    const section = html.slice(html.indexOf('<section id="tabElaboracion"'), html.indexOf('<section id="tabCaja"'));
    await page.setContent(section.replace('tab-page hidden', 'tab-page'));
    await page.addScriptTag({ path: path.join(base, 'bakery-production-core.js') });
    await page.addScriptTag({ path: path.join(base, 'bakery-production.js') });
    await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('bakery-test-only', 1);
        req.onupgradeneeded = () => ['bakeryBatches', 'recipes', 'products', 'inventoryMovements', 'auditLog', 'users'].forEach(s => req.result.createObjectStore(s, { keyPath: 'id' }));
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      });
      window.testDb = db; window.testActor = { id: 'employee', role: 'employee' };
      window.readTestStore = s => new Promise(resolve => { const req = db.transaction(s).objectStore(s).getAll(); req.onsuccess = () => resolve(req.result); });
      await new Promise(resolve => {
        const tx = db.transaction(['users', 'recipes', 'products'], 'readwrite');
        tx.objectStore('users').put({ id: 'employee', username: 'empleado', role: 'employee', active: true });
        tx.objectStore('users').put({ id: 'admin', username: 'admin', role: 'admin', active: true });
        tx.objectStore('recipes').put({ id: 'r', name: 'Pan de prueba', familyId: 'family', version: 1, status: 'APPROVED', outputProductId: 'bread', yield: 10, unit: 'unidad', ingredients: [{ productId: 'flour', name: 'Harina', quantity: 500, unit: 'g' }] });
        tx.objectStore('products').put({ id: 'flour', name: 'Harina', unitType: 'kg', stock: 5, knownCostQuantity: 5, knownCostValue: 5000 });
        tx.objectStore('products').put({ id: 'bread', name: 'Pan', unitType: 'unidad', stock: 0 }); tx.oncomplete = resolve;
      });
      BakeryProduction.configure({ db: Promise.resolve(db), all: window.readTestStore, isAdmin: () => testActor.role === 'admin', user: () => testActor, uid: () => crypto.randomUUID(), saved: () => {}, invalidate: () => {}, escape: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])), money: n => '$ ' + n });
      await BakeryProduction.render();
    });
    await page.locator('#batchRecipe').selectOption('r');
    await page.locator('#batchMultiplier').fill('2');
    await page.locator('#batchSubmit').click();
    await page.waitForFunction(() => document.getElementById('batchMessage').textContent.startsWith('Produccion enviada'));
    let data = await page.evaluate(async () => ({ batches: await readTestStore('bakeryBatches'), products: await readTestStore('products'), movements: await readTestStore('inventoryMovements') }));
    assert.equal(data.batches.length, 1); assert.equal(data.batches[0].status, 'PENDING');
    assert.equal(data.products.find(p => p.id === 'flour').stock, 5); assert.equal(data.movements.length, 0);
    assert.equal(await page.locator('[data-batch-confirm]').count(), 0);
    await page.evaluate(async () => {
      testActor = { id: 'admin', role: 'admin' };
      const stock = await readTestStore('products'), p = stock.find(p => p.id === 'flour'); p.stock = .2;
      await new Promise(resolve => { const tx = testDb.transaction('products', 'readwrite'); tx.objectStore('products').put(p); tx.oncomplete = resolve; });
      await BakeryProduction.render();
    });
    page.on('dialog', d => d.accept());
    await page.locator('[data-batch-confirm]').click();
    await page.waitForFunction(() => document.getElementById('batchMessage').textContent.includes('Stock insuficiente'));
    data = await page.evaluate(async () => ({ batches: await readTestStore('bakeryBatches'), movements: await readTestStore('inventoryMovements') }));
    assert.equal(data.batches[0].status, 'PENDING'); assert.equal(data.movements.length, 0);
    await page.evaluate(async () => {
      const p = (await readTestStore('products')).find(p => p.id === 'flour'); p.stock = 5;
      await new Promise(resolve => { const tx = testDb.transaction('products', 'readwrite'); tx.objectStore('products').put(p); tx.oncomplete = resolve; });
    });
    await page.locator('[data-batch-confirm]').click();
    await page.waitForFunction(() => document.getElementById('batchMessage').textContent.startsWith('Produccion ingresada'));
    data = await page.evaluate(async () => ({ batches: await readTestStore('bakeryBatches'), products: await readTestStore('products'), movements: await readTestStore('inventoryMovements'), audit: await readTestStore('auditLog') }));
    assert.equal(data.batches[0].status, 'POSTED'); assert.equal(data.batches[0].recipeSnapshot.version, 1);
    assert.equal(data.products.find(p => p.id === 'flour').stock, 4); assert.equal(data.products.find(p => p.id === 'bread').stock, 20);
    assert.equal(data.movements.length, 2); assert.equal(data.audit.length, 2);
    assert.equal(await page.locator('[data-batch-confirm]').count(), 0); assert.deepEqual(errors, []);
    console.log('PASS: employee submission, no early stock write, admin approval, insufficient-stock rollback, atomic stock/cost/movement/audit posting.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
