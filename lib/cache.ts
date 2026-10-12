import type { GeneratedDocuments } from "@/types";

type CacheEntry = { expiresAt: number; value: GeneratedDocuments };
const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1_000;

export function getCachedDocuments(key: string) {
  const entry = memoryCache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedDocuments(key: string, value: GeneratedDocuments) {
  memoryCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}
