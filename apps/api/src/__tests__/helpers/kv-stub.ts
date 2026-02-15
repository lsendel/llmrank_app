/**
 * In-memory KVNamespace stub for testing.
 */
export function createKVStub(): KVNamespace {
  const store = new Map<string, { value: string; metadata: unknown }>();

  return {
    get: async (key: string) => store.get(key)?.value ?? null,
    put: async (key: string, value: string, _options?: unknown) => {
      store.set(key, { value, metadata: null });
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({
      keys: [...store.keys()].map((name) => ({ name })),
      list_complete: true,
      cursor: "",
    }),
    getWithMetadata: async (key: string) => {
      const entry = store.get(key);
      return entry
        ? { value: entry.value, metadata: entry.metadata }
        : { value: null, metadata: null };
    },
  } as unknown as KVNamespace;
}
