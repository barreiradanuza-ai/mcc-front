"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileArchive,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { setPendingUpload } from "@/lib/mcc/pendingUpload";

interface AdequacaoStats {
  linhas: number;
  cepsFormatados: number;
  cepsEncontradosEmOutrasColunas: number;
  cepsPadrao: number;
  contatosFormatados: number;
  contatosInvalidos: number;
  cpfsFormatados: number;
  cpfsGerados: number;
  nomesFormatados: number;
  colunaCepCriada: boolean;
  colunaCpfCriada: boolean;
  colunasRenomeadas: string[];
  colunasCepMescladas: string[];
  avisos: string[];
}

type ItemStatus = "pending" | "processing" | "done" | "error";

interface Item {
  id: string;
  file: File;
  status: ItemStatus;
  error?: string;
  result?: Blob;
  resultName?: string;
  stats?: AdequacaoStats;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function decodeStats(header: string | null): AdequacaoStats | undefined {
  if (!header) return undefined;
  try {
    const bin = atob(header);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

export default function AdequacaoPlanilhaPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState("");

  const addFiles = useCallback((list: FileList | null | undefined) => {
    if (!list) return;
    const valid: Item[] = [];
    const invalid: string[] = [];
    for (const f of Array.from(list)) {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        valid.push({ id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`, file: f, status: "pending" });
      } else {
        invalid.push(f.name);
      }
    }
    setError(invalid.length ? `Ignorado(s) por formato inválido: ${invalid.join(", ")}` : "");
    setItems((prev) => [...prev, ...valid]);
  }, []);

  function patch(id: string, data: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...data } : it)));
  }

  async function processAll() {
    setRunning(true);
    setError("");
    const queue = items.filter((it) => it.status === "pending" || it.status === "error");
    for (const it of queue) {
      patch(it.id, { status: "processing", error: undefined });
      try {
        const fd = new FormData();
        fd.append("file", it.file);
        const res = await fetch("/api/mcc/adequacao", { method: "POST", body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          patch(it.id, { status: "error", error: data?.error ?? `Erro (${res.status})` });
          continue;
        }
        const blob = await res.blob();
        const name = decodeURIComponent(
          res.headers.get("X-Adequacao-Filename") ?? `${it.file.name.replace(/\.[^.]+$/, "")}_adequada.xlsx`,
        );
        patch(it.id, {
          status: "done",
          result: new Blob([blob], { type: XLSX_MIME }),
          resultName: name,
          stats: decodeStats(res.headers.get("X-Adequacao-Stats")),
        });
      } catch {
        patch(it.id, { status: "error", error: "Erro de conexão" });
      }
    }
    setRunning(false);
  }

  async function downloadZip() {
    const done = items.filter((it) => it.status === "done" && it.result);
    if (done.length === 0) return;
    if (done.length === 1) {
      downloadBlob(done[0].result!, done[0].resultName!);
      return;
    }
    setZipping(true);
    try {
      const fd = new FormData();
      for (const it of done) fd.append("files", new File([it.result!], it.resultName!, { type: XLSX_MIME }));
      const res = await fetch("/api/mcc/adequacao/zip", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), "planilhas_adequadas.zip");
    } catch {
      setError("Erro ao gerar o arquivo .zip");
    } finally {
      setZipping(false);
    }
  }

  function sendToProcessing(it: Item) {
    if (!it.result || !it.resultName) return;
    setPendingUpload(new File([it.result], it.resultName, { type: XLSX_MIME }));
    router.push("/mcc");
  }

  const doneCount = items.filter((it) => it.status === "done").length;
  const pendingCount = items.filter((it) => it.status === "pending" || it.status === "error").length;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-mcc-blue/10">
          <Wand2 className="size-5 text-mcc-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Adequação de planilha</h1>
          <p className="text-sm text-slate-500">
            Suba planilhas brutas para deixá-las no formato do Processar Planilha.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-5">
          <h2 className="font-semibold text-slate-800">O que é ajustado</h2>
          <ul className="mt-2 grid gap-1 text-sm text-slate-500 sm:grid-cols-2">
            <li><b className="text-slate-700">CEP</b>: 8 dígitos (00000000), reunidos em uma única coluna. Sem CEP → 22790420.</li>
            <li><b className="text-slate-700">CONTATO</b>: telefone/celular/fone… renomeado e no formato +5521000000000.</li>
            <li><b className="text-slate-700">CPF</b>: 11 dígitos (00000000000). Sem CPF → gerado automaticamente.</li>
            <li><b className="text-slate-700">Nome</b>: caixa baixa com iniciais maiúsculas (Maria da Silva).</li>
          </ul>
          <p className="mt-2 text-xs text-slate-400">As demais colunas não são alteradas.</p>
        </div>

        <div className="flex flex-col gap-5 p-8">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => !running && inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && !running && inputRef.current?.click()}
            className={`group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 transition-all duration-200 ${
              dragOver
                ? "scale-[1.01] border-mcc-blue bg-mcc-light"
                : "border-slate-200 bg-slate-50/50 hover:border-mcc-blue/40 hover:bg-slate-50"
            }`}
          >
            <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 transition-colors group-hover:bg-mcc-blue/10">
              <Upload className="size-7 text-slate-400 transition-colors group-hover:text-mcc-blue" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-700">Arraste uma ou várias planilhas aqui ou clique para selecionar</p>
              <p className="mt-1 text-sm text-slate-400">Formatos aceitos: .xlsx, .xls, .csv</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <XCircle className="size-5 shrink-0 text-red-500" />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          {/* File list */}
          {items.length > 0 && (
            <div className="flex flex-col gap-3">
              {items.map((it) => (
                <FileCard
                  key={it.id}
                  item={it}
                  disabled={running}
                  onRemove={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                  onDownload={() => it.result && downloadBlob(it.result, it.resultName!)}
                  onSend={() => sendToProcessing(it)}
                />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={processAll}
              disabled={running || pendingCount === 0}
              className="h-11 flex-1 bg-mcc-blue text-sm font-semibold hover:bg-mcc-dark"
            >
              {running ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Adequando...
                </>
              ) : (
                <>
                  <Wand2 className="size-4" /> Adequar {pendingCount > 1 ? `${pendingCount} planilhas` : "planilha"}
                </>
              )}
            </Button>
            {doneCount > 1 && (
              <Button
                onClick={downloadZip}
                disabled={running || zipping}
                className="h-11 bg-emerald-600 font-semibold hover:bg-emerald-700"
              >
                {zipping ? <Loader2 className="size-4 animate-spin" /> : <FileArchive className="size-4" />}
                Baixar todas (.zip)
              </Button>
            )}
            {items.length > 0 && !running && (
              <Button variant="outline" className="h-11" onClick={() => { setItems([]); setError(""); }}>
                <RotateCcw className="size-4" /> Limpar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FileCard({
  item,
  disabled,
  onRemove,
  onDownload,
  onSend,
}: {
  item: Item;
  disabled: boolean;
  onRemove: () => void;
  onDownload: () => void;
  onSend: () => void;
}) {
  const s = item.stats;
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-mcc-blue/10">
          <FileSpreadsheet className="size-5 text-mcc-blue" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-800">{item.file.name}</p>
          <p className="text-xs text-slate-500">
            {(item.file.size / 1024).toFixed(1)} KB
            {item.status === "pending" && " — aguardando"}
            {item.status === "processing" && " — adequando..."}
            {item.status === "done" && s && ` — ${s.linhas} linhas adequadas`}
          </p>
        </div>

        {item.status === "processing" && <Loader2 className="size-5 animate-spin text-mcc-blue" />}
        {item.status === "done" && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={onDownload}>
              <Download className="size-4" /> Baixar
            </Button>
            <Button size="sm" variant="outline" onClick={onSend}>
              Enviar para processamento <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
        {!disabled && item.status !== "processing" && (
          <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-600" onClick={onRemove}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {item.status === "error" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-red-600">
          <XCircle className="size-4" /> {item.error}
        </p>
      )}

      {item.status === "done" && s && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <Chip ok label="CEPs formatados" value={s.cepsFormatados} />
            <Chip ok label="CEPs achados em outras colunas" value={s.cepsEncontradosEmOutrasColunas} />
            <Chip warn label={s.colunaCepCriada ? "CEP padrão (coluna criada)" : "CEP padrão"} value={s.cepsPadrao} />
            <Chip ok label="Contatos formatados" value={s.contatosFormatados} />
            <Chip warn label="Contatos inválidos" value={s.contatosInvalidos} />
            <Chip ok label="CPFs formatados" value={s.cpfsFormatados} />
            <Chip warn label={s.colunaCpfCriada ? "CPFs gerados (coluna criada)" : "CPFs gerados"} value={s.cpfsGerados} />
            <Chip ok label="Nomes ajustados" value={s.nomesFormatados} />
          </div>
          {(s.colunasRenomeadas.length > 0 || s.colunasCepMescladas.length > 0) && (
            <p className="text-xs text-slate-500">
              {s.colunasRenomeadas.length > 0 && <>Renomeadas: {s.colunasRenomeadas.join(", ")}. </>}
              {s.colunasCepMescladas.length > 0 && <>Colunas de CEP unificadas: {s.colunasCepMescladas.join(", ")}.</>}
            </p>
          )}
          {s.avisos.map((a) => (
            <p key={a} className="flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="size-3.5" /> {a}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ label, value, ok, warn }: { label: string; value: number; ok?: boolean; warn?: boolean }) {
  if (!value) return null;
  const cls = warn
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : ok
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 ${cls}`}>
      {ok && !warn && <CheckCircle2 className="size-3" />}
      {label}: <b>{value}</b>
    </span>
  );
}
