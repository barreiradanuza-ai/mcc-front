/**
 * Cliente da API do DataCrazy (CRM) usado pela área de Disparos.
 *
 * Configuração por variáveis de ambiente:
 *   DATACRAZY_TOKEN  — chave de API (obrigatória)
 *   DATACRAZY_URL    — base da API (padrão https://api.g1.datacrazy.io)
 *
 * A API limita 60 chamadas/minuto por rota e devolve 429 com Retry-After.
 * Espaçamos as chamadas por rota e respeitamos o Retry-After.
 */

const DEFAULT_BASE = "https://api.g1.datacrazy.io";

export function datacrazyBase(): string {
  return (process.env.DATACRAZY_URL || DEFAULT_BASE).replace(/\/$/, "");
}

export function datacrazyToken(): string {
  return process.env.DATACRAZY_TOKEN || "";
}

export function datacrazyConfigured(): boolean {
  return Boolean(datacrazyToken());
}

export class DataCrazyError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Espaçamento mínimo entre chamadas de uma mesma rota (60/min => 1000 ms).
const ROUTE_SPACING_MS = Number(process.env.DATACRAZY_ESPACO_MS || 1050);
const lastCallByRoute = new Map<string, number>();

function routeKey(method: string, path: string): string {
  // /api/v1/leads/123 e /api/v1/leads/456 contam como a mesma rota
  const clean = path.split("?")[0].replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/:id");
  return `${method} ${clean}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function dcApi<T = unknown>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
  const token = datacrazyToken();
  if (!token) throw new DataCrazyError("DATACRAZY_TOKEN não configurado", 0);

  const key = routeKey(method, path);
  const wait = (lastCallByRoute.get(key) ?? 0) + ROUTE_SPACING_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallByRoute.set(key, Date.now());

  const res = await fetch(datacrazyBase() + path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "access-token": token,
      accept: "application/json",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 300) };
  }

  if (res.status === 429) {
    if (attempt >= 4) throw new DataCrazyError("Limite de chamadas do DataCrazy excedido", 429);
    const retry = Number(res.headers.get("retry-after") || 30);
    await sleep(Math.min(Math.max(retry, 1), 120) * 1000);
    return dcApi<T>(method, path, body, attempt + 1);
  }

  if (!res.ok) {
    const msg =
      (json && typeof json === "object" && "message" in json && String((json as { message: unknown }).message)) ||
      JSON.stringify(json).slice(0, 200);
    throw new DataCrazyError(`DataCrazy ${res.status} em ${method} ${path.split("?")[0]}: ${msg}`, res.status);
  }
  return json as T;
}

/** Normaliza a resposta de listagem (a API às vezes devolve {data:[...]}, às vezes um array). */
export function dcList<T = Record<string, unknown>>(j: unknown): T[] {
  if (Array.isArray(j)) return j as T[];
  if (j && typeof j === "object") {
    const o = j as Record<string, unknown>;
    for (const k of ["data", "items", "results"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Tipos (apenas os campos que usamos)
// ---------------------------------------------------------------------------

export interface DcNamed {
  id: string;
  name: string;
  color?: string;
  description?: string;
}

export interface DcStage extends DcNamed {
  pipelineId?: string;
  order?: number;
}

export interface DcPipeline extends DcNamed {
  stages: DcStage[];
}

export interface DcLead {
  id: string;
  name?: string;
  phone?: string;
  rawPhone?: string;
  taxId?: string;
  tags?: DcNamed[] | DcNamed;
  lists?: DcNamed[];
  [k: string]: unknown;
}

export interface DcOptions {
  listas: DcNamed[];
  tags: DcNamed[];
  pipelines: DcPipeline[];
}

// ---------------------------------------------------------------------------
// Catálogo (listas, tags, funis/etapas)
// ---------------------------------------------------------------------------

async function fetchAllPages<T>(path: string, take = 200, max = 2000): Promise<T[]> {
  const out: T[] = [];
  for (let skip = 0; skip < max; skip += take) {
    const sep = path.includes("?") ? "&" : "?";
    const page = dcList<T>(await dcApi("GET", `${path}${sep}take=${take}&skip=${skip}`));
    out.push(...page);
    if (page.length < take) break;
  }
  return out;
}

export async function dcListas(): Promise<DcNamed[]> {
  return (await fetchAllPages<DcNamed>("/api/v1/lists")).map((l) => ({ id: l.id, name: l.name, color: l.color, description: l.description }));
}

export async function dcTags(): Promise<DcNamed[]> {
  return (await fetchAllPages<DcNamed>("/api/v1/tags")).map((t) => ({ id: t.id, name: t.name, color: t.color, description: t.description }));
}

export async function dcPipelines(): Promise<DcPipeline[]> {
  const pipes = dcList<Record<string, unknown>>(await dcApi("GET", "/api/v1/pipelines?take=200"));
  const out: DcPipeline[] = [];
  for (const p of pipes) {
    let stages = Array.isArray(p.stages) ? (p.stages as DcStage[]) : null;
    if (!stages) {
      try {
        stages = dcList<DcStage>(await dcApi("GET", `/api/v1/pipelines/${p.id}/stages?take=200`));
      } catch {
        stages = [];
      }
    }
    out.push({
      id: String(p.id),
      name: String(p.name ?? p.title ?? ""),
      stages: stages.map((s) => ({ id: String(s.id), name: String(s.name ?? ""), order: s.order })),
    });
  }
  return out;
}

export async function dcOptions(): Promise<DcOptions> {
  const [listas, tags, pipelines] = await Promise.all([dcListas(), dcTags(), dcPipelines()]);
  return { listas, tags, pipelines };
}

export async function dcCreateTag(name: string): Promise<DcNamed> {
  const r = (await dcApi("POST", "/api/v1/tags", { name })) as Record<string, unknown>;
  const data = (r.data as Record<string, unknown>) || r;
  return { id: String(data.id), name: String(data.name ?? name) };
}

export async function dcCreateLista(name: string, description?: string): Promise<DcNamed> {
  const r = (await dcApi("POST", "/api/v1/lists", { name, ...(description ? { description } : {}) })) as Record<string, unknown>;
  const data = (r.data as Record<string, unknown>) || r;
  return { id: String(data.id), name: String(data.name ?? name) };
}

// ---------------------------------------------------------------------------
// Leads e negócios
// ---------------------------------------------------------------------------

export const onlyDigits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** Telefone no formato E.164 brasileiro (+55DDDNÚMERO) ou null se inválido. */
export function toE164BR(raw: unknown): string | null {
  let d = onlyDigits(raw);
  if (!d) return null;
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!d.startsWith("55") || d.length < 12) {
    if (d.length === 10 || d.length === 11) d = "55" + d;
  }
  if (d.length < 12 || d.length > 13) return null;
  return "+" + d;
}

export async function dcFindLeadByPhone(phoneE164: string): Promise<DcLead | null> {
  const digits = onlyDigits(phoneE164);
  const last8 = digits.slice(-8);
  const variants = [digits, digits.replace(/^55/, "")];
  for (const v of variants) {
    const leads = dcList<DcLead>(
      await dcApi("GET", `/api/v1/leads?searchType=phone&search=${encodeURIComponent(v)}&take=10&skip=0`),
    );
    const hit = leads.find((l) => onlyDigits(l.rawPhone || l.phone).endsWith(last8));
    if (hit) return hit;
  }
  return null;
}

export async function dcFindLeadByTaxId(taxId: string): Promise<DcLead | null> {
  const digits = onlyDigits(taxId);
  if (!digits) return null;
  const leads = dcList<DcLead>(
    await dcApi("GET", `/api/v1/leads?searchType=taxId&search=${encodeURIComponent(digits)}&take=10&skip=0`),
  );
  return leads.find((l) => onlyDigits(l.taxId) === digits) ?? null;
}

export async function dcCreateLead(payload: Record<string, unknown>): Promise<DcLead> {
  const r = (await dcApi("POST", "/api/v1/leads", payload)) as Record<string, unknown>;
  const data = (r.data as DcLead) || (r as DcLead);
  if (!data || !data.id) throw new DataCrazyError("DataCrazy não devolveu o id do lead criado", 500);
  return data;
}

export async function dcUpdateLead(id: string, payload: Record<string, unknown>): Promise<void> {
  await dcApi("PATCH", `/api/v1/leads/${id}`, payload);
}

export async function dcCreateBusiness(leadId: string, stageId: string, externalId?: string): Promise<void> {
  await dcApi("POST", "/api/v1/businesses", { leadId, stageId, ...(externalId ? { externalId } : {}) });
}

/** Verifica se o lead já tem negócio aberto na etapa informada (evita duplicar). */
export async function dcLeadHasBusinessInStage(leadId: string, stageId: string): Promise<boolean> {
  try {
    const bs = dcList<Record<string, unknown>>(await dcApi("GET", `/api/v1/leads/${leadId}/businesses?take=50`));
    return bs.some((b) => b.stageId === stageId && b.status !== "lost");
  } catch {
    return false;
  }
}

export function idsOf(v: unknown): string[] {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => (x && typeof x === "object" ? String((x as { id?: unknown }).id ?? "") : String(x))).filter(Boolean);
}
