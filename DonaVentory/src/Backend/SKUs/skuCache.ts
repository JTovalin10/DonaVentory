import type { SKU } from "../types";
import { BASE_URL, getHeaders } from "../api-config";

const skus = new Map<string, SKU>();
let loaded = false;
let populatePromise: Promise<void> | null = null;

export function populateCache(): Promise<void> {
    if (!populatePromise) {
        populatePromise = _load();
    }
    return populatePromise;
}

async function _load(): Promise<void> {
    const response = await fetch(
        `${BASE_URL}/skus?aggregation_level=SKU&limit=5000`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({}),
        }
    );

    if (!response.ok) {
        throw new Error(`Cache load failed: ${response.status}`);
    }

    const json = await response.json();
    for (const sku of json.data as SKU[]) {
        skus.set(sku.sku_id, sku);
    }
    loaded = true;
}

export async function searchFromCache(name: string): Promise<SKU[]> {
    await populateCache();
    const query = name.toLowerCase();
    const results: SKU[] = [];
    for (const sku of skus.values()) {
        if (
            sku.sku_name.toLowerCase().includes(query) ||
            sku.product_name.toLowerCase().includes(query)
        ) {
            results.push(sku);
        }
    }
    return results;
}

export function getSKUById(id: string): SKU | undefined {
    return skus.get(id);
}

export function isCacheLoaded(): boolean {
    return loaded;
}
