/**
 * Local troubleshooting switch for viewing the dashboard without an Auth.js
 * session. It is deliberately unavailable in production and presents as a
 * PROFESSOR, so write paths remain protected by requireRole("ADMIN").
 */
export const isLocalAuthBypassEnabled = () =>
  process.env.NODE_ENV !== "production" && process.env.AUTH_BYPASS === "true";
