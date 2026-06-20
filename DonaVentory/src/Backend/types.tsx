export interface SKU {
    sku_id: string;
    sku_name: string;
    product_name: string;
    supplier_name: string;
    sum_stock_level: number;
    unit_cost: number;
    barcode?: string;
    url?: string;
}

export interface SKUsResponse {
    data: SKU[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        has_more: boolean;
    };
}

export interface POLineItem {
    sku: string; // Exact SKU identifier
    warehouse: string; // Warehouse name
    quantity_ordered: number;
    quantity_received: number;
    unit_cost_supplier?: number;
    supplier: string;
    purchase_order_name: string;
    delivery: string; // YYYY-MM-DD
    status: "DRAFT" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED";
    order_type?: "FINISHED_GOOD" | "RAW_MATERIAL" | "PRODUCTION_ORDER";
}

export interface CreateOrderRequest {
    data: POLineItem[];
    date_format?: string;
}

export interface CreateOrderResponse {
    errors: string[];
    created_orders: Array<{
        order_id: string;
        order_name: string;
    }>;
    order_ids: string[];
}

export interface BOMResponse {
    data: BOMEntry[];
}

export interface BOMComponent {
    raw_material_name: string;
    raw_material_quantity: number;
}

export interface BOMEntry {
    sku_name: string;
    unit_cost: number | null;
    production_time: number | null;
    bom: BOMComponent[];
}

export interface ConsumptionEntry {
    raw_material_name: string;
    raw_material_id: string;
    planned_quantity: number;
    actual_quantity_used: number;
    quantity_variance: number;
    unit_cost: number | null;
    total_cost: number | null;
    warehouse_name: string | null;
}

export interface ConsumptionResponse {
    order_id: string;
    data: ConsumptionEntry[];
}

export interface UpdateConsumptionRequest {
    raw_material_ids: string[];
    actual_quantity_used: number;
}

// ── Purchase Orders ────────────────────────────────────────────────────────────

export type PurchaseOrderStatus =
    | "DRAFT"
    | "SENT_FOR_APPROVAL"
    | "APPROVED"
    | "CONFIRMED"
    | "PARTIALLY_RECEIVED"
    | "FULLY_RECEIVED";

export type PurchaseOrderType = "FINISHED_GOOD" | "RAW_MATERIAL" | "PRODUCTION_ORDER";

export interface PurchaseOrder {
    id: string;
    reference: string;
    order_status: PurchaseOrderStatus;
    supplier_name: string;
    order_type: PurchaseOrderType;
    origin: string;
    quantity_confirmed: number;
    quantity_received: number;
    delivery_date: string[];
    confirmed_delivery_date: string[];
    initial_delivery_date: string[];
    warehouse_names: string[];
    cost: number;
    currency: string;
    created_at: string;
}

export interface PurchaseOrdersResponse {
    data: PurchaseOrder[];
    total: number;
}

export interface PurchaseOrderPart {
    sku_name: string;
    product_name: string;
    quantity_confirmed: number;
    received: number;
    in_transit: number;
    confirmed_delivery_date: string;
    initial_delivery_date: string;
    total_cost: number;
    moq_met: boolean;
    missing_moq: number;
    moq: number;
    moq_type: string;
    is_composite: boolean;
    pack_quantity: number;
    pack_type: string;
    pack_met: boolean;
    packs_to_order: number;
    is_closed: boolean;
    warehouse_name?: string; // only when aggregation_level=SKU_LOCATION
}

export interface PurchaseOrderDetail extends PurchaseOrder {
    order_parts: PurchaseOrderPart[];
}

export interface GetOrdersParams {
    order_status?: PurchaseOrderStatus;
    order_types?: PurchaseOrderType[];
    updated_after?: string; // ISO 8601
    date_from?: string;     // YYYY-MM-DD
    date_to?: string;       // YYYY-MM-DD
    supplier_names?: string[];
}
