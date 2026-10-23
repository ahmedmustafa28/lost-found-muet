import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Off on purpose: almost every page depends on the signed-in user, so we
  // use normal dynamic rendering. partialPrefetching requires it, so it is
  // off too. Ask before turning either on (AGENTS.md).
  cacheComponents: false,
  // Stop `next dev` from writing its own block into our AGENTS.md.
  agentRules: false,
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
