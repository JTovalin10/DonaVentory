import type {
    GetOrdersParams,
    PurchaseOrdersResponse,
    PurchaseOrderDetail,
} from "../types";
import { BASE_URL, getHeaders } from "../api-config";
import { TTLCache } from "../Cache/TTLCache";

const FIVE_MINUTES = 5 * 60 * 1000;

const listCache = new TTLCache<string, PurchaseOrdersResponse>(FIVE_MINUTES);
const detailCache = new TTLCache<string, PurchaseOrderDetail>(FIVE_MINUTES);

function paramsKey(params: GetOrdersParams): string {
    return JSON.stringify(params, Object.keys(params).sort() as (keyof GetOrdersParams)[]);
}

export async function getPurchaseOrders(
    params: GetOrdersParams = {}
): Promise<PurchaseOrdersResponse> {
    const key = paramsKey(params);
    const cached = listCache.get(key);
    if (cached) return cached;

    const query = new URLSearchParams();
    if (params.order_status) query.set("order_status", params.order_status);
    if (params.order_types?.length) params.order_types.forEach(t => query.append("order_types", t));
    if (params.updated_after) query.set("updated_after", params.updated_after);
    if (params.date_from) query.set("date_from", params.date_from);
    if (params.date_to) query.set("date_to", params.date_to);
    if (params.supplier_names?.length) params.supplier_names.forEach(s => query.append("supplier_names", s));

    const res = await fetch(`${BASE_URL}/orders?${query.toString()}`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch purchase orders: ${res.status}`);

    const data = await res.json() as PurchaseOrdersResponse;
    listCache.set(key, data);
    return data;
}

export async function getPurchaseOrderById(
    orderId: string,
    aggregationLevel: "SKU" | "SKU_LOCATION" = "SKU"
): Promise<PurchaseOrderDetail> {
    const key = `${orderId}:${aggregationLevel}`;
    const cached = detailCache.get(key);
    if (cached) return cached;

    const query = new URLSearchParams({ aggregation_level: aggregationLevel });
    const res = await fetch(`${BASE_URL}/orders/${orderId}?${query.toString()}`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch purchase order ${orderId}: ${res.status}`);

    const data = await res.json() as PurchaseOrderDetail;
    detailCache.set(key, data);
    return data;
}
