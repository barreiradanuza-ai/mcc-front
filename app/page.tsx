"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Item = { id: string; cep: string; uf: string; municipio: string | null; bairro: string | null; logradouro: string | null; noFachada: string | null; viabilidadeAtual: string | null; regiao: string | null; relatorioOrigem: string | null };
type ResponseData = { items: Item[]; total: number; page: number; totalPages: number; nioCoverage?: boolean; searchedCep?: string | null };

export default function SuperListaNioPage() {
  const [data, setData] = useState<ResponseData>({ items: [], total: 0, page: 1, totalPages: 1 });
  const [q, setQ] = useState("");
  const [uf, setUf] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [viabilidade, setViabilidade] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const query = useCallback(async (targetPage = page) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: "50" });
      if (q.trim()) params.set("q", q.trim());
      if (uf) params.set("uf", uf);
      if (municipio.trim()) params.set("municipio", municipio.trim());
      if (viabilidade.trim()) params.set("viabilidade", viabilidade.trim());
      const res = await fetch(`/api/mcc/admin/super-lista-nio?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao consultar fachadas");
      setData(json); setPage(targetPage);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao consultar fachadas"); }
    finally { setLoading(false); }
  }, [municipio, page, q, uf, viabilidade]);

  useEffect(() => { void query(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function exportFile(format: "csv" | "xlsx") {
    const params = new URLSearchParams({ format });
    if (q.trim()) params.set("q", q.trim());
    if (uf) params.set("uf", uf);
    if (municipio.trim()) params.set("municipio", municipio.trim());
    if (viabilidade.trim()) params.set("viabilidade", viabilidade.trim());
    window.location.href = `/api/mcc/admin/super-lista-nio?${params}`;
  }

  return <div className="flex flex-col gap-5">
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mcc-blue">Backoffice NIO</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Super Lista NIO</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Consulte fachadas viáveis consolidadas dos cinco relatórios regionais NIO. A base é atualizada quinzenalmente.</p>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="CEP, bairro, logradouro ou fachada" />
        <select value={uf} onChange={(e) => setUf(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">Todas as UFs</option>{"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ").map((x) => <option key={x}>{x}</option>)}</select>
        <Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Município" />
        <Input value={viabilidade} onChange={(e) => setViabilidade(e.target.value)} placeholder="Viabilidade" />
        <Button onClick={() => void query(1)}><Search className="size-4" />Buscar</Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => exportFile("csv")}><Download className="size-4" />Exportar CSV</Button><Button variant="outline" onClick={() => exportFile("xlsx")}><Download className="size-4" />Exportar XLSX</Button></div>
    </div>
    {data.searchedCep && <div className={`rounded-xl border p-4 text-sm ${data.nioCoverage ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
      <strong>CEP {data.searchedCep}:</strong> {data.nioCoverage ? "possui cobertura NIO." : "não foi encontrado na base de cobertura NIO."} {data.nioCoverage && data.total === 0 ? "Não há fachadas detalhadas cadastradas para este CEP." : "As fachadas e a viabilidade aparecem na tabela abaixo."}
    </div>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-600">Total: <strong className="text-slate-900">{data.total.toLocaleString("pt-BR")}</strong><span>Página {data.page} de {data.totalPages}</span></div>
      <div className="overflow-x-auto rounded-lg border"><table className="min-w-[1100px] border-collapse text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr>{["CEP","UF","Município","Bairro","Logradouro","Fachada","Viabilidade","Região","Origem"].map((h) => <th key={h} className="border-b p-2">{h}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={9} className="p-8 text-center text-slate-500"><Loader2 className="mx-auto size-5 animate-spin" /></td></tr> : data.items.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-slate-500">Nenhuma fachada encontrada.</td></tr> : data.items.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="border-b p-2 font-mono">{item.cep.trim()}</td><td className="border-b p-2">{item.uf}</td><td className="border-b p-2">{item.municipio ?? "—"}</td><td className="border-b p-2">{item.bairro ?? "—"}</td><td className="border-b p-2">{item.logradouro ?? "—"}</td><td className="border-b p-2">{item.noFachada ?? "—"}</td><td className="border-b p-2">{item.viabilidadeAtual ?? "—"}</td><td className="border-b p-2">{item.regiao ?? "—"}</td><td className="border-b p-2">{item.relatorioOrigem ?? "—"}</td></tr>)}</tbody></table></div>
      <div className="mt-4 flex justify-between"><Button variant="outline" disabled={page <= 1 || loading} onClick={() => void query(page - 1)}>Anterior</Button><Button variant="outline" disabled={page >= data.totalPages || loading} onClick={() => void query(page + 1)}>Próxima</Button></div>
    </div>
  </div>;
}

