#!/usr/bin/env python3
"""THE anchor sweep — one script, threshold-free, for webarena + visualwebarena.

Purpose
-------
Answer one question honestly: **does every string a shopping evaluator will
compare against page text resolve somewhere in the seed?**

Three consecutive rounds reported "100 % of anchored names resolve" and were
refuted, every time because the *denominator* was narrower than the contract:

  round 5  compared with `==` where `must_include` is a substring test
  round 6  read only store view 1's product names
  round 7  swept `program_html` only, dropped `|OR|` alternation, and imposed a
           12-character floor on what counts as an anchor string
           -> `EOS R6` (6), `Boo Berry` (9) and `Alpha A7 II` (11) fell through

So this sweep is defined by what it refuses to do:

  * **No length floor.** `must_include` is `str.__contains__`; it has no length
    semantics, so any floor above 0 can hide an anchor. Short strings are
    self-filtering — a 2-character string is a substring of some seeded name
    with near-certainty and drops out of the miss list on its own. Filtering is
    the *result*, never the input.
  * **No slot allow-list.** The whole `eval` object is walked recursively:
    `reference_answers`, `reference_url`, every `program_html` entry's `url` /
    `locator` / `required_contents`, and `page_image_query`'s
    `eval_image_url` / `eval_image_class` / `eval_fuzzy_image_match` /
    `eval_vqa`. New evaluator keys are picked up automatically because nothing
    is enumerated.
  * **No dropped alternation.** Every string is split on `|OR|` and each branch
    stripped, because the evaluator scores a task as passing if ANY branch
    matches. `"Count Chocula |OR| COUNT CHOCULA"` kept whole matches no product
    on earth, which is exactly how it scored as a non-anchor for a round.
  * **No dropped store view.** Container names are read at every `store_id`.
  * **No single file.** Both `/webarena/webarena.jsonl` and
    `/webarena/visualwebarena.jsonl`, every task whose `web_name` includes
    `shopping`.
  * **No single surface.** A product NAME is not the only thing an evaluator
    reads. `webarena-23` wants a reviewer's nickname, `visualwebarena-173` an
    option value, `webarena-362` a billing address off a seeded order. So both
    sides are swept over the same six surfaces — names, SKUs/url keys, review
    nickname/title/detail, option titles and values, category names, and the
    order/customer/cart records — and a string resolves if it lands in ANY of
    them. Sweeping names alone is how round 7's "277 resolved" was computed;
    it makes every reviewer-name anchor look like a missing product.
  * **No implicit triage.** Every container-hit/seed-miss string is printed with
    its tasks and its candidate container entities. A string is only ever
    dismissed by a human writing it into `FALSE_POSITIVES` below, with a reason.

One thing the sweep DOES fold in, because the evaluator does: `|OR|` branches
are siblings of one assertion, and webarena's `must_include` scores the slot as
passing when ANY branch matches. A branch that misses while a sibling resolves
is reported, but marked `sibling-resolves`, and is not a blocked task.

Usage
-----
    python3 anchor_sweep.py                 # sweep, using the cached container dump
    python3 anchor_sweep.py --refresh       # re-dump container names first (~10 s)
    python3 anchor_sweep.py --seed DIR      # sweep a different src/data

Writes `anchor_sweep.json` (machine-readable, for the next round's test script)
next to itself and prints the report.

READ-ONLY against the container: the only statements it runs are SELECTs.
"""
import json, os, re, subprocess, sys, collections, base64, argparse

MOCK = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DUMPS = f"{MOCK}/assets/dumps"
TASKS = ["/webarena/webarena.jsonl", "/webarena/visualwebarena.jsonl"]
NAMES_TSV = f"{DUMPS}/container_names.b64.tsv"
META_TSV = f"{DUMPS}/container_products.tsv"
# One file per extra container surface, each a plain list of base64 strings.
SURFACE_TSV = {
    "review_nickname": f"{DUMPS}/container_review_nicknames.b64.txt",
    "review_title": f"{DUMPS}/container_review_titles.b64.txt",
    "option": f"{DUMPS}/container_option_titles.b64.txt",
    "category": f"{DUMPS}/container_category_names.b64.txt",
}
SURFACE_SQL = {
    "review_nickname": "SELECT DISTINCT REPLACE(TO_BASE64(nickname),'\\n','') FROM review_detail "
                       "WHERE nickname IS NOT NULL AND nickname<>'';",
    "review_title": "SELECT DISTINCT REPLACE(TO_BASE64(title),'\\n','') FROM review_detail "
                    "WHERE title IS NOT NULL AND title<>'';",
    "option": "SELECT DISTINCT REPLACE(TO_BASE64(title),'\\n','') FROM catalog_product_option_type_title "
              "UNION SELECT DISTINCT REPLACE(TO_BASE64(title),'\\n','') FROM catalog_product_option_title;",
    "category": "SELECT DISTINCT REPLACE(TO_BASE64(value),'\\n','') FROM catalog_category_entity_varchar "
                "WHERE attribute_id=45 AND value IS NOT NULL;",
}

MYSQL = ["docker", "exec", "shopping", "mysql", "-umagentouser", "-pMyPassword",
         "magentodb", "-N", "--raw", "-B", "-e"]

# `TO_BASE64` wraps its output at 76 characters. An unguarded TO_BASE64(value)
# silently drops 92 433 of the 112 209 name rows -- and every sweep downstream
# still reports a clean pass, because the rows it needed are simply not there.
NAMES_SQL = ("SELECT entity_id, store_id, REPLACE(TO_BASE64(value),'\\n','') "
             "FROM catalog_product_entity_varchar "
             "WHERE attribute_id=73 AND value IS NOT NULL;")
META_SQL = """SELECT e.entity_id, e.sku,
 IFNULL((SELECT value FROM catalog_product_entity_int WHERE entity_id=e.entity_id AND attribute_id=97 AND store_id=0),''),
 IFNULL((SELECT value FROM catalog_product_entity_int WHERE entity_id=e.entity_id AND attribute_id=99 AND store_id=0),''),
 IFNULL((SELECT value FROM catalog_product_entity_varchar WHERE entity_id=e.entity_id AND attribute_id=121 AND store_id=0),'')
FROM catalog_product_entity e;"""

# ---------------------------------------------------------------------------
# Triage. Every key here is a string that DOES resolve on some container surface
# and does NOT resolve on any seed surface, and that a human has established is
# not seed data at all. Nothing is dismissed by a rule -- no length floor, no
# slot filter -- so the only way a string leaves the miss list is a person
# writing it down with a reason, or the product/review being seeded.
#
# The sweep re-checks these: an entry that is no longer in the miss list is
# printed as STALE, so a key cannot outlive the reason it was added (which is
# how a stale allow-list would start hiding real misses again).
FALSE_POSITIVES = {
    # -- values the agent TYPES into a form; the task states them outright -----
    # visualwebarena-247 "...order it to 3235 Voigt Dr, La Jolla, CA 92093"
    # visualwebarena-237 "...set the left side address to 201 N Goodwin Ave in Urbana Illinois 61801"
    # visualwebarena-236 "...5000 Forbes Ave, Pittsburgh, PA 15213"
    # visualwebarena-390 "...rate it 5 stars, using my nickname EmLo"
    # These must be ENTERABLE, not seeded. Seeding them would be fabrication.
    "La Jolla": "typed shipping address (vwa-247)",
    "Urbana": "typed billing address (vwa-237)",
    "15213": "typed postcode (vwa-236)",
    "EmLo": "nickname the agent types into the review form (vwa-390/391/414/415)",

    # -- a price the agent READS off a page and answers with ------------------
    # The container hit is a coincidence: "0.14" is inside "10.14 Ounce",
    # "399.99" inside an ASURION plan name, "94.99" inside a review title.
    # Nothing is anchored to a literal seed field, so a substring sweep cannot
    # confirm or refute these; the derived-listing gap is what governs them.
    "$0.99": "derived price answer (vwa-294)",
    "$16.99": "derived price answer (vwa-65)",
    "$94.99": "derived price answer (vwa-253)",
    "0.14": "derived price answer (webarena-124)",
    "0.19": "derived price answer (vwa-41)",
    "1.04": "derived price answer (vwa-40)",
    "1.46": "derived price answer (webarena-125)",
    "1.93": "derived price answer (vwa-42)",
    "3.84": "derived price answer (vwa-201)",
    "7.58": "derived price answer (vwa-293)",
    "11.85": "derived price answer (vwa-8)",
    "13.12": "derived price answer (vwa-81)",
    "23.50": "derived price answer (vwa-13)",
    "26.77": "derived price answer (vwa-192)",
    "94.99": "derived price answer (vwa-253, webarena-228)",
    "399.99": "derived price answer (vwa-20)",

    # -- an answer read off a product PHOTO, not off any text field -----------
    # vwa-219 "What are the two types of birds on the front of that colorful
    # shirt?" on /clothing-shoes-jewelry/men/uniforms-work-safety.html. What the
    # seed owes this task is the right tile with the right image on that page,
    # which is a listing-capture property, not a string one.
    "toucan": "answer read from a product image (vwa-219)",
}

_OR = re.compile(r"\|OR\|")
_QUOTED = re.compile(r"'((?:\\.|[^'\\])*)'|\"((?:\\.|[^\"\\])*)\"")
_ASIN = re.compile(r"\bB0[0-9A-Z]{8}\b")


def sh(sql):
    bare = re.sub(r"'(?:\\.|[^'\\])*'", "''", sql)
    assert bare.lstrip().upper().startswith("SELECT"), "not a SELECT"
    assert not re.search(r"\b(update|insert|delete|drop|alter|create|truncate|replace)\b",
                         bare, re.I), "refusing to run a mutating statement"
    r = subprocess.run(MYSQL + [sql], capture_output=True, text=True, errors="replace")
    if r.returncode:
        sys.exit("mysql failed: " + r.stderr[:2000])
    return r.stdout


def refresh():
    out = sh(NAMES_SQL)
    open(NAMES_TSV, "w").write(out)
    print(f"container names: {out.count(chr(10))} rows -> {NAMES_TSV}")
    out = sh(META_SQL)
    open(META_TSV, "w", errors="replace").write(out)
    print(f"container products: {out.count(chr(10))} rows -> {META_TSV}")
    for k, sql in SURFACE_SQL.items():
        out = sh(sql)
        open(SURFACE_TSV[k], "w").write(out)
        print(f"container {k}: {out.count(chr(10))} rows -> {SURFACE_TSV[k]}")


# ---------------------------------------------------------------------------
def walk(obj, path=""):
    """Every string leaf in the eval object, with a dotted path.

    Deliberately structure-blind. `page_image_query[0].eval_vqa[1].question`
    reaches this function for exactly the same reason
    `program_html[0].required_contents.must_include[0]` does: nobody enumerated
    either of them.
    """
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk(v, f"{path}[{i}]")


def branches(s):
    """`|OR|` alternation, stripped. Plus, for func:/lambda: locators, the
    string literals inside them -- `shopping_get_order_product_quantity(
    __page__,'B08H5STXXC |OR| B07YGWT3KV')` hides its own alternation one level
    down, and `Array.from(...).find(el => el.textContent.includes('Royal ...'))`
    hides a page-text assertion inside JavaScript."""
    out = []
    for b in _OR.split(s):
        b = b.strip()
        if b:
            out.append(b)
    if s.startswith(("func:", "lambda:")):
        for m in _QUOTED.finditer(s):
            lit = (m.group(1) if m.group(1) is not None else m.group(2)).strip()
            for b in _OR.split(lit):
                b = b.strip()
                if b:
                    out.append(b)
    return out


def load_tasks():
    tasks = []
    for fn in TASKS:
        for line in open(fn, encoding="utf8"):
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            wn = r["web_name"]
            wn = wn if isinstance(wn, list) else [wn]
            if "shopping" not in wn:
                continue
            r["_file"] = os.path.basename(fn)
            tasks.append(r)
    return tasks


def load_container():
    if not os.path.exists(NAMES_TSV):
        sys.exit(f"missing {NAMES_TSV} -- run with --refresh")
    names = collections.defaultdict(dict)   # entity_id -> {store_id: name}
    for line in open(NAMES_TSV, encoding="utf8"):
        parts = line.rstrip("\n").split("\t")
        if len(parts) != 3 or not parts[2]:
            continue
        eid, sid, b64 = parts
        try:
            names[int(eid)][int(sid)] = base64.b64decode(b64).decode("utf8", "replace")
        except Exception:
            continue
    meta = {}
    for line in open(META_TSV, encoding="utf8", errors="replace"):
        p = line.rstrip("\n").split("\t")
        if len(p) != 5:
            continue
        meta[int(p[0])] = {"sku": p[1], "status": p[2], "visibility": p[3], "urlKey": p[4]}
    surfaces = {}
    for k, path in SURFACE_TSV.items():
        if not os.path.exists(path):
            sys.exit(f"missing {path} -- run with --refresh")
        vals = []
        for line in open(path, encoding="utf8"):
            line = line.strip()
            if line:
                try:
                    vals.append(base64.b64decode(line).decode("utf8", "replace"))
                except Exception:
                    pass
        surfaces[k] = vals
    return names, meta, surfaces


SEP = "\x00"


def blob_of(strings):
    """One lowercased haystack. `x in blob` is a single C-level search over the
    whole population instead of 112 209 Python-level `in` calls, and a match
    cannot span two records because NUL appears in no product name and in no
    assertion string (asserted below)."""
    return SEP + SEP.join(s.lower() for s in strings) + SEP


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--seed", default=f"{MOCK}/src/data")
    ap.add_argument("--emit-task-urls", action="store_true",
                    help="also write task_urls.vwa.txt for capture_listings.py")
    args = ap.parse_args()
    if args.refresh:
        refresh()

    tasks = load_tasks()
    cnames, cmeta, csurf = load_container()
    seed = json.load(open(f"{args.seed}/products.json"))

    # ---- collect every assertion string, no filter of any kind --------------
    slots = []          # one per (task, path, |OR| branch)
    for t in tasks:
        for path, raw in walk(t["eval"]):
            bs = branches(raw)
            for b in bs:
                slots.append({"task": t["id"], "file": t["_file"], "path": path,
                              "raw": raw, "s": b,
                              "slot_id": f"{t['id']}|{path}", "siblings": bs})
    strings = collections.defaultdict(list)
    for sl in slots:
        strings[sl["s"]].append(sl)
    assert not any(SEP in s for s in strings), "NUL in an assertion string"

    # ---- haystacks, one per surface ----------------------------------------
    all_cnames = [n for d in cnames.values() for n in d.values()]
    assert not any(SEP in n for n in all_cnames), "NUL in a container name"

    def seed_surfaces(d):
        prods = json.load(open(f"{d}/products.json"))
        revs = json.load(open(f"{d}/reviews.json"))
        opts = json.load(open(f"{d}/productOptions.json"))
        cats = json.load(open(f"{d}/categories.json"))
        optstr = []
        for lst in opts.values():
            for o in lst:
                optstr.append(o.get("title") or "")
                optstr += [v.get("title") or "" for v in o.get("values") or []]
        # Orders, the customer record, the cart and the wishlist are one blob:
        # they are small, and an address/order anchor (webarena-362) can land in
        # any of them. Dumping the JSON is deliberate -- it needs no schema.
        recs = "".join(open(f"{d}/{f}").read() for f in
                       ("orders.json", "customer.json", "cart.json", "wishlist.json"))
        return {
            "name": [p["name"] for p in prods],
            "sku_urlkey": [p["sku"] for p in prods] + [p["urlKey"] for p in prods],
            "review_nickname": [r["nickname"] or "" for r in revs],
            "review_title": [r["title"] or "" for r in revs],
            "review_detail": [r["detail"] or "" for r in revs],
            "option": optstr,
            "category": [c["name"] for c in cats],
            "records": [recs],
        }

    cont_surf = {
        "name": all_cnames,
        "sku_urlkey": [m["sku"] for m in cmeta.values()] + [m["urlKey"] for m in cmeta.values()],
        "review_nickname": csurf["review_nickname"],
        "review_title": csurf["review_title"],
        "option": csurf["option"],
        "category": csurf["category"],
    }
    cblobs = {k: blob_of(v) for k, v in cont_surf.items()}
    sblobs = {k: blob_of(v) for k, v in seed_surfaces(args.seed).items()}

    csku = {m["sku"]: eid for eid, m in cmeta.items()}
    ssku = {p["sku"] for p in seed}
    skey = {p["urlKey"] for p in seed}

    # ---- the test -----------------------------------------------------------
    rows = {}
    for s, refs in strings.items():
        low = s.lower()
        chit = [k for k, b in cblobs.items() if low in b]
        shit = [k for k, b in sblobs.items() if low in b]
        rows[s] = {
            "s": s, "len": len(s),
            "container": bool(chit), "container_surfaces": chit,
            "seed": bool(shit), "seed_surfaces": shit,
            "tasks": sorted({r["task"] for r in refs}),
            "paths": sorted({r["path"] for r in refs}),
        }
    # A branch whose sibling resolves is not a blocked assertion: webarena's
    # `must_include` passes the slot when ANY `|OR|` branch is found.
    for sl in slots:
        if len(sl["siblings"]) > 1 and any(rows[b]["seed"] for b in sl["siblings"]):
            rows[sl["s"]].setdefault("sibling_resolves", []).append(sl["slot_id"])
    rows = list(rows.values())
    misses = [r for r in rows if r["container"] and not r["seed"]]
    misses.sort(key=lambda r: (bool(r.get("sibling_resolves")), -r["len"], r["s"]))

    def candidates(s, limit=6):
        low = s.lower()
        out = []
        for eid, per in cnames.items():
            for sid, n in per.items():
                if low in n.lower():
                    m = cmeta.get(eid, {})
                    out.append({"entity_id": eid, "store_id": sid, "name": n,
                                "sku": m.get("sku"), "status": m.get("status"),
                                "visibility": m.get("visibility"), "urlKey": m.get("urlKey")})
                    break
            if len(out) >= limit:
                break
        # buyable first: an anchor satisfied only by a disabled/not-visible
        # product is not satisfied at all.
        out.sort(key=lambda c: (c["status"] != "1", c["visibility"] != "4", c["entity_id"]))
        return out

    for m in misses:
        m["candidates"] = candidates(m["s"])

    # ---- side checks that share the same walk ------------------------------
    # SKUs named anywhere in an eval object.
    asins = collections.defaultdict(set)
    for sl in slots:
        for a in _ASIN.findall(sl["s"]):
            asins[a].add(sl["task"])
    asin_miss = {a: sorted(t) for a, t in asins.items()
                 if a in csku and a not in ssku}

    # Single-segment product/category URLs.
    urls = collections.defaultdict(set)
    for sl in slots:
        for u in re.findall(r"__SHOPPING__(/[^\s\"'|]*)", sl["s"]):
            urls[u].add(sl["task"])
    # Magento serves a top-level category at the same single-segment shape as a
    # product (`/video-games.html`), so both are accepted.
    scat = {c["urlPath"] for c in json.load(open(f"{args.seed}/categories.json"))}
    prod_urls = {u: sorted(t) for u, t in urls.items()
                 if re.fullmatch(r"/[a-z0-9][a-z0-9\-_.]*\.html", u)}
    prod_url_miss = {u: t for u, t in prod_urls.items()
                     if u[1:-5] not in skey and u[1:-5] not in scat}

    # Evaluator media URLs -- settles the 42-vs-43 denominator by counting the
    # distinct URL, after |OR| splitting, over BOTH task files.
    media = collections.defaultdict(set)
    for sl in slots:
        for m_ in re.findall(r"(?:__SHOPPING__)?(/?media/[^\s\"'|]+)", sl["s"]):
            media["/" + m_.lstrip("/")].add(sl["task"])

    # ---- report -------------------------------------------------------------
    W = print
    W("=" * 78)
    W(f"shopping tasks            : {len(tasks)}  "
      f"({sum(1 for t in tasks if t['_file'].startswith('webarena'))} webarena + "
      f"{sum(1 for t in tasks if t['_file'].startswith('visual'))} visualwebarena)")
    W(f"assertion slots (task,path,|OR| branch) : {len(slots)}")
    W(f"distinct assertion strings              : {len(strings)}")
    W(f"  ... that resolve on some CONTAINER surface : {sum(1 for r in rows if r['container'])}")
    W(f"  ... that resolve on some SEED     surface  : {sum(1 for r in rows if r['seed'])}")
    hard = [m for m in misses if not m.get("sibling_resolves")]
    untriaged = [m for m in hard if m["s"] not in FALSE_POSITIVES]
    stale = sorted(set(FALSE_POSITIVES) - {m["s"] for m in misses})
    W(f"  ... container-hit AND seed-miss            : {len(misses)}"
      f"  ({len(hard)} with no resolving |OR| sibling)")
    W(f"  ... of those, already triaged in FALSE_POSITIVES : "
      f"{len(hard) - len(untriaged)}")
    W(f"  ... UNTRIAGED, i.e. blocked tasks          : {len(untriaged)}"
      f"   <-- this is the number that matters")
    if stale:
        W(f"  STALE FALSE_POSITIVES entries (no longer miss): {', '.join(map(repr, stale))}")
    W("=" * 78)
    for m in misses:
        if m["s"] in FALSE_POSITIVES:
            W(f"\n  [{m['len']:>3}] {m['s']!r}   -- triaged: {FALSE_POSITIVES[m['s']]}")
            continue
        sib = "   [sibling-resolves]" if m.get("sibling_resolves") else ""
        W(f"\n  [{m['len']:>3}] {m['s']!r}{sib}")
        W(f"        container surface: {', '.join(m['container_surfaces'])}")
        W(f"        tasks: {', '.join(m['tasks'])}")
        W(f"        slots: {', '.join(m['paths'])}")
        for c in m["candidates"]:
            W(f"        cand {c['entity_id']:>6} {c['sku']:<14} "
              f"st={c['status']} vis={c['visibility']}  {c['name'][:88]}")
    W("\n" + "=" * 78)
    W(f"SKUs named by an evaluator and absent from the seed : {len(asin_miss)}")
    for a, t in sorted(asin_miss.items()):
        W(f"   {a}  container entity {csku[a]}  tasks {', '.join(t)}")
    W(f"single-segment .html URLs asserted : {len(prod_urls)}, "
      f"not a seeded urlKey: {len(prod_url_miss)}")
    for u, t in sorted(prod_url_miss.items()):
        W(f"   {u}  tasks {', '.join(t)}")
    W(f"distinct evaluator /media URLs : {len(media)}")
    W("=" * 78)

    json.dump({
        "tasks": len(tasks), "slots": len(slots), "strings": len(rows),
        "container_hits": sum(1 for r in rows if r["container"]),
        "seed_hits": sum(1 for r in rows if r["seed"]),
        "misses": misses,
        "asin_miss": asin_miss,
        "product_url_miss": prod_url_miss,
        "media_urls": sorted(media),
        "untriaged": [m["s"] for m in untriaged],
    }, open(f"{DUMPS}/anchor_sweep.json", "w"), indent=1)
    W(f"wrote {DUMPS}/anchor_sweep.json")

    if args.emit_task_urls:
        # Every listing-shaped URL any shopping task starts on or asserts
        # against, for capture_listings.py. Derived from `web` (the start URL)
        # AND the eval object, over BOTH task files -- `task_urls.txt` was
        # webarena-only, which left all 479 VWA start URLs uncaptured.
        cats = scat
        out = set()
        for t in tasks:
            web = t["web"] if isinstance(t["web"], list) else [t["web"]]
            for blob in [json.dumps(t["eval"])] + [str(x) for x in web]:
                for u in re.findall(r"__SHOPPING__(/[^\s\"'|,\\]*)", blob):
                    path, _, qs = u.partition("?")
                    if path.startswith("/catalogsearch/result"):
                        out.add(u)
                    elif path.endswith(".html") and (qs or path[1:-5] in cats):
                        out.add(u)
        p = f"{DUMPS}/task_urls.vwa.txt"
        open(p, "w").write("\n".join(sorted(out)) + "\n")
        W(f"wrote {p}: {len(out)} listing-shaped task URLs")

    return 1 if untriaged or asin_miss or prod_url_miss else 0


if __name__ == "__main__":
    sys.exit(main())
