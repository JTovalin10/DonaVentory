import type { SKU, CreateOrderRequest, CreateOrderResponse } from "../types";
import { getAllSuppliers } from "../Suppliers";
import { BASE_URL, getHeaders } from "../api-config";
import { fetchWithLog } from "../logger";
import { searchFromStockCache, prefillStockCache } from "../SKUs/stockCache";

export { searchFromStockCache as searchAllStock, prefillStockCache };

function today(): string {
    return new Date().toISOString().split('T')[0];
}

function generateAdjustmentId(firstName: string): string {
    const now = new Date();
    const time = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
    const date = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
    return `${firstName.trim().toLowerCase()} UPDATE - ${date} (${time})`;
}

function resolveSupplier(sku: SKU, supplierNames: string[]): string {
    if (sku.supplier_name && supplierNames.includes(sku.supplier_name)) return sku.supplier_name;
    return supplierNames.length > 0 ? supplierNames[0] : "Terra Green";
}

async function sendOrder(payload: CreateOrderRequest): Promise<CreateOrderResponse> {
    const res = await fetchWithLog(`${BASE_URL}/orders`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Order POST failed: ${res.status}`);
    const data = await res.json() as CreateOrderResponse;
    if (data.errors?.length) throw new Error(data.errors.join(', '));
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

    const lineItems = items
        .filter(({ sku, targetAmount }) => calcDiff(sku, targetAmount) !== 0)
        .map(({ sku, targetAmount }) => {
            const diff = calcDiff(sku, targetAmount);
            return {
                sku: sku.sku_name,
                warehouse: "Warehouse",
                quantity_ordered: diff,
                quantity_received: diff,
                unit_cost_supplier: sku.unit_cost,
                supplier: resolveSupplier(sku, supplierNames),
                purchase_order_name: adjustmentId,
                delivery: today(),
                status: "FULLY_RECEIVED" as const,
                order_type: "FINISHED_GOOD" as const,
            };
        });

    if (lineItems.length === 0) throw new Error("No stock changes to apply.");

    return sendOrder({ data: lineItems });
}
