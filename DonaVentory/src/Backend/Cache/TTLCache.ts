import { Cache } from './index';

export class TTLCache<K, V> extends Cache<K, V> {
    private store = new Map<K, { value: V; expiresAt: number }>();
    private readonly ttlMs: number;

    constructor(ttlMs: number) {
        super();
        this.ttlMs = ttlMs;
    }

    get(key: K): V | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    set(key: K, value: V): void {
        this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    }

    has(key: K): boolean {
        return this.get(key) !== undefined;
    }

    delete(key: K): void {
        this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }

    get size(): number {
        return this.store.size;
    }
}
