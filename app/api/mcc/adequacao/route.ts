import { NextResponse } from "next/server";
import { adequarPlanilha } from "@/lib/mcc/adequacao";
import { ensureMccSession } from "@/lib/mcc/authz";
import { reservarCpfsUnicos } from "@/lib/mcc/cpfGerador";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Recebe UMA planilha bruta (campo "file") e devolve o .xlsx adequado.
 * As estatísticas vão no header "X-Adequacao-Stats" (JSON codificado em base64).
 */
export async function POST(req: Request) {
  const { error } = await ensureMccSession();
  if (error) return error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { output, stats } = await adequarPlanilha(buffer, reservarCpfsUnicos);
    const base = file.name.replace(/\.[^.]+$/, "");
    const filename = `${base}_adequada.xlsx`;

    return new Response(new Uint8Array(output), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "X-Adequacao-Filename": encodeURIComponent(filename),
        "X-Adequacao-Stats": Buffer.from(JSON.stringify(stats), "utf8").toString("base64"),
      },
    });
  } catch (err) {
    console.error("[adequacao] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro ao adequar planilha";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
