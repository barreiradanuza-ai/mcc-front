import { prisma } from "@/lib/db";
import { COLUNAS_PADRAO, parseMapeamento, sugerirMapeamento, validarMapeamento } from "@/lib/mcc/disparos";
import { datacrazyConfigured, dcCamposAdicionais, dcPipelines, dcTags } from "@/lib/mcc/datacrazy";
import type { Prisma } from "@/lib/generated/prisma/client";

export const PRESET_PADRAO_NOME = "Disparo API — Qualificação";
const FUNIL_PADRAO = "qualificacao";
// Como a operação já faz hoje: leads de disparo entram em "Lead API" com a tag fixa LEAD_COM_CPF.
const ETAPAS_PADRAO = ["lead api", "disparo api", "disparo"];
const TAG_FIXA_PADRAO = "lead_com_cpf";
const ORIGEM_LEAD_CAMPO = "origem do lead";
const ORIGEM_LEAD_VALOR = "Disparo API";

const normName = (v: unknown) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Cria o preset padrão quando ainda não existe nenhum: funil "Qualificação",
 * etapa "Disparo API", tag nova a cada envio ({arquivo}) e todas as colunas
 * da planilha do portal mapeadas. Se o funil/etapa não forem encontrados no
 * DataCrazy, o preset é criado sem etapa (ajustável na tela).
 */
export async function garantirPresetPadrao(): Promise<void> {
  const total = await prisma.disparoPreset.count();
  if (total > 0) return;

  let pipelineId: string | null = null, pipelineNome: string | null = null, stageId: string | null = null, stageNome: string | null = null;
  let tagId: string | null = null, tagNome: string | null = null;
  const fixos: Record<string, string> = {};
  if (datacrazyConfigured()) {
    try {
      const pipes = await dcPipelines();
      const funil = pipes.find((p) => normName(p.name) === FUNIL_PADRAO) ?? pipes.find((p) => normName(p.name).includes(FUNIL_PADRAO));
      let etapa = undefined;
      for (const nome of ETAPAS_PADRAO) { etapa = funil?.stages.find((s) => normName(s.name) === nome); if (etapa) break; }
      if (funil) { pipelineId = funil.id; pipelineNome = funil.name; }
      if (etapa) { stageId = etapa.id; stageNome = etapa.name; }
    } catch (e) {
      console.warn("[disparos] não foi possível ler funis do DataCrazy para o preset padrão:", e instanceof Error ? e.message : e);
    }
    try {
      const tag = (await dcTags()).find((t) => normName(t.name) === TAG_FIXA_PADRAO);
      if (tag) { tagId = tag.id; tagNome = tag.name; }
    } catch { /* sem tag fixa */ }
    try {
      const origem = (await dcCamposAdicionais()).find((f) => normName(f.name) === ORIGEM_LEAD_CAMPO);
      if (origem) fixos[origem.id] = ORIGEM_LEAD_VALOR;
    } catch { /* sem campo de origem */ }
  }

  const mapeamento = { ...sugerirMapeamento(COLUNAS_PADRAO), fixos };
  await prisma.disparoPreset.create({
    data: {
      nome: PRESET_PADRAO_NOME,
      descricao: "Sobe a base processada para o funil Qualificação (etapa Lead API), com a tag fixa LEAD_COM_CPF, uma tag nova por base e todos os campos mapeados.",
      tagModo: "por_envio",
      tagPadrao: "{arquivo}",
      tagId, tagNome,
      pipelineId, pipelineNome, stageId, stageNome,
      origem: "Disparo API",
      mapeamento: mapeamento as unknown as Prisma.InputJsonValue,
    },
  });
}

const str = (v: unknown, max = 160): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

/** Valida e normaliza o corpo de criação/edição de preset. */
export function lerPreset(body: Record<string, unknown>) {
  const nome = str(body.nome, 120);
  if (!nome) return { erro: "Informe o nome do disparo" } as const;
  const mapeamento = parseMapeamento(body.mapeamento);
  const erroMap = validarMapeamento(mapeamento);
  if (erroMap) return { erro: erroMap } as const;
  const listaId = str(body.listaId, 80);
  // Tag fixa (opcional) e tag por envio (opcional) podem coexistir.
  const tagModo = body.tagModo === "fixa" ? "fixa" : "por_envio";
  const tagId = str(body.tagId, 80);
  const tagPadrao = tagModo === "por_envio" ? str(body.tagPadrao, 160) || "{arquivo}" : null;
  if (tagModo === "fixa" && !tagId) return { erro: "Escolha a tag fixa ou ative a tag por envio" } as const;
  const stageId = str(body.stageId, 80);
  return {
    data: {
      nome,
      descricao: str(body.descricao, 2000),
      listaId,
      listaNome: str(body.listaNome),
      tagId,
      tagNome: tagId ? str(body.tagNome) : null,
      tagModo,
      tagPadrao,
      pipelineId: str(body.pipelineId, 80),
      pipelineNome: str(body.pipelineNome),
      stageId,
      stageNome: str(body.stageNome),
      origem: str(body.origem, 120),
      filtroColuna: str(body.filtroColuna, 120),
      filtroValor: str(body.filtroValor, 120),
      mapeamento: mapeamento as unknown as Prisma.InputJsonValue,
    },
  } as const;
}

