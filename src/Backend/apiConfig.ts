export const VERSION = import.meta.env.VITE_VERSION || "v1";
export const AUTH_HEADER = import.meta.env.VITE_PREDIKO_AUTH_KEY;
export const BASE_URL = `https://api.prediko.io/api/${VERSION}`;

export function getHeaders() {
    if (!AUTH_HEADER) {
        throw new Error("VITE_PREDIKO_AUTH_KEY is missing");
    }
    
    return {
        "Authorization": AUTH_HEADER.startsWith("Bearer") ? AUTH_HEADER : `Bearer ${AUTH_HEADER}`,
        "Content-Type": "application/json"
    };
}
