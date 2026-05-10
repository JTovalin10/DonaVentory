import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LRUCache } from '../Cache/LRUCache';
import { TTLCache } from '../Cache/TTLCache';

// ── LRUCache ──────────────────────────────────────────────────────────────────

describe('LRUCache — basic operations', () => {
  let cache: LRUCache<string, number>;

  beforeEach(() => {
    cache = new LRUCache<string, number>(3);
  });

  it('stores and retrieves a value', () => {
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('returns undefined for a missing key', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('has() is true for present keys and false for absent', () => {
    cache.set('a', 1);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('delete() removes an entry', () => {
    cache.set('a', 1);
    cache.delete('a');
    expect(cache.has('a')).toBe(false);
    expect(cache.get('a')).toBeUndefined();
  });

  it('size reflects the current number of stored items', () => {
    expect(cache.size).toBe(0);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
  });

  it('clear() empties the cache', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('set() on an existing key updates the value without growing size', () => {
    cache.set('a', 1);
    cache.set('a', 99);
    expect(cache.get('a')).toBe(99);
    expect(cache.size).toBe(1);
  });
});

describe('LRUCache — eviction and promotion', () => {
  it('evicts the least-recently-used entry when at capacity', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1); // LRU
    cache.set('b', 2);
    cache.set('c', 3); // full: [a=LRU, b, c=MRU]
    cache.set('d', 4); // evicts 'a'

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('get() promotes a key to MRU, protecting it from the next eviction', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1); // LRU
    cache.set('b', 2);
    cache.set('c', 3); // full: [a=LRU, b, c=MRU]

    cache.get('a'); // promote 'a': [b=LRU, c, a=MRU]

    cache.set('d', 4); // should evict 'b', not 'a'

    expect(cache.get('b')).toBeUndefined(); // evicted
    expect(cache.get('a')).toBe(1);         // protected
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('set() on an existing key promotes it to MRU', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1); // LRU
    cache.set('b', 2);
    cache.set('c', 3); // full: [a=LRU, b, c=MRU]

    cache.set('a', 11); // update 'a', moves to MRU: [b=LRU, c, a=MRU]
    cache.set('d', 4);  // evicts 'b'

    expect(cache.get('b')).toBeUndefined(); // evicted
    expect(cache.get('a')).toBe(11);        // updated and protected
  });

  it('does not grow beyond maxSize', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.size).toBe(2);
  });

  it('handles a cache of size 1 correctly', () => {
    const cache = new LRUCache<string, number>(1);
    cache.set('a', 1);
    cache.set('b', 2); // evicts 'a'

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.size).toBe(1);
  });
});

// ── TTLCache ──────────────────────────────────────────────────────────────────

describe('TTLCache — basic operations', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves a value before expiry', () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string, number>(1000);
    cache.set('a', 42);
    expect(cache.get('a')).toBe(42);
  });

  it('delete() removes an item', () => {
    const cache = new TTLCache<string, number>(5000);
    cache.set('a', 1);
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
  });

  it('clear() empties all entries', () => {
    const cache = new TTLCache<string, number>(5000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

describe('TTLCache — TTL expiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined after TTL expires', () => {
    const cache = new TTLCache<string, number>(1000);
    cache.set('a', 42);
    vi.advanceTimersByTime(1001);
    expect(cache.get('a')).toBeUndefined();
  });

  it('returns the value right before the TTL boundary', () => {
    const cache = new TTLCache<string, number>(1000);
    cache.set('a', 42);
    vi.advanceTimersByTime(999);
    expect(cache.get('a')).toBe(42);
  });

  it('has() returns false for expired items', () => {
    const cache = new TTLCache<string, number>(500);
    cache.set('a', 42);
    vi.advanceTimersByTime(501);
    expect(cache.has('a')).toBe(false);
  });

  it('has() returns true for items within TTL', () => {
    const cache = new TTLCache<string, number>(1000);
    cache.set('a', 42);
    vi.advanceTimersByTime(999);
    expect(cache.has('a')).toBe(true);
  });

  it('different items can expire independently', () => {
    const cache = new TTLCache<string, number>(5000);
    cache.set('short', 1);
    vi.advanceTimersByTime(500);
    // Re-set 'short' with fresh TTL
    const freshCache = new TTLCache<string, number>(5000);
    freshCache.set('long', 99);
    vi.advanceTimersByTime(5001);
    expect(freshCache.get('long')).toBeUndefined();
  });
});
