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

    // For cards.db, ensure byte-range and content headers are preserved
    if (url.pathname === "/cards.db") {
      if (request.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": "1945600",
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      const rangeHeader = request.headers.get("Range");
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
        if (match) {
          const assetResponse = await env.ASSETS.fetch(request);
          if (assetResponse.status === 206) {
            return assetResponse;
          }
          const buffer = await assetResponse.arrayBuffer();
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : buffer.byteLength - 1;
          const chunk = buffer.slice(start, end + 1);
          return new Response(chunk, {
            status: 206,
            headers: {
              "Content-Range": `bytes ${start}-${end}/${buffer.byteLength}`,
              "Content-Length": String(chunk.byteLength),
              "Content-Type": "application/octet-stream",
              "Accept-Ranges": "bytes",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }
      }

      const assetResponse = await env.ASSETS.fetch(request);
      const headers = new Headers(assetResponse.headers);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Type", "application/octet-stream");
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers,
      });
    }

    // Static asset handling (includes SPA routing)
    return env.ASSETS.fetch(request);
  },
};
