import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SKU } from '../types';

// vi.mock calls are hoisted — dependencies are mocked before any imports execute.

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

import { receiveProduction, receiveBatchProduction } from '../Orders/index';
import { fetchWithLog } from '../logger';
import { getAllSuppliers } from '../Suppliers';

const mockFetch = vi.mocked(fetchWithLog);
const mockSuppliers = vi.mocked(getAllSuppliers);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSKU(overrides: Partial<SKU> = {}): SKU {
  return {
    sku_id: 'sku-1',
    sku_name: 'TEST-001',
    product_name: 'Test Product',
    supplier_name: 'Supplier A',
    sum_stock_level: 100,
    unit_cost: 5.00,
    ...overrides,
  };
}

function okResponse(errors: string[] = []): Response {
  return {
    ok: true,
    json: () => Promise.resolve({
      errors,
      created_orders: [{ order_id: 'ord-1', order_name: 'test' }],
      order_ids: ['ord-1'],
    }),
  } as unknown as Response;
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 4, 9, 14, 30, 0)); // default: 14:30:00, no collisions
  mockSuppliers.mockResolvedValue([{ id: 's1', name: 'Supplier A', status: 'active', currency: 'USD' }]);
  mockFetch.mockResolvedValue(okResponse());
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ── Order name uniqueness ─────────────────────────────────────────────────────
//
// generateIntakeId builds a time string with zero-padded components so that
// different wall-clock times always produce different strings.
// Prediko upserts orders by purchase_order_name — collisions would cause one
// order to overwrite another and skew inventory.

describe('Order name — zero-padded time prevents collisions', () => {
  it('produces different order names for 10:03:05 and 01:00:35', async () => {
    const sku = makeSKU();

    // 10:03:05 → "100305"
    vi.setSystemTime(new Date(2026, 4, 9, 10, 3, 5));
    await receiveProduction(sku, 10, 'justin');
    const body1 = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    const name1: string = body1.data[0].purchase_order_name;

    vi.clearAllMocks();
    mockSuppliers.mockResolvedValue([{ id: 's1', name: 'Supplier A', status: 'active', currency: 'USD' }]);
    mockFetch.mockResolvedValue(okResponse());

    // 01:00:35 → "010035" ← different
    vi.setSystemTime(new Date(2026, 4, 9, 1, 0, 35));
    await receiveProduction(sku, 20, 'justin');
    const body2 = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    const name2: string = body2.data[0].purchase_order_name;

    expect(name1).not.toBe(name2);
  });

  it('time string is always 9 digits (HHmmssSSS) with ms for uniqueness', async () => {
    vi.setSystemTime(new Date(2026, 4, 9, 1, 2, 3, 7)); // low values to expose padding gaps
    await receiveProduction(makeSKU(), 1, 'justin');

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    const name: string = body.data[0].purchase_order_name;
    // format: "justin - MM-DD-YYYY (HHmmssSSS)"
    const timeMatch = name.match(/\((\d+)\)$/);
    expect(timeMatch).not.toBeNull();
    expect(timeMatch![1]).toHaveLength(9);
  });
});

// ── Production order flow ─────────────────────────────────────────────────────

describe('receiveProduction — DRAFT → FULLY_RECEIVED flow', () => {
  it('sends exactly two POST requests per call', async () => {
    await receiveProduction(makeSKU(), 10, 'justin');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('first request is DRAFT with quantity_received = current stock + ordered amount (cumulative)', async () => {
    await receiveProduction(makeSKU(), 10, 'justin'); // sum_stock_level=100, amount=10 → cumulative=110

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.data[0].status).toBe('DRAFT');
    expect(body.data[0].quantity_received).toBe(110);
    expect(body.data[0].quantity_ordered).toBe(10);
  });

  it('second request is FULLY_RECEIVED with quantity_received = current stock + ordered amount (cumulative)', async () => {
    await receiveProduction(makeSKU(), 10, 'justin'); // sum_stock_level=100, amount=10 → cumulative=110

    const body = JSON.parse(mockFetch.mock.calls[1][1]!.body as string);
    expect(body.data[0].status).toBe('FULLY_RECEIVED');
    expect(body.data[0].quantity_received).toBe(110);
    expect(body.data[0].quantity_ordered).toBe(10);
  });

  it('uses PRODUCTION_ORDER type (triggers BOM deduction in Prediko)', async () => {
    await receiveProduction(makeSKU(), 5, 'justin');

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.data[0].order_type).toBe('PRODUCTION_ORDER');
  });

  it('both requests share the same purchase_order_name (required for upsert)', async () => {
    await receiveProduction(makeSKU(), 10, 'justin');

    const draftName = JSON.parse(mockFetch.mock.calls[0][1]!.body as string).data[0].purchase_order_name;
    const rcvdName  = JSON.parse(mockFetch.mock.calls[1][1]!.body as string).data[0].purchase_order_name;
    expect(draftName).toBe(rcvdName);
  });

  it('normalizes firstName: trims whitespace and lowercases', async () => {
    await receiveProduction(makeSKU(), 1, '  JUSTIN  ');

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.data[0].purchase_order_name).toMatch(/^justin - /);
  });

  it('uses the SKU supplier when it is in the known supplier list', async () => {
    const sku = makeSKU({ supplier_name: 'Supplier A' });
    await receiveProduction(sku, 1, 'justin');

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.data[0].supplier).toBe('Supplier A');
  });

  it('falls back to the first known supplier when SKU supplier is not in the list', async () => {
    mockSuppliers.mockResolvedValue([
      { id: 's1', name: 'Default Supplier', status: 'active', currency: 'USD' },
    ]);
    const sku = makeSKU({ supplier_name: 'Unknown Co' });
    await receiveProduction(sku, 1, 'justin');

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.data[0].supplier).toBe('Default Supplier');
  });
});

// ── Error checking on FULLY_RECEIVED response ─────────────────────────────────

describe('receiveProduction — errors[] on the FULLY_RECEIVED step', () => {
  it('throws when the API returns business errors in errors[]', async () => {
    mockFetch
      .mockResolvedValueOnce(okResponse([]))                   // DRAFT succeeds
      .mockResolvedValueOnce(okResponse(['SKU not found']));   // FULLY_RECEIVED has errors

    await expect(receiveProduction(makeSKU(), 10, 'justin')).rejects.toThrow('SKU not found');
  });

  it('does not throw when errors[] is empty', async () => {
    mockFetch
      .mockResolvedValueOnce(okResponse([]))
      .mockResolvedValueOnce(okResponse([]));

    await expect(receiveProduction(makeSKU(), 10, 'justin')).resolves.toBeDefined();
  });
});

// ── Batch production ──────────────────────────────────────────────────────────

describe('receiveBatchProduction', () => {
  it('sends all items in a single DRAFT + FULLY_RECEIVED pair (not one pair per item)', async () => {
    const items = [
      { sku: makeSKU({ sku_id: 'sku-1', sku_name: 'A' }), amount: 5 },
      { sku: makeSKU({ sku_id: 'sku-2', sku_name: 'B' }), amount: 10 },
    ];

    await receiveBatchProduction(items, 'justin');

    // Only 2 POSTs total, not 4 (one pair per item would be wrong)
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const draftBody = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(draftBody.data).toHaveLength(2);
    expect(draftBody.data[0].quantity_ordered).toBe(5);
    expect(draftBody.data[1].quantity_ordered).toBe(10);
  });

  it('all batch items share the same purchase_order_name', async () => {
    const items = [
      { sku: makeSKU({ sku_id: 'sku-1' }), amount: 5 },
      { sku: makeSKU({ sku_id: 'sku-2' }), amount: 10 },
    ];

    await receiveBatchProduction(items, 'justin');

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    const names: string[] = body.data.map((d: { purchase_order_name: string }) => d.purchase_order_name);
    expect(new Set(names).size).toBe(1);
  });

  it('DRAFT payload has quantity_received = current stock + ordered amount (cumulative per item)', async () => {
    const items = [
      { sku: makeSKU({ sku_id: 'sku-1' }), amount: 5 },  // sum_stock_level=100 → cumulative=105
      { sku: makeSKU({ sku_id: 'sku-2' }), amount: 10 }, // sum_stock_level=100 → cumulative=110
    ];

    await receiveBatchProduction(items, 'justin');

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.data[0].quantity_received).toBe(105);
    expect(body.data[1].quantity_received).toBe(110);
  });
});

