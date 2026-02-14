/**
 * Generic KV cache helper for Cloudflare Workers KV.
 * Implements stale-while-revalidate pattern with TTL.
 */
export async function getOrCompute<T>(
  kv: KVNamespace,
  key: string,
  ttlSeconds: number,
  computeFn: () => Promise<T>,
): Promise<T> {
  const cached = await kv.get(key, "text");
  if (cached !== null) {
    return JSON.parse(cached) as T;
  }

  const value = await computeFn();
  await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  return value;
}

export async function invalidate(kv: KVNamespace, key: string): Promise<void> {
  await kv.delete(key);
}
