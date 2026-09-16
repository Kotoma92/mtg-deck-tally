# Working on Deck Tally

A tool for checking a physical Magic deck against its decklist: import a deck,
then click each card off as you find it in the pile.

React + Vite, deployed as a static site plus one Cloudflare Pages Function.
Card data comes from a SQLite index of Scryfall's oracle data that the browser
queries directly over HTTP range requests.

```bash
npm install
npm run dev      # also serves /api/deck, so link imports work locally
npm run build    # tsc --noEmit && vite build
```

## Layout

| Path | What it is |
| --- | --- |
| `src/lib/cards.ts` | Opens `public/cards.db` through sql.js-httpvfs; batch card lookups |
| `src/lib/buildDeck.ts` | Parsed list + card index -> a `Deck`, including commander detection |
| `src/lib/decklist.ts` | Parser for pasted text exports |
| `shared/deck-sources.mjs` | Fetches and normalises Moxfield/Archidekt decks |
| `functions/api/deck.js` | Cloudflare Pages Function wrapping the above |
| `vite.config.ts` | Dev middleware serving the same `/api/deck` route from the same module |
| `scripts/build_db.py` | Builds `public/cards.db` from Scryfall bulk data |

## Traps

These cost real time to rediscover. Please read before changing the related code.

**Moxfield blocks server-side clients by TLS fingerprint, not by headers.**
Requests from Node get a Cloudflare 403 HTML challenge no matter what
User-Agent is sent -- this was tested with five header combinations, including
one byte-identical to a Python request that succeeded. Do not "fix" it by
trying more headers. The legitimate route is a whitelisted User-Agent via
[moxfield/moxfield-public](https://github.com/moxfield/moxfield-public), set in
`shared/deck-sources.mjs`. Archidekt's API works fine and reports its own
commander. Paste import always works and is the documented fallback.
Untested: whether Cloudflare Workers reach Moxfield, since Workers use a
different network path than Node. Worth checking once deployed.

**`requestChunkSize` must equal the database's `page_size`.** It is 4096 in
`src/lib/cards.ts` and 4096 in `scripts/build_db.py`, coupled across two
languages with nothing enforcing it. If they diverge, queries get slow or
break in ways that do not point at this.

**sql.js-httpvfs is CommonJS and must stay in `optimizeDeps.include`.**
Excluding it (the usual advice, which applies to the `new URL` worker pattern)
breaks dev with "does not provide an export named 'createDbWorker'". The
worker and wasm are loaded as separate `?url` imports, so pre-bundling is safe.

**`body { overflow-x: clip }` is load-bearing.** The banner is full-bleed via
`inset: 0 calc(-50vw + 50%)`, which overflows the column. `clip` contains it;
`hidden` or `auto` would silently kill the sticky header.

## Decisions made on purpose

- **Commander colour theming was built, then deleted.** Deriving an accent
  palette and gradient wash from the commander's colour identity was tried and
  did not look good. The banner shows the commander's actual artwork instead.
  Colour identity survives only as data, for the off-identity card flag and the
  guild-name tag. Please don't reintroduce colour-driven styling.
- **Banner art is blurred on purpose.** Scryfall's `art_crop` is ~626px wide;
  spanning a viewport-width band upscales it into mush. The blurred layer is
  atmosphere and the crisp read is the thumbnail next to the deck name.
- **Card images are not stored in the database.** They come from Scryfall's
  `cards/named` image endpoint by name, so no image IDs need indexing and the
  art stays current.
- **`public/cards.db` is committed** (1.9MB, ~34.5k cards) so the app works
  with no setup. Oracle text is dropped in favour of a precomputed
  `can_be_commander` flag, which is what shrinks it from 8.7MB.
- **Commander eligibility is matched by rules template, not card name.** Grist,
  the Hunger Tide is commander-legal without saying so; `build_db.py` matches
  the "isn't on the battlefield" wording so future cards work too.

## State as of this writing

- Hosting: **Live on Cloudflare Workers with Static Assets** at
  `https://tally.rolandtech.org` (Worker service `mtg-deck-tally`). Configured via
  `wrangler.json` and `src/worker.ts` with `run_worker_first: true`. Deploy via:
  `npm run deploy` (requires `CLOUDFLARE_API_TOKEN`).
- **Moxfield links work in production!** While Node gets 403 HTML challenges
  from Cloudflare bot protection, Cloudflare Workers' network path reaches
  Moxfield's API without issue.
- The Worker handles `/api/deck` directly and intercepts `/cards.db` to
  guarantee proper `206 Partial Content` and `Accept-Ranges` byte-range handling.
- Card data refresh: `python scripts/build_db.py` (downloads ~180MB of Scryfall
  bulk data), or `--from-sqlite <path>` to build from an existing index.

## This machine

Node and the GitHub CLI are installed but not on PATH. Prefix as needed:

```bash
export PATH="/c/Program Files/nodejs:$PATH"
"/c/Program Files/GitHub CLI/gh.exe" --version
```
