import type { SKU } from "../types";
import { BASE_URL, getHeaders } from "../api-config";

const MAX_SIZE = 2500;

const cache = new Map<string, SKU>();                // LRU: sku_id → SKU
const queryGroups = new Map<string, Set<string>>();  // query → sku_ids

function promote(id: string, sku: SKU): void {
    cache.delete(id);
    cache.set(id, sku);
}

function evictLRU(): void {
    const lruId = cache.keys().next().value as string | undefined;
    if (lruId) {
        cache.delete(lruId);
    }
}

function insertGroup(results: SKU[], query: string): void {
    // Deduplicate by sku_id for accurate size tracking
    const uniqueIncoming = new Map<string, SKU>();
    for (const sku of results) {
        if (!cache.has(sku.sku_id)) {
            uniqueIncoming.set(sku.sku_id, sku);
        }
    }

    if (uniqueIncoming.size > MAX_SIZE) return; // Result set too large

    while (cache.size + uniqueIncoming.size > MAX_SIZE) {
        evictLRU();
    }

    const group = new Set<string>();
    for (const sku of results) {
        if (cache.has(sku.sku_id)) {
            promote(sku.sku_id, sku);
        } else {
            cache.set(sku.sku_id, sku);
        }
        group.add(sku.sku_id);
    }
    queryGroups.set(query, group);
}

export function getSKUById(id: string): SKU | undefined {
    const sku = cache.get(id);
    if (sku) promote(id, sku);
    return sku;
}

export async function searchFromCache(name: string): Promise<SKU[]> {
    const query = name.toLowerCase().trim();
    if (!query) return [];

    const group = queryGroups.get(query);

    if (group) {
        const results: SKU[] = [];
        let allFound = true;
        for (const skuId of group) {
            const sku = cache.get(skuId);
            if (!sku) {
                allFound = false;
                break;
            }
            results.push(sku);
        }

        if (allFound) {
            // Promote all hits
            for (const skuId of group) {
                promote(skuId, cache.get(skuId)!);
            }
            return results;
        } else {
            // Partial hit: invalidate the group and fetch fresh
            queryGroups.delete(query);
        }
    }

    // Compulsory miss or partial hit — fetch from API
    const response = await fetch(`${BASE_URL}/skus?aggregation_level=SKU`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ name_like: name }),
    });

    if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
    }

    const json = await response.json();
    const results: SKU[] = json.data || [];
    insertGroup(results, query);
    return results;
}
