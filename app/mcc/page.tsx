"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Upload,
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  TableProperties,
  UserX,
  Phone,
  MessageCircleOff,
  Clock,
} from "lucide-react";

interface ProcessResult {
  total: number;
  withCoverage: number;
  withoutCoverage: number;
  incorrectNumber: number;
  withoutWhatsApp: number;
  invalid: number;
  skippedCpfs: number;
  newCpfsSaved: number;
  elapsedMs: number;
  downloadUrl: string;
  filename: string;
  creditsRemaining: number | null;
}

const POLL_INTERVAL_MS = 3000;

export default function MccDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressChecked, setProgressChecked] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const accept = ".xlsx,.xls";

  function handleFile(f: File | undefined) {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      setError("Formato inválido. Use arquivos .xlsx ou .xls");
      return;
    }
    setFile(f);
    setError("");
    setResult(null);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  function stopTimers() {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    pollTimerRef.current = null;
    elapsedTimerRef.current = null;
  }

  useEffect(() => {
    return () => stopTimers();
  }, []);

  async function pollJobStatus(jobId: string) {
    try {
      const res = await fetch(`/api/mcc/jobs/${jobId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Erro ao verificar status (${res.status})`);
        setLoading(false);
        stopTimers();
        return;
      }

      const data = await res.json();

      if (data.progressMsg) setProgressMsg(data.progressMsg);
      if (data.progressChecked !== undefined) setProgressChecked(data.progressChecked);
      if (data.progressTotal !== undefined) setProgressTotal(data.progressTotal);

      if (data.status === "done") {
        stopTimers();
        // Download the file
        const downloadRes = await fetch(`/api/mcc/jobs/${jobId}/download`);
        if (!downloadRes.ok) {
          setError("Erro ao baixar o arquivo processado");
          setLoading(false);
          return;
        }
        const blob = await downloadRes.blob();
        const downloadUrl = URL.createObjectURL(blob);

        const stats = data.resultStats;
        setResult({
          total: stats.total,
          withCoverage: stats.withCoverage,
          withoutCoverage: stats.withoutCoverage,
          incorrectNumber: stats.incorrectNumber,
          withoutWhatsApp: stats.withoutWhatsApp,
          invalid: stats.invalid,
          skippedCpfs: stats.skippedCpfs,
          newCpfsSaved: stats.newCpfsSaved,
          elapsedMs: stats.elapsedMs,
          creditsRemaining: stats.creditsRemaining ?? null,
          downloadUrl,
          filename: data.resultFilename,
        });
        setLoading(false);
        setProgressMsg("");
      } else if (data.status === "error") {
        stopTimers();
        setError(data.errorMessage ?? "Erro ao processar planilha");
        setLoading(false);
      } else {
        // Still processing — poll again
        pollTimerRef.current = setTimeout(() => pollJobStatus(jobId), POLL_INTERVAL_MS);
      }
    } catch {
      stopTimers();
      setError("Erro de conexão ao verificar status do processamento");
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    setProgressMsg("Enviando planilha...");
    setProgressChecked(0);
    setProgressTotal(0);
    setElapsedSeconds(0);
    startTimeRef.current = Date.now();

    // Start elapsed timer
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/mcc", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Erro ao enviar planilha (${res.status})`);
        setLoading(false);
        stopTimers();
        return;
      }

      const { jobId } = await res.json();
      setProgressMsg("Processando planilha em segundo plano...");

      // Start polling
      pollTimerRef.current = setTimeout(() => pollJobStatus(jobId), POLL_INTERVAL_MS);
    } catch {
      setError("Erro de conexão ao enviar planilha");
      setLoading(false);
      stopTimers();
    }
  }

  function handleDownload() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.downloadUrl;
    a.download = result.filename;
    a.click();
  }

  function handleReset() {
    if (result?.downloadUrl) URL.revokeObjectURL(result.downloadUrl);
    setFile(null);
    setResult(null);
    setError("");
    setProgressMsg("");
    setProgressChecked(0);
    setProgressTotal(0);
    setElapsedSeconds(0);
    stopTimers();
  }

  const progressPercent = progressTotal > 0 ? Math.round((progressChecked / progressTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-mcc-blue/10">
            <TableProperties className="size-5 text-mcc-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cobertura por CEP</h1>
            <p className="text-sm text-slate-500">
              Faça upload de uma planilha com CEPs para verificar a cobertura disponível.
            </p>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Card Header */}
        <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-5">
          <h2 className="font-semibold text-slate-800">Upload de planilha</h2>
          <p className="mt-1 text-sm text-slate-500">
            A planilha deve ter colunas &quot;CEP&quot;, &quot;CPF&quot; e &quot;CONTATO&quot;.
            CPFs já processados serão removidos e uma coluna &quot;Cobertura&quot; será adicionada.
          </p>
        </div>

        {/* Card Body */}
        <div className="p-8">
          {!result && (
            <div className="flex flex-col gap-5">
              {/* Drop Zone */}
              <div
                role="button"
                tabIndex={0}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !loading && inputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && !loading && inputRef.current?.click()}
                className={`
                  group relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed
                  px-6 py-14 transition-all duration-200
                  ${loading ? "cursor-default" : "cursor-pointer"}
                  ${dragOver
                    ? "border-mcc-blue bg-mcc-light scale-[1.01]"
                    : file
                      ? "border-mcc-blue/40 bg-mcc-light/50"
                      : "border-slate-200 bg-slate-50/50 hover:border-mcc-blue/40 hover:bg-slate-50"
                  }
                `}
              >
                {file ? (
                  <>
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-mcc-blue/10">
                      <FileSpreadsheet className="size-8 text-mcc-blue" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-slate-800">{file.name}</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {(file.size / 1024).toFixed(1)} KB &mdash; Pronto para processar
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100 transition-colors group-hover:bg-mcc-blue/10">
                      <Upload className="size-8 text-slate-400 transition-colors group-hover:text-mcc-blue" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-slate-700">
                        Arraste a planilha aqui ou clique para selecionar
                      </p>
                      <p className="mt-1 text-sm text-slate-400">Formatos aceitos: .xlsx, .xls</p>
                    </div>
                  </>
                )}

                <input
                  ref={inputRef}
                  type="file"
                  accept={accept}
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>

              {/* Progress */}
              {loading && (
                <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="size-4 shrink-0 animate-spin text-blue-600" />
                    <p className="text-sm font-medium text-blue-700">{progressMsg || "Processando..."}</p>
                  </div>
                  {progressTotal > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs text-blue-600">
                        <span>{progressChecked} / {progressTotal} linhas processadas</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-blue-500">
                    <Clock className="size-3" />
                    <span>Tempo decorrido: {elapsedSeconds}s — O processamento continua mesmo se você fechar esta aba</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <XCircle className="size-5 shrink-0 text-red-500" />
                  <p className="text-sm font-medium text-red-700">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className="h-11 flex-1 bg-mcc-blue text-sm font-semibold hover:bg-mcc-dark"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="size-4" />
                      Processar planilha
                    </>
                  )}
                </Button>
                {file && !loading && (
                  <Button variant="outline" className="h-11" onClick={handleReset}>
                    Limpar
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="flex flex-col gap-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([
                  { label: "Total linhas", value: result.total, Icon: FileSpreadsheet, color: "text-slate-600", bg: "bg-slate-50" },
                  { label: "Com cobertura", value: result.withCoverage, Icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
                  { label: "Sem cobertura", value: result.withoutCoverage, Icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
                  { label: "CPFs duplicados", value: result.skippedCpfs, Icon: UserX, color: "text-amber-600", bg: "bg-amber-50" },
                  { label: "CEP inválido", value: result.invalid, Icon: AlertTriangle, color: "text-slate-600", bg: "bg-slate-50" },
                ] as const).map((s) => (
                  <Card key={s.label} className="gap-0 py-3">
                    <CardHeader className="flex flex-row items-center justify-between pb-1">
                      <CardDescription className="text-[10px] font-semibold uppercase tracking-wider">
                        {s.label}
                      </CardDescription>
                      <div className={`flex size-7 items-center justify-center rounded-lg ${s.bg}`}>
                        <s.Icon className={`size-3.5 ${s.color}`} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold ${s.color}`}>${s.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Download Section */}
              <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-8 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="size-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-900">Processamento Concluído!</h3>
                  <p className="mt-1 text-sm text-emerald-700">
                    A planilha processada com as informações de cobertura está pronta para download.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleDownload}
                    className="h-11 bg-emerald-600 px-8 font-semibold hover:bg-emerald-700"
                  >
                    <Download className="mr-2 size-4" />
                    Baixar Planilha Processada
                  </Button>
                  <Button variant="outline" className="h-11 border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50" onClick={handleReset}>
                    <RotateCcw className="mr-2 size-4" />
                    Novo Processamento
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
