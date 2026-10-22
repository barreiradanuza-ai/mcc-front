import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { ensureMccSession } from "@/lib/mcc/authz";
import { getEnvioJob, planilhaComResultado } from "@/lib/mcc/disparos";

export const runtime = "nodejs";

/** GET: a planilha original do envio com a coluna "Enviado DataCrazy" preenchida. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await ensureMccSession();
  if (error) return error;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const job = getEnvioJob(id);
  const resultado = job ? planilhaComResultado(job) : null;
  if (!resultado) {
    return NextResponse.json({ error: "A planilha deste envio não está mais disponível (expira algumas horas após o envio)." }, { status: 404 });
  }

  const sheet = XLSX.utils.json_to_sheet(resultado.rows, { header: resultado.headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="envio_${id}_enviado_datacrazy.xlsx"`,
    },
  });
}
