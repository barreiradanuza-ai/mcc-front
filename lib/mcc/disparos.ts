/**
 * Motor de envio de planilhas ao DataCrazy.
 *
 * Um "preset de disparo" diz para onde os leads vão (lista, tag, etapa do funil)
 * e como as colunas da planilha viram campos do lead. O envio roda em segundo
 * plano, com progresso em memória e o resultado gravado em disparo_envios.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  dcCreateBusiness,
  dcCreateLead,
  dcCreateTag,
  dcTags,
  dcFindLeadByPhone,
  dcFindLeadByTaxId,
  dcLeadHasBusinessInStage,
  dcUpdateLead,
  idsOf,
  onlyDigits,
  toE164BR,
  type DcLead,
} from "@/lib/mcc/datacrazy";

// ---------------------------------------------------------------------------
// Mapeamento
// ---------------------------------------------------------------------------

/** Campos do lead no DataCrazy que podem receber uma coluna da planilha. */
export const LEAD_FIELDS = [
  { key: "name", label: "Nome", required: true },
  { key: "phone", label: "Telefone (WhatsApp)", required: true },
  { key: "taxId", label: "CPF" },
  { key: "email", label: "E-mail" },
  { key: "zip", label: "CEP" },
  { key: "address", label: "Logradouro" },
  { key: "number", label: "Número" },
  { key: "complement", label: "Complemento" },
  { key: "block", label: "Bairro" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF" },
] as const;

export type LeadFieldKey = (typeof LEAD_FIELDS)[number]["key"];

export interface Mapeamento {
  /** campo do lead -> nome da coluna na planilha */
  campos: Partial<Record<LeadFieldKey, string>>;
  /** colunas copiadas para as observações do lead, no formato "Coluna: valor" */
  observacoes: string[];
}

/** Cabeçalhos da planilha processada pelo portal (saída de /mcc). */
export const COLUNAS_PADRAO = [
  "NOME", "CPF", "CONTATO", "Número da ordem de trabalho", "ID Companhia", "Macro Atividade", "Número SA",
  "Estado", "Tipo Logradouro", "Número", "Tipo Complemento", "Abrev. Tipo Comp.", "Bairro", "Logradouro", "CEP",
  "Serviço", "Velocidade Contratada", "Observações", "UF", "Cobertura", "Claro", "Nio", "Tim", "Claro Promo",
];

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/** Sugere um mapeamento a partir dos cabeçalhos de uma planilha. */
export function sugerirMapeamento(headers: string[]): Mapeamento {
  const find = (...cands: string[]) => {
    for (const c of cands) {
      const h = headers.find((x) => norm(x) === norm(c));
      if (h) return h;
    }
    return undefined;
  };
  const campos: Mapeamento["campos"] = {
    name: find("NOME", "Nome", "Cliente"),
    phone: find("CONTATO", "Telefone", "Celular", "WhatsApp", "Fone"),
    taxId: find("CPF", "CPF Criado", "Documento"),
    email: find("EMAIL", "E-mail"),
    zip: find("CEP"),
    address: find("Logradouro", "Endereço", "Rua"),
    number: find("Número", "Numero", "Nº"),
    complement: find("Abrev. Tipo Comp.", "Complemento"),
    block: find("Bairro"),
    city: find("Cidade", "Município", "Municipio"),
    state: find("UF", "Estado"),
  };
  for (const k of Object.keys(campos) as LeadFieldKey[]) if (!campos[k]) delete campos[k];
  // Todas as demais colunas vão para as observações do lead (nada se perde).
  const usadas = new Set(Object.values(campos).map((c) => norm(c)));
  const observacoes = headers.filter((h) => h.trim() !== "" && !usadas.has(norm(h)));
  return { campos, observacoes };
}

export function parseMapeamento(v: unknown): Mapeamento {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Mapeamento>;
  const campos: Mapeamento["campos"] = {};
  const src = (o.campos && typeof o.campos === "object" ? o.campos : {}) as Record<string, unknown>;
  for (const f of LEAD_FIELDS) {
    const col = src[f.key];
    if (typeof col === "string" && col.trim()) campos[f.key] = col.trim();
  }
  const observacoes = Array.isArray(o.observacoes) ? o.observacoes.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  return { campos, observacoes };
}

export function validarMapeamento(m: Mapeamento): string | null {
  if (!m.campos.name) return 'O campo "Nome" precisa de uma coluna';
  if (!m.campos.phone) return 'O campo "Telefone (WhatsApp)" precisa de uma coluna';
  return null;
}

// ---------------------------------------------------------------------------
// Preset
// ---------------------------------------------------------------------------

export interface PresetEnvio {
  id: number | null;
  nome: string;
  listaId: string | null;
  /** tag já resolvida (id) — no modo "por_envio" é preenchida ao iniciar o envio */
  tagId: string | null;
  tagNome?: string | null;
  stageId: string | null;
  origem: string | null;
  filtroColuna: string | null;
  filtroValor: string | null;
  mapeamento: Mapeamento;
}

// ---------------------------------------------------------------------------
// Linha da planilha -> lead
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function cell(row: Row, col: string | undefined): string {
  if (!col) return "";
  const direct = row[col];
  if (direct !== undefined) return String(direct ?? "").trim();
  const k = Object.keys(row).find((h) => norm(h) === norm(col));
  return k ? String(row[k] ?? "").trim() : "";
}

export function formatCpf(raw: string): string {
  const d = onlyDigits(raw).padStart(11, "0").slice(-11);
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : raw;
}

function formatCep(raw: string): string {
  const d = onlyDigits(raw).padStart(8, "0").slice(-8);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : raw;
}

export interface LeadMontado {
  nome: string;
  telefone: string;
  cpfDigits: string | null;
  payload: Record<string, unknown>;
  notas: string;
}

export function montarLead(row: Row, preset: PresetEnvio): LeadMontado | { erro: string } {
  const m = preset.mapeamento;
  const nome = cell(row, m.campos.name);
  const telefone = toE164BR(cell(row, m.campos.phone));
  if (!nome) return { erro: "Nome vazio" };
  if (!telefone) return { erro: "Telefone inválido" };

  const cpfRaw = cell(row, m.campos.taxId);
  const cpfDigits = cpfRaw ? onlyDigits(cpfRaw).padStart(11, "0").slice(-11) : null;

  const addr: Record<string, string> = {};
  const zip = cell(row, m.campos.zip);
  if (zip) addr.zip = formatCep(zip);
  const logradouro = cell(row, m.campos.address);
  if (logradouro) addr.address = logradouro;
  const numero = cell(row, m.campos.number);
  if (numero) addr.number = numero;
  const compl = cell(row, m.campos.complement);
  if (compl) addr.complement = compl;
  const bairro = cell(row, m.campos.block);
  if (bairro) addr.block = bairro;
  const cidade = cell(row, m.campos.city);
  if (cidade) addr.city = cidade;
  const uf = cell(row, m.campos.state);
  if (uf) addr.state = uf.toUpperCase().slice(0, 2);

  const notas = m.observacoes
    .map((c) => {
      const v = cell(row, c);
      return v ? `${c}: ${v}` : "";
    })
    .filter(Boolean)
    .join("\n");

  const payload: Record<string, unknown> = { name: nome, phone: telefone, type: "PERSON" };
  if (cpfDigits && cpfDigits.length === 11) payload.taxId = formatCpf(cpfDigits);
  const email = cell(row, m.campos.email);
  if (email) payload.email = email;
  if (Object.keys(addr).length) payload.addresses = [{ ...addr, country: "BR", isPrimary: true }];
  if (preset.origem) payload.source = preset.origem;
  if (notas) payload.notes = notas;

  return { nome, telefone, cpfDigits, payload, notas };
}

export function passaFiltro(row: Row, preset: PresetEnvio): boolean {
  if (!preset.filtroColuna) return true;
  const v = cell(row, preset.filtroColuna);
  const alvo = preset.filtroValor ?? "";
  if (!alvo) return v !== "";
  return norm(v) === norm(alvo);
}

// ---------------------------------------------------------------------------
// Tag por envio
// ---------------------------------------------------------------------------

/** Nome base do arquivo, sem extensão e sem sufixos gerados pelo portal. */
export function nomeBaseArquivo(arquivo: string): string {
  return arquivo
    .replace(/\.[^.]+$/, "")
    .replace(/_(cobertura|adequada(_cobertura)?)$/i, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

/** Expande {arquivo}, {data} (DDMMAAAA), {dataiso} (AAAA-MM-DD) e {hora} (HHMM). */
export function resolverNomeTag(padrao: string | null | undefined, arquivo: string, agora = new Date()): string {
  const dd = String(agora.getDate()).padStart(2, "0");
  const mm = String(agora.getMonth() + 1).padStart(2, "0");
  const yyyy = String(agora.getFullYear());
  const hh = String(agora.getHours()).padStart(2, "0");
  const mi = String(agora.getMinutes()).padStart(2, "0");
  const nome = (padrao || "api_{arquivo}")
    .replace(/\{arquivo\}/gi, nomeBaseArquivo(arquivo))
    .replace(/\{data\}/gi, `${dd}${mm}${yyyy}`)
    .replace(/\{dataiso\}/gi, `${yyyy}-${mm}-${dd}`)
    .replace(/\{hora\}/gi, `${hh}${mi}`)
    .trim();
  return nome.slice(0, 100);
}

/** Garante que a tag existe no DataCrazy (procura pelo nome; cria se não houver). */
export async function garantirTag(nome: string): Promise<{ id: string; name: string; criada: boolean }> {
  const alvo = norm(nome);
  const existentes = await dcTags();
  const achada = existentes.find((t) => norm(t.name) === alvo);
  if (achada) return { id: achada.id, name: achada.name, criada: false };
  const nova = await dcCreateTag(nome);
  return { id: nova.id, name: nova.name, criada: true };
}

// ---------------------------------------------------------------------------
// Job em memória
// ---------------------------------------------------------------------------

export type EnvioStatus = "pending" | "processing" | "done" | "error" | "cancelled";

export interface ErroLinha {
  linha: number;
  nome: string;
  telefone: string;
  erro: string;
}

export interface EnvioJob {
  id: number;
  status: EnvioStatus;
  progressMsg: string;
  tagNome: string | null;
  processed: number;
  total: number;
  filtrados: number;
  criados: number;
  atualizados: number;
  falhas: number;
  erros: ErroLinha[];
  cancel: boolean;
  createdAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __mccEnvioJobs: Map<number, EnvioJob> | undefined;
}

function store(): Map<number, EnvioJob> {
  if (!globalThis.__mccEnvioJobs) globalThis.__mccEnvioJobs = new Map();
  return globalThis.__mccEnvioJobs;
}

export function getEnvioJob(id: number): EnvioJob | undefined {
  return store().get(id);
}

export function cancelEnvioJob(id: number): boolean {
  const j = store().get(id);
  if (!j || (j.status !== "processing" && j.status !== "pending")) return false;
  j.cancel = true;
  return true;
}

export function hasRunningEnvio(): boolean {
  for (const j of store().values()) if (j.status === "processing" || j.status === "pending") return true;
  return false;
}

const JOB_TTL_MS = 6 * 60 * 60 * 1000;
function cleanup() {
  const now = Date.now();
  for (const [id, j] of store()) if (now - j.createdAt > JOB_TTL_MS && j.status !== "processing") store().delete(id);
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

export async function iniciarEnvio(rows: Row[], arquivo: string, preset: PresetEnvio): Promise<EnvioJob> {
  cleanup();
  const registro = await prisma.disparoEnvio.create({
    data: {
      presetId: preset.id,
      presetNome: preset.nome,
      arquivo: arquivo.slice(0, 255),
      tagNome: preset.tagNome ?? null,
      status: "processing",
      total: rows.length,
    },
  });
  const job: EnvioJob = {
    id: registro.id,
    status: "pending",
    progressMsg: "Preparando envio...",
    tagNome: preset.tagNome ?? null,
    processed: 0,
    total: rows.length,
    filtrados: 0,
    criados: 0,
    atualizados: 0,
    falhas: 0,
    erros: [],
    cancel: false,
    createdAt: Date.now(),
  };
  store().set(job.id, job);
  void executar(job, rows, preset);
  return job;
}

async function persistir(job: EnvioJob, extra: { status: string; mensagem?: string; finished?: boolean }) {
  try {
    await prisma.disparoEnvio.update({
      where: { id: job.id },
      data: {
        status: extra.status,
        filtrados: job.filtrados,
        criados: job.criados,
        atualizados: job.atualizados,
        falhas: job.falhas,
        mensagem: extra.mensagem ?? null,
        erros: job.erros.slice(0, 2000) as unknown as Prisma.InputJsonValue,
        ...(extra.finished ? { finishedAt: new Date() } : {}),
      },
    });
  } catch (e) {
    console.error(`[envio:${job.id}] falha ao gravar histórico`, e);
  }
}

async function executar(job: EnvioJob, rows: Row[], preset: PresetEnvio) {
  job.status = "processing";
  const t0 = Date.now();
  let lastPersist = Date.now();

  try {
    for (let i = 0; i < rows.length; i++) {
      if (job.cancel) {
        job.status = "cancelled";
        job.progressMsg = `Cancelado após ${job.processed} de ${job.total} linhas.`;
        await persistir(job, { status: "cancelled", mensagem: job.progressMsg, finished: true });
        return;
      }

      const row = rows[i];
      const linha = i + 2; // linha na planilha (1 = cabeçalho)
      job.processed = i + 1;

      if (!passaFiltro(row, preset)) {
        job.filtrados++;
        continue;
      }

      const montado = montarLead(row, preset);
      if ("erro" in montado) {
        job.falhas++;
        job.erros.push({ linha, nome: cell(row, preset.mapeamento.campos.name), telefone: cell(row, preset.mapeamento.campos.phone), erro: montado.erro });
        continue;
      }

      job.progressMsg = `Enviando ${job.processed}/${job.total}: ${montado.nome}`;

      try {
        await enviarLead(montado, preset, job);
      } catch (e) {
        job.falhas++;
        job.erros.push({ linha, nome: montado.nome, telefone: montado.telefone, erro: e instanceof Error ? e.message : String(e) });
      }

      if (Date.now() - lastPersist > 15000) {
        lastPersist = Date.now();
        await persistir(job, { status: "processing" });
      }
    }

    const seg = Math.round((Date.now() - t0) / 1000);
    job.status = "done";
    job.progressMsg = `Concluído em ${seg}s: ${job.criados} criados, ${job.atualizados} atualizados, ${job.falhas} falhas, ${job.filtrados} fora do filtro.`;
    await persistir(job, { status: "done", mensagem: job.progressMsg, finished: true });
  } catch (e) {
    job.status = "error";
    job.progressMsg = e instanceof Error ? e.message : "Erro no envio";
    await persistir(job, { status: "error", mensagem: job.progressMsg, finished: true });
  }
}

async function enviarLead(l: LeadMontado, preset: PresetEnvio, job: EnvioJob) {
  // 1) Procura o lead pelo telefone (e, se não achar, pelo CPF) para não duplicar.
  let lead: DcLead | null = await dcFindLeadByPhone(l.telefone);
  if (!lead && l.cpfDigits) lead = await dcFindLeadByTaxId(l.cpfDigits);

  const tagIds = preset.tagId ? [preset.tagId] : [];
  const listIds = preset.listaId ? [preset.listaId] : [];

  if (!lead) {
    const payload: Record<string, unknown> = { ...l.payload };
    if (tagIds.length) payload.tags = tagIds.map((id) => ({ id }));
    if (listIds.length) payload.lists = listIds.map((id) => ({ id }));
    lead = await dcCreateLead(payload);
    job.criados++;
  } else {
    // Mescla tags/listas existentes com as do preset; atualiza dados cadastrais sem apagar nada.
    const tagsAtuais = idsOf(lead.tags);
    const listasAtuais = idsOf(lead.lists);
    const patch: Record<string, unknown> = {};
    for (const k of ["taxId", "email", "addresses", "source"]) {
      if (l.payload[k] !== undefined && (lead[k] === undefined || lead[k] === null || lead[k] === "")) patch[k] = l.payload[k];
    }
    if (l.notas) {
      const atuais = String(lead.notes ?? "");
      if (!atuais.includes(l.notas)) patch.notes = atuais ? `${atuais}\n${l.notas}` : l.notas;
    }
    const novasTags = tagIds.filter((id) => !tagsAtuais.includes(id));
    const novasListas = listIds.filter((id) => !listasAtuais.includes(id));
    if (novasTags.length) patch.tags = [...tagsAtuais, ...novasTags].map((id) => ({ id }));
    if (novasListas.length) patch.lists = [...listasAtuais, ...novasListas].map((id) => ({ id }));
    if (Object.keys(patch).length) await dcUpdateLead(lead.id, patch);
    job.atualizados++;
  }

  // 2) Negócio na etapa do funil escolhida (se o preset tiver etapa).
  if (preset.stageId) {
    const ja = await dcLeadHasBusinessInStage(lead.id, preset.stageId);
    if (!ja) await dcCreateBusiness(lead.id, preset.stageId, l.cpfDigits ? `mcc-${l.cpfDigits}-${preset.id ?? 0}` : undefined);
  }
}
