import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // AGENTS.md is shared project context: `next dev` must not inject generated agent blocks into it.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
