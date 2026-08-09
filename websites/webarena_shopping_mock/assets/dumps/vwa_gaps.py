#!/usr/bin/env python3
"""VWA seed-gap analysis (READ-ONLY against the `shopping` container).

Derives, from assets/task_anchors_vwa.json + the current seed:

  * anchored SKUs      not resolvable in src/data/products.json
  * anchored url_keys  not resolvable (a `/<url_key>.html` route)
  * anchored names     not matching any seeded product name

then resolves each miss to a real `catalog_product_entity.entity_id` by
querying the container. Writes the id lists this shard needs to
assets/dumps/vwa_*.txt.

Nothing here mutates the source: every statement is a SELECT.
"""
import json, os, re, subprocess, sys

ROOT = "/webarena/CUA-Gym-Hub"
MOCK = f"{ROOT}/websites/webarena_shopping_mock"
DUMPS = f"{MOCK}/assets/dumps"

MYSQL = ["docker", "exec", "shopping", "mysql", "-umagentouser", "-pMyPassword",
         "magentodb", "-N", "-B", "-e"]


_LITERAL = re.compile(r"'(?:\\.|[^'\\])*'", re.S)


def q(sql):
    """Run one read-only SELECT and return rows as lists of column strings."""
    # Scan for mutating verbs with quoted literals blanked out first — product
    # names and url_keys legitimately contain words like "create" and "replace".
    bare = _LITERAL.sub("''", sql)
    assert bare.lstrip().upper().startswith("SELECT"), "not a SELECT"
    assert not re.search(r'\b(update|insert|delete|drop|alter|create|truncate|replace)\b',
                         bare, re.I), "refusing to run a mutating statement"
    r = subprocess.run(MYSQL + [sql], capture_output=True, text=True)
    if r.returncode:
        sys.exit("mysql failed: " + r.stderr[:2000])
    return [ln.split("\t") for ln in r.stdout.splitlines() if ln]


def esc(s):
    return s.replace("\\", "\\\\").replace("'", "\\'")


def main():
    anchors = json.load(open(f"{MOCK}/assets/task_anchors_vwa.json"))
    products = json.load(open(f"{MOCK}/src/data/products.json"))

    have_sku = {p["sku"] for p in products}
    have_key = {p["urlKey"] for p in products}
    have_name = {p["name"] for p in products}
    have_name_lc = {n.lower() for n in have_name}

    # ---- SKUs: an ASIN-shaped token anywhere in an anchor string/locator ----
    ASIN = re.compile(r"\bB0[0-9A-Z]{8}\b")
    skus = set()
    for s in anchors["anchor_strings"]:
        skus |= set(ASIN.findall(s["value"]))
    for l in anchors["anchor_locators"]:
        skus |= set(ASIN.findall(l["locator"]))
    for t in anchors["tasks"]:
        skus |= set(ASIN.findall(json.dumps(t)))
    missing_sku = sorted(skus - have_sku)

    # ---- url_keys: top-level `/<key>.html` anchor routes ----
    # A reference_url may be an alternation, e.g.
    #   __SHOPPING__/a.html |OR| __SHOPPING__/b.html
    # Splitting on |OR| matters: two product url_keys were hiding inside
    # alternations and looked "resolvable" only because the whole compound
    # string failed the .html test.
    keys = set()
    for r in anchors["anchor_routes"]:
        for part in r["path"].split("|OR|"):
            b = part.strip().replace("__SHOPPING__", "")
            b = b.split("?")[0].split("#")[0].lstrip("/")
            if b.endswith(".html") and "/" not in b:
                keys.add(b[:-5])
    missing_key = sorted(keys - have_key)

    # ---- names: any anchor string that is a real product name upstream ----
    # Only strings long enough to be a name are worth a round trip.
    #
    # Split on `|OR|` first. The extractor splits alternations in `reference_url`
    # but NOT in a program_html `must_include` value, so a requirement like
    # visualwebarena-438's arrives as one 250-char compound string. Unsplit it
    # matches no product name, so the whole pair silently dropped out of the
    # coverage check while looking like a clean pass. 41 anchor strings are
    # compound, hiding 9 real product names across 5 tasks.
    cand = set()
    for s in anchors["anchor_strings"]:
        for part in s["value"].split("|OR|"):
            part = part.strip()
            if len(part) >= 18 and not part.startswith("$"):
                cand.add(part)
    cand = sorted(cand)
    name_hits = {}          # exact container name -> entity_id
    B = 150
    for i in range(0, len(cand), B):
        chunk = cand[i:i + B]
        rows = q("SELECT v.entity_id, v.value FROM catalog_product_entity_varchar v "
                 "JOIN eav_attribute a ON a.attribute_id=v.attribute_id "
                 "AND a.attribute_code='name' AND a.entity_type_id=4 "
                 "WHERE v.store_id=0 AND v.value IN (%s);"
                 % ",".join("'%s'" % esc(c) for c in chunk))
        for eid, val in rows:
            name_hits[val] = int(eid)
    missing_name = sorted(n for n in name_hits if n not in have_name and n.lower() not in have_name_lc)

    # ---- resolve every miss to an entity_id ----
    ids = set()
    resolved = {"sku": {}, "url_key": {}, "name": {}}
    if missing_sku:
        for eid, sku in q("SELECT entity_id, sku FROM catalog_product_entity WHERE sku IN (%s);"
                          % ",".join("'%s'" % esc(s) for s in missing_sku)):
            ids.add(int(eid)); resolved["sku"][sku] = int(eid)
    if missing_key:
        for i in range(0, len(missing_key), B):
            chunk = missing_key[i:i + B]
            for eid, val in q(
                    "SELECT v.entity_id, v.value FROM catalog_product_entity_varchar v "
                    "JOIN eav_attribute a ON a.attribute_id=v.attribute_id "
                    "AND a.attribute_code='url_key' AND a.entity_type_id=4 "
                    "WHERE v.store_id=0 AND v.value IN (%s);"
                    % ",".join("'%s'" % esc(c) for c in chunk)):
                ids.add(int(eid)); resolved["url_key"][val] = int(eid)
    for n in missing_name:
        ids.add(name_hits[n]); resolved["name"][n] = name_hits[n]

    open(f"{DUMPS}/vwa_anchor_ids.txt", "w").write("\n".join(str(i) for i in sorted(ids)) + "\n")
    json.dump({"missing_sku": missing_sku, "missing_url_key": missing_key,
               "missing_name": missing_name, "resolved": resolved,
               "unresolved_sku": sorted(set(missing_sku) - set(resolved["sku"])),
               "unresolved_url_key": sorted(set(missing_key) - set(resolved["url_key"]))},
              open(f"{DUMPS}/vwa_gaps.json", "w"), indent=1)

    print(f"anchored SKUs      : {len(skus)} total, {len(skus & have_sku)} seeded, {len(missing_sku)} missing")
    print(f"anchored url_keys  : {len(keys)} total, {len(keys & have_key)} seeded, {len(missing_key)} missing")
    print(f"anchored names     : {len(name_hits)} resolve upstream, {len(missing_name)} missing from seed")
    print(f"entity_ids to add  : {len(ids)}")
    print(f"unresolved SKUs    : {len(set(missing_sku) - set(resolved['sku']))}")
    print(f"unresolved url_keys: {len(set(missing_key) - set(resolved['url_key']))}")


if __name__ == "__main__":
    main()
