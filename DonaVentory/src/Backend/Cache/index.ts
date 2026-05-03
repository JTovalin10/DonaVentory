export abstract class Cache<K, V> {
    abstract get(key: K): V | undefined;
    abstract set(key: K, value: V): void;
    abstract has(key: K): boolean;
    abstract delete(key: K): void;
    abstract clear(): void;
    abstract get size(): number;
}
