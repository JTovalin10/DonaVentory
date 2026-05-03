const isDev = import.meta.env.DEV;

async function logToTerminal(payload: object): Promise<void> {
    try {
        await fetch('/__log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch { /* dev server not available */ }
}

export async function fetchWithLog(url: string, options: RequestInit = {}): Promise<Response> {
    const method = options.method ?? 'GET';
    const requestBody = options.body ? JSON.parse(options.body as string) : undefined;

    const res = await fetch(url, options);
    const clone = res.clone();

    if (isDev) {
        try {
            const response = await clone.json();
            logToTerminal({ method, url, requestBody, status: res.status, response });
        } catch {
            logToTerminal({ method, url, requestBody, status: res.status });
        }
    }

    return res;
}
