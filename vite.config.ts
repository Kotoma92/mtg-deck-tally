import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { parseDeckUrl, fetchDeck } from "./shared/deck-sources.mjs";

/**
 * In production /api/deck is a Cloudflare Pages Function. This serves the same
 * route from the same module during `npm run dev`, so link imports work locally
 * without running wrangler.
 */
function deckApiDevServer(): Plugin {
  return {
    name: "deck-api-dev-server",
    configureServer(server) {
      server.middlewares.use("/api/deck", async (req, res) => {
        const send = (body: unknown, status = 200) => {
          res.statusCode = status;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify(body));
        };
        const url = new URL(req.url ?? "", "http://localhost").searchParams.get("url");
        const target = url ? parseDeckUrl(url) : null;
        if (!target) return send({ error: "That doesn't look like a Moxfield or Archidekt deck link." }, 400);
        try {
          send(await fetchDeck(target));
        } catch (err: any) {
          send({ error: err?.message ?? "Upstream request failed." }, err?.status === 404 ? 404 : 502);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), deckApiDevServer()],
  // sql.js-httpvfs is CommonJS, so it must be pre-bundled for its named exports
  // to resolve in dev. Its worker and wasm are imported separately as ?url
  // assets, so pre-bundling can't break their paths.
  optimizeDeps: { include: ["sql.js-httpvfs"] },
  build: { target: "es2022" },
});
