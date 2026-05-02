import type { SKUsResponse } from "../types";
import { searchFromCache } from "./skuCache";

export async function searchSKUs(name: string): Promise<SKUsResponse> {
    const data = await searchFromCache(name);
    return {
        data,
        pagination: { total: data.length, limit: data.length, offset: 0, has_more: false },
    };
}
