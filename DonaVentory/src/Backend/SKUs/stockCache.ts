import type { SKU } from "../types";
import { BASE_URL, getHeaders } from "../api-config";
import { LRUCache } from "../Cache/LRUCache";
import { fetchWithLog } from "../logger";

const cache = new LRUCache<string, SKU>(2500);
const queryGroups = new Map<string, Set<string>>();
let allSKUs: SKU[] = [];
let allLoaded = false;

// ── Prefill ────────────────────────────────────────────────────────────────────
// Called on page load — fetches every SKU + raw material once so all searches
// are instant client-side for the rest of the session.

export async function prefillStockCache(): Promise<void> {
    if (allLoaded) return;

    const response = await fetchWithLog(`${BASE_URL}/skus?aggregation_level=SKU`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ with_material: true }),
    });

    if (!response.ok) throw new Error(`Stock prefill failed: ${response.status}`);

    const json = await response.json();
    allSKUs = json.data ?? [];
    for (const sku of allSKUs) cache.set(sku.sku_id, sku);
    allLoaded = true;
}

// ── Search ─────────────────────────────────────────────────────────────────────

function insertGroup(results: SKU[], query: string): void {
    const uniqueIncoming = new Map<string, SKU>();
    for (const sku of results) {
        if (!cache.has(sku.sku_id)) uniqueIncoming.set(sku.sku_id, sku);
    }
    if (uniqueIncoming.size > 2500) return;
    for (const [id, sku] of uniqueIncoming) cache.set(id, sku);
    const group = new Set<string>();
    for (const sku of results) group.add(sku.sku_id);
    queryGroups.set(query, group);
}

export async function searchFromStockCache(name: string): Promise<SKU[]> {
    const query = name.toLowerCase().trim();
    if (!query) return [];

    // If prefilled, filter locally — no API call needed
    if (allLoaded) {
        return allSKUs.filter(s =>
            s.sku_name.toLowerCase().includes(query) ||
            s.product_name.toLowerCase().includes(query)
        );
    }

    // Fallback: query groups + API
    const group = queryGroups.get(query);
    if (group) {
        const results: SKU[] = [];
        let allFound = true;
        for (const id of group) {
            const sku = cache.get(id);
            if (!sku) { allFound = false; break; }
            results.push(sku);
        }
        if (allFound) return results;
        queryGroups.delete(query);
    }

    const response = await fetchWithLog(`${BASE_URL}/skus?aggregation_level=SKU`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ name_like: name, with_material: true }),
    });

    if (!response.ok) throw new Error(`Stock search failed: ${response.status}`);

    const json = await response.json();
    const results: SKU[] = json.data ?? [];
    insertGroup(results, query);
    return results;
}
