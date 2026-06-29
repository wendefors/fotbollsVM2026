import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const buildVersion = new Date().toISOString();
const versionPayload = JSON.stringify(
  {
    version: buildVersion,
  },
  null,
  2,
);

export default defineConfig({
  base: "/fotbollsVM2026/",
  plugins: [
    react(),
    {
      name: "app-version",
      configureServer(server) {
        server.middlewares.use("/fotbollsVM2026/version.json", (_request, response) => {
          response.setHeader("Content-Type", "application/json");
          response.setHeader("Cache-Control", "no-store");
          response.end(versionPayload);
        });
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: `${versionPayload}\n`,
        });
      },
    },
  ],
});
