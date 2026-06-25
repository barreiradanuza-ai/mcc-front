import type { SearchResponse } from "./types";

export async function searchPlans(
  cep: string,
  number: string,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ cep, number });
  const res = await fetch(`/api/plans?${params}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Erro ao buscar planos (${res.status})`);
  }

  return res.json();
}
