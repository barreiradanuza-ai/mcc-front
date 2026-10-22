"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Pencil, Plus, RefreshCw, Rocket, Send,
  Settings2, Trash2, Upload, XCircle, History, ListChecks, Tag, Workflow, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface DcNamed { id: string; name: string }
interface DcPipeline extends DcNamed { stages: DcNamed[] }
interface DcCampoAdicional { id: string; name: string; type: string; required?: boolean; options?: { label?: string; color?: string }[] | null }
interface DcOptions { configured: boolean; error?: string; listas?: DcNamed[]; tags?: DcNamed[]; pipelines?: DcPipeline[]; campos?: DcCampoAdicional[] }
interface Regra { coluna: string; op: "contem" | "nao_contem" | "igual" | "diferente" | "vazio" | "nao_vazio"; valor: string }

type LeadFieldKey = "name" | "phone" | "taxId" | "email" | "zip" | "address" | "number" | "complement" | "block" | "city" | "state";
const LEAD_FIELDS: { key: LeadFieldKey; label: string; required?: boolean }[] = [
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
];

const COLUNAS_PADRAO = [
  "NOME", "CPF", "CONTATO", "Número da ordem de trabalho", "ID Companhia", "Macro Atividade", "Número SA",
  "Estado", "Tipo Logradouro", "Número", "Tipo Complemento", "Abrev. Tipo Comp.", "Bairro", "Logradouro", "CEP",
  "Serviço", "Velocidade Contratada", "Observações", "UF", "Cobertura", "Claro", "Nio", "Tim", "Claro Promo",
];

interface Mapeamento { campos: Partial<Record<LeadFieldKey, string>>; adicionais: Record<string, string>; fixos?: Record<string, string>; observacoes: string[] }

interface Preset {
  id: number;
  nome: string;
  descricao: string | null;
  listaId: string | null; listaNome: string | null;
  tagId: string | null; tagNome: string | null;
  tagModo: "fixa" | "por_envio"; tagPadrao: string | null;
  pipelineId: string | null; pipelineNome: string | null;
  stageId: string | null; stageNome: string | null;
  origem: string | null;
  filtroColuna: string | null; filtroValor: string | null;
  mapeamento: Mapeamento;
}

interface PlanilhaInfo { arquivo: string; headers: string[]; total: number; truncado: boolean; rows: Record<string, unknown>[]; enviadoEm: (string | null)[]; sugestao: Mapeamento }
const COL_ENVIADO = "Enviado DataCrazy";

interface EnvioStatus {
  id: number; status: string; progressMsg: string; tagNome?: string | null; processed: number; total: number;
  filtrados: number; criados: number; atualizados: number; falhas: number;
  erros: { linha: number; nome: string; telefone: string; erro: string }[];
}

interface EnvioHist {
  id: number; presetNome: string; arquivo: string; tagNome: string | null; status: string; total: number; filtrados: number;
  criados: number; atualizados: number; falhas: number; mensagem: string | null; createdAt: string; finishedAt: string | null;
}

const SUGESTAO_PADRAO: Mapeamento = {
  campos: { name: "NOME", phone: "CONTATO", taxId: "CPF", zip: "CEP", address: "Logradouro", number: "Número", complement: "Abrev. Tipo Comp.", block: "Bairro", state: "UF" },
  adicionais: {},
  fixos: {},
  observacoes: [],
};
SUGESTAO_PADRAO.observacoes = COLUNAS_PADRAO.filter((c) => !Object.values(SUGESTAO_PADRAO.campos).includes(c));

const selectCls =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-xs outline-none focus-visible:border-mcc-blue focus-visible:ring-[3px] focus-visible:ring-mcc-blue/20 disabled:opacity-50";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function nomeBaseArquivo(arquivo: string): string {
  return arquivo.replace(/\.[^.]+$/, "").replace(/_(cobertura|adequada(_cobertura)?)$/i, "").replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}
function resolverNomeTag(padrao: string | null | undefined, arquivo: string): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0"), mm = String(d.getMonth() + 1).padStart(2, "0"), yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0"), mi = String(d.getMinutes()).padStart(2, "0");
  return (padrao || "{arquivo}")
    .replace(/\{arquivo\}/gi, nomeBaseArquivo(arquivo)).replace(/\{data\}/gi, `${dd}${mm}${yyyy}`)
    .replace(/\{dataiso\}/gi, `${yyyy}-${mm}-${dd}`).replace(/\{hora\}/gi, `${hh}${mi}`).trim().slice(0, 100);
}

const fmtData = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR") : "—");

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function DisparosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Carregando...</div>}>
      <DisparosInner />
    </Suspense>
  );
}

function DisparosInner() {
  const searchParams = useSearchParams();
  const jobIdParam = searchParams.get("jobId");
  const envioIdParam = searchParams.get("envioId");

  const [tab, setTab] = useState<"enviar" | "disparos" | "historico">("enviar");
  const [options, setOptions] = useState<DcOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);

  const loadOptions = useCallback(async (refresh = false) => {
    setOptionsLoading(true);
    try {
      const res = await fetch(`/api/mcc/admin/disparos/datacrazy${refresh ? "?refresh=1" : ""}`);
      const data = (await res.json()) as DcOptions;
      setOptions(data);
    } catch {
      setOptions({ configured: true, error: "Não foi possível consultar o DataCrazy" });
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const loadPresets = useCallback(async () => {
    setPresetsLoading(true);
    try {
      const res = await fetch("/api/mcc/admin/disparos/presets");
      const data = await res.json();
      setPresets(data.presets ?? []);
    } finally {
      setPresetsLoading(false);
    }
  }, []);

  useEffect(() => { void loadOptions(); void loadPresets(); }, [loadOptions, loadPresets]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-mcc-blue/10">
            <Rocket className="size-6 text-mcc-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Disparos no DataCrazy</h1>
            <p className="text-sm text-slate-500">
              Suba a planilha processada, escolha o disparo e os leads são criados no DataCrazy já na lista, tag e etapa certas.
            </p>
          </div>
        </div>
        <ConexaoBadge options={options} loading={optionsLoading} onRefresh={() => loadOptions(true)} />
      </div>

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
        {[
          { id: "enviar", label: "Enviar planilha", icon: Send },
          { id: "disparos", label: "Disparos", icon: Settings2 },
          { id: "historico", label: "Histórico", icon: History },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                active ? "bg-mcc-blue text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "enviar" && (
        <EnviarTab presets={presets} presetsLoading={presetsLoading} options={options} jobIdParam={jobIdParam} envioIdParam={envioIdParam} onIrParaDisparos={() => setTab("disparos")} />
      )}
      {tab === "disparos" && (
        <DisparosTab presets={presets} loading={presetsLoading} options={options} onChanged={loadPresets} onOptionsChanged={() => loadOptions(true)} />
      )}
      {tab === "historico" && <HistoricoTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conexão
// ---------------------------------------------------------------------------

function ConexaoBadge({ options, loading, onRefresh }: { options: DcOptions | null; loading: boolean; onRefresh: () => void }) {
  let cls = "border-slate-200 bg-slate-50 text-slate-600";
  let text = "Consultando DataCrazy...";
  if (!loading && options) {
    if (!options.configured) { cls = "border-amber-200 bg-amber-50 text-amber-700"; text = "DataCrazy não configurado (DATACRAZY_TOKEN)"; }
    else if (options.error) { cls = "border-red-200 bg-red-50 text-red-700"; text = `Erro: ${options.error}`; }
    else { cls = "border-emerald-200 bg-emerald-50 text-emerald-700"; text = `DataCrazy conectado — ${options.listas?.length ?? 0} listas, ${options.tags?.length ?? 0} tags, ${options.pipelines?.length ?? 0} funis, ${options.campos?.length ?? 0} campos adicionais`; }
  }
  return (
    <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium", cls)}>
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
      <span className="max-w-[420px] truncate">{text}</span>
      <button type="button" onClick={onRefresh} className="rounded-full p-0.5 hover:bg-black/5" title="Atualizar">
        <RefreshCw className="size-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba: Enviar
// ---------------------------------------------------------------------------

function EnviarTab({ presets, presetsLoading, options, jobIdParam, envioIdParam, onIrParaDisparos }: {
  presets: Preset[]; presetsLoading: boolean; options: DcOptions | null; jobIdParam: string | null; envioIdParam: string | null; onIrParaDisparos: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(jobIdParam);
  const [info, setInfo] = useState<PlanilhaInfo | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [presetId, setPresetId] = useState<string>("");
  const [destinos, setDestinos] = useState<Record<string, string>>({});
  const [fixos, setFixos] = useState<Record<string, string>>({});
  const [salvarMapeamento, setSalvarMapeamento] = useState(true);
  const [facetas, setFacetas] = useState<Record<string, string[]>>({});
  const [regras, setRegras] = useState<Regra[]>([]);
  const [busca, setBusca] = useState("");
  const [excluidos, setExcluidos] = useState<Set<number>>(new Set());
  const [pagina, setPagina] = useState(0);
  const [tagNome, setTagNome] = useState("");
  const [tagEditada, setTagEditada] = useState(false);
  const [envio, setEnvio] = useState<EnvioStatus | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const preset = useMemo(() => presets.find((p) => String(p.id) === presetId) ?? null, [presets, presetId]);
  const camposAdicionais = useMemo(() => options?.campos ?? [], [options]);

  // Escolhe automaticamente o disparo quando só existe um.
  useEffect(() => { if (!presetId && presets.length === 1) setPresetId(String(presets[0].id)); }, [presets, presetId]);

  // ---- Planilha -----------------------------------------------------------
  const lerPlanilha = useCallback(async (f: File | null, jid: string | null) => {
    setErro(""); setInfo(null); setLendo(true);
    try {
      const fd = new FormData();
      if (f) fd.append("file", f);
      else if (jid) fd.append("jobId", jid);
      else return;
      const res = await fetch("/api/mcc/admin/disparos/planilha", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || "Não foi possível ler a planilha"); if (jid) setJobId(null); return; }
      const enviadoEm: (string | null)[] = data.enviadoEm ?? [];
      const rows = (data.rows as Record<string, unknown>[]).map((r, i) => ({ ...r, [COL_ENVIADO]: enviadoEm[i] ? `Sim (${new Date(enviadoEm[i]!).toLocaleDateString("pt-BR")})` : "Não" }));
      const headers = [...(data.headers as string[]).filter((h) => h !== COL_ENVIADO), COL_ENVIADO];
      setInfo({ ...data, rows, headers, enviadoEm });
      setFacetas({}); setRegras([]); setBusca(""); setPagina(0);
      // Quem já foi enviado começa desmarcado, para não duplicar no DataCrazy.
      setExcluidos(new Set(enviadoEm.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)));
    } catch {
      setErro("Falha ao ler a planilha");
    } finally {
      setLendo(false);
    }
  }, []);

  useEffect(() => { if (jobIdParam) void lerPlanilha(null, jobIdParam); }, [jobIdParam, lerPlanilha]);
  // Abre direto o acompanhamento de um envio (ex.: envio automático iniciado após o processamento).
  useEffect(() => {
    const id = Number(envioIdParam);
    if (Number.isInteger(id) && id > 0) {
      setEnvio({ id, status: "pending", progressMsg: "Carregando...", processed: 0, total: 0, filtrados: 0, criados: 0, atualizados: 0, falhas: 0, erros: [] });
      void poll(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envioIdParam]);

  function handleFile(f: File | undefined) {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") { setErro("Envie um arquivo .xlsx ou .xls"); return; }
    setFile(f); setJobId(null); setEnvio(null); setTagEditada(false);
    void lerPlanilha(f, null);
  }

  // ---- Mapeamento ----------------------------------------------------------
  // Destino de cada coluna: "campo:<key>" | "adicional:<id>" | "obs" | "ignorar".
  useEffect(() => {
    if (!info) return;
    const m = preset?.mapeamento;
    const sug = info.sugestao;
    const next: Record<string, string> = {};
    const nrm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
    const pick = (src: Mapeamento | undefined, h: string): string | null => {
      if (!src) return null;
      for (const f of LEAD_FIELDS) if (src.campos[f.key] && nrm(src.campos[f.key]!) === nrm(h)) return `campo:${f.key}`;
      for (const [id, col] of Object.entries(src.adicionais ?? {})) if (nrm(col) === nrm(h) && camposAdicionais.some((c) => c.id === id)) return `adicional:${id}`;
      if (src.observacoes.some((c) => nrm(c) === nrm(h))) return "obs";
      return null;
    };
    const usados = new Set<string>();
    for (const h of info.headers) {
      if (h === COL_ENVIADO) { next[h] = "ignorar"; continue; }
      let d = pick(m, h) ?? pick(sug, h) ?? "obs";
      if (d !== "obs" && d !== "ignorar" && usados.has(d)) d = "obs";
      usados.add(d);
      next[h] = d;
    }
    setDestinos(next);
    setFixos({ ...(sug.fixos ?? {}), ...(m?.fixos ?? {}) });
  }, [info, preset, camposAdicionais]);

  const mapeamento = useMemo<Mapeamento>(() => {
    const m: Mapeamento = { campos: {}, adicionais: {}, fixos: {}, observacoes: [] };
    for (const [col, d] of Object.entries(destinos)) {
      if (d.startsWith("campo:")) m.campos[d.slice(6) as LeadFieldKey] = col;
      else if (d.startsWith("adicional:")) m.adicionais[d.slice(10)] = col;
      else if (d === "obs") m.observacoes.push(col);
    }
    for (const [id, v] of Object.entries(fixos)) if (v.trim()) m.fixos![id] = v.trim();
    return m;
  }, [destinos, fixos]);

  const duplicados = useMemo(() => {
    const seen = new Map<string, number>();
    for (const d of Object.values(destinos)) if (d !== "obs" && d !== "ignorar") seen.set(d, (seen.get(d) ?? 0) + 1);
    return [...seen.entries()].filter(([, n]) => n > 1).map(([d]) => d);
  }, [destinos]);
  const erroMapeamento = !mapeamento.campos.name ? "Escolha qual coluna é o Nome" : !mapeamento.campos.phone ? "Escolha qual coluna é o Telefone (WhatsApp)" : duplicados.length ? "Há duas colunas apontando para o mesmo campo" : null;

  const amostra = useCallback((col: string) => {
    if (!info) return "";
    for (const r of info.rows.slice(0, 50)) { const v = String(r[col] ?? "").trim(); if (v) return v; }
    return "";
  }, [info]);

  // ---- Filtro e seleção ----------------------------------------------------
  const valoresPorColuna = useMemo(() => {
    const out: Record<string, { valor: string; qtd: number }[]> = {};
    if (!info) return out;
    for (const h of info.headers) {
      const cnt = new Map<string, number>();
      for (const r of info.rows) { let v = String(r[h] ?? "").trim(); if (h === COL_ENVIADO) v = v.startsWith("Sim") ? "Sim" : "Não"; cnt.set(v, (cnt.get(v) ?? 0) + 1); if (cnt.size > 16) break; }
      if (cnt.size <= 16 && cnt.size > 1) out[h] = [...cnt.entries()].map(([valor, qtd]) => ({ valor, qtd })).sort((a, b) => b.qtd - a.qtd);
    }
    return out;
  }, [info]);

  // Filtro do preset vira uma faceta/regra inicial.
  useEffect(() => {
    setFacetas({}); setRegras([]);
    setExcluidos(new Set((info?.enviadoEm ?? []).map((v, i) => (v ? i : -1)).filter((i) => i >= 0)));
    if (!info || !preset?.filtroColuna) return;
    const alvo = preset.filtroColuna.trim().toLowerCase();
    const col = info.headers.find((h) => h.trim().toLowerCase() === alvo);
    if (!col) return;
    const valor = preset.filtroValor ?? "";
    if (valor && valoresPorColuna[col]) setFacetas({ [col]: [valor] });
    else setRegras([{ coluna: col, op: valor ? "igual" : "nao_vazio", valor }]);
  }, [info, preset, valoresPorColuna]);

  const filtrados = useMemo(() => {
    if (!info) return [] as number[];
    const nrm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
    const b = nrm(busca);
    const out: number[] = [];
    info.rows.forEach((r, i) => {
      for (const [col, vals] of Object.entries(facetas)) {
        let cv = String(r[col] ?? "");
        if (col === COL_ENVIADO) cv = cv.startsWith("Sim") ? "Sim" : "Não";
        if (vals.length && !vals.some((v) => nrm(v) === nrm(cv))) return;
      }
      for (const rg of regras) {
        const v = nrm(String(r[rg.coluna] ?? ""));
        const alvo = nrm(rg.valor);
        if (rg.op === "igual" && v !== alvo) return;
        if (rg.op === "diferente" && v === alvo) return;
        if (rg.op === "contem" && !v.includes(alvo)) return;
        if (rg.op === "nao_contem" && v.includes(alvo)) return;
        if (rg.op === "vazio" && v !== "") return;
        if (rg.op === "nao_vazio" && v === "") return;
      }
      if (b && !info.headers.some((h) => nrm(String(r[h] ?? "")).includes(b))) return;
      out.push(i);
    });
    return out;
  }, [info, facetas, regras, busca]);

  const selecionados = useMemo(() => filtrados.filter((i) => !excluidos.has(i)), [filtrados, excluidos]);
  useEffect(() => { setPagina(0); }, [facetas, regras, busca]);

  function toggleFaceta(col: string, valor: string) {
    setFacetas((f) => {
      const atual = f[col] ?? [];
      const next = atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor];
      const copy = { ...f };
      if (next.length) copy[col] = next; else delete copy[col];
      return copy;
    });
  }

  const colunasGrade = useMemo(() => {
    if (!info) return [] as string[];
    const prior = [mapeamento.campos.name, mapeamento.campos.phone].filter((c): c is string => !!c);
    const resto = info.headers.filter((h) => !prior.includes(h) && h !== COL_ENVIADO);
    return [COL_ENVIADO, ...prior, ...resto].slice(0, 9);
  }, [info, mapeamento]);

  const POR_PAGINA = 50;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaIdx = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  // ---- Tag ------------------------------------------------------------------
  useEffect(() => {
    if (tagEditada) return;
    if (preset?.tagModo === "por_envio" && info) setTagNome(resolverNomeTag(preset.tagPadrao, info.arquivo));
    else setTagNome("");
  }, [preset, info, tagEditada]);

  // ---- Envio ----------------------------------------------------------------
  const poll = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/mcc/admin/disparos/envios/${id}`);
      if (res.ok) {
        const data = (await res.json()) as EnvioStatus;
        setEnvio(data);
        if (data.status === "processing" || data.status === "pending") {
          pollRef.current = setTimeout(() => poll(id), 2500);
          return;
        }
      }
    } catch { pollRef.current = setTimeout(() => poll(id), 4000); }
  }, []);
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  async function iniciar() {
    if (!preset || !info || erroMapeamento || selecionados.length === 0) return;
    setIniciando(true); setErro("");
    try {
      const fd = new FormData();
      if (file) fd.append("file", file); else if (jobId) fd.append("jobId", jobId);
      fd.append("presetId", String(preset.id));
      fd.append("mapeamento", JSON.stringify(mapeamento));
      fd.append("salvarMapeamento", salvarMapeamento ? "1" : "0");
      if (selecionados.length !== info.total || info.truncado) fd.append("linhas", JSON.stringify(selecionados));
      if (preset.tagModo === "por_envio") fd.append("tagNome", tagNome.trim());
      const res = await fetch("/api/mcc/admin/disparos/envios", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || "Não foi possível iniciar o envio"); return; }
      setEnvio({ id: data.id, status: "pending", progressMsg: "Iniciando...", tagNome: data.tagNome, processed: 0, total: data.total, filtrados: 0, criados: 0, atualizados: 0, falhas: 0, erros: [] });
      void poll(data.id);
    } catch {
      setErro("Falha ao iniciar o envio");
    } finally {
      setIniciando(false);
    }
  }

  async function cancelar() { if (envio) await fetch(`/api/mcc/admin/disparos/envios/${envio.id}/cancelar`, { method: "POST" }); }
  async function baixarFalhas() {
    if (!envio) return;
    const res = await fetch(`/api/mcc/admin/disparos/envios/${envio.id}/erros`);
    if (res.ok) downloadBlob(await res.blob(), `envio_${envio.id}_falhas.xlsx`);
  }
  function reset() {
    if (pollRef.current) clearTimeout(pollRef.current);
    setFile(null); setJobId(null); setInfo(null); setEnvio(null); setErro(""); setTagEditada(false); setTagNome("");
    setFacetas({}); setRegras([]); setBusca(""); setExcluidos(new Set());
    if (inputRef.current) inputRef.current.value = "";
  }

  const emAndamento = envio && (envio.status === "processing" || envio.status === "pending");
  const pct = envio && envio.total > 0 ? Math.round((envio.processed / envio.total) * 100) : 0;
  const nAdicionais = Object.keys(mapeamento.adicionais).length;
  const minutosEstimados = Math.ceil((selecionados.length * (2 + nAdicionais)) / 60);

  // ---- Render ---------------------------------------------------------------
  if (envio) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-5">
          <h2 className="font-semibold text-slate-800">Envio #{envio.id}{preset ? ` — ${preset.nome}` : ""}</h2>
          <p className="mt-1 text-sm text-slate-500">{info?.arquivo ?? ""}{envio.tagNome ? ` · tag ${envio.tagNome}` : ""}</p>
        </div>
        <div className="flex flex-col gap-5 p-8">
          <div className="flex items-center gap-3">
            {emAndamento ? <Loader2 className="size-6 animate-spin text-mcc-blue" /> : envio.status === "done" ? <CheckCircle2 className="size-6 text-emerald-600" /> : envio.status === "cancelled" ? <AlertTriangle className="size-6 text-amber-600" /> : <XCircle className="size-6 text-red-600" />}
            <div>
              <p className="font-semibold text-slate-800">
                {emAndamento ? "Enviando ao DataCrazy..." : envio.status === "done" ? "Envio concluído" : envio.status === "cancelled" ? "Envio cancelado" : "Envio com erro"}
              </p>
              <p className="text-sm text-slate-500">{envio.progressMsg}</p>
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{envio.processed} de {envio.total}</span><span>{pct}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-mcc-blue transition-all" style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Criados" value={envio.criados} cls="text-emerald-700 bg-emerald-50 border-emerald-200" />
            <Stat label="Atualizados" value={envio.atualizados} cls="text-sky-700 bg-sky-50 border-sky-200" />
            <Stat label="Fora do filtro" value={envio.filtrados} cls="text-slate-700 bg-slate-50 border-slate-200" />
            <Stat label="Falhas" value={envio.falhas} cls="text-red-700 bg-red-50 border-red-200" />
          </div>
          {envio.erros.length > 0 && (
            <div className="rounded-xl border border-red-200">
              <div className="flex items-center justify-between border-b border-red-100 bg-red-50/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                <span>Falhas ({envio.falhas})</span>
                <button type="button" onClick={baixarFalhas} className="flex items-center gap-1 text-red-700 hover:underline"><Download className="size-3.5" /> baixar .xlsx</button>
              </div>
              <div className="max-h-48 overflow-auto text-xs">
                {envio.erros.slice(0, 50).map((e, i) => (
                  <div key={i} className="grid grid-cols-[60px_1fr_130px_1fr] gap-2 border-b border-red-50 px-4 py-1.5 text-slate-700">
                    <span>L{e.linha}</span><span className="truncate">{e.nome}</span><span>{e.telefone}</span><span className="truncate text-red-700">{e.erro}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {envio.status === "done" && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Os leads já estão no DataCrazy{preset?.listaNome ? ` na lista "${preset.listaNome}"` : ""}{envio.tagNome ? ` com a tag "${envio.tagNome}"` : ""}{preset?.stageNome ? ` na etapa "${preset.stageNome}"` : ""}. Agora é só iniciar o Impulso lá.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {emAndamento ? (
              <Button variant="outline" onClick={cancelar}><XCircle className="size-4" /> Cancelar envio</Button>
            ) : (
              <>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={async () => { const r = await fetch(`/api/mcc/admin/disparos/envios/${envio.id}/planilha`); if (r.ok) downloadBlob(await r.blob(), `envio_${envio.id}_enviado_datacrazy.xlsx`); else setErro("Planilha do envio não está mais disponível"); }}>
                  <Download className="size-4" /> Baixar planilha com coluna &quot;Enviado DataCrazy&quot;
                </Button>
                <Button variant="outline" onClick={reset}><Upload className="size-4" /> Enviar outra planilha</Button>
              </>
            )}
          </div>
          {erro && <span className="text-sm text-red-700">{erro}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Planilha + 2. Disparo */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Passo n={1} titulo="Planilha" sub="Use a planilha processada em “Processar Planilha” ou qualquer planilha com nome e telefone.">
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          <div
            role="button" tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            className={cn(
              "group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 transition-all",
              dragOver ? "border-mcc-blue bg-mcc-light" : info ? "border-mcc-blue/40 bg-mcc-light/50" : "border-slate-200 bg-slate-50/50 hover:border-mcc-blue/40",
            )}
          >
            {lendo ? <Loader2 className="size-8 animate-spin text-mcc-blue" /> : info ? (
              <>
                <FileSpreadsheet className="size-8 text-mcc-blue" />
                <div className="text-center">
                  <p className="font-semibold text-slate-800">{info.arquivo}</p>
                  <p className="text-sm text-slate-500">{info.total.toLocaleString("pt-BR")} linhas · {info.headers.length} colunas{jobId ? " · vinda do processamento" : ""}{info.truncado ? " · mostrando as 5.000 primeiras" : ""}</p>
                </div>
              </>
            ) : (
              <>
                <Upload className="size-8 text-slate-400 group-hover:text-mcc-blue" />
                <div className="text-center">
                  <p className="font-semibold text-slate-700">Arraste a planilha aqui ou clique para selecionar</p>
                  <p className="text-sm text-slate-400">.xlsx ou .xls</p>
                </div>
              </>
            )}
          </div>
          {erro && !info && <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><XCircle className="mt-0.5 size-4 shrink-0" /> {erro}</div>}
        </Passo>

        <Passo n={2} titulo="Disparo" sub="Define lista, etapa do funil e a tag no DataCrazy.">
          {presetsLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Carregando...</div>
          ) : presets.length === 0 ? (
            <div className="text-sm text-slate-600">Nenhum disparo cadastrado. <button type="button" className="font-medium text-mcc-blue hover:underline" onClick={onIrParaDisparos}>Cadastrar</button></div>
          ) : (
            <select className={selectCls} value={presetId} onChange={(e) => setPresetId(e.target.value)}>
              <option value="">Escolha o disparo...</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
          {preset && (
            <div className="mt-3 flex flex-col gap-1.5 rounded-xl bg-slate-50 p-3 text-sm">
              <Linha icon={Workflow} label="Etapa" value={preset.stageNome ? `${preset.pipelineNome ?? ""} › ${preset.stageNome}` : null} />
              <Linha icon={ListChecks} label="Lista" value={preset.listaNome} />
              <Linha icon={Tag} label="Tag" value={[preset.tagNome, preset.tagModo === "por_envio" ? `+ tag da base (${preset.tagPadrao || "{arquivo}"})` : null].filter(Boolean).join(" ") || null} />
            </div>
          )}
          {options && !options.configured && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Configure <code>DATACRAZY_TOKEN</code> no servidor para habilitar o envio.</div>
          )}
        </Passo>
      </div>

      {info && preset && (
        <>
          {/* 3. Mapeamento */}
          <Passo n={3} titulo="Mapeamento das colunas" sub="Para cada coluna da planilha, escolha onde ela entra no lead do DataCrazy. As sugestões vêm do disparo e dos nomes das colunas.">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-3 py-2 text-left">Coluna da planilha</th><th className="px-3 py-2 text-left">Exemplo</th><th className="px-3 py-2 text-left">Destino no DataCrazy</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {info.headers.filter((h) => h !== COL_ENVIADO).map((h) => {
                    const d = destinos[h] ?? "obs";
                    const dup = duplicados.includes(d);
                    return (
                      <tr key={h} className={cn(dup && "bg-red-50/60")}>
                        <td className="px-3 py-1.5 font-medium text-slate-800">{h}</td>
                        <td className="max-w-[220px] truncate px-3 py-1.5 text-slate-500" title={amostra(h)}>{amostra(h) || <span className="text-slate-300">vazio</span>}</td>
                        <td className="px-3 py-1.5">
                          <select className={cn(selectCls, "max-w-[360px]", d === "ignorar" && "text-slate-400", dup && "border-red-300")} value={d} onChange={(e) => setDestinos((m) => ({ ...m, [h]: e.target.value }))}>
                            <optgroup label="Campos do lead">
                              {LEAD_FIELDS.map((f) => <option key={f.key} value={`campo:${f.key}`}>{f.label}{f.required ? " *" : ""}</option>)}
                            </optgroup>
                            {camposAdicionais.length > 0 && (
                              <optgroup label="Campos adicionais (DataCrazy)">
                                {camposAdicionais.map((c) => <option key={c.id} value={`adicional:${c.id}`}>{c.name}{c.type ? ` (${c.type})` : ""}</option>)}
                              </optgroup>
                            )}
                            <optgroup label="Outros">
                              <option value="obs">Observações do lead</option>
                              <option value="ignorar">— Ignorar —</option>
                            </optgroup>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {camposAdicionais.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valores fixos para todos os leads deste envio</p>
                <p className="mb-2 text-xs text-slate-500">Campos adicionais preenchidos com o mesmo valor em todos os leads (ex.: Origem do Lead = Disparo API, Parceiro). Nome Lead / CPF Lead / Email Lead são preenchidos automaticamente a partir dos campos padrão.</p>
                <div className="flex flex-col gap-2">
                  {Object.entries(fixos).map(([id, v]) => {
                    const campo = camposAdicionais.find((c) => c.id === id);
                    const opts = (campo as { options?: { label?: string }[] } | undefined)?.options;
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <span className="w-44 truncate text-sm text-slate-700" title={campo?.name ?? id}>{campo?.name ?? id}</span>
                        {Array.isArray(opts) && opts.length > 0 ? (
                          <select className={cn(selectCls, "max-w-xs")} value={v} onChange={(e) => setFixos((f) => ({ ...f, [id]: e.target.value }))}>
                            <option value="">— sem valor —</option>
                            {opts.map((o, i) => <option key={i} value={o.label ?? ""}>{o.label}</option>)}
                          </select>
                        ) : (
                          <Input className="h-8 max-w-xs" value={v} onChange={(e) => setFixos((f) => ({ ...f, [id]: e.target.value }))} />
                        )}
                        <Button type="button" variant="ghost" size="sm" onClick={() => setFixos((f) => { const n = { ...f }; delete n[id]; return n; })}><Trash2 className="size-4" /></Button>
                      </div>
                    );
                  })}
                  <select className={cn(selectCls, "max-w-xs")} value="" onChange={(e) => { const id = e.target.value; if (id) setFixos((f) => ({ ...f, [id]: f[id] ?? "" })); }}>
                    <option value="">+ adicionar valor fixo...</option>
                    {camposAdicionais.filter((c) => fixos[c.id] === undefined).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={salvarMapeamento} onChange={(e) => setSalvarMapeamento(e.target.checked)} />
                Salvar este mapeamento no disparo “{preset.nome}” para as próximas planilhas
              </label>
              {erroMapeamento ? <span className="text-red-700">{erroMapeamento}</span> : <span className="text-emerald-700">Mapeamento válido · {nAdicionais} campo(s) adicional(is) · {mapeamento.observacoes.length} coluna(s) nas observações</span>}
            </div>
            {camposAdicionais.length === 0 && options?.configured && !options.error && (
              <p className="mt-2 text-xs text-slate-500">Nenhum campo adicional de lead encontrado no DataCrazy. Crie em Configurações › Campos adicionais e clique em atualizar no topo da página.</p>
            )}
          </Passo>

          {/* 4. Filtro e seleção */}
          <Passo n={4} titulo="Quem vai receber" sub="Filtre por valores das colunas, adicione regras e desmarque linhas específicas. Só as linhas selecionadas vão para o DataCrazy.">
            {Object.keys(valoresPorColuna).length > 0 && (
              <div className="flex flex-col gap-2">
                {Object.entries(valoresPorColuna).map(([col, vals]) => (
                  <div key={col} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-36 shrink-0 truncate text-xs font-medium text-slate-500" title={col}>{col}</span>
                    {vals.map(({ valor, qtd }) => {
                      const on = (facetas[col] ?? []).includes(valor);
                      return (
                        <button key={valor || "(vazio)"} type="button" onClick={() => toggleFaceta(col, valor)}
                          className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", on ? "border-mcc-blue bg-mcc-blue text-white" : "border-slate-200 bg-white text-slate-700 hover:border-mcc-blue/40")}>
                          {valor || "(vazio)"} <span className={cn("ml-1", on ? "text-white/80" : "text-slate-400")}>{qtd}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {regras.map((rg, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select className={cn(selectCls, "w-56")} value={rg.coluna} onChange={(e) => setRegras((rs) => rs.map((r, j) => (j === i ? { ...r, coluna: e.target.value } : r)))}>
                    {info.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select className={cn(selectCls, "w-40")} value={rg.op} onChange={(e) => setRegras((rs) => rs.map((r, j) => (j === i ? { ...r, op: e.target.value as Regra["op"] } : r)))}>
                    <option value="contem">contém</option><option value="nao_contem">não contém</option><option value="igual">é igual a</option><option value="diferente">é diferente de</option><option value="vazio">está vazio</option><option value="nao_vazio">está preenchido</option>
                  </select>
                  {rg.op !== "vazio" && rg.op !== "nao_vazio" && (
                    <Input className="h-9 w-56" value={rg.valor} onChange={(e) => setRegras((rs) => rs.map((r, j) => (j === i ? { ...r, valor: e.target.value } : r)))} placeholder="valor" />
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRegras((rs) => rs.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setRegras((rs) => [...rs, { coluna: info.headers[0], op: "contem", valor: "" }])}><Plus className="size-4" /> Regra</Button>
                <Input className="h-9 w-64" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar em qualquer coluna..." />
                {(Object.keys(facetas).length > 0 || regras.length > 0 || busca || excluidos.size > 0) && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setFacetas({}); setRegras([]); setBusca(""); setExcluidos(new Set()); }}>Limpar filtros</Button>
                )}
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                <span className="font-semibold text-slate-700">
                  <span className="text-mcc-blue">{selecionados.length.toLocaleString("pt-BR")}</span> de {info.total.toLocaleString("pt-BR")} linhas selecionadas
                  {filtrados.length !== info.total && <span className="text-slate-500"> · {filtrados.length.toLocaleString("pt-BR")} passam no filtro</span>}
                  {info.enviadoEm.some(Boolean) && <span className="text-amber-700"> · {info.enviadoEm.filter(Boolean).length.toLocaleString("pt-BR")} já enviadas antes (desmarcadas)</span>}
                </span>
                <div className="flex items-center gap-2">
                  <button type="button" className="text-mcc-blue hover:underline" onClick={() => setExcluidos((ex) => { const n = new Set(ex); for (const i of filtrados) n.delete(i); return n; })}>marcar todas filtradas</button>
                  <span className="text-slate-300">|</span>
                  <button type="button" className="text-mcc-blue hover:underline" onClick={() => setExcluidos((ex) => { const n = new Set(ex); for (const i of filtrados) n.add(i); return n; })}>desmarcar todas</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white text-slate-500">
                    <tr>
                      <th className="w-8 px-2 py-1.5"></th>
                      <th className="w-10 px-2 py-1.5 text-left">#</th>
                      {colunasGrade.map((h) => <th key={h} className="whitespace-nowrap px-2 py-1.5 text-left">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginaIdx.map((i) => {
                      const on = !excluidos.has(i);
                      return (
                        <tr key={i} className={cn("hover:bg-slate-50/60", !on && "text-slate-400")}>
                          <td className="px-2 py-1"><input type="checkbox" checked={on} onChange={() => setExcluidos((ex) => { const n = new Set(ex); if (n.has(i)) n.delete(i); else n.add(i); return n; })} /></td>
                          <td className="px-2 py-1 text-slate-400">{i + 2}</td>
                          {colunasGrade.map((h) => <td key={h} className="max-w-[200px] truncate px-2 py-1" title={String(info.rows[i][h] ?? "")}>{String(info.rows[i][h] ?? "")}</td>)}
                        </tr>
                      );
                    })}
                    {paginaIdx.length === 0 && <tr><td colSpan={colunasGrade.length + 2} className="px-3 py-6 text-center text-slate-400">Nenhuma linha passa no filtro.</td></tr>}
                  </tbody>
                </table>
              </div>
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                  <span>Página {pagina + 1} de {totalPaginas}</span>
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
                    <Button type="button" variant="outline" size="sm" disabled={pagina >= totalPaginas - 1} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </div>
          </Passo>

          {/* 5. Enviar */}
          <Passo n={5} titulo="Enviar" sub="Confira a tag e envie. O envio roda em segundo plano; você pode acompanhar aqui ou no histórico.">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="flex flex-col gap-3">
                {preset.tagModo === "por_envio" && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-600">Tag deste envio (criada no DataCrazy se não existir)</span>
                    <Input className="max-w-md" value={tagNome} onChange={(e) => { setTagNome(e.target.value); setTagEditada(true); }} placeholder="Ex.: api_OP_TOTAL_16102026" />
                  </label>
                )}
                <p className="text-xs text-slate-500">
                  {selecionados.length.toLocaleString("pt-BR")} lead(s) · {preset.stageNome ? `etapa ${preset.stageNome}` : "sem etapa"}{preset.listaNome ? ` · lista ${preset.listaNome}` : ""} · tempo estimado ~{minutosEstimados} min (limite da API do DataCrazy). Leads já existentes (telefone/CPF) são atualizados, não duplicados.
                </p>
                {erro && <span className="text-sm text-red-700">{erro}</span>}
              </div>
              <Button
                className="h-11 bg-mcc-blue px-8 hover:bg-mcc-blue/90"
                disabled={!!erroMapeamento || selecionados.length === 0 || iniciando || !options?.configured || (preset.tagModo === "por_envio" && !tagNome.trim())}
                onClick={iniciar}
              >
                {iniciando ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                Enviar {selecionados.length.toLocaleString("pt-BR")} ao DataCrazy
              </Button>
            </div>
          </Passo>
        </>
      )}
    </div>
  );
}

function Passo({ n, titulo, sub, children }: { n: number; titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-mcc-blue text-xs font-bold text-white">{n}</span>
        <div>
          <h2 className="font-semibold text-slate-800">{titulo}</h2>
          {sub && <p className="mt-0.5 text-sm text-slate-500">{sub}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={cn("rounded-xl border px-4 py-3", cls)}>
      <p className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}

function Linha({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-slate-400" />
      <span className="w-14 text-xs text-slate-500">{label}</span>
      <span className={cn("truncate", value ? "text-slate-800" : "text-slate-400")}>{value || "—"}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba: Disparos (presets)
// ---------------------------------------------------------------------------

function AutoConfigPanel({ presets }: { presets: Preset[] }) {
  const [cfg, setCfg] = useState<{ ativo: boolean; presetId: number | null; pularEnviados: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { fetch("/api/mcc/admin/disparos/config").then((r) => r.json()).then(setCfg).catch(() => setCfg({ ativo: false, presetId: null, pularEnviados: true })); }, []);
  async function salvar(next: { ativo: boolean; presetId: number | null; pularEnviados: boolean }) {
    setCfg(next); setSalvando(true); setMsg("");
    try {
      const res = await fetch("/api/mcc/admin/disparos/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Não foi possível salvar"); else setMsg("Salvo");
    } finally { setSalvando(false); setTimeout(() => setMsg(""), 2500); }
  }
  if (!cfg) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-4 rounded-2xl border px-6 py-4 shadow-sm", cfg.ativo ? "border-mcc-blue/30 bg-mcc-light/50" : "border-slate-200 bg-white")}>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input type="checkbox" checked={cfg.ativo} onChange={(e) => salvar({ ...cfg, ativo: e.target.checked })} />
        Envio automático após processar a planilha
      </label>
      <select className={cn(selectCls, "w-72")} value={cfg.presetId ?? ""} onChange={(e) => salvar({ ...cfg, presetId: e.target.value ? Number(e.target.value) : null })}>
        <option value="">Escolha o disparo...</option>
        {presets.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={cfg.pularEnviados} onChange={(e) => salvar({ ...cfg, pularEnviados: e.target.checked })} />
        Não reenviar quem já foi enviado
      </label>
      <span className="text-xs text-slate-500">{salvando ? "Salvando..." : msg}</span>
      <p className="w-full text-xs text-slate-500">
        Com isso ligado, ao terminar &quot;Processar Planilha&quot; os leads com cobertura vão direto ao DataCrazy com o disparo escolhido (filtro do disparo, tag da base pelo nome do arquivo). Você só sobe a planilha.
      </p>
    </div>
  );
}

function DisparosTab({ presets, loading, options, onChanged, onOptionsChanged }: {
  presets: Preset[]; loading: boolean; options: DcOptions | null; onChanged: () => void; onOptionsChanged: () => void;
}) {
  const [editing, setEditing] = useState<Preset | "novo" | null>(null);

  async function excluir(p: Preset) {
    if (!confirm(`Excluir o disparo "${p.nome}"?`)) return;
    await fetch(`/api/mcc/admin/disparos/presets/${p.id}`, { method: "DELETE" });
    onChanged();
  }

  if (editing) {
    return (
      <PresetForm
        inicial={editing === "novo" ? null : editing}
        options={options}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); onChanged(); }}
        onOptionsChanged={onOptionsChanged}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
    <AutoConfigPanel presets={presets} />
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-5">
        <div>
          <h2 className="font-semibold text-slate-800">Disparos cadastrados</h2>
          <p className="mt-1 text-sm text-slate-500">Cada disparo define para onde os leads vão no DataCrazy e como as colunas são mapeadas.</p>
        </div>
        <Button className="bg-mcc-blue hover:bg-mcc-blue/90" onClick={() => setEditing("novo")}><Plus className="size-4" /> Novo disparo</Button>
      </div>
      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Carregando...</div>
        ) : presets.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">Nenhum disparo cadastrado. Clique em &quot;Novo disparo&quot;.</div>
        ) : presets.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-4 px-8 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800">{p.nome}</p>
              {p.descricao && <p className="text-sm text-slate-500">{p.descricao}</p>}
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                {p.listaNome && <Chip icon={ListChecks} text={`Lista: ${p.listaNome}`} />}
                {p.tagNome && <Chip icon={Tag} text={`Tag fixa: ${p.tagNome}`} />}
                {p.tagModo === "por_envio" && <Chip icon={Tag} text={`Tag por envio: ${p.tagPadrao || "{arquivo}"}`} />}
                {p.stageNome && <Chip icon={Workflow} text={`${p.pipelineNome ?? ""} › ${p.stageNome}`} />}
                {p.filtroColuna && <Chip icon={Filter} text={`${p.filtroColuna} = ${p.filtroValor || "(preenchido)"}`} />}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(p)}><Pencil className="size-4" /> Editar</Button>
              <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => excluir(p)}><Trash2 className="size-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

function Chip({ icon: Icon, text }: { icon: typeof Tag; text: string }) {
  return <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700"><Icon className="size-3" />{text}</span>;
}

function PresetForm({ inicial, options, onCancel, onSaved, onOptionsChanged }: {
  inicial: Preset | null; options: DcOptions | null; onCancel: () => void; onSaved: () => void; onOptionsChanged: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [listaId, setListaId] = useState(inicial?.listaId ?? "");
  const [tagId, setTagId] = useState(inicial?.tagId ?? "");
  const [tagModo, setTagModo] = useState<"fixa" | "por_envio">(inicial?.tagModo ?? "por_envio");
  const [tagPadrao, setTagPadrao] = useState(inicial?.tagPadrao ?? "{arquivo}");
  const [pipelineId, setPipelineId] = useState(inicial?.pipelineId ?? "");
  const [stageId, setStageId] = useState(inicial?.stageId ?? "");
  const [origem, setOrigem] = useState(inicial?.origem ?? "Disparo MCC");
  const [filtroColuna, setFiltroColuna] = useState(inicial?.filtroColuna ?? "");
  const [filtroValor, setFiltroValor] = useState(inicial?.filtroValor ?? "");
  const [campos, setCampos] = useState<Partial<Record<LeadFieldKey, string>>>(inicial?.mapeamento.campos ?? SUGESTAO_PADRAO.campos);
  const [observacoes, setObservacoes] = useState<string[]>(inicial?.mapeamento.observacoes ?? SUGESTAO_PADRAO.observacoes);
  const adicionais = inicial?.mapeamento.adicionais ?? {};
  const fixosSalvos = inicial?.mapeamento.fixos ?? {};
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [criandoTipo, setCriandoTipo] = useState<"tag" | "lista" | null>(null);

  const listas = options?.listas ?? [];
  const tags = options?.tags ?? [];
  const pipelines = options?.pipelines ?? [];
  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? null;
  const stages = pipeline?.stages ?? [];

  // Se o preset guarda ids que não vieram no catálogo (ex.: conexão fora), mantemos como opção.
  const listaOpts = listaId && !listas.some((l) => l.id === listaId) ? [{ id: listaId, name: inicial?.listaNome ?? listaId }, ...listas] : listas;
  const tagOpts = tagId && !tags.some((t) => t.id === tagId) ? [{ id: tagId, name: inicial?.tagNome ?? tagId }, ...tags] : tags;

  const colunas = useMemo(() => {
    const set = new Set<string>(COLUNAS_PADRAO);
    for (const v of Object.values(campos)) if (v) set.add(v);
    for (const v of observacoes) set.add(v);
    if (filtroColuna) set.add(filtroColuna);
    return [...set];
  }, [campos, observacoes, filtroColuna]);

  async function criarNoDataCrazy() {
    if (!criandoTipo || !novoNome.trim()) return;
    setErro("");
    const res = await fetch("/api/mcc/admin/disparos/datacrazy", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tipo: criandoTipo, nome: novoNome.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setErro(data.error || "Falha ao criar"); return; }
    if (criandoTipo === "tag") setTagId(data.id); else setListaId(data.id);
    setNovoNome(""); setCriandoTipo(null);
    onOptionsChanged();
  }

  async function salvar() {
    setErro(""); setSalvando(true);
    try {
      const payload = {
        nome, descricao,
        listaId: listaId || null, listaNome: listaOpts.find((l) => l.id === listaId)?.name ?? null,
        tagModo, tagPadrao,
        tagId: tagId || null, tagNome: tagOpts.find((t) => t.id === tagId)?.name ?? null,
        pipelineId: pipelineId || null, pipelineNome: pipeline?.name ?? null,
        stageId: stageId || null, stageNome: stages.find((s) => s.id === stageId)?.name ?? null,
        origem, filtroColuna: filtroColuna || null, filtroValor: filtroValor || null,
        mapeamento: { campos, adicionais, fixos: fixosSalvos, observacoes },
      };
      const res = await fetch(inicial ? `/api/mcc/admin/disparos/presets/${inicial.id}` : "/api/mcc/admin/disparos/presets", {
        method: inicial ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || "Não foi possível salvar"); return; }
      onSaved();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-5">
        <h2 className="font-semibold text-slate-800">{inicial ? `Editar: ${inicial.nome}` : "Novo disparo"}</h2>
        <p className="mt-1 text-sm text-slate-500">Defina para onde os leads vão no DataCrazy e confira o mapeamento das colunas (já vem preenchido para a planilha do portal).</p>
      </div>
      <div className="grid gap-8 p-8 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Campo label="Nome do disparo *">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Disparo Claro Promo — Outubro" />
          </Campo>
          <Campo label="Descrição">
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
          </Campo>

          <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Destino no DataCrazy</h3>
          {options && !options.configured && <p className="text-xs text-amber-700">DataCrazy não configurado — as opções abaixo ficam vazias até configurar o token.</p>}
          {options?.error && <p className="text-xs text-red-700">{options.error}</p>}

          <Campo label="Lista (o Impulso roda sobre ela)">
            <div className="flex gap-2">
              <select className={selectCls} value={listaId} onChange={(e) => setListaId(e.target.value)}>
                <option value="">— nenhuma —</option>
                {listaOpts.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={() => { setCriandoTipo("lista"); setNovoNome(""); }} disabled={!options?.configured}><Plus className="size-4" /> Nova</Button>
            </div>
          </Campo>
          <Campo label="Tag fixa (opcional — ex.: LEAD_COM_CPF, aplicada em todo envio)">
            <div className="flex gap-2">
              <select className={selectCls} value={tagId} onChange={(e) => setTagId(e.target.value)}>
                <option value="">— nenhuma —</option>
                {tagOpts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={() => { setCriandoTipo("tag"); setNovoNome(""); }} disabled={!options?.configured}><Plus className="size-4" /> Nova</Button>
            </div>
          </Campo>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={tagModo === "por_envio"} onChange={(e) => setTagModo(e.target.checked ? "por_envio" : "fixa")} />
              Criar uma tag nova a cada envio (tag da base)
            </label>
            {tagModo === "por_envio" && (
              <>
                <Input value={tagPadrao} onChange={(e) => setTagPadrao(e.target.value)} placeholder="{arquivo}" />
                <p className="text-xs text-slate-500">
                  Padrão do nome. <code>{"{arquivo}"}</code> = nome da planilha (ex.: <code>nio_inadimplente_2110</code>), <code>{"{data}"}</code> = DDMMAAAA, <code>{"{dataiso}"}</code>, <code>{"{hora}"}</code>. Dá para ajustar na hora do envio.
                </p>
              </>
            )}
          </div>
          {criandoTipo && (
            <div className="flex items-center gap-2 rounded-lg border border-mcc-blue/30 bg-mcc-light/40 p-3">
              <Input autoFocus value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder={`Nome da nova ${criandoTipo}`} onKeyDown={(e) => e.key === "Enter" && criarNoDataCrazy()} />
              <Button type="button" size="sm" className="bg-mcc-blue hover:bg-mcc-blue/90" onClick={criarNoDataCrazy}>Criar no DataCrazy</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setCriandoTipo(null)}>Cancelar</Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Funil">
              <select className={selectCls} value={pipelineId} onChange={(e) => { setPipelineId(e.target.value); setStageId(""); }}>
                <option value="">— nenhum —</option>
                {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                {pipelineId && !pipelines.some((p) => p.id === pipelineId) && <option value={pipelineId}>{inicial?.pipelineNome ?? pipelineId}</option>}
              </select>
            </Campo>
            <Campo label="Etapa (cria o negócio aqui)">
              <select className={selectCls} value={stageId} onChange={(e) => setStageId(e.target.value)} disabled={!pipelineId}>
                <option value="">— nenhuma —</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                {stageId && !stages.some((s) => s.id === stageId) && <option value={stageId}>{inicial?.stageNome ?? stageId}</option>}
              </select>
            </Campo>
          </div>
          <Campo label="Origem do lead (campo source)">
            <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex.: Disparo MCC" />
          </Campo>

          <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Filtro (opcional)</h3>
          <p className="-mt-2 text-xs text-slate-500">Envia só as linhas em que a coluna tem o valor informado. Ex.: <b>Claro Promo</b> = <b>Sim</b>.</p>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Coluna">
              <Input list="colunas-planilha" value={filtroColuna} onChange={(e) => setFiltroColuna(e.target.value)} placeholder="Ex.: Claro Promo" />
            </Campo>
            <Campo label="Valor">
              <Input value={filtroValor} onChange={(e) => setFiltroValor(e.target.value)} placeholder="Ex.: Sim (vazio = qualquer valor preenchido)" />
            </Campo>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mapeamento: campo do lead ← coluna da planilha</h3>
          <datalist id="colunas-planilha">{colunas.map((c) => <option key={c} value={c} />)}</datalist>
          <div className="grid gap-2">
            {LEAD_FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-[150px_1fr] items-center gap-3">
                <span className="text-sm text-slate-700">{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
                <Input list="colunas-planilha" value={campos[f.key] ?? ""} onChange={(e) => setCampos((c) => ({ ...c, [f.key]: e.target.value }))} placeholder="(não enviar)" className="h-8" />
              </div>
            ))}
          </div>
          <Campo label="Colunas copiadas para as observações do lead (uma por linha)">
            <textarea
              className="min-h-[110px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:border-mcc-blue focus-visible:ring-[3px] focus-visible:ring-mcc-blue/20"
              value={observacoes.join("\n")}
              onChange={(e) => setObservacoes(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
            />
          </Campo>
          <p className="text-xs text-slate-500">As observações entram no lead como &quot;Cobertura: Claro e Tim e Nio&quot;, &quot;Claro Promo: Sim&quot; etc.</p>
          {Object.keys(adicionais).length > 0 && (
            <p className="text-xs text-slate-500">Campos adicionais salvos: {Object.entries(adicionais).map(([id, col]) => `${(options?.campos ?? []).find((c) => c.id === id)?.name ?? id} ← ${col}`).join(" · ")}. Para alterar, use a aba Enviar (o mapeamento é ajustado coluna a coluna e pode ser salvo no disparo).</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-8 py-4">
        <span className="text-sm text-red-700">{erro}</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button className="bg-mcc-blue hover:bg-mcc-blue/90" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Salvar disparo
          </Button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Aba: Histórico
// ---------------------------------------------------------------------------

interface Resultado {
  tagNome: string; tagId: string | null; enviados: number | null; negocios: number; leads: number; mensagensEnviadas: number;
  responderam: number; avancaram: number; vendas: number; instalados: number; perdidos: number; valorVendas: number;
  porEtapa: { funil: string; etapa: string; qtd: number; grupo: "entrada" | "andamento" | "venda" | "perda" }[]; atualizadoEm: string;
}

function RetornoPanel({ envioId }: { envioId: number }) {
  const [r, setR] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (refresh = false) => {
    setLoading(true); setErro("");
    try {
      const res = await fetch(`/api/mcc/admin/disparos/resultados?envioId=${envioId}${refresh ? "&refresh=1" : ""}`);
      const data = await res.json();
      if (!res.ok) { setErro(data.error || "Falha ao consultar"); return; }
      setR(data);
    } catch { setErro("Falha ao consultar o DataCrazy"); } finally { setLoading(false); }
  }, [envioId]);
  useEffect(() => { void load(); }, [load]);

  if (loading && !r) return <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Consultando o DataCrazy (pode levar alguns segundos)...</div>;
  if (erro) return <div className="px-4 py-3 text-sm text-red-700">{erro}</div>;
  if (!r) return null;
  const base = r.leads || 1;
  const pct = (n: number) => `${Math.round((n / base) * 100)}%`;
  const grupoCls: Record<string, string> = { entrada: "text-slate-600", andamento: "text-sky-700", venda: "text-emerald-700", perda: "text-red-700" };
  return (
    <div className="flex flex-col gap-3 bg-slate-50/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Tag <b className="text-slate-700">{r.tagNome}</b> · {r.leads.toLocaleString("pt-BR")} leads no DataCrazy{r.enviados != null ? ` (${r.enviados.toLocaleString("pt-BR")} neste envio)` : ""} · atualizado {fmtData(r.atualizadoEm)}</span>
        <button type="button" className="flex items-center gap-1 text-mcc-blue hover:underline" onClick={() => load(true)}><RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> atualizar</button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Mensagem enviada" value={r.mensagensEnviadas} cls="text-slate-700 bg-white border-slate-200" />
        <Stat label={`Responderam (${pct(r.responderam)})`} value={r.responderam} cls="text-sky-700 bg-sky-50 border-sky-200" />
        <Stat label={`Avançaram (${pct(r.avancaram)})`} value={r.avancaram} cls="text-indigo-700 bg-indigo-50 border-indigo-200" />
        <Stat label={`Vendas (${pct(r.vendas)})`} value={r.vendas} cls="text-emerald-700 bg-emerald-50 border-emerald-200" />
        <Stat label="Instalados" value={r.instalados} cls="text-emerald-800 bg-emerald-100 border-emerald-300" />
        <Stat label="Perdidos" value={r.perdidos} cls="text-red-700 bg-red-50 border-red-200" />
      </div>
      {r.valorVendas > 0 && <p className="text-xs text-slate-600">Valor em vendas: <b>{r.valorVendas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b></p>}
      {r.porEtapa.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-1.5 text-left">Funil</th><th className="px-3 py-1.5 text-left">Etapa</th><th className="px-3 py-1.5 text-right">Leads</th><th className="px-3 py-1.5 text-right">%</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {r.porEtapa.map((e) => (
                <tr key={`${e.funil}|${e.etapa}`}><td className="px-3 py-1 text-slate-500">{e.funil}</td><td className={cn("px-3 py-1 font-medium", grupoCls[e.grupo])}>{e.etapa}</td><td className="px-3 py-1 text-right">{e.qtd}</td><td className="px-3 py-1 text-right text-slate-500">{pct(e.qtd)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HistoricoTab() {
  const [envios, setEnvios] = useState<EnvioHist[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mcc/admin/disparos/envios");
      const data = await res.json();
      setEnvios(data.envios ?? []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function baixarFalhas(id: number) {
    const res = await fetch(`/api/mcc/admin/disparos/envios/${id}/erros`);
    if (res.ok) downloadBlob(await res.blob(), `envio_${id}_falhas.xlsx`);
  }

  const statusCls: Record<string, string> = {
    done: "bg-emerald-50 text-emerald-700 border-emerald-200",
    processing: "bg-sky-50 text-sky-700 border-sky-200",
    error: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const statusLabel: Record<string, string> = { done: "Concluído", processing: "Em andamento", error: "Erro", cancelled: "Cancelado", pending: "Aguardando" };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-5">
        <div>
          <h2 className="font-semibold text-slate-800">Histórico de envios</h2>
          <p className="mt-1 text-sm text-slate-500">Últimos envios de planilhas ao DataCrazy.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-4" /> Atualizar</Button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Carregando...</div>
      ) : envios.length === 0 ? (
        <div className="p-8 text-sm text-slate-500">Nenhum envio ainda.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Quando</th>
                <th className="px-4 py-2 text-left">Disparo</th>
                <th className="px-4 py-2 text-left">Planilha</th>
                <th className="px-4 py-2 text-left">Tag</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Criados</th>
                <th className="px-4 py-2 text-right">Atualiz.</th>
                <th className="px-4 py-2 text-right">Filtro</th>
                <th className="px-4 py-2 text-right">Falhas</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {envios.map((e) => (
                <Fragment key={e.id}>
                <tr className="hover:bg-slate-50/50">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{fmtData(e.createdAt)}</td>
                  <td className="px-4 py-2 font-medium text-slate-800">{e.presetNome}</td>
                  <td className="max-w-[220px] truncate px-4 py-2 text-slate-600" title={e.arquivo}>{e.arquivo}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700">{e.tagNome ?? "—"}</td>
                  <td className="px-4 py-2"><span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", statusCls[e.status] ?? "bg-slate-50 text-slate-600 border-slate-200")} title={e.mensagem ?? ""}>{statusLabel[e.status] ?? e.status}</span></td>
                  <td className="px-4 py-2 text-right">{e.total}</td>
                  <td className="px-4 py-2 text-right text-emerald-700">{e.criados}</td>
                  <td className="px-4 py-2 text-right text-sky-700">{e.atualizados}</td>
                  <td className="px-4 py-2 text-right text-slate-500">{e.filtrados}</td>
                  <td className="px-4 py-2 text-right text-red-700">{e.falhas}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    {e.tagNome && (
                      <button type="button" onClick={() => setAberto(aberto === e.id ? null : e.id)} className="mr-3 text-xs text-mcc-blue hover:underline">{aberto === e.id ? "fechar" : "ver retorno"}</button>
                    )}
                    {e.falhas > 0 && (
                      <button type="button" onClick={() => baixarFalhas(e.id)} className="text-xs text-mcc-blue hover:underline"><Download className="inline size-3.5" /> falhas</button>
                    )}
                  </td>
                </tr>
                {aberto === e.id && (
                  <tr><td colSpan={11} className="p-0"><RetornoPanel envioId={e.id} /></td></tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
