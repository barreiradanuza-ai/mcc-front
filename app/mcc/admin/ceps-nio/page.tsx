"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

type Job = { id: string; status: string; phase: string; collected: number; valid: boolean; problems: string[]; created_at?: string };

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/mcc/admin/ceps-nio/export/${path}`, { ...init, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? data.detail ?? "Falha na operação");
  return data as Job;
}

export default function AdminCepsNioPage() {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await api("status");
      const jobs = (data as unknown as { jobs: Job[] }).jobs ?? [];
      setJob(jobs.at(-1) ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao consultar o extrator"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [job]);

  async function start() {
    setError(""); setLoading(true);
    try { setJob(await api("start", { method: "POST" })); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao iniciar"); }
    finally { setLoading(false); }
  }
  async function cancel() {
    if (!job) return;
    setError("");
    try { setJob(await api("cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job_id: job.id }) })); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao cancelar"); }
  }
  function download(kind: "csv" | "audit") {
    if (job) window.location.href = `/api/mcc/admin/ceps-nio/export/download?job_id=${encodeURIComponent(job.id)}&kind=${kind}`;
  }

  const active = job && ["queued", "running"].includes(job.status);
  const completed = job?.status === "completed";
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mcc-blue">Exportação NIO</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Gerar CEPs de todo o Brasil</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Execute a coleta dos relatórios regionais, acompanhe a auditoria e baixe o CSV. Esta ferramenta não altera a tabela do MCC automaticamente.</p>
          </div>
          {!active ? <Button onClick={() => void start()} disabled={loading}><Play className="size-4" />Iniciar nova extração</Button> : <Button variant="outline" onClick={() => void cancel()}><Square className="size-4" />Cancelar</Button>}
        </div>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><div className="rounded-full bg-slate-100 p-2">{active ? <Loader2 className="size-5 animate-spin text-mcc-blue" /> : completed && job.valid ? <CheckCircle2 className="size-5 text-emerald-600" /> : <AlertTriangle className="size-5 text-amber-600" />}</div><div><h2 className="font-semibold text-slate-900">{job ? job.phase : "Nenhuma extração iniciada"}</h2><p className="text-sm text-slate-500">{job ? `${job.collected.toLocaleString("pt-BR")} CEPs coletados · status: ${job.status}` : "Clique em iniciar para criar um job."}</p></div></div>
        {job?.problems?.length ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">CSV provisório — revisão necessária</p><p className="mt-1 text-sm text-amber-800">O arquivo pode ser baixado para conferência, mas não deve ser importado como cobertura nacional definitiva.</p><ul className="mt-2 list-disc pl-5 text-sm text-amber-800">{job.problems.map((p) => <li key={p}>{p}</li>)}</ul></div> : null}
        {completed && <div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => download("csv")}><Download className="size-4" />{job.valid ? "Baixar CSV validado" : "Baixar CSV provisório"}</Button><Button variant="outline" onClick={() => download("audit")}><Download className="size-4" />Baixar auditoria</Button></div>}
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-900"><strong>Regra de segurança:</strong> um estado que retorna 29.998/29.999 CEPs sem confirmação de paginação é considerado inconclusivo. O CSV nacional não será liberado como completo nesse caso.</div>
    </div>
  );
}
