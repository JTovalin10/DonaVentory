import type { SKU } from "../types";
import { BASE_URL, getHeaders } from "../api-config";
import { LRUCache } from "../Cache/LRUCache";
import { fetchWithLog } from "../logger";

const cache = new LRUCache<string, SKU>(2500);           // sku_id → SKU
const queryGroups = new Map<string, Set<string>>();      // query → sku_ids

function insertGroup(results: SKU[], query: string): void {
    const uniqueIncoming = new Map<string, SKU>();
    for (const sku of results) {
        if (!cache.has(sku.sku_id)) {
            uniqueIncoming.set(sku.sku_id, sku);
        }
    }

    if (uniqueIncoming.size > 2500) return;

    for (const [id, sku] of uniqueIncoming) {
        cache.set(id, sku);
    }

    const group = new Set<string>();
    for (const sku of results) {
        group.add(sku.sku_id);
    }
    queryGroups.set(query, group);
}

export function getSKUById(id: string): SKU | undefined {
    return cache.get(id);
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
            if (!sku) { allFound = false; break; }
            results.push(sku);
        }

        if (allFound) return results;
        queryGroups.delete(query);
    }

    const response = await fetchWithLog(`${BASE_URL}/skus?aggregation_level=SKU`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ name_like: name }),
    });

    if (!response.ok) throw new Error(`Search failed: ${response.status}`);

    const json = await response.json();
    const results: SKU[] = json.data || [];
    insertGroup(results, query);
    return results;
}
