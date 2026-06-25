export type AdminResource = "ceps-claro" | "ceps-nio" | "ceps-tim" | "cidades-promo-claro";

export interface AdminResourceConfig {
  key: AdminResource;
  label: string;
  column: "cep" | "cidade";
  filename: string;
}

export const ADMIN_RESOURCES: AdminResourceConfig[] = [
  { key: "ceps-claro", label: "CEPs Claro", column: "cep", filename: "ceps_claro" },
  { key: "ceps-nio", label: "CEPs Nio", column: "cep", filename: "ceps_nio" },
  { key: "ceps-tim", label: "CEPs Tim", column: "cep", filename: "ceps_tim" },
  {
    key: "cidades-promo-claro",
    label: "Cidades Promo Claro",
    column: "cidade",
    filename: "cidades_promo_claro",
  },
];

export function getResourceConfig(resource: string): AdminResourceConfig | null {
  return ADMIN_RESOURCES.find((item) => item.key === resource) ?? null;
}

export function normalizeCep(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 0) return null;
  const padded = digits.padStart(8, "0");
  if (padded.length !== 8) return null;
  return padded;
}

export function normalizeCity(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  return value.length > 0 ? value : null;
}

export function normalizeValue(resource: string, raw: unknown): string | null {
  const config = getResourceConfig(resource);
  if (!config) return null;
  if (config.column === "cep") return normalizeCep(raw);
  return normalizeCity(raw);
}

export function normalizeCpf(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 0) return null;
  const padded = digits.padStart(11, "0");
  if (padded.length !== 11) return null;
  return padded;
}

export function parsePositiveInt(raw: string | null, fallback: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}
