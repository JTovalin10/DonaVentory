import type { SKUsResponse } from "../types";
import { BASE_URL, getHeaders } from "../api-config";

const skuAPI = `${BASE_URL}/skus?aggregation_level=SKU`;

/**
 * Searches for SKUs matching the provided name.
 * @param name The product name to search for.
 * @returns A promise that resolves to the SKUsResponse.
 */
export async function searchSKUs(name: string): Promise<SKUsResponse> {
    const response = await fetch(skuAPI, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify({ name_like: name })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Search failed: ${response.status} - ${errorText}`);
    }

    return await response.json() as SKUsResponse;
}
