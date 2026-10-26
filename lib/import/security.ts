import { createHmac, timingSafeEqual } from "node:crypto";
import { TEMPLATE_VERSION } from "./templates";

export function mayImport(role: string, departmentId: string | null) {
  return (role === "ADMIN" || role === "SUPERADMIN") && typeof departmentId === "string" && departmentId.length > 0;
}

export function previewToken(secret: string, timestamp: number, userId: string, departmentId: string, kind: string, digest: string, planHash = "") {
  const payload = JSON.stringify([TEMPLATE_VERSION, timestamp, userId, departmentId, kind, digest, planHash]);
  return `${timestamp}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

export function validPreviewToken(secret: string, token: string, now: number, userId: string, departmentId: string, kind: string, digest: string, planHash = "") {
  if (token.split(".").length !== 2) return false;
  const [stamp, signature] = token.split(".");
  const timestamp = Number(stamp);
  if (!Number.isSafeInteger(timestamp) || timestamp > now || now - timestamp > 600_000 ||
      !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = previewToken(secret, timestamp, userId, departmentId, kind, digest, planHash).split(".")[1];
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
