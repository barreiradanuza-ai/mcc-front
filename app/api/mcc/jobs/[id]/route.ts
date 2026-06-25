import { NextResponse } from "next/server";
import { getJob } from "@/lib/mcc/jobStore";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });
  }

  // Return status without the large base64 result
  return NextResponse.json({
    id: job.id,
    status: job.status,
    progressMsg: job.progressMsg,
    progressChecked: job.progressChecked,
    progressTotal: job.progressTotal,
    // Include stats when done (but not the file bytes)
    ...(job.status === "done" && job.resultStats
      ? {
          resultFilename: job.resultFilename,
          resultStats: job.resultStats,
        }
      : {}),
    ...(job.status === "error" ? { errorMessage: job.errorMessage } : {}),
  });
}
