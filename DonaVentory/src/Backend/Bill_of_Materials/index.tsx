import type { BOMResponse, BOMEntry } from "../types";
import { BASE_URL, getHeaders } from "../api-config";
import { fetchWithLog } from "../logger";

const bomAPI = `${BASE_URL}/bill-of-materials`;

export async function getBOM(skuName: string): Promise<BOMEntry | null> {
    const response = await fetchWithLog(`${bomAPI}?limit=1000`, {
        headers: await getHeaders()
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch BOM: ${response.status}`);
    }

    const data = await response.json() as BOMResponse;
    return data.data.find(entry => entry.sku_name === skuName) || null;
}
