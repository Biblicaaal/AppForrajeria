# La Nueva Fe Panadería: operating model and implementation plan

Status: foundation implemented; the operational controls below remain planned unless explicitly listed here.
Implemented: separate bakery database/profile/snapshot directory/service port; legacy snapshot rejection; separate update branch with pilot updates disabled; recipes with ingredients, yield, preparation notes, immutable saved versions, audit events, admin editing and employee approved-recipe reading.
Also implemented: recipe output-product linkage, kg/g and litre/ml conversion, batch multiplier and actual output, employee submission, admin confirmation/rejection, atomic recipe-based consumption and finished-stock receipt, known-material-cost transfer, unknown-cost flags, production history and immutable recipe snapshots.
Not yet implemented: measured ingredient usage, batch reversals, separately measured waste/expiry, configurable approval thresholds, owner exception dashboard, and service-enforced employee permissions. This is a development pilot, not a finished bakery management system.
Branch: alternative-build. Existing POS records must be preserved.

## Decisions needed before connecting new operations

- Confirmed: separate bakery business and database.
- Confirmed: La Nueva Fe Panadería; on-site production plus purchased merchandise, including drinks and cakes, sold by unit or weight.
- For a separate business, use separate application identity, browser profile, database, backup directory, local-service port, and update channel. Do not launch the alternative application against the store's current data.

## Architecture findings

- app.js uses IndexedDB for operational records and a local PowerShell service for disk snapshots.
- Existing purchasing supports ingredient receipts and known/unknown inventory cost pools, but product roles and measurement compatibility must be added.
- saveProduction currently records manual productionItems. It does not implement recipe consumption and finished-goods output as a single transaction.
- Existing counts provide discrepancy review and known-cost loss accounting; extend these for ingredients, finished goods, and packaging.
- Permissions and audit records currently live in the browser application. They support operational accountability but are not tamper-resistant against someone with access to the browser database or local files.
- A Git branch alone does not isolate runtime data or updates.

## Spanish navigation

Caja / Hoy / Recetas / Produccion / Stock / Compras / Conteos / Cierres / Balance / Reportes / Administracion.
Developer diagnostics remain separate. Existing modules should only be hidden or retired after confirming bakery scope, without deleting historical records.

## First delivery: recipes and controlled production

### Recetas

- Searchable recipes entered by the owner's mother, with readable ingredient rows and step-by-step preparation.
- Name, version, draft/approved/archived status, finished product, expected yield and yield unit.
- Ingredients linked to stock items, quantities and compatible units; kg/g and l/ml conversions are explicit. Never convert weight to volume without a recorded conversion.
- Include packaging and nested preparations where needed. Prevent circular recipe dependencies.
- Scaling by batch multiplier or target output quantity, with original recipe preserved.
- Preparation steps, preparation time, rest/baking instructions, storage notes, and recorded allergen information. Missing information remains visibly incomplete; never invent safety instructions or shelf life.
- Show known material cost and cost coverage. Unknown ingredient cost blocks a reliable total-cost or margin claim. Labor, energy, and overhead are separate from ingredient costs.
- Employees use approved versions; designated recipe editors propose changes. Approval creates a new immutable version for future batches.

### Produccion

- Planned -> started -> submitted -> completed, with cancelled and needs-review states.
- Snapshot the approved recipe version, planned ingredients, expected output, and operator on each batch.
- Reserve ingredients when work is started; record actual consumption, usable yield, waste, and explanation for substitutions or differences.
- Finalize ingredient consumption, finished-stock receipt, costing, inventory movements, and batch status in one database transaction. Retrying must not double-post stock.
- Reject insufficient stock or incompatible units; route exceptions to an authorized supervisor.
- Transfer known material cost into finished inventory without fabricating missing cost. Preserve unknown-cost coverage and avoid recording purchased ingredients as a second cash expense when used.
- Corrections use linked reversals; never silently rewrite a completed batch or historical recipe.
- Finished products sold later reduce the finished stock, not recipe ingredients a second time.
- Batch date and recorded expiry support traceability. Expiry values require a business-approved policy.

## Daily employee workflow

- One personal task list: opening checks, planned production, stock counts, waste recording, receiving, and closing checks.
- Individual accounts and explicit shift handover; no shared identity for accountable actions.
- Short forms, large quantities with visible units, decimal examples, duplicate-submission prevention, and a confirmation for unusually large values.
- Daily counts prioritize value, movement, time since last verification, and unresolved discrepancies. Consider blind counts for independent verification.
- Late tasks or differences are review signals, not automatic evidence of dishonesty or automatic financial penalties. Preserve employee explanations and reviewer decisions.

## Spending and cash controls

- Purchase request, approval, receipt, and payment are distinct events. Employee receiving cannot authorize arbitrary supplier payments.
- Configurable spending limits, duplicate invoice detection, receipt evidence, approved suppliers, and purchase-price variance review.
- Receive partial deliveries and reconcile quantities and invoice amounts. Link payments to their payable to prevent duplicate expenses.
- Discounts, refunds, voids, withdrawals, price overrides, and stock adjustments use explicit permissions and thresholds.
- Reconcile opening float + cash receipts - cash refunds - withdrawals against counted cash. Keep QR expected receipts and confirmed settlement distinct.
- Count cash before revealing expected cash when configured. Shift discrepancies require supervisor review without rewriting original entries.
- Waste needs quantity, product/batch, reason, operator, and review status; repeated exceptions appear in the owner's queue.

## Owner workload

- Hoy shows exceptions requiring a decision, ranked by amount and urgency, with direct actions and supporting records.
- Daily summary: sales, cash differences, purchases awaiting approval, production yield differences, shortages, waste, and overdue tasks.
- Replenishment suggestions combine planned recipes, available ingredients, supplier lead time, and existing orders. Suggestions do not place orders automatically.
- Demand planning starts with historical sales by weekday; avoid promising automated forecasting before enough bakery data exists.

## Reliability and deployment gates

- Establish an isolated bakery runtime before operational UI testing or real bakery data entry.
- Versioned incremental migrations, backup verification, restore tests, and a safe updater targeting the bakery branch/release channel.
- If stronger employee tamper resistance is required, move authentication, permissions, transaction validation, and audit enforcement to an authenticated local service backed by a transactional database. Browser-only role hiding is insufficient.
- Owner-controlled off-device backups are needed to survive disk loss; local snapshots alone are insufficient.
- Test complete purchasing -> recipe -> batch -> sale -> waste -> closure flows, including unknown costs, decimal units, duplicate clicks, interruptions, reversals, and concurrent changes.
- Start with a supervised pilot before depending on unattended operation.

## Delivery order

1. Confirm business separation, isolate runtime, define roles and permissions.
2. Recipe editor, versioning, ingredient/product types, unit validation, cost coverage.
3. Transactional production batches, yield and waste, stock movements and corrections.
4. Employee daily tasks, purchase approvals, shift handover and exception queue.
5. Owner summaries, replenishment planning, expiry/batch reporting, backup/restore validation.
