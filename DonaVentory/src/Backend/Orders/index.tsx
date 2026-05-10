import type { SKU, POLineItem, CreateOrderRequest, CreateOrderResponse } from "../types";
import { getAllSuppliers } from "../Suppliers";
import { BASE_URL, getHeaders } from "../api-config";
import { fetchWithLog } from "../logger";

// ── Small helpers ──────────────────────────────────────────────────────────────

function generateIntakeId(firstName: string): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${String(now.getMilliseconds()).padStart(3, '0')}`;
    const date = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
    return `${firstName.trim().toLowerCase()} - ${date} (${time})`;
}

function today(): string {
    return new Date().toISOString().split('T')[0];
}

function resolveSupplier(sku: SKU, supplierNames: string[]): string {
    if (sku.supplier_name && supplierNames.includes(sku.supplier_name)) return sku.supplier_name;
    return supplierNames.length > 0 ? supplierNames[0] : "Terra Green";
}

function buildLineItem(
    sku: SKU,
    amount: number,
    cumulativeReceived: number,
    cost: number,
    supplier: string,
    intakeId: string,
    status: "DRAFT" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED"
): POLineItem {
    return {
        sku: sku.sku_name,
        warehouse: "Warehouse",
        quantity_ordered: amount,
        quantity_received: cumulativeReceived,
        unit_cost_supplier: cost,
        supplier,
        purchase_order_name: intakeId,
        delivery: today(),
        status,
        order_type: "PRODUCTION_ORDER"
    };
}

// ── API layer ──────────────────────────────────────────────────────────────────

async function sendOrder(payload: CreateOrderRequest, checkErrors = false, stage = ''): Promise<CreateOrderResponse> {
    const prefix = stage ? `[${stage}] ` : '';
    const res = await fetchWithLog(`${BASE_URL}/orders`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
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
    if (checkErrors && data.errors?.length) throw new Error(`${prefix}${data.errors.join(', ')}`);
    return data;
}

// ── Order flow ─────────────────────────────────────────────────────────────────

type ResolvedItem = { sku: SKU; amount: number; cumulativeReceived: number; cost: number; supplier: string };

async function postOrder(items: ResolvedItem[], intakeId: string): Promise<CreateOrderResponse> {
    const make = (status: "DRAFT" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED") =>
        items.map(({ sku, amount, cumulativeReceived, cost, supplier }) =>
            buildLineItem(sku, amount, cumulativeReceived, cost, supplier, intakeId, status)
        );

    await sendOrder({ data: make("DRAFT") }, false, 'DRAFT');
    await sendOrder({ data: make("PARTIALLY_RECEIVED") }, false, 'PARTIALLY_RECEIVED');
    return sendOrder({ data: make("FULLY_RECEIVED") }, true, 'FULLY_RECEIVED');
}

// ── Exports ────────────────────────────────────────────────────────────────────

export async function receiveProduction(
    sku: SKU,
    amount: number,
    firstName: string
): Promise<CreateOrderResponse> {
    const intakeId = generateIntakeId(firstName);

    const suppliers = await getAllSuppliers();

    const resolvedItem: ResolvedItem = {
        sku,
        amount,
        cumulativeReceived: sku.sum_stock_level + amount,
        cost: sku.unit_cost,
        supplier: resolveSupplier(sku, suppliers.map(s => s.name))
    };

    return postOrder([resolvedItem], intakeId);
}

export async function receiveBatchProduction(
    items: Array<{ sku: SKU; amount: number }>,
    firstName: string
): Promise<CreateOrderResponse> {
    const intakeId = generateIntakeId(firstName);

    const suppliers = await getAllSuppliers();
    const supplierNames = suppliers.map(s => s.name);

    const resolvedItems: ResolvedItem[] = items.map(({ sku, amount }) => ({
        sku,
        amount,
        cumulativeReceived: sku.sum_stock_level + amount,
        cost: sku.unit_cost,
        supplier: resolveSupplier(sku, supplierNames)
    }));

    return postOrder(resolvedItems, intakeId);
}
