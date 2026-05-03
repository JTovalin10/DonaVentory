import type {
    GetOrdersParams,
    PurchaseOrdersResponse,
    PurchaseOrderDetail,
} from "../types";
import { BASE_URL, getHeaders } from "../api-config";

export async function getPurchaseOrders(
    params: GetOrdersParams = {}
): Promise<PurchaseOrdersResponse> {
    const query = new URLSearchParams();

    if (params.order_status) query.set("order_status", params.order_status);
    if (params.order_types?.length) {
        params.order_types.forEach(t => query.append("order_types", t));
    }
    if (params.updated_after) query.set("updated_after", params.updated_after);
    if (params.date_from) query.set("date_from", params.date_from);
    if (params.date_to) query.set("date_to", params.date_to);
    if (params.supplier_names?.length) {
        params.supplier_names.forEach(s => query.append("supplier_names", s));
    }

    const url = `${BASE_URL}/orders?${query.toString()}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch purchase orders: ${res.status}`);
    return res.json() as Promise<PurchaseOrdersResponse>;
}

export async function getPurchaseOrderById(
    orderId: string,
    aggregationLevel: "SKU" | "SKU_LOCATION" = "SKU"
): Promise<PurchaseOrderDetail> {
    const query = new URLSearchParams({ aggregation_level: aggregationLevel });
    const url = `${BASE_URL}/orders/${orderId}?${query.toString()}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch purchase order ${orderId}: ${res.status}`);
    return res.json() as Promise<PurchaseOrderDetail>;
}
