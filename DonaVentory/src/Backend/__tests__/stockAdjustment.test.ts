import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SKU } from '../types';

vi.mock('../logger', () => ({
  fetchWithLog: vi.fn(),
}));

vi.mock('../Suppliers', () => ({
  getAllSuppliers: vi.fn(),
}));

vi.mock('../api-config', () => ({
  BASE_URL: 'https://api.prediko.io/api/v1',
  getHeaders: () => ({ Authorization: 'Bearer test', 'Content-Type': 'application/json' }),
}));

// StockAdjustment re-exports prefillStockCache / searchAllStock from stockCache.
// Mock it so the import doesn't try to reach the real cache module.
vi.mock('../SKUs/stockCache', () => ({
  prefillStockCache: vi.fn(),
  searchFromStockCache: vi.fn(),
  clearStockCache: vi.fn(),
}));

import { calcDiff, adjustStockBatch } from '../StockAdjustment/index';
import { fetchWithLog } from '../logger';
import { getAllSuppliers } from '../Suppliers';
import { clearStockCache } from '../SKUs/stockCache';

const mockFetch = vi.mocked(fetchWithLog);
const mockSuppliers = vi.mocked(getAllSuppliers);
const mockClearStockCache = vi.mocked(clearStockCache);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSKU(stockLevel: number, overrides: Partial<SKU> = {}): SKU {
  return {
    sku_id: 'sku-1',
    sku_name: 'TEST-001',
    product_name: 'Test Product',
    supplier_name: 'Supplier A',
    sum_stock_level: stockLevel,
    unit_cost: 5.00,
    ...overrides,
  };
}

function okResponse(errors: string[] = []): Response {
  return {
    ok: true,
    json: () => Promise.resolve({
      errors,
      created_orders: [{ order_id: 'ord-1', order_name: 'adj' }],
      order_ids: ['ord-1'],
    }),
  } as unknown as Response;
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 4, 9, 10, 0, 0));
  mockSuppliers.mockResolvedValue([{ id: 's1', name: 'Supplier A', status: 'active', currency: 'USD' }]);
  mockFetch.mockResolvedValue(okResponse());
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ── calcDiff ──────────────────────────────────────────────────────────────────

describe('calcDiff', () => {
  it('returns a positive number when target is higher than current stock (restock)', () => {
    expect(calcDiff(makeSKU(100), 150)).toBe(50);
  });

  it('returns a negative number when target is lower than current stock (write-down)', () => {
    expect(calcDiff(makeSKU(100), 50)).toBe(-50);
  });

  it('returns 0 when target equals current stock (no-op)', () => {
    expect(calcDiff(makeSKU(100), 100)).toBe(0);
  });

  it('handles negative stock levels (Prediko can return negatives via BOM over-deduction)', () => {
    expect(calcDiff(makeSKU(-20), 50)).toBe(70);
    expect(calcDiff(makeSKU(-20), 0)).toBe(20);
    expect(calcDiff(makeSKU(-20), -10)).toBe(10);
  });

  it('handles zeroing out stock', () => {
    expect(calcDiff(makeSKU(200), 0)).toBe(-200);
  });

  it('handles starting from zero stock', () => {
    expect(calcDiff(makeSKU(0), 75)).toBe(75);
  });
});

// ── adjustStockBatch ──────────────────────────────────────────────────────────

describe('adjustStockBatch — payload construction', () => {
  it('sends a single POST (not the two-step flow used by production orders)', async () => {
    await adjustStockBatch([{ sku: makeSKU(100), targetAmount: 150 }], 'justin');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('uses FULLY_RECEIVED status directly', async () => {
    await adjustStockBatch([{ sku: makeSKU(100), targetAmount: 150 }], 'justin');

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.data[0].status).toBe('FULLY_RECEIVED');
  });

  it('uses FINISHED_GOOD order type (no BOM deduction)', async () => {
    await adjustStockBatch([{ sku: makeSKU(100), targetAmount: 150 }], 'justin');

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.data[0].order_type).toBe('FINISHED_GOOD');
  });

  it('sends targetAmount as quantity_ordered and quantity_received (FINISHED_GOOD sets absolute stock)', async () => {
    await adjustStockBatch([{ sku: makeSKU(100), targetAmount: 160 }], 'justin');

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    // Must be 160 (the target), NOT 60 (the diff). FINISHED_GOOD is absolute in Prediko.
    expect(body.data[0].quantity_ordered).toBe(160);
    expect(body.data[0].quantity_received).toBe(160);
  });

  it('sends targetAmount directly regardless of current stock level', async () => {
    // If we sent the diff instead of targetAmount, Prediko would set stock to the diff
    // value (e.g. 100 - 200 = -100) instead of the intended 100.
    await adjustStockBatch([{ sku: makeSKU(200), targetAmount: 100 }], 'justin');

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.data[0].quantity_ordered).toBe(100);
    expect(body.data[0].quantity_received).toBe(100);
  });

  it('normalizes firstName in the adjustment id', async () => {
    await adjustStockBatch([{ sku: makeSKU(100), targetAmount: 120 }], '  JUSTIN  ');

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.data[0].purchase_order_name).toMatch(/^justin update - /i);
  });
});

describe('adjustStockBatch — zero-diff filtering', () => {
  it('filters out items where target equals current stock', async () => {
    const items = [
      { sku: makeSKU(100),                              targetAmount: 100 }, // no change
      { sku: makeSKU(50, { sku_id: 'sku-2' }),          targetAmount: 80  }, // change
    ];

    await adjustStockBatch(items, 'justin');

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].quantity_ordered).toBe(80); // targetAmount, not diff
  });

  it('throws when every item has a zero diff (no-op batch)', async () => {
    const items = [
      { sku: makeSKU(100), targetAmount: 100 },
      { sku: makeSKU(50, { sku_id: 'sku-2' }), targetAmount: 50 },
    ];
    await expect(adjustStockBatch(items, 'justin')).rejects.toThrow('No stock changes to apply');
  });

  it('sends all items in a single batch (one POST regardless of item count)', async () => {
    const items = [
      { sku: makeSKU(10, { sku_id: 'sku-1' }), targetAmount: 20 },
      { sku: makeSKU(30, { sku_id: 'sku-2' }), targetAmount: 50 },
      { sku: makeSKU(5,  { sku_id: 'sku-3' }), targetAmount: 15 },
    ];

    await adjustStockBatch(items, 'justin');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.data).toHaveLength(3);
  });
});

describe('adjustStockBatch — error handling', () => {
  it('throws when the API returns business errors in errors[]', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        errors: ['SKU not recognized', 'Warehouse not found'],
        created_orders: [],
        order_ids: [],
      }),
    } as unknown as Response);

    await expect(
      adjustStockBatch([{ sku: makeSKU(100), targetAmount: 150 }], 'justin')
    ).rejects.toThrow('SKU not recognized');
  });

  it('throws when the HTTP response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as unknown as Response);

    await expect(
      adjustStockBatch([{ sku: makeSKU(100), targetAmount: 150 }], 'justin')
    ).rejects.toThrow('Order POST failed: 500');
  });

  it('does NOT clear the stock cache when the API call fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as unknown as Response);

    await expect(
      adjustStockBatch([{ sku: makeSKU(100), targetAmount: 150 }], 'justin')
    ).rejects.toThrow();

    expect(mockClearStockCache).not.toHaveBeenCalled();
  });
});

describe('adjustStockBatch — cache invalidation', () => {
  it('clears the stock cache after a successful adjustment', async () => {
    await adjustStockBatch([{ sku: makeSKU(100), targetAmount: 150 }], 'justin');
    expect(mockClearStockCache).toHaveBeenCalledOnce();
  });
});

// ── Contrast with production orders (no error checking) ───────────────────────
//
// This describes the asymmetry: adjustStockBatch checks errors[] but
// receiveProduction does not. Both flows write to the same Prediko inventory.
// The asymmetry means production order errors are silent and the books can drift.

describe('adjustStockBatch vs production orders — error handling asymmetry', () => {
  it('adjustStockBatch throws on API business errors (stock adjustment is safe)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ errors: ['some error'], created_orders: [], order_ids: [] }),
    } as unknown as Response);

    await expect(
      adjustStockBatch([{ sku: makeSKU(100), targetAmount: 150 }], 'justin')
    ).rejects.toThrow('some error');
  });

  // See orders.test.ts → "silent error bug" for the production order side.
  // Production orders swallow errors[], so the caller has no way to detect
  // a failed inventory write — this is the root cause of skewed books.
});

// ── Diagnostic: log exact Prediko payload for a books adjustment ──────────────
// Run `npm test` and look for the "PREDIKO PAYLOAD" block below.
// This shows exactly what sku name, quantity, and order_type is sent to the API.

describe('DIAGNOSTIC — books stock adjustment payload', () => {
  it('logs the exact payload sent to Prediko for a books adjustment', async () => {
    const booksSKU: SKU = {
      sku_id: 'books-finished-good-id',
      sku_name: 'BOOK',           // ← change this to the real sku_name from Prediko
      product_name: 'Book',
      supplier_name: 'Supplier A',
      sum_stock_level: 16,        // ← what Prediko currently shows
      unit_cost: 5,
    };

    await adjustStockBatch([{ sku: booksSKU, targetAmount: 100 }], 'justin');

    const payload = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);

    console.log('\n════════════════════════════════════════');
    console.log('  PREDIKO PAYLOAD — books adjustment');
    console.log('════════════════════════════════════════');
    console.log(JSON.stringify(payload, null, 2));
    console.log('════════════════════════════════════════\n');

    // The sku field must match the finished-good SKU name in Prediko exactly.
    // If it shows a raw material name (e.g. "RAW_BOOK") the wrong stock gets adjusted.
    console.log('  sku sent to Prediko:', payload.data[0].sku);
    console.log('  quantity_ordered:   ', payload.data[0].quantity_ordered);
    console.log('  quantity_received:  ', payload.data[0].quantity_received);
    console.log('  order_type:         ', payload.data[0].order_type);
    console.log('  status:             ', payload.data[0].status);

    expect(payload.data[0].order_type).toBe('FINISHED_GOOD');
    expect(payload.data[0].quantity_ordered).toBe(100);
    expect(payload.data[0].quantity_received).toBe(100);
  });
});
