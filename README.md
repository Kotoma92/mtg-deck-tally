# Deck Tally

Check a physical Magic deck against its list, card by card. Click each card as
you find it in the pile; the page tracks what's left, keeps your progress across
reloads, and re-themes itself to your commander's colors.

Built with React + Vite. Card data comes from a SQLite index of Scryfall's
oracle data that the browser queries directly.

## Running it

```bash
npm install
npm run dev
```

`npm run dev` also serves `/api/deck`, the same deck-import endpoint that runs as
a Cloudflare Pages Function in production, so link imports work locally.

## The card database

`public/cards.db` is a SQLite index of every Magic card (~34,500 rows, 1.9MB):
name, color identity, type line, mana cost, CMC, and whether the card can be a
commander. It is committed, so the app works with no setup.

The browser never downloads the whole file. `sql.js-httpvfs` issues HTTP range
requests for only the pages a query touches, so identifying a 100-card deck
moves a few dozen KB.

Rebuild it when a new set releases:

```bash
# Download Scryfall's oracle bulk export (~180MB, cached in data/) and rebuild
python scripts/build_db.py

# Or build from an existing mtg-deck-tune index, skipping the download
python scripts/build_db.py --from-sqlite ../claude-mtg-deck-tune/data/cards.db
```

Card images are not stored: they're loaded on demand from Scryfall's
`cards/named` image endpoint, which needs no API key and stays current.

## Importing decks

| Source | Link import | Notes |
| --- | --- | --- |
| Archidekt | Works | Public API, returns the commander directly. |
| Moxfield | Blocked | See below. |
| Paste | Always works | Moxfield: ⋯ menu → Export → Text. |

Neither site sends CORS headers, so the browser cannot call them directly. That
is what `functions/api/deck.js` is for -- it fetches the deck server-side and
normalises Moxfield's and Archidekt's very different JSON into one shape.

**Moxfield is behind Cloudflare bot protection** that rejects server-side clients
by TLS fingerprint, not by headers -- no User-Agent gets through. Moxfield link
imports return a message pointing at paste import instead. If you want them to
work, request a whitelisted User-Agent via
[moxfield/moxfield-public](https://github.com/moxfield/moxfield-public) and set
it in `shared/deck-sources.mjs`.

## Deploying

Cloudflare Pages, which serves the static build and the `functions/` directory
together:

- Build command: `npm run build`
- Output directory: `dist`

Range requests -- which the card database depends on -- are supported by
Cloudflare Pages out of the box.
