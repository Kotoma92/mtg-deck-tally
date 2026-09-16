import { createDbWorker, type WorkerHttpvfs } from "sql.js-httpvfs";
import workerUrl from "sql.js-httpvfs/dist/sqlite.worker.js?url";
import wasmUrl from "sql.js-httpvfs/dist/sql-wasm.wasm?url";
import type { CardInfo } from "./types";

/**
 * public/cards.db is a full Scryfall index (~34k cards). It is never downloaded
 * whole: sql.js-httpvfs issues HTTP range requests for just the pages a query
 * touches, so looking up a 100-card deck moves a few dozen KB.
 */
let workerPromise: Promise<WorkerHttpvfs> | null = null;

function db() {
  workerPromise ??= createDbWorker(
    [
      {
        from: "inline",
        config: {
          serverMode: "full",
          url: `${import.meta.env.BASE_URL}cards.db?v=${__CARDS_DB_VERSION__}`,
          // Must match the page_size the database was built with.
          requestChunkSize: 4096,
        },
      },
    ],
    workerUrl,
    wasmUrl,
  );
  return workerPromise;
}

type Row = {
  name: string;
  color_identity: string;
  type_line: string;
  mana_cost: string | null;
  cmc: number | null;
  can_be_commander: number;
};

const toCardInfo = (row: Row): CardInfo => ({
  name: row.name,
  colorIdentity: row.color_identity,
  typeLine: row.type_line,
  manaCost: row.mana_cost ?? "",
  cmc: row.cmc ?? 0,
  canBeCommander: row.can_be_commander === 1,
});

const SELECT = "select name, color_identity, type_line, mana_cost, cmc, can_be_commander from cards";

/**
 * Look up many cards at once, keyed by lowercased name. The name column is
 * COLLATE NOCASE, so decklist casing doesn't matter.
 */
export async function lookupCards(names: string[]): Promise<Map<string, CardInfo>> {
  const worker = await db();
  const found = new Map<string, CardInfo>();
  const wanted = [...new Set(names.map((name) => name.toLowerCase()))];

  for (let i = 0; i < wanted.length; i += 200) {
    const chunk = wanted.slice(i, i + 200);
    const rows = (await worker.db.query(
      `${SELECT} where name in (${chunk.map(() => "?").join(",")})`,
      chunk,
    )) as Row[];
    for (const row of rows) found.set(row.name.toLowerCase(), toCardInfo(row));
  }

  // Double-faced cards are indexed under "Front // Back", but decklists often
  // carry only the front face. Retry the stragglers against the front name.
  for (const name of wanted) {
    if (found.has(name)) continue;
    const rows = (await worker.db.query(`${SELECT} where name like ? limit 1`, [`${name} //%`])) as Row[];
    if (rows.length) found.set(name, toCardInfo(rows[0]));
  }

  return found;
}

type ImageVersion = "small" | "normal" | "art_crop";

/** Scryfall serves card images by name, so no image ids need to live in our index. */
export function cardImageUrl(name: string, version: ImageVersion = "normal"): string {
  const query = new URLSearchParams({ exact: name, format: "image", version });
  return `https://api.scryfall.com/cards/named?${query}`;
}

/** Just the illustration, without the frame or text box -- what a banner wants. */
export const cardArtUrl = (name: string) => cardImageUrl(name, "art_crop");
