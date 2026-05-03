import { getHeaders, BASE_URL } from "../api-config";
import { fetchWithLog } from "../logger";

export interface Supplier {
    id: string;
    name: string;
    status: string;
    currency: string;
}

export interface SuppliersResponse {
    data: Supplier[];
    total: number;
}

/**
 * Fetches all registered suppliers from Prediko.
 */
export async function getAllSuppliers(): Promise<Supplier[]> {
    const response = await fetchWithLog(`${BASE_URL}/suppliers`, {
        headers: getHeaders()
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch suppliers: ${response.status}`);
    }

    const data = await response.json() as SuppliersResponse;
    return data.data;
}
