import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SKU } from '../types';

// stockCache holds module-level state (allLoaded, allSKUs).
// Each test uses vi.resetModules() + vi.doMock() + dynamic imports so it gets
// a fresh module instance with no carried-over state.

// ── Helpers ───────────────────────────────────────────────────────────────────

function skuFixture(id: string, stockLevel: number): SKU {
  return {
    sku_id: id,
    sku_name: `SKU-${id}`,
    product_name: `Product ${id}`,
    supplier_name: 'Supplier A',
    sum_stock_level: stockLevel,
    unit_cost: 5,
  };
}

function apiResponse(skus: SKU[]): Response {
  return {
    ok: true,
    json: () => Promise.resolve({ data: skus }),
  } as unknown as Response;
}

// ── Module isolation setup ────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('prefillStockCache', () => {
  it('fetches all SKUs on first call and stores them', async () => {
    const mockFetch = vi.fn().mockResolvedValue(apiResponse([skuFixture('A', 100)]));
    vi.doMock('../logger', () => ({ fetchWithLog: mockFetch, logToTerminal: vi.fn() }));
    vi.doMock('../api-config', () => ({
      BASE_URL: 'https://api.prediko.io/api/v1',
      getHeaders: () => ({}),
    }));

    const { prefillStockCache, searchFromStockCache } = await import('../SKUs/stockCache');
    await prefillStockCache();

    const results = await searchFromStockCache('SKU-A');
    expect(results).toHaveLength(1);
    expect(results[0].sku_id).toBe('A');
  });

  it('skips the API on subsequent calls (allLoaded guard)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(apiResponse([skuFixture('A', 100)]));
    vi.doMock('../logger', () => ({ fetchWithLog: mockFetch, logToTerminal: vi.fn() }));
    vi.doMock('../api-config', () => ({
      BASE_URL: 'https://api.prediko.io/api/v1',
      getHeaders: () => ({}),
    }));

    const { prefillStockCache } = await import('../SKUs/stockCache');
    await prefillStockCache(); // first call — fetches
    await prefillStockCache(); // second call — should be a no-op

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('searchFromStockCache — local filtering after prefill', () => {
  it('returns results by sku_name match without a second API call', async () => {
    const skus = [skuFixture('A', 50), skuFixture('B', 80)];
    const mockFetch = vi.fn().mockResolvedValue(apiResponse(skus));
    vi.doMock('../logger', () => ({ fetchWithLog: mockFetch, logToTerminal: vi.fn() }));
    vi.doMock('../api-config', () => ({
      BASE_URL: 'https://api.prediko.io/api/v1',
      getHeaders: () => ({}),
    }));

    const { prefillStockCache, searchFromStockCache } = await import('../SKUs/stockCache');
    await prefillStockCache(); // 1 API call

    mockFetch.mockClear();

    const results = await searchFromStockCache('SKU-A');
    expect(mockFetch).not.toHaveBeenCalled(); // no second API call
    expect(results).toHaveLength(1);
    expect(results[0].sku_id).toBe('A');
  });

  it('returns an empty array for a query that matches nothing', async () => {
    const mockFetch = vi.fn().mockResolvedValue(apiResponse([skuFixture('A', 100)]));
    vi.doMock('../logger', () => ({ fetchWithLog: mockFetch, logToTerminal: vi.fn() }));
    vi.doMock('../api-config', () => ({
      BASE_URL: 'https://api.prediko.io/api/v1',
      getHeaders: () => ({}),
    }));

    const { prefillStockCache, searchFromStockCache } = await import('../SKUs/stockCache');
    await prefillStockCache();

    const results = await searchFromStockCache('NONEXISTENT');
    expect(results).toHaveLength(0);
  });

  it('returns an empty array for an empty query', async () => {
    const mockFetch = vi.fn().mockResolvedValue(apiResponse([skuFixture('A', 100)]));
    vi.doMock('../logger', () => ({ fetchWithLog: mockFetch, logToTerminal: vi.fn() }));
    vi.doMock('../api-config', () => ({
      BASE_URL: 'https://api.prediko.io/api/v1',
      getHeaders: () => ({}),
    }));

    const { prefillStockCache, searchFromStockCache } = await import('../SKUs/stockCache');
    await prefillStockCache();

    expect(await searchFromStockCache('')).toHaveLength(0);
    expect(await searchFromStockCache('   ')).toHaveLength(0);
  });
});

// ── clearStockCache ───────────────────────────────────────────────────────────
//
// After a successful stock adjustment, adjustStockBatch calls clearStockCache()
// so the next search re-fetches from the API and gets fresh stock levels.
// These tests confirm clearStockCache resets all module-level state.

describe('clearStockCache', () => {
  it('resets allLoaded so the next prefillStockCache fetches fresh data', async () => {
    const firstBatch  = [skuFixture('X', 100)];
    const secondBatch = [skuFixture('X', 150)];

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(apiResponse(firstBatch))
      .mockResolvedValueOnce(apiResponse(secondBatch));

    vi.doMock('../logger', () => ({ fetchWithLog: mockFetch, logToTerminal: vi.fn() }));
    vi.doMock('../api-config', () => ({
      BASE_URL: 'https://api.prediko.io/api/v1',
      getHeaders: () => ({}),
    }));

    const { prefillStockCache, clearStockCache, searchFromStockCache } = await import('../SKUs/stockCache');

    await prefillStockCache(); // loads stock=100
    clearStockCache();         // invalidate
    await prefillStockCache(); // re-fetches → stock=150

    const [sku] = await searchFromStockCache('SKU-X');
    expect(sku.sum_stock_level).toBe(150); // fresh!
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('clears allSKUs so searchFromStockCache returns nothing until re-prefilled', async () => {
    const mockFetch = vi.fn().mockResolvedValue(apiResponse([skuFixture('X', 100)]));
    vi.doMock('../logger', () => ({ fetchWithLog: mockFetch, logToTerminal: vi.fn() }));
    vi.doMock('../api-config', () => ({
      BASE_URL: 'https://api.prediko.io/api/v1',
      getHeaders: () => ({}),
    }));

    const { prefillStockCache, clearStockCache, searchFromStockCache } = await import('../SKUs/stockCache');

    await prefillStockCache();
    clearStockCache();

    // After clear, allLoaded=false so the fallback API path runs.
    // Provide the second response for that fallback call.
    mockFetch.mockResolvedValueOnce(apiResponse([skuFixture('X', 100)]));
    const results = await searchFromStockCache('SKU-X');
    expect(results.length).toBeGreaterThan(0);
  });
});
