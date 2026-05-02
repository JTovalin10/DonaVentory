import type { SKU } from "../types";
import { BASE_URL, getHeaders } from "../api-config";

const MAX_SIZE = 2500;

const cache = new Map<string, SKU>();                // LRU: sku_id → SKU
const queryGroups = new Map<string, Set<string>>();  // query → sku_ids
const skuToQueries = new Map<string, Set<string>>(); // sku_id → queries

function promote(id: string, sku: SKU): void {
    cache.delete(id);
    cache.set(id, sku);
}

function evictLRU(): void {
    const lruId = cache.keys().next().value as string | undefined;
    if (!lruId) return;

    // BFS: collect all groups connected to the LRU SKU and all SKUs within them
    const queriesToEvict = new Set<string>(skuToQueries.get(lruId) ?? []);
    const skusToEvict = new Set<string>([lruId]);

    for (const query of queriesToEvict) {
        for (const skuId of queryGroups.get(query) ?? []) {
            if (skusToEvict.has(skuId)) continue;
            skusToEvict.add(skuId);
            for (const q of skuToQueries.get(skuId) ?? []) {
                queriesToEvict.add(q);
            }
        }
    }

    for (const skuId of skusToEvict) {
        cache.delete(skuId);
        skuToQueries.delete(skuId);
    }
    for (const query of queriesToEvict) {
        queryGroups.delete(query);
    }
}

function insertGroup(results: SKU[], query: string): void {
    const incoming = results.filter(sku => !cache.has(sku.sku_id));
    if (incoming.length > MAX_SIZE) return; // result set too large to cache

    while (cache.size + incoming.length > MAX_SIZE) evictLRU();

    const group = new Set<string>();
    for (const sku of results) {
        if (cache.has(sku.sku_id)) {
            promote(sku.sku_id, sku);
        } else {
            cache.set(sku.sku_id, sku);
        }
        if (!skuToQueries.has(sku.sku_id)) skuToQueries.set(sku.sku_id, new Set());
        skuToQueries.get(sku.sku_id)!.add(query);
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
    const query = name.toLowerCase();
    const group = queryGroups.get(query);

    if (group) {
        const results: SKU[] = [];
        for (const skuId of group) {
            const sku = cache.get(skuId)!;
            results.push(sku);
            promote(skuId, sku);
        }
        return results;
    }

    // Compulsory miss — fetch from API
    const response = await fetch(`${BASE_URL}/skus?aggregation_level=SKU`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ name_like: name }),
    });

    if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
    }

    const json = await response.json();
    const results: SKU[] = json.data;
    insertGroup(results, query);
    return results;
}
