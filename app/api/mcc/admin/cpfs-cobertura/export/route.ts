import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";

export const runtime = "nodejs";

function getWhere(q: string | null, motivo: string | null) {
  const conditions: Record<string, unknown>[] = [];

  if (motivo === "aprovado") {
    conditions.push({ motivoRecusa: null });
  } else if (motivo && motivo !== "todos") {
    conditions.push({ motivoRecusa: motivo });
  }

  if (q) {
    const trimmed = q.trim();
    const digits = trimmed.replace(/\D/g, "");
    if (digits) {
      conditions.push({ cpf: { contains: digits } });
    } else {
      conditions.push({
        OR: [
          { cobertura: { contains: trimmed, mode: "insensitive" as const } },
          { motivoRecusa: { contains: trimmed, mode: "insensitive" as const } },
        ],
      });
    }
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}

export async function GET(req: Request) {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const motivo = url.searchParams.get("motivo");
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const rows = await prisma.cpfCobertura.findMany({
    where: getWhere(q, motivo),
    orderBy: { cpf: "asc" },
    select: { cpf: true, cep: true, contato: true, cobertura: true, motivoRecusa: true, createdAt: true },
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `cpfs_cobertura_${dateTag}.${format}`;

  const data = rows.map((row) => ({
    CPF: row.cpf,
    CEP: row.cep?.trim() ?? "",
    CONTATO: row.contato ?? "",
    COBERTURA: row.cobertura,
    MOTIVO_RECUSA: row.motivoRecusa ?? "",
    DATA: row.createdAt.toISOString().slice(0, 10),
  }));

  if (format === "csv") {
    const header = "CPF;CEP;CONTATO;COBERTURA;MOTIVO_RECUSA;DATA";
    const lines = data.map(
      (r) => `"${r.CPF}";"${r.CEP}";"${r.CONTATO}";"${r.COBERTURA}";"${r.MOTIVO_RECUSA}";"${r.DATA}"`,
    );
    const csv = [header, ...lines].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const sheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "cpfs_cobertura");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
