import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { ensureMccSession } from "@/lib/mcc/authz";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Junta as planilhas já adequadas (campo "files") em um único .zip. */
export async function POST(req: Request) {
  const { error } = await ensureMccSession();
  if (error) return error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

  const zip = new AdmZip();
  const used = new Set<string>();
  for (const f of files) {
    let name = f.name;
    let n = 2;
    while (used.has(name)) name = f.name.replace(/(\.[^.]+)?$/, ` (${n++})$1`);
    used.add(name);
    zip.addFile(name, Buffer.from(await f.arrayBuffer()));
  }
  const out = zip.toBuffer();

  return new Response(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="planilhas_adequadas.zip"',
    },
  });
}
