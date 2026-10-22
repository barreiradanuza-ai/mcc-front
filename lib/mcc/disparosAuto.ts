/**
 * Envio automático: ao terminar o processamento de uma planilha em /mcc, o
 * portal pode subir a base para o DataCrazy sozinho, usando um disparo padrão.
 */
import { prisma } from "@/lib/db";
import { datacrazyConfigured } from "@/lib/mcc/datacrazy";
import { getDcOptionsCached } from "@/lib/mcc/dcCache";
import {
  consultarEnviados,
  garantirTag,
  hasRunningEnvio,
  iniciarEnvio,
  parseMapeamento,
  resolverNomeTag,
  validarMapeamento,
  type PresetEnvio,
} from "@/lib/mcc/disparos";

const CONFIG_KEY = "disparo_auto";

export interface DisparoAutoConfig {
  ativo: boolean;
  presetId: number | null;
  /** não reenviar quem já foi enviado antes (padrão: true) */
  pularEnviados: boolean;
}

export async function lerConfigAuto(): Promise<DisparoAutoConfig> {
  const row = await prisma.appConfig.findUnique({ where: { key: CONFIG_KEY } });
  const def: DisparoAutoConfig = { ativo: false, presetId: null, pularEnviados: true };
  if (!row) return def;
  try {
    const j = JSON.parse(row.value) as Partial<DisparoAutoConfig>;
    return {
      ativo: Boolean(j.ativo),
      presetId: Number.isInteger(j.presetId) ? (j.presetId as number) : null,
      pularEnviados: j.pularEnviados !== false,
    };
  } catch {
    return def;
  }
}

export async function salvarConfigAuto(cfg: DisparoAutoConfig): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: JSON.stringify(cfg) },
    update: { value: JSON.stringify(cfg) },
  });
}

/**
 * Monta o PresetEnvio a partir de um preset salvo, resolvendo a tag da base.
 * Lança Error com mensagem amigável em caso de problema.
 */
export async function prepararPreset(presetId: number, arquivo: string, tagNomeInformado?: string): Promise<PresetEnvio> {
  const p = await prisma.disparoPreset.findUnique({ where: { id: presetId } });
  if (!p) throw new Error("Disparo não encontrado");

  let tagId: string | null = null;
  let tagNome: string | null = null;
  if (p.tagModo === "por_envio") {
    const nome = (tagNomeInformado || "").trim() || resolverNomeTag(p.tagPadrao, arquivo);
    if (!nome) throw new Error("Informe o nome da tag deste envio");
    const t = await garantirTag(nome);
    tagId = t.id;
    tagNome = t.name;
  }

  let camposAdicionais;
  try {
    camposAdicionais = (await getDcOptionsCached()).campos;
  } catch {
    camposAdicionais = undefined;
  }

  const mapeamento = parseMapeamento(p.mapeamento);

  return {
    id: p.id,
    nome: p.nome,
    camposAdicionais,
    listaId: p.listaId,
    tagFixaId: p.tagId,
    tagId,
    tagNome: tagNome ?? p.tagNome,
    stageId: p.stageId,
    origem: p.origem,
    flowId: p.flowId,
    flowNome: p.flowNome,
    impulsoModo: (p.impulsoModo as "nao" | "criar" | "criar_e_iniciar") ?? "criar",
    filtroColuna: p.filtroColuna,
    filtroValor: p.filtroValor,
    mapeamento,
  };
}

/**
 * Dispara o envio automático de uma planilha processada. Devolve o id do envio,
 * ou null com o motivo quando não foi possível/necessário.
 */
export async function envioAutomatico(
  headers: string[],
  rows: Record<string, unknown>[],
  arquivo: string,
): Promise<{ envioId: number | null; motivo?: string; tagNome?: string | null; selecionadas?: number }> {
  const cfg = await lerConfigAuto();
  if (!cfg.ativo || !cfg.presetId) return { envioId: null, motivo: "Envio automático desligado" };
  if (!datacrazyConfigured()) return { envioId: null, motivo: "DATACRAZY_TOKEN não configurado" };
  if (hasRunningEnvio()) return { envioId: null, motivo: "Já existe um envio em andamento" };
  if (rows.length === 0) return { envioId: null, motivo: "Nenhuma linha com cobertura para enviar" };

  let preset: PresetEnvio;
  try {
    preset = await prepararPreset(cfg.presetId, arquivo);
  } catch (e) {
    return { envioId: null, motivo: e instanceof Error ? e.message : String(e) };
  }
  const erroMap = validarMapeamento(preset.mapeamento);
  if (erroMap) return { envioId: null, motivo: `Disparo "${preset.nome}": ${erroMap}` };

  // Confere as colunas obrigatórias nesta planilha.
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  for (const k of ["name", "phone"] as const) {
    const col = preset.mapeamento.campos[k];
    if (!col || !headers.some((h) => norm(h) === norm(col))) {
      return { envioId: null, motivo: `A planilha não tem a coluna "${col ?? (k === "name" ? "Nome" : "Telefone")}" exigida pelo disparo "${preset.nome}"` };
    }
  }

  // Pula quem já foi enviado antes.
  let indices = rows.map((_, i) => i);
  if (cfg.pularEnviados) {
    try {
      const enviados = await consultarEnviados(rows, preset.mapeamento.campos.phone, preset.mapeamento.campos.taxId);
      indices = indices.filter((i) => !enviados[i]);
    } catch {
      /* segue sem o filtro */
    }
  }
  if (indices.length === 0) return { envioId: null, motivo: "Todas as linhas já haviam sido enviadas ao DataCrazy" };

  const selecionadas = indices.map((i) => rows[i]);
  const job = await iniciarEnvio(selecionadas, arquivo, preset, { headers, rows, indices });
  return { envioId: job.id, tagNome: job.tagNome, selecionadas: selecionadas.length };
}
