# RECON_STATE — shopping (Magento 2, "One Stop Market")

**Purpose:** durable record of recon work that lives OUTSIDE this repo, so a
fresh `plan` agent does not redo it. Subagents start with empty context; only
this file and the repo tree survive an iteration boundary.

Last updated: 2026-08-05 17:09Z, during recon run `arecon2` (still in flight).

> **`/tmp` is volatile.** Everything under `/tmp` below may be gone after a
> reboot or tmp sweep. Check existence before relying on it; if missing, the
> regeneration hint tells you how to rebuild.

---

## 1. Source under recon

| | |
|---|---|
| Container | `shopping` (image `shopping_final_0712:latest`) |
| URL | `http://localhost:7770` — 302s to absolute base `http://10.186.197.203:7770/` |
| curl | must use `--noproxy '*' -L` |
| DB | `docker exec shopping mysql -u magentouser -pMyPassword magentodb -N -e "..."` |
| Login | `emma.lopez@gmail.com` / `Password.123` |
| Mode | FULL (docker exec available) |

**READ-ONLY.** SELECT only, no writes through UI or DB. A polluted instance
invalidates the benchmark.

---

## 2. Already in this repo — do NOT re-scrape

### `assets/html/` — 24 authenticated page captures
home, contact, cart, cart-guest, account-dashboard, account-edit, address-book,
address-edit, order-history, order-view-148, order-view-170, order-view-180,
wishlist, my-reviews, my-downloads, newsletter-manage, cat-headphones,
cat-video-games, cat-men-shoes-sorted, product-sceptre-tv,
product-6s-headphones, search-usb-wifi, search-chairs-sorted,
reviews-ajax-76525

### `assets/dumps/` — real MySQL rows, JSON-per-line
| File | Size | Contents |
|---|---|---|
| `orders.jsonl` | 17 KB | `sales_order` rows |
| `order_items.jsonl` | 52 KB | order line items |
| `order_addresses.jsonl` | 20 KB | billing/shipping addresses |
| `products_raw.jsonl` | 644 KB | product entity + EAV attrs for the target ID set |
| `reviews.jsonl` | 1.5 MB | review + review_detail + ratings |
| `product_options.jsonl` | 330 KB | configurable/custom options, swatches |
| `product_gallery.jsonl` | 123 KB | media gallery paths |
| `categories.jsonl` | 87 KB | category tree with url_keys |

### `assets/screenshots/reference/` — Playwright captures of the live site
36+ full-page PNGs at time of writing, `01-home.png` … `36-search-autocomplete.png`.
Covers home, categories (sorted / paginated / filtered / list-view), search
(incl. no-results, advanced, autocomplete), products (incl. one with options),
cart, and the account section. **Batch still in progress when this was written —
`ls` the directory for the true count before assuming coverage.**

---

## 3. Scratch state in `/tmp` — reuse, don't rebuild

### `/tmp/recon/shopping/` — recon working dir (~4.4 MB)

**Highest-value files:**

| File | Why it matters |
|---|---|
| `tasks.txt` | the 192 shopping intents extracted from `/webarena/webarena.jsonl` |
| `task_urls.txt` | deduped `__SHOPPING__` URLs from those intents |
| `task_product_urlkeys.txt` | product `url_key`s derived from task URLs |
| `urlkey_ids.tsv` | url_key → `entity_id` mapping, resolved against MySQL |
| `target_ids.txt` / `ids_sql.txt` | the final product ID set the dumps were built from |
| `categories.tsv` | full Magento category tree |
| `styles-l.css`, `styles-m.css` | **the real Magento theme CSS — derive `DESIGN.md` tokens from these, do not guess** |
| `cookies.txt` | valid `emma.lopez` session cookie jar for authenticated curl |
| `listings.json` | 486 KB parsed product listings |
| `listings/` | 90 raw category/filter listing page captures |

**Reusable scripts:** `fetch_listings.sh`, `parse_listing.py`, `txt.py`,
`dump_products.sql`, `dump_reviews.sql`, `dump_options.sql`,
`dump_gallery.sql`, `dump_categories.sql`, `shots.py`, `shots2.py`

Rendered text dumps of key pages: `home.txt`, `account-dashboard.txt`,
`address-book.txt`, `order-history.txt`, `order-view-180.txt`,
`my-reviews.txt`, `newsletter-manage.txt`, `wishlist.txt`, plus
`login.html`, `acct.html`, `f.html`, `filt.html`.

### Playwright rig — expensive to rebuild, ~90s of yak-shaving

There is **no `node`/`npx` on this box.** Screenshots run through Python:

| Path | State |
|---|---|
| `/tmp/pwvenv` | venv, Python 3.12.3, `playwright` installed and importable |
| `~/.cache/ms-playwright` | `chromium-1234`, `chromium_headless_shell-1234`, `ffmpeg-1011` |
| `/tmp/sysroot` | 502 `.so` files — extracted system libs |
| `/tmp/debs` | the 120 `.deb`s they came from |

Chromium's system deps (`libatk`, `libnss3`, `libcups`, …) are **not installed
and `sudo -n` is denied.** The workaround: `apt-get download` the recursive dep
closure, `dpkg-deb -x` it all into `/tmp/sysroot`, then launch with

```bash
LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu:/tmp/sysroot/lib/x86_64-linux-gnu \
  /tmp/pwvenv/bin/python shots.py
```

This works — it produced the reference screenshots. If `/tmp/sysroot` is gone,
rebuild with `apt-cache depends --recurse --no-recommends ... libatk1.0-0t64
libatk-bridge2.0-0t64 libatspi2.0-0t64 libcups... | apt-get download` then
`dpkg-deb -x` each into `/tmp/sysroot`.

---

## 4. Recon status — COMPLETE (2026-08-05)

All migration-contract deliverables now exist. The dev agent is unblocked.

- [x] `SOURCE.md` — stack, access mode, read-only discipline, 14 numbered traps, 10 explicit gaps
- [x] `ROUTES.md` — 42 routes, 12 query params, malformed-URL 404 case, task-cluster→route map
- [x] `DESIGN.md` — tokens read via `getComputedStyle` on the live site (`assets/dumps/tokens.json`)
- [x] `TODO.md` — P0 (7) / P1 (28) / P2 (8) + a verification checklist
- [x] `assets/README.md` (18 views + component inventory), `assets/data_model.md` (13 entities)
- [x] `src/data/*.json` — 12 seed files, 4.61 MB
- [x] customer dump for `emma.lopez` — id 27, one address (id 26), **wishlist genuinely empty**,
      active cart = quote 255 with 3 lines / $350.42

Seed: 1 105 products · 301 categories · 3 080 reviews · 424 option groups ·
37 orders / 100 lines · 121 captured listings (48 searches) · 60 search terms.
Referential integrity verified: 0 dangling ids; every task start URL except the
deliberately malformed one resolves.

### Corrections to §2 above

- `product_options.jsonl` is **custom options only** — this dataset has
  **no configurable products and no swatches**. All 1 105 seeded products are
  `type_id = simple`; Size/Color are `catalog_product_option` rows of type
  `radio`.
- Product `description` must be read at **`store_id = 1`**. At `store_id = 0`
  every row is the placeholder string.

### Additional scratch state in `/tmp/recon/shopping/`

`descriptions.jsonl` (store-1 descriptions), `clean_desc.py`, `build_seed.py`
(the seed curation script — rerun it to regenerate `src/data/` from the dumps),
`tokens.py` / `tokens2.py` / `tokens.json` (design tokens),
`listing_url_map.json`, `home_products.json`, `search_terms.jsonl`.
`listings/` now holds **121** captures, not 90. All of this is mirrored into
`assets/dumps/` (gitignored) so it survives a `/tmp` sweep.
