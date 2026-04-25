import type { BOMResponse, BOMEntry } from "../types";
import { BASE_URL, getHeaders } from "../apiConfig";

const bomAPI = `${BASE_URL}/bill-of-materials`;

/**
 * Fetches the Bill of Materials for a specific finished good SKU to retrieve its unit cost.
 */
export async function getBOM(skuName: string): Promise<BOMEntry | null> {
    const response = await fetch(`${bomAPI}?limit=1000`, {
        headers: getHeaders()
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch BOM: ${response.status}`);
    }

    const data = await response.json() as BOMResponse;
    return data.data.find(entry => entry.sku_name === skuName) || null;
}
