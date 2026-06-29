import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
var buildVersion = new Date().toISOString();
var versionPayload = JSON.stringify({
    version: buildVersion,
}, null, 2);
export default defineConfig({
    base: "/fotbollsVM2026/",
    plugins: [
        react(),
        {
            name: "app-version",
            configureServer: function (server) {
                server.middlewares.use("/fotbollsVM2026/version.json", function (_request, response) {
                    response.setHeader("Content-Type", "application/json");
                    response.setHeader("Cache-Control", "no-store");
                    response.end(versionPayload);
                });
            },
            generateBundle: function () {
                this.emitFile({
                    type: "asset",
                    fileName: "version.json",
                    source: "".concat(versionPayload, "\n"),
                });
            },
        },
    ],
});
