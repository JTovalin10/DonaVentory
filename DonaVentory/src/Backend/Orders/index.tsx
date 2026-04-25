import type { SKU, CreateOrderResponse, CreateOrderRequest, POLineItem } from "../types";
import { getBOM } from "../Bill_of_Materials";
import { getAllSuppliers } from "../Suppliers";
import { BASE_URL, getHeaders } from "../api-config";

/**
 * Step 1: Generate a unique ID for this specific intake event.
 */
function generateUniqueIntakeId(firstName: string): string {
    const now = new Date();
    const timestamp = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
    const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
    return `${firstName.trim().toLowerCase()} - ${dateStr} (${timestamp})`;
}

/**
 * Step 2: Fetch material cost from the BOM.
 */
async function getMaterialCost(skuName: string): Promise<number | null> {
    const bom = await getBOM(skuName);
    return bom?.unit_cost || null;
}

/**
 * Step 3: Create the order as DRAFT. 
 * This triggers Prediko to map the Bill of Materials to this order.
 */
async function createDraft(sku: SKU, amount: number, cost: number, supplier: string, intakeId: string): Promise<void> {
    const payload: CreateOrderRequest = {
        data: [
            {
                sku: sku.sku_name,
                warehouse: "Warehouse",
                quantity_ordered: amount,
                quantity_received: 0,
                unit_cost_supplier: cost,
                supplier: supplier,
                purchase_order_name: intakeId,
                delivery: new Date().toISOString().split('T')[0],
                status: "DRAFT",
                order_type: "PRODUCTION_ORDER"
            }
        ]
    };

    const res = await fetch(`${BASE_URL}/orders`, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Draft step failed: ${res.status}`);
}

/**
 * Step 4: Mark the order as RECEIVED and CLOSE it.
 * This triggers the actual deduction of raw materials from inventory.
 */
async function markAsReceived(sku: SKU, amount: number, cost: number, supplier: string, intakeId: string): Promise<CreateOrderResponse> {
    const payload: CreateOrderRequest = {
        data: [
            {
                sku: sku.sku_name,
                warehouse: "Warehouse",
                quantity_ordered: amount,
                quantity_received: amount, // Explicitly mark as received
                unit_cost_supplier: cost,
                supplier: supplier,
                purchase_order_name: intakeId,
                delivery: new Date().toISOString().split('T')[0],
                status: "FULLY_RECEIVED", // This closes the order
                order_type: "PRODUCTION_ORDER"
            }
        ]
    };

    const res = await fetch(`${BASE_URL}/orders`, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Receive step failed: ${res.status}`);
    return await res.json() as CreateOrderResponse;
}

/**
 * Main Orchestrator: Streamlined Production Intake
 */
export async function receiveProduction(sku: SKU, amount: number, firstName: string): Promise<CreateOrderResponse> {
    const intakeId = generateUniqueIntakeId(firstName);
    
    // 1. Load metadata
    const [cost, suppliers] = await Promise.all([
        getMaterialCost(sku.sku_name),
        getAllSuppliers()
    ]);

    // 2. Find valid supplier
    const supplierNames = suppliers.map(s => s.name);
    const validSupplier = (sku.supplier_name && supplierNames.includes(sku.supplier_name))
        ? sku.supplier_name
        : (supplierNames.length > 0 ? supplierNames[0] : "Terra Green");

    const finalCost = cost || sku.unit_cost;

    // 3. Step One: Create Draft (Links BOM)
    await createDraft(sku, amount, finalCost, validSupplier, intakeId);

    // 4. Step Two: Mark as Received (Updates Inventory & Deducts Materials)
    return await markAsReceived(sku, amount, finalCost, validSupplier, intakeId);
}
