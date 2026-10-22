/**
 * Local troubleshooting switch for viewing the dashboard without an Auth.js
 * session. It is deliberately unavailable in production. While enabled, every
 * protected request is treated as the local SUPERADMIN account.
 */
export const isLocalAuthBypassEnabled = () =>
  process.env.NODE_ENV !== "production" && process.env.AUTH_BYPASS === "true";
