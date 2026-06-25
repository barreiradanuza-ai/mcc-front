import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { getResourceConfig } from "@/lib/mcc/admin";

export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDelegate(resource: string): any {
  switch (resource) {
    case "ceps-claro":
      return prisma.cepClaro;
    case "ceps-nio":
      return prisma.cepNio;
    case "ceps-tim":
      return prisma.cepTim;
    case "cidades-promo-claro":
      return prisma.cidadePromoClaro;
    default:
      return null;
  }
}

function getWhere(column: "cep" | "cidade", search: string | null) {
  if (!search) return {};
  if (column === "cep") {
    const digits = search.replace(/\D/g, "");
    if (!digits) return {};
    return { [column]: { contains: digits } };
  }
  return { [column]: { contains: search.trim().toUpperCase(), mode: "insensitive" as const } };
}

function toCsv(rows: string[], header: string) {
  const lines = [header, ...rows.map((row) => `"${row.replace(/"/g, "\"\"")}"`)];
  return lines.join("\n");
}

export async function GET(
  req: Request,
  context: { params: Promise<{ resource: string }> },
) {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;

  const { resource } = await context.params;
  const config = getResourceConfig(resource);
  const delegate = getDelegate(resource);
  if (!config || !delegate) {
    return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const rows = await delegate.findMany({
    where: getWhere(config.column, q),
    orderBy: { [config.column]: "asc" },
    select: { [config.column]: true },
  });
  const values: string[] = rows.map((row: Record<string, string>) => row[config.column]);
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `${config.filename}_${dateTag}.${format}`;

  if (format === "csv") {
    const csv = toCsv(values, config.column.toUpperCase());
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const sheet = XLSX.utils.json_to_sheet(
    values.map((value: string) => ({ [config.column.toUpperCase()]: value })),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "dados");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
