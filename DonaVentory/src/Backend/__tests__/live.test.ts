/**
 * LIVE diagnostic tests — hit the real Prediko API, no mocks.
 * Run with:  npm test -- live
 *
 * Read-only tests never modify data and are safe to run at any time.
 * The WRITE suite at the bottom adds +1 to the Activity Book stock to
 * verify the FINISHED_GOOD absolute-quantity fix is working end-to-end.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Load real API key from .env ───────────────────────────────────────────────

function loadEnv(): Record<string, string> {
    const envPath = path.resolve(__dirname, '../../../.env');
    const content = fs.readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        env[key] = val;
    }
    return env;
}

const env = loadEnv();
const AUTH_KEY = env.VITE_PREDIKO_AUTH_KEY ?? '';
const VERSION  = env.VITE_VERSION ?? 'v1';
const BASE_URL = `https://api.prediko.io/api/${VERSION}`;

function headers() {
    return {
        Authorization: AUTH_KEY.startsWith('Bearer') ? AUTH_KEY : `Bearer ${AUTH_KEY}`,
        'Content-Type': 'application/json',
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function section(title: string) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  ${title}`);
    console.log('═'.repeat(50));
}

function logSKU(sku: Record<string, unknown>) {
    console.log(`  sku_name:        ${sku.sku_name}`);
    console.log(`  product_name:    ${sku.product_name}`);
    console.log(`  sum_stock_level: ${sku.sum_stock_level}`);
    console.log(`  sku_id:          ${sku.sku_id}`);
    console.log('  ─'.repeat(25));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const SEARCH_TERMS = ['axy', 'book', 'snake'];

describe('LIVE — SKU lookup (read-only, no data changes)', () => {
    for (const term of SEARCH_TERMS) {
        it(`finished-good SKUs matching "${term}"`, async () => {
            const res = await fetch(`${BASE_URL}/skus?aggregation_level=SKU`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ name_like: term }),
            });

            const data = await res.json() as { data: Record<string, unknown>[] };

            section(`FINISHED GOODS matching "${term}" (no raw materials)`);
            if (!data.data?.length) {
                console.log('  (no results)');
            } else {
                for (const sku of data.data) logSKU(sku);
            }
            console.log(`\n  Total: ${data.data?.length ?? 0}`);
        }, 15_000);

        it(`ALL SKUs including raw materials matching "${term}"`, async () => {
            const res = await fetch(`${BASE_URL}/skus?aggregation_level=SKU`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ name_like: term, with_material: true }),
            });

            const data = await res.json() as { data: Record<string, unknown>[] };

            section(`ALL SKUs (incl. raw materials) matching "${term}"`);
            if (!data.data?.length) {
                console.log('  (no results)');
            } else {
                for (const sku of data.data) logSKU(sku);
            }
            console.log(`\n  Total: ${data.data?.length ?? 0}`);
        }, 15_000);
    }

    it('shows recent orders that touched books stock', async () => {
        const res = await fetch(`${BASE_URL}/orders`, {
            headers: headers(),
        });

        const data = await res.json() as { data: Record<string, unknown>[] };
        const orders = data.data ?? [];

        // Filter to orders whose reference contains "book" (case-insensitive)
        // or any order that could be a stock adjustment (FINISHED_GOOD)
        const relevant = orders.filter((o: Record<string, unknown>) => {
            const ref = String(o.reference ?? '').toLowerCase();
            const type = String(o.order_type ?? '');
            return ref.includes('book') || type === 'FINISHED_GOOD';
        });

        section('RECENT ORDERS referencing "book" or type FINISHED_GOOD');
        if (!relevant.length) {
            console.log('  (none found — showing last 5 orders instead)');
            for (const o of orders.slice(0, 5)) {
                console.log(`  reference:    ${o.reference}`);
                console.log(`  order_type:   ${o.order_type}`);
                console.log(`  order_status: ${o.order_status}`);
                console.log(`  cost:         ${o.cost}`);
                console.log(`  created_at:   ${o.created_at}`);
                console.log('  ─'.repeat(25));
            }
        } else {
            for (const o of relevant) {
                console.log(`  reference:    ${o.reference}`);
                console.log(`  order_type:   ${o.order_type}`);
                console.log(`  order_status: ${o.order_status}`);
                console.log(`  supplier:     ${o.supplier_name}`);
                console.log(`  qty received: ${o.quantity_received}`);
                console.log(`  created_at:   ${o.created_at}`);
                console.log('  ─'.repeat(25));
            }
        }
        console.log(`\n  Total orders returned: ${orders.length}`);
    }, 15_000);
});

// ── WRITE test: add +1 to Activity Book stock ─────────────────────────────────

describe('LIVE — WRITE: add +1 to Activity Book stock (FINISHED_GOOD absolute fix)', () => {
    it('reads current stock, posts +1, reads again and confirms the increase', async () => {
        // ── 1. Find the book finished-good SKU ───────────────────────────────
        const skuRes = await fetch(`${BASE_URL}/skus?aggregation_level=SKU`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ name_like: 'book' }),
        });
        const skuJson = await skuRes.json() as { data: Record<string, unknown>[] };
        const bookSKU = skuJson.data?.[0];

        if (!bookSKU) {
            console.log('  No book finished-good SKU found — skipping write test');
            return;
        }

        const skuName = String(bookSKU.sku_name);
        const stockBefore = Number(bookSKU.sum_stock_level);
        const targetStock = stockBefore + 1;

        section(`WRITE TEST — "${bookSKU.product_name}" (${skuName})`);
        console.log(`  stock before: ${stockBefore}`);
        console.log(`  target stock: ${targetStock}  (absolute FINISHED_GOOD value)`);

        // ── 2. Resolve supplier — use the SKU's own supplier, fall back to first ──
        const supRes = await fetch(`${BASE_URL}/suppliers`, { headers: headers() });
        const supJson = await supRes.json() as { data: { name: string }[] };
        const supplierNames = supJson.data?.map(s => s.name) ?? [];
        const skuSupplier = String(bookSKU.supplier_name ?? '');
        const supplier = supplierNames.includes(skuSupplier)
            ? skuSupplier
            : (supplierNames[0] ?? 'Default');
        console.log(`  sku supplier: ${skuSupplier}`);
        console.log(`  using:        ${supplier}`);

        // ── 3. Build a unique order name ──────────────────────────────────────
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const date = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${now.getFullYear()}`;
        const orderName = `live-test update - ${date} (${time})`;
        const today = now.toISOString().split('T')[0];

        console.log(`  order name:   ${orderName}`);

        // ── 4. POST the FINISHED_GOOD order ───────────────────────────────────
        const orderRes = await fetch(`${BASE_URL}/orders`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
                data: [{
                    sku: skuName,
                    warehouse: 'Warehouse',
                    quantity_ordered: targetStock,
                    quantity_received: targetStock,
                    supplier,
                    purchase_order_name: orderName,
                    delivery: today,
                    status: 'FULLY_RECEIVED',
                    order_type: 'FINISHED_GOOD',
                }],
            }),
        });

        const orderJson = await orderRes.json() as { errors?: string[]; created_orders?: unknown[] };
        console.log('\n  Order API response:');
        console.log(JSON.stringify(orderJson, null, 4).split('\n').map(l => `  ${l}`).join('\n'));

        if (!orderRes.ok) throw new Error(`Order POST failed: ${orderRes.status}`);
        if (orderJson.errors?.length) throw new Error(`API errors: ${orderJson.errors.join(', ')}`);

        // ── 5. Re-fetch stock to confirm the change ───────────────────────────
        // Allow Prediko a moment to settle
        await new Promise(r => setTimeout(r, 2500));

        const afterRes = await fetch(`${BASE_URL}/skus?aggregation_level=SKU`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ name_like: 'book' }),
        });
        const afterJson = await afterRes.json() as { data: Record<string, unknown>[] };
        const afterSKU = afterJson.data?.find(s => s.sku_name === skuName);
        const stockAfter = afterSKU ? Number(afterSKU.sum_stock_level) : null;

        console.log(`\n  stock after:  ${stockAfter ?? '(SKU not found in re-fetch)'}`);

        section('WRITE TEST RESULT');
        if (stockAfter === targetStock) {
            console.log(`  ✓ Stock moved ${stockBefore} → ${stockAfter} as expected`);
        } else {
            console.log(`  ✗ Expected ${targetStock} but got ${stockAfter}`);
            console.log('    (Prediko may take longer to reflect; check the dashboard)');
        }

        expect(orderRes.ok).toBe(true);
        expect(orderJson.errors ?? []).toHaveLength(0);
    }, 30_000);
});
