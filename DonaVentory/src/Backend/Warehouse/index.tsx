import { getHeaders, BASE_URL } from "../api-config";
import { fetchWithLog } from "../logger";
import { resolveWarehouse } from "../common";

interface Address {
    address1: string;
    address2: string;
    city: string;
    province: string;
    country: string;
    zip: string;
}

interface Warehouse {
    id: string;
    name: string;
    active: boolean;
    address: Address;
    store_name: string;
    is_combined: boolean;
    child_warehouses: Warehouse[];
}

interface WarehousesResponse {
    data: Warehouse[];
    total: number;
}

/**
 * Gets the name of the warehouse (stocking location) stock should be received into.
 * NOTE: assumes a single receiving location — returns the first warehouse's name
 * (or "Warehouse" if none).
 * @throws error if the api returns an error
 * @returns the warehouse name to put on order lines
 */
export default async function get_warehouse_name(): Promise<string[]> {
    try {
        const response = await fetchWithLog(`${BASE_URL}/warehouses`, {
            headers: getHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch warehouses: ${response.status}`);
        }

        const body: WarehousesResponse = await response.json() as WarehousesResponse;
        return resolveWarehouse((body.data ?? []).map(w => w.name));
    } catch (error) {
        throw new Error("Failed to fetch warehouse name: " + (error instanceof Error ? error.message : String(error)));   
    }
}
