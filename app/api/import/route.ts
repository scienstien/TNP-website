import { getCurrentUser, isAdminRole, resolveDepartment } from "@/lib/auth/dal";
import { processImport } from "@/lib/import/process";
import { isImportKind, MAX_FILE_BYTES } from "@/lib/import/templates";
import { createHash } from "node:crypto";
import { mayImport, previewToken, validPreviewToken } from "@/lib/import/security";
import { CsvError } from "@/lib/import/csv";
import { readImportFile } from "@/lib/import/workbook";
import { revalidatePath } from "next/cache";

const secret = () => process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsedOrigin = new URL(origin);
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
    const protocol = forwardedProto || new URL(request.url).protocol.slice(0, -1);
    return parsedOrigin.host.toLowerCase() === host.toLowerCase() && parsedOrigin.protocol === `${protocol}:`;
  } catch { return false; }
}

/** Limit multipart bytes before formData buffers an attacker-controlled request. */
async function boundedForm(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new CsvError("Expected a CSV or Excel upload.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_FILE_BYTES + 65_536) { await reader.cancel(); throw new CsvError("Upload a file of at most 2 MB."); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return response({ error: "Sign in required." }, 401);
  if (!isAdminRole(user.role)) return response({ error: "Administrator access required." }, 403);
  if (!isSameOriginRequest(request)) return response({ error: "Import requests must come from this website." }, 403);
  const department = await resolveDepartment(user);
  if (!mayImport(user.role, department?.departmentId ?? null) || !department) return response({ error: "Choose one department before importing." }, 400);
  const key = secret();
  if (!key) return response({ error: "AUTH_SECRET is required for import previews." }, 500);
  let form: FormData;
  try { form = await boundedForm(request); }
  catch (error) { return response({ error: error instanceof CsvError ? error.message : "Expected a CSV or Excel upload." }, 400); }
  const allowedFields = new Set(["kind", "mode", "file", "previewToken", "planHash"]);
  if ([...form.keys()].some(name => !allowedFields.has(name) || form.getAll(name).length !== 1)) return response({ error: "Unexpected or repeated upload fields." }, 400);
  const kind = form.get("kind"), mode = form.get("mode"), file = form.get("file");
  if (typeof kind !== "string" || !isImportKind(kind)) return response({ error: "Choose a supported template." }, 400);
  if (mode !== "preview" && mode !== "confirm") return response({ error: "Choose preview or confirm." }, 400);
  if (!(file instanceof File)) return response({ error: "Choose a CSV or Excel file." }, 400);
  let csv: string, bytes: Buffer;
  try { ({ csv, bytes } = await readImportFile(kind, file)); }
  catch (error) { return response({ error: error instanceof CsvError ? error.message : "Invalid file. Download a fresh template and retry." }, 422); }
  const digest = createHash("sha256").update(bytes).digest("hex");
  const expectedPlan = form.get("planHash");
  if (mode === "confirm") {
    const token = form.get("previewToken");
    if (typeof expectedPlan !== "string" || !/^[a-f0-9]{64}$/.test(expectedPlan) || typeof token !== "string" ||
        !validPreviewToken(key, token, Date.now(), user.id, department.departmentId, kind, digest, expectedPlan))
      return response({ error: "Preview expired, was changed, or belongs to another file/department. Preview it again." }, 409);
  }
  const report = await processImport(kind, csv, user, department, mode === "confirm", {
    expectedPlan: typeof expectedPlan === "string" ? expectedPlan : undefined, fileSha256: digest,
  });
  if (mode === "preview" && !report.errors.length && report.planHash) {
    report.previewToken = previewToken(key, Date.now(), user.id, department.departmentId, kind, digest, report.planHash);
  }
  if (report.committed) revalidatePath("/", "layout");
  return response(report, report.errors.length ? 422 : 200);
}
