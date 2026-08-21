type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const publicCache = new Map<string, CacheEntry<unknown>>();
const PUBLIC_CACHE_TTL_MS = 60_000;

export async function readPublicCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cached = publicCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await loader();
  publicCache.set(key, { value, expiresAt: Date.now() + PUBLIC_CACHE_TTL_MS });
  return value;
}

export function invalidatePublicCache() {
  publicCache.clear();
}

export function resetPublicCacheForTests() {
  publicCache.clear();
}
