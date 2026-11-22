#!/usr/bin/env python3
"""Optional public store metadata & product structure extractor inspired by D4Vinci/Scrapling.

Usage:
  python3 tools/store_scraper.py https://shopifyhub.work --out /tmp/store_meta.json

Requires optional `scrapling` (`pip install scrapling`) when scraping dynamic pages,
and falls back cleanly to Python stdlib (`urllib` + `html.parser`) with zero bloat.
"""

from __future__ import annotations

import argparse
import json
import sys
from html.parser import HTMLParser
from urllib.request import Request, urlopen


class _MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title: str = ""
        self._in_title = False
        self.meta: dict[str, str] = {}
        self.json_ld: list[str] = []
        self._in_ld = False
        self._ld_buf: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            key = attr_map.get("property") or attr_map.get("name")
            if key and attr_map.get("content"):
                self.meta[key] = attr_map["content"]
        elif tag == "script" and attr_map.get("type", "").lower() == "application/ld+json":
            self._in_ld = True
            self._ld_buf = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag == "script" and self._in_ld:
            self._in_ld = False
            raw = "".join(self._ld_buf).strip()
            if raw:
                self.json_ld.append(raw)

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        elif self._in_ld:
            self._ld_buf.append(data)


def scrape_store(url: str) -> dict:
    try:
        from scrapling.fetchers import Fetcher  # type: ignore

        page = Fetcher.get(url, stealthy_headers=True, timeout=15)
        title = (page.css("title::text").get() or "").strip()
        og_title = page.css('meta[property="og:title"]::attr(content)').get() or ""
        og_desc = page.css('meta[property="og:description"]::attr(content)').get() or ""
        ld_raw = page.css('script[type="application/ld+json"]::text').getall() or []
        engine = "scrapling"
        meta = {"og:title": og_title, "og:description": og_desc}
    except ImportError:
        req = Request(url, headers={"User-Agent": "ZeroZone-Toolkit/1.0 (+https://shopifyhub.work)"})
        with urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
        parser = _MetaParser()
        parser.feed(html)
        title = parser.title.strip()
        meta = parser.meta
        ld_raw = parser.json_ld
        engine = "stdlib-fallback"

    structured_products = []
    for raw in ld_raw:
        try:
            parsed = json.loads(raw)
            structured_products.append(parsed)
        except json.JSONDecodeError:
            continue

    return {
        "url": url,
        "engine": engine,
        "title": title,
        "meta": meta,
        "structuredDataCount": len(structured_products),
        "structuredData": structured_products,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract public store metadata and JSON-LD product structures.")
    ap.add_argument("url", help="Public storefront URL (e.g. https://shopifyhub.work)")
    ap.add_argument("--out", help="Optional JSON output path")
    args = ap.parse_args()

    result = scrape_store(args.url)
    payload = json.dumps(result, indent=2, ensure_ascii=False)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(payload + "\n")
        print(f"Wrote {args.out} ({result['engine']})")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
