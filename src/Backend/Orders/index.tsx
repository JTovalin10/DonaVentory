const version = import.meta.env.VITE_VERSION;
const header = import.meta.env.VITE_PREDIKO_AUTH_KEY;
const suppliersApi: string = `https://api.prediko.io/api/${version}/suppliers`;
const auth: string = "Authorization"

interface Address {
    address1: string;
    address2: string | null;
    city: string;
    province: string | null;
    country: string;
    zip: string;
}

interface MOQ {
    warehouse_name: string;
    minimum_order_quantity: number;
    minimum_order_type: string;
}

interface LeadTime {
    warehouse_name: string;
    lead_time: number;
}

interface Supplier {
    id: string;
    name: string;
    emails: string[] | null;
    address: Address;
    lead_time: number;
    currency: string;
    minimum_order_quantity: number;
    minimum_order_type: string;
    moqs: MOQ[];
    lead_times: LeadTime[];
}

interface SuppliersResponse {
    data: Supplier[];
    total: number;
}

export async function getAllSuppliers(): Promise<unknown[]> {
    try {
        const response = await fetch(suppliersApi, { headers: { [auth]: header } });
        return await response.json();
    } catch (error: unknown) {
        if (error instanceof Error) console.error(error.message);
        else console.error("An unexpected error occured", error);
        return [];
    }
}

export async function filterSuppliers(requestedSuppliers: string[]): Promise<unknown[]> {
    const resSuppliers: unknown[] = [];
    for (const name of requestedSuppliers) {
        try {
            const response = await fetch(`${suppliersApi}?name=${name}`, { headers: { [auth]: header } });
            resSuppliers.push(await response.json());
        } catch (error: unknown) {
            if (error instanceof Error) console.error(error.message);
            else console.error("An unexpected error occured ", error);
            return [];
        }
    }
    return resSuppliers;
}