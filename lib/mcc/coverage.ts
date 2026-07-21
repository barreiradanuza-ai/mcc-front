import { normalizeCity } from "@/lib/mcc/admin";

export const OPENCEP_CONCURRENCY = 10;

export async function fetchCity(cep: string): Promise<string> {
  try {
    const res = await fetch(`https://opencep.com/v1/${cep}`, {
      headers: { "User-Agent": "mcc-front/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data?.localidade ?? "";
  } catch {
    return "";
  }
}

export async function resolveInBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export function buildCoverageString(hasClaro: boolean, claroPromo: boolean, hasTim: boolean, hasNio: boolean): string {
  const claroLabel = claroPromo ? "Claro Promo" : "Claro";
  const hasAnyClaro = hasClaro || claroPromo;

  if (hasAnyClaro && hasTim && hasNio) return `${claroLabel} e Tim e Nio`;
  if (hasAnyClaro && hasTim) return `Tim e ${claroLabel}`;
  if (hasAnyClaro && hasNio) return `Nio e ${claroLabel}`;
  if (hasTim && hasNio) return "Tim e Nio";
  if (hasAnyClaro) return claroLabel;
  if (hasTim) return "Tim";
  if (hasNio) return "Nio";
  return "Sem cobertura";
}

/**
 * Given the Claro-covered CEPs from a batch, resolves their city via opencep.com
 * and returns the subset that sits in a "Claro Promo" eligible city. The actual
 * promo-city lookup is injected so this module stays free of Prisma imports.
 */
export async function resolveClaroPromoCeps(
  claroCeps: string[],
  checkPromoCities: (normalizedCities: string[]) => Promise<Set<string>>,
): Promise<Set<string>> {
  if (claroCeps.length === 0) return new Set();

  const cityMap = new Map<string, string>();
  const cities = await resolveInBatches(claroCeps, OPENCEP_CONCURRENCY, async (cep) => {
    const city = await fetchCity(cep);
    return { cep, city };
  });
  for (const { cep, city } of cities) {
    const normalized = city ? normalizeCity(city) : null;
    if (normalized) cityMap.set(cep, normalized);
  }

  const uniqueCities = [...new Set(cityMap.values())];
  if (uniqueCities.length === 0) return new Set();

  const promoSet = await checkPromoCities(uniqueCities);

  const promoCeps = new Set<string>();
  for (const [cep, city] of cityMap) {
    if (promoSet.has(city)) promoCeps.add(cep);
  }
  return promoCeps;
}
