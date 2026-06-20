import type { SKU, CreateOrderRequest, CreateOrderResponse } from "../types";
import { getAllSuppliers } from "../Suppliers";
import { BASE_URL, getHeaders } from "../api-config";
import { fetchWithLog } from "../logger";
import { searchFromStockCache, prefillStockCache, clearStockCache } from "../SKUs/stockCache";
import { today, generateIntakeId as generateAdjustmentId, resolveSupplier } from "../common";
import get_warehouse_name from "../Warehouse";

export { searchFromStockCache as searchAllStock, prefillStockCache };

async function sendOrder(payload: CreateOrderRequest, stage = ''): Promise<CreateOrderResponse> {
    const prefix = stage ? `[${stage}] ` : '';
    const res = await fetchWithLog(`${BASE_URL}/orders`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });
    if (res.status === 401) throw new Error(`${prefix}Invalid or missing API key.`);
    if (res.status === 404) throw new Error(`${prefix}Order not found.`);
    if (!res.ok) {
        let detail = '';
        try {
            const body = await res.json() as Record<string, unknown>;
            detail = (body.message ?? body.error ?? JSON.stringify(body)) as string;
        } catch { try { detail = await res.text(); } catch { /* ignore */ } }
        throw new Error(`${prefix}Order POST failed (${res.status})${detail ? `: ${detail}` : ''}`);
    }
    const data = await res.json() as CreateOrderResponse;
    if (data.errors?.length) throw new Error(`${prefix}${data.errors.join(', ')}`);
    return data;
}

export function calcDiff(sku: SKU, targetAmount: number): number {
    return targetAmount - sku.sum_stock_level;
}

export async function adjustStockBatch(
    items: Array<{ sku: SKU; targetAmount: number }>,
    firstName: string
): Promise<CreateOrderResponse> {
    const adjustmentId = generateAdjustmentId(firstName);
    const [suppliers, warehouse] = await Promise.all([getAllSuppliers(), get_warehouse_name()]);
    const supplierNames = suppliers.map(s => s.name);

    const filteredItems = items.filter(({ sku, targetAmount }) => calcDiff(sku, targetAmount) !== 0);

    if (filteredItems.length === 0) throw new Error("No stock changes to apply.");

    const lineItems = filteredItems.map(({ sku, targetAmount }) => {
        return {
            sku: sku.sku_name,
            warehouse: warehouse[0],
            // FINISHED_GOOD sets stock absolutely and quantity_received is cumulative,
            // so send targetAmount (the new total), not the delta.
            quantity_ordered: targetAmount,
            quantity_received: targetAmount,
            unit_cost_supplier: sku.unit_cost,
            supplier: resolveSupplier(sku, supplierNames),
            purchase_order_name: adjustmentId,
            delivery: today(),
            status: "FULLY_RECEIVED" as const,
            order_type: "FINISHED_GOOD" as const,
        };
    });

    const result = await sendOrder({ data: lineItems }, 'FULLY_RECEIVED');
    clearStockCache();
    return result;
}
