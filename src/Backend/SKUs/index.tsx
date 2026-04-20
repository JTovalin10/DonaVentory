const version = import.meta.env.VITE_VERSION;
const header = import.meta.env.VITE_PREDIKO_AUTH_KEY;
const skuAPI = "https://api.prediko.io/api/v1/skus?aggregation_level=PRODUCT";

interface StockHealthProjected {
    EXCESS: number;
    HEALTHY: number;
    AT_RISK: number;
    STOCK_OUT: number;
}

interface MinMax {
    min: number;
    max: number;
}

interface ReOrderStatus {
    True: number;
    False: number;
}

interface SupplierUnitCost {
    supplier_name: string;
    unit_cost: number;
    currency: string;
}

interface SKU {
    product_name: string;
    sum_stock_level: number;
    sum_incoming_units: number;
    buying_date: string;
    stock_health_projected: StockHealthProjected;
    days_on_hand: MinMax;
    estimated_stock_out_days_incoming: MinMax;
    unit_cost: number;
    unit_cost_supplier?: number;
    unit_costs_supplier?: SupplierUnitCost[];
    bom_cost?: number;
    re_order_status: ReOrderStatus;
    supplier_name: string;
    recommended_units_to_order: number;
    lead_time_to: string;
}

interface SKUsResponse {
    data: SKU[];
    total: number;
}

export async function getSKU(name: string): Promise<SKUsResponse | null> {
    try {
        const response = await fetch(skuAPI, {
            method: "POST",
            headers: {
                "Authorization": header,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name_like: [name] })
        });
        return await response.json();
    } catch (error: unknown) {
        if (error instanceof Error) console.error(error.message);
        else console.error("Error getting SKU ", error);
        return null;
    }
}