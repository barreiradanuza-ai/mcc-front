/**
 * Retorno de uma base enviada: cruza os negócios do DataCrazy (por tag) com as
 * etapas do funil para mostrar quem respondeu, avançou, virou venda ou perdeu.
 */
import { dcApi, dcList, dcTags } from "@/lib/mcc/datacrazy";

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// Classificação por nome de etapa (mesma lógica do painel de funil da Conecta Aqui).
const ENTRADA = ["lead api", "disparo", "disparo 2", "lead meta", "lead google", "novo"];
const VENDA = ["pendente de instalacao", "reagendar instalacao", "data_instalacao", "instalado", "pago", "m1", "m2", "m3", "m4", "pos-venda"];
const INSTALADO = ["instalado", "pago", "m1", "m2", "m3", "m4", "pos-venda"];
const PERDA_FUNIS = ["cancelamentos"];
const PERDA_ETAPAS = ["cpf_reprovado", "bloquear_contato", "blacklist", "sem interesse", "sem interacao template", "sem viabilidade"];

interface DcBusiness {
  id: string;
  status?: string;
  stageId?: string;
  leadId?: string;
  total?: number;
  lastMovedAt?: string;
  createdAt?: string;
  stage?: { id?: string; name?: string; pipeline?: { id?: string; name?: string } };
  lead?: {
    id?: string;
    name?: string;
    contacts?: { lastContactStatus?: { lastReceivedDate?: string | null; lastSendedDate?: string | null } | null }[];
  };
}

export interface ResultadoBase {
  tagNome: string;
  tagId: string | null;
  negocios: number;
  leads: number;
  mensagensEnviadas: number;
  responderam: number;
  avancaram: number;
  vendas: number;
  instalados: number;
  perdidos: number;
  valorVendas: number;
  porEtapa: { funil: string; etapa: string; qtd: number; grupo: "entrada" | "andamento" | "venda" | "perda" }[];
  atualizadoEm: string;
}

async function buscarNegociosPorTag(tagId: string, max = 10000): Promise<DcBusiness[]> {
  const out: DcBusiness[] = [];
  const take = 100;
  for (let skip = 0; skip < max; skip += take) {
    const page = dcList<DcBusiness>(await dcApi("GET", `/api/v1/businesses?take=${take}&skip=${skip}&filter%5Btags%5D=${encodeURIComponent(tagId)}`));
    out.push(...page);
    if (page.length < take) break;
  }
  return out;
}

function classificar(b: DcBusiness): "entrada" | "andamento" | "venda" | "perda" {
  const etapa = norm(b.stage?.name);
  const funil = norm(b.stage?.pipeline?.name);
  if (b.status === "lost" || PERDA_FUNIS.includes(funil) || PERDA_ETAPAS.includes(etapa)) return "perda";
  if (b.status === "won" || VENDA.includes(etapa)) return "venda";
  if (ENTRADA.includes(etapa)) return "entrada";
  return "andamento";
}

// Cache curto por tag (a consulta pode levar vários segundos pelo limite da API).
declare global {
  // eslint-disable-next-line no-var
  var __mccResultadosCache: Map<string, { at: number; data: ResultadoBase }> | undefined;
}
const CACHE_MS = 5 * 60 * 1000;

export async function resultadoDaBase(tagNome: string, refresh = false): Promise<ResultadoBase> {
  if (!globalThis.__mccResultadosCache) globalThis.__mccResultadosCache = new Map();
  const cache = globalThis.__mccResultadosCache;
  const key = norm(tagNome);
  const hit = cache.get(key);
  if (!refresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const tag = (await dcTags()).find((t) => norm(t.name) === key) ?? null;
  const vazio: ResultadoBase = {
    tagNome, tagId: tag?.id ?? null, negocios: 0, leads: 0, mensagensEnviadas: 0, responderam: 0, avancaram: 0,
    vendas: 0, instalados: 0, perdidos: 0, valorVendas: 0, porEtapa: [], atualizadoEm: new Date().toISOString(),
  };
  if (!tag) return vazio;

  const negocios = await buscarNegociosPorTag(tag.id);
  const leads = new Set<string>();
  const leadsResponderam = new Set<string>();
  const leadsMensagem = new Set<string>();
  const porEtapa = new Map<string, { funil: string; etapa: string; qtd: number; grupo: ResultadoBase["porEtapa"][number]["grupo"] }>();
  let avancaram = 0, vendas = 0, instalados = 0, perdidos = 0, valorVendas = 0;

  for (const b of negocios) {
    const leadId = b.leadId ?? b.lead?.id ?? b.id;
    leads.add(leadId);
    for (const c of b.lead?.contacts ?? []) {
      if (c.lastContactStatus?.lastSendedDate) leadsMensagem.add(leadId);
      if (c.lastContactStatus?.lastReceivedDate) leadsResponderam.add(leadId);
    }
    const grupo = classificar(b);
    if (grupo !== "entrada") avancaram++;
    if (grupo === "venda") { vendas++; valorVendas += Number(b.total) || 0; }
    if (INSTALADO.includes(norm(b.stage?.name))) instalados++;
    if (grupo === "perda") perdidos++;
    const funil = b.stage?.pipeline?.name?.trim() || "—";
    const etapa = b.stage?.name?.trim() || "—";
    const k = `${funil}|${etapa}`;
    const e = porEtapa.get(k) ?? { funil, etapa, qtd: 0, grupo };
    e.qtd++;
    porEtapa.set(k, e);
  }

  const data: ResultadoBase = {
    tagNome,
    tagId: tag.id,
    negocios: negocios.length,
    leads: leads.size,
    mensagensEnviadas: leadsMensagem.size,
    responderam: leadsResponderam.size,
    avancaram,
    vendas,
    instalados,
    perdidos,
    valorVendas: Math.round(valorVendas * 100) / 100,
    porEtapa: [...porEtapa.values()].sort((a, b) => b.qtd - a.qtd),
    atualizadoEm: new Date().toISOString(),
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}
