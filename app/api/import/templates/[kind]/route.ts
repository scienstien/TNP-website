import { getCurrentUser, isAdminRole } from "@/lib/auth/dal";
import { isImportKind, templateCsv, TEMPLATE_VERSION } from "@/lib/import/templates";
import { templateWorkbook } from "@/lib/import/workbook";

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  if (!isAdminRole(user.role)) return new Response("Administrator access required.", { status: 403 });
  const { kind } = await params;
  if (!isImportKind(kind)) return new Response("Unknown template.", { status: 404 });
  const format = new URL(request.url).searchParams.get("format") ?? "csv";
  if (format !== "csv" && format !== "xlsx") return new Response("Choose csv or xlsx.", { status: 400 });
  const body = format === "xlsx" ? new Uint8Array(await templateWorkbook(kind)) : templateCsv(kind);
  return new Response(body, { headers: {
    "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="tnp-${kind}-v${TEMPLATE_VERSION}-template.${format}"`,
    "Cache-Control": "private, no-store",
  } });
}
