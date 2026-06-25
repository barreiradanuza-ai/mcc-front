"use client";

import { useCallback, useRef, useState } from "react";
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
  Wallet,
  ExternalLink,
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

export default function MccDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [progressMsg, setProgressMsg] = useState("");

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

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    setProgressMsg("Enviando planilha...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/mcc/process", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Erro ao processar (${res.status})`);
        setLoading(false);
        setProgressMsg("");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Erro: resposta sem body");
        setLoading(false);
        setProgressMsg("");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "progress") {
              setProgressMsg(msg.message ?? "Processando...");
            } else if (msg.type === "done") {
              const base64 = msg.fileBase64;
              const binaryStr = atob(base64);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
              const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
              const downloadUrl = URL.createObjectURL(blob);

              window.dispatchEvent(new Event("wavalidator:credits-updated"));

              setResult({
                total: msg.total,
                withCoverage: msg.withCoverage,
                withoutCoverage: msg.withoutCoverage,
                incorrectNumber: msg.incorrectNumber,
                withoutWhatsApp: msg.withoutWhatsApp,
                invalid: msg.invalid,
                skippedCpfs: msg.skippedCpfs,
                newCpfsSaved: msg.newCpfsSaved,
                elapsedMs: msg.elapsedMs,
                creditsRemaining: msg.creditsRemaining ?? null,
                downloadUrl,
                filename: msg.filename,
              });
            } else if (msg.type === "error") {
              setError(msg.error ?? "Erro ao processar planilha");
            }
          } catch {
            // ignore malformed JSON lines
          }
        }
      }
    } catch {
      setError("Erro de conexão ao processar planilha");
    } finally {
      setLoading(false);
      setProgressMsg("");
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
  }

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
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
                className={`
                  group relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed
                  px-6 py-14 transition-all duration-200 cursor-pointer
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
              {loading && progressMsg && (
                <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <Loader2 className="size-4 animate-spin text-blue-600" />
                  <p className="text-sm font-medium text-blue-700">{progressMsg}</p>
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
                  { label: "Número incorreto", value: result.incorrectNumber, Icon: Phone, color: "text-purple-600", bg: "bg-purple-50" },
                  { label: "Sem WhatsApp", value: result.withoutWhatsApp, Icon: MessageCircleOff, color: "text-purple-600", bg: "bg-purple-50" },
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
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Credits info */}
              {result.creditsRemaining !== null && (
                <a
                  href="https://wavalidator.com/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 transition-colors hover:bg-amber-100"
                >
                  <Wallet className="size-5 text-amber-600" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800">
                      {result.creditsRemaining.toLocaleString("pt-BR")} créditos restantes
                    </p>
                    <p className="text-xs text-amber-600">Clique para recarregar no Wavalidator</p>
                  </div>
                  <ExternalLink className="size-4 text-amber-400" />
                </a>
              )}

              {/* Success + Download */}
              <div className="flex flex-col items-center gap-5 rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-8">
                <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="size-7 text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-800">Planilha processada com sucesso</p>
                  <p className="mt-1 text-sm text-slate-500">{result.filename}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Processado em{" "}
                    {result.elapsedMs >= 1000
                      ? `${(result.elapsedMs / 1000).toFixed(1)}s`
                      : `${result.elapsedMs}ms`}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleDownload}
                    className="h-11 bg-emerald-600 px-6 text-sm font-semibold hover:bg-emerald-700"
                  >
                    <Download className="size-4" />
                    Baixar planilha
                  </Button>
                  <Button variant="outline" className="h-11" onClick={handleReset}>
                    <RotateCcw className="size-4" />
                    Nova planilha
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info footer */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Valores possíveis de cobertura</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Claro", "Claro Promo", "Tim", "Nio", "Tim e Claro", "Tim e Claro Promo", "Nio e Claro", "Nio e Claro Promo", "Tim e Nio", "Claro e Tim e Nio", "Claro Promo e Tim e Nio", "Sem cobertura", "CEP inválido"].map(
            (label) => (
              <span
                key={label}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  label === "Sem cobertura"
                    ? "bg-red-50 text-red-700"
                    : label === "CEP inválido"
                      ? "bg-slate-100 text-slate-500"
                      : "bg-mcc-light text-mcc-dark"
                }`}
              >
                {label}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
