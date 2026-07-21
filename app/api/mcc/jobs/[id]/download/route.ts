import { NextResponse } from "next/server";
import { getJob } from "@/lib/mcc/jobStore";
import { ensureMccSession } from "@/lib/mcc/authz";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await ensureMccSession();
  if (error) return error;

  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });
  }

  if (job.status !== "done") {
    return NextResponse.json({ error: "Job ainda não concluído" }, { status: 400 });
  }

  if (!job.resultBase64 || !job.resultFilename) {
    return NextResponse.json({ error: "Resultado não disponível" }, { status: 500 });
  }

  const buffer = Buffer.from(job.resultBase64, "base64");

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${job.resultFilename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
