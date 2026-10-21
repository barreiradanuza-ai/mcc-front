import { prisma } from "@/lib/db";
import { COLUNAS_PADRAO, parseMapeamento, sugerirMapeamento, validarMapeamento } from "@/lib/mcc/disparos";
import { datacrazyConfigured, dcPipelines } from "@/lib/mcc/datacrazy";
import type { Prisma } from "@/lib/generated/prisma/client";

export const PRESET_PADRAO_NOME = "Disparo API — Qualificação";
const FUNIL_PADRAO = "qualificacao";
const ETAPA_PADRAO = "disparo api";

const normName = (v: unknown) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Cria o preset padrão quando ainda não existe nenhum: funil "Qualificação",
 * etapa "Disparo API", tag nova a cada envio (api_{arquivo}) e todas as colunas
 * da planilha do portal mapeadas. Se o funil/etapa não forem encontrados no
 * DataCrazy, o preset é criado sem etapa (ajustável na tela).
 */
export async function garantirPresetPadrao(): Promise<void> {
  const total = await prisma.disparoPreset.count();
  if (total > 0) return;

  let pipelineId: string | null = null, pipelineNome: string | null = null, stageId: string | null = null, stageNome: string | null = null;
  if (datacrazyConfigured()) {
    try {
      const pipes = await dcPipelines();
      const funil = pipes.find((p) => normName(p.name) === FUNIL_PADRAO) ?? pipes.find((p) => normName(p.name).includes(FUNIL_PADRAO));
      const etapa = funil?.stages.find((s) => normName(s.name) === ETAPA_PADRAO) ?? funil?.stages.find((s) => normName(s.name).includes("disparo"));
      if (funil) { pipelineId = funil.id; pipelineNome = funil.name; }
      if (etapa) { stageId = etapa.id; stageNome = etapa.name; }
    } catch (e) {
      console.warn("[disparos] não foi possível ler funis do DataCrazy para o preset padrão:", e instanceof Error ? e.message : e);
    }
  }

  const mapeamento = sugerirMapeamento(COLUNAS_PADRAO);
  await prisma.disparoPreset.create({
    data: {
      nome: PRESET_PADRAO_NOME,
      descricao: "Sobe a base processada para o funil Qualificação, etapa Disparo API, com tag nova a cada envio e todos os campos mapeados.",
      tagModo: "por_envio",
      tagPadrao: "api_{arquivo}",
      pipelineId, pipelineNome, stageId, stageNome,
      origem: "Disparo MCC",
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
  const tagModo = body.tagModo === "fixa" ? "fixa" : "por_envio";
  const tagId = tagModo === "fixa" ? str(body.tagId, 80) : null;
  const tagPadrao = tagModo === "por_envio" ? str(body.tagPadrao, 160) || "api_{arquivo}" : null;
  if (tagModo === "fixa" && !tagId) return { erro: "Escolha a tag fixa ou mude para tag por envio" } as const;
  const stageId = str(body.stageId, 80);
  return {
    data: {
      nome,
      descricao: str(body.descricao, 2000),
      listaId,
      listaNome: str(body.listaNome),
      tagId,
      tagNome: tagModo === "fixa" ? str(body.tagNome) : null,
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

