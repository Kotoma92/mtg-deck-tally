#!/usr/bin/env python3
"""Build public/cards.db, the SQLite card index the web app queries in the browser.

Two input modes:

  python scripts/build_db.py
      Download Scryfall's oracle-cards bulk export (~180MB, cached in data/)
      and build from it. This is the canonical path -- use it to refresh
      card data when a new set releases.

  python scripts/build_db.py --from-sqlite <path/to/cards.db>
      Build from an existing SQLite index that has the mtg-deck-tune schema
      (name, mana_cost, cmc, type_line, oracle_text, color_identity).
      Avoids the bulk download when you already have that database locally.

The output is tuned for sql.js-httpvfs: a small page size so each range
request pulls only the pages a query touches, and VACUUM so pages are packed.
"""
import argparse
import gzip
import json
import os
import sqlite3
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
DATA = os.path.join(ROOT, "data")
BULK = os.path.join(DATA, "oracle-cards.jsonl.gz")
OUT = os.path.join(ROOT, "public", "cards.db")

USER_AGENT = "MTGDeckTally/1.0"
WUBRG = "WUBRG"

# Layouts that are not real, playable cards.
SKIP_LAYOUTS = {"token", "double_faced_token", "art_series", "emblem", "scheme", "planar", "vanguard"}


def canonical_identity(letters) -> str:
    """Scryfall returns color identity unordered; store it in WUBRG order."""
    present = set(letters or ())
    return "".join(c for c in WUBRG if c in present)


def commander_eligible(type_line: str, oracle_text: str) -> int:
    """A card can head a Commander deck if it is a legendary creature, if its
    rules text grants it explicitly (the Commander 2014 planeswalkers), or if it
    is a legendary card that counts as a creature outside the battlefield --
    Grist, the Hunger Tide is the notable case, and it never says so in as many
    words, so match the template rather than the card name."""
    tl = (type_line or "").lower()
    text = (oracle_text or "").lower()
    if "legendary" in tl and "creature" in tl:
        return 1
    if "can be your commander" in text:
        return 1
    if "legendary" in tl and "isn't on the battlefield" in text and "creature" in text:
        return 1
    return 0


def face_value(card: dict, key: str) -> str:
    """Prefer the top-level value, else join the card's faces."""
    if card.get(key):
        return card[key]
    faces = card.get("card_faces")
    if faces:
        joiner = "\n//\n" if key == "oracle_text" else " // "
        return joiner.join(f.get(key, "") for f in faces)
    return ""


def download_bulk() -> None:
    os.makedirs(DATA, exist_ok=True)
    print("[1/2] resolving Scryfall oracle-cards bulk URI...")
    req = urllib.request.Request(
        "https://api.scryfall.com/bulk-data",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        catalog = json.load(resp)
    uri = next(
        (b.get("jsonl_download_uri") or b.get("download_uri"))
        for b in catalog["data"]
        if b["type"] == "oracle_cards"
    )
    print(f"      {uri}")
    print("      downloading (~25MB)...")
    dl = urllib.request.Request(uri, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(dl) as resp, open(BULK, "wb") as fh:
        while chunk := resp.read(1 << 20):
            fh.write(chunk)
    print(f"      saved {os.path.getsize(BULK) / 1e6:.1f}MB -> {BULK}")


def rows_from_bulk(refresh: bool = False):
    if refresh and os.path.exists(BULK):
        print(f"Removing cached {BULK} to fetch fresh data...")
        os.remove(BULK)
    if not os.path.exists(BULK):
        download_bulk()

    fh = gzip.open(BULK, "rt", encoding="utf-8") if BULK.endswith(".gz") else open(BULK, encoding="utf-8")
    try:
        for line in fh:
            card = json.loads(line)
            if card.get("layout") in SKIP_LAYOUTS:
                continue
            type_line = face_value(card, "type_line")
            oracle_text = face_value(card, "oracle_text")
            yield (
                card["name"],
                canonical_identity(card.get("color_identity")),
                type_line,
                face_value(card, "mana_cost"),
                card.get("cmc", 0) or 0,
                commander_eligible(type_line, oracle_text),
            )
    finally:
        fh.close()


def rows_from_sqlite(path: str):
    if not os.path.exists(path):
        sys.exit(f"no such database: {path}")
    con = sqlite3.connect(path)
    query = "select name, color_identity, type_line, mana_cost, cmc, oracle_text from cards"
    for name, identity, type_line, mana_cost, cmc, oracle_text in con.execute(query):
        yield (
            name,
            canonical_identity(identity),
            type_line or "",
            mana_cost or "",
            cmc or 0,
            commander_eligible(type_line, oracle_text),
        )
    con.close()


def build(rows) -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if os.path.exists(OUT):
        os.remove(OUT)
    con = sqlite3.connect(OUT)
    # Small pages keep each HTTP range request tight when the browser queries this.
    con.execute("PRAGMA page_size = 4096")
    con.execute("""CREATE TABLE cards(
        name TEXT PRIMARY KEY COLLATE NOCASE,
        color_identity TEXT NOT NULL,
        type_line TEXT NOT NULL,
        mana_cost TEXT,
        cmc REAL,
        can_be_commander INTEGER NOT NULL
    ) WITHOUT ROWID""")
    con.executemany("INSERT OR REPLACE INTO cards VALUES (?,?,?,?,?,?)", rows)
    con.commit()
    total = con.execute("select count(*) from cards").fetchone()[0]
    commanders = con.execute("select count(*) from cards where can_be_commander = 1").fetchone()[0]
    con.execute("VACUUM")
    con.close()
    size = os.path.getsize(OUT) / 1e6
    print(f"[2/2] {total} cards ({commanders} commander-eligible) -> {OUT} [{size:.1f}MB]")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--from-sqlite", metavar="PATH", help="build from an existing mtg-deck-tune cards.db")
    parser.add_argument("--refresh", "-r", action="store_true", help="force re-download latest bulk data from Scryfall")
    args = parser.parse_args()
    build(rows_from_sqlite(args.from_sqlite) if args.from_sqlite else rows_from_bulk(refresh=args.refresh))


if __name__ == "__main__":
    main()
