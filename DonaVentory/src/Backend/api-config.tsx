export const VERSION = import.meta.env.VITE_VERSION || "v1";
export const BASE_URL = `https://api.prediko.io/api/${VERSION}`;

/**
 * Retrieves the API key from Environment Variables.
 */
export function getAuthKey(): string | null {
    return import.meta.env.VITE_PREDIKO_AUTH_KEY || null;
}

export function getHeaders() {
    const key = getAuthKey();
    if (!key) {
        throw new Error("VITE_PREDIKO_AUTH_KEY is missing from .env file.");
    }
    
    return {
        "Authorization": key.startsWith("Bearer") ? key : `Bearer ${key}`,
        "Content-Type": "application/json"
    };
}
