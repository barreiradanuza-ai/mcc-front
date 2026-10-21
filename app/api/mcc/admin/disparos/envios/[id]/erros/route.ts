import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { getEnvioJob, type ErroLinha } from "@/lib/mcc/disparos";

export const runtime = "nodejs";

/** GET: planilha .xlsx com as linhas que falharam no envio. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await ensureMccSession();
  if (error) return error;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  let erros: ErroLinha[] = [];
  const job = getEnvioJob(id);
  if (job) erros = job.erros;
  else {
    const reg = await prisma.disparoEnvio.findUnique({ where: { id }, select: { erros: true } });
    if (!reg) return NextResponse.json({ error: "Envio não encontrado" }, { status: 404 });
    erros = (Array.isArray(reg.erros) ? reg.erros : []) as unknown as ErroLinha[];
  }

  const data = erros.map((e) => ({ Linha: e.linha, Nome: e.nome, Telefone: e.telefone, Erro: e.erro }));
  const sheet = XLSX.utils.json_to_sheet(data.length ? data : [{ Linha: "", Nome: "", Telefone: "", Erro: "Nenhuma falha" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "falhas");
  const buffer: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="envio_${id}_falhas.xlsx"`,
    },
  });
}
