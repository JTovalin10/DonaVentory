import type { SKU, POLineItem, CreateOrderRequest, CreateOrderResponse } from "../types";
import { getAllSuppliers } from "../Suppliers";
import { BASE_URL, getHeaders } from "../api-config";
import { fetchWithLog } from "../logger";
import get_warehouse_name from "../Warehouse";
import { today, generateIntakeId, resolveSupplier } from "../common";

// ── Small helpers ──────────────────────────────────────────────────────────────

/**
 * @param sku: sku of the item being ordered
 * @param amount: the amount being ordered in this line item (not cumulative)
 * @param cost: the unit cost of the item being ordered
 * @param supplier: the supplier name to put on the line item
 * @param warehouse: the warehouse (stocking location) to receive the stock into
 * @param intakeId: the intakeId to use for the purchase_order_name field, which ties this line item to the intake that created it
 * @param status: the status to set on the line item.
 * @returns: a POLineItem object ready to be sent to Prediko
 */
function buildLineItem(
    sku: SKU,
    amount: number,
    cost: number,
    supplier: string,
    warehouse: string,
    intakeId: string,
    status: "DRAFT" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED"
): POLineItem {
    return {
        sku: sku.sku_name,
        warehouse,
        quantity_ordered: amount,
        // Prediko's quantity_received is cumulative (total received so far), not a delta.
        // Send the new running total so stock lands at current + amount, not at amount.
        quantity_received: sku.sum_stock_level + amount,
        unit_cost_supplier: cost,
        supplier,
        purchase_order_name: intakeId,
        delivery: today(),
        status,
        order_type: "PRODUCTION_ORDER"
    };
}

// ── API layer ──────────────────────────────────────────────────────────────────

/**
 * Sends a POST request to create an order with the given payload, and checks for common errors.
 * @param payload: the body of the request, containing the line items to order and their details.
 * @param checkErrors: flag that indicates whether to check the response for application-level errors and throw if true and error
 * @param stage: an optional string to prefix error messages with, to help identify at which stage of the order flow an error occurred (e.g. "DRAFT" or "FULLY_RECEIVED") [testing]
 * @throws: throws an error if the response has a status of 401 or 404
 * @throws: throws an error if the response has any non-ok status
 * @throws: if checkErrors is true, throws an error if the response body contains an "errors" field with any errors in it
 * @returns: A promise of CreateOrderResponse
 */
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

type ResolvedItem = { sku: SKU; amount: number; cost: number; supplier: string };

/**
 * makes a POST request to create an order with the given items. It creates a draft order first, then a second order with the same items
 * marked as fully received, to simulate the production and receiving process in one step. This is because Prediko's API does not allow
 * creating an order with a status of "fully received" directly.
 * @param items : array of items to order, with all necessary details resolved (supplier name, unit cost, etc.)
 * @param intakeId: the intakeId to use for the purchase_order_name field, which ties this line item to the intake that created it
 * @param warehouse: the warehouse (stocking location) to receive all line items into
 * @returns: the response form the POST request
 */
async function postOrder(items: ResolvedItem[], intakeId: string, warehouse: string): Promise<CreateOrderResponse> {
    const make = (status: "DRAFT" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED") =>
        items.map(({ sku, amount, cost, supplier }) =>
            buildLineItem(sku, amount, cost, supplier, warehouse, intakeId, status)
        );

    await sendOrder({ data: make("DRAFT") }, false, 'DRAFT');
    return sendOrder({ data: make("FULLY_RECEIVED") }, true, 'FULLY_RECEIVED');
}

// ── Exports ────────────────────────────────────────────────────────────────────

/**
 * recieve an order from product and create a postOrder with the item and intakeId
 * @param sku: sku of item being received from production
 * @param amount: amount made of the item being received from production (not cumulative)
 * @param firstName: firstname of the employeer who made the order
 * @returns: a promise of CreateOrderResponse
 */
export async function receiveProduction(
    sku: SKU,
    amount: number,
    firstName: string
): Promise<CreateOrderResponse> {
    const intakeId = generateIntakeId(firstName);
    const [suppliers, warehouse] = await Promise.all([getAllSuppliers(), get_warehouse_name()]);

    const resolvedItem: ResolvedItem = {
        sku,
        amount,
        cost: sku.unit_cost,
        supplier: resolveSupplier(sku, suppliers.map(s => s.name))
    };

    return postOrder([resolvedItem], intakeId, warehouse[0]);
}

/**
 * create a batch order and send to postOrdrer
 * @param items: array of items being received from production, with their amounts (not cumulative)
 * @param firstName: firstname of the employeer who made the order
 * @returns: a promise of CreateOrderResponse
 */
export async function receiveBatchProduction(
    items: Array<{ sku: SKU; amount: number }>,
    firstName: string
): Promise<CreateOrderResponse> {
    const intakeId = generateIntakeId(firstName);
    const [suppliers, warehouse] = await Promise.all([getAllSuppliers(), get_warehouse_name()]);
    const supplierNames = suppliers.map(s => s.name);

    const resolvedItems: ResolvedItem[] = items.map(({ sku, amount }) => ({
        sku,
        amount,
        cost: sku.unit_cost,
        supplier: resolveSupplier(sku, supplierNames)
    }));

    return postOrder(resolvedItems, intakeId, warehouse[0]);
}
