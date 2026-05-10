import type { SKU, CreateOrderRequest, CreateOrderResponse } from "../types";
import { getAllSuppliers } from "../Suppliers";
import { BASE_URL, getHeaders } from "../api-config";
import { fetchWithLog } from "../logger";
import { searchFromStockCache, prefillStockCache, clearStockCache } from "../SKUs/stockCache";

export { searchFromStockCache as searchAllStock, prefillStockCache };

function today(): string {
    return new Date().toISOString().split('T')[0];
}

function generateAdjustmentId(firstName: string): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const date = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
    return `${firstName.trim().toLowerCase()} - ${date} (${time})`;
}

function resolveSupplier(sku: SKU, supplierNames: string[]): string {
    if (sku.supplier_name && supplierNames.includes(sku.supplier_name)) return sku.supplier_name;
    return supplierNames.length > 0 ? supplierNames[0] : "Terra Green";
}

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
    const suppliers = await getAllSuppliers();
    const supplierNames = suppliers.map(s => s.name);

    const filteredItems = items.filter(({ sku, targetAmount }) => calcDiff(sku, targetAmount) !== 0);

    if (filteredItems.length === 0) throw new Error("No stock changes to apply.");

    // FINISHED_GOOD in Prediko sets the stock level absolutely — quantity_received
    // becomes the new total, not a delta. Send targetAmount directly.
    const buildLineItems = (status: "DRAFT" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED") =>
        filteredItems.map(({ sku, targetAmount }) => ({
            sku: sku.sku_name,
            warehouse: "Warehouse",
            quantity_ordered: targetAmount,
            quantity_received: targetAmount,
            unit_cost_supplier: sku.unit_cost,
            supplier: resolveSupplier(sku, supplierNames),
            purchase_order_name: adjustmentId,
            delivery: today(),
            status,
            order_type: "FINISHED_GOOD" as const,
        }));

    await sendOrder({ data: buildLineItems("DRAFT") }, 'DRAFT');
    await sendOrder({ data: buildLineItems("PARTIALLY_RECEIVED") }, 'PARTIALLY_RECEIVED');
    const result = await sendOrder({ data: buildLineItems("FULLY_RECEIVED") }, 'FULLY_RECEIVED');
    clearStockCache();
    return result;
}
