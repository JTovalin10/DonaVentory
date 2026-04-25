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
