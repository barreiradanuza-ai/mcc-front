import { dcOptions, type DcOptions } from "@/lib/mcc/datacrazy";

// Cache curto do catálogo do DataCrazy (listas, tags, funis, campos adicionais)
// compartilhado entre as rotas, para não gastar o limite da API.
declare global {
  // eslint-disable-next-line no-var
  var __mccDcOptionsCache: { at: number; data: DcOptions } | undefined;
}
const CACHE_MS = 2 * 60 * 1000;

export async function getDcOptionsCached(refresh = false): Promise<DcOptions> {
  const cache = globalThis.__mccDcOptionsCache;
  if (!refresh && cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const data = await dcOptions();
  globalThis.__mccDcOptionsCache = { at: Date.now(), data };
  return data;
}

export function invalidateDcOptionsCache(): void {
  globalThis.__mccDcOptionsCache = undefined;
}
