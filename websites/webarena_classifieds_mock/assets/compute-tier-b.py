#!/usr/bin/env python3
"""Compute the Tier-B item set: every item visible on an anchor page."""
import json, re, subprocess, urllib.parse, collections, os

ROOT = "/webarena/CUA-Gym-Hub/websites/webarena_classifieds_mock"
PAGE = 12
ORDER_COL = {"i_price": "i.i_price", "dt_pub_date": "i.dt_pub_date",
             "dt_expiration": "i.dt_expiration"}


def q(sql):
    p = subprocess.run(["docker", "exec", "classifieds_db", "mysql", "-uroot", "-ppassword",
                        "osclass", "-Nse", sql], capture_output=True, text=True)
    return [l for l in p.stdout.split() if l]


anchors = json.load(open(os.path.join(ROOT, "assets/task_anchors.json")))
want = set(int(x) for x in open(os.path.join(ROOT, "assets/anchor_item_ids.txt")).read().split())
search_pages = []

for r in anchors["anchor_routes"]:
    path = r["path"]
    for part in re.split(r"\s*\|OR\|\s*|\s+and\s+", path):
        part = part.replace("__CLASSIFIEDS__", "").strip()
        if "page=search" not in part:
            continue
        qs = urllib.parse.parse_qs(part.split("?", 1)[1]) if "?" in part else {}
        g = lambda k: qs.get(k, [""])[0]
        search_pages.append(dict(cat=g("sCategory"), order=g("sOrder"),
                                 otype=g("iOrderType"), page=g("iPage"),
                                 pattern=g("sPattern"), region=g("sRegion")))

print("anchor search pages:", len(search_pages))

for sp in search_pages:
    where = ["i.b_active=1", "i.b_enabled=1"]
    if sp["cat"].isdigit():
        where.append("i.fk_i_category_id=%s" % sp["cat"])
    if sp["region"].isdigit():
        where.append("l.fk_i_region_id=%s" % sp["region"])
    col = ORDER_COL.get(sp["order"], "i.dt_pub_date")
    direction = "asc" if sp["otype"] == "asc" else "desc"
    page = int(sp["page"]) if sp["page"].isdigit() and int(sp["page"]) > 0 else 1
    off = (page - 1) * PAGE
    join = ("JOIN oc_t_item_location l ON l.fk_i_item_id=i.pk_i_id"
            if sp["region"].isdigit() else "")
    patt = ""
    if sp["pattern"]:
        p = sp["pattern"].replace("'", "").strip()
        join += " JOIN oc_t_item_description d ON d.fk_i_item_id=i.pk_i_id"
        patt = " AND MATCH(d.s_title, d.s_description) AGAINST('%s' IN BOOLEAN MODE)" % p
    sql = ("SELECT i.pk_i_id FROM oc_t_item i %s WHERE %s%s ORDER BY %s %s, i.pk_i_id ASC "
           "LIMIT %d OFFSET %d" % (join, " AND ".join(where), patt, col, direction, PAGE, off))
    want.update(int(x) for x in q(sql))

# home page: 12 most recent overall
want.update(int(x) for x in q(
    "SELECT pk_i_id FROM oc_t_item WHERE b_active=1 AND b_enabled=1 "
    "ORDER BY dt_pub_date DESC LIMIT 12"))

# first page of every category, both default and price-asc/desc — cheap insurance
for cat in range(2, 25):
    for col, d in (("dt_pub_date", "desc"), ("i_price", "asc"), ("i_price", "desc")):
        want.update(int(x) for x in q(
            "SELECT pk_i_id FROM oc_t_item WHERE b_active=1 AND fk_i_category_id=%d "
            "ORDER BY %s %s, pk_i_id ASC LIMIT 12" % (cat, col, d)))

# related listings (3 per anchor item, same category) shown on each anchor item page
anchor_ids = sorted(int(x) for x in
                    open(os.path.join(ROOT, "assets/anchor_item_ids.txt")).read().split())
cats = {}
for line in subprocess.run(["docker", "exec", "classifieds_db", "mysql", "-uroot", "-ppassword",
                            "osclass", "-Nse",
                            "SELECT pk_i_id,fk_i_category_id FROM oc_t_item WHERE pk_i_id IN (%s)"
                            % ",".join(map(str, anchor_ids))],
                           capture_output=True, text=True).stdout.strip().split("\n"):
    a, b = line.split("\t")
    cats[int(a)] = int(b)
for cat in sorted(set(cats.values())):
    want.update(int(x) for x in q(
        "SELECT pk_i_id FROM oc_t_item WHERE b_active=1 AND fk_i_category_id=%d "
        "ORDER BY dt_pub_date DESC LIMIT 24" % cat))

want = sorted(want)
open("/tmp/tier_b_ids.txt", "w").write("\n".join(map(str, want)))
print("TIER B item count:", len(want))
