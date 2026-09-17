"use client";

import { FormEvent, useState } from "react";
import { Loader2, Search, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Address = { cep: string; logradouro: string; bairro: string; municipio: string; uf: string; complemento: string };
type Facade = Record<string, string>;
type Result = { cep: string; address: Address; region: string; facades: Facade[]; total: number; source: string };

const fields: [string, string][] = [
  ["NO_FACHADA", "Fachada"], ["COMPLEMENTO1", "Complemento 1"],
  ["COMPLEMENTO2", "Complemento 2"], ["COMPLEMENTO3", "Complemento 3"],
];

export default function ConsultaFachadasNioPage() {
  const [cep, setCep] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) { setError("Informe um CEP com 8 dígitos."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch(`/api/mcc/admin/consulta-fachadas-nio?cep=${clean}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao consultar o Power BI");
      setResult(data);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao consultar fachadas"); }
    finally { setLoading(false); }
  }

  return <div className="flex flex-col gap-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mcc-blue">Consulta online NIO</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Fachadas NIO por CEP</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Consulta direta ao relatório regional Power BI, sem usar a base local de CEPs ou fachadas. Pode levar alguns segundos.</p>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
        <Input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="Digite o CEP" inputMode="numeric" maxLength={9} className="sm:max-w-sm" />
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}Consultar no Power BI</Button>
      </form>
      {loading && <p className="mt-3 text-xs text-slate-500">Abrindo o relatório regional, autenticando como PARCEIRO e consultando o CEP...</p>}
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    </section>
    {result && <>
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <div className="flex items-center gap-2 font-semibold"><Wifi className="size-4" />{result.total} fachada(s) retornada(s) pelo Power BI</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2"><span><strong>CEP:</strong> {result.address.cep}</span><span><strong>Cidade/UF:</strong> {result.address.municipio}/{result.address.uf}</span><span><strong>Endereço:</strong> {[result.address.logradouro, result.address.bairro].filter(Boolean).join(" — ") || "não informado"}</span><span><strong>Relatório:</strong> {result.region}</span></div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Fachadas e complementos</h2><p className="text-xs text-slate-500">Fonte: {result.source}</p></div>
        <div className="overflow-x-auto"><table className="min-w-[760px] border-collapse text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr>{fields.map(([, label]) => <th key={label} className="border-b p-3">{label}</th>)}</tr></thead><tbody>{result.facades.length === 0 ? <tr><td colSpan={fields.length} className="p-10 text-center text-slate-500">Nenhuma fachada retornada para este CEP no relatório regional.</td></tr> : result.facades.map((row, index) => <tr key={`${row.NO_FACHADA ?? "fachada"}-${index}`} className="hover:bg-slate-50">{fields.map(([key]) => <td key={key} className="border-b p-3">{row[key] || "—"}</td>)}</tr>)}</tbody></table></div>
      </section>
    </>}
  </div>;
}
