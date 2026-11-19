#!/usr/bin/env python3
"""Collect public SCU café menus and build a cumulative nutrition catalog."""

import argparse
from collections import defaultdict
from datetime import date, datetime, timezone
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

BASE = "https://scudining.cafebonappetit.com/"
CAFE_LINK = re.compile(r'href="https://scudining\.cafebonappetit\.com/cafe/([\w-]+)/" class="site-panel__cafenav-itemlink"')
DAY_LINK = re.compile(r'href="https://scudining\.cafebonappetit\.com/cafe/([\w-]+)/(\d{4}-\d{2}-\d{2})/" class="site-panel__cafenav-itemlink"')
ITEMS = re.compile(r"Bamco\.menu_items\s*=\s*")
DAYPART = re.compile(r"Bamco\.dayparts\['[^']+'\]\s*=\s*")
FIELDS = (
    "description", "ingredients", "nutrition", "nutrition_details", "nutrition_link",
    "sizes", "options", "recipes", "cor_icon", "ordered_cor_icon",
)

def normalized(label):
    return " ".join(html.unescape(label).casefold().split())

def fetch(url):
    result = subprocess.run(
        ["curl", "--fail", "--location", "--silent", "--show-error", "--max-time", "35",
         "--retry", "2", "--retry-max-time", "60", "--write-out", "\n%{url_effective}", url],
        check=True, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    content, effective_url = result.stdout.rsplit("\n", 1)
    if urlsplit(effective_url).netloc != urlsplit(BASE).netloc:
        raise ValueError(f"Unexpected destination {effective_url}")
    return content, effective_url

def publication_dates(page):
    return {
        (cafe, date.fromisoformat(day))
        for cafe, day in DAY_LINK.findall(page)
    }

def parse_menu(page, url, effective_url, cafe, day):
    if urlsplit(effective_url).path.rstrip("/") != urlsplit(url).path.rstrip("/"):
        raise ValueError(f"Dated menu redirected to {effective_url}")
    if "site-panel__cafenav-days-trigger" not in page:
        raise ValueError("Café menu navigation could not be verified")
    observed_dates = set(re.findall(r'data-end-date="(\d{4}-\d{2}-\d{2})"', page))
    item_match = ITEMS.search(page)
    if item_match and observed_dates != {day.isoformat()}:
        raise ValueError(f"Dated menu could not be verified (page dates: {sorted(observed_dates)})")
    if not item_match and (cafe, day) not in publication_dates(page):
        raise ValueError("No menu data or dated navigation on this page")

    decoder = json.JSONDecoder()
    items = decoder.raw_decode(page, item_match.end())[0] if item_match else {}
    if not isinstance(items, dict):
        raise ValueError("Unexpected menu item data")
    dayparts = [decoder.raw_decode(page, match.end())[0] for match in DAYPART.finditer(page)]
    stations = defaultdict(list)
    for part in dayparts:
        for station in part["stations"]:
            for item_id in station["items"]:
                placement = {
                    "daypart": part["label"], "station": station["label"],
                    "start": part["starttime"], "end": part["endtime"],
                }
                if placement not in stations[str(item_id)]:
                    stations[str(item_id)].append(placement)
    if set(stations).difference(items):
        raise ValueError("Some published stations reference missing menu records")
    return {
        "cafe": cafe,
        "date": day.isoformat(),
        "source": url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "status": "menu" if items else "no_menu_posted",
        "items": items,
        "placements": dict(stations),
    }

def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)

def build_catalog(output):
    catalog = {}
    for path in sorted((output / "snapshots").glob("*/*.json")):
        snapshot = json.loads(path.read_text())
        for item_id, item in snapshot["items"].items():
            label = html.unescape(item["label"]).strip()
            fields = {key: item.get(key) for key in FIELDS}
            # ID churn across days must not create duplicates. Different published servings,
            # formulas, or nutrition facts must stay separate even when labels match.
            fingerprint_fields = {**fields, "label": normalized(label)}
            sizes = fields["sizes"]
            if isinstance(sizes, list):
                fingerprint_fields["sizes"] = [
                    {key: value for key, value in size.items() if key != "price"}
                    if isinstance(size, dict) else size
                    for size in sizes
                ]
            signature = json.dumps(fingerprint_fields, ensure_ascii=False, sort_keys=True)
            key = hashlib.sha256(signature.encode()).hexdigest()
            if key not in catalog:
                catalog[key] = {
                    "key": key, "name": label, **fields,
                    "has_ingredients": bool(fields["ingredients"]),
                    "has_nutrition_details": bool(fields["nutrition_details"]),
                    "occurrences": [],
                }
            catalog[key]["occurrences"].append({
                "cafe": snapshot["cafe"], "date": snapshot["date"], "source": snapshot["source"],
                "fetched_at": snapshot["fetched_at"], "site_item_id": item_id,
                "placements": snapshot["placements"].get(item_id, []),
            })
    entries = sorted(catalog.values(), key=lambda row: (normalized(row["name"]), row["key"]))
    save_json(output / "nutrition-catalog.json", entries)
    return len(entries)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    dates = parser.add_mutually_exclusive_group()
    dates.add_argument("--date", action="append", type=date.fromisoformat, help="ISO date, repeatable")
    dates.add_argument("--published", action="store_true", help="Collect all dates linked by each café's menu")
    parser.add_argument("--cafe", action="append", help="Café slug, repeatable. Defaults to all SCU cafés.")
    parser.add_argument("--output", type=Path, default=Path("data/menu/scu-catalog"))
    parser.add_argument("--fixture-dir", type=Path, help="Use dated, saved HTML pages for offline verification")
    args = parser.parse_args()

    if args.fixture_dir and (not args.date or len(args.date) != 1 or not args.cafe):
        parser.error("--fixture-dir requires one --date and explicit --cafe values")
    try:
        cafes = list(dict.fromkeys(args.cafe or CAFE_LINK.findall(fetch(BASE)[0])))
        if not cafes or any(not re.fullmatch(r"[\w-]+", cafe) for cafe in cafes):
            raise ValueError("No valid café slugs found")
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        parser.exit(1, f"Could not discover cafés: {error}\n")

    results = []
    for cafe in cafes:
        try:
            if args.published:
                index, _ = fetch(f"{BASE}cafe/{cafe}/")
                days = sorted(day for slug, day in publication_dates(index) if slug == cafe)
                if not days:
                    raise ValueError("No dates discovered for this café")
            else:
                days = sorted(set(args.date or [datetime.now(ZoneInfo("America/Los_Angeles")).date()]))
        except (ValueError, OSError, subprocess.SubprocessError) as error:
            results.append({"cafe": cafe, "status": "error", "error": str(error)})
            continue

        for day in days:
            url = f"{BASE}cafe/{cafe}/{day.isoformat()}/"
            try:
                if args.fixture_dir:
                    page = (args.fixture_dir / f"scu-{cafe}.html").read_text()
                    effective_url = url
                else:
                    page, effective_url = fetch(url)
                snapshot = parse_menu(page, url, effective_url, cafe, day)
                save_json(args.output / "snapshots" / cafe / f"{day}.json", snapshot)
                results.append({
                    "cafe": cafe, "date": day.isoformat(), "source": url,
                    "status": snapshot["status"], "items": len(snapshot["items"]),
                })
            except (ValueError, OSError, subprocess.SubprocessError, KeyError, TypeError) as error:
                results.append({
                    "cafe": cafe, "date": day.isoformat(), "source": url,
                    "status": "error", "error": str(error),
                })

    count = build_catalog(args.output)
    failures = sum(row["status"] == "error" for row in results)
    save_json(args.output / "latest-run.json", {
        "catalog_records": count, "errors": failures, "fixture_mode": bool(args.fixture_dir),
        "results": results,
    })
    for row in results:
        print(row["cafe"], row.get("date", ""), row["status"], row.get("items", row.get("error", "")))
    print(f"{count} distinct published records in the cumulative catalog.")
    return 1 if failures else 0

if __name__ == "__main__":
    sys.exit(main())
