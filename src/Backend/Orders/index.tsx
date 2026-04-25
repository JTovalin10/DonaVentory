import type { SKU, CreateOrderResponse, CreateOrderRequest, Supplier } from "../types";
import { getBOM } from "../Bill_of_Materials";
import { getAllSuppliers } from "../Suppliers.tsx";
import { BASE_URL, getHeaders } from "../apiConfig";

/**
 * Step 1: Format the unique intake identifier.
 */
function generateIntakeId(firstName: string): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    // Using lowercase and a standard format
    return `${firstName.trim().toLowerCase()} - ${month}-${day}-${year}`;
}

/**
 * Step 2: Check if an entry already exists for today for THIS SKU.
 * Prediko uses cumulative quantities, so we must find the previous total for this specific product.
 */
async function getExistingQuantityForSKU(intakeId: string, skuName: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    // We must explicitly ask for PRODUCTION_ORDERs as they are not in the default list
    const params = new URLSearchParams();
    params.append("updated_after", `${today}T00:00:00Z`);
    params.append("order_types", "FINISHED_GOOD");
    params.append("order_types", "RAW_MATERIAL");
    params.append("order_types", "PRODUCTION_ORDER");

    const response = await fetch(`${BASE_URL}/orders?${params.toString()}`, {
        headers: getHeaders()
    });

    if (response.ok) {
        const orders = await response.json();
        // 1. Find the order with our reference
        const existingOrder = orders.data.find((o: any) => o.reference === intakeId);
        
        if (existingOrder) {
            // 2. Fetch full order details to see the specific SKU quantity
            // The list view quantity might be an aggregate of multiple items
            const detailRes = await fetch(`${BASE_URL}/orders/${existingOrder.id}`, {
                headers: getHeaders()
            });
            if (detailRes.ok) {
                const detail = await detailRes.json();
                const part = detail.order_parts?.find((p: any) => p.sku_name === skuName);
                return part ? (part.received || 0) : 0;
            }
        }
    }
    return 0;
}

/**
 * Step 3: Ensure we have a supplier name that Prediko will accept.
 */
function resolveValidSupplier(sku: SKU, allSuppliers: Supplier[]): string {
    const validNames = allSuppliers.map(s => s.name);
    if (sku.supplier_name && validNames.includes(sku.supplier_name)) {
        return sku.supplier_name;
    }
    return validNames.length > 0 ? validNames[0] : "Terra Green";
}

/**
 * Main Orchestrator: Handles the streamlined production intake.
 */
export async function receiveProduction(sku: SKU, amount: number, firstName: string): Promise<CreateOrderResponse> {
    const intakeId = generateIntakeId(firstName);
    const today = new Date().toISOString().split('T')[0];

    // Parallel lookup for metadata and existing cumulative totals
    const [bomEntry, allSuppliers, prevQuantity] = await Promise.all([
        getBOM(sku.sku_name),
        getAllSuppliers(),
        getExistingQuantityForSKU(intakeId, sku.sku_name)
    ]);

    const cumulativeTotal = prevQuantity + amount;
    const validSupplier = resolveValidSupplier(sku, allSuppliers);

    const payload: CreateOrderRequest = {
        data: [
            {
                sku: sku.sku_name,
                warehouse: "Warehouse",
                quantity_ordered: cumulativeTotal,
                quantity_received: cumulativeTotal,
                unit_cost_supplier: bomEntry?.unit_cost || sku.unit_cost,
                supplier: validSupplier,
                purchase_order_name: intakeId,
                delivery: today,
                status: "FULLY_RECEIVED",
                order_type: "PRODUCTION_ORDER"
            }
        ]
    };

    const response = await fetch(`${BASE_URL}/orders`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Production update failed: ${response.status} - ${errorText}`);
    }

    return await response.json() as CreateOrderResponse;
}
