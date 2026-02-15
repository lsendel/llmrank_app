/**
 * Minimal in-memory R2Bucket stub for testing.
 */
export function createR2Stub(): R2Bucket {
  const store = new Map<string, ArrayBuffer>();

  return {
    get: async (key: string) => {
      const data = store.get(key);
      if (!data) return null;
      return {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(data));
            controller.close();
          },
        }),
        text: async () => new TextDecoder().decode(data),
        json: async () => JSON.parse(new TextDecoder().decode(data)),
        arrayBuffer: async () => data,
      } as unknown as R2ObjectBody;
    },
    put: async (key: string, value: ArrayBuffer | string) => {
      const buf =
        typeof value === "string"
          ? new TextEncoder().encode(value).buffer
          : value;
      store.set(key, buf as ArrayBuffer);
      return {} as R2Object;
    },
    delete: async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      keys.forEach((k) => store.delete(k));
    },
    list: async () => ({
      objects: [...store.keys()].map((key) => ({ key })),
      truncated: false,
    }),
    head: async (key: string) => (store.has(key) ? ({} as R2Object) : null),
  } as unknown as R2Bucket;
}
