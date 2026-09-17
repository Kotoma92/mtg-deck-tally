# Deck Tally

Check a physical Magic deck against its list, card by card. Click each card as
you find it in the pile; the page tracks what's left, keeps your progress across
reloads, and displays your commander's artwork.

Built with React + Vite. Card data comes from a SQLite index of Scryfall's
oracle data that the browser queries directly over HTTP range requests.

## Running it

```bash
npm install
npm run dev
```

`npm run dev` also serves `/api/deck`, `/api/moxfield/decks`, and `/api/card-image` via Vite middleware (matching the Cloudflare Worker in production), so link imports and card images work locally.

## The card database

`public/cards.db` is a SQLite index of every Magic card (~34,500 rows, ~3.3MB):
name, color identity, type line, mana cost, CMC, commander eligibility, and Scryfall ID. It is committed, so the app works with zero setup.

The browser never downloads the whole file. `sql.js-httpvfs` issues HTTP range
requests for only the pages a query touches, so identifying a 100-card deck
moves only a few dozen KB.

Rebuild it when a new set releases:

```bash
# Refresh and download latest Scryfall bulk export (~180MB) and rebuild
npm run refresh:db

# Or re-index an existing download without re-downloading
npm run build:db

# Or build from an existing sqlite database index
python scripts/build_db.py --from-sqlite <path/to/cards.db>
```

Card images are loaded via `/api/card-image`, which redirects directly to
Scryfall's global image CDN using indexed Scryfall IDs with zero rate limits,
cached persistently in the browser via a Service Worker.

## Importing decks

| Source | Link import | Notes |
| --- | --- | --- |
| Moxfield | Works | Full support for deck links and username deck browsing in production. |
| Archidekt | Works | Public API, returns the commander directly. |
| Paste | Always works | Moxfield: ⋯ menu → Export → Text. |

Neither site sends CORS headers, so the browser cannot call them directly. A
Cloudflare Worker (`src/worker.ts`) fetches and normalises decks server-side into
a unified schema.

## Deploying

Hosted on **Cloudflare Workers with Static Assets**:

- Production: [https://tally.rolandtech.org](https://tally.rolandtech.org)
- Staging (Beta): [https://beta.tally.rolandtech.org](https://beta.tally.rolandtech.org)

Configured via `wrangler.json` and deployed automatically via GitHub Actions:
- Pull requests deploy automatically to **Staging**.
- Merging to `main` deploys to **Production** (and syncs staging).

To deploy manually:

```bash
npm run deploy          # Production
npm run deploy:staging  # Staging
```
