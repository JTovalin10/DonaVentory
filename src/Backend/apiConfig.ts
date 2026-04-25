export const VERSION = import.meta.env.VITE_VERSION || "v1";
export const BASE_URL = `https://api.prediko.io/api/${VERSION}`;

/**
 * Fetches the API key from the local donaventory.key file via the dev server.
 */
export async function getAuthKey(): Promise<string | null> {
    try {
        const res = await fetch('/api/key');
        const data = await res.json();
        return data.key || null;
    } catch (e) {
        return null;
    }
}

/**
 * Saves the API key to the local donaventory.key file.
 */
export async function saveAuthKey(key: string): Promise<boolean> {
    try {
        const res = await fetch('/api/key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });
        return res.ok;
    } catch (e) {
        return false;
    }
}

export async function getHeaders() {
    const key = await getAuthKey();
    if (!key) {
        throw new Error("API Key missing. Please set it in Settings.");
    }
    
    return {
        "Authorization": key.startsWith("Bearer") ? key : `Bearer ${key}`,
        "Content-Type": "application/json"
    };
}
