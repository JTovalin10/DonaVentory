import { Cache } from './index';

export class LRUCache<K, V> extends Cache<K, V> {
    private store = new Map<K, V>(); // insertion order = LRU → MRU
    private readonly maxSize: number;

    constructor(maxSize: number) {
        super();
        this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
        const value = this.store.get(key);
        if (value !== undefined) this.promote(key, value);
        return value;
    }

    set(key: K, value: V): void {
        if (this.store.has(key)) {
            this.store.delete(key);
        } else if (this.store.size >= this.maxSize) {
            this.evictLRU();
        }
        this.store.set(key, value);
    }

    has(key: K): boolean {
        return this.store.has(key);
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

    private promote(key: K, value: V): void {
        this.store.delete(key);
        this.store.set(key, value);
    }

    private evictLRU(): void {
        const lruKey = this.store.keys().next().value as K;
        if (lruKey !== undefined) this.store.delete(lruKey);
    }
}
