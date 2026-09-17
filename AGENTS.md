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

## Branching & Deployment Strategy

**Never commit directly to `main`. Never deploy directly to production.**
Production (`https://tally.rolandtech.org`) must strictly match `main`, and changes must undergo Quality Control (QC) on Staging (Beta: `https://beta.tally.rolandtech.org`) before reaching production.

### 1. Always branch from `main`
Before starting work on any feature, fix, or refactor:
```bash
git checkout main
git pull origin main
git checkout -b <type>/<short-description>
# Examples: feat/filter-layout, fix/banner-flicker, chore/upgrade-deps
```

### 2. QC on Staging (Beta First)
- Test locally first: `npm run build` and `npm run dev`.
- Push the branch to GitHub and open a Pull Request targeting `main`:
  ```bash
  git push -u origin <branch-name>
  "/c/Program Files/GitHub CLI/gh.exe" pr create --fill
  ```
- **Automated Staging Deploy**: Opening or updating a PR triggers GitHub Actions (`.github/workflows/deploy.yml`) to automatically build and deploy the branch to **Staging (Beta)** at:
  **`https://beta.tally.rolandtech.org`**
- The action posts/updates a sticky comment on the PR with the preview link and commit SHA.
- **Do not merge yet**: Test and QC the live changes on `beta.tally.rolandtech.org`. If fixes are needed, push additional commits to the branch (each push automatically refreshes staging). Request user review/feedback.

### 3. Production Deployment (On PR Merge)
- Once Quality Control (QC) is satisfied and the PR is approved by the user:
  - Merge the PR into `main` (via GitHub UI or `gh pr merge --squash` / `gh pr merge --merge`).
  - The push to `main` triggers GitHub Actions to automatically deploy to **Production** at:
    **`https://tally.rolandtech.org`**
  - The workflow also redeploys staging so beta stays synced with latest production when no PRs are active.

## Layout

| Path | What it is |
| --- | --- |
| `src/lib/cards.ts` | Opens `public/cards.db` through sql.js-httpvfs; batch card lookups |
| `src/lib/buildDeck.ts` | Parsed list + card index -> a `Deck`, including commander detection |
| `src/lib/decklist.ts` | Parser for pasted text exports |
| `shared/deck-sources.mjs` | Fetches and normalises Moxfield/Archidekt decks |
| `vite.config.ts` | Dev middleware serving /api/deck, /api/moxfield/decks, and /api/card-image |
| `src/worker.ts` | Cloudflare Worker handling /api/deck, /api/moxfield/decks, /api/card-image, and /cards.db |
| `src/components/ShoppingListModal.tsx` | Missing cards modal with clipboard copy & txt export |
| `public/sw.js` | Service Worker caching app shell and persistent card images |
| `scripts/build_db.py` | Builds `public/cards.db` from Scryfall bulk data |

## Traps

These cost real time to rediscover. Please read before changing the related code.

**Fetch card images directly from Scryfall CDN via `scryfall_id` through `/api/card-image`.**
`api.scryfall.com/cards/named` has a strict rate limit of 10 req/s, which causes HTTP 429
throttling when 100 cards are requested simultaneously. In contrast, Scryfall's image CDN
at `https://cards.scryfall.io/{version}/front/{id[0]}/{id[1]}/{id}.jpg` is a global Cloudflare
CDN with zero 10 req/s rate limits. `public/cards.db` indexes `scryfall_id` so the client can
pass `id` directly to `/api/card-image?id=<scryfall_id>&version=<version>`. The worker fetches
from `cards.scryfall.io` directly (with name-based search fallback), caches at Cloudflare's
edge for 30 days, and allows `public/sw.js` to store them persistently in CacheStorage. Double-faced
cards (MDFCs) fall back to front face on 404.

**Visual stacked views must use column-based stacks, not row-based CSS grid margins.**
Attempting to flatten stacked cards into a single CSS Grid with negative `margin-top`
couples every item in the row to the row's tallest track. If JS and CSS column counts
diverge by even 1 column (common on mobile with body padding), cards misalign and
create massive vertical gaps. Always use `.visual-stack` flex columns with round-robin
card distribution (`columns[i % columnCount]`).

**Moxfield blocks server-side clients by TLS fingerprint, not by headers.**
Requests from Node get a Cloudflare 403 HTML challenge no matter what
User-Agent is sent -- this was tested with five header combinations, including
one byte-identical to a Python request that succeeded. Do not "fix" it by
trying more headers. The legitimate route is a whitelisted User-Agent via
[moxfield/moxfield-public](https://github.com/moxfield/moxfield-public), set in
`shared/deck-sources.mjs`. Archidekt's API works fine and reports its own
commander. Paste import always works and is the documented fallback.
Verified: Cloudflare Workers reach Moxfield without issue in production,
while Node gets 403 in local dev.

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
  Production: `https://tally.rolandtech.org` (Worker `mtg-deck-tally`) and
  Staging: `https://beta.tally.rolandtech.org` (Worker `mtg-deck-tally-staging`).
  Configured via `wrangler.json` and `src/worker.ts` with `run_worker_first: true`.
  Automated deployments via GitHub Actions (`.github/workflows/deploy.yml`):
  PRs deploy to staging, merges to `main` deploy to production.
- **Moxfield links work in production!** While Node gets 403 HTML challenges
  from Cloudflare bot protection, Cloudflare Workers' network path reaches
  Moxfield's API without issue.
- The Worker handles `/api/deck` directly and intercepts `/cards.db` to
  guarantee proper `206 Partial Content` and `Accept-Ranges` byte-range handling.
- Card data refresh: `npm run refresh:db` or `python scripts/build_db.py --refresh` (downloads ~180MB of fresh Scryfall
  bulk data). To re-index an existing download without re-downloading, run `npm run build:db`. To build from an existing index: `--from-sqlite <path>`.

## This machine

Node and the GitHub CLI are installed but not on PATH. Prefix as needed:

```bash
export PATH="/c/Program Files/nodejs:$PATH"
"/c/Program Files/GitHub CLI/gh.exe" --version
```
