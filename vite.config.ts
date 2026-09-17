import fs from "node:fs";
import crypto from "node:crypto";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { parseDeckUrl, fetchDeck } from "./shared/deck-sources.mjs";

function getCardsDbVersion(): string {
  try {
    const file = fs.readFileSync("public/cards.db");
    return crypto.createHash("md5").update(file).digest("hex").slice(0, 10);
  } catch {
    return Date.now().toString(36);
  }
}

/**
 * In production /api/deck, /api/moxfield/decks, and /api/card-image are handled
 * by the Cloudflare Worker (src/worker.ts). This serves the same routes during
 * `npm run dev`, so link imports and card images work locally without running wrangler.
 */
function deckApiDevServer(): Plugin {
  return {
    name: "deck-api-dev-server",
    configureServer(server) {
      server.middlewares.use("/api/deck", async (req, res) => {
        const send = (body: unknown, status = 200, cacheControl = "public, max-age=60") => {
          res.statusCode = status;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.setHeader("cache-control", cacheControl);
          res.end(JSON.stringify(body));
        };
        const url = new URL(req.url ?? "", "http://localhost");
        const targetUrl = url.searchParams.get("url");
        const target = targetUrl ? parseDeckUrl(targetUrl) : null;
        if (!target) return send({ error: "That doesn't look like a Moxfield or Archidekt deck link." }, 400);
        const isRefresh = url.searchParams.has("refresh") || url.searchParams.has("_t");
        const cacheControl = isRefresh ? "no-cache, no-store, must-revalidate" : "public, max-age=60";
        try {
          send(await fetchDeck(target), 200, cacheControl);
        } catch (err: any) {
          send({ error: err?.message ?? "Upstream request failed." }, err?.status === 404 ? 404 : 502);
        }
      });

      server.middlewares.use("/api/moxfield/decks", async (req, res) => {
        const send = (body: unknown, status = 200) => {
          res.statusCode = status;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify(body));
        };
        const url = new URL(req.url ?? "", "http://localhost");
        const username = url.searchParams.get("username")?.trim();
        if (!username) return send({ error: "Missing username parameter." }, 400);

        const page = url.searchParams.get("page") || "1";
        const pageSize = url.searchParams.get("pageSize") || "40";
        const moxUrl = `https://api2.moxfield.com/v2/decks/search?authorUserNames=${encodeURIComponent(username)}&pageNumber=${page}&pageSize=${pageSize}&sortType=updated&sortDirection=descending`;

        try {
          const response = await fetch(moxUrl, {
            headers: {
              "User-Agent": "MTGDeckTally/1.0 (+https://github.com/Kotoma92/mtg-deck-tally)",
              "Accept": "application/json",
            },
          });
          if (!response.ok) {
            if (response.status === 404) {
              return send({ error: `Could not find Moxfield user "${username}". Check the spelling.` }, 404);
            }
            if (response.status === 403) {
              return send(
                {
                  error:
                    "Moxfield blocks Node.js requests in local dev (HTTP 403). Test on staging/production where Cloudflare Workers can reach Moxfield.",
                },
                403,
              );
            }
            return send({ error: `Moxfield responded with HTTP ${response.status}.` }, response.status);
          }
          const data = await response.json();
          send(data);
        } catch (err: any) {
          send({ error: err?.message ?? "Upstream request failed." }, 502);
        }
      });

      server.middlewares.use("/api/card-image", async (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const id = url.searchParams.get("id")?.trim();
        const name = url.searchParams.get("name")?.trim();
        const version = url.searchParams.get("version") || "normal";

        // 1. If we have a valid UUID, redirect directly to Scryfall CDN (no proxy latency)
        if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          const cdnUrl = `https://cards.scryfall.io/${version}/front/${id[0]}/${id[1]}/${id}.jpg`;
          res.statusCode = 302;
          res.setHeader("Location", cdnUrl);
          res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
          return res.end();
        }

        // 2. Name-only fallback via Scryfall API
        if (!name) {
          res.statusCode = 400;
          return res.end("Missing card id or name");
        }

        const fetchScryfallByName = async (exactName: string) => {
          const scryfallUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(exactName)}&format=image&version=${version}`;
          return fetch(scryfallUrl, {
            headers: {
              "User-Agent": "MTGDeckTally/1.0 (+https://github.com/Kotoma92/mtg-deck-tally)",
              "Accept": "image/*",
            },
          });
        };

        try {
          let upstream = await fetchScryfallByName(name);
          if (!upstream.ok && name.includes(" // ")) {
            upstream = await fetchScryfallByName(name.split(" // ")[0]);
          }

          if (!upstream.ok) {
            res.statusCode = upstream.status;
            return res.end("Image fetch failed");
          }

          res.statusCode = 200;
          res.setHeader("content-type", upstream.headers.get("content-type") || "image/jpeg");
          res.setHeader("cache-control", "public, max-age=2592000, immutable");
          const arrayBuffer = await upstream.arrayBuffer();
          res.end(Buffer.from(arrayBuffer));
        } catch (err: any) {
          res.statusCode = 502;
          res.end(err?.message || "Upstream error");
        }
      });
    },
  };
}

export default defineConfig({
  define: {
    __CARDS_DB_VERSION__: JSON.stringify(getCardsDbVersion()),
  },
  plugins: [react(), deckApiDevServer()],
  // sql.js-httpvfs is CommonJS, so it must be pre-bundled for its named exports
  // to resolve in dev. Its worker and wasm are imported separately as ?url
  // assets, so pre-bundling can't break their paths.
  optimizeDeps: { include: ["sql.js-httpvfs"] },
  build: { target: "es2022" },
});
