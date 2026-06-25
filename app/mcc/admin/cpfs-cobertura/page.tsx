"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Filter, Loader2, Trash2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CpfItem {
  cpf: string;
  cep: string | null;
  contato: string | null;
  cobertura: string;
  motivoRecusa: string | null;
  createdAt: string;
}

interface ListResponse {
  items: CpfItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const MOTIVO_FILTERS = [
  { value: "todos", label: "Todos", className: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100" },
  { value: "aprovado", label: "Aprovado", className: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  { value: "Sem cobertura", label: "Sem cobertura", className: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" },
  { value: "Sem WhatsApp", label: "Sem WhatsApp", className: "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100" },
  { value: "Número incorreto", label: "Número incorreto", className: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" },
] as const;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function UnprocessCard({ onSuccess }: { onSuccess: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ deleted: number; total: number } | null>(null);

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

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/mcc/admin/cpfs-cobertura/unprocess", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Erro (${res.status})`);
        return;
      }
      setResult({ deleted: data.deleted, total: data.total });
      onSuccess();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFile(null);
    setResult(null);
    setError("");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-800">Descadastrar CPFs</h2>
      <p className="mt-1 text-sm text-slate-500">
        Faça upload de uma planilha com coluna &quot;CPF&quot; para remover os registros e permitir reprocessamento.
      </p>

      <div className="mt-4">
        {result ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-700">
                {result.deleted} CPF{result.deleted !== 1 ? "s" : ""} removido{result.deleted !== 1 ? "s" : ""} de {result.total} encontrado{result.total !== 1 ? "s" : ""} na planilha
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Nova planilha
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              role="button"
              tabIndex={0}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
              className={cn(
                "group flex items-center gap-4 rounded-xl border-2 border-dashed px-5 py-4 transition-all cursor-pointer",
                dragOver
                  ? "border-mcc-blue bg-mcc-light"
                  : file
                    ? "border-mcc-blue/40 bg-mcc-light/50"
                    : "border-slate-200 bg-slate-50/50 hover:border-mcc-blue/40",
              )}
            >
              {file ? (
                <>
                  <FileSpreadsheet className="size-6 text-mcc-blue shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="size-6 text-slate-400 group-hover:text-mcc-blue shrink-0" />
                  <p className="text-sm text-slate-500">Arraste a planilha aqui ou clique para selecionar</p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <XCircle className="size-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={!file || loading} className="bg-red-600 hover:bg-red-700 text-white">
                {loading ? <><Loader2 className="size-4 animate-spin" /> Processando...</> : <><Trash2 className="size-4" /> Descadastrar</>}
              </Button>
              {file && !loading && (
                <Button variant="outline" size="sm" onClick={handleReset}>Limpar</Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminCpfsCoberturaPage() {
  const [items, setItems] = useState<CpfItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [motivoFilter, setMotivoFilter] = useState("todos");
  const [sort, setSort] = useState("cpf_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort,
      });
      if (appliedSearch.trim()) params.set("q", appliedSearch.trim());
      if (motivoFilter !== "todos") params.set("motivo", motivoFilter);

      const res = await fetch(`/api/mcc/admin/cpfs-cobertura?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Falha ao carregar dados");
      }

      const data: ListResponse = await res.json();
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setSelected((prev) => prev.filter((cpf) => data.items.some((item) => item.cpf === cpf)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, motivoFilter, page, pageSize, sort]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const allSelected = useMemo(
    () => items.length > 0 && selected.length === items.length,
    [items.length, selected.length],
  );

  function resetToFirstPage() {
    setAppliedSearch(searchInput.trim());
    if (page !== 1) setPage(1);
    else void loadData();
  }

  async function handleDeleteBulk(values: string[]) {
    if (values.length === 0) return;
    try {
      const res = await fetch("/api/mcc/admin/cpfs-cobertura", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Falha ao remover registros");
      }
      setSelected([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover");
    }
  }

  async function handleDeleteOne(cpf: string) {
    await handleDeleteBulk([cpf]);
  }

  async function handleDeleteAll() {
    if (!confirm(`Tem certeza que deseja remover TODOS os ${total} CPFs processados? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch("/api/mcc/admin/cpfs-cobertura", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Falha ao limpar registros");
      }
      setSelected([]);
      setPage(1);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao limpar");
    }
  }

  async function handleExport(format: "xlsx" | "csv") {
    try {
      const params = new URLSearchParams({ format });
      if (appliedSearch.trim()) params.set("q", appliedSearch.trim());
      if (motivoFilter !== "todos") params.set("motivo", motivoFilter);
      const res = await fetch(`/api/mcc/admin/cpfs-cobertura/export?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Falha na exportação");
      }
      const blob = await res.blob();
      const dateTag = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `cpfs_cobertura_${dateTag}.${format}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na exportação");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">CPFs Processados</h1>
        <p className="mt-1 text-sm text-slate-500">
          CPFs que já foram processados com cobertura. Estes são removidos automaticamente de novas planilhas.
        </p>
      </div>

      <UnprocessCard onSuccess={() => void loadData()} />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por CPF, cobertura ou motivo"
          />
          <Button variant="outline" onClick={resetToFirstPage}>
            Buscar
          </Button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="cpf_asc">CPF crescente</option>
            <option value="cpf_desc">CPF decrescente</option>
            <option value="cobertura_asc">Cobertura A-Z</option>
            <option value="cobertura_desc">Cobertura Z-A</option>
            <option value="motivo_asc">Motivo A-Z</option>
            <option value="motivo_desc">Motivo Z-A</option>
            <option value="date_desc">Mais recentes</option>
            <option value="date_asc">Mais antigos</option>
          </select>
          <Button variant="outline" onClick={() => void handleExport("xlsx")}>
            <Download className="size-4" />
            Exportar XLSX
          </Button>
          <Button variant="outline" onClick={() => void handleExport("csv")}>
            <Download className="size-4" />
            Exportar CSV
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Filter className="size-3.5 text-slate-400" />
          {MOTIVO_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setMotivoFilter(f.value);
                setPage(1);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                motivoFilter === f.value
                  ? `${f.className} ring-2 ring-offset-1 ring-slate-300 shadow-sm`
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Total: <span className="font-semibold text-slate-900">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={selected.length === 0}
              onClick={() => void handleDeleteBulk(selected)}
            >
              <Trash2 className="size-3.5" />
              {selected.length}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              disabled={total === 0}
              onClick={() => void handleDeleteAll()}
            >
              <Trash2 className="size-3.5" />
              Limpar tudo
            </Button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}/página
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="w-12 border-b p-2 text-left">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => {
                      if (checked) setSelected(items.map((item) => item.cpf));
                      else setSelected([]);
                    }}
                  />
                </th>
                <th className="border-b p-2 text-left">CPF</th>
                <th className="border-b p-2 text-left">CEP</th>
                <th className="border-b p-2 text-left">Contato</th>
                <th className="border-b p-2 text-left">Cobertura</th>
                <th className="border-b p-2 text-left">Motivo</th>
                <th className="border-b p-2 text-left">Data</th>
                <th className="w-10 border-b p-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Carregando...
                    </span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    Nenhum CPF processado encontrado.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.cpf} className="hover:bg-slate-50">
                    <td className="border-b p-2">
                      <Checkbox
                        checked={selected.includes(item.cpf)}
                        onCheckedChange={(checked) => {
                          setSelected((prev) =>
                            checked ? [...prev, item.cpf] : prev.filter((id) => id !== item.cpf),
                          );
                        }}
                      />
                    </td>
                    <td className="border-b p-2 font-mono text-xs">{item.cpf}</td>
                    <td className="border-b p-2 font-mono text-xs text-slate-500">{item.cep ?? "—"}</td>
                    <td className="border-b p-2 font-mono text-xs text-slate-500">{item.contato ?? "—"}</td>
                    <td className="border-b p-2">
                      <span className="rounded-full bg-mcc-light px-2.5 py-0.5 text-xs font-medium text-mcc-dark">
                        {item.cobertura}
                      </span>
                    </td>
                    <td className="border-b p-2">
                      {item.motivoRecusa ? (
                        <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                          {item.motivoRecusa}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Aprovado
                        </span>
                      )}
                    </td>
                    <td className="border-b p-2 text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="border-b p-2">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => void handleDeleteOne(item.cpf)}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>
            Página {page} de {Math.max(1, totalPages)}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
