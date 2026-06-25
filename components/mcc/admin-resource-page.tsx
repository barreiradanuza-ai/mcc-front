"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { type AdminResource, getResourceConfig } from "@/lib/mcc/admin";

type DataItem = { id: string; value: string };

interface ListResponse {
  items: DataItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminResourcePage({ resource }: { resource: AdminResource }) {
  const config = getResourceConfig(resource);
  const [items, setItems] = useState<DataItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sort, setSort] = useState<"value_asc" | "value_desc">("value_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [importing, setImporting] = useState(false);

  const title = config?.label ?? "Recurso";
  const columnLabel = config?.column.toUpperCase() ?? "VALOR";

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

      const res = await fetch(`/api/mcc/admin/${resource}?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Falha ao carregar dados");
      }

      const data: ListResponse = await res.json();
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setSelected((prev) => prev.filter((id) => data.items.some((item) => item.id === id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page, pageSize, resource, sort]);

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

  async function addValues(values: string[]) {
    const res = await fetch(`/api/mcc/admin/${resource}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "Falha ao adicionar registros");
    }
  }

  async function handleAddOne() {
    if (!manualValue.trim()) return;
    try {
      await addValues([manualValue]);
      setManualValue("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar");
    }
  }

  async function handleAddBulk() {
    const lines = bulkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    try {
      await addValues(lines);
      setBulkText("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar em lote");
    }
  }

  async function handleDeleteBulk(values: string[]) {
    if (values.length === 0) return;
    try {
      const res = await fetch(`/api/mcc/admin/${resource}`, {
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

  async function handleDeleteOne(id: string) {
    try {
      const res = await fetch(`/api/mcc/admin/${resource}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Falha ao remover");
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover");
    }
  }

  async function handleSaveEdit() {
    if (!editingValue) return;
    try {
      const res = await fetch(`/api/mcc/admin/${resource}/${encodeURIComponent(editingValue)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: editingDraft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Falha ao atualizar");
      }
      setEditingValue(null);
      setEditingDraft("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  }

  async function handleImport(file: File | null) {
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/mcc/admin/${resource}/import`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Falha na importação");
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na importação");
    } finally {
      setImporting(false);
    }
  }

  async function handleExport(format: "xlsx" | "csv") {
    try {
      const params = new URLSearchParams({ format });
      if (appliedSearch.trim()) params.set("q", appliedSearch.trim());
      const res = await fetch(`/api/mcc/admin/${resource}/export?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Falha na exportação");
      }
      const blob = await res.blob();
      const dateTag = new Date().toISOString().slice(0, 10);
      const filename = `${resource}_${dateTag}.${format}`;
      downloadBlob(blob, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na exportação");
    }
  }

  if (!config) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Recurso administrativo inválido.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie registros com edição manual, importação em massa e exportação de planilha.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={`Buscar por ${columnLabel}`}
          />
          <Button variant="outline" onClick={resetToFirstPage}>
            Buscar
          </Button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "value_asc" | "value_desc")}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="value_asc">Ordem crescente</option>
            <option value="value_desc">Ordem decrescente</option>
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
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Adicionar manualmente</p>
          <div className="mt-3 flex gap-2">
            <Input
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder={columnLabel}
            />
            <Button onClick={() => void handleAddOne()}>
              <Plus className="size-4" />
              Adicionar
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Importar planilha</p>
          <div className="mt-3 flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              <FileUp className="size-4" />
              Selecionar arquivo
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={(e) => void handleImport(e.target.files?.[0] ?? null)}
              />
            </label>
            {importing && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Loader2 className="size-3 animate-spin" />
                Importando...
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-slate-700">Adicionar em lote (um valor por linha)</p>
        <div className="flex flex-col gap-2">
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="min-h-28 rounded-md border border-slate-200 p-3 text-sm"
            placeholder={`${columnLabel}\n${columnLabel}\n${columnLabel}`}
          />
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => void handleAddBulk()}>
              <Plus className="size-4" />
              Inserir em lote
            </Button>
          </div>
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
              <Trash2 className="size-4" />
              Remover selecionados ({selected.length})
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

        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="w-12 border-b p-2 text-left">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => {
                      if (checked) setSelected(items.map((item) => item.id));
                      else setSelected([]);
                    }}
                  />
                </th>
                <th className="border-b p-2 text-left">{columnLabel}</th>
                <th className="w-40 border-b p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Carregando...
                    </span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-slate-500">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isEditing = editingValue === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="border-b p-2">
                        <Checkbox
                          checked={selected.includes(item.id)}
                          onCheckedChange={(checked) => {
                            setSelected((prev) =>
                              checked ? [...prev, item.id] : prev.filter((id) => id !== item.id),
                            );
                          }}
                        />
                      </td>
                      <td className="border-b p-2">
                        {isEditing ? (
                          <Input value={editingDraft} onChange={(e) => setEditingDraft(e.target.value)} />
                        ) : (
                          item.value
                        )}
                      </td>
                      <td className="border-b p-2">
                        <div className="flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <Button size="sm" onClick={() => void handleSaveEdit()}>
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingValue(null);
                                  setEditingDraft("");
                                }}
                              >
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingValue(item.id);
                                  setEditingDraft(item.value);
                                }}
                              >
                                <Pencil className="size-3" />
                                Editar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => void handleDeleteOne(item.id)}>
                                <Trash2 className="size-3" />
                                Remover
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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
