import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { parsePositiveInt } from "@/lib/mcc/admin";

export const runtime = "nodejs";

function filters(url: URL) {
  const q = url.searchParams.get("q")?.trim();
  const uf = url.searchParams.get("uf")?.trim().toUpperCase();
  const municipio = url.searchParams.get("municipio")?.trim();
  const viabilidade = url.searchParams.get("viabilidade")?.trim();
  const where: Record<string, unknown> = {};
  if (q) where.OR = [
    { cep: { contains: q.replace(/\D/g, "") } },
    { municipio: { contains: q, mode: "insensitive" } },
    { bairro: { contains: q, mode: "insensitive" } },
    { logradouro: { contains: q, mode: "insensitive" } },
    { noFachada: { contains: q, mode: "insensitive" } },
  ];
  if (uf) where.uf = uf;
  if (municipio) where.municipio = { contains: municipio, mode: "insensitive" };
  if (viabilidade) where.viabilidadeAtual = { contains: viabilidade, mode: "insensitive" };
  return where;
}

const select = {
  id: true, cep: true, uf: true, municipio: true, bairro: true, logradouro: true,
  noFachada: true, complemento1: true, complemento2: true, complemento3: true,
  codigoLogradouro: true, codigoCdo: true, classificacao: true, celula: true,
  estacao: true, viabilidadeAtual: true, regiao: true, relatorioOrigem: true,
  atualizadoEm: true,
};

export async function GET(req: Request) {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;
  const url = new URL(req.url);
  const where = filters(url);
  const cepQuery = url.searchParams.get("q")?.replace(/\D/g, "");
  const exactCep = cepQuery && cepQuery.length === 8 ? cepQuery : null;
  const format = url.searchParams.get("format");
  if (format === "csv" || format === "xlsx") {
    const rows = await prisma.superListaNio.findMany({ where, orderBy: [{ uf: "asc" }, { cep: "asc" }], take: 200000, select });
    const values = rows.map((row) => ({
      CEP: row.cep.trim(), UF: row.uf, MUNICIPIO: row.municipio ?? "", BAIRRO: row.bairro ?? "",
      LOGRADOURO: row.logradouro ?? "", NO_FACHADA: row.noFachada ?? "", COMPLEMENTO1: row.complemento1 ?? "",
      COMPLEMENTO2: row.complemento2 ?? "", COMPLEMENTO3: row.complemento3 ?? "", CODIGO_LOGRADOURO: row.codigoLogradouro ?? "",
      CODIGO_CDO: row.codigoCdo ?? "", CLASSIFICACAO: row.classificacao ?? "", CELULA: row.celula ?? "",
      ESTACAO: row.estacao ?? "", VIABILIDADE_ATUAL: row.viabilidadeAtual ?? "", REGIAO: row.regiao ?? "",
      RELATORIO_ORIGEM: row.relatorioOrigem ?? "", ATUALIZADO_EM: row.atualizadoEm.toISOString(),
    }));
    const date = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      const sheet = XLSX.utils.json_to_sheet(values);
      const csv = XLSX.utils.sheet_to_csv(sheet);
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="super_lista_nio_${date}.csv"` } });
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(values), "fachadas");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="super_lista_nio_${date}.xlsx"` } });
  }
  const page = parsePositiveInt(url.searchParams.get("page"), 1, 100000);
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 50, 200);
  const [total, rows, nioCoverage] = await Promise.all([
    prisma.superListaNio.count({ where }),
    prisma.superListaNio.findMany({ where, orderBy: [{ uf: "asc" }, { cep: "asc" }], skip: (page - 1) * pageSize, take: pageSize, select }),
    exactCep ? prisma.cepNio.findUnique({ where: { cep: exactCep }, select: { cep: true } }) : Promise.resolve(null),
  ]);
  return NextResponse.json({ items: rows.map((row) => ({ ...row, id: row.id.toString() })), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), nioCoverage: Boolean(nioCoverage), searchedCep: exactCep });
}


