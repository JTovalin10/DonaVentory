# Cache Design

## SKU Cache Redundancy

The cache stores SKU objects keyed by `sku_id`. Because search results are inserted per query, the same SKU object can exist under multiple search contexts — this is intentional redundancy.

**Example:**

- Search `"clyde"` → API returns only Clyde → `queryGroups["clyde"] = { clyde_id }`
- Search `"ghost"` → API returns Blinky, Pinky, Inky, Clyde → `queryGroups["ghost"] = { blinky_id, pinky_id, inky_id, clyde_id }`
- Clyde physically occupies **1 slot** in the LRU map but is referenced by both groups via `skuToQueries[clyde_id] = { "clyde", "ghost" }`

A prefix key (`"clyde"`) holds a singular result. A broader key (`"ghost"`) holds the superset. They are independent — a hit on `"ghost"` does not satisfy a lookup for `"clyde"`, and vice versa.

## Compulsory Miss

Every unique search query experiences a **compulsory miss** on first access. The flow for every search is:

1. Check `queryGroups` for the query key
2. If present → group is guaranteed complete → return all SKUs in the group
3. If absent → call API → cache the full result set as a group → return

## Ejection Policy

**Trade-off: Consistency over Speed**

The cache uses **LRU group eviction**. When the cache reaches `MAX_SIZE` (~1 MB / 2500 slots), the LRU SKU is identified and its **entire group is evicted** — never individual items.

Because we always evict whole groups, `queryGroups` only ever contains complete result sets. There is no need to track counts or validate completeness — if a key exists in `queryGroups`, its data is guaranteed to be fully present in the LRU cache.

If the LRU SKU belongs to multiple groups (e.g. Clyde is in both `"clyde"` and `"ghost"`), all connected groups and their SKUs are evicted together via BFS traversal. This ensures no group ever holds a reference to a SKU that was removed as a side effect of another group's eviction.

The cost is that more SKUs may be evicted than the minimum required — accepted as the price of consistency.

**Example:**

- `"ghost"` has 4 SKUs in cache (Blinky, Pinky, Inky, Clyde)
- LRU eviction triggers on Blinky
- All 4 ghost SKUs are evicted, `queryGroups["ghost"]` is cleared
- Clyde was also in `"clyde"` → `queryGroups["clyde"]` is also cleared
- Next search for `"ghost"` or `"clyde"` → compulsory miss → fresh API call
