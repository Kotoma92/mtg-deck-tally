import { parseDeckUrl, fetchDeck } from "../shared/deck-sources.mjs";

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API Route for deck importing (Moxfield / Archidekt)
    if (url.pathname === "/api/deck") {
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) return json({ error: "Add a ?url= parameter with a deck link." }, 400);

      const target = parseDeckUrl(targetUrl);
      if (!target) {
        return json({ error: "That doesn't look like a Moxfield or Archidekt deck link." }, 400);
      }

      try {
        return json(await fetchDeck(target));
      } catch (err: any) {
        return json({ error: err.message }, err.status ?? 502);
      }
    }

    // API Route for listing a Moxfield user's public decks
    if (url.pathname === "/api/moxfield/decks") {
      const username = url.searchParams.get("username")?.trim();
      if (!username) return json({ error: "Missing username parameter." }, 400);

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
            return json({ error: `Could not find Moxfield user "${username}". Check the spelling.` }, 404);
          }
          return json({ error: `Moxfield responded with HTTP ${response.status}.` }, response.status);
        }
        const data = await response.json();
        return json(data);
      } catch (err: any) {
        return json({ error: err.message }, 502);
      }
    }

    // API Route for proxying and edge-caching Scryfall card images
    if (url.pathname === "/api/card-image") {
      const id = url.searchParams.get("id")?.trim();
      const name = url.searchParams.get("name")?.trim();
      const version = url.searchParams.get("version") || "normal";
      if (!id && !name) return new Response("Missing card id or name", { status: 400 });

      // 1. Direct redirect to Scryfall CDN if Scryfall ID is available (no proxying, full CDN speed).
      // Skip worker-side caching — Scryfall's own CDN handles caching for redirected requests.
      if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        const cdnUrl = `https://cards.scryfall.io/${version}/front/${id[0]}/${id[1]}/${id}.jpg`;
        return new Response(null, {
          status: 302,
          headers: {
            "Location": cdnUrl,
            "Cache-Control": "public, max-age=2592000, immutable",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // For name-based fallback, check Cloudflare Edge Cache first (avoids repeat API calls)
      // @ts-ignore
      const cache = typeof caches !== "undefined" && caches.default ? caches.default : null;
      const cacheKey = new Request(url.toString(), { method: "GET" });
      if (cache) {
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
      }

      // 2. Fallback search by exact name if id is missing or 404
      const fetchScryfallByName = async (exactName: string) => {
        const scryfallUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(exactName)}&format=image&version=${version}`;
        return fetch(scryfallUrl, {
          headers: {
            "User-Agent": "MTGDeckTally/1.0 (+https://github.com/Kotoma92/mtg-deck-tally)",
            "Accept": "image/*",
          },
          cf: {
            cacheTtl: 2592000,
            cacheEverything: true,
          },
        } as any);
      };

      // Name-only fallback: look up via Scryfall API (rate-limited to 10 req/s, last resort)
      if (!name) return new Response("Missing card id or name", { status: 400 });

      try {
        let scryfallRes = await fetchScryfallByName(name);
        if (!scryfallRes.ok && name.includes(" // ")) {
          scryfallRes = await fetchScryfallByName(name.split(" // ")[0]);
        }

        if (!scryfallRes.ok) {
          return new Response("Card image not found", { status: scryfallRes.status });
        }

        const headers = new Headers(scryfallRes.headers);
        headers.set("Cache-Control", "public, max-age=2592000, immutable");
        headers.set("Access-Control-Allow-Origin", "*");

        const response = new Response(scryfallRes.body, {
          status: 200,
          headers,
        });

        if (cache) {
          await cache.put(cacheKey, response.clone());
        }
        return response;
      } catch (err: any) {
        return new Response(err.message, { status: 502 });
      }
    }

    // For cards.db, ensure byte-range and content headers are preserved
    if (url.pathname === "/cards.db") {
      const assetResponse = await env.ASSETS.fetch(new Request(request.url, { method: "GET" }));
      const buffer = await assetResponse.arrayBuffer();
      const totalLength = buffer.byteLength;

      const cacheControl = url.searchParams.has("v")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300";

      if (request.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": String(totalLength),
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
            "Cache-Control": cacheControl,
          },
        });
      }

      const rangeHeader = request.headers.get("Range");
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : totalLength - 1;
          const chunk = buffer.slice(start, end + 1);
          return new Response(chunk, {
            status: 206,
            headers: {
              "Content-Range": `bytes ${start}-${end}/${totalLength}`,
              "Content-Length": String(chunk.byteLength),
              "Content-Type": "application/octet-stream",
              "Accept-Ranges": "bytes",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
              "Cache-Control": cacheControl,
            },
          });
        }
      }

      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": String(totalLength),
          "Accept-Ranges": "bytes",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
          "Cache-Control": cacheControl,
        },
      });
    }

    // Static asset handling (includes SPA routing)
    return env.ASSETS.fetch(request);
  },
};
