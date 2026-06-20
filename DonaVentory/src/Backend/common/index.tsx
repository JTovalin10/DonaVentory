import type { SKU } from "../types";
/**
 * @returns todays date in YYYY-MM-DD format, which is what Prediko expects for the delivery field.
 */
export function today(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * @param firstName: firstname of the employeer who made the order
 * @returns returns a formated string: {firstName} - {MM-DD-YYYY} ({HHMMSSmmm})
 */
export function generateIntakeId(firstName: string): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${String(now.getMilliseconds()).padStart(3, '0')}`;
    const date = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
    return `${firstName.trim().toLowerCase()} - ${date} (${time})`;
}


/**
 * @param sku: the SKU being ordered
 * @param supplierNames: A list of strings gthat contain the suppliers name
 * @returns returns the supplier's name if the SKU has a supplier_name that matches one in the list,
 *      otherwise returns the first supplier in the list, or "Terra Green" if the list is empty.
 */
export function resolveSupplier(sku: SKU, supplierNames: string[]): string {
    if (sku.supplier_name && supplierNames.includes(sku.supplier_name)) return sku.supplier_name;
    return supplierNames.length > 0 ? supplierNames[0] : "Terra Green";
}

/**
 * Returns the warehouse to receive stock into. Everything this app logs is a
 * finished good, so we always use the "Warehouse" (finished-goods) location and
 * never "Raw Material". Selects "Warehouse" from the fetched list; falls back to
 * the literal only if the account has no warehouse named "Warehouse".
 * @param warehouseNames: warehouse names from getAllWarehouses()
 * @returns the warehouse name(s); callers use index 0
 */
export function resolveWarehouse(warehouseNames: string[]): string[] {
    const finishedGoods = warehouseNames.filter(n => n === "Warehouse");
    return finishedGoods.length > 0 ? finishedGoods : ["Warehouse"];
}